import type * as Phaser from 'phaser';
import type { Seat, SnapshotTarget } from '@/contract';
import { picture } from './atlas';
import { CONTROL_AREAS } from './control-areas';
import { createHold } from './hold';
import { colors, sizes } from './theme';
import { onTouchesReset } from './touches';

/**
 * The kit's controls (overview, Visual system). Screens and Games build everything a child touches
 * with these, and each reports the rectangle that takes its touches, never under 256 units square
 * whatever it was asked for. The turnPointer is in turn-pointer.ts.
 */

/** What every control reports. */
export interface Control {
  readonly target: SnapshotTarget;
}

interface Placed {
  /** Centre, in design units. */
  readonly x: number;
  readonly y: number;
  /** Draws it, and takes its touches, above everything of a lower depth. Defaults to 0. */
  readonly depth?: number;
}

const targetOf = (x: number, y: number, rect: SnapshotTarget['rect']): SnapshotTarget => ({
  x,
  y,
  rect,
});

/**
 * Calls `onTap` when a finger that came down on `hit` lifts on it. A finger that slides off first,
 * or a touch the system takes away, does nothing.
 */
function onTap(scene: Phaser.Scene, hit: Phaser.GameObjects.Rectangle, tapped: () => void): void {
  const pressed = new Set<number>();
  hit
    .setInteractive()
    .on('pointerdown', (pointer: Phaser.Input.Pointer) => pressed.add(pointer.id))
    .on('pointerout', (pointer: Phaser.Input.Pointer) => pressed.delete(pointer.id))
    .on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pressed.delete(pointer.id) && !pointer.wasCanceled) tapped();
    });
  const forget = (pointer: Phaser.Input.Pointer) => pressed.delete(pointer.id);
  scene.input.on('pointerup', forget);
  onTouchesReset(scene, () => pressed.clear());
  scene.events.once('shutdown', () => scene.input.off('pointerup', forget));
}

/** The invisible rectangle that takes a control's touches. */
function hitArea(scene: Phaser.Scene, rect: SnapshotTarget['rect'], depth: number) {
  return scene.add
    .rectangle(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height)
    .setDepth(depth);
}

export interface ButtonOptions extends Placed {
  /** The atlas frame that is the button: a Mascot, a picture of a choice. */
  readonly frame: string;
  /** The width and height it is drawn at. Defaults to the standard control's. */
  readonly size?: number;
  readonly onTap: () => void;
}

export interface Button extends Control {
  /** The picture, for motion. */
  readonly face: Phaser.GameObjects.Image;
  /** Rings it in ink as the choice made, or takes the ring away. */
  setSelected(selected: boolean): void;
  /** Shows it with its centre at (x, y), taking touches there. */
  show(x: number, y: number): void;
  /** Hides it; it takes no touches until shown again. */
  hide(): void;
  /** Whether it shows. */
  readonly shown: boolean;
}

/** The space between a picture and the ring that marks it chosen. */
const RING_GAP = 20;

/** A picture that acts on a tap: a Mascot to join, a Play Style to choose. */
export function button(scene: Phaser.Scene, options: ButtonOptions): Button {
  const size = options.size ?? sizes.button;
  const depth = options.depth ?? 0;
  const ring = scene.add.graphics().setDepth(depth).setVisible(false);
  const reach = size / 2 + RING_GAP;
  ring
    .lineStyle(sizes.outline, colors.ink)
    .strokeRoundedRect(-reach, -reach, reach * 2, reach * 2, sizes.corner + RING_GAP);
  const face = picture(scene, options.x, options.y, options.frame).setDepth(depth);
  face.setScale(size / Math.max(face.width, face.height));
  const areaAt = (x: number, y: number) =>
    CONTROL_AREAS.button({ x, y, width: size, height: size });
  let target = targetOf(options.x, options.y, areaAt(options.x, options.y));
  const hit = hitArea(scene, target.rect, depth);
  onTap(scene, hit, options.onTap);
  let selected = false;
  let shown = true;
  const show = (x: number, y: number) => {
    shown = true;
    target = targetOf(x, y, areaAt(x, y));
    face.setPosition(x, y).setVisible(true);
    ring.setPosition(x, y).setVisible(selected);
    hit.setPosition(x, y).setInteractive();
  };
  show(options.x, options.y);
  return {
    get target() {
      return target;
    },
    get shown() {
      return shown;
    },
    face,
    setSelected(chosen) {
      selected = chosen;
      ring.setVisible(chosen && shown);
    },
    show,
    hide() {
      shown = false;
      face.setVisible(false);
      ring.setVisible(false);
      hit.disableInteractive();
    },
  };
}

export interface IconButtonOptions extends Placed {
  /** The atlas frame drawn on the button's face. */
  readonly icon: string;
  readonly onTap: () => void;
}

export interface IconButton extends Control {
  /** Draws a different icon on the button's face. */
  setIcon(icon: string): void;
  /** Shows the button faded when pressing it would do nothing. */
  setAvailable(available: boolean): void;
}

/** The face every tap control shares, from the Arcade's atlas, which is loaded at boot. */
const TAP_FACE = 'arcade/card';
/** The most of the face an icon covers; a larger icon is drawn smaller to fit. */
const ICON_ROOM = 240;

