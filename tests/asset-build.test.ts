import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createServer, type Plugin } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

  it('are not tracked by git', () => {
    const tracked = execFileSync('git', ['ls-files', '--', ...generated], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(tracked).toBe('');
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

/** A file of the build larger than Workbox precaches by default, which is 2 MiB. */
const LARGE = { fileName: 'large-for-the-precache.bin', bytes: 3 * 1024 * 1024 };

/** Adds the large file to the build's output, as a Game's big atlas or a long sound would. */
function largeFile(): Plugin {
  return {
    name: 'test-large-file',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: LARGE.fileName,
        source: new Uint8Array(LARGE.bytes),
      });
    },
  };
}

/**
 * One production build, made in-process into a temporary folder. It is in this file because the
 * tests here delete the generated assets, and Vitest runs the tests of one file one at a time.
 */
describe('a production build', () => {
  let out = '';

  beforeAll(async () => {
    for (const file of generated) rmSync(`${root}/${file}`, { force: true });
    out = mkdtempSync(join(tmpdir(), 'whimigo-build-'));
    await build({
      root,
      configFile: `${root}/vite.config.ts`,
      mode: 'production',
      logLevel: 'silent',
      build: { outDir: out, emptyOutDir: true },
      plugins: [largeFile()],
    });
  }, 60_000);

  afterAll(() => rmSync(out, { recursive: true, force: true }));

  it('makes the atlases and icons first, and bundles them', () => {
    expect(generated.filter((file) => !existsSync(`${root}/${file}`))).toEqual([]);
    const assets = readdirSync(join(out, 'assets'));
    for (const set of ASSETS.sets) {
      expect(
        assets.filter((file) => new RegExp(`^${set.id}-[\\w-]+\\.png$`).test(file)),
      ).toHaveLength(1);
    }
    for (const icon of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
      expect(existsSync(join(out, 'icons', icon)), icon).toBe(true);
    }
  });

  it('precaches a file over 2 MiB', () => {
    expect(statSync(join(out, LARGE.fileName)).size).toBeGreaterThan(2 * 1024 * 1024);
    const worker = readFileSync(join(out, 'sw.js'), 'utf8');
    const precached = [...worker.matchAll(/\burl"?\s*:\s*"([^"]+)"/g)].map((match) => match[1]);
    expect(precached).toContain('index.html');
    expect(precached).toContain(LARGE.fileName);
  });
});
