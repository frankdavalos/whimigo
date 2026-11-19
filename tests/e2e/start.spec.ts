import { expect, test } from './arcade';

test('the Arcade opens on tap to start, and one tap leads to the Home Screen @smoke', async ({
  arcade,
}) => {
  await arcade.open();
  expect(await arcade.screen()).toBe('start');
  await arcade.start();
});

test('the tap to start unlocks sound', async ({ arcade }) => {
  await arcade.open();
  expect(await arcade.audio()).toBe('locked');
  await arcade.start();
  await expect.poll(() => arcade.audio()).toBe('running');
});

test('there is no test bridge without ?e2e=1', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('canvas')).toBeVisible();
  expect(await page.evaluate(() => 'whimigo' in window)).toBe(false);
});
