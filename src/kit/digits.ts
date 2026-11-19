import type * as Phaser from 'phaser';
import type { Rect } from '@/contract';
import { atlasOf } from './atlas';

type FontData = Phaser.Types.GameObjects.BitmapText.BitmapFontData;
type Glyph = Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData & { xAdvance: number };

/**
 * The digits 0 to 9 as a bitmap font (ADR-0005), made from frames of the Arcade's atlas rather
 * than from a font file. Provisional until the Phase 1 style guide chooses the typeface.
 */
export const DIGIT_FONT = 'arcade/digits';

/** Design units between one digit's frame and the next, so their outlines never touch. */
export const DIGIT_GAP = 8;

/** The atlas frame of one digit. */
const digitFrame = (digit: number) => `arcade/digit-${digit}`;

/**
 * Phaser's bitmap font data for the digits, given where each digit's frame sits on its texture
 * (digit 0 first) and the texture's size. Each glyph advances by its own frame's width and the gap.
 */
export function digitFontData(
  frames: readonly Rect[],
  texture: { readonly width: number; readonly height: number },
): FontData {
  const tallest = Math.max(...frames.map((frame) => frame.height));
  const chars: Record<number, Glyph> = {};
  frames.forEach(({ x, y, width, height }, digit) => {
    chars[String(digit).charCodeAt(0)] = {
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
  const texture = scene.textures.get(atlasOf(digitFrame(0)));
  const frames = Array.from({ length: 10 }, (_, digit) => {
    if (!texture.has(digitFrame(digit))) throw new Error(`No frame "${digitFrame(digit)}"`);
    const frame = texture.get(digitFrame(digit));
    return { x: frame.cutX, y: frame.cutY, width: frame.cutWidth, height: frame.cutHeight };
  });
  scene.cache.bitmapFont.add(DIGIT_FONT, {
    data: digitFontData(frames, texture.source[0]!),
    texture: texture.key,
    frame: digitFrame(0),
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

/** Draws a whole number in bitmap digits, centred on (x, y). No Phaser Text object is used. */
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
