import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

describe('the package manifest', () => {
  it('declares phaser at exactly 4.2.1, with no range', () => {
    expect(manifest.dependencies?.['phaser']).toBe('4.2.1');
  });

  it('has phaser as its only runtime dependency', () => {
    expect(Object.keys(manifest.dependencies ?? {})).toEqual(['phaser']);
  });

  it('makes the production build with outbound network access denied', () => {
    expect(manifest.scripts?.['build']).toMatch(
      /^NODE_OPTIONS=--import=\.\/scripts\/deny-network\.mjs vite build$/,
    );
  });
});
