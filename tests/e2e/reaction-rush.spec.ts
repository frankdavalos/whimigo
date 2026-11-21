import type { Difficulty, Rect, SeatIndex, Seating } from '../../src/contract';
import { DECOYS, SIGNAL } from '../../src/games/reaction-rush/pictures';
import { expect, test, type Arcade, type Point } from './arcade';
import { CATALOG, openSession, playToResult, sessionFor } from './play';

/**
 * Reaction Rush (stories 20, 21 and 35). Touches with more than one finger are sent through the
 * Chromium DevTools protocol, so every test here but the smoke test runs in Chromium only.
 */

const GAME = CATALOG.find((game) => game.id === 'reaction-rush')!;
const STYLE = GAME.playStyles.find((style) => style.style === 'simultaneous')!;
const SEATINGS: readonly Seating[] = ['side-by-side', 'around-the-table'];
const SEATS = [2, 3, 4] as const;
/** Rounding between canvas pixels and CSS pixels, in CSS pixels. */
const EPSILON = 0.75;
/**
 * A seed whose first points' signals come soon (1523 and 1623 ms on Easy). Round time adds up
 * Phaser's frame deltas, and a software-rendered page under load draws few frames, so a short
 * wait saves a long one.
 */
const SOON = 7;
/** Long enough for any wait in the stated range while Round time moves slowly. */
const UNTIL = { timeout: 90_000 };

interface Rush {
  phase: 'waiting' | 'signal' | 'between' | 'over';
  point: number;
  showing: string | null;
  winners: number[];
  seats: { seat: number; score: number; out: boolean; lamp: Point }[];
}
type RoundPage = NonNullable<Awaited<ReturnType<Arcade['round']>>>;
const rush = async (arcade: Arcade) => (await arcade.round())!.state as Rush;

async function open(
  arcade: Arcade,
  seats: number,
  seating: Seating = 'side-by-side',
  difficulty: Difficulty = 'easy',
  seed = SOON,
) {
  await openSession(arcade, sessionFor(GAME, STYLE, seating, seats, difficulty), seed);
}

async function untilPhase(arcade: Arcade, phase: Rush['phase']) {
  await expect.poll(async () => (await rush(arcade)).phase, UNTIL).toBe(phase);
}

const inside = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x - EPSILON &&
  inner.y >= outer.y - EPSILON &&
  inner.x + inner.width <= outer.x + outer.width + EPSILON &&
  inner.y + inner.height <= outer.y + outer.height + EPSILON;

/** A point well inside a Seat's Zone, away from its button, on the page. */
const besideButton = (round: RoundPage, seat: number): Point => {
  const zone = round.zones.find((z) => z.seat === seat)!;
  return { x: zone.x + zone.width * 0.12, y: zone.y + zone.height / 2 };
};
const button = (round: RoundPage, seat: number): Point => round.targets[`button-${seat}`]!;

/** SeatZones' reports since `from` of them. */
const reportsSince = async (arcade: Arcade, from: number) =>
  (await arcade.round())!.seatTouches.events.slice(from);

test.beforeEach(async ({ arcade }) => {
  await arcade.open();
  await arcade.start();
});

test('Reaction Rush is on the Home Screen after Color Echo, and two Players play a Round to a Result through the lobby @smoke', async ({
  arcade,
}) => {
  test.slow();
  const ids = CATALOG.map((game) => game.id);
  expect(ids.indexOf('reaction-rush')).toBe(ids.indexOf('color-echo') + 1);

  await arcade.tap('reaction-rush');
  await expect.poll(() => arcade.screen()).toBe('lobby');
  await arcade.tap('mascot-fox');
  await arcade.tap('mascot-owl');
  await arcade.tap('start');
  await expect.poll(() => arcade.screen()).toBe('reaction-rush');
  await arcade.skipDemo();
  expect((await arcade.round())!.session).toMatchObject({
    playStyle: 'simultaneous',
    zoned: true,
    seats: [{ index: 0 }, { index: 1 }],
  });
  await playToResult(arcade, GAME.id);
  await expect.poll(() => arcade.screen()).toBe('result');
  expect((await arcade.snapshot()).state).toMatchObject({
    result: { kind: 'win', winners: [0], scores: { 0: 3, 1: 0 } },
    celebrated: ['fox'],
  });
});

