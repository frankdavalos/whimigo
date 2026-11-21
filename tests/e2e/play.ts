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
import { expect, type Arcade } from './arcade';

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
  // The first Seat to move takes the top row while the other takes the middle row.
  'tic-tac-toe': (round) => {
    const board = (round.state as { board: (number | null)[] }).board;
    const cell = [0, 3, 1, 4, 2, 5, 6, 7, 8].find((index) => board[index] === null);
    return `cell-${cell}`;
  },
  // Repeats the first sequence, then presses a wrong pad.
  'color-echo': (round) => {
    const { phase, pads, sequence, entered, completed } = round.state as {
      phase: string;
      pads: string[];
      sequence: number[];
      entered: number;
      completed: number;
    };
    if (phase !== 'repeating') return null;
    const right = sequence[entered]!;
    const pad = completed < 1 ? right : (right + 1) % pads.length;
    return `pad-${pads[pad]}`;
  },
};

/** Taps the Round's targets until the host shows a Result; returns the Round's state after each tap. */
export async function playToResult(arcade: Arcade, gameId: string): Promise<unknown[]> {
  const next = NEXT_TAP[gameId];
  if (!next) throw new Error(`tests/e2e/play.ts does not know how to play ${gameId}`);
  const states: unknown[] = [];
  for (let taps = 0; taps < 200; taps += 1) {
    if ((await arcade.host()) === 'showing-result') return states;
    const round = await arcade.round();
    if (!round) throw new Error(`No Round while playing ${gameId}`);
    const target = next(round);
    if (target) await arcade.tapRound(target);
    await expect
      .poll(async () => JSON.stringify((await arcade.round())?.state), { timeout: 30_000 })
      .not.toBe(JSON.stringify(round.state));
    if (target) states.push((await arcade.round())?.state);
  }
  throw new Error(`${gameId} did not reach a Result in 200 taps`);
}
