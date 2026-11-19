import { type Arcade, OTHER_VIEWPORTS, expect, test } from './arcade';

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
