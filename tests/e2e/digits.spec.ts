import { expect, test } from './arcade';

interface DrawnNumber {
  text: string;
  glyphs: { char: string; width: number; height: number }[];
}

test('a number drawn in bitmap digits reports one glyph per digit @smoke', async ({ arcade }) => {
  await arcade.open();
  await arcade.call('openCheck', 'blank-check');
  await expect.poll(() => arcade.screen()).toBe('blank-check');
  const { number } = (await arcade.snapshot()).state as { number: DrawnNumber };

  const digits = [...number.text];
  expect(new Set(digits), 'the number uses every digit').toEqual(new Set('0123456789'));
  expect(number.glyphs.map((glyph) => glyph.char)).toEqual(digits);
  for (const glyph of number.glyphs) {
    expect(glyph.width, glyph.char).toBeGreaterThan(0);
    expect(glyph.height, glyph.char).toBeGreaterThan(0);
  }
});
