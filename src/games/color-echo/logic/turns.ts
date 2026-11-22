import type { Difficulty, Result, SeatIndex } from '@/contract';
import { createRng } from '@/kit/rng';
import type { TurnRules, TurnSetup } from '@/kit/turn';
import {
  LONGEST,
  padCount,
  playingAt as playingSequence,
  start,
  type Outcome,
  type Pad,
  type Playing,
} from './rules';

/** How many lives each Seat starts with. */
export const LIVES = 3;

/** A Turn-Based Round: the Seats take Turns at repeating the sequence. */
export interface Turns {
  readonly difficulty: Difficulty;
  /** Every step the Round can reach. */
  readonly sequence: readonly Pad[];
  /** The Seat that has the first Turn. */
  readonly first: SeatIndex;
  /** The length of the first Turns' sequence, by Difficulty. */
  readonly firstLength: number;
  /** How many Turns have ended. */
  readonly turn: number;
  /** Each Seat's lives left, by Seat: one entry for each Seat taking Turns. */
  readonly lives: readonly number[];
}

/** A Move: the pads one Seat pressed in its Turn. */
export type Repeat = readonly Pad[];

/** The length of the sequence for the current Turn: it grows once every Seat has had a Turn. */
export const lengthOf = (turns: Turns): number =>
  turns.firstLength + Math.floor(turns.turn / turns.lives.length);

/** The pads the current Turn asks for. */
const asked = (turns: Turns): Repeat => turns.sequence.slice(0, lengthOf(turns));

/**
 * Once a Seat has lost its last life, or every Seat has had its Turn at the longest length: the
 * Seats with the most lives left win, or it is a draw when every Seat has the same. Lives left are
 * the scores.
 */
function result(turns: Turns): Result | null {
  const { lives } = turns;
  if (!lives.includes(0) && lengthOf(turns) <= LONGEST) return null;
  const scores = Object.fromEntries(lives.entries());
  const most = Math.max(...lives);
  if (lives.every((left) => left === most)) return { kind: 'draw', scores };
  const winners = [...lives.keys()].filter((seat) => lives[seat] === most) as SeatIndex[];
  return { kind: 'win', winners, scores };
}

/** Every Move the Seat whose Turn it is could make: the whole sequence, or a slip at any step. */
function legalMoves(turns: Turns): Repeat[] {
  if (result(turns)) return [];
  const pads = asked(turns);
  const slips = pads.flatMap((step, at) =>
    Array.from({ length: padCount(turns.difficulty) }, (_, pad) => pad)
      .filter((pad) => pad !== step)
      .map((pad) => [...pads.slice(0, at), pad]),
  );
  return [pads, ...slips];
}

const same = (a: Repeat, b: Repeat) => a.length === b.length && a.every((pad, at) => pad === b[at]);

const seatToMove = (turns: Turns) => ((turns.first + turns.turn) % turns.lives.length) as SeatIndex;

/** Two to four Seats take Turns at repeating a sequence that grows once each has had a go. */
export const turnRules: TurnRules<Turns, Repeat> = {
  start({ seats, difficulty, seed, first }) {
    const { sequence, length } = start({ difficulty, rng: createRng(seed), at: 0 });
    const lives = Array<number>(seats).fill(LIVES);
    return { difficulty, sequence, first, firstLength: length, turn: 0, lives };
  },
  seatToMove,
  legalMoves,
  apply(turns, move) {
    if (!legalMoves(turns).some((legal) => same(legal, move))) {
      throw new Error(`Pads ${move.join()} are not a Turn`);
    }
    const seat = seatToMove(turns);
    const lives = same(move, asked(turns))
      ? turns.lives
      : turns.lives.map((left, index) => (index === seat ? left - 1 : left));
    return { ...turns, turn: turns.turn + 1, lives };
  },
  result,
};

/** A Turn-Based Round in time: before each Turn the Arcade plays the sequence, then the Seat repeats it. */
export interface TurnEcho {
  readonly turns: Turns;
  /** When the Arcade began playing the sequence for the current Turn, in Round time. */
  readonly since: number;
  /** The pads pressed so far in the current Turn. */
  readonly pressed: Repeat;
}

export const startTurns = (setup: TurnSetup & { readonly at: number }): TurnEcho => ({
  turns: turnRules.start(setup),
  since: setup.at,
  pressed: [],
});

/** Where the Arcade's playing of the current Turn's sequence has reached at `now`. */
export const playingAt = ({ turns, since }: TurnEcho, now: number): Playing =>
  playingSequence({ ...turns, length: lengthOf(turns), since }, now);

/** The Arcade plays the sequence, then the Seat whose Turn it is repeats it, until a Result. */
export function phaseAt(echo: TurnEcho, now: number): 'playing' | 'repeating' | 'over' {
  if (turnRules.result(echo.turns)) return 'over';
  return playingAt(echo, now).done ? 'repeating' : 'playing';
}

/**
 * A pad pressed at `now` counts for the Seat whose Turn it is. A press before the sequence has
 * played for that Seat, or after the Round is over, is out of Turn and ignored. A wrong pad, or the
 * last of the sequence, ends the Turn; unless that ends the Round, the Arcade then plays the
 * sequence for the next Seat.
 */
export function pressTurn(
  echo: TurnEcho,
  pad: Pad,
  now: number,
): { echo: TurnEcho; outcome: Exclude<Outcome, 'finished'> } {
  if (phaseAt(echo, now) !== 'repeating') return { echo, outcome: 'ignored' };
  const pressed = [...echo.pressed, pad];
  const asking = asked(echo.turns);
  const right = pad === asking[pressed.length - 1];
  if (right && pressed.length < asking.length) {
    return { echo: { ...echo, pressed }, outcome: 'correct' };
  }
  const turns = turnRules.apply(echo.turns, pressed);
  return { echo: { turns, since: now, pressed: [] }, outcome: right ? 'repeated' : 'wrong' };
}
