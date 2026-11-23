import { expect, test } from './arcade';

test.beforeEach(async ({ arcade }) => {
  await arcade.open();
});

test('the root element refuses touch gestures, selection and overscroll', async ({ page }) => {
  const style = await page.evaluate(() => {
    const computed = getComputedStyle(document.documentElement);
    return {
      touchAction: computed.touchAction,
      userSelect: computed.userSelect,
      overscrollBehavior: computed.overscrollBehavior,
    };
  });
  expect(style).toEqual({ touchAction: 'none', userSelect: 'none', overscrollBehavior: 'none' });
});

test('a swipe does not scroll the page', async ({ arcade, page }) => {
  const centre = { x: 400, y: 600 };
  await arcade.touch('touchStart', [centre]);
  for (let step = 1; step <= 10; step++) {
    await arcade.touch('touchMove', [{ x: centre.x, y: centre.y - step * 40 }]);
  }
  await arcade.touch('touchEnd', []);
  expect(
    await page.evaluate(() => [
      window.scrollX,
      window.scrollY,
      document.scrollingElement?.scrollTop,
    ]),
  ).toEqual([0, 0, 0]);
});

test('the context menu is refused', async ({ page }) => {
  const shown = await page.evaluate(() =>
    document
      .querySelector('canvas')!
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
  );
  expect(shown).toBe(false);
});

test('a two-finger pinch does not zoom', async ({ arcade, page }) => {
  const centre = { x: 500, y: 400 };
  await arcade.touch('touchStart', [
    { x: centre.x - 20, y: centre.y },
    { x: centre.x + 20, y: centre.y },
  ]);
  for (let step = 1; step <= 10; step++) {
    await arcade.touch('touchMove', [
      { x: centre.x - 20 - step * 25, y: centre.y },
      { x: centre.x + 20 + step * 25, y: centre.y },
    ]);
  }
  await arcade.touch('touchEnd', []);
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
});

test('moving between screens adds no history entries', async ({ arcade, page }) => {
  test.slow();
  const length = () => page.evaluate(() => history.length);
  const before = await length();
  await arcade.start();
  const checks = await arcade.checks();
  expect(checks.length).toBeGreaterThan(0);
  for (const id of checks) {
    await arcade.openCheck(id);
    await arcade.hold('leave', 1000);
    await expect.poll(() => arcade.screen()).toBe('grown-ups');
  }
  await page.getByRole('button', { name: 'Back' }).tap();
  await expect.poll(() => arcade.screen()).toBe('home');
  expect(await length()).toBe(before);
});
