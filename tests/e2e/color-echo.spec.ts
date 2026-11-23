import type { Difficulty, Rect, Seating } from '../../src/contract';
import { MASCOTS } from '../../src/arcade/mascots';
import { startTogether, TARGET } from '../../src/games/color-echo/logic/together';
import { createRng } from '../../src/kit/rng';
import { expect, test, type Arcade } from './arcade';
import { CATALOG, openSession, playToResult, sessionFor } from './play';

const GAME = CATALOG.find((game) => game.id === 'color-echo')!;
const SOLO = GAME.playStyles.find((style) => style.style === 'solo')!;
const TURN_BASED = GAME.playStyles.find((style) => style.style === 'turn-based')!;
const COOPERATIVE = GAME.playStyles.find((style) => style.style === 'cooperative')!;

interface Echo {
  phase: 'playing' | 'repeating' | 'over';
  length: number;
  entered: number;
  completed: number;
  pads: string[];
  sequence: number[];
}
const echo = async (arcade: Arcade) => (await arcade.round())!.state as Echo;

async function open(arcade: Arcade, difficulty: Difficulty = 'easy', seed = 2) {
  await openSession(arcade, sessionFor(GAME, SOLO, 'side-by-side', undefined, difficulty), seed);
}

async function untilRepeating(arcade: Arcade) {
  // Round time moves slowly while a software-rendered page draws few frames.
  await expect.poll(async () => (await echo(arcade)).phase, { timeout: 60_000 }).toBe('repeating');
}

/** Presses the pad the sequence asks for next. */
async function pressNext(arcade: Arcade) {
  const state = await echo(arcade);
  await arcade.tapRound(`pad-${state.pads[state.sequence[state.entered]!]}`);
}

interface Frame {
  time: number;
  lit: string[];
  sounds: { key: string; time: number }[];
}

/**
 * Watches the Round frame by frame, from inside the page: the Round's Scene time, the pads drawn
 * lit, and the sounds requested so far. It watches until the Player may repeat the sequence, or,
 * with `press`, until a pad has been pressed and has gone dark again. The page's body is marked
 * once the first frame is seen, so a test can press only once the watch has begun.
 */
function watch(arcade: Arcade, press = false) {
  return arcade.page.evaluate(
    (press) =>
      new Promise<Frame[]>((resolve) => {
        const frames: Frame[] = [];
        let entered: number | null = null;
        const look = () => {
          const bridge = window.whimigo!;
          const round = bridge.round()!;
          const state = round.state as { phase: string; entered: number };
          entered ??= state.entered;
          const lit = bridge
            .pictures()
            .images.map(({ frame }) => frame)
            .filter((frame) => frame.endsWith('-lit'));
          frames.push({ time: round.time, lit, sounds: [...bridge.sounds()] });
          document.body.dataset.watching = 'yes';
          const done = press
            ? state.entered !== entered && lit.length === 0
            : state.phase === 'repeating';
          if (done) {
            delete document.body.dataset.watching;
            resolve(frames);
          } else requestAnimationFrame(look);
        };
        requestAnimationFrame(look);
      }),
    press,
  );
}

test.beforeEach(async ({ arcade }) => {
  await arcade.open();
  await arcade.start();
});

test('Color Echo is on the Home Screen after Tic-Tac-Toe, and a Player plays a Solo Round to a Result through the lobby @smoke', async ({
  arcade,
}) => {
  // A whole Round, in the slow Round time of a software-rendered page.
  test.slow();
  const ids = CATALOG.map((game) => game.id);
  expect(ids.indexOf('color-echo')).toBe(ids.indexOf('tic-tac-toe') + 1);

  await arcade.tap('color-echo');
  await expect.poll(() => arcade.screen()).toBe('lobby');
  await arcade.tap('mascot-fox');
  await arcade.tap('start');
  await expect.poll(() => arcade.screen()).toBe('color-echo');
  await arcade.skipDemo();
  const round = (await arcade.round())!;
  expect(round.session).toMatchObject({ playStyle: 'solo', seats: [{ index: 0 }] });

  await untilRepeating(arcade);
  await pressNext(arcade);
  await expect.poll(async () => (await echo(arcade)).completed).toBe(1);
  await untilRepeating(arcade);
  const { pads, sequence } = await echo(arcade);
  const wrong = pads.findIndex((_, pad) => pad !== sequence[0]);
  await arcade.tapRound(`pad-${pads[wrong]}`);
  await expect.poll(() => arcade.screen()).toBe('result');
  expect((await arcade.snapshot()).state).toMatchObject({
    result: { kind: 'solo', score: 1 },
    celebrated: ['fox'],
  });
});

