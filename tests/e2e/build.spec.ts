import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBuildId } from '../../scripts/build-id';
import { budgetProblems } from '../../scripts/precache';
import { CATALOG } from '../../src/games/catalog';
import { expect, test } from './arcade';

const dist = fileURLToPath(new URL('../../dist', import.meta.url));
const expectedBuildId = resolveBuildId(process.env);

test('the bridge reports the build identifier of the commit that was built @smoke', async ({
  arcade,
}) => {
  await arcade.open();
  expect(expectedBuildId).not.toBe('unknown');
  expect(await arcade.page.evaluate(() => window.whimigo?.buildId)).toBe(expectedBuildId);
});

test('the build identifier is published as build.json beside the Arcade', async ({ request }) => {
  const response = await request.get('build.json');
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ buildId: expectedBuildId });
});

test('the build output contains no audio file', () => {
  const files = readdirSync(dist, { recursive: true, encoding: 'utf8' });
  expect(files.length).toBeGreaterThan(0);
  expect(
    files.filter((file) => /\.(mp3|ogg|oga|wav|m4a|aac|flac|opus|weba|webm)$/i.test(file)),
  ).toEqual([]);
});

test('each Game’s own files come to at most 5 MB, and everything precached to at most 60 MB', () => {
  // The service worker's own script is kept by the browser with its registration, not cached.
  const precached = readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .map((file) => ({ path: relative(dist, file).split(sep).join('/'), size: statSync(file).size }))
    .filter(({ path }) => path !== 'sw.js');
  expect(
    budgetProblems(
      precached,
      CATALOG.map((game) => game.id),
    ),
  ).toEqual([]);
});

/** A PNG's width and height, from its header. */
function pngSize(file: string) {
  const header = readFileSync(file);
  expect(header.subarray(1, 4).toString('latin1')).toBe('PNG');
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

test('the build output contains the app icons at 192 and 512 pixels and the apple-touch-icon', () => {
  expect(pngSize(`${dist}/icons/icon-192.png`)).toEqual({ width: 192, height: 192 });
  expect(pngSize(`${dist}/icons/icon-512.png`)).toEqual({ width: 512, height: 512 });
  expect(pngSize(`${dist}/icons/apple-touch-icon.png`)).toEqual({ width: 180, height: 180 });
});

test('the page links the apple-touch-icon, served from beneath the base path', async ({
  arcade,
  page,
  request,
}) => {
  await arcade.open();
  const href = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  const response = await request.get(new URL(href!, page.url()).href);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toBe('image/png');
  expect(new URL(response.url()).pathname).toBe('/whimigo/icons/apple-touch-icon.png');
});

test('the build output contains the Arcade’s atlas under a content-hashed name', () => {
  const assets = readdirSync(`${dist}/assets`);
  expect(assets.filter((file) => /^arcade-[\w-]+\.png$/.test(file))).toHaveLength(1);
  expect(assets.filter((file) => /^arcade-[\w-]+\.json$/.test(file))).toHaveLength(1);
});
