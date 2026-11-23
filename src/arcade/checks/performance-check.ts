import * as Phaser from 'phaser';
import type { Rect, ScreenSnapshot, SnapshotTarget } from '@/contract';
import { picture } from '@/kit/atlas';
import { drawNumber, type DrawnNumber } from '@/kit/digits';
import { createStage, type Stage } from '@/kit/stage';
import { holdButton, iconButton } from '@/kit/controls';
import { colors, sizes } from '@/kit/theme';
import { GROWN_UPS } from '../grown-ups';
import type { ArcadeScreen, CheckScreen, ScreenData } from '../screen';
import { createFrameMeter, type FrameMeter } from './frame-meter';
import { SceneCycles, STANDIN_ID } from './scene-cycles';
import { createStandardLoad, type LoadFrame, type StandardLoad } from './standard-load';
import { STANDIN_ATLAS } from './standin';

/** The load's one texture: the stand-in set's atlas, held under this screen's own name. */
const LOAD_TEXTURE = 'performance-check/load';
/**
 * The load moves the stand-in set's frames of playing-piece size, up to 300 units square: about
 * 27 mm on the iPad Pro, a token or a tile. Two hundred of them cover the design frame about three
 * times over.
 */
const LARGEST_PIECE = 300;
const SHARPNESS_CARD = 'arcade/sharpness';
/** Where the two rows of digits sit on the sharpness card, from its top-left corner. */
const CARD_DIGITS = [
  { text: '01234', x: 40, y: 560 },
  { text: '56789', x: 40, y: 776 },
] as const;
/** The readings and the sharpness card share a column this wide at the right of the safe area. */
const RIGHT_COLUMN = 800;
const READING_DIGITS = 0.75;
/** How often the drawn readings change, in milliseconds, so they can be read. */
const REDRAW_MS = 250;

/**
 * The Performance check: the measuring tool for gates G2, G3 and G6, kept in the product. A
 * standard load of sprites moves in the middle; at the right, frames per second, work per frame
 * and the loop's cycles are shown in bitmap digits above a sharpness card. At the left, the loop
 * control stands at the top, and the leave control halfway down, where every check screen has it.
 * Leaving while the loop runs stops it, and removes the stand-in Scene and its textures.
 *
 * Work per frame is measured in the page: the time from the game's `prestep` event to its
 * `postrender` event, which covers stepping every Scene and drawing them all. It is not derived
 * from the frame rate, which the display caps.
 */
class PerformanceCheckScreen extends Phaser.Scene implements ArcadeScreen {
  stage!: Stage;
  private targets: Record<string, SnapshotTarget> = {};
  private standardLoad!: StandardLoad;
  private loadArea!: Rect;
  private sprites: Phaser.GameObjects.Image[] = [];
  private meter!: FrameMeter;
  private shown!: { fps: DrawnNumber; workMs: DrawnNumber; cycles: DrawnNumber };
  private cycles!: SceneCycles;
  private sinceRedraw = 0;
  private card!: Phaser.GameObjects.Image;
  private cardDigits: DrawnNumber[] = [];

  preload(): void {
    this.load.atlas(LOAD_TEXTURE, STANDIN_ATLAS.image, STANDIN_ATLAS.frames);
  }

