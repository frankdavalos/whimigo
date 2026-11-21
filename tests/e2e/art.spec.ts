import { expect, test } from './arcade';
import { CATALOG } from './play';

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
  for (const frame of [
    'arcade/sun',
    'arcade/card',
    'arcade/grown-ups',
    ...CATALOG.map((game) => game.card.frame),
  ]) {
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

test('the Touch Check draws its controls, readings and Seats from the Arcade’s atlas', async ({
  arcade,
}) => {
  await arcade.open();
  await arcade.call('openCheck', 'touch-check');
  await expect.poll(() => arcade.screen()).toBe('touch-check');
  const { images } = await arcade.call('pictures');
  for (const frame of [
    'arcade/hold',
    'arcade/home',
    'arcade/reset',
    'arcade/card',
    'arcade/seating-around-the-table',
    'arcade/touch-now',
    'arcade/touch-most',
    'arcade/touch-cancelled',
    'arcade/seat-circle',
    'arcade/seat-square',
    'arcade/seat-triangle',
    'arcade/seat-star',
  ]) {
    expect(images).toContainEqual({ texture: 'arcade', frame });
  }
  expect(images.every(fromArcadeAtlas)).toBe(true);
});

test('the Sound check draws its controls and the audio state from the Arcade’s atlas', async ({
  arcade,
}) => {
  await arcade.open();
  await arcade.call('openCheck', 'sound-check');
  await expect.poll(() => arcade.screen()).toBe('sound-check');
  const { images } = await arcade.call('pictures');
  for (const frame of [
    'arcade/hold',
    'arcade/home',
    'arcade/card',
    'arcade/sound-sine',
    'arcade/sound-triangle',
    'arcade/sound-square',
    'arcade/sound-sawtooth',
    'arcade/sound-noise',
    'arcade/sound-glide',
    'arcade/sound-sequence',
    'arcade/audio-locked',
  ]) {
    expect(images).toContainEqual({ texture: 'arcade', frame });
  }
  expect(images.every(fromArcadeAtlas)).toBe(true);
});

test('the Performance check draws its controls, readings and card from the Arcade’s atlas, and its load from one other', async ({
  arcade,
}) => {
  await arcade.open();
  await arcade.call('openCheck', 'performance-check');
  await expect.poll(() => arcade.screen()).toBe('performance-check');
  const { images } = await arcade.call('pictures');
  for (const frame of [
    'arcade/hold',
    'arcade/home',
    'arcade/card',
    'arcade/perf-loop',
    'arcade/perf-fps',
    'arcade/perf-work',
    'arcade/perf-cycles',
    'arcade/sharpness',
  ]) {
    expect(images).toContainEqual({ texture: 'arcade', frame });
  }
  const others = images.filter((image) => !fromArcadeAtlas(image));
  expect(new Set(others.map((image) => image.texture)).size).toBe(1);
  expect(others.every((image) => image.frame.startsWith('standin/'))).toBe(true);
});
