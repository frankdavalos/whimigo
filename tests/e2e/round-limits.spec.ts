import { LOAD_SPRITES } from '../../src/arcade/checks/standard-load';
import { expect, test } from './arcade';
import { EVERY_STYLE, openSession, playToResult, sessionFor } from './play';

/**
 * As light as Phase 0 measured (story 33, gates G2 and G3), and within the Game contract's rules,
 * in every frame of a Round of every Game in every Play Style. The bridge's audit watches each
 * frame drawn while a Round plays.
 */

test.beforeEach(async ({ arcade }) => {
  await arcade.open();
  await arcade.start();
});

for (const { game, style, name } of EVERY_STYLE) {
  test(`${name}: every frame of a Round draws its pictures from the Game’s atlas and the Arcade’s, at most ${LOAD_SPRITES} at once, with one camera, no banned object and no HTML element added`, async ({
    arcade,
  }) => {
    test.slow();
    await openSession(arcade, sessionFor(game, style), 1);
    await playToResult(arcade, game.id);
    await expect.poll(() => arcade.screen()).toBe('result');

    const audit = await arcade.call('roundAudit');
    expect(audit.frames, 'frames audited').toBeGreaterThan(10);
    expect(audit.textures.length, 'atlases drawn from').toBeGreaterThan(0);
    for (const texture of audit.textures) expect(['arcade', game.id]).toContain(texture);
    expect(audit.mostPictures).toBeGreaterThan(0);
    expect(audit.mostPictures).toBeLessThanOrEqual(LOAD_SPRITES);
    expect(audit.mostCameras).toBe(1);
    expect(audit.banned).toEqual([]);
    expect(audit.elementsAdded).toEqual([]);
    expect((await arcade.layout()).renderScale).toBe(1);
  });
}
