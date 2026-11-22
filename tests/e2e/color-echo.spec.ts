import type { Difficulty, Seating } from '../../src/contract';
import { MASCOTS } from '../../src/arcade/mascots';
import { expect, test, type Arcade } from './arcade';
import { CATALOG, openSession, playToResult, sessionFor } from './play';

const GAME = CATALOG.find((game) => game.id === 'color-echo')!;
const SOLO = GAME.playStyles.find((style) => style.style === 'solo')!;
const TURN_BASED = GAME.playStyles.find((style) => style.style === 'turn-based')!;

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
