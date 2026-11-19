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
  log: { event: string; at: number }[];
  logCap: number;
}

const state = async (arcade: Arcade) => (await arcade.snapshot()).state as SoundState;

/** A tap in the frame's corner, away from every control. */
async function tapAway(arcade: Arcade) {
  const { frame } = await arcade.layout();
  await arcade.page.touchscreen.tap(frame.x + frame.width - 10, frame.y + frame.height - 10);
}

/** Opens the Sound check straight from the bridge, with no tap, so sound is still locked. */
async function openLocked(arcade: Arcade) {
  await arcade.open();
  await arcade.call('openCheck', SOUND);
  await expect.poll(() => arcade.screen()).toBe(SOUND);
}

/** Opens the Arcade, unlocks sound with the tap to start, and opens the Sound check. */
async function openWithSound(arcade: Arcade) {
  await arcade.open();
  await arcade.start();
  await expect.poll(() => arcade.audio()).toBe('running');
  await arcade.tap(SOUND);
  await expect.poll(() => arcade.screen()).toBe(SOUND);
}

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
  await openWithSound(arcade);
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
  await openLocked(arcade);
  expect((await state(arcade)).route).toBe('phaser-sound-manager');
});

test('a request to play before sound is unlocked returns at once, plays nothing and throws nothing', async ({
  arcade,
  page,
}) => {
  await openLocked(arcade);
  expect(await arcade.audio()).toBe('locked');
  const { sounds } = await state(arcade);

  for (const { key } of sounds) {
    const request = await arcade.call('playSound', key);
    expect(request.started).toBe(false);
    expect(request.ms).toBeLessThan(20);
  }
  expect((await state(arcade)).playing).toEqual([]);

  // A tap away from every control unlocks sound; nothing requested earlier plays then.
  await tapAway(arcade);
  await expect.poll(() => arcade.audio()).toBe('running');
  await page.waitForTimeout(300);
  expect(await state(arcade)).toMatchObject({ playing: [], last: null });
});

test('the audio state is shown as a picture, and matches what the bridge reports', async ({
  arcade,
}) => {
  await openLocked(arcade);
  await expect.poll(async () => (await state(arcade)).picture).toBe('arcade/audio-locked');
  expect((await state(arcade)).audio).toBe('locked');

  await tapAway(arcade);
  await expect.poll(async () => (await state(arcade)).picture).toBe('arcade/audio-running');
  expect((await state(arcade)).audio).toBe('running');
  const { images } = await arcade.call('pictures');
  expect(images).toContainEqual({ texture: 'arcade', frame: 'arcade/audio-running' });
});

test.describe('putting the tablet away and bringing it back (story 24)', () => {
  test('hiding and showing the page logs hidden then visible; sound is not running while hidden, and the next tap brings it back', async ({
    arcade,
    page,
  }) => {
    await openWithSound(arcade);
    const opened = await state(arcade);
    expect(opened.log).toEqual([{ event: 'running', at: expect.any(Number) }]);

    await arcade.hide();
    await expect.poll(() => arcade.audio()).toBe('suspended');
    // It stays that way while hidden, though the headless browser keeps drawing frames.
    await page.waitForTimeout(500);
    expect(await arcade.audio()).toBe('suspended');
    await expect.poll(async () => (await state(arcade)).picture).toBe('arcade/audio-suspended');

    await arcade.show();
    await tapAway(arcade);
    await expect.poll(() => arcade.audio()).toBe('running');
    await arcade.tap('sine');
    await expect
      .poll(async () => (await state(arcade)).last)
      .toEqual({ sound: 'sine', started: true });

    const { log } = await state(arcade);
    const events = log.map((entry) => entry.event);
    expect(events.filter((event) => event === 'hidden' || event === 'visible')).toEqual([
      'hidden',
      'visible',
    ]);
    const hidden = events.indexOf('hidden');
    const visible = events.indexOf('visible');
    expect(events.slice(hidden, visible)).toContain('suspended');
    expect(events.slice(visible)).toContain('running');
    const times = log.map((entry) => entry.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times[visible]! - times[hidden]!).toBeGreaterThanOrEqual(500);
  });

  test('the log holds at most its stated number of entries, lives in memory only and is sent nowhere', async ({
    arcade,
    page,
  }) => {
    await openWithSound(arcade);
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    const { logCap } = await state(arcade);
    expect(logCap).toBe(50);
    await arcade.hideAndShow(logCap);
    const { log } = await state(arcade);
    expect(log).toHaveLength(logCap);
    // The newest are kept.
    const pageEvents = log.filter((entry) => entry.event === 'hidden' || entry.event === 'visible');
    expect(pageEvents.at(-1)!.event).toBe('visible');

    expect(requests).toEqual([]);
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  });
});
