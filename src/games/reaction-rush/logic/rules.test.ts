import { describe, expect, it } from 'vitest';
import type { Difficulty } from '@/contract';
import { createRng } from '@/kit/rng';
import {
  BETWEEN,
  DECOY_FOR,
  DECOY_KINDS,
  MOST_POINTS,
  SETTLE,
  TO_WIN,
  WAIT,
  result,
  signalUp,
  advance,
  press,
  showingAt,
  start,
  type Rush,
} from './rules';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];
const SEEDS = Array.from({ length: 50 }, (_, seed) => seed);

const open = (difficulty: Difficulty = 'easy', seeds = 2, seed = 1, at = 0) =>
  start({ difficulty, seats: seeds, rng: createRng(seed), at });

/** The moment the current point's signal shows. */
const signalTime = (rush: Rush) => rush.since + rush.plans[rush.point]!.wait;

/** The Round moved on to its current point's signal. */
const signalled = (rush: Rush) => {
  const now = signalTime(rush);
  const moved = advance(rush, now);
  expect(moved.phase).toBe('signal');
  return { rush: moved, now };
};

/** Presses in the order they arrive, each at a touch timestamp, all at Round time `now`. */
const pressAll = (rush: Rush, now: number, presses: readonly [seat: number, time: number][]) =>
  presses.reduce((r, [seat, time]) => press(r, seat as 0, { time, now }).rush, rush);

describe('Reaction Rush’s wait for the signal', () => {
  it('is taken from the Round’s random source, within the stated range, for every point', () => {
    for (const seed of SEEDS) {
      for (const { wait } of open('easy', 2, seed).plans) {
        expect(wait).toBeGreaterThanOrEqual(WAIT.least);
        expect(wait).toBeLessThanOrEqual(WAIT.most);
      }
    }
    const waits = new Set(SEEDS.flatMap((seed) => open('easy', 2, seed).plans.map((p) => p.wait)));
    expect(waits.size, 'waits vary').toBeGreaterThan(10);
  });

  it('is the same for the same seed, and differs for another', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(open(difficulty, 3, 7).plans).toEqual(open(difficulty, 3, 7).plans);
      expect(open(difficulty, 3, 7).plans).not.toEqual(open(difficulty, 3, 8).plans);
    }
  });

  it('ends when the signal shows: nothing shows before it on Easy, and the signal from then on', () => {
    const rush = open('easy', 2, 3, 1000);
    const { wait } = rush.plans[0]!;
    expect(rush.phase).toBe('waiting');
    for (const t of [0, 1, wait / 2, wait - 1]) expect(showingAt(rush, 1000 + t)).toBeNull();
    expect(showingAt(rush, 1000 + wait)).toBe('signal');
  });
});

describe('a press after the signal', () => {
  it('of two with different timestamps: the earlier wins the point, whichever arrives first', () => {
    for (const order of [
      [
        [1, 5005],
        [0, 5000],
      ],
      [
        [0, 5000],
        [1, 5005],
      ],
    ] as [number, number][][]) {
      const { rush, now } = signalled(open('easy', 2));
      const pressed = pressAll(rush, now + 10, order);
      expect(pressed.phase, 'not decided before the presses settle').toBe('signal');
      const decided = advance(pressed, now + 10 + SETTLE);
      expect(decided).toMatchObject({ phase: 'between', winners: [0], scores: [1, 0] });
    }
  });

  it('of two with the same timestamp: both score', () => {
    const { rush, now } = signalled(open('easy', 3));
    const decided = advance(
      pressAll(rush, now, [
        [2, 7000],
        [0, 7000],
        [1, 7001],
      ]),
      now + SETTLE,
    );
    expect(decided).toMatchObject({ phase: 'between', winners: [0, 2], scores: [1, 0, 1] });
  });

  it('counts once for a Seat that presses twice', () => {
    const { rush, now } = signalled(open('easy', 2));
    const decided = advance(
      pressAll(rush, now, [
        [0, 100],
        [0, 90],
      ]),
      now + SETTLE,
    );
    expect(decided.scores).toEqual([1, 0]);
  });
});

