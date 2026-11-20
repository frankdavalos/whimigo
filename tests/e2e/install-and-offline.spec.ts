import { chromium } from '@playwright/test';
import { expect, test } from './arcade';

/**
 * Installing and playing offline (stories 11 and 12, ADR-0008). Chromium only: the installability
 * check and the network switch are the Chromium DevTools protocol's.
 */

const BASE = '/whimigo/';

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
