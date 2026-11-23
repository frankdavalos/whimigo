import { type Arcade, expect, test } from './arcade';
import { EVERY_STYLE, openSession, playToResult, sessionFor } from './play';

/**
 * Story 11 AC3: before sound is unlocked, and with sound switched off in the Grown-Ups Area, every
 * Game plays to a Result in every Play Style and no sound starts.
 */

/** Plays a Round to its Result; it asked for sounds, and none started. */
async function playsSilently(
  arcade: Arcade,
  session: Parameters<typeof openSession>[1],
  id: string,
) {
  const started = await arcade.call('soundsStarted');
  await openSession(arcade, session, 7);
  await playToResult(arcade, id);
  await expect.poll(() => arcade.screen()).toBe('result');
  expect((await arcade.call('sounds')).length, 'the Round asked for sounds').toBeGreaterThan(0);
  expect(await arcade.call('soundsStarted')).toBe(started);
}

for (const { game, style, name } of EVERY_STYLE) {
  test(`${name}: before sound is unlocked, plays to a Result and no sound starts`, async ({
    arcade,
    page,
  }) => {
    test.slow();
    // Any tap unlocks sound, and playing is tapping: here the browser refuses every time, as one
    // does before it accepts a gesture, so sound stays locked for the whole Round.
    await page.addInitScript(() => {
      AudioContext.prototype.resume = () => Promise.resolve();
    });
    await arcade.open();
    await playsSilently(arcade, sessionFor(game, style), game.id);
    expect(await arcade.audio()).toBe('locked');
  });

  test(`${name}: with sound switched off, plays to a Result and no sound starts`, async ({
    arcade,
  }) => {
    test.slow();
    await arcade.open();
    await arcade.start();
    await arcade.openGrownUps();
    await arcade.grownUps().getByRole('checkbox', { name: 'Sound on' }).uncheck();
    await arcade.grownUps().getByRole('button', { name: 'Back' }).tap();
    await expect.poll(() => arcade.screen()).toBe('home');
    await expect.poll(() => arcade.audio()).toBe('running');
    await playsSilently(arcade, sessionFor(game, style), game.id);
  });
}
