import type { Rect } from '../../src/contract';
import { type Arcade, type Point, expect, test } from './arcade';

/**
 * The hidden render scale (story 21, gate G8, ADR-0003). At half scale the canvas has half the
 * pixels each way and every Scene's camera is zoomed to match, so every screen should look and
 * respond the same, in the same places. Presses are sent through the Chromium DevTools protocol.
 */

const HALF = '&scale=0.5';
type Scale = 1 | 0.5;
const query = (scale: Scale) => (scale === 1 ? '' : HALF);

/** Long enough for any control: a tap control acts on the lift, a hold control after half a second. */
const PRESS_MS = 1000;

/** The render scale of the Arcade on the page, or null if it has not been opened with the bridge. */
const openedAt = (arcade: Arcade) =>
  arcade.page.evaluate(() => window.whimigo?.layout().renderScale ?? null);

/**
 * Shows one screen, fresh, at a render scale. A check screen is opened again through the bridge
 * when the page is already at that scale, which starts it anew; anything else reloads the page.
 */
async function show(arcade: Arcade, scale: Scale, screen: string): Promise<void> {
  const isCheck = screen !== 'start' && screen !== 'home';
  if (!isCheck || (await openedAt(arcade)) !== scale) {
    await arcade.open(query(scale));
    expect((await arcade.layout()).renderScale).toBe(scale);
    if (screen === 'start') return;
    if (screen === 'home') {
      await arcade.start();
      return;
    }
  }
  await arcade.call('openCheck', screen);
  await expect.poll(() => arcade.screen()).toBe(screen);
  await expect.poll(async () => (await arcade.snapshot()).targets).not.toEqual({});
}

/** Every screen a test can show: the tap-to-start screen, the Home Screen and each check screen. */
async function everyScreen(arcade: Arcade): Promise<string[]> {
  await show(arcade, 1, 'home');
  return ['start', 'home', ...(await arcade.checks())];
}

interface ZoneState {
  rect: Rect;
  facing: 0 | 180;
  taps: number;
  lastTouch: Point | null;
}

/**
 * What a press on a screen can change, beyond which screen shows: the part of each check screen's
 * state that its controls act on. A screen not listed here is compared by the screen that shows.
 */
const EFFECTS: Readonly<Record<string, (state: never) => unknown>> = {
  'touch-check': (state: { seating: string; zones: ZoneState[] }) => ({
    seating: state.seating,
    taps: state.zones.map((zone) => zone.taps),
  }),
  'sound-check': (state: { last: { sound: string } | null }) => state.last?.sound ?? null,
  'performance-check': (state: { loop: { state: string } }) => state.loop.state !== 'idle',
};

async function effect(arcade: Arcade, screen: string) {
  const showing = await arcade.screen();
  if (showing !== screen) return { screen: showing };
  const of = EFFECTS[screen] as ((state: unknown) => unknown) | undefined;
  return { screen: showing, state: of ? of((await arcade.snapshot()).state) : null };
}

