import type { Difficulty } from '../../src/contract';
import { expect, test, type Arcade } from './arcade';
import { CATALOG, openSession, sessionFor } from './play';

const GAME = CATALOG.find((game) => game.id === 'color-echo')!;
const SOLO = GAME.playStyles.find((style) => style.style === 'solo')!;

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
  await expect.poll(async () => (await echo(arcade)).phase, { timeout: 30_000 }).toBe('repeating');
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
