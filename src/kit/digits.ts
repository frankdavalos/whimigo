import type * as Phaser from 'phaser';
import type { Rect } from '@/contract';
import { atlasOf } from './atlas';

type FontData = Phaser.Types.GameObjects.BitmapText.BitmapFontData;
type Glyph = Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData & { xAdvance: number };

/**
 * The digits 0 to 9 and a decimal point as a bitmap font (ADR-0005), made from frames of the
 * Arcade's atlas rather than from a font file. No typeface is bundled; the glyphs are drawn to the
 * style guide (docs/design/style-guide.md).
 */
export const DIGIT_FONT = 'arcade/digits';

/** Design units between one digit's frame and the next, so their outlines never touch. */
export const DIGIT_GAP = 8;

/** Each character the font draws, and its frame in the Arcade's atlas. */
const GLYPH_FRAMES: Readonly<Record<string, string>> = {
  ...Object.fromEntries(Array.from({ length: 10 }, (_, digit) => [digit, `arcade/digit-${digit}`])),
  '.': 'arcade/digit-point',
};

/**
 * Phaser's bitmap font data, given where each character's frame sits on its texture and the
 * texture's size. Each glyph advances by its own frame's width and the gap.
 */
export function digitFontData(
  glyphs: Readonly<Record<string, Rect>>,
  texture: { readonly width: number; readonly height: number },
): FontData {
  const frames = Object.entries(glyphs);
  const tallest = Math.max(...frames.map(([, frame]) => frame.height));
  const chars: Record<number, Glyph> = {};
  frames.forEach(([char, { x, y, width, height }]) => {
    chars[char.charCodeAt(0)] = {
      x,
      y,
      width,
      height,
      centerX: Math.floor(width / 2),
      centerY: Math.floor(height / 2),
      xOffset: 0,
      yOffset: 0,
      xAdvance: width + DIGIT_GAP,
      data: {},
      kerning: {},
      // As Phaser's own font parsers compute them: v is measured up from the bottom.
      u0: x / texture.width,
      v0: 1 - y / texture.height,
      u1: (x + width) / texture.width,
      v1: 1 - (y + height) / texture.height,
    };
  });
  return { font: DIGIT_FONT, size: tallest, lineHeight: tallest, retroFont: false, chars };
}

/**
 * Adds the digit font to the game's cache from the Arcade's atlas, once that atlas has loaded.
 * Throws if a digit's frame is missing, rather than drawing the whole page in its place.
 */
export function addDigitFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(DIGIT_FONT)) return;
  const zero = GLYPH_FRAMES['0']!;
  const texture = scene.textures.get(atlasOf(zero));
  const glyphs = Object.fromEntries(
    Object.entries(GLYPH_FRAMES).map(([char, name]) => {
      if (!texture.has(name)) throw new Error(`No frame "${name}"`);
      const frame = texture.get(name);
      return [
        char,
        { x: frame.cutX, y: frame.cutY, width: frame.cutWidth, height: frame.cutHeight },
      ];
    }),
  );
  scene.cache.bitmapFont.add(DIGIT_FONT, {
    data: digitFontData(glyphs, texture.source[0]!),
    texture: texture.key,
    frame: zero,
    fromAtlas: true,
  });
}

/** A number drawn in bitmap digits. */
export interface DrawnNumber {
  readonly object: Phaser.GameObjects.BitmapText;
  /** For snapshots: the text drawn, and each glyph Phaser laid out for it, in design units. */
  describe(): {
    readonly text: string;
    readonly glyphs: readonly { char: string; width: number; height: number }[];
  };
}

/**
 * Draws a number in bitmap digits, centred on (x, y). No Phaser Text object is used. Its text may
 * be changed to any string of digits and decimal points.
 */
export function drawNumber(scene: Phaser.Scene, x: number, y: number, value: number): DrawnNumber {
  const object = scene.add.bitmapText(x, y, DIGIT_FONT, String(value)).setOrigin(0.5);
  return {
    object,
    describe: () => ({
      text: object.text,
      glyphs: object
        .getTextBounds()
        .characters.map(({ char, w, h }) => ({ char, width: w, height: h })),
    }),
  };
}
