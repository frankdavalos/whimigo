import type { MascotId, Rect, Result } from '../../src/contract';
import { MASCOTS } from '../../src/arcade/mascots';
import { starsEarned } from '../../src/arcade/progress';
import { seats as SEAT_LOOKS } from '../../src/kit/theme';
import { expect, test } from './arcade';
import { CATALOG, EVERY_STYLE, openSession, playToResult, resultFor, sessionFor } from './play';

const SEED = 7;

const centreOf = (rect: Rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

test.beforeEach(async ({ arcade }) => {
  await arcade.open();
  await arcade.start();
});

test('every Game’s module passes the module conformance checks', async ({ arcade }) => {
  expect(await arcade.call('conformance')).toEqual([]);
});

test('the Home Screen has a Game Card for each Game in Catalog order, and none for a check screen', async ({
  arcade,
}) => {
  const ids = CATALOG.map((game) => game.id);
  const snapshot = await arcade.snapshot();
  expect(snapshot.state).toEqual({ games: ids, refused: null });
  expect(Object.keys(snapshot.targets)).toEqual([...ids, 'grown-ups']);
  for (const check of await arcade.checks()) expect(snapshot.targets[check]).toBeUndefined();

  const drawn = (await arcade.call('pictures')).images.map(({ frame }) => frame);
  for (const game of CATALOG) expect(drawn).toContain(game.card.frame);
});

for (const { game, style, name } of EVERY_STYLE) {
  test(`${name}: a second Result reported for the same Round is not accepted: Stars are awarded once`, async ({
    arcade,
  }) => {
    const session = sessionFor(game, style);
    await openSession(arcade, session, SEED);

    const first = resultFor(style.style);
    await arcade.call('finish', first);
    await arcade.call('finish', { kind: 'draw' });
    await expect.poll(() => arcade.screen()).toBe('result');
    await arcade.call('finish', { kind: 'draw' });

    const earned = starsEarned(first, session);
    expect(Object.keys(earned).length).toBeGreaterThan(0);
    const { mascots, games } = await arcade.call('save');
    expect(mascots).toEqual(
      Object.fromEntries(Object.entries(earned).map(([mascot, stars]) => [mascot, { stars }])),
    );
    expect(games[game.id]).toEqual({ roundsPlayed: 1 });
    expect((await arcade.snapshot()).state).toMatchObject({ result: first });
  });
}

for (const game of CATALOG) {
  test(`${game.id}: tapping its Game Card opens its lobby`, async ({ arcade }) => {
    await arcade.tap(game.id);
    await expect.poll(() => arcade.screen()).toBe('lobby');
    expect((await arcade.snapshot()).state).toMatchObject({ game: game.id });
  });
}

for (const game of CATALOG) {
  test(`${game.id}: after a Round, its lobby shows each Mascot’s saved Stars in bitmap digits`, async ({
    arcade,
  }) => {
    test.slow();
    await openSession(arcade, sessionFor(game, game.playStyles[0]!), SEED);
    await playToResult(arcade, game.id);
    await expect.poll(() => arcade.screen()).toBe('result');
    await arcade.tap('home');
    await expect.poll(() => arcade.screen()).toBe('home');
    await arcade.tap(game.id);
    await expect.poll(() => arcade.screen()).toBe('lobby');

    const { mascots } = await arcade.call('save');
    expect(Object.keys(mascots).length).toBeGreaterThan(0);
    const { stars } = (await arcade.snapshot()).state as {
      stars: Record<MascotId, { text: string; glyphs: { char: string; width: number }[] }>;
    };
    expect(Object.keys(stars)).toEqual([...MASCOTS]);
    for (const mascot of MASCOTS) {
      const drawn = stars[mascot]!;
      expect(Number(drawn.text), mascot).toBe(mascots[mascot]?.stars ?? 0);
      expect(drawn.glyphs.map(({ char }) => char).join(''), mascot).toBe(drawn.text);
      for (const glyph of drawn.glyphs) expect(glyph.width, mascot).toBeGreaterThan(0);
    }
  });
}

for (const { game, style, name } of EVERY_STYLE) {
  test(`${name}: opens straight into a Round, plays to a Result, replays and closes leaving nothing behind`, async ({
    arcade,
  }) => {
    test.slow();
    const before = await arcade.counts();
    const session = sessionFor(game, style);
    await openSession(arcade, session, SEED);
    expect(await arcade.host()).toBe('playing');
    expect((await arcade.call('hostStates')).slice(-3)).toEqual(['idle', 'loading', 'playing']);
    expect(await arcade.call('inputScenes')).toEqual([game.id]);

    const round = (await arcade.round())!;
    expect(round).toMatchObject({ session, seed: SEED, number: 0 });
    expect(JSON.parse(JSON.stringify(round))).toEqual(round);
    expect(Object.keys(round.targets).length).toBeGreaterThan(0);
    for (const target of Object.values(round.targets)) {
      const centre = centreOf(target.rect);
      expect(target.x).toBeCloseTo(centre.x, 3);
      expect(target.y).toBeCloseTo(centre.y, 3);
    }

    const finished = (await playToResult(arcade, game.id)).at(-1);
    await expect.poll(() => arcade.screen()).toBe('result');
    expect(await arcade.call('inputScenes')).toEqual(['result']);

    await arcade.tap('replay');
    await expect.poll(() => arcade.screen()).toBe(game.id);
    expect(await arcade.host()).toBe('playing');
    const replayed = (await arcade.round())!;
    expect(replayed.number).toBe(1);
    expect(replayed.seed).not.toBe(SEED);
    expect(replayed.state, 'a fresh Round').not.toEqual(finished);
    expect(await arcade.call('inputScenes')).toEqual([game.id]);

    await playToResult(arcade, game.id);
    await expect.poll(() => arcade.screen()).toBe('result');
    await arcade.tap('home');
    await expect.poll(() => arcade.screen()).toBe('home');
    expect(await arcade.host()).toBe('idle');
    expect(await arcade.call('inputScenes')).toEqual(['home']);
    expect(await arcade.round()).toBeNull();

    const keys = await arcade.call('keys');
    const owned = (key: string) => key === game.id || key.startsWith(`${game.id}/`);
    expect(keys.scenes.filter(owned)).toEqual([]);
    expect(keys.textures.filter(owned)).toEqual([]);
    expect(keys.sounds.filter(owned)).toEqual([]);
    expect(await arcade.counts()).toEqual(before);
  });

  test(`${name}: a Result raises each Player’s saved Stars by the Star rule, the Result screen reports them, and the Round is counted`, async ({
    arcade,
  }) => {
    test.slow();
    const session = sessionFor(game, style);
    const before = await arcade.call('save');
    await openSession(arcade, session, SEED);
    await playToResult(arcade, game.id);
    await expect.poll(() => arcade.screen()).toBe('result');

    const shown = (await arcade.snapshot()).state as {
      result: Result;
      celebrated: MascotId[];
      stars: Record<MascotId, number>;
    };
    const earned = starsEarned(shown.result, session);
    const after = await arcade.call('save');
    const players = session.seats.flatMap(({ occupant }) =>
      occupant.kind === 'player' ? [occupant.mascot] : [],
    );
    expect(Object.keys(earned).sort()).toEqual([...players].sort());
    for (const mascot of players) {
      const was = before.mascots[mascot]?.stars ?? 0;
      expect(after.mascots[mascot]?.stars, mascot).toBe(was + earned[mascot]!);
    }
    expect(shown.stars).toEqual(
      Object.fromEntries(shown.celebrated.map((mascot) => [mascot, earned[mascot]])),
    );
    expect(after.games[game.id]?.roundsPlayed).toBe((before.games[game.id]?.roundsPlayed ?? 0) + 1);
  });

  test(`${name}: the same seed and the same touches give the same Round states`, async ({
    arcade,
  }) => {
    test.slow();
    const play = async () => {
      await openSession(arcade, sessionFor(game, style), SEED);
      const states = [(await arcade.round())?.state, ...(await playToResult(arcade, game.id))];
      await expect.poll(() => arcade.screen()).toBe('result');
      await arcade.tap('home');
      await expect.poll(() => arcade.screen()).toBe('home');
      return states;
    };
    expect(await play()).toEqual(await play());
  });
}

/** Every object in a Round's state that names a Seat, wherever it is nested. */
function seatsIn(state: unknown): Record<string, unknown>[] {
  if (Array.isArray(state)) return state.flatMap(seatsIn);
  if (state === null || typeof state !== 'object') return [];
  const object = state as Record<string, unknown>;
  const nested = Object.values(object).flatMap(seatsIn);
  return 'seat' in object ? [object, ...nested] : nested;
}

for (const { game, style, name } of EVERY_STYLE) {
  test(`${name}: every Seat the Round’s snapshot shows reports its shape with its colour`, async ({
    arcade,
  }) => {
    test.slow();
    const session = sessionFor(game, style);
    await openSession(arcade, session, SEED);
    const { session: opened } = (await arcade.round())!;
    opened.seats.forEach((seat, index) => {
      expect(seat).toMatchObject({
        index,
        color: SEAT_LOOKS[index]!.color,
        shape: SEAT_LOOKS[index]!.shape,
      });
    });
    const states = [(await arcade.round())!.state, ...(await playToResult(arcade, game.id))];
    for (const shown of states.flatMap(seatsIn)) {
      const look = SEAT_LOOKS[shown['seat'] as number]!;
      expect(shown, JSON.stringify(shown)).toMatchObject({ shape: look.shape, color: look.color });
    }
  });
}
