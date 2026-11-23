import type { Difficulty, Result, Rng, SeatIndex } from '@/contract';
import { advance, press, start, type Echo, type Outcome, type Pad } from './rules';

/** The pads' owners, by pad: the number of pads follows the Seats, two each for two Seats. */
export function padOwners(seats: number): SeatIndex[] {
  const each = seats === 2 ? 2 : 1;
  return Array.from({ length: seats * each }, (_, pad) => Math.floor(pad / each) as SeatIndex);
}

/** How many lives the Seats share. */
export const LIVES = 3;

/** The length of sequence the group must complete to succeed, by Difficulty. */
export const TARGET: Readonly<Record<Difficulty, number>> = { easy: 4, medium: 6, hard: 8 };

/** A Cooperative Round: the Seats repeat the sequence together, each pressing its own pads. */
export interface Together extends Echo {
  /** Which Seat owns each pad, by pad. */
  readonly owners: readonly SeatIndex[];
  /** The lives the Seats share. */
  readonly lives: number;
}

/** A new Round: the sequence drawn from `rng` over the Seats' pads, and the Arcade playing it. */
export function startTogether(setup: {
  difficulty: Difficulty;
  seats: number;
  rng: Rng;
  at: number;
}): Together {
  const owners = padOwners(setup.seats);
  return { ...start({ ...setup, pads: owners.length }), owners, lives: LIVES };
}

/** A pad pressed by a Seat; `time` is the touch's own timestamp. */
export interface Press {
  readonly seat: SeatIndex;
  readonly pad: Pad;
  readonly time: number;
}

/** One press, at `now`: only the Seat that owns a pad presses it. */
function pressOne(
  together: Together,
  { seat, pad }: Press,
  now: number,
): { together: Together; outcome: Outcome } {
  const current = advance(together, now);
  if (together.owners[pad] !== seat) return { together: current, outcome: 'ignored' };
  const { echo, outcome } = press(current, pad, now);
  if (outcome === 'wrong') {
    // A slip costs the group a life; unless it was the last, the Arcade plays the sequence again.
    const lives = current.lives - 1;
    const phase = lives > 0 ? 'playing' : 'over';
    return { together: { ...current, lives, phase, since: now, entered: 0 }, outcome };
  }
  if (outcome === 'repeated' && current.length === TARGET[current.difficulty]) {
    // The group completed the target length: the Round is over at the length it reached.
    const { completed } = echo;
    const over = { ...current, phase: 'over', entered: current.length, completed } as const;
    return { together: over, outcome: 'finished' };
  }
  return { together: { ...current, ...echo }, outcome };
}

/**
 * The Seats pressed pads at `now`, perhaps several at once (the Scene gives those heard since its
 * last frame): each counts for its own
 * Seat, in the order of their touch timestamps, and presses with the same timestamp in the order
 * they arrived. Returns each press with its outcome, in that order.
 */
export function pressTogether(
  together: Together,
  presses: readonly Press[],
  now: number,
): { together: Together; pressed: (Press & { readonly outcome: Outcome })[] } {
  const pressed: (Press & { readonly outcome: Outcome })[] = [];
  for (const each of [...presses].sort((a, b) => a.time - b.time)) {
    const pressing = pressOne(together, each, now);
    together = pressing.together;
    pressed.push({ ...each, outcome: pressing.outcome });
  }
  return { together, pressed };
}

/** The cooperative Result once the Round is over, scoring the sequences completed; null until then. */
export function togetherResult(together: Together): Result | null {
  if (together.phase !== 'over') return null;
  return { kind: 'cooperative', success: together.lives > 0, score: together.completed };
}
