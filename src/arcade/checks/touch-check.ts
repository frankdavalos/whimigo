import * as Phaser from 'phaser';
import type { Rect, ScreenSnapshot, SnapshotTarget, Zone } from '@/contract';
import { picture } from '@/kit/atlas';
import { drawNumber, type DrawnNumber } from '@/kit/digits';
import type { TouchInput } from '@/kit/seat-touches';
import { createStage, type Stage } from '@/kit/stage';
import { holdButton, iconButton, type IconButton } from '@/kit/controls';
import { colors, seats, sizes } from '@/kit/theme';
import { onTouchesReset } from '@/kit/touches';
import { fromZoneLocal } from '@/kit/zones';
import { GROWN_UPS } from '../grown-ups';
import type { ArcadeScreen, CheckScreen, ScreenData } from '../screen';
import {
  forgetTouches,
  readTouch,
  resetReadings,
  startReadings,
  switchSeating,
  type TouchReadings,
} from './touch-readings';

const SEATING_ICON = {
  'side-by-side': 'arcade/seating-side-by-side',
  'around-the-table': 'arcade/seating-around-the-table',
} as const;

/** Drawn objects sit in layers: Zones at the back, markers in front of everything. */
const ZONE_DEPTH = -1;
const MARKER_DEPTH = 10;
/** Slot numbers in markers, and the three readings, are drawn smaller than full-size digits. */
const MARKER_DIGITS = 0.6;
const READING_DIGITS = 0.75;
const ZONE_FILL = { idle: 0.25, held: 0.7 };

interface DrawnZone {
  readonly zone: Zone;
  readonly fill: Phaser.GameObjects.Rectangle;
  readonly badge: Phaser.GameObjects.Image;
  readonly counter: DrawnNumber;
}

interface Marker {
  readonly ring: Phaser.GameObjects.Image;
  readonly slot: DrawnNumber;
}

/**
 * The Touch Check: the measuring tool for gate G1, kept in the product. It marks every live
 * touch with its slot number, shows how many touches are down, the most there have been at once
 * and how many the system took away, and counts taps in four Zones for either Seating.
 *
 * Controls and Zones share the frame without overlapping. The controls stand in a column at the
 * left of the safe rectangle (Seating at the top, leave halfway down where every check screen
 * has it, reset at the bottom), and the three readings in a column at the right. The four Zones
 * fill the safe rectangle between the two columns, a control's gap away from each, so a tap in
 * a Zone can never reach a control.
 */
class TouchCheckScreen extends Phaser.Scene implements ArcadeScreen {
  stage!: Stage;
  private readings!: TouchReadings;
  private targets: Record<string, SnapshotTarget> = {};
  private seating!: IconButton;
  private shown!: { count: DrawnNumber; highest: DrawnNumber; cancellations: DrawnNumber };
  private zones: DrawnZone[] = [];
  private markers = new Map<number, Marker>();

