import type { Difficulty, Result, Rng, SeatIndex } from '@/contract';

/** The wait before each point's signal, in milliseconds of Round time: a whole number in this range. */
export const WAIT = { least: 1500, most: 3500 } as const;

/** The first Seat to this many points wins the Round. */
export const TO_WIN = 3;

/** How many points a Round may have; the last one played ends it. */
export const MOST_POINTS = 10;

/** How long the signal stays up for a press, in milliseconds: shorter as the Difficulty rises. */
const SIGNAL_UP: Readonly<Record<Difficulty, number>> = { easy: 3000, medium: 2000, hard: 1200 };

export const signalUp = (difficulty: Difficulty): number => SIGNAL_UP[difficulty];

/** How many decoys show while each point waits for its signal: none on Easy. */
const DECOYS: Readonly<Record<Difficulty, number>> = { easy: 0, medium: 1, hard: 2 };

/** How many different decoy pictures there are. */
export const DECOY_KINDS = 2;

/** How long a decoy shows, in milliseconds. */
export const DECOY_FOR = 400;

/** Decoys show only this long after a point begins and this long before its signal, in milliseconds. */
const DECOY_CLEAR = 300;

/**
 * How long, in milliseconds of Round time, presses that arrive after the first are still taken
 * into account, so the earliest by its touch timestamp wins even if it arrives second.
 */
export const SETTLE = 50;

/** How long the Round shows who won a point before the next begins, in milliseconds. */
export const BETWEEN = 1000;

/** A picture that is not the signal, shown while a point waits for it. */
export interface Decoy {
  /** When it shows, in milliseconds from the start of the point. */
  readonly at: number;
  /** Which decoy picture, from 0 to DECOY_KINDS - 1. */
  readonly kind: number;
}

/** One point, planned when the Round starts. */
export interface Plan {
  /** From the start of the point to the signal, in milliseconds. */
  readonly wait: number;
  /** In the order they show, one at a time. */
  readonly decoys: readonly Decoy[];
}

export interface Rush {
  readonly difficulty: Difficulty;
  /** Every point the Round can reach. */
  readonly plans: readonly Plan[];
  /** The point being played, counting from 0. */
  readonly point: number;
  readonly phase: 'waiting' | 'signal' | 'between' | 'over';
  /** When the point, or the pause after it, began, in Round time. */
  readonly since: number;
  /** Each Seat's points, in Seat order. */
  readonly scores: readonly number[];
  /** The presses after this point's signal, each with its touch timestamp. */
  readonly presses: readonly { readonly seat: SeatIndex; readonly time: number }[];
  /** When the first of them arrived, in Round time. */
  readonly pressedAt: number | null;
  /** Who won the point last decided. */
  readonly winners: readonly SeatIndex[];
  /** The Seats that pressed too early in this point, whose presses count for nothing until the next. */
  readonly out: readonly SeatIndex[];
}

/** A new Round: every point's wait drawn from `rng`, and the first point waiting for its signal. */
export function start(setup: {
  difficulty: Difficulty;
  seats: number;
  rng: Rng;
  at: number;
}): Rush {
  const { difficulty, rng, at } = setup;
  const plans = Array.from({ length: MOST_POINTS }, () => plan(difficulty, rng));
  return {
    difficulty,
    plans,
    point: 0,
    phase: 'waiting',
    since: at,
    scores: Array.from({ length: setup.seats }, () => 0),
    presses: [],
    pressedAt: null,
    winners: [],
    out: [],
  };
}

/**
 * A point's wait, and its decoys: the time between the clear margins is split into one equal slot
 * per decoy, and each decoy shows somewhere in its own slot, so no two show at once.
 */
function plan(difficulty: Difficulty, rng: Rng): Plan {
  const wait = rng.int(WAIT.least, WAIT.most);
  const count = DECOYS[difficulty];
  const slot = Math.floor((wait - 2 * DECOY_CLEAR) / Math.max(count, 1));
  const decoys = Array.from({ length: count }, (_, i) => ({
    kind: rng.int(0, DECOY_KINDS - 1),
    at: DECOY_CLEAR + i * slot + rng.int(0, slot - DECOY_FOR),
  }));
  return { wait, decoys };
}