  create({ arcade }: ScreenData): void {
    this.stage = createStage(this, arcade.services.safeAreaInsets());
    this.stage.backdrop({ color: colors.cream });
    const { safe } = this.stage;
    const right = { x: safe.x + safe.width - RIGHT_COLUMN, bottom: safe.y + safe.height };

    this.cycles = new SceneCycles(this, arcade.services.safeAreaInsets());
    this.events.once('shutdown', () => this.cycles.stop());
    this.targets = {
      loop: iconButton(this, {
        x: safe.x + sizes.button / 2,
        y: safe.y + sizes.button / 2,
        icon: 'arcade/perf-loop',
        onTap: () => this.cycles.start(),
      }).target,
      leave: holdButton(this, {
        x: safe.x + sizes.button / 2,
        y: safe.y + safe.height / 2,
        icon: 'arcade/home',
        onHold: () => arcade.show(GROWN_UPS),
      }).target,
    };

    // The sharpness card, at the bottom of the right column, with its top-left corner on a whole unit.
    this.card = picture(this, 0, 0, SHARPNESS_CARD).setOrigin(0);
    this.card.setPosition(Math.round(right.x), Math.round(right.bottom - this.card.height));
    this.cardDigits = CARD_DIGITS.map(({ text, x, y }) => {
      const digits = drawNumber(this, 0, 0, 0);
      digits.object
        .setText(text)
        .setOrigin(0)
        .setPosition(this.card.x + x, this.card.y + y);
      return digits;
    });

    // The three readings, one above another in the right column above the card.
    const rowHeight = (this.card.y - sizes.gap - safe.y) / 3;
    const reading = (row: number, icon: string) => {
      const y = safe.y + rowHeight * (row + 0.5);
      picture(this, right.x + 80, y, icon);
      const number = drawNumber(this, right.x + 480, y, 0);
      number.object.setScale(READING_DIGITS);
      return number;
    };
    this.shown = {
      fps: reading(0, 'arcade/perf-fps'),
      workMs: reading(1, 'arcade/perf-work'),
      cycles: reading(2, 'arcade/perf-cycles'),
    };

    // The load fills the space between the leave control's column and the right column.
    const left = safe.x + sizes.button + sizes.gap;
    this.loadArea = { x: left, y: safe.y, width: right.x - sizes.gap - left, height: safe.height };
    const texture = this.textures.get(LOAD_TEXTURE);
    const frames: LoadFrame[] = texture
      .getFrameNames()
      .map((name) => texture.get(name))
      .filter((frame) => frame.width <= LARGEST_PIECE && frame.height <= LARGEST_PIECE)
      .map((frame) => ({ name: frame.name, width: frame.width, height: frame.height }));
    this.standardLoad = createStandardLoad(frames, this.loadArea);
    this.sprites = this.standardLoad
      .sprites()
      .map((sprite) => this.add.image(sprite.x, sprite.y, LOAD_TEXTURE, sprite.frame));

    this.meter = createFrameMeter();
    this.measureFrames();
    this.events.once('shutdown', () => this.textures.remove(LOAD_TEXTURE));
    arcade.shown(this);
  }

  /** Times every frame from the game's first event of a step to its last after drawing. */
  private measureFrames(): void {
    const events = this.game.events;
    let began: number | null = null;
    const begin = () => {
      began = performance.now();
    };
    const end = () => {
      if (began === null) return;
      const now = performance.now();
      this.meter.frame(now, now - began);
    };
    events.on('prestep', begin);
    events.on('postrender', end);
    this.events.once('shutdown', () => {
      events.off('prestep', begin);
      events.off('postrender', end);
    });
  }

  override update(_time: number, delta: number): void {
    this.standardLoad.advance(delta);
    this.standardLoad
      .sprites()
      .forEach(({ x, y }, index) => this.sprites[index]!.setPosition(x, y));
    const cycles = String(this.cycles.report().cycles);
    if (this.shown.cycles.object.text !== cycles) this.shown.cycles.object.setText(cycles);

    this.sinceRedraw += delta;
    if (this.sinceRedraw < REDRAW_MS) return;
    this.sinceRedraw = 0;
    const reading = this.meter.reading();
    if (!reading) return;
    this.shown.fps.object.setText(String(Math.round(reading.fps)));
    this.shown.workMs.object.setText(reading.workMs.toFixed(2));
  }

  snapshot(): ScreenSnapshot {
    const drawn = (number: DrawnNumber) => {
      const { text, glyphs } = number.describe();
      return { text, glyphs: glyphs.length };
    };
    const placed = (object: Phaser.GameObjects.Image | Phaser.GameObjects.BitmapText) => ({
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
      scaleX: object.scaleX,
      scaleY: object.scaleY,
      angle: object.angle,
    });
    return {
      state: {
        load: {
          sprites: this.sprites.length,
          textures: [...new Set(this.sprites.map((sprite) => sprite.texture.key))],
          frames: [...new Set(this.sprites.map((sprite) => sprite.frame.name))],
          positions: this.sprites.map(({ x, y }) => ({ x, y })),
          area: this.loadArea,
        },
        readings: this.meter.reading(),
        drawn: { fps: drawn(this.shown.fps), workMs: drawn(this.shown.workMs) },
        loop: {
          ...this.cycles.report(),
          standinTextures: this.textures
            .getTextureKeys()
            .filter((key) => key.startsWith(STANDIN_ID)),
          drawn: this.shown.cycles.object.text,
        },
        sharpness: {
          card: { frame: this.card.frame.name, ...placed(this.card) },
          digits: this.cardDigits.map((digits) => ({
            text: digits.object.text,
            ...placed(digits.object),
          })),
        },
      },
      targets: this.targets,
    };
  }
}

export const performanceCheck: CheckScreen = {
  id: 'performance-check',
  title: 'Performance check',
  scene: PerformanceCheckScreen,
  icon: 'arcade/check-performance',
};
