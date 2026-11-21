import type { Difficulty } from '../../src/contract';
import { expect, test, type Arcade } from './arcade';
import { CATALOG, openSession, sessionFor } from './play';

const SEED = 6;

type RoundPage = NonNullable<Awaited<ReturnType<Arcade['round']>>>;

/** What Color Echo's snapshot says about its rules. */
interface Echo {
  phase: 'playing' | 'repeating' | 'over';
  length: number;
  entered: number;
  completed: number;
  pads: string[];
  sequence: number[];
}

/** A touch somewhere in a Game, set up and named. */
interface Case {
  readonly name: string;
  readonly game: string;
  readonly difficulty?: Difficulty;
  /** Brings the Round to where the touch is made; returns the target to touch. */
  readonly prepare: (arcade: Arcade) => Promise<string>;
  /** The part of the state only a touch may change: time moves some Games on by itself. */
  readonly settled?: (state: unknown) => unknown;
  /**
   * Checks that the touch requested no sound. By default no sound at all follows it; a Game that
   * goes on by itself says what it requests on its own.
   */
  readonly silent?: (arcade: Arcade) => Promise<void>;
}

const echo = (round: RoundPage | null) => round!.state as Echo;
const settledEcho = (state: unknown) => {
  const { length, entered, completed } = state as Echo;
  return { length, entered, completed };
};

/** Waits until the Player may repeat Color Echo's sequence. */
async function untilRepeating(arcade: Arcade) {
  await expect
    .poll(async () => echo(await arcade.round()).phase, { timeout: 30_000 })
    .toBe('repeating');
}

/** Touches that must be ignored. #18 adds the Computer Player's choosing; #19 a pad out of Turn. */
const IGNORED: readonly Case[] = [
  {
    name: 'a taken cell',
    game: 'tic-tac-toe',
    async prepare(arcade) {
      await arcade.tapRound('cell-4');
      await expect
        .poll(async () => ((await arcade.round())!.state as { board: unknown[] }).board[4])
        .not.toBeNull();
      return 'cell-4';
    },
  },
  {
    name: 'a pad pressed while the sequence plays',
    game: 'color-echo',
    difficulty: 'hard',
    async prepare(arcade) {
      const state = echo(await arcade.round());
      expect(state.phase).toBe('playing');
      return `pad-${state.pads[0]}`;
    },
    settled: settledEcho,
    async silent(arcade) {
      // Once the sequence has played, exactly its own tones were requested: one for each step.
      await untilRepeating(arcade);
      const { pads, sequence } = echo(await arcade.round());
      const keys = (await arcade.call('sounds')).map(({ key }) => key);
      expect(keys).toEqual(sequence.map((pad) => `color-echo/tone-${pads[pad]}`));
    },
  },
];

/** Touches that count. */
const ACCEPTED: readonly Case[] = [
  { name: 'an empty cell', game: 'tic-tac-toe', prepare: async () => 'cell-4' },
  {
    name: 'the next pad of the sequence',
    game: 'color-echo',
    async prepare(arcade) {
      await untilRepeating(arcade);
      const state = echo(await arcade.round());
      return `pad-${state.pads[state.sequence[state.entered]!]}`;
    },
  },
];

test('every Game in the Catalog has a case of an ignored touch and of an accepted one', () => {
  for (const game of CATALOG) {
    expect(
      IGNORED.some((c) => c.game === game.id),
      game.id,
    ).toBe(true);
    expect(
      ACCEPTED.some((c) => c.game === game.id),
      game.id,
    ).toBe(true);
  }
});

/** Opens the case's Game in its first Play Style, past the Demo. */
async function openCase(arcade: Arcade, c: Case) {
  const game = CATALOG.find((candidate) => candidate.id === c.game)!;
  const session = sessionFor(game, game.playStyles[0]!, 'side-by-side', undefined, c.difficulty);
  await openSession(arcade, session, SEED);
}

/** The Round and its requested sounds, read in one go so they describe the same moment. */
const now = (arcade: Arcade) =>
  arcade.page.evaluate(() => ({
    round: window.whimigo!.round()!,
    sounds: window.whimigo!.sounds(),
  }));

test.beforeEach(async ({ arcade }) => {
  await arcade.open();
  await arcade.start();
});

for (const c of IGNORED) {
  test(`${c.game}, ignored: ${c.name} requests no sound, changes nothing, and the snapshot reports the refusal`, async ({
    arcade,
  }) => {
    await openCase(arcade, c);
    const target = await c.prepare(arcade);
    const settle = c.settled ?? ((state: unknown) => state);
    const before = await now(arcade);
    await arcade.tapRound(target);
    await expect.poll(async () => (await arcade.round())!.refusals).toBe(before.round.refusals + 1);
    const after = await now(arcade);
    expect(settle(after.round.state)).toEqual(settle(before.round.state));
    if (c.silent) await c.silent(arcade);
    else expect(after.sounds).toEqual(before.sounds);
    expect(await arcade.screen()).toBe(c.game);
  });
}

for (const c of ACCEPTED) {
  test(`${c.game}, accepted: ${c.name} has a sound requested in the same frame, and the next snapshot shows what it changed`, async ({
    arcade,
  }) => {
    await openCase(arcade, c);
    const target = await c.prepare(arcade);
    const before = await now(arcade);
    await arcade.tapRound(target);
    let after = before;
    await expect
      .poll(async () => {
        after = await now(arcade);
        return JSON.stringify(after.round.state);
      })
      .not.toBe(JSON.stringify(before.round.state));
    const added = after.sounds.slice(before.sounds.length);
    expect(added.length, 'a sound, already requested when the change shows').toBeGreaterThan(0);
    for (const sound of added) expect(sound.time).toBeLessThanOrEqual(after.round.time);
    expect(after.round.refusals).toBe(before.round.refusals);
  });
}
