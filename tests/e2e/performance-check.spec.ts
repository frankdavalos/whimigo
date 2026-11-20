import { type Arcade, expect, test } from './arcade';

/** The Performance check (stories 19 and 20). */

const PERFORMANCE = 'performance-check';
/** The standard load's fixed number of sprites. */
const LOAD_SPRITES = 200;

interface Drawn {
  frame?: string;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  angle: number;
}

interface PerformanceState {
  load: {
    sprites: number;
    textures: string[];
    frames: string[];
    positions: { x: number; y: number }[];
    area: { x: number; y: number; width: number; height: number };
  };
  readings: { fps: number; workMs: number; spanMs: number } | null;
  drawn: {
    fps: { text: string; glyphs: number };
    workMs: { text: string; glyphs: number };
  };
  sharpness: { card: Drawn; digits: Drawn[] };
}

const state = async (arcade: Arcade) => (await arcade.snapshot()).state as PerformanceState;

async function open(arcade: Arcade) {
  await arcade.open();
  await arcade.call('openCheck', PERFORMANCE);
  await expect.poll(() => arcade.screen()).toBe(PERFORMANCE);
}

test('the Performance check opens from the Home Screen and moves its standard load, all from one texture @smoke', async ({
  arcade,
}) => {
  await arcade.open();
  await arcade.start();
  await arcade.tap(PERFORMANCE);
  await expect.poll(() => arcade.screen()).toBe(PERFORMANCE);

  const { load } = await state(arcade);
  expect(load.sprites).toBe(LOAD_SPRITES);
  expect(load.positions).toHaveLength(LOAD_SPRITES);
  expect(load.textures).toHaveLength(1);
  // Game-sized art: the frames of the stand-in set.
  expect(load.frames.length).toBeGreaterThan(1);
  expect(load.frames.every((frame) => frame.startsWith('standin/'))).toBe(true);

  const { images } = await arcade.call('pictures');
  const loadImages = images.filter((image) => image.texture === load.textures[0]);
  expect(loadImages).toHaveLength(LOAD_SPRITES);
  expect(new Set(loadImages.map((image) => image.frame))).toEqual(new Set(load.frames));
});

test('the standard load moves, and stays inside its area', async ({ arcade }) => {
  await open(arcade);
  const before = (await state(arcade)).load;
  await expect
    .poll(async () => {
      const after = (await state(arcade)).load.positions;
      return after.filter((position, index) => {
        const was = before.positions[index]!;
        return position.x !== was.x || position.y !== was.y;
      }).length;
    })
    .toBe(LOAD_SPRITES);
  const { positions, area } = (await state(arcade)).load;
  for (const { x, y } of positions) {
    expect(x).toBeGreaterThanOrEqual(area.x);
    expect(x).toBeLessThanOrEqual(area.x + area.width);
    expect(y).toBeGreaterThanOrEqual(area.y);
    expect(y).toBeLessThanOrEqual(area.y + area.height);
  }
});

test('frames per second and work per frame are positive and finite, averaged over a second, and drawn in bitmap digits', async ({
  arcade,
}) => {
  await open(arcade);
  await expect.poll(async () => (await state(arcade)).readings).not.toBeNull();
  const { readings } = await state(arcade);
  for (const value of [readings!.fps, readings!.workMs]) {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThan(0);
  }
  expect(readings!.spanMs).toBeGreaterThanOrEqual(1000);

  await expect.poll(async () => (await state(arcade)).drawn.fps.text).not.toBe('0');
  const { drawn } = await state(arcade);
  expect(drawn.fps.text).toMatch(/^[1-9]\d*$/);
  expect(drawn.workMs.text).toMatch(/^\d+\.\d\d$/);
  expect(Number(drawn.workMs.text)).toBeGreaterThan(0);
  // One bitmap glyph for every character, the decimal point included.
  expect(drawn.fps.glyphs).toBe(drawn.fps.text.length);
  expect(drawn.workMs.glyphs).toBe(drawn.workMs.text.length);
});

