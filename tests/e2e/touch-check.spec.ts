import type { Rect } from '../../src/contract';
import { seats } from '../../src/kit/theme';
import { type Arcade, DESIGN_WIDTH, type Point, expect, test } from './arcade';

/**
 * The Touch Check (stories 16 and 17). Touches with more than one finger are sent through the
 * Chromium DevTools protocol, so every test here but the smoke test runs in Chromium only.
 */

const TOUCH = 'touch-check';
const FULL_HOLD_MS = 1000;

interface Drawn {
  x: number;
  y: number;
  angle: number;
}
interface ZoneState {
  seat: number;
  rect: Rect;
  facing: 0 | 180;
  held: boolean;
  taps: number;
  lastTouch: Point | null;
  badge: Drawn & { frame: string };
  counter: Drawn & { text: string };
}
interface TouchState {
  seating: 'side-by-side' | 'around-the-table';
  count: number;
  highest: number;
  cancellations: number;
  drawn: { count: string; highest: string; cancellations: string };
  live: { slot: number; x: number; y: number; marker: Point & { text: string } }[];
  zones: ZoneState[];
}

const state = async (arcade: Arcade) => (await arcade.snapshot()).state as TouchState;
const taps = async (arcade: Arcade) => (await state(arcade)).zones.map((zone) => zone.taps);
const right = (rect: Rect) => rect.x + rect.width;
const bottom = (rect: Rect) => rect.y + rect.height;

/** Points in the Zones, given in each Zone's own coordinates, converted to the page. */
async function zonePoints(arcade: Arcade) {
  const [{ zones }, { frame }] = await Promise.all([state(arcade), arcade.layout()]);
  const unit = frame.width / DESIGN_WIDTH;
  return (seat: number, local: Point = { x: 120, y: 160 }): Point => {
    const { rect, facing } = zones[seat]!;
    const design =
      facing === 0
        ? { x: rect.x + local.x, y: rect.y + local.y }
        : { x: right(rect) - local.x, y: bottom(rect) - local.y };
    return { x: frame.x + design.x * unit, y: frame.y + design.y * unit };
  };
}

/** A point inside a Zone, given in that Zone's own coordinates, on the page. */
async function inZone(arcade: Arcade, seat: number, local?: Point) {
  return (await zonePoints(arcade))(seat, local);
}

/** `count` points spread over the Zones, clear of every control, on the page. */
async function spread(arcade: Arcade, count: number): Promise<Point[]> {
  const at = await zonePoints(arcade);
  return Array.from({ length: count }, (_, i) =>
    at(i % 4, { x: 120 + Math.floor(i / 4) * 140, y: 160 }),
  );
}

test.beforeEach(async ({ arcade }) => {
  await arcade.open();
  await arcade.call('openCheck', TOUCH);
  await expect.poll(() => arcade.screen()).toBe(TOUCH);
});

test('the Touch Check opens from the Home Screen and counts a tap in a Zone @smoke', async ({
  arcade,
  page,
}) => {
  // Single touches only: WebKit has no DevTools protocol to send several.
  await arcade.open();
  await arcade.start();
  await arcade.openCheck(TOUCH);
  await expect.poll(() => arcade.screen()).toBe(TOUCH);
  expect((await state(arcade)).zones).toHaveLength(4);

  const { x, y } = await inZone(arcade, 2);
  await page.touchscreen.tap(x, y);
  await expect.poll(() => taps(arcade)).toEqual([0, 0, 1, 0]);
});

