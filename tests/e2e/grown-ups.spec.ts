import type { CDPSession, Page } from '@playwright/test';
import { type Arcade, expect, test } from './arcade';

/**
 * The adult status page (story 13), the seed of the Grown-Ups Area: plain HTML over the whole
 * screen (ADR-0005), opened from the Home Screen. There is no Grown-Up Gate yet.
 */

const SCREEN = 'grown-ups';

async function openStatusPage(arcade: Arcade) {
  await arcade.start();
  await arcade.tap(SCREEN);
  await expect.poll(() => arcade.screen()).toBe(SCREEN);
  const page = arcade.page.locator('#grown-ups');
  await expect(page).toBeVisible();
  return page;
}

/** Counts every touch and pointer event that reaches the canvas from now on. */
async function countCanvasTouches(page: Page): Promise<() => Promise<number>> {
  await page.evaluate(() => {
    const canvas = document.querySelector('#arcade canvas')!;
    const counter = { touches: 0 };
    Object.assign(window, { canvasTouches: counter });
    for (const type of ['touchstart', 'touchend', 'pointerdown', 'pointerup']) {
      canvas.addEventListener(type, () => (counter.touches += 1));
    }
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { canvasTouches: { touches: number } }).canvasTouches.touches,
    );
}

test('the status page opens from the Home Screen as HTML over the whole screen, the canvas takes no touches while it shows, and Back returns home', async ({
  arcade,
  page,
}) => {
  await arcade.open();
  const status = await openStatusPage(arcade);
  expect(await status.boundingBox()).toEqual({ x: 0, y: 0, ...page.viewportSize()! });
  await expect(status.getByRole('heading', { level: 1 })).toHaveText('For grown-ups');

  const touches = await countCanvasTouches(page);
  const { width, height } = page.viewportSize()!;
  // Over the page's words and margins, never on one of its buttons.
  const heading = (await status.getByRole('heading', { level: 1 }).boundingBox())!;
  for (const [x, y] of [
    [heading.x + heading.width / 2, heading.y + heading.height / 2],
    [width - 20, height - 20],
    [20, 20],
  ] as const) {
    await page.touchscreen.tap(x, y);
  }
  expect(await touches()).toBe(0);
  expect(await arcade.screen()).toBe(SCREEN);

  await status.getByRole('button', { name: 'Back' }).tap();
  await expect.poll(() => arcade.screen()).toBe('home');
  await expect(status).toBeHidden();
  await page.touchscreen.tap(width / 2, 20);
  expect(await touches(), 'the canvas takes touches again').toBeGreaterThan(0);
});

test('the status page shows the build identifier the bridge reports, ready to play offline once the bridge says so, and that the Arcade is in a browser tab', async ({
  arcade,
}) => {
  await arcade.open();
  await expect.poll(() => arcade.call('offlineReady')).toBe(true);
  const status = await openStatusPage(arcade);
  const buildId = await arcade.page.evaluate(() => window.whimigo!.buildId);
  await expect(status.getByText(buildId, { exact: true })).toBeVisible();
  await expect(status.getByText('Ready to play offline', { exact: true })).toBeVisible();
  await expect(status.getByText('No update waiting', { exact: true })).toBeVisible();
  await expect(status.getByText('Browser tab', { exact: true })).toBeVisible();
});

test('the status page shows the safe-area insets the browser reports', async ({ arcade, page }) => {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', {
    insets: { top: 24, right: 0, bottom: 20, left: 12 },
  });
  await arcade.open();
  const status = await openStatusPage(arcade);
  await expect(status.getByText('Top 24 px, right 0 px, bottom 20 px, left 12 px')).toBeVisible();
});

/** The canvas as the page lays it out, in CSS pixels, and its size in pixels. */
async function canvasSizes(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#arcade canvas') as HTMLCanvasElement;
    const box = canvas.getBoundingClientRect();
    return `Canvas ${Math.round(box.width)} × ${Math.round(box.height)} (${canvas.width} × ${canvas.height} pixels)`;
  });
}

test('the status page shows the screen as the browser measures it, and each change of size as it happens', async ({
  arcade,
  page,
}) => {
  await arcade.open();
  const status = await openStatusPage(arcade);
  const now = status.locator('[data-reading="screen"]');
  const changes = status.locator('[data-reading="screen-changes"]');
  const { width, height } = page.viewportSize()!;
  await expect(now).toContainText(`Window ${width} × ${height}`);
  await expect(now).toContainText(`Arcade box ${width} × ${height}`);
  await expect(now).toContainText(await canvasSizes(page));
  await expect(changes).toContainText(`start: window ${width} × ${height}`);

  // Turned to portrait while the page shows: it follows, and the change is listed as it happens.
  await page.setViewportSize({ width: height, height: width });
  await expect(now).toContainText(`Window ${height} × ${width}`);
  await expect(now).toContainText(`Arcade box ${height} × ${width}`);
  await expect
    .poll(async () => (await now.textContent())!.includes(await canvasSizes(page)))
    .toBe(true);
  await expect(changes).toContainText(new RegExp(`\\d s resize: window ${height} × ${width}`));
  await expect(changes).toContainText(`settled: window ${height} × ${width}`);
});

test.describe('without a service worker', () => {
  test.use({ serviceWorkers: 'block' });

  test('the status page says the Arcade is not ready offline, as the bridge does', async ({
    arcade,
  }) => {
    await arcade.open();
    const status = await openStatusPage(arcade);
    await expect(status.getByText('Not ready offline yet', { exact: true })).toBeVisible();
    expect(await arcade.call('offlineReady')).toBe(false);
  });
});
