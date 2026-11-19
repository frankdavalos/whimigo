import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { describe, expect, it } from 'vitest';
import { ASSETS } from '../scripts/assets/build-assets';

const root = fileURLToPath(new URL('..', import.meta.url));
const generated = [
  ...ASSETS.sets
    .flatMap((set) => [`${set.id}.png`, `${set.id}.json`])
    .map((file) => `${ASSETS.atlasDir}/${file}`),
  ...['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'].map(
    (file) => `${ASSETS.iconDir}/${file}`,
  ),
];

describe('the generated atlases and icons', () => {
  it('are ignored by git', () => {
    const ignored = execFileSync('git', ['check-ignore', '--no-index', ...generated], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(ignored.trim().split('\n')).toEqual(generated);
  });

  it('are produced when the development server starts', { timeout: 30_000 }, async () => {
    for (const file of generated) rmSync(`${root}/${file}`, { force: true });
    const server = await createServer({
      root,
      configFile: `${root}/vite.config.ts`,
      mode: 'development',
      logLevel: 'silent',
      server: { middlewareMode: true, ws: false },
    });
    try {
      expect(generated.filter((file) => !existsSync(`${root}/${file}`))).toEqual([]);
    } finally {
      await server.close();
    }
  });
});
