import type {
  Difficulty,
  GameManifest,
  PlayStyleOption,
  Seating,
  Session,
} from '../../src/contract';
import { buildSession } from '../../src/arcade/lobby/rules';
import { MASCOTS } from '../../src/arcade/mascots';
import { CATALOG } from '../../src/games/catalog';
import { expect, test, type Arcade } from './arcade';

export { CATALOG };

/** Every Game and Play Style in the Catalog, each with the fewest Players it accepts. */
export const EVERY_STYLE = CATALOG.flatMap((game) =>
  game.playStyles.map((style) => ({ game, style, name: `${game.id} ${style.style}` })),
);

/** A Session as the lobby would build it, with the first Mascots in the roster. */
export function sessionFor(
  game: GameManifest,
  style: PlayStyleOption,
  seating: Seating = 'side-by-side',
  players = style.players.min,
  difficulty: Difficulty = 'easy',
): Session {
  return buildSession({
    game,
    style,
    joined: MASCOTS.slice(0, players),
    difficulty,
    seating,
  });
}

/** Opens a Session straight into its first Round, and skips the Demo it begins with. */
export async function openSession(arcade: Arcade, session: Session, seed: number): Promise<void> {
  await arcade.call('open', session, seed);
  await expect.poll(() => arcade.screen()).toBe(session.gameId);
  await arcade.skipDemo();
}

/** A Round's state and targets as the bridge reports them. */
type RoundPage = NonNullable<Awaited<ReturnType<Arcade['round']>>>;

/**
 * How to play each Game: given the Round as the bridge reports it, the next target to tap, or null
 * to wait for the Round to move on by itself. Tests over the Catalog play every Game to a Result
 * with these, so a Game added to the Catalog without one fails them.
 */
const NEXT_TAP: Readonly<Record<string, (round: RoundPage) => string | null>> = {
  // The first Seat to move takes the top row while the other takes the middle row. A Computer
  // Player's Turn is waited out.
  'tic-tac-toe': (round) => {
    const { board, computer } = round.state as { board: (number | null)[]; computer: unknown };
    if (computer) return null;
    const cell = [0, 3, 1, 4, 2, 5, 6, 7, 8].find((index) => board[index] === null);
    return `cell-${cell}`;
  },
  // Solo repeats the first sequence, then presses a wrong pad. In Turn-Based every Seat presses a
  // wrong pad every Turn, so the Seat with the first Turn loses its last life first.
  'color-echo': (round) => {
    const { phase, pads, sequence, entered, completed, lives } = round.state as {
      phase: string;
      pads: string[];
      sequence: number[];
      entered: number;
      completed?: number;
      lives?: unknown;
    };
    if (phase !== 'repeating') return null;
    const right = sequence[entered]!;
    const pad = completed === 0 && !lives ? right : (right + 1) % pads.length;
    return `pad-${pads[pad]}`;
  },
  // The first Seat presses as soon as the signal shows; the others never do.
  'reaction-rush': (round) =>
    (round.state as { phase: string }).phase === 'signal' ? 'button-0' : null,
};

/** A Round as the page reports it after a change, and whether its Result now shows. */
type Changed = { readonly round: RoundPage | null; readonly over: boolean };

/**
 * Waits inside the page, frame by frame, until the Round's state differs from `seen` or the host
 * shows a Result. Waiting there rather than polling from the test catches a target that shows
 * only briefly, such as Reaction Rush's signal, as soon as it shows.
 */
async function changed(arcade: Arcade, seen: string): Promise<Changed> {
  const handle = await arcade.page.waitForFunction(
    (seen) => {
      const bridge = window.whimigo!;
      const over = bridge.screen().host === 'showing-result';
      const round = bridge.round();
      if (round && JSON.stringify(round.state) !== seen) return { round, over };
      return over ? { round: null, over } : false;
    },
    seen,
    // Reaction Rush waits up to 3.5 s of Round time for its signal.
    { timeout: 2 * 60_000 },
  );
  return (await handle.jsonValue()) as Changed;
}

/**
 * The time a Round may take, added to its test's own. Phaser counts a frame slower than a fifth of a
 * second as a 60th of one, and a software-rendered page under load draws three or four frames a
 * second, so Round time runs at a fifteenth of wall time there. A Round of Reaction Rush, nearly 11
 * seconds of signals and waits, then takes three minutes.
 */
const A_ROUND = 5 * 60_000;

/**
 * Taps the Round's targets until the host shows a Result; returns the Round's state after each
 * tap. The test is given A_ROUND more to finish in.
 */
export async function playToResult(arcade: Arcade, gameId: string): Promise<unknown[]> {
  const next = NEXT_TAP[gameId];
  if (!next) throw new Error(`tests/e2e/play.ts does not know how to play ${gameId}`);
  test.setTimeout(test.info().timeout + A_ROUND);
  const states: unknown[] = [];
  if ((await arcade.host()) === 'showing-result') return states;
  let round = await arcade.round();
  for (let taps = 0; taps < 200; taps += 1) {
    if (!round) throw new Error(`No Round while playing ${gameId}`);
    const target = next(round);
    if (target) {
      const { x, y } = round.targets[target]!;
      await arcade.page.touchscreen.tap(x, y);
    }
    const after = await changed(arcade, JSON.stringify(round.state));
    if (target && after.round) states.push(after.round.state);
    if (after.over) return states;
    round = after.round;
  }
  throw new Error(`${gameId} did not reach a Result in 200 taps`);
}
