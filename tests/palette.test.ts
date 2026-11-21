import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ASSETS } from '../scripts/assets/build-assets';
import { colors as palette, cssColor } from '../src/kit/theme';
import { readdirSync } from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));

/** The style guide's own exceptions: grown-ups' tools that are not art for children. */
const NOT_ART = new Set(['standin']);

/** Every SVG of every set of art the asset build packs, with the Game Cards; and the app icon. */
function artFiles(): string[] {
  const files = ['src/arcade/app-icon.svg'];
  for (const set of ASSETS.sets) {
    if (NOT_ART.has(set.id)) continue;
    const svgs = readdirSync(join(root, set.dir), { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.svg'))
      .map((file) => join(set.dir, file));
    files.push(...svgs, ...(set.extras ?? []).map((extra) => extra.file));
  }
  return files;
}

/** Every colour an SVG names: hex colours, and any colour given by name or function. */
function coloursIn(svg: string): string[] {
  const hex = [...svg.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(([found]) => found.toLowerCase());
  const named = [...svg.matchAll(/(?:fill|stroke|stop-color|color)\s*[=:]\s*"?([a-zA-Z(][^";]*)/g)]
    .map(([, value]) => value!.trim())
    .filter(
      (value) =>
        !['none', 'currentColor', 'transparent'].includes(value) && !value.startsWith('url('),
    );
  return [...hex, ...named];
}

describe('the style guide’s palette', () => {
  const tokens = new Set(Object.values(palette).map(cssColor));

  it('is limited, and every token is a different colour', () => {
    expect(tokens.size).toBe(Object.keys(palette).length);
    expect(tokens.size).toBeLessThanOrEqual(24);
  });

  it('finds the art of the Arcade and of every Game', () => {
    const files = artFiles();
    expect(files.some((file) => file.includes('/mascot/'))).toBe(true);
    for (const set of ASSETS.sets.filter(({ id }) => !NOT_ART.has(id) && id !== 'arcade')) {
      expect(
        files.some((file) => file.startsWith(set.dir)),
        set.id,
      ).toBe(true);
    }
  });

  for (const file of artFiles()) {
    it(`is the only source of colour in ${file}`, async () => {
      const svg = await readFile(join(root, file), 'utf8');
      const outside = coloursIn(svg).filter((colour) => !tokens.has(colour));
      expect(outside, 'colours that are not palette tokens').toEqual([]);
    });
  }
});