/** The Round moved on past the pause after a point, to the next point. */
const next = (rush: Rush) => {
  expect(rush.phase).toBe('between');
  return advance(rush, rush.since + BETWEEN);
};

describe('a false start', () => {
  it('is a press before the signal: that Seat’s presses are ignored until the next point, and the others play on', () => {
    const rush = open('easy', 3);
    const early = press(rush, 1, { time: 100, now: rush.since + 10 });
    expect(early.outcome).toBe('false-start');
    expect(early.rush.out).toEqual([1]);

    const { rush: shown, now } = signalled(early.rush);
    const again = press(shown, 1, { time: 200, now });
    expect(again.outcome).toBe('ignored');
    expect(again.rush).toBe(shown);
    const decided = advance(pressAll(shown, now, [[2, 300]]), now + SETTLE);
    expect(decided).toMatchObject({ winners: [2], scores: [0, 0, 1] });

    const following = next(decided);
    expect(following).toMatchObject({ phase: 'waiting', point: 1, out: [] });
    const { rush: secondSignal, now: later } = signalled(following);
    expect(press(secondSignal, 1, { time: 900, now: later }).outcome).toBe('pressed');
  });

  it('by every Seat makes the point void: nobody scores, and the next point begins', () => {
    const rush = open('easy', 2);
    const first = press(rush, 0, { time: 1, now: rush.since + 5 }).rush;
    const both = press(first, 1, { time: 2, now: rush.since + 6 });
    expect(both.outcome).toBe('false-start');
    expect(both.rush).toMatchObject({ phase: 'between', winners: [], scores: [0, 0] });
    expect(next(both.rush)).toMatchObject({ phase: 'waiting', point: 1, out: [] });
  });
});

/** Plays a point in which `seats` press at the same moment after the signal, and decides it. */
const point = (rush: Rush, seats: readonly number[]) => {
  const { rush: shown, now } = signalled(rush);
  const pressed = pressAll(
    shown,
    now,
    seats.map((seat) => [seat, now]),
  );
  return advance(pressed, now + SETTLE);
};

/** Lets the signal stay up with nobody pressing until it goes. */
const unanswered = (rush: Rush) => {
  const { rush: shown, now } = signalled(rush);
  const gone = signalUp(rush.difficulty) + now;
  expect(advance(shown, gone - 1).phase).toBe('signal');
  return advance(shown, gone);
};

describe('the end of a Round', () => {
  it('comes when a Seat reaches three points: the Result names it, with every Seat’s score', () => {
    expect(TO_WIN).toBe(3);
    let rush = open('easy', 3);
    rush = next(point(rush, [0]));
    rush = next(point(rush, [1]));
    rush = next(point(rush, [0]));
    expect(result(rush)).toBeNull();
    rush = point(rush, [0]);
    expect(rush.phase).toBe('over');
    expect(result(rush)).toEqual({ kind: 'win', winners: [0], scores: { 0: 3, 1: 1, 2: 0 } });
  });

  it('names every Seat that reached three on the same point', () => {
    let rush = open('medium', 4);
    for (let i = 0; i < 2; i += 1) rush = next(point(rush, [1, 3]));
    rush = point(rush, [3, 1, 0]);
    expect(result(rush)).toEqual({
      kind: 'win',
      winners: [1, 3],
      scores: { 0: 1, 1: 3, 2: 0, 3: 3 },
    });
  });

  it('when nobody presses while the signal is up, nobody scores and the next point begins', () => {
    const rush = unanswered(open('easy', 2));
    expect(rush).toMatchObject({ phase: 'between', winners: [], scores: [0, 0] });
    expect(next(rush)).toMatchObject({ phase: 'waiting', point: 1 });
  });

  it('ignores a press, and shows nothing, between points and once the Round is over', () => {
    const between = point(open('easy', 2), [0]);
    expect(showingAt(between, between.since)).toBeNull();
    expect(press(between, 1, { time: 1, now: between.since }).outcome).toBe('ignored');
    let rush = open('easy', 2);
    for (let i = 0; i < TO_WIN - 1; i += 1) rush = next(point(rush, [1]));
    const over = point(rush, [1]);
    expect(over.phase).toBe('over');
    expect(showingAt(over, over.since)).toBeNull();
    expect(press(over, 0, { time: 1, now: over.since }).outcome).toBe('ignored');
  });

  it('comes after the stated number of points, won by the Seat or Seats with the most', () => {
    let rush = open('easy', 3);
    rush = next(point(rush, [2]));
    rush = next(point(rush, [0]));
    for (let played = 2; played < MOST_POINTS - 1; played += 1) rush = next(unanswered(rush));
    rush = unanswered(rush);
    expect(rush.point).toBe(MOST_POINTS - 1);
    expect(rush.phase).toBe('over');
    expect(result(rush)).toEqual({ kind: 'win', winners: [0, 2], scores: { 0: 1, 1: 0, 2: 1 } });
  });

  it('is a draw after the stated number of points when nobody has scored', () => {
    let rush = open('hard', 2);
    for (let played = 0; played < MOST_POINTS - 1; played += 1) rush = next(unanswered(rush));
    rush = unanswered(rush);
    expect(result(rush)).toEqual({ kind: 'draw', scores: { 0: 0, 1: 0 } });
  });
});