for (const [difficulty, pads] of [
  ['easy', ['circle', 'square', 'triangle']],
  ['medium', ['circle', 'square', 'triangle', 'star']],
  ['hard', ['circle', 'square', 'triangle', 'star']],
] as const) {
  test(`${difficulty} has ${pads.length} pads, each a named target`, async ({ arcade }) => {
    await open(arcade, difficulty);
    const round = (await arcade.round())!;
    expect((round.state as Echo).pads).toEqual(pads);
    for (const pad of pads) expect(round.targets[`pad-${pad}`], pad).toBeDefined();
    const named = Object.keys(round.targets).filter((name) => name.startsWith('pad-'));
    expect(named).toHaveLength(pads.length);
  });
}

test('on Easy the Arcade plays a one-step sequence, then the Player repeats it and the next one has a step more', async ({
  arcade,
}) => {
  await open(arcade, 'easy');
  expect(await echo(arcade)).toMatchObject({ phase: 'playing', length: 1, completed: 0 });
  await untilRepeating(arcade);
  const played = await echo(arcade);
  expect((await arcade.call('sounds')).map(({ key }) => key)).toEqual([
    `color-echo/tone-${played.pads[played.sequence[0]!]}`,
  ]);
  await pressNext(arcade);
  await expect.poll(async () => (await echo(arcade)).length).toBe(2);
  const next = await echo(arcade);
  expect(next).toMatchObject({ phase: 'playing', completed: 1 });
  expect(next.sequence.slice(0, 1)).toEqual(played.sequence);
});

test('each pad’s tone is requested at the same Scene time as its pad lights, when the Arcade plays and when a Player presses', async ({
  arcade,
}) => {
  await open(arcade, 'medium', 5);
  const frames = await watch(arcade);
  expect((await echo(arcade)).phase).toBe('repeating');

  /**
   * The lights that came on, each checked against the tone asked for with it. The Arcade lights a
   * step in a frame; a press is answered when its touch arrives, which may be between frames, so
   * its Scene time can be the frame before the one that shows it.
   */
  const check = (exact: boolean) => {
    let lights = 0;
    for (let i = 1; i < frames.length; i += 1) {
      const [was, is] = [frames[i - 1]!, frames[i]!];
      for (const frame of is.lit.filter((lit) => !was.lit.includes(lit))) {
        lights += 1;
        const pad = frame.replace('color-echo/pad-', '').replace('-lit', '');
        const sound = is.sounds.at(-1)!;
        expect(sound.key).toBe(`color-echo/tone-${pad}`);
        if (exact) expect(sound.time, 'requested in the frame the pad lit').toBe(is.time);
        else {
          expect(sound.time).toBeGreaterThanOrEqual(was.time);
          expect(sound.time).toBeLessThanOrEqual(is.time);
        }
        expect(was.sounds.length).toBe(is.sounds.length - 1);
      }
    }
    return lights;
  };
  expect(check(true), 'every step of the sequence lit').toBe((await echo(arcade)).length);

  const watching = watch(arcade, true);
  await arcade.page.waitForFunction(() => document.body.dataset.watching === 'yes');
  await pressNext(arcade);
  const pressed = await watching;
  frames.length = 0;
  frames.push(...pressed);
  expect(check(false), 'the pressed pad lit').toBe(1);
});

/** What Color Echo's snapshot says about a Turn-Based Round. */
interface Turns {
  phase: 'playing' | 'repeating' | 'over';
  length: number;
  entered: number;
  toMove: number;
  pads: string[];
  sequence: number[];
  lives: { seat: number; lives: number }[];
  pointer: { seat: number };
}
const turns = async (arcade: Arcade) => (await arcade.round())!.state as Turns;