  create({ arcade }: ScreenData): void {
    this.stage = createStage(this, arcade.services.safeAreaInsets());
    this.stage.backdrop({ color: colors.cream });
    const { safe } = this.stage;
    const column = sizes.button;
    const left = safe.x + column / 2;
    const right = safe.x + safe.width - column / 2;
    const rows = [safe.y + column / 2, safe.y + safe.height / 2, safe.y + safe.height - column / 2];

    const area: Rect = {
      x: safe.x + column + sizes.gap,
      y: safe.y,
      width: safe.width - 2 * (column + sizes.gap),
      height: safe.height,
    };
    this.readings = startReadings(area, 'around-the-table');
    this.markers = new Map();
    this.zones = [];

    this.seating = iconButton(this, {
      x: left,
      y: rows[0]!,
      icon: SEATING_ICON[this.readings.seating],
      onTap: () => this.change(switchSeating(this.readings)),
    });
    this.targets = {
      seating: this.seating.target,
      leave: holdButton(this, {
        x: left,
        y: rows[1]!,
        icon: 'arcade/home',
        onHold: () => arcade.show(GROWN_UPS),
      }).target,
      reset: holdButton(this, {
        x: left,
        y: rows[2]!,
        icon: 'arcade/reset',
        onHold: () => this.change(resetReadings(this.readings)),
      }).target,
    };

    const reading = (y: number, icon: string) => {
      picture(this, right, y - 110, icon);
      const number = drawNumber(this, right, y + 100, 0);
      number.object.setScale(READING_DIGITS);
      return number;
    };
    this.shown = {
      count: reading(rows[0]!, 'arcade/touch-now'),
      highest: reading(rows[1]!, 'arcade/touch-most'),
      cancellations: reading(rows[2]!, 'arcade/touch-cancelled'),
    };

    const read = (kind: TouchInput['kind'], pointer: Phaser.Input.Pointer, time: number) => {
      const at = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.change(readTouch(this.readings, { kind, id: pointer.id, x: at.x, y: at.y, time }));
    };
    const lift = (pointer: Phaser.Input.Pointer) =>
      read(pointer.wasCanceled ? 'cancel' : 'up', pointer, pointer.upTime);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) =>
      read('down', pointer, pointer.downTime),
    );
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) read('move', pointer, pointer.moveTime);
    });
    this.input.on('pointerup', lift);
    this.input.on('pointerupoutside', lift);
    onTouchesReset(this, () => this.change(forgetTouches(this.readings)));

    this.draw();
    arcade.shown(this);
  }

  private change(readings: TouchReadings): void {
    const seatingChanged = readings.seating !== this.readings.seating;
    this.readings = readings;
    if (seatingChanged) {
      for (const drawn of this.zones) {
        drawn.fill.destroy();
        drawn.badge.destroy();
        drawn.counter.object.destroy();
      }
      this.zones = [];
      this.seating.setIcon(SEATING_ICON[readings.seating]);
    }
    this.draw();
  }

  /** Brings every drawn object up to date with the readings. */
  private draw(): void {
    const { readings } = this;
    if (this.zones.length === 0) this.zones = readings.zones.map((zone) => this.drawZone(zone));
    for (const { zone, fill, counter } of this.zones) {
      fill.setFillStyle(
        seats[zone.seat].color,
        readings.held.includes(zone.seat) ? ZONE_FILL.held : ZONE_FILL.idle,
      );
      counter.object.setText(String(readings.taps[zone.seat]));
    }

    this.shown.count.object.setText(String(readings.live.length));
    this.shown.highest.object.setText(String(readings.highest));
    this.shown.cancellations.object.setText(String(readings.cancellations));

    const live = new Set(readings.live.map(({ slot }) => slot));
    for (const [slot, marker] of this.markers) {
      if (live.has(slot)) continue;
      marker.ring.destroy();
      marker.slot.object.destroy();
      this.markers.delete(slot);
    }
    for (const { slot, x, y } of readings.live) {
      let marker = this.markers.get(slot);
      if (!marker) {
        const ring = picture(this, x, y, 'arcade/touch-marker').setDepth(MARKER_DEPTH);
        const number = drawNumber(this, x, y, slot);
        number.object.setScale(MARKER_DIGITS).setDepth(MARKER_DEPTH);
        marker = { ring, slot: number };
        this.markers.set(slot, marker);
      }
      marker.ring.setPosition(x, y);
      marker.slot.object.setPosition(x, y);
    }
  }

  /** A Zone's fill, and its Seat's shape above its tap counter, both turned to face its Player. */
  private drawZone(zone: Zone): DrawnZone {
    const { rect, facing } = zone;
    const fill = this.add
      .rectangle(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height)
      .setDepth(ZONE_DEPTH);
    const middle = { x: rect.width / 2, y: rect.height / 2 };
    const badgeAt = fromZoneLocal(zone, middle.x, middle.y - 170);
    const counterAt = fromZoneLocal(zone, middle.x, middle.y + 150);
    const badge = picture(this, badgeAt.x, badgeAt.y, seats[zone.seat].shape).setAngle(facing);
    const counter = drawNumber(this, counterAt.x, counterAt.y, 0);
    counter.object.setAngle(facing);
    return { zone, fill, badge, counter };
  }

  snapshot(): ScreenSnapshot {
    const { readings } = this;
    const angle = (object: { angle: number }) => (Math.round(object.angle) + 360) % 360;
    return {
      state: {
        seating: readings.seating,
        count: readings.live.length,
        highest: readings.highest,
        cancellations: readings.cancellations,
        drawn: {
          count: this.shown.count.describe().text,
          highest: this.shown.highest.describe().text,
          cancellations: this.shown.cancellations.describe().text,
        },
        live: readings.live.map(({ slot, x, y }) => {
          const marker = this.markers.get(slot)!;
          return {
            slot,
            x,
            y,
            marker: { x: marker.ring.x, y: marker.ring.y, text: marker.slot.describe().text },
          };
        }),
        zones: this.zones.map(({ zone, fill, badge, counter }) => ({
          ...zone,
          // As drawn: the Seat's colour, more opaque while the Zone is held.
          fill: { color: fill.fillColor, alpha: fill.fillAlpha },
          held: readings.held.includes(zone.seat),
          taps: readings.taps[zone.seat],
          lastTouch: readings.lastTouch[zone.seat],
          badge: { frame: badge.frame.name, x: badge.x, y: badge.y, angle: angle(badge) },
          counter: {
            text: counter.describe().text,
            x: counter.object.x,
            y: counter.object.y,
            angle: angle(counter.object),
          },
        })),
      },
      targets: this.targets,
    };
  }
}

export const touchCheck: CheckScreen = {
  id: 'touch-check',
  title: 'Touch Check',
  scene: TouchCheckScreen,
  icon: 'arcade/check-touch',
};