/** What shows at every 10 ms of a point's wait. */
const shownDuringWait = (rush: Rush) =>
  Array.from({ length: Math.ceil(rush.plans[rush.point]!.wait / 10) }, (_, i) =>
    showingAt(rush, rush.since + i * 10),
  );

describe('decoys', () => {
  it('on Easy: only the true signal ever appears', () => {
    for (const seed of SEEDS) {
      let rush = open('easy', 2, seed);
      for (let p = 0; p < 3; p += 1) {
        expect(rush.plans[rush.point]!.decoys).toEqual([]);
        expect(shownDuringWait(rush).every((shown) => shown === null)).toBe(true);
        rush = next(unanswered(rush));
      }
    }
  });

  it('on Medium: decoys appear while the Round waits for the signal, and end before it shows', () => {
    for (const seed of SEEDS) {
      const rush = open('medium', 2, seed);
      for (const plan of rush.plans) {
        expect(plan.decoys.length).toBeGreaterThan(0);
        for (const decoy of plan.decoys) {
          expect(decoy.at).toBeGreaterThan(0);
          expect(decoy.at + DECOY_FOR).toBeLessThan(plan.wait);
          expect(decoy.kind).toBeGreaterThanOrEqual(0);
          expect(decoy.kind).toBeLessThan(DECOY_KINDS);
        }
      }
      const shown = shownDuringWait(rush);
      expect(shown.some((s) => s !== null && s !== 'signal')).toBe(true);
      expect(shown).not.toContain('signal');
    }
  });

  it('on Medium: a press while a decoy shows is a false start', () => {
    const rush = open('medium', 2, 4);
    const [decoy] = rush.plans[0]!.decoys;
    const now = rush.since + decoy!.at + 10;
    expect(showingAt(rush, now)).toEqual({ decoy: decoy!.kind });
    const pressed = press(advance(rush, now), 0, { time: 1, now });
    expect(pressed.outcome).toBe('false-start');
    expect(pressed.rush.out).toEqual([0]);
  });

  it('on Hard: more decoys than on Medium, never two at once, and the signal stays up for a shorter time', () => {
    const count = (difficulty: Difficulty) =>
      SEEDS.reduce(
        (sum, seed) =>
          sum + open(difficulty, 2, seed).plans.reduce((n, plan) => n + plan.decoys.length, 0),
        0,
      );
    expect(count('hard')).toBeGreaterThan(count('medium'));
    for (const seed of SEEDS) {
      for (const { decoys } of open('hard', 2, seed).plans) {
        for (const [i, decoy] of decoys.entries()) {
          const after = decoys[i + 1];
          if (after) expect(decoy.at + DECOY_FOR).toBeLessThanOrEqual(after.at);
        }
      }
    }
    expect(signalUp('hard')).toBeLessThan(signalUp('medium'));
    expect(signalUp('medium')).toBeLessThan(signalUp('easy'));
  });
});