for (const seating of SEATINGS) {
  for (const seats of SEATS) {
    test(`${seats} Seats ${seating}: one Zone and exactly one button target per Seat, the button inside its own Zone, the Zones inside the safe rectangle (stories 20 and 35)`, async ({
      arcade,
    }) => {
      await open(arcade, seats, seating);
      const round = (await arcade.round())!;
      const { safe } = await arcade.layout();
      expect(round.zones.map((zone) => zone.seat)).toEqual([0, 1, 2, 3].slice(0, seats));
      const facings = round.zones.map((zone) => zone.facing);
      expect(facings).toEqual(
        seating === 'side-by-side'
          ? facings.map(() => 0)
          : { 2: [0, 180], 3: [0, 0, 180], 4: [0, 0, 180, 180] }[seats],
      );
      const buttons = Object.keys(round.targets).filter((name) => name.startsWith('button-'));
      expect(buttons.sort()).toEqual(round.zones.map((zone) => `button-${zone.seat}`));
      for (const zone of round.zones) {
        expect(inside(safe!, zone), `Zone ${zone.seat} inside the safe rectangle`).toBe(true);
        const { rect } = round.targets[`button-${zone.seat}`]!;
        expect(inside(zone, rect), `button ${zone.seat} inside its Zone`).toBe(true);
      }
    });

    test(`${seats} Seats ${seating}: plays to a Result`, async ({ arcade }) => {
      test.slow();
      await open(arcade, seats, seating);
      await playToResult(arcade, GAME.id);
      await expect.poll(() => arcade.screen()).toBe('result');
    });
  }
}

test('an unzoned Session’s Round offers no Zones (story 35)', async ({ arcade }) => {
  for (const game of CATALOG) {
    for (const style of game.playStyles.filter((option) => !option.zoned)) {
      await openSession(arcade, sessionFor(game, style), 1);
      expect((await arcade.round())!.zones, `${game.id} ${style.style}`).toEqual([]);
      await arcade.hold('pause', 900);
      await expect.poll(() => arcade.screen()).toBe('pause');
      await arcade.tap('home');
      await expect.poll(() => arcade.screen()).toBe('home');
    }
  }
});

test('content placed at one Zone-local point is at the same place relative to its Player in a Zone facing 0° and in one facing 180° (story 35)', async ({
  arcade,
}) => {
  await open(arcade, 2, 'around-the-table');
  const round = (await arcade.round())!;
  /** A point on the page in a Zone's own coordinates, as a fraction of its size. */
  const local = (seat: number, at: Point) => {
    const zone = round.zones.find((z) => z.seat === seat)!;
    const across = (at.x - zone.x) / zone.width;
    const down = (at.y - zone.y) / zone.height;
    return zone.facing === 0 ? { across, down } : { across: 1 - across, down: 1 - down };
  };
  const lamps = await Promise.all(
    (round.state as Rush).seats.map(({ lamp }) => arcade.toPage(lamp)),
  );
  const [near, far] = [0, 1].map((seat) => ({
    facing: round.zones[seat]!.facing,
    button: local(seat, button(round, seat)),
    lamp: local(seat, lamps[seat]!),
  }));
  expect([near!.facing, far!.facing]).toEqual([0, 180]);
  expect(far!.button.across).toBeCloseTo(near!.button.across, 3);
  expect(far!.button.down).toBeCloseTo(near!.button.down, 3);
  expect(far!.lamp.across).toBeCloseTo(near!.lamp.across, 3);
  expect(far!.lamp.down).toBeCloseTo(near!.lamp.down, 3);
  // The lamp stands further from its Player than the button, in both.
  for (const seat of [near!, far!]) expect(seat.lamp.down).toBeLessThan(seat.button.down);
});

