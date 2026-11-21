import { expect, test, type Arcade } from './arcade';
import { EVERY_STYLE, openSession, playToResult, sessionFor } from './play';

/** The 13-inch iPad Pro turned upright, in CSS pixels. */
const PORTRAIT = { width: 1032, height: 1376 };

const { game, style } = EVERY_STYLE[0]!;

/** Opens a Round of the first Game in the Catalog. */
async function openRound(arcade: Arcade) {
  await openSession(arcade, sessionFor(game, style), 5);
}

test('opened upright, the Arcade shows the rotate picture, and tap-to-start once it is turned', async ({
  arcade,
  page,
}) => {
  const landscape = page.viewportSize()!;
  await page.setViewportSize(PORTRAIT);
  await page.goto('./?e2e=1');
  await expect.poll(() => arcade.screen().catch(() => null)).toBe('rotate');
  expect((await arcade.call('pictures')).images).toContainEqual({
    texture: 'arcade',
    frame: 'arcade/rotate',
  });
  await page.setViewportSize(landscape);
  await expect.poll(() => arcade.screen()).toBe('start');
  await arcade.start();
});

test.describe('with the Arcade started', () => {
  test.beforeEach(async ({ arcade }) => {
    await arcade.open();
    await arcade.start();
  });

  test('in portrait a running Round pauses under the rotate picture, and back in landscape the pause screen shows', async ({
    arcade,
    page,
  }) => {
    const landscape = page.viewportSize()!;
    await openRound(arcade);
    const before = (await arcade.round())!.state;

    await page.setViewportSize(PORTRAIT);
    await expect.poll(() => arcade.screen()).toBe('rotate');
    expect(await arcade.host()).toBe('paused');
    expect(await arcade.call('inputScenes')).toEqual(['rotate']);
    expect((await arcade.call('pictures')).images).toContainEqual({
      texture: 'arcade',
      frame: 'arcade/rotate',
    });

    await page.setViewportSize(landscape);
    await expect.poll(() => arcade.screen()).toBe('pause');
    expect(await arcade.host()).toBe('paused');
    expect(await arcade.call('inputScenes')).toEqual(['pause']);
    expect((await arcade.round())!.state).toEqual(before);
  });

  /** Screens with no Round running, and how to reach each one from the Home Screen. */
  const NOT_PLAYING: Readonly<Record<string, (arcade: Arcade) => Promise<void>>> = {
    home: async () => undefined,
    result: async (arcade) => {
      await openRound(arcade);
      await playToResult(arcade, game.id);
    },
  };

  for (const [screen, reach] of Object.entries(NOT_PLAYING)) {
    test(`in portrait the rotate picture covers the ${screen} screen, which shows again in landscape`, async ({
      arcade,
      page,
    }) => {
      const landscape = page.viewportSize()!;
      await reach(arcade);
      await expect.poll(() => arcade.screen()).toBe(screen);
      const host = await arcade.host();

      await page.setViewportSize(PORTRAIT);
      await expect.poll(() => arcade.screen()).toBe('rotate');
      expect(await arcade.call('inputScenes')).toEqual(['rotate']);

      await page.setViewportSize(landscape);
      await expect.poll(() => arcade.screen()).toBe(screen);
      expect(await arcade.host()).toBe(host);
      expect(await arcade.call('inputScenes')).toEqual([screen]);
    });
  }
});
