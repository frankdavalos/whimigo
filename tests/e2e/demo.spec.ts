import type { Difficulty, Rect } from '../../src/contract';
import { expect, test, type Arcade } from './arcade';
import { EVERY_STYLE, openSession, playToResult, sessionFor } from './play';

const SEED = 4;
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];
/** Rounding between canvas pixels and CSS pixels, in CSS pixels. */
const EPSILON = 0.75;

const inside = (rect: Rect, { x, y }: { x: number; y: number }) =>
  x >= rect.x - EPSILON &&
  x <= rect.x + rect.width + EPSILON &&
  y >= rect.y - EPSILON &&
  y <= rect.y + rect.height + EPSILON;

const demo = async (arcade: Arcade) => (await arcade.round())!.demo;

test.beforeEach(async ({ arcade }) => {
  await arcade.open();
  await arcade.start();
});

for (const { game, style, name } of EVERY_STYLE) {
  test(`${name}: on the first Round of a Session the Demo plays, and touches at the Game’s targets change nothing`, async ({
    arcade,
  }) => {
    await arcade.call('open', sessionFor(game, style), SEED);
    await expect.poll(() => arcade.screen()).toBe(game.id);
    await expect.poll(async () => (await demo(arcade)).playing).toBe(true);
    const before = (await arcade.round())!;
    expect(before.demo.plays).toBe(1);

    // Each finger lands while the Demo plays; the first one skips it, and none of them counts.
    const targets = Object.entries(before.targets).filter(([target]) => target !== 'pause');
    await arcade.touch(
      'touchStart',
      targets.map(([, target]) => target),
    );
    await arcade.touch('touchEnd', []);
    await expect.poll(async () => (await demo(arcade)).playing).toBe(false);
    const after = (await arcade.round())!;
    expect(after.state).toEqual(before.state);
    expect(after.refusals).toBe(0);
    expect(await arcade.call('sounds')).toEqual([]);
    expect(await arcade.screen()).toBe(game.id);
  });

  test(`${name}: a tap skips the Demo and play begins; it does not play on a replay`, async ({
    arcade,
  }) => {
    test.slow();
    await arcade.call('open', sessionFor(game, style), SEED);
    await expect.poll(() => arcade.screen()).toBe(game.id);
    await arcade.skipDemo();
    expect((await demo(arcade)).plays).toBe(1);
    await playToResult(arcade, game.id);
    await expect.poll(() => arcade.screen()).toBe('result');

    await arcade.tap('replay');
    await expect.poll(() => arcade.screen()).toBe(game.id);
    const replayed = (await arcade.round())!;
    expect(replayed.number).toBe(1);
    expect(replayed.demo).toMatchObject({ playing: false, plays: 0 });
    expect(replayed.demo.steps.length).toBeGreaterThan(0);
    await playToResult(arcade, game.id);
    await expect.poll(() => arcade.screen()).toBe('result');
  });

  test(`${name}: the pause screen’s show-the-Demo target plays it again, then the Round continues from where it was paused`, async ({
    arcade,
  }) => {
    test.slow();
    await openSession(arcade, sessionFor(game, style), SEED);
    await arcade.hold('pause', 900);
    await expect.poll(() => arcade.screen()).toBe('pause');
    const before = (await arcade.round())!;
    const sounds = await arcade.call('sounds');

    await arcade.tap('demo');
    await expect.poll(() => arcade.screen()).toBe(game.id);
    expect(await arcade.host()).toBe('playing');
    expect(await arcade.call('inputScenes')).toEqual([game.id]);
    await expect.poll(async () => (await demo(arcade)).plays).toBe(2);

    // Played to its end this time, not skipped, with nothing moved or heard while it played. Once it
    // ends the Round goes on at once (Color Echo sounds its next pad), so each reading takes the
    // state, the sounds and whether the Demo plays in one call to the page: a loaded page answers
    // each call slowly, and separate calls could straddle the Demo's end.
    const read = () =>
      arcade.page.evaluate(() => {
        const bridge = window.whimigo!;
        const round = bridge.round()!;
        return { state: round.state, sounds: bridge.sounds(), playing: round.demo.playing };
      });
    const first = await read();
    expect(first.playing).toBe(true);
    let last = { state: first.state, sounds: first.sounds };
    await expect
      .poll(
        async () => {
          const { playing, ...reading } = await read();
          if (playing) last = reading;
          return playing;
        },
        { timeout: 20_000, intervals: [100] },
      )
      .toBe(false);
    expect(last).toEqual({ state: before.state, sounds });
    await playToResult(arcade, game.id);
    await expect.poll(() => arcade.screen()).toBe('result');
  });

  for (const difficulty of DIFFICULTIES) {
    test(`${name}, ${difficulty}: the Demo has at least one step, and every point it names is inside the safe rectangle`, async ({
      arcade,
    }) => {
      await arcade.call(
        'open',
        sessionFor(game, style, 'side-by-side', undefined, difficulty),
        SEED,
      );
      await expect.poll(() => arcade.screen()).toBe(game.id);
      const { steps } = await demo(arcade);
      const { safe } = await arcade.layout();
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        const point = 'tap' in step ? step.tap : 'refuse' in step ? step.refuse : null;
        if (point) expect(inside(safe!, point), JSON.stringify(step)).toBe(true);
        else expect((step as { wait: number }).wait).toBeGreaterThan(0);
      }
    });
  }
}

test.describe('with reduced motion requested', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const { game, style, name } of EVERY_STYLE) {
    test(`${name}: the Round reports motion as reduced, and the Demo still plays and ends`, async ({
      arcade,
    }) => {
      await arcade.call('open', sessionFor(game, style), SEED);
      await expect.poll(() => arcade.screen()).toBe(game.id);
      expect((await arcade.round())!.motion).toBe('reduced');
      await expect.poll(async () => (await demo(arcade)).plays).toBe(1);
      await expect.poll(async () => (await demo(arcade)).playing, { timeout: 20_000 }).toBe(false);
    });

    test(`${name}: every Round still plays to a Result`, async ({ arcade }) => {
      test.slow();
      await openSession(arcade, sessionFor(game, style), SEED);
      await playToResult(arcade, game.id);
      await expect.poll(() => arcade.screen()).toBe('result');
    });
  }
});

test('without a request for reduced motion, the Round reports full motion', async ({ arcade }) => {
  const { game, style } = EVERY_STYLE[0]!;
  await openSession(arcade, sessionFor(game, style), SEED);
  expect((await arcade.round())!.motion).toBe('full');
});