test('the signal’s picture and its sound are requested in the same frame (story 20)', async ({
  arcade,
}) => {
  test.slow();
  await open(arcade, 2, 'side-by-side', 'medium');
  const frames = await arcade.page.evaluate(
    (signal) =>
      new Promise<{ time: number; signals: number; sounds: { key: string; time: number }[] }[]>(
        (resolve) => {
          const seen: { time: number; signals: number; sounds: { key: string; time: number }[] }[] =
            [];
          const look = () => {
            const bridge = window.whimigo!;
            const round = bridge.round()!;
            const signals = bridge.pictures().images.filter(({ frame }) => frame === signal).length;
            seen.push({ time: round.time, signals, sounds: [...bridge.sounds()] });
            if (signals > 0) resolve(seen);
            else requestAnimationFrame(look);
          };
          requestAnimationFrame(look);
        },
      ),
    SIGNAL.frame,
  );
  const [was, is] = frames.slice(-2);
  expect(is!.signals, 'shown in every Seat’s lamp').toBe(2);
  const added = is!.sounds.slice(was!.sounds.length);
  expect(added.map(({ key }) => key)).toEqual(['reaction-rush/signal']);
  expect(added[0]!.time, 'requested in the frame the signal shows').toBe(is!.time);
  expect(was!.sounds.filter(({ key }) => key === 'reaction-rush/signal')).toEqual([]);
});

test.describe('fingers in Zones (stories 20 and 9)', () => {
  test('four fingers down in one touch event, one in each Zone, register exactly one press for each Seat, and all four score', async ({
    arcade,
  }) => {
    test.slow();
    await open(arcade, 4, 'around-the-table');
    await untilPhase(arcade, 'signal');
    const round = (await arcade.round())!;
    const from = round.seatTouches.events.length;
    await arcade.touch(
      'touchStart',
      [0, 1, 2, 3].map((seat) => button(round, seat)),
    );
    expect(await reportsSince(arcade, from)).toEqual(
      [0, 1, 2, 3].map((seat) => ({ kind: 'down', seat })),
    );
    expect((await arcade.round())!.seatTouches.held).toEqual([0, 1, 2, 3]);
    await untilPhase(arcade, 'between');
    const decided = await rush(arcade);
    expect(decided.winners).toEqual([0, 1, 2, 3]);
    expect(decided.seats.map((seat) => seat.score)).toEqual([1, 1, 1, 1]);
    await arcade.touch('touchEnd', []);
    expect((await reportsSince(arcade, from)).slice(4).map(({ kind }) => kind)).toEqual([
      'up',
      'up',
      'up',
      'up',
    ]);
  });

  test('a second finger in a Zone is ignored, and a finger that slides into a neighbour’s Zone stays with the Seat it began in', async ({
    arcade,
  }) => {
    await open(arcade, 2, 'side-by-side');
    const round = (await arcade.round())!;
    const from = round.seatTouches.events.length;
    const [first, second] = [besideButton(round, 0), button(round, 0)];
    await arcade.touch('touchStart', [first]);
    await arcade.touch('touchStart', [first, second]);
    expect(await reportsSince(arcade, from)).toEqual([{ kind: 'down', seat: 0 }]);
    await arcade.touch('touchEnd', []);
    expect(await reportsSince(arcade, from)).toEqual([
      { kind: 'down', seat: 0 },
      { kind: 'up', seat: 0 },
    ]);

    // Into the neighbour's Zone, where a finger of its own then lands and is its Seat's.
    const next = (await arcade.round())!.seatTouches.events.length;
    const neighbour = besideButton(round, 1);
    await arcade.touch('touchStart', [first]);
    await arcade.touch('touchMove', [neighbour]);
    await arcade.touch('touchStart', [neighbour, button(round, 1)]);
    expect([...(await arcade.round())!.seatTouches.held].sort()).toEqual([0, 1]);
    await arcade.touch('touchEnd', []);
    // The only touch of Seat 0's is the finger that slid: it lifts as Seat 0's.
    const reported = await reportsSince(arcade, next);
    expect(reported.slice(0, 2)).toEqual([
      { kind: 'down', seat: 0 },
      { kind: 'down', seat: 1 },
    ]);
    expect(
      reported
        .slice(2)
        .map(({ kind, seat }) => `${kind} ${seat}`)
        .sort(),
    ).toEqual(['up 0', 'up 1']);
  });

  test('a touch the system takes away is reported as cancelled, never as an ordinary release', async ({
    arcade,
  }) => {
    await open(arcade, 3, 'around-the-table');
    const round = (await arcade.round())!;
    const from = round.seatTouches.events.length;
    await arcade.touch('touchStart', [besideButton(round, 2)]);
    await arcade.touch('touchCancel', []);
    expect(await reportsSince(arcade, from)).toEqual([
      { kind: 'down', seat: 2 },
      { kind: 'cancel', seat: 2 },
    ]);
    expect((await arcade.round())!.seatTouches.held).toEqual([]);
  });

  test('touches down when the page was hidden are forgotten: on return no Seat holds one, and a new touch in each Zone is accepted', async ({
    arcade,
  }) => {
    await open(arcade, 4, 'around-the-table');
    const round = (await arcade.round())!;
    const points = [0, 1, 2, 3].map((seat) => besideButton(round, seat));
    await arcade.touch('touchStart', points);
    expect((await arcade.round())!.seatTouches.held).toEqual([0, 1, 2, 3]);

    await arcade.hideAndShow();
    await expect.poll(() => arcade.screen()).toBe('pause');
    expect((await arcade.round())!.seatTouches.held).toEqual([]);
    await arcade.touch('touchEnd', []);
    await arcade.tap('play');
    await expect.poll(() => arcade.screen()).toBe(GAME.id);

    const from = (await arcade.round())!.seatTouches.events.length;
    expect(from, 'the stale touches lifting were not reported').toBe(4);
    await arcade.touch('touchStart', points);
    expect(await reportsSince(arcade, from)).toEqual(
      [0, 1, 2, 3].map((seat) => ({ kind: 'down', seat: seat as SeatIndex })),
    );
    await arcade.touch('touchEnd', []);
  });
});