/** The standard control: an icon on the shared face, acting on a tap. */
export function iconButton(scene: Phaser.Scene, options: IconButtonOptions): IconButton {
  const { x, y } = options;
  const depth = options.depth ?? 0;
  const face = picture(scene, x, y, TAP_FACE).setDepth(depth);
  const icon = picture(scene, x, y, options.icon).setDepth(depth);
  const fit = () =>
    icon.setScale(Math.min(1, ICON_ROOM / Math.max(icon.frame.width, icon.frame.height)));
  fit();
  const rect = CONTROL_AREAS.iconButton({ x, y, width: sizes.button, height: sizes.button });
  onTap(scene, hitArea(scene, rect, depth), options.onTap);
  return {
    target: targetOf(x, y, rect),
    setIcon(frame) {
      icon.setFrame(frame);
      fit();
    },
    setAvailable(available) {
      const alpha = available ? 1 : 0.35;
      face.setAlpha(alpha);
      icon.setAlpha(alpha);
    },
  };
}

export interface HoldButtonOptions extends Placed {
  /** The atlas frame drawn on the button's face. */
  readonly icon: string;
  /** Called once each time a finger has stayed on the button for the whole hold. */
  readonly onHold: () => void;
}

/** The face every hold control shares, from the Arcade's atlas, which is loaded at boot. */
const HOLD_FACE = 'arcade/hold';

/**
 * A control that acts only on a deliberate hold of about half a second, filling a ring while it
 * is held. A short tap or a brush does nothing. Used for pausing a Round, leaving a screen and
 * resetting counters.
 */
export function holdButton(scene: Phaser.Scene, options: HoldButtonOptions): Control {
  const { x, y } = options;
  const size = sizes.button;
  const radius = size / 2;
  const hold = createHold();
  const depth = options.depth ?? 0;
  picture(scene, x, y, HOLD_FACE).setDepth(depth);
  picture(scene, x, y, options.icon).setDepth(depth);

  const ring = scene.add.graphics({ x, y }).setDepth(depth);
  const rect = CONTROL_AREAS.holdButton({ x, y, width: size, height: size });
  hitArea(scene, rect, depth)
    .setInteractive()
    .on('pointerdown', (pointer: Phaser.Input.Pointer) => hold.press(pointer.id, scene.time.now))
    .on('pointerout', (pointer: Phaser.Input.Pointer) => hold.release(pointer.id));
  const release = (pointer: Phaser.Input.Pointer) => hold.release(pointer.id);
  scene.input.on('pointerup', release);
  onTouchesReset(scene, () => hold.cancel());

  const update = () => {
    const now = scene.time.now;
    const done = hold.update(now);
    ring.clear();
    const progress = hold.progress(now);
    if (progress > 0) {
      ring
        .lineStyle(sizes.outline * 2, colors.coral)
        .beginPath()
        .arc(0, 0, radius - sizes.outline / 2, -Math.PI / 2, -Math.PI / 2 + progress * 2 * Math.PI)
        .strokePath();
    }
    if (done) options.onHold();
  };
  scene.events.on('update', update);
  scene.events.once('shutdown', () => {
    scene.events.off('update', update);
    scene.input.off('pointerup', release);
  });
  return { target: targetOf(x, y, rect) };
}

export interface PanelOptions extends Placed {
  readonly width: number;
  readonly height: number;
  /** A theme colour. */
  readonly color: number;
  /** Defaults to 1. */
  readonly alpha?: number;
}

/**
 * A rounded, outlined panel that other things stand on. It takes the touches that fall on it, so
 * nothing beneath it hears them.
 */
export function panel(scene: Phaser.Scene, options: PanelOptions): Control {
  const { x, y, width, height } = options;
  const depth = options.depth ?? 0;
  scene.add
    .graphics({ x, y })
    .setDepth(depth)
    .fillStyle(options.color, options.alpha ?? 1)
    .fillRoundedRect(-width / 2, -height / 2, width, height, sizes.corner)
    .lineStyle(sizes.outline, colors.ink)
    .strokeRoundedRect(-width / 2, -height / 2, width, height, sizes.corner);
  const rect = CONTROL_AREAS.panel({ x, y, width, height });
  hitArea(scene, rect, depth).setInteractive();
  return { target: targetOf(x, y, rect) };
}

export interface SeatBadgeOptions extends Placed {
  /** The width and height of the shape. Defaults to half the standard control. */
  readonly size?: number;
}

export interface SeatBadge extends Control {
  /** Shows a Seat's shape in its colour, or nothing. */
  show(seat: Pick<Seat, 'shape'> | null): void;
}

/**
 * A Seat's shape, in the Seat's colour: worn by a Mascot that has joined, and shown wherever a
 * Seat is. A colour is never shown without its shape. It listens for no touches; the rectangle it
 * reports is where it stands at the kit's least touch size, so a screen can keep its controls clear
 * of it.
 */
export function seatBadge(scene: Phaser.Scene, options: SeatBadgeOptions): SeatBadge {
  const { x, y } = options;
  const size = options.size ?? sizes.button / 2;
  const image = picture(scene, x, y, 'arcade/seat-circle')
    .setDepth(options.depth ?? 0)
    .setVisible(false);
  const scale = size / Math.max(image.width, image.height);
  return {
    target: targetOf(x, y, CONTROL_AREAS.seatBadge({ x, y, width: size, height: size })),
    show(seat) {
      if (seat) image.setFrame(seat.shape).setScale(scale).setVisible(true);
      else image.setVisible(false);
    },
  };
}
