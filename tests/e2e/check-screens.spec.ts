import { expect, test } from './arcade';

/** Long enough to be sure of a full half-second hold even when frames are slow. */
const FULL_HOLD_MS = 1000;
const BLANK = 'blank-check';
/** Every check screen the Home Screen lists when the test bridge is on, in order. */
const CHECKS = ['touch-check', 'sound-check', 'performance-check', BLANK];
/** How many sounds each check screen renders while it is open. */
const SOUNDS_WHILE_OPEN: Readonly<Record<string, number>> = { 'sound-check': 7 };

test.beforeEach(async ({ arcade }) => {
  await arcade.open();
});

test('the Home Screen has one control for each registered check screen, and tapping it opens that screen', async ({
  arcade,
}) => {
  await arcade.start();
  const checks = Object.keys((await arcade.snapshot()).targets);
  expect(checks).toEqual(CHECKS);
  for (const id of checks) {
    await arcade.tap(id);
    await expect.poll(() => arcade.screen()).toBe(id);
    await arcade.hold('leave', FULL_HOLD_MS);
    await expect.poll(() => arcade.screen()).toBe('home');
  }
});

test('a check screen opens directly through the bridge, skipping the Home Screen', async ({
  arcade,
}) => {
  await arcade.call('openCheck', BLANK);
  await expect.poll(() => arcade.screen()).toBe(BLANK);
});

for (const id of CHECKS) {
  test(`${id}: a short tap on the leave control does nothing; a full hold goes home`, async ({
    arcade,
    page,
  }) => {
    await arcade.start();
    await arcade.tap(id);
    await expect.poll(() => arcade.screen()).toBe(id);

    await arcade.tap('leave');
    await arcade.brush('leave');
    await page.waitForTimeout(800);
    expect(await arcade.screen()).toBe(id);

    await arcade.hold('leave', FULL_HOLD_MS);
    await expect.poll(() => arcade.screen()).toBe('home');
  });

  test(`${id}: a hold that slides off the leave control does not leave`, async ({
    arcade,
    page,
  }) => {
    await arcade.call('openCheck', id);
    await expect.poll(() => arcade.screen()).toBe(id);
    const leave = await arcade.target('leave');
    // Sent together, so a slow frame cannot stretch the time the finger spends on the control.
    await Promise.all([
      arcade.touch('touchStart', [leave]),
      arcade.touch('touchMove', [{ x: leave.x + leave.rect.width * 2, y: leave.y }]),
    ]);
    await page.waitForTimeout(FULL_HOLD_MS);
    await arcade.touch('touchEnd', []);
    expect(await arcade.screen()).toBe(id);
  });

  test(`${id}: opening and leaving it returns the counts to where they were`, async ({
    arcade,
  }) => {
    await arcade.start();
    const before = await arcade.counts();
    await arcade.tap(id);
    await expect.poll(() => arcade.screen()).toBe(id);
    expect(await arcade.counts()).toMatchObject({
      scenes: before.scenes + 1,
      sounds: before.sounds + (SOUNDS_WHILE_OPEN[id] ?? 0),
    });
    await arcade.hold('leave', FULL_HOLD_MS);
    await expect.poll(() => arcade.screen()).toBe('home');
    expect(await arcade.counts()).toEqual(before);
  });
}

test('the bridge answers in plain JSON', async ({ arcade }) => {
  await arcade.start();
  const snapshot = await arcade.snapshot();
  expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  const target = snapshot.targets[BLANK]!;
  expect(target.x).toBeCloseTo(target.rect.x + target.rect.width / 2, 3);
  expect(target.y).toBeCloseTo(target.rect.y + target.rect.height / 2, 3);
  expect(await arcade.counts()).toEqual({
    scenes: expect.any(Number),
    textures: expect.any(Number),
    sounds: expect.any(Number),
  });
});

test('a touch at a target’s reported centre activates that control and nothing outside it does', async ({
  arcade,
  page,
}) => {
  await arcade.start();
  const { rect } = await arcade.target(BLANK);
  // Just outside the control's touch rectangle: nothing happens.
  await page.touchscreen.tap(rect.x - 4, rect.y + rect.height / 2);
  await page.touchscreen.tap(rect.x + rect.width + 4, rect.y + rect.height / 2);
  await page.waitForTimeout(500);
  expect(await arcade.screen()).toBe('home');
  await arcade.tap(BLANK);
  await expect.poll(() => arcade.screen()).toBe(BLANK);
});
