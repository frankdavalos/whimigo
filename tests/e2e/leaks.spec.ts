import type { GameManifest } from '../../src/contract';
import { type Arcade, expect, test } from './arcade';
import { CATALOG, leaveThroughPause, openSession, resultFor, sessionFor } from './play';

/**
 * Going in and out of Games all afternoon (story 31, gate G6): however a Game is left, nothing
 * stays under its id, and `counts()` comes back to where it began.
 */

/** How many times the long test opens and closes every Game in the Catalog. */
const CYCLES = 20;

/** The ways out of a Game, each ending on the Home Screen. */
const LEAVE: Readonly<Record<string, (arcade: Arcade, game: GameManifest) => Promise<void>>> = {
  'from the Result screen': async (arcade, game) => {
    const style = game.playStyles[0]!;
    await openSession(arcade, sessionFor(game, style), 1);
    await arcade.call('finish', resultFor(style.style));
    await expect.poll(() => arcade.screen()).toBe('result');
    await arcade.tap('home');
  },
  'from the pause screen': async (arcade, game) => {
    await openSession(arcade, sessionFor(game, game.playStyles[0]!), 1);
    await leaveThroughPause(arcade);
  },
  'during its Demo': async (arcade, game) => {
    await arcade.call('open', sessionFor(game, game.playStyles[0]!), 1);
    await expect.poll(async () => (await arcade.round())?.demo.playing ?? false).toBe(true);
    await leaveThroughPause(arcade);
  },
};

/** Everything `counts()` counts that belongs to a Game: its Scene, textures and sounds. */
async function ownedBy(arcade: Arcade, id: string) {
  const keys = await arcade.call('keys');
  const owned = (key: string) => key === id || key.startsWith(`${id}/`);
  return {
    scenes: keys.scenes.filter(owned),
    textures: keys.textures.filter(owned),
    sounds: keys.sounds.filter(owned),
  };
}

async function backHome(arcade: Arcade): Promise<void> {
  await expect.poll(() => arcade.screen()).toBe('home');
  expect(await arcade.host()).toBe('idle');
  expect(await arcade.round()).toBeNull();
}

test.beforeEach(async ({ arcade }) => {
  await arcade.open();
  await arcade.start();
});

for (const game of CATALOG) {
  for (const [way, leave] of Object.entries(LEAVE)) {
    test(`${game.id}: left ${way}, nothing stays under its id`, async ({ arcade }) => {
      const before = await arcade.counts();
      await leave(arcade, game);
      await backHome(arcade);
      expect(await ownedBy(arcade, game.id)).toEqual({ scenes: [], textures: [], sounds: [] });
      expect(await arcade.counts()).toEqual(before);
    });
  }
}

test(`opening and closing every Game ${CYCLES} times, each way out in turn, leaves counts() where it began`, async ({
  arcade,
}, testInfo) => {
  // Minutes long, and nothing in it depends on the screen's shape: the main project runs it.
  test.skip(testInfo.project.name !== 'chromium-tablet-4x3', 'run in the main project only');
  test.setTimeout(CYCLES * CATALOG.length * 60_000);
  const ways = Object.values(LEAVE);
  const before = await arcade.counts();
  for (let cycle = 0; cycle < CYCLES; cycle += 1) {
    for (const [index, game] of CATALOG.entries()) {
      await ways[(cycle + index) % ways.length]!(arcade, game);
      await backHome(arcade);
    }
  }
  expect(await arcade.counts()).toEqual(before);
  for (const game of CATALOG) {
    expect(await ownedBy(arcade, game.id), game.id).toEqual({
      scenes: [],
      textures: [],
      sounds: [],
    });
  }
});
