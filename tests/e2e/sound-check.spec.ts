import { type Arcade, expect, test } from './arcade';

/** The Sound check (stories 23 and 24). */

const SOUND = 'sound-check';
const SOUNDS = ['sine', 'triangle', 'square', 'sawtooth', 'noise', 'glide', 'sequence'];

interface SoundState {
  route: string;
  audio: string;
  picture: string;
  sounds: { name: string; key: string; icon: string }[];
  last: { sound: string; started: boolean } | null;
  playing: string[];
}

const state = async (arcade: Arcade) => (await arcade.snapshot()).state as SoundState;

test('the Sound check opens from the Home Screen with one control for each sound and the leave control @smoke', async ({
  arcade,
}) => {
  await arcade.open();
  await arcade.start();
  await arcade.tap(SOUND);
  await expect.poll(() => arcade.screen()).toBe(SOUND);
  const { targets, state } = await arcade.snapshot();
  expect(Object.keys(targets).sort()).toEqual([...SOUNDS, 'leave'].sort());
  const { sounds } = state as SoundState;
  expect(sounds.map((sound) => sound.name)).toEqual(SOUNDS);
  // Each control has its own picture.
  const icons = sounds.map((sound) => sound.icon);
  expect(new Set(icons).size).toBe(SOUNDS.length);
  const { images } = await arcade.call('pictures');
  for (const frame of icons) expect(images).toContainEqual({ texture: 'arcade', frame });
});

test('tapping each sound’s control makes the bridge report that sound requested and playback started', async ({
  arcade,
}) => {
  await arcade.open();
  await arcade.start();
  await expect.poll(() => arcade.audio()).toBe('running');
  await arcade.tap(SOUND);
  await expect.poll(() => arcade.screen()).toBe(SOUND);
  for (const { name, key } of (await state(arcade)).sounds) {
    await arcade.tap(name);
    await expect
      .poll(async () => (await state(arcade)).last)
      .toEqual({ sound: name, started: true });
    // The buffer plays to its end on the running context, and the sound then stops by itself.
    await expect.poll(async () => (await state(arcade)).playing).not.toContain(key);
  }
});

test('the snapshot reports that Phaser’s sound manager plays the sounds', async ({ arcade }) => {
  await arcade.open();
  await arcade.call('openCheck', SOUND);
  await expect.poll(() => arcade.screen()).toBe(SOUND);
  expect((await state(arcade)).route).toBe('phaser-sound-manager');
});

test('a request to play before sound is unlocked returns at once, plays nothing and throws nothing', async ({
  arcade,
  page,
}) => {
  await arcade.open();
  await arcade.call('openCheck', SOUND);
  await expect.poll(() => arcade.screen()).toBe(SOUND);
  expect(await arcade.audio()).toBe('locked');
  const { sounds } = await state(arcade);

  for (const { key } of sounds) {
    const request = await arcade.call('playSound', key);
    expect(request.started).toBe(false);
    expect(request.ms).toBeLessThan(20);
  }
  expect((await state(arcade)).playing).toEqual([]);

  // A tap away from every control unlocks sound; nothing requested earlier plays then.
  const { frame } = await arcade.layout();
  await page.touchscreen.tap(frame.x + frame.width - 10, frame.y + frame.height - 10);
  await expect.poll(() => arcade.audio()).toBe('running');
  await page.waitForTimeout(300);
  expect(await state(arcade)).toMatchObject({ playing: [], last: null });
});

test('the audio state is shown as a picture, and matches what the bridge reports', async ({
  arcade,
  page,
}) => {
  await arcade.open();
  await arcade.call('openCheck', SOUND);
  await expect.poll(() => arcade.screen()).toBe(SOUND);
  await expect.poll(async () => (await state(arcade)).picture).toBe('arcade/audio-locked');
  expect((await state(arcade)).audio).toBe('locked');

  const { frame } = await arcade.layout();
  await page.touchscreen.tap(frame.x + frame.width - 10, frame.y + frame.height - 10);
  await expect.poll(async () => (await state(arcade)).picture).toBe('arcade/audio-running');
  expect((await state(arcade)).audio).toBe('running');
  const { images } = await arcade.call('pictures');
  expect(images).toContainEqual({ texture: 'arcade', frame: 'arcade/audio-running' });
});