for (const players of [2, 3, 4]) {
  test(`${players} Players start a Turn-Based Session from Color Echo’s lobby and play it to a Result`, async ({
    arcade,
  }) => {
    // Several Turns, each played by the Arcade first, in the slow Round time of a software-rendered page.
    test.slow();
    await arcade.tap('color-echo');
    await expect.poll(() => arcade.screen()).toBe('lobby');
    for (const mascot of MASCOTS.slice(0, players)) await arcade.tap(`mascot-${mascot}`);
    await arcade.tap('start');
    await expect.poll(() => arcade.screen()).toBe('color-echo');
    await arcade.skipDemo();
    const round = (await arcade.round())!;
    expect(round.session.playStyle).toBe('turn-based');
    expect(round.session.seats).toHaveLength(players);
    expect(await turns(arcade)).toMatchObject({
      toMove: 0,
      lives: Array.from({ length: players }, (_, seat) => ({ seat, lives: 3 })),
    });

    // Every Seat slips every Turn, so the first loses its last life first.
    await playToResult(arcade, 'color-echo');
    await expect.poll(() => arcade.screen()).toBe('result');
    const others = Array.from({ length: players - 1 }, (_, index) => index + 1);
    expect((await arcade.snapshot()).state).toMatchObject({
      result: { kind: 'win', winners: others },
    });
  });
}

for (const seating of ['side-by-side', 'around-the-table'] as const satisfies Seating[]) {
  test(`in Turn-Based, every press counts for the Seat whose Turn it is, and the Turn pointer is at that Seat’s edge, ${seating}`, async ({
    arcade,
  }) => {
    test.slow();
    await openSession(arcade, sessionFor(GAME, TURN_BASED, seating), 2);
    const pointer = async () => (await arcade.round())!.targets['turn-pointer']!;
    const { canvas } = await arcade.layout();
    const middle = { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 };

    await expect
      .poll(async () => (await turns(arcade)).phase, { timeout: 60_000 })
      .toBe('repeating');
    const first = await pointer();
    const before = await turns(arcade);
    expect(before).toMatchObject({ toMove: 0, pointer: { seat: 0 } });
    const wrong = (before.sequence[0]! + 1) % before.pads.length;
    await arcade.tapRound(`pad-${before.pads[wrong]}`);
    await expect.poll(async () => (await turns(arcade)).toMove).toBe(1);
    const after = await turns(arcade);
    expect(after.lives.map(({ lives }) => lives)).toEqual([2, 3]);
    expect(after).toMatchObject({ phase: 'playing', pointer: { seat: 1 } });
    const second = await pointer();

    if (seating === 'side-by-side') {
      expect(first.x).toBeLessThan(middle.x);
      expect(second.x).toBeGreaterThan(middle.x);
      expect(second.y).toBeCloseTo(first.y, 3);
      expect(first.y).toBeGreaterThan(middle.y);
    } else {
      expect(first.y).toBeGreaterThan(middle.y);
      expect(second.y).toBeLessThan(middle.y);
    }

    // The second Seat's right pad counts for it: its one-step Turn ends with no life lost.
    await expect
      .poll(async () => (await turns(arcade)).phase, { timeout: 60_000 })
      .toBe('repeating');
    const { pads, sequence } = await turns(arcade);
    await arcade.tapRound(`pad-${pads[sequence[0]!]}`);
    await expect.poll(async () => (await turns(arcade)).toMove).toBe(0);
    expect((await turns(arcade)).lives.map(({ lives }) => lives)).toEqual([2, 3]);
  });
}

/** What Color Echo's snapshot says about a Cooperative Round. */
interface Together {
  phase: 'playing' | 'repeating' | 'over';
  length: number;
  entered: number;
  completed: number;
  target: number;
  lives: number;
  pads: string[];
  sequence: number[];
  seats: { seat: number; shape: string; color: number; pads: string[] }[];
}
const together = async (arcade: Arcade) => (await arcade.round())!.state as Together;

async function untilTogetherRepeating(arcade: Arcade) {
  await expect
    .poll(async () => (await together(arcade)).phase, { timeout: 60_000 })
    .toBe('repeating');
}

/** The pad the sequence asks for next, by name. */
const asked = (state: Together) => state.pads[state.sequence[state.entered]!]!;

/** How far the group has repeated: changes with every press that counts. */
const progress = ({ length, entered, completed, lives }: Together) =>
  `${length}:${entered}:${completed}:${lives}`;

/** The Seat that owns a pad, by the pad's name. */
const ownerOf = (state: Together, pad: string) =>
  state.seats.find((seat) => seat.pads.includes(pad))!.seat;

/** Rounding between canvas pixels and CSS pixels, in CSS pixels. */
const EPSILON = 0.75;
const inside = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x - EPSILON &&
  inner.y >= outer.y - EPSILON &&
  inner.x + inner.width <= outer.x + outer.width + EPSILON &&
  inner.y + inner.height <= outer.y + outer.height + EPSILON;

