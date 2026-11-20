import { describe, expect, it } from 'vitest';
import { DIGIT_GAP, digitFontData } from './digits';

const texture = { width: 1024, height: 2048 };
/** Where each glyph's frame sits on the atlas page: the digits 0 to 9, then the decimal point. */
const glyphs: Record<string, { x: number; y: number; width: number; height: number }> = {
  ...Object.fromEntries(
    Array.from({ length: 10 }, (_, digit) => [
      String(digit),
      { x: 10 + digit * 140, y: 300, width: digit === 1 ? 100 : 136, height: 192 },
    ]),
  ),
  '.': { x: 10, y: 600, width: 56, height: 192 },
};

describe('the digit font', () => {
  const font = digitFontData(glyphs, texture);

  it('has a glyph for each digit 0 to 9 and the decimal point, and nothing else', () => {
    expect(
      Object.keys(font.chars)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([...'.0123456789'].map((char) => char.charCodeAt(0)));
  });

  it('draws each digit from its own frame, at the frame’s size', () => {
    const seven = font.chars['7'.charCodeAt(0)]!;
    expect(seven).toMatchObject({
      x: 990,
      y: 300,
      width: 136,
      height: 192,
      xOffset: 0,
      yOffset: 0,
    });
    // Texture coordinates as Phaser's own font parsers compute them, with v measured upwards.
    expect(seven.u0).toBeCloseTo(990 / 1024);
    expect(seven.u1).toBeCloseTo(1126 / 1024);
    expect(seven.v0).toBeCloseTo(1 - 300 / 2048);
    expect(seven.v1).toBeCloseTo(1 - 492 / 2048);
  });

  it('advances by each glyph’s own width and a small gap, so a narrow digit takes less room', () => {
    const advance = (digit: string) =>
      (font.chars[digit.charCodeAt(0)] as unknown as { xAdvance: number }).xAdvance;
    expect(DIGIT_GAP).toBeGreaterThan(0);
    expect(advance('1')).toBe(100 + DIGIT_GAP);
    expect(advance('8')).toBe(136 + DIGIT_GAP);
    expect(advance('.')).toBe(56 + DIGIT_GAP);
  });

  it('is one line as tall as the tallest digit', () => {
    expect(font.lineHeight).toBe(192);
    expect(font.size).toBe(192);
  });
});