/** The middle of a Zone of the Touch Check, on the page. */
async function zoneCentre(arcade: Arcade, seat: number): Promise<Point> {
  const { zones } = (await arcade.snapshot()).state as { zones: ZoneState[] };
  const { rect } = zones[seat]!;
  return arcade.toPage({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
}

/** Gives a screen something for its controls to change: a tap counted in a Touch Check Zone. */
async function prepare(arcade: Arcade, screen: string): Promise<void> {
  if (screen !== 'touch-check') return;
  const { x, y } = await zoneCentre(arcade, 0);
  await arcade.page.touchscreen.tap(x, y);
  await expect
    .poll(async () => (await effect(arcade, screen)).state)
    .toMatchObject({
      taps: [1, 0, 0, 0],
    });
}

/**
 * One finger down on a target, held, then lifted. The Grown-Up Gate is held until the Grown-Ups
 * Area shows, since its three seconds are counted in scene time, which a slow frame holds back.
 */
async function press(arcade: Arcade, screen: string, name: string, point: Point): Promise<void> {
  await arcade.touch('touchStart', [point]);
  await arcade.page.waitForTimeout(PRESS_MS);
  if (screen === 'home' && name === 'grown-ups') {
    await expect.poll(() => arcade.screen(), { timeout: 60_000 }).toBe('grown-ups');
  }
  await arcade.touch('touchEnd', []);
}

const near = (a: number, b: number) => Math.abs(a - b) <= 1;

type Targets = Awaited<ReturnType<Arcade['snapshot']>>['targets'];

test('at render scale 0.5 the canvas has half the pixels each way', async ({ arcade }) => {
  await arcade.open();
  const full = await arcade.layout();
  await arcade.open(HALF);
  const half = await arcade.layout();
  expect(full.renderScale).toBe(1);
  expect(half.renderScale).toBe(0.5);
  // A canvas an odd number of pixels wide cannot be halved exactly.
  expect(Math.abs(half.canvasPixels.width - full.canvasPixels.width / 2)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(half.canvasPixels.height - full.canvasPixels.height / 2)).toBeLessThanOrEqual(
    0.5,
  );
  expect(half.canvas).toEqual(full.canvas);
  expect(half.frame.width).toBeCloseTo(full.frame.width, 0);
});

test('opened normally the render scale is 1, whatever the address asks for', async ({ page }) => {
  const canvasPixels = async (address: string) => {
    await page.goto(address);
    const canvas = page.locator('#arcade canvas');
    await expect(canvas).toHaveCount(1);
    return canvas.evaluate((element: HTMLCanvasElement) => [element.width, element.height]);
  };
  const normal = await canvasPixels('./');
  expect(await canvasPixels('./?scale=0.5')).toEqual(normal);
  expect(await page.evaluate(() => window.whimigo)).toBeUndefined();
  expect(await canvasPixels('./?e2e=1')).toEqual(normal);
});

test('at render scale 0.5 every named target of every screen is in the same place on the page, and a press there does the same', async ({
  arcade,
}) => {
  test.setTimeout(600_000);
  for (const screen of await everyScreen(arcade)) {
    const placed: Partial<Record<Scale, Targets>> = {};
    const outcomes: Record<Scale, Record<string, unknown>> = { 1: {}, 0.5: {} };
    for (const scale of [1, 0.5] as const) {
      await show(arcade, scale, screen);
      placed[scale] = (await arcade.snapshot()).targets;
      const canvasPixels = (await arcade.layout()).canvasPixels;
      // Every press is made where the target is at full scale.
      for (const [name, target] of Object.entries(placed[1]!)) {
        const where = `${screen}/${name} at ${scale}`;
        await show(arcade, scale, screen);
        await prepare(arcade, screen);
        const before = await effect(arcade, screen);
        await press(arcade, screen, name, target);
        await expect.poll(() => effect(arcade, screen), { message: where }).not.toEqual(before);
        // Give anything else the press might set off time to happen, then read what it did.
        await arcade.page.waitForTimeout(300);
        outcomes[scale][name] = await effect(arcade, screen);
        // Nothing a press does changes the render scale.
        expect(await arcade.layout(), where).toMatchObject({ renderScale: scale, canvasPixels });
      }
    }

    const full = placed[1]!;
    const half = placed[0.5]!;
    expect(Object.keys(half), screen).toEqual(Object.keys(full));
    for (const [name, target] of Object.entries(full)) {
      const other = half[name]!;
      const where = `${screen}/${name}: full ${JSON.stringify(target)}, half ${JSON.stringify(other)}`;
      expect(near(other.x, target.x) && near(other.y, target.y), where).toBe(true);
      for (const side of ['x', 'y', 'width', 'height'] as const) {
        expect(near(other.rect[side], target.rect[side]), where).toBe(true);
      }
    }
    expect(outcomes[0.5], screen).toEqual(outcomes[1]);
  }
});

test('at render scale 0.5 four touches in four Zones of the Touch Check count one tap each, where they landed', async ({
  arcade,
}) => {
  await show(arcade, 0.5, 'touch-check');
  // A point well away from each Zone's middle, in the Zone's own coordinates, so a touch that
  // landed anywhere else in the Zone would be told apart.
  const local = { x: 120, y: 160 };
  const zones = ((await arcade.snapshot()).state as { zones: ZoneState[] }).zones;
  const points = await Promise.all(
    zones.map(({ rect, facing }) =>
      arcade.toPage(
        facing === 0
          ? { x: rect.x + local.x, y: rect.y + local.y }
          : { x: rect.x + rect.width - local.x, y: rect.y + rect.height - local.y },
      ),
    ),
  );
  await arcade.touch('touchStart', points);
  await arcade.touch('touchEnd', []);
  await expect
    .poll(async () => ((await arcade.snapshot()).state as { zones: ZoneState[] }).zones)
    .toMatchObject([{ taps: 1 }, { taps: 1 }, { taps: 1 }, { taps: 1 }]);
  // Within two CSS pixels, which are four design units at this scale.
  for (const zone of ((await arcade.snapshot()).state as { zones: ZoneState[] }).zones) {
    expect(Math.abs(zone.lastTouch!.x - local.x), `Zone ${JSON.stringify(zone)}`).toBeLessThan(4);
    expect(Math.abs(zone.lastTouch!.y - local.y), `Zone ${JSON.stringify(zone)}`).toBeLessThan(4);
  }
});
