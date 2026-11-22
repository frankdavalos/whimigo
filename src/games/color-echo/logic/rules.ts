import type { Difficulty, Result, Rng } from '@/contract';

/** A pad, by its index: 0 to 2 on Easy, 0 to 3 on Medium and Hard. */
export type Pad = number;

/** The longest sequence: repeating one this long ends the Round. */
export const LONGEST = 12;

const PADS: Readonly<Record<Difficulty, number>> = { easy: 3, medium: 4, hard: 4 };

/** How many steps the first sequence has. */
const FIRST_LENGTH: Readonly<Record<Difficulty, number>> = { easy: 1, medium: 2, hard: 3 };

export const padCount = (difficulty: Difficulty): number => PADS[difficulty];

export interface Echo {
  readonly difficulty: Difficulty;
  /** Every step the Round can reach; the sequence played is its first `length` pads. */
  readonly sequence: readonly Pad[];
  readonly length: number;
  /** The Arcade plays the sequence, then the Player repeats it, until the Round is over. */
  readonly phase: 'playing' | 'repeating' | 'over';
  /** When the Arcade began playing the current sequence, in Round time. */
  readonly since: number;
  /** How many pads of the current sequence the Player has repeated. */
  readonly entered: number;
  /** How many sequences the Player has repeated in full. */
  readonly completed: number;
}

/** A new Round: the whole sequence drawn from `rng`, and the Arcade playing its first steps. */
export function start(setup: { difficulty: Difficulty; rng: Rng; at: number }): Echo {
  const { difficulty, rng, at } = setup;
  const sequence = Array.from({ length: LONGEST }, () => rng.int(0, PADS[difficulty] - 1));
  return {
    difficulty,
    sequence,
    length: FIRST_LENGTH[difficulty],
    phase: 'playing',
    since: at,
    entered: 0,
    completed: 0,
  };
}

/** The least gap between two steps of a sequence, in milliseconds: Hard never plays faster. */
export const LEAST_GAP = 350;

/** The gap between the starts of two steps, in milliseconds, before Hard shrinks it. */
const GAP: Readonly<Record<Difficulty, number>> = { easy: 1000, medium: 750, hard: 600 };

/** How much shorter Hard's gap grows with each step the sequence gains, in milliseconds. */
const HARD_SHRINK = 30;

/** A quiet moment before the first step of each sequence, in milliseconds. */
const LEAD = 700;

/** How much of each gap a pad stays lit. */
const LIT_SHARE = 0.6;

/** The gap between steps for a sequence of `length` steps, in milliseconds. */
export function gapFor(difficulty: Difficulty, length: number): number {
  if (difficulty !== 'hard') return GAP[difficulty];
  return Math.max(LEAST_GAP, GAP.hard - HARD_SHRINK * (length - 1));
}

/** Where the Arcade's playing of the sequence has reached. */
export interface Playing {
  /** The step lit now, by its place in the sequence, or null between steps. */
  readonly step: number | null;
  /** The pad lit now, or null. */
  readonly lit: Pad | null;
  /** True once every step has played. */
  readonly done: boolean;
}

/** Where the playing has reached at `now`, from the elapsed Round time alone. */
export function playingAt(
  echo: Pick<Echo, 'difficulty' | 'sequence' | 'length' | 'since'>,
  now: number,
): Playing {
  const gap = gapFor(echo.difficulty, echo.length);
  const elapsed = now - echo.since - LEAD;
  const done = elapsed >= echo.length * gap;
  const index = Math.floor(elapsed / gap);
  const lit = !done && elapsed >= 0 && elapsed - index * gap < gap * LIT_SHARE;
  return lit ? { step: index, lit: echo.sequence[index]!, done } : { step: null, lit: null, done };
}

/** Moves the Round on to `now`: once the Arcade has played the sequence, the Player repeats it. */
export function advance(echo: Echo, now: number): Echo {
  if (echo.phase !== 'playing' || !playingAt(echo, now).done) return echo;
  return { ...echo, phase: 'repeating', entered: 0 };
}

/**
 * What a pressed pad did: nothing while the Arcade plays or once the Round is over; the next pad
 * of the sequence; the last one, so the sequence plays again; a wrong pad, which ends the Round in
 * Solo and the Turn when Seats take Turns; or, in Solo, the last pad of the longest sequence, which
 * ends the Round too.
 */
export type Outcome = 'ignored' | 'correct' | 'repeated' | 'wrong' | 'finished';

/** The Player pressed `pad` at `now`. An ignored press returns the same Echo. */
export function press(echo: Echo, pad: Pad, now: number): { echo: Echo; outcome: Outcome } {
  if (echo.phase !== 'repeating') return { echo, outcome: 'ignored' };
  if (pad !== echo.sequence[echo.entered]) {
    return { echo: { ...echo, phase: 'over' }, outcome: 'wrong' };
  }
  const entered = echo.entered + 1;
  if (entered < echo.length) return { echo: { ...echo, entered }, outcome: 'correct' };
  const completed = echo.completed + 1;
  if (echo.length === LONGEST) {
    return { echo: { ...echo, entered, completed, phase: 'over' }, outcome: 'finished' };
  }
  const next: Echo = {
    ...echo,
    length: echo.length + 1,
    phase: 'playing',
    since: now,
    entered: 0,
    completed,
  };
  return { echo: next, outcome: 'repeated' };
}

/** The Solo Result once the Round is over, scoring the sequences completed; null until then. */
export function result(echo: Echo): Result | null {
  return echo.phase === 'over' ? { kind: 'solo', score: echo.completed } : null;
}
