import { DESIGN_WIDTH, MIN_GAP, MIN_TARGET, expect, gapBetween, test, type Arcade } from './arcade';
import { EVERY_STYLE, playToResult, sessionFor } from './play';

const SEED = 3;
/** Longer than the hold, with room for a slow software-rendered frame. */
const FULL_HOLD_MS = 900;

/** Rounding between canvas pixels and CSS pixels, in design units. */
const EPSILON = 1;

/** Opens a Session of the first Game and Play Style in the Catalog, and waits for its Round. */
async function openFirstRound(arcade: Arcade) {
  const { game, style } = EVERY_STYLE[0]!;
  await arcade.call('open', sessionFor(game, style), SEED);
  await expect.poll(() => arcade.screen()).toBe(game.id);
  return game;
}

/** Holds the pause control for the full hold and waits for the pause screen. */
async function pause(arcade: Arcade) {
  await arcade.hold('pause', FULL_HOLD_MS);
  await expect.poll(() => arcade.screen()).toBe('pause');
}

test.beforeEach(async ({ arcade }) => {
  await arcade.open();
  await arcade.start();
});

for (const { game, style, name } of EVERY_STYLE) {
  test(`${name}: a short tap on the pause control does nothing; a full hold pauses the Round`, async ({
    arcade,
    page,
  }) => {
    await arcade.call('open', sessionFor(game, style), SEED);
    await expect.poll(() => arcade.screen()).toBe(game.id);

    await arcade.brush('pause');
    await page.waitForTimeout(FULL_HOLD_MS);
    expect(await arcade.host()).toBe('playing');
    expect(await arcade.screen()).toBe(game.id);

    await pause(arcade);
    expect(await arcade.host()).toBe('paused');
    expect((await arcade.call('hostStates')).slice(-2)).toEqual(['playing', 'paused']);
    expect(await arcade.call('inputScenes')).toEqual(['pause']);
  });

  test(`${name}: play on the pause screen resumes the Round as it was, and it plays on to a Result`, async ({
    arcade,
  }) => {
    await arcade.call('open', sessionFor(game, style), SEED);
    await expect.poll(() => arcade.screen()).toBe(game.id);
    const before = (await arcade.round())!.state;

    await pause(arcade);
    expect((await arcade.round())!.state).toEqual(before);
    await arcade.tap('play');
    await expect.poll(() => arcade.screen()).toBe(game.id);
    expect(await arcade.host()).toBe('playing');
    expect(await arcade.call('inputScenes')).toEqual([game.id]);
    expect((await arcade.round())!.state).toEqual(before);

    // The pause control works again, and so does the board.
    await pause(arcade);
    await arcade.tap('play');
    await expect.poll(() => arcade.screen()).toBe(game.id);
    await playToResult(arcade, game.id);
    await expect.poll(() => arcade.screen()).toBe('result');
  });

  test(`${name}: home on the pause screen closes the Game with no Result, leaving nothing behind`, async ({
    arcade,
  }) => {
    const before = await arcade.counts();
    await arcade.call('open', sessionFor(game, style), SEED);
    await expect.poll(() => arcade.screen()).toBe(game.id);
    await pause(arcade);
    await arcade.tap('home');
    await expect.poll(() => arcade.screen()).toBe('home');
    expect((await arcade.call('hostStates')).slice(-4)).toEqual([
      'playing',
      'paused',
      'closing',
      'idle',
    ]);
    expect(await arcade.round()).toBeNull();
    expect(await arcade.call('inputScenes')).toEqual(['home']);
    expect(await arcade.counts()).toEqual(before);
  });

  test(`${name}: while paused, touches where the Round's targets are change nothing and request no sound`, async ({
    arcade,
    page,
  }) => {
    await arcade.call('open', sessionFor(game, style), SEED);
    await expect.poll(() => arcade.screen()).toBe(game.id);
    const round = (await arcade.round())!;
    await pause(arcade);
    const controls = Object.values((await arcade.snapshot()).targets).map(({ rect }) => rect);
    const onControl = ({ x, y }: { x: number; y: number }) =>
      controls.some((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
    for (const [name, target] of Object.entries(round.targets)) {
      if (name === 'pause' || onControl(target)) continue;
      await page.touchscreen.tap(target.x, target.y);
    }
    await page.waitForTimeout(300);
    expect(await arcade.screen()).toBe('pause');
    expect((await arcade.round())!.state).toEqual(round.state);
    expect(await arcade.call('sounds')).toEqual([]);
  });

  for (const seating of ['side-by-side', 'around-the-table'] as const) {
    test(`${name}, ${seating}: the pause control is halfway down a short edge of the safe rectangle, large, and clear of every Zone and target`, async ({
      arcade,
    }) => {
      await arcade.call('open', sessionFor(game, style, seating), SEED);
      await expect.poll(() => arcade.screen()).toBe(game.id);
      const { frame, safe } = await arcade.layout();
      const unit = frame.width / DESIGN_WIDTH;
      const { targets, zones } = (await arcade.round())!;
      const { pause: control, ...named } = targets;
      expect(control, 'the pause control').toBeDefined();
      const { rect } = control!;

      expect(rect.width / unit).toBeGreaterThanOrEqual(MIN_TARGET - EPSILON);
      expect(rect.height / unit).toBeGreaterThanOrEqual(MIN_TARGET - EPSILON);
      const onLeft = Math.abs(rect.x - safe!.x) / unit < EPSILON;
      const onRight = Math.abs(rect.x + rect.width - (safe!.x + safe!.width)) / unit < EPSILON;
      expect(onLeft || onRight, 'on a short edge').toBe(true);
      expect(rect.y).toBeGreaterThanOrEqual(safe!.y - EPSILON);
      expect(rect.y + rect.height).toBeLessThanOrEqual(safe!.y + safe!.height + EPSILON);
      expect((control!.y - (safe!.y + safe!.height / 2)) / unit).toBeCloseTo(0, 0);

      for (const [other, target] of Object.entries(named)) {
        expect(gapBetween(rect, target.rect) / unit, `to ${other}`).toBeGreaterThanOrEqual(
          MIN_GAP - EPSILON,
        );
      }
      for (const [index, zone] of zones.entries()) {
        expect(gapBetween(rect, zone) / unit, `to Zone ${index}`).toBeGreaterThanOrEqual(
          MIN_GAP - EPSILON,
        );
      }
    });
  }

  test(`${name}: hiding the page pauses the Round, and when it returns the pause screen shows with nothing advanced`, async ({
    arcade,
    page,
  }) => {
    await arcade.call('open', sessionFor(game, style), SEED);
    await expect.poll(() => arcade.screen()).toBe(game.id);
    await arcade.hide();
    expect(await arcade.host()).toBe('paused');
    // The browser under test keeps drawing while it says it is hidden; give the pause a frame.
    await page.waitForTimeout(300);
    const hidden = (await arcade.round())!;

    await arcade.show();
    await expect.poll(() => arcade.screen()).toBe('pause');
    await page.waitForTimeout(300);
    const back = (await arcade.round())!;
    expect(back.state).toEqual(hidden.state);
    expect(back.time, 'the Round’s clock').toBe(hidden.time);
    expect(await arcade.call('inputScenes')).toEqual(['pause']);
  });
}

test('after the page returns, play resumes the Round with sound running, and the page never reloads itself', async ({
  arcade,
}) => {
  const game = await openFirstRound(arcade);
  const framesBefore = await arcade.call('frames');
  await arcade.hideAndShow();
  await expect.poll(() => arcade.screen()).toBe('pause');

  await arcade.tap('play');
  await expect.poll(() => arcade.screen()).toBe(game.id);
  expect(await arcade.host()).toBe('playing');
  await expect.poll(() => arcade.audio()).toBe('running');
  const sound = (await arcade.call('keys')).sounds.find((key) => key.startsWith(`${game.id}/`));
  expect(sound, `a sound of ${game.id}`).toBeDefined();
  expect((await arcade.call('playSound', sound!)).started).toBe(true);

  await pause(arcade);
  await arcade.tap('home');
  await expect.poll(() => arcade.screen()).toBe('home');
  expect(await arcade.call('frames')).toBeGreaterThan(framesBefore);
});

test('a Round whose Game was still loading when the page was hidden opens on the pause screen', async ({
  arcade,
  page,
}) => {
  const { game, style } = EVERY_STYLE[0]!;
  // Opened and hidden in one go, so the Game is certainly still loading when the page hides.
  const host = await page.evaluate(
    ([session, seed]) => {
      window.whimigo!.open(session, seed);
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      return window.whimigo!.screen().host;
    },
    [sessionFor(game, style), SEED] as const,
  );
  expect(host).toBe('loading');
  await arcade.show();
  await expect.poll(() => arcade.screen()).toBe('pause');
  expect(await arcade.host()).toBe('paused');
  await arcade.tap('play');
  await expect.poll(() => arcade.screen()).toBe(game.id);
});