test('the sharpness card and its digits are drawn unscaled, unrotated and at whole-unit positions', async ({
  arcade,
}) => {
  await open(arcade);
  const { card, digits } = (await state(arcade)).sharpness;
  const { images } = await arcade.call('pictures');
  expect(images).toContainEqual({ texture: 'arcade', frame: 'arcade/sharpness' });
  expect(card.frame).toBe('arcade/sharpness');
  expect(digits.map((row) => row.text).join('')).toBe('0123456789');
  for (const drawn of [card, ...digits]) {
    expect(drawn).toMatchObject({ scaleX: 1, scaleY: 1, angle: 0 });
    expect(Number.isInteger(drawn.x), `x ${drawn.x}`).toBe(true);
    expect(Number.isInteger(drawn.y), `y ${drawn.y}`).toBe(true);
    // Measured from the top-left corner, so whole-unit positions put every edge on a whole unit.
    expect(Number.isInteger(drawn.width) && Number.isInteger(drawn.height)).toBe(true);
  }
  // The digits lie on the card.
  for (const row of digits) {
    expect(row.x).toBeGreaterThanOrEqual(card.x);
    expect(row.x + row.width).toBeLessThanOrEqual(card.x + card.width);
    expect(row.y).toBeGreaterThanOrEqual(card.y);
    expect(row.y + row.height).toBeLessThanOrEqual(card.y + card.height);
  }
});

interface LoopState {
  state: 'idle' | 'running' | 'done';
  cycles: number;
  of: number;
  before: Counts | null;
  after: Counts | null;
  added: string[];
  inputScenes: string[];
  standinTextures: string[];
  drawn: string;
}
type Counts = { scenes: number; textures: number; sounds: number };

const loop = async (arcade: Arcade) =>
  ((await arcade.snapshot()).state as { loop: LoopState }).loop;

test.describe('the add-and-remove loop (story 20)', () => {
  test.setTimeout(180_000);

  test('one control adds the stand-in Scene with its pack and removes both, 50 times, and the counts end where they began', async ({
    arcade,
  }) => {
    await open(arcade);
    const opened = await arcade.counts();
    expect(await loop(arcade)).toMatchObject({ state: 'idle', cycles: 0, of: 50 });

    await arcade.tap('loop');
    await expect.poll(async () => (await loop(arcade)).state).toBe('running');
    await expect.poll(async () => (await loop(arcade)).state, { timeout: 150_000 }).toBe('done');

    const done = await loop(arcade);
    expect(done.cycles).toBe(50);
    expect(done.drawn).toBe('50');
    expect(done.before).toEqual(opened);
    expect(done.after).toEqual(done.before);
    expect(await arcade.counts()).toEqual(opened);
    // While it was loaded, the one texture the stand-in added was its atlas, keyed with its bare
    // id as a Game's is (game contract, Asset keys); afterwards none remains.
    expect(done.added).toEqual(['standin']);
    expect(done.standinTextures).toEqual([]);
    // The stand-in Scene never accepted input: only the Performance check did (ADR-0004).
    expect(done.inputScenes).toEqual([PERFORMANCE]);
  });

  test('leaving while the loop runs goes home, and leaves nothing of the stand-in behind', async ({
    arcade,
    page,
  }) => {
    await arcade.open();
    await arcade.start();
    const home = await arcade.counts();
    await arcade.tap(PERFORMANCE);
    await expect.poll(() => arcade.screen()).toBe(PERFORMANCE);

    await arcade.tap('loop');
    await expect.poll(async () => (await loop(arcade)).cycles).toBeGreaterThan(0);
    expect((await loop(arcade)).state).toBe('running');
    await arcade.hold('leave', 1000);
    await expect.poll(() => arcade.screen()).toBe('home');
    expect(await arcade.counts()).toEqual(home);
    // Nothing the stand-in was still loading turns up later.
    await page.waitForTimeout(2000);
    expect(await arcade.counts()).toEqual(home);
  });
});