/** What a point shows at a moment: its signal, one of its decoys, or nothing. */
export type Showing = 'signal' | { readonly decoy: number } | null;

/** What the point shows at `now`, from the elapsed Round time alone. */
export function showingAt(rush: Rush, now: number): Showing {
  if (rush.phase === 'between' || rush.phase === 'over') return null;
  const { wait, decoys } = rush.plans[rush.point]!;
  const elapsed = now - rush.since;
  if (elapsed >= wait) return 'signal';
  const decoy = decoys.find(({ at }) => elapsed >= at && elapsed < at + DECOY_FOR);
  return decoy ? { decoy: decoy.kind } : null;
}

/** Moves the Round on to `now`: the signal shows, and once the presses have settled, the point is decided. */
export function advance(rush: Rush, now: number): Rush {
  if (rush.phase === 'waiting' && showingAt(rush, now) === 'signal') {
    return { ...rush, phase: 'signal' };
  }
  if (rush.phase === 'signal' && rush.pressedAt !== null && now >= rush.pressedAt + SETTLE) {
    const first = Math.min(...rush.presses.map(({ time }) => time));
    const winners = rush.presses
      .filter(({ time }) => time === first)
      .map(({ seat }) => seat)
      .sort();
    return decided(rush, now, winners);
  }
  if (rush.phase === 'signal' && rush.pressedAt === null) {
    const gone = rush.since + rush.plans[rush.point]!.wait + signalUp(rush.difficulty);
    if (now >= gone) return decided(rush, now, []);
  }
  if (rush.phase === 'between' && now >= rush.since + BETWEEN) {
    return {
      ...rush,
      phase: 'waiting',
      point: rush.point + 1,
      since: rush.since + BETWEEN,
      presses: [],
      pressedAt: null,
      out: [],
    };
  }
  return rush;
}

/**
 * The point ended at `now`, won by `winners` (none when nobody scored). The Round is over once a
 * Seat has reached TO_WIN or the last point is played; otherwise the pause after the point begins.
 */
function decided(rush: Rush, now: number, winners: readonly SeatIndex[]): Rush {
  const scores = rush.scores.map((score, seat) =>
    winners.includes(seat as SeatIndex) ? score + 1 : score,
  );
  const over = scores.some((score) => score >= TO_WIN) || rush.point + 1 >= MOST_POINTS;
  return { ...rush, phase: over ? 'over' : 'between', since: now, scores, winners };
}

/** What a press did: nothing; too early, so the Seat is out of the point; or a press that counts. */
export type Outcome = 'ignored' | 'false-start' | 'pressed';

/**
 * A Seat pressed: `time` is the touch's own timestamp, which orders presses; `now` is the Round
 * time it arrived at. An ignored press returns the same Rush.
 */
export function press(
  rush: Rush,
  seat: SeatIndex,
  { time, now }: { time: number; now: number },
): { rush: Rush; outcome: Outcome } {
  const ignored = { rush, outcome: 'ignored' } as const;
  if (rush.out.includes(seat)) return ignored;
  if (rush.phase === 'waiting') {
    const out = [...rush.out, seat];
    const early = { ...rush, out };
    const everyone = out.length === rush.scores.length;
    return { rush: everyone ? decided(early, now, []) : early, outcome: 'false-start' };
  }
  if (rush.phase !== 'signal' || rush.presses.some((p) => p.seat === seat)) return ignored;
  return {
    rush: {
      ...rush,
      presses: [...rush.presses, { seat, time }],
      pressedAt: rush.pressedAt ?? now,
    },
    outcome: 'pressed',
  };
}

/**
 * The Result once the Round is over, with every Seat's score; null until then. The Seats with the
 * most points win: those that reached TO_WIN together, or the leaders after the last point. With no
 * points scored at all it is a draw.
 */
export function result(rush: Rush): Result | null {
  if (rush.phase !== 'over') return null;
  const scores = Object.fromEntries(rush.scores.map((score, seat) => [seat, score]));
  const most = Math.max(...rush.scores);
  if (most === 0) return { kind: 'draw', scores };
  const winners = rush.scores.flatMap((score, seat) => (score === most ? [seat as SeatIndex] : []));
  return { kind: 'win', winners, scores };
}