for (const seating of ['side-by-side', 'around-the-table'] as const satisfies Seating[]) {
  for (const seats of [2, 3, 4]) {
    test(`in Cooperative with ${seats} Seats ${seating}, every Seat has a Zone holding its own pads, each pad inside its own Seat’s Zone`, async ({
      arcade,
    }) => {
      await openSession(arcade, sessionFor(GAME, COOPERATIVE, seating, seats), 2);
      const round = (await arcade.round())!;
      const state = round.state as Together;
      expect(round.zones.map((zone) => zone.seat)).toEqual([0, 1, 2, 3].slice(0, seats));
      const facings = round.zones.map((zone) => zone.facing);
      expect(facings).toEqual(
        seating === 'side-by-side'
          ? facings.map(() => 0)
          : { 2: [0, 180], 3: [0, 0, 180], 4: [0, 0, 180, 180] }[seats],
      );
      expect(state.seats.map(({ pads }) => pads.length)).toEqual(
        Array<number>(seats).fill(seats === 2 ? 2 : 1),
      );
      expect(state.seats.flatMap(({ pads }) => pads).sort()).toEqual([...state.pads].sort());
      const pads = Object.keys(round.targets).filter((name) => name.startsWith('pad-'));
      expect(pads.sort()).toEqual(state.pads.map((pad) => `pad-${pad}`).sort());
      for (const { seat, pads } of state.seats) {
        const zone = round.zones.find((candidate) => candidate.seat === seat)!;
        for (const pad of pads) {
          const { rect } = round.targets[`pad-${pad}`]!;
          expect(inside(zone, rect), `pad ${pad} inside Seat ${seat}’s Zone`).toBe(true);
        }
      }
    });
  }
}

test('in Cooperative, a touch that began in another Seat’s Zone and slid onto a pad does not press it; one that began on the pad does', async ({
  arcade,
}) => {
  test.slow();
  await openSession(arcade, sessionFor(GAME, COOPERATIVE, 'side-by-side', 2), 2);
  await untilTogetherRepeating(arcade);
  const round = (await arcade.round())!;
  const before = round.state as Together;
  const pad = asked(before);
  const owner = ownerOf(before, pad);
  const other = round.zones.find((zone) => zone.seat !== owner)!;
  const target = round.targets[`pad-${pad}`]!;
  const sounds = (await arcade.call('sounds')).length;

  await arcade.touch('touchStart', [{ x: other.x + other.width / 2, y: other.y + 20 }]);
  await arcade.touch('touchMove', [target]);
  await arcade.touch('touchEnd', []);
  await arcade.page.waitForTimeout(300);
  const after = await together(arcade);
  expect({ entered: after.entered, lives: after.lives, phase: after.phase }).toEqual({
    entered: before.entered,
    lives: before.lives,
    phase: 'repeating',
  });
  expect(await arcade.call('sounds')).toHaveLength(sounds);

  await arcade.touch('touchStart', [target]);
  await arcade.touch('touchEnd', []);
  await expect.poll(async () => progress(await together(arcade))).not.toBe(progress(before));
  expect((await together(arcade)).lives).toBe(before.lives);
});

test('in Cooperative, presses by different Seats that arrive in one touch event each count for their own Seat', async ({
  arcade,
}) => {
  test.slow();
  // Four Seats on Medium: the first sequence has two steps, on two different Seats' pads.
  const seed = Array.from({ length: 500 }, (_, at) => at + 1).find((candidate) => {
    const { sequence, owners } = startTogether({
      seats: 4,
      difficulty: 'medium',
      rng: createRng(candidate),
      at: 0,
    });
    return owners[sequence[0]!] !== owners[sequence[1]!];
  })!;
  await openSession(arcade, sessionFor(GAME, COOPERATIVE, 'around-the-table', 4, 'medium'), seed);
  await untilTogetherRepeating(arcade);
  const round = (await arcade.round())!;
  const state = round.state as Together;
  expect(state.length).toBe(2);
  const [first, second] = [0, 1].map((step) => state.pads[state.sequence[step]!]!);
  expect(ownerOf(state, first!)).not.toBe(ownerOf(state, second!));
  const from = round.seatTouches.events.length;

  await arcade.touch('touchStart', [
    round.targets[`pad-${first}`]!,
    round.targets[`pad-${second}`]!,
  ]);
  await arcade.touch('touchEnd', []);
  await expect.poll(async () => (await together(arcade)).completed).toBe(1);
  expect(await together(arcade)).toMatchObject({ lives: 3, length: 3 });
  expect((await arcade.round())!.seatTouches.events.slice(from, from + 2)).toEqual([
    { kind: 'down', seat: ownerOf(state, first!) },
    { kind: 'down', seat: ownerOf(state, second!) },
  ]);
});