test.describe('every finger the tablet is tracking (story 16)', () => {
  test('every live touch has a marker showing its slot number, at its position in design units', async ({
    arcade,
  }) => {
    const points = await spread(arcade, 3);
    await arcade.touch('touchStart', points);
    const { live, count } = await state(arcade);
    expect(count).toBe(3);
    expect(live.map((touch) => touch.slot).sort()).toEqual([1, 2, 3]);
    for (const [i, touch] of live.entries()) {
      const onPage = await arcade.toPage(touch);
      expect(onPage.x).toBeCloseTo(points[i]!.x, 0);
      expect(onPage.y).toBeCloseTo(points[i]!.y, 0);
      expect(touch.marker).toEqual({ x: touch.x, y: touch.y, text: String(touch.slot) });
    }
    await arcade.touch('touchEnd', []);
    await expect.poll(async () => (await state(arcade)).live).toEqual([]);
  });

  test('for one to ten touches in one event, the count is the number sent and the highest the most so far', async ({
    arcade,
  }) => {
    const points = await spread(arcade, 10);
    let most = 0;
    for (const sent of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 4]) {
      most = Math.max(most, sent);
      await arcade.touch('touchStart', points.slice(0, sent));
      const down = await state(arcade);
      expect(down.count, `${sent} down`).toBe(sent);
      expect(down.highest).toBe(most);
      expect(down.drawn).toMatchObject({ count: String(sent), highest: String(most) });

      await arcade.touch('touchEnd', []);
      const lifted = await state(arcade);
      expect(lifted.count, `${sent} lifted`).toBe(0);
      expect(lifted.highest).toBe(most);
      expect(lifted.drawn).toMatchObject({ count: '0', highest: String(most) });
    }
  });

  test('an eleventh touch is ignored, and a tap sent afterwards is still counted', async ({
    arcade,
  }) => {
    await arcade.touch('touchStart', await spread(arcade, 11));
    const down = await state(arcade);
    expect(down.count).toBe(10);
    expect(down.highest).toBe(10);
    expect(down.live.map((touch) => touch.slot).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    await arcade.touch('touchEnd', []);
    await expect.poll(async () => (await state(arcade)).count).toBe(0);
    const before = await taps(arcade);

    await arcade.touch('touchStart', [await inZone(arcade, 1)]);
    await arcade.touch('touchEnd', []);
    await expect
      .poll(() => taps(arcade))
      .toEqual([before[0], before[1]! + 1, before[2], before[3]]);
  });

  test('a cancelled touch raises the cancellation count, removes its marker and counts for no Zone', async ({
    arcade,
  }) => {
    await arcade.touch('touchStart', [await inZone(arcade, 0)]);
    expect((await state(arcade)).zones[0]!.held).toBe(true);
    await arcade.touch('touchCancel', []);
    const after = await state(arcade);
    expect(after.cancellations).toBe(1);
    expect(after.drawn.cancellations).toBe('1');
    expect(after.live).toEqual([]);
    expect(after.zones.map((zone) => [zone.taps, zone.held])).toEqual([
      [0, false],
      [0, false],
      [0, false],
      [0, false],
    ]);
  });

  test('a short tap on reset does nothing; a full hold zeroes the highest count, cancellations and every Zone', async ({
    arcade,
    page,
  }) => {
    await arcade.touch('touchStart', await spread(arcade, 4));
    await arcade.touch('touchEnd', []);
    await arcade.touch('touchStart', [await inZone(arcade, 0)]);
    await arcade.touch('touchCancel', []);
    const used = await state(arcade);
    expect(used).toMatchObject({ highest: 4, cancellations: 1 });
    expect(used.zones.map((zone) => zone.taps)).toEqual([1, 1, 1, 1]);

    await arcade.tap('reset');
    await arcade.brush('reset');
    await page.waitForTimeout(800);
    expect(await state(arcade)).toMatchObject({ highest: 4, cancellations: 1 });
    expect(await taps(arcade)).toEqual([1, 1, 1, 1]);

    await arcade.hold('reset', FULL_HOLD_MS);
    const reset = await state(arcade);
    expect(reset).toMatchObject({ highest: 0, cancellations: 0, count: 0 });
    expect(reset.drawn).toEqual({ count: '0', highest: '0', cancellations: '0' });
    expect(reset.zones.map((zone) => [zone.taps, zone.counter.text])).toEqual([
      [0, '0'],
      [0, '0'],
      [0, '0'],
      [0, '0'],
    ]);
    expect(await arcade.screen()).toBe(TOUCH);
  });

  test('after the page is hidden and shown again, the live touch count is zero', async ({
    arcade,
  }) => {
    await arcade.touch('touchStart', await spread(arcade, 4));
    expect((await state(arcade)).count).toBe(4);
    await arcade.hideAndShow();
    const shown = await state(arcade);
    expect(shown.count).toBe(0);
    expect(shown.live).toEqual([]);
    expect(shown.drawn.count).toBe('0');
    expect(shown.zones.every((zone) => !zone.held)).toBe(true);

    // The stale touches lifting later count for nothing, and new ones are tracked as usual.
    await arcade.touch('touchEnd', []);
    expect(await taps(arcade)).toEqual([0, 0, 0, 0]);
    await arcade.touch('touchStart', await spread(arcade, 2));
    expect((await state(arcade)).count).toBe(2);
    await arcade.touch('touchEnd', []);
    await expect.poll(() => taps(arcade)).toEqual([1, 1, 0, 0]);
  });
});