test.describe('the Demo (story 21)', () => {
  test('on Easy it shows only the signal and presses a button', async ({ arcade }) => {
    await arcade.call('open', sessionFor(GAME, STYLE, 'side-by-side', 2, 'easy'), 2);
    await expect.poll(async () => (await arcade.round())?.demo.playing).toBe(true);
    const round = (await arcade.round())!;
    expect(round.demo.steps.some((step) => 'refuse' in step)).toBe(false);
    const { images } = await arcade.call('pictures');
    for (const decoy of DECOYS) expect(images.map(({ frame }) => frame)).not.toContain(decoy.frame);
  });

  for (const difficulty of ['medium', 'hard'] as const) {
    test(`on ${difficulty} it points at a decoy and refuses it`, async ({ arcade }) => {
      await arcade.call('open', sessionFor(GAME, STYLE, 'side-by-side', 2, difficulty), 2);
      await expect.poll(async () => (await arcade.round())?.demo.playing).toBe(true);
      const round = (await arcade.round())!;
      const refusal = round.demo.steps.find((step) => 'refuse' in step);
      expect(refusal, 'a step that refuses').toBeDefined();
      const lamp = await arcade.toPage((round.state as Rush).seats[0]!.lamp);
      const point = (refusal as { refuse: Point }).refuse;
      expect(point.x).toBeCloseTo(lamp.x, 0);
      expect(point.y).toBeCloseTo(lamp.y, 0);
      const frames = (await arcade.call('pictures')).images.map(({ frame }) => frame);
      expect(
        frames.filter((frame) => frame === DECOYS[0].frame),
        'the decoy in that lamp',
      ).toHaveLength(1);
      expect(
        frames.filter((frame) => frame === SIGNAL.frame),
        'the signal in the other',
      ).toHaveLength(1);
    });
  }

  test('replayed from the pause screen, it shows the decoy it refuses again', async ({
    arcade,
  }) => {
    await open(arcade, 2, 'side-by-side', 'medium');
    const decoysDrawn = async () =>
      (await arcade.call('pictures')).images.filter(({ frame }) => frame === DECOYS[0].frame)
        .length;
    await arcade.hold('pause', 900);
    await expect.poll(() => arcade.screen()).toBe('pause');
    await arcade.tap('demo');
    await expect.poll(async () => (await arcade.round())!.demo.playing).toBe(true);
    await expect.poll(() => arcade.screen()).toBe(GAME.id);
    expect(await decoysDrawn()).toBe(1);
    await expect.poll(async () => (await arcade.round())!.demo.playing, UNTIL).toBe(false);
    // Every lamp shows the Round's own picture again, the same in both.
    expect([0, 2]).toContain(await decoysDrawn());
  });
});