test('in Cooperative, when a right press and then the slip that spends the last life arrive in one touch event, the Round fails with the wrong sound, not the win', async ({
  arcade,
}) => {
  test.slow();
  await openSession(arcade, sessionFor(GAME, COOPERATIVE, 'side-by-side', 4, 'medium'), 3);
  /** A pad the next step does not ask for, of a Seat other than the one whose pad it asks for. */
  const slip = (state: Together) =>
    state.pads.find((pad) => ownerOf(state, pad) !== ownerOf(state, asked(state)))!;
  for (let lives = 3; lives > 1; lives -= 1) {
    await untilTogetherRepeating(arcade);
    await arcade.tapRound(`pad-${slip(await together(arcade))}`);
    await expect.poll(async () => (await together(arcade)).lives).toBe(lives - 1);
  }
  await untilTogetherRepeating(arcade);
  const round = (await arcade.round())!;
  const state = round.state as Together;
  const sounds = (await arcade.call('sounds')).length;
  // The right first step, then a pad the second step does not ask for either.
  const steps = state.sequence.slice(0, 2).map((pad) => state.pads[pad]);
  const wrong = state.pads.find((pad) => !steps.includes(pad))!;
  await arcade.touch('touchStart', [
    round.targets[`pad-${asked(state)}`]!,
    round.targets[`pad-${wrong}`]!,
  ]);
  await arcade.touch('touchEnd', []);
  await expect.poll(() => arcade.screen()).toBe('result');
  expect((await arcade.snapshot()).state).toMatchObject({
    result: { kind: 'cooperative', success: false },
  });
  const added = (await arcade.call('sounds')).slice(sounds).map(({ key }) => key);
  expect(added).not.toContain('win');
  expect(added.at(-1)).toBe('wrong');
});

/** Starts a Cooperative Session for `players` from Color Echo's lobby, past the Demo. */
async function startTogetherFromLobby(arcade: Arcade, players: number) {
  await arcade.tap('color-echo');
  await expect.poll(() => arcade.screen()).toBe('lobby');
  for (const mascot of MASCOTS.slice(0, players)) await arcade.tap(`mascot-${mascot}`);
  await arcade.tap('style-cooperative');
  await arcade.tap('start');
  await expect.poll(() => arcade.screen()).toBe('color-echo');
  await arcade.skipDemo();
  const round = (await arcade.round())!;
  expect(round.session).toMatchObject({ playStyle: 'cooperative', zoned: true });
  expect(round.session.seats).toHaveLength(players);
  expect(await together(arcade)).toMatchObject({ lives: 3, completed: 0 });
}

for (const players of [2, 3, 4]) {
  test(`${players} Players start a Cooperative Session from Color Echo’s lobby and play it to a failed Result`, async ({
    arcade,
  }) => {
    test.slow();
    await startTogetherFromLobby(arcade, players);
    // A wrong pad every time: the shared lives run out.
    await playToResult(arcade, 'color-echo');
    await expect.poll(() => arcade.screen()).toBe('result');
    expect((await arcade.snapshot()).state).toMatchObject({
      result: { kind: 'cooperative', success: false, score: 0 },
    });
  });

  test(`${players} Players start a Cooperative Session from Color Echo’s lobby and play it to a successful Result`, async ({
    arcade,
  }) => {
    // Every sequence up to Easy's target length, each played by the Arcade first.
    test.slow();
    test.setTimeout(test.info().timeout + 5 * 60_000);
    await startTogetherFromLobby(arcade, players);
    const { target, length: first } = await together(arcade);
    expect(target).toBe(TARGET.easy);
    /** Where the Round stands: over once the host shows its Result. */
    const phase = async () =>
      (await arcade.host()) === 'showing-result' ? 'over' : (await together(arcade)).phase;
    for (;;) {
      await expect.poll(phase, { timeout: 2 * 60_000 }).not.toBe('playing');
      if ((await phase()) === 'over') break;
      const state = await together(arcade);
      await arcade.tapRound(`pad-${asked(state)}`);
      await expect
        .poll(async () => ((await phase()) === 'over' ? 'over' : progress(await together(arcade))))
        .not.toBe(progress(state));
    }
    await expect.poll(() => arcade.screen()).toBe('result');
    expect((await arcade.snapshot()).state).toMatchObject({
      result: { kind: 'cooperative', success: true, score: target - first + 1 },
    });
  });
}
