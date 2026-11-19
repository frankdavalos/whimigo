import { expect, test } from './arcade';

/** A frame Phaser cannot find is drawn as the whole texture, under the name `__BASE`. */
const fromArcadeAtlas = (image: { texture: string; frame: string }) =>
  image.texture === 'arcade' && image.frame.startsWith('arcade/');

test('the tap-to-start screen and the Home Screen draw their pictures from the Arcade’s atlas @smoke', async ({
  arcade,
}) => {
  await arcade.open();
  const start = await arcade.call('pictures');
  expect(start.shapes).toBe(0);
  expect(start.images).toContainEqual({ texture: 'arcade', frame: 'arcade/play' });
  expect(start.images.every(fromArcadeAtlas)).toBe(true);

  await arcade.start();
  const home = await arcade.call('pictures');
  expect(home.shapes).toBe(0);
  for (const frame of ['arcade/sun', 'arcade/card', 'arcade/check-blank']) {
    expect(home.images).toContainEqual({ texture: 'arcade', frame });
  }
  expect(home.images.every(fromArcadeAtlas)).toBe(true);
});

test('the hold control draws its face and icon from the Arcade’s atlas', async ({ arcade }) => {
  await arcade.open();
  await arcade.call('openCheck', 'blank-check');
  await expect.poll(() => arcade.screen()).toBe('blank-check');
  const { images } = await arcade.call('pictures');
  for (const frame of ['arcade/hold', 'arcade/home']) {
    expect(images).toContainEqual({ texture: 'arcade', frame });
  }
  expect(images.every(fromArcadeAtlas)).toBe(true);
});
