import { SAVE_KEY, SET_ASIDE_KEY } from '../../src/platform/save-store';
import { expect, test } from './arcade';
import { CATALOG, openSession, playToResult, sessionFor } from './play';

/**
 * A save document the Arcade cannot use (story 23 AC2, ADR-0007): it is set aside under a second
 * key, and play starts fresh with no error screen.
 */
const UNUSABLE = {
  'that cannot be read': '{"version": 1, "mascots": {"fox": {"stars": 3}',
  'of a newer version': JSON.stringify({ version: 2, mascots: { fox: { stars: 3 } }, games: {} }),
  'that fails validation': JSON.stringify({
    version: 1,
    mascots: { fox: { stars: -1 } },
    games: {},
  }),
} as const;

const FIRST = CATALOG[0]!;

for (const [name, saved] of Object.entries(UNUSABLE)) {
  test(`a save document ${name} is set aside, and the Arcade starts with fresh Progress and no error screen`, async ({
    arcade,
    page,
  }) => {
    test.slow();
    await arcade.open();
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: SAVE_KEY,
      value: saved,
    });
    await arcade.open();
    await arcade.start();
    await expect(page.locator('#error-screen')).toBeHidden();
    expect(await arcade.call('save')).toEqual({ version: 1, mascots: {}, games: {} });
    const item = (key: string) => page.evaluate((key) => localStorage.getItem(key), key);
    expect(await item(SET_ASIDE_KEY)).toBe(saved);

    await openSession(arcade, sessionFor(FIRST, FIRST.playStyles[0]!), 1);
    await playToResult(arcade, FIRST.id);
    await expect.poll(() => arcade.screen()).toBe('result');
    const played = await arcade.call('save');
    expect(Object.keys(played.mascots).length).toBeGreaterThan(0);

    await arcade.open();
    expect(await arcade.call('save')).toEqual(played);
    expect(await item(SET_ASIDE_KEY)).toBe(saved);
    await expect(page.locator('#error-screen')).toBeHidden();
  });
}
