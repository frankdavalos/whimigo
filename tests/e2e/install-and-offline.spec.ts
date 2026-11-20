import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { PRECACHE_BUDGET_BYTES } from '../../scripts/precache';
import { expect, test } from './arcade';

/**
 * Installing and playing offline (stories 11 and 12, ADR-0008). Chromium only: the installability
 * check and the network switch are the Chromium DevTools protocol's.
 */

const BASE = '/whimigo/';
const dist = fileURLToPath(new URL('../../dist', import.meta.url));

test('Chromium reports no installability errors, and the manifest and service worker are scoped to /whimigo/', async ({
  baseURL,
}, testInfo) => {
  // The full Chromium, not the headless shell, which checks nothing; and a profile on disk, since
  // nothing installs from an incognito window.
  const context = await chromium.launchPersistentContext(testInfo.outputPath('profile'), {
    channel: 'chromium',
    baseURL: baseURL!,
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('./');
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(new URL(scope).pathname).toBe(BASE);

    const cdp = await context.newCDPSession(page);
    const manifest = await cdp.send('Page.getAppManifest');
    expect(manifest.errors).toEqual([]);
    expect(new URL(manifest.url).pathname).toBe(`${BASE}manifest.webmanifest`);
    expect(manifest.manifest).toMatchObject({
      scope: new URL(BASE, baseURL).href,
      startUrl: new URL(BASE, baseURL).href,
    });
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    expect(installabilityErrors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('the manifest opens the Arcade full-screen and landscape from /whimigo/, with icons at 192 and 512 pixels', async ({
  arcade,
  page,
  request,
}) => {
  await arcade.open();
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const response = await request.get(new URL(href!, page.url()).href);
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as {
    display: string;
    orientation: string;
    start_url: string;
    scope: string;
    icons: { src: string; sizes: string; type: string }[];
  };
  expect(manifest).toMatchObject({
    display: 'fullscreen',
    orientation: 'landscape',
    start_url: BASE,
    scope: BASE,
  });
  const sizes = manifest.icons.map((icon) => icon.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of manifest.icons) {
    const file = await request.get(new URL(icon.src, response.url()).href);
    expect(file.ok(), icon.src).toBe(true);
    expect(file.headers()['content-type']).toBe(icon.type);
    expect(new URL(file.url()).pathname.startsWith(BASE)).toBe(true);
  }
});

test('once the service worker has finished caching, every file the build emits is precached, and the total is at most 60 MB', async ({
  arcade,
  page,
}) => {
  await arcade.open();
  await expect.poll(() => arcade.call('offlineReady')).toBe(true);
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return urls;
  });
  const precached = cached.map((url) => new URL(url).pathname.slice(BASE.length)).sort();

  // The service worker's own script is kept by the browser with its registration, not cached.
  const emitted = readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dist, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .filter((file) => file !== 'sw.js')
    .sort();
  expect(emitted).toContain('index.html');
  expect(emitted.some((file) => file.endsWith('.png'))).toBe(true);
  expect(precached).toEqual(emitted);

  const total = emitted.reduce((sum, file) => sum + statSync(join(dist, file)).size, 0);
  expect(total, 'the precache total, in bytes').toBeLessThanOrEqual(PRECACHE_BUDGET_BYTES);
});

test('after one load has finished caching, with the network off, a reload reaches the Home Screen and every check screen opens', async ({
  arcade,
  context,
}) => {
  await arcade.open();
  await expect.poll(() => arcade.call('offlineReady')).toBe(true);
  await context.setOffline(true);

  await arcade.page.reload();
  await expect.poll(() => arcade.screen()).toBe('start');
  await arcade.start();
  const checks = await arcade.checks();
  expect(checks.length).toBeGreaterThan(0);
  for (const id of checks) {
    await arcade.call('openCheck', id);
    await expect.poll(() => arcade.screen()).toBe(id);
  }
});
