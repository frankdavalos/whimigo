import { type Arcade, OTHER_VIEWPORTS, expect, test } from './arcade';
import { CATALOG, openSession, playToResult, sessionFor } from './play';

const DESIGN_WIDTH = 2752;

/** Checks the error screen shows one button at least 256 design units square, and returns its box. */
async function expectErrorScreen(arcade: Arcade) {
  const errorScreen = arcade.page.locator('#error-screen');
  await expect(errorScreen).toBeVisible();
  await expect(errorScreen.locator('button')).toHaveCount(1);
  await expect(errorScreen.locator('button')).toBeVisible();

  const { frame } = await arcade.layout();
  const minimum = 256 * (frame.width / DESIGN_WIDTH);
  const box = (await errorScreen.locator('button').boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(minimum);
  expect(box.height).toBeGreaterThanOrEqual(minimum);
  return box;
}

async function expectErrorScreenThenRecover(arcade: Arcade) {
  const { page } = arcade;
  const errorScreen = page.locator('#error-screen');
  const box = await expectErrorScreen(arcade);

  await Promise.all([
    page.waitForEvent('load'),
    page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2),
  ]);
  await expect.poll(() => arcade.screen()).toBe('start');
  await expect(errorScreen).toBeHidden();
  await arcade.start();
}

test('an exception thrown inside a Scene’s update shows the error screen, and its button reloads to the Home Screen', async ({
  arcade,
}) => {
  await arcade.open();
  await arcade.start();
  await arcade.call('throwInUpdate');
  await expectErrorScreenThenRecover(arcade);
});

test('an unhandled promise rejection shows the error screen, and its button reloads to the Home Screen', async ({
  arcade,
}) => {
  await arcade.open();
  await arcade.call('rejectUnhandled');
  await expectErrorScreenThenRecover(arcade);
});

test('an exception thrown inside a Game’s Scene during a Round shows the error screen, and its button reloads to the Home Screen with the Stars from earlier Rounds intact', async ({
  arcade,
  page,
}) => {
  test.slow();
  const game = CATALOG[0]!;
  await arcade.open();
  await arcade.start();
  await openSession(arcade, sessionFor(game, game.playStyles[0]!), 1);
  await playToResult(arcade, game.id);
  await expect.poll(() => arcade.screen()).toBe('result');
  await arcade.tap('replay');
  await expect.poll(() => arcade.screen()).toBe(game.id);
  const earned = await arcade.call('save');
  expect(Object.keys(earned.mascots).length).toBeGreaterThan(0);

  await arcade.call('throwInUpdate');
  await expect(page.locator('#error-message')).toBeHidden();
  await expectErrorScreenThenRecover(arcade);
  expect(await arcade.call('save')).toEqual(earned);
});

for (const game of CATALOG) {
  test(`${game.id}: an exception thrown inside its Scene during a Round shows the error screen, and its button reloads to the Home Screen`, async ({
    arcade,
  }) => {
    await arcade.open();
    await arcade.start();
    await openSession(arcade, sessionFor(game, game.playStyles[0]!), 1);
    await expect.poll(() => arcade.screen()).toBe(game.id);

    await arcade.call('throwInUpdate');
    await expectErrorScreenThenRecover(arcade);
    await expect.poll(() => arcade.screen()).toBe('home');
    expect(await arcade.host()).toBe('idle');
  });
}

test('a second error within a few seconds of the start the error screen’s button made shows the technical message, and nothing reloads by itself', async ({
  arcade,
  page,
}) => {
  await arcade.open();
  await arcade.call('rejectUnhandled');
  const box = await expectErrorScreen(arcade);
  await Promise.all([
    page.waitForEvent('load'),
    page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2),
  ]);
  await page.waitForFunction(() => window.whimigo !== undefined);
  await arcade.call('rejectUnhandled');

  const message = page.locator('#error-message');
  await expect(page.locator('#error-screen')).toBeVisible();
  await expect(message).toBeVisible();
  await expect(message).toContainText('Rejected on purpose by the test bridge');
  await page.evaluate(() => Object.assign(window, { stillHere: true }));
  await page.waitForTimeout(3000);
  expect(await page.evaluate(() => 'stillHere' in window)).toBe(true);
  await expect(message).toBeVisible();
});

test('the friendly error screen shows no technical message', async ({ arcade, page }) => {
  await arcade.open();
  await arcade.call('rejectUnhandled');
  await expectErrorScreen(arcade);
  await expect(page.locator('#error-message')).toBeHidden();
});

for (const [shape, viewport] of Object.entries(OTHER_VIEWPORTS)) {
  test(`at ${shape} the error screen's one button is at least 256 units square`, async ({
    arcade,
    page,
  }) => {
    await page.setViewportSize(viewport);
    await arcade.open();
    await arcade.call('rejectUnhandled');
    await expectErrorScreen(arcade);
  });
}

test('the error screen is hidden while nothing is wrong', async ({ arcade, page }) => {
  await arcade.open();
  await expect(page.locator('#error-screen')).toBeHidden();
});

/**
 * Records what Phaser 4.2.1 does when an exception escapes its frame loop: the browser's
 * requestAnimationFrame callback throws before Phaser asks for the next frame, so the loop
 * stops for good. See src/dom/RequestAnimationFrame.js in the Phaser package.
 */
test('Phaser’s frame loop stops after an exception in a Scene’s update', async ({
  arcade,
  page,
}) => {
  await arcade.open();
  const frames = () => arcade.call('frames');
  const first = await frames();
  await expect.poll(frames).toBeGreaterThan(first);

  await arcade.call('throwInUpdate');
  await expect(page.locator('#error-screen')).toBeVisible();
  const stopped = await frames();
  await page.waitForTimeout(1000);
  expect(await frames()).toBe(stopped);
});
