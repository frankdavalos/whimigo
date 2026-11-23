import { expect, test } from './arcade';

/** Long enough to be sure of a full half-second hold even when frames are slow. */
const FULL_HOLD_MS = 1000;
const BLANK = 'blank-check';
/** Every check screen the Grown-Ups Area lists when the test bridge is on, in order. */
const CHECKS = ['touch-check', 'sound-check', 'performance-check', BLANK];
/** How many sounds each check screen renders while it is open. */
const SOUNDS_WHILE_OPEN: Readonly<Record<string, number>> = { 'sound-check': 7 };

test.beforeEach(async ({ arcade }) => {
  await arcade.open();
});

test('the Grown-Ups Area has one button for each registered check screen, and the Home Screen none; each check returns to the Area', async ({
  arcade,
}) => {
  test.slow();
  await arcade.start();
  const checks = await arcade.checks();
  expect(checks).toEqual(CHECKS);
  for (const id of checks) expect((await arcade.snapshot()).targets[id]).toBeUndefined();
  await arcade.openGrownUps();
  const buttons = arcade.grownUps().locator('[data-check]');
  expect(
    await buttons.evaluateAll((all) => all.map((b) => (b as HTMLElement).dataset.check)),
  ).toEqual(CHECKS);
  for (const id of checks) {
    await arcade.openCheck(id);
    await arcade.hold('leave', FULL_HOLD_MS);
    await expect.poll(() => arcade.screen()).toBe('grown-ups');
  }
});

test('a check screen opens directly through the bridge, skipping the Home Screen', async ({
  arcade,
}) => {
  await arcade.call('openCheck', BLANK);
  await expect.poll(() => arcade.screen()).toBe(BLANK);
});

for (const id of CHECKS) {
  test(`${id}: a short tap on the leave control does nothing; a full hold returns to the Grown-Ups Area`, async ({
    arcade,
    page,
  }) => {
    await arcade.start();
    await arcade.openCheck(id);

    await arcade.tap('leave');
    await arcade.brush('leave');
    await page.waitForTimeout(800);
    expect(await arcade.screen()).toBe(id);

    await arcade.hold('leave', FULL_HOLD_MS);
    await expect.poll(() => arcade.screen()).toBe('grown-ups');
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

  test(`${id}: opened from the Grown-Ups Area and left, it returns there with the counts where they were`, async ({
    arcade,
  }) => {
    await arcade.start();
    await arcade.openGrownUps();
    const before = await arcade.counts();
    await arcade.openCheck(id);
    expect(await arcade.counts()).toMatchObject({
      scenes: before.scenes + 1,
      sounds: before.sounds + (SOUNDS_WHILE_OPEN[id] ?? 0),
    });
    await arcade.hold('leave', FULL_HOLD_MS);
    await expect.poll(() => arcade.screen()).toBe('grown-ups');
    await expect(arcade.grownUps()).toBeVisible();
    expect(await arcade.counts()).toEqual(before);
  });
}

test('the bridge answers in plain JSON', async ({ arcade }) => {
  await arcade.start();
  const snapshot = await arcade.snapshot();
  expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  const target = snapshot.targets['grown-ups']!;
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
}) => {
  await arcade.start();
  const { rect } = await arcade.target('grown-ups');
  // Held just outside the Gate's touch rectangle: nothing happens.
  for (const point of [
    { x: rect.x - 4, y: rect.y + rect.height / 2 },
    { x: rect.x + rect.width / 2, y: rect.y - 4 },
  ]) {
    await arcade.touch('touchStart', [point]);
    await arcade.page.waitForTimeout(3500);
    await arcade.touch('touchEnd', []);
  }
  expect(await arcade.screen()).toBe('home');
  await arcade.openGrownUps();
});