test.describe('four Zones in either Seating (story 17)', () => {
  test('the Seating control switches Seatings, and the Zones take the documented positions and facings', async ({
    arcade,
  }) => {
    const { safe, frame } = await arcade.layout();
    const unit = frame.width / DESIGN_WIDTH;
    const controls = Object.values((await arcade.snapshot()).targets).map((target) => target.rect);

    const check = async (expected: TouchState['seating']) => {
      const { seating, zones } = await state(arcade);
      expect(seating).toBe(expected);
      expect(zones.map((zone) => zone.seat)).toEqual([0, 1, 2, 3]);
      const rects = zones.map((zone) => zone.rect);
      const area = {
        x: Math.min(...rects.map((rect) => rect.x)),
        y: Math.min(...rects.map((rect) => rect.y)),
        right: Math.max(...rects.map(right)),
        bottom: Math.max(...rects.map(bottom)),
      };
      const middle = { x: (area.x + area.right) / 2, y: (area.y + area.bottom) / 2 };

      if (seating === 'side-by-side') {
        expect(zones.map((zone) => zone.facing)).toEqual([0, 0, 0, 0]);
        for (const [i, { rect }] of zones.entries()) {
          expect(rect.y).toBe(area.y);
          expect(bottom(rect)).toBe(area.bottom);
          if (i > 0) expect(rect.x).toBeCloseTo(right(zones[i - 1]!.rect));
        }
      } else {
        expect(zones.map((zone) => zone.facing)).toEqual([0, 0, 180, 180]);
        const [bottomLeft, bottomRight, topRight, topLeft] = rects as [Rect, Rect, Rect, Rect];
        for (const rect of [bottomLeft, bottomRight]) expect(rect.y).toBeCloseTo(middle.y);
        for (const rect of [topRight, topLeft]) expect(bottom(rect)).toBeCloseTo(middle.y);
        for (const rect of [bottomLeft, topLeft]) expect(right(rect)).toBeCloseTo(middle.x);
        for (const rect of [bottomRight, topRight]) expect(rect.x).toBeCloseTo(middle.x);
      }

      // Inside the safe rectangle, and a control's gap away from every control.
      for (const rect of rects) {
        const onPage = await arcade.toPage(rect);
        const size = { width: rect.width * unit, height: rect.height * unit };
        expect(onPage.x).toBeGreaterThanOrEqual(safe!.x - 0.75);
        expect(onPage.y).toBeGreaterThanOrEqual(safe!.y - 0.75);
        expect(onPage.x + size.width).toBeLessThanOrEqual(safe!.x + safe!.width + 0.75);
        expect(onPage.y + size.height).toBeLessThanOrEqual(safe!.y + safe!.height + 0.75);
        for (const control of controls) {
          const gap = Math.max(
            control.x - (onPage.x + size.width),
            onPage.x - (control.x + control.width),
            control.y - (onPage.y + size.height),
            onPage.y - (control.y + control.height),
          );
          expect(gap / unit).toBeGreaterThanOrEqual(63);
        }
      }
    };

    await check('around-the-table');
    await arcade.tap('seating');
    await expect.poll(async () => (await state(arcade)).seating).toBe('side-by-side');
    await check('side-by-side');
    await arcade.tap('seating');
    await expect.poll(async () => (await state(arcade)).seating).toBe('around-the-table');
    await check('around-the-table');
  });

  for (const seating of ['around-the-table', 'side-by-side'] as const) {
    test(`${seating}: four touches in one event hold all four Zones, and each counts one tap as they lift`, async ({
      arcade,
    }) => {
      if (seating === 'side-by-side') {
        await arcade.tap('seating');
        await expect.poll(async () => (await state(arcade)).seating).toBe(seating);
      }
      await arcade.touch('touchStart', await spread(arcade, 4));
      const down = await state(arcade);
      expect(down.zones.map((zone) => zone.held)).toEqual([true, true, true, true]);
      expect(down.zones.map((zone) => zone.taps)).toEqual([0, 0, 0, 0]);
      await arcade.touch('touchEnd', []);
      const lifted = await state(arcade);
      expect(lifted.zones.map((zone) => zone.held)).toEqual([false, false, false, false]);
      expect(lifted.zones.map((zone) => [zone.taps, zone.counter.text])).toEqual([
        [1, '1'],
        [1, '1'],
        [1, '1'],
        [1, '1'],
      ]);
    });
  }

  test('a second touch in a Zone that already has one is not counted', async ({ arcade }) => {
    const first = await inZone(arcade, 3);
    const second = await inZone(arcade, 3, { x: 400, y: 500 });
    await arcade.touch('touchStart', [first]);
    await arcade.touch('touchStart', [first, second]);
    expect((await state(arcade)).count).toBe(2);
    await arcade.touch('touchEnd', []);
    expect(await taps(arcade)).toEqual([0, 0, 0, 1]);
  });

  test('a touch that slides into a neighbouring Zone counts for the Zone it started in', async ({
    arcade,
  }) => {
    await arcade.touch('touchStart', [await inZone(arcade, 0)]);
    for (const local of [
      { x: 300, y: 160 },
      { x: 600, y: 160 },
    ]) {
      await arcade.touch('touchMove', [await inZone(arcade, 0, local)]);
    }
    await arcade.touch('touchMove', [await inZone(arcade, 1)]);
    const moved = await state(arcade);
    expect(moved.zones.map((zone) => zone.held)).toEqual([true, false, false, false]);
    await arcade.touch('touchEnd', []);
    expect(await taps(arcade)).toEqual([1, 0, 0, 0]);
  });

  test('a touch that starts outside every Zone counts for none', async ({ arcade }) => {
    const { zones } = await state(arcade);
    // Between the control column and the Zones, halfway down.
    const outside = await arcade.toPage({
      x: Math.min(...zones.map((zone) => zone.rect.x)) - 32,
      y: 1032,
    });
    await arcade.touch('touchStart', [outside]);
    expect((await state(arcade)).count).toBe(1);
    await arcade.touch('touchMove', [await inZone(arcade, 0)]);
    await arcade.touch('touchEnd', []);
    expect(await taps(arcade)).toEqual([0, 0, 0, 0]);
  });

  test('around the table, the same place relative to its Player gives the same Zone-local coordinates at 0° and 180°', async ({
    arcade,
  }) => {
    const place = { x: 200, y: 600 };
    for (const seat of [0, 3]) {
      await arcade.touch('touchStart', [await inZone(arcade, seat, place)]);
      await arcade.touch('touchEnd', []);
    }
    const { zones } = await state(arcade);
    expect([zones[0]!.facing, zones[3]!.facing]).toEqual([0, 180]);
    // Within the rounding of a touch to the CSS pixel, which is under three design units.
    for (const seat of [0, 3]) {
      expect(Math.abs(zones[seat]!.lastTouch!.x - place.x)).toBeLessThan(3);
      expect(Math.abs(zones[seat]!.lastTouch!.y - place.y)).toBeLessThan(3);
    }
  });

  /** Story 17 AC8 also asks for each Zone's counter to sit beside its Seat's colour (#10). */
  test('each Zone is drawn in its Seat’s colour, in either Seating', async ({ arcade }) => {
    for (const seating of ['around-the-table', 'side-by-side']) {
      if (seating === 'side-by-side') {
        await arcade.tap('seating');
        await expect.poll(async () => (await state(arcade)).seating).toBe(seating);
      }
      // The snapshot reports the colour each Zone is filled with.
      const { zones } = (await arcade.snapshot()).state as {
        zones: (ZoneState & { fill?: { color: number } })[];
      };
      expect(zones.map((zone) => zone.fill?.color)).toEqual(
        zones.map((zone) => seats[zone.seat]!.color),
      );
      expect(new Set(zones.map((zone) => zone.fill?.color)).size).toBe(4);
    }
  });

  test('each Zone’s counter is drawn in bitmap digits inside the Zone, turned to its facing, beside its Seat’s shape', async ({
    arcade,
  }) => {
    const shapes = [
      'arcade/seat-circle',
      'arcade/seat-square',
      'arcade/seat-triangle',
      'arcade/seat-star',
    ];
    for (const seating of ['around-the-table', 'side-by-side']) {
      if (seating === 'side-by-side') {
        await arcade.tap('seating');
        await expect.poll(async () => (await state(arcade)).seating).toBe(seating);
      }
      await arcade.touch('touchStart', await spread(arcade, 4));
      await arcade.touch('touchEnd', []);
      const { zones } = await state(arcade);
      for (const zone of zones) {
        const inside = (point: Point) =>
          point.x > zone.rect.x &&
          point.x < right(zone.rect) &&
          point.y > zone.rect.y &&
          point.y < bottom(zone.rect);
        expect(zone.counter.text).toBe(String(zone.taps));
        expect(inside(zone.counter), `Seat ${zone.seat}'s counter`).toBe(true);
        expect(zone.counter.angle).toBe(zone.facing);
        expect(zone.badge.frame).toBe(shapes[zone.seat]);
        expect(inside(zone.badge), `Seat ${zone.seat}'s shape`).toBe(true);
        expect(zone.badge.angle).toBe(zone.facing);
        expect(
          Math.hypot(zone.badge.x - zone.counter.x, zone.badge.y - zone.counter.y),
        ).toBeLessThan(400);
      }
      const { images } = await arcade.call('pictures');
      for (const frame of shapes) expect(images).toContainEqual({ texture: 'arcade', frame });
    }
  });
});
