import { expect, test } from './arcade';
import { CATALOG, openSession, playToResult, sessionFor } from './play';

/**
 * A Game whose files fail to load (story 29). Requests are refused at the network, so the service
 * worker is kept out of the way: routes cannot see what it serves.
 */
test.use({ serviceWorkers: 'block' });

/** A Game's own files in the build, by what they hold: its chunk, or its atlas's image and frames. */
const FILES = {
  code: (id: string) => new RegExp(`/assets/${id}-[\\w-]{8}\\.js$`),
  atlas: (id: string) => new RegExp(`/assets/${id}-[\\w-]{8}\\.(png|json)$`),
} as const;

for (const game of CATALOG) {
  for (const [what, files] of Object.entries(FILES)) {
    test(`${game.id}: when its ${what} fails to load, the child stays on the Home Screen, its Game Card refuses, nothing is left behind, and another Game still opens and plays`, async ({
      arcade,
      page,
    }) => {
      test.slow();
      await arcade.open();
      await arcade.start();
      const before = await arcade.counts();

      let refused = 0;
      await page.route(files(game.id), (route) => {
        refused += 1;
        return route.abort();
      });
      await arcade.call('open', sessionFor(game, game.playStyles[0]!), 1);
      await expect
        .poll(async () => (await arcade.call('hostStates')).slice(-3))
        .toEqual(['idle', 'loading', 'idle']);
      await expect.poll(() => arcade.screen()).toBe('home');
      expect(refused, 'requests refused').toBeGreaterThan(0);
      expect(await arcade.host()).toBe('idle');
      expect((await arcade.snapshot()).state).toMatchObject({ refused: game.id });
      await expect(page.locator('#error-screen')).toBeHidden();
      expect(await arcade.counts()).toEqual(before);

      const other = CATALOG.find(({ id }) => id !== game.id)!;
      await openSession(arcade, sessionFor(other, other.playStyles[0]!), 1);
      await playToResult(arcade, other.id);
      await expect.poll(() => arcade.screen()).toBe('result');
      await expect(page.locator('#error-screen')).toBeHidden();
    });
  }
}
