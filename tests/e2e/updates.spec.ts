import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { type BuildServer, startBuildServer } from './build-server';
import { NEXT_BUILD } from './global-setup';
import { expect, test as base } from './arcade';
import { CATALOG, openSession, playToResult, sessionFor } from './play';

/**
 * A new version never arrives under a child's fingers (story 14, ADR-0008). Each test serves the
 * build under test from its own server, then deploys the next build (the same code with another
 * build identifier, made by global-setup.ts) at the same address while the page is open.
 */

const dist = fileURLToPath(new URL('../../dist', import.meta.url));
const buildIdOf = (dir: string) =>
  (JSON.parse(readFileSync(`${dir}/build.json`, 'utf8')) as { buildId: string }).buildId;

const test = base.extend<{ server: BuildServer; next: string }>({
  server: async ({}, use) => {
    const server = await startBuildServer(dist);
    await use(server);
    await server.close();
  },
  next: async ({}, use) => {
    const dir = process.env[NEXT_BUILD];
    if (!dir) throw new Error(`${NEXT_BUILD} is not set: global-setup.ts did not run`);
    await use(dir);
  },
  baseURL: async ({ server }, use) => use(server.url),
});

test('when the page becomes visible again, it asks the service worker to check for a new version', async ({
  arcade,
  server,
  page,
}) => {
  await arcade.open();
  await expect.poll(() => arcade.call('offlineReady')).toBe(true);
  const checks = server.requests('sw.js');

  await arcade.hide();
  await page.waitForTimeout(500);
  expect(server.requests('sw.js'), 'no check while hidden').toBe(checks);
  await arcade.show();
  await expect.poll(() => server.requests('sw.js')).toBe(checks + 1);
});

test('a newer build waits while the page is open; after a reload, the page runs it, reloading once before tap to start @smoke', async ({
  arcade,
  server,
  next,
  page,
}) => {
  const current = buildIdOf(dist);
  const newer = buildIdOf(next);
  expect(newer).not.toBe(current);
  const readBuildJson = () =>
    page.evaluate(
      async () => ((await (await fetch('build.json')).json()) as { buildId: string }).buildId,
    );

  // Every load after the first is served by the service worker, as on the tablet.
  await arcade.open();
  await expect.poll(() => arcade.call('offlineReady')).toBe(true);
  await arcade.open();
  await arcade.start();

  await test.step('the newer build is deployed and found; the page keeps its own version', async () => {
    await arcade.openGrownUps();
    const status = arcade.grownUps();
    await expect(status.getByText('No update waiting', { exact: true })).toBeVisible();

    server.serve(next);
    await arcade.hideAndShow();
    await expect.poll(() => arcade.call('updateWaiting')).toBe(true);
    await expect(status.getByText('A newer version is waiting.', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.whimigo?.buildId)).toBe(current);
    await expect(status.getByText(current, { exact: true })).toBeVisible();
    expect(await readBuildJson(), 'files still come from the running version').toBe(current);

    await status.getByRole('button', { name: 'Back' }).tap();
    await expect.poll(() => arcade.screen()).toBe('home');
    await arcade.openCheck('touch-check');
  });

  await test.step('a reload applies it once, before the tap-to-start screen shows', async () => {
    // Which build each load showed the tap-to-start screen with, in the order they showed it.
    await page.addInitScript(() => {
      const watch = setInterval(() => {
        const bridge = window.whimigo;
        if (bridge?.screen().id !== 'start') return;
        clearInterval(watch);
        const shown = JSON.parse(sessionStorage.getItem('test:start-shown') ?? '[]') as string[];
        sessionStorage.setItem('test:start-shown', JSON.stringify([...shown, bridge.buildId]));
      }, 10);
    });
    let loads = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) loads += 1;
    });

    await page.reload();
    // Polled from inside the page, which survives the page reloading itself.
    await page.waitForFunction(() => window.whimigo?.screen().id === 'start');
    expect(await page.evaluate(() => window.whimigo?.buildId)).toBe(newer);
    expect(await arcade.call('updateWaiting')).toBe(false);
    expect(await readBuildJson()).toBe(newer);
    // Long enough for a second reload to have begun, if one were coming.
    await page.waitForTimeout(1000);
    expect(loads, 'the reload, then one more to apply the update').toBe(2);
    expect(await page.evaluate(() => sessionStorage.getItem('test:start-shown'))).toBe(
      JSON.stringify([newer]),
    );
  });
});

const buildIdOnPage = (page: Page) => page.evaluate(() => window.whimigo?.buildId);

test('with a newer version waiting, the Grown-Ups Area offers Update now, and pressing it reloads into the new build', async ({
  arcade,
  server,
  next,
  page,
}) => {
  const current = buildIdOf(dist);
  const newer = buildIdOf(next);
  await arcade.open();
  await expect.poll(() => arcade.call('offlineReady')).toBe(true);
  await arcade.open();
  await arcade.start();
  server.serve(next);
  await arcade.hideAndShow();
  await expect.poll(() => arcade.call('updateWaiting')).toBe(true);

  await arcade.openGrownUps();
  const area = arcade.grownUps();
  await expect(area.getByText('A newer version is waiting.', { exact: true })).toBeVisible();
  expect(await buildIdOnPage(page)).toBe(current);
  await area.getByRole('button', { name: 'Update now' }).tap();
  await page.waitForFunction(() => window.whimigo?.screen().id === 'start');
  expect(await buildIdOnPage(page)).toBe(newer);
  expect(await arcade.call('updateWaiting')).toBe(false);
});

test('with a newer build served while a Session runs, the page keeps its build, the Round plays to a Result, and a Game not yet opened still opens', async ({
  arcade,
  server,
  next,
  page,
}) => {
  test.slow();
  const current = buildIdOf(dist);
  const [first, unopened] = [CATALOG[0]!, CATALOG[1]!];
  await arcade.open();
  await expect.poll(() => arcade.call('offlineReady')).toBe(true);
  await arcade.open();
  await arcade.start();
  await openSession(arcade, sessionFor(first, first.playStyles[0]!), 7);

  server.serve(next);
  // The return that looks for a new version pauses the Round.
  await arcade.hideAndShow();
  await expect.poll(() => arcade.call('updateWaiting')).toBe(true);
  await expect.poll(() => arcade.screen()).toBe('pause');
  await arcade.tap('play');
  await expect.poll(() => arcade.screen()).toBe(first.id);
  await playToResult(arcade, first.id);
  await expect.poll(() => arcade.screen()).toBe('result');
  expect(await buildIdOnPage(page)).toBe(current);

  await arcade.tap('home');
  await expect.poll(() => arcade.screen()).toBe('home');
  await openSession(arcade, sessionFor(unopened, unopened.playStyles[0]!), 7);
  expect(await arcade.screen()).toBe(unopened.id);
  expect(await buildIdOnPage(page)).toBe(current);
});
