import type { Rect } from '../../src/contract';
import { expect, test } from './arcade';
import { CATALOG, EVERY_STYLE, playToResult, sessionFor } from './play';

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
  expect(snapshot.state).toEqual({ games: ids });
  expect(Object.keys(snapshot.targets)).toEqual([...ids, 'grown-ups']);
  for (const check of await arcade.checks()) expect(snapshot.targets[check]).toBeUndefined();

  const drawn = (await arcade.call('pictures')).images.map(({ frame }) => frame);
  for (const game of CATALOG) expect(drawn).toContain(game.card.frame);
});

for (const game of CATALOG) {
  test(`${game.id}: tapping its Game Card opens its lobby`, async ({ arcade }) => {
    await arcade.tap(game.id);
    await expect.poll(() => arcade.screen()).toBe('lobby');
    expect((await arcade.snapshot()).state).toMatchObject({ game: game.id });
  });
}

for (const { game, style, name } of EVERY_STYLE) {
  test(`${name}: opens straight into a Round, plays to a Result, replays and closes leaving nothing behind`, async ({
    arcade,
  }) => {
    test.slow();
    const before = await arcade.counts();
    const session = sessionFor(game, style);
    await arcade.call('open', session, SEED);
    await expect.poll(() => arcade.screen()).toBe(game.id);
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

  test(`${name}: the same seed and the same touches give the same Round states`, async ({
    arcade,
  }) => {
    test.slow();
    const play = async () => {
      await arcade.call('open', sessionFor(game, style), SEED);
      await expect.poll(() => arcade.screen()).toBe(game.id);
      const states = [(await arcade.round())?.state, ...(await playToResult(arcade, game.id))];
      await expect.poll(() => arcade.screen()).toBe('result');
      await arcade.tap('home');
      await expect.poll(() => arcade.screen()).toBe('home');
      return states;
    };
    expect(await play()).toEqual(await play());
  });
}
