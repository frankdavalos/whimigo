import { describe, expect, it } from 'vitest';
import type { Difficulty, SeatIndex } from '@/contract';
import { createRng } from '@/kit/rng';
import { LONGEST, playingAt } from './rules';
import {
  TARGET,
  padOwners,
  pressTogether,
  startTogether,
  togetherResult,
  type Together,
} from './together';

/** The outcomes of presses, in the order they were applied. */
const outcomesOf = ({ pressed }: ReturnType<typeof pressTogether>) =>
  pressed.map(({ outcome }) => outcome);
const outcomes = (...args: Parameters<typeof pressTogether>) => outcomesOf(pressTogether(...args));

const open = (seats: number, difficulty: Difficulty = 'easy', seed = 1) =>
  startTogether({ seats, difficulty, rng: createRng(seed), at: 0 });

/** The Round time once the Arcade has played the current sequence. */
const played = (together: Together) => {
  let now = together.since;
  while (!playingAt(together, now).done) now += 50;
  return now;
};

/** The pad the sequence asks for next, pressed by the Seat that owns it, at touch time `time`. */
const next = (together: Together, time = 0) => {
  const pad = together.sequence[together.entered]!;
  return { seat: together.owners[pad]!, pad, time };
};

describe('Color Echo Cooperative: pads', () => {
  it('gives each Seat its own pads: two each for two Seats, one each for three or four', () => {
    expect(padOwners(2)).toEqual([0, 0, 1, 1]);
    expect(padOwners(3)).toEqual([0, 1, 2]);
    expect(padOwners(4)).toEqual([0, 1, 2, 3]);
  });

  it('draws the sequence from the Seats’ pads alone, whatever the Difficulty', () => {
    for (const seats of [2, 3, 4]) {
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        const pads = new Set<number>();
        for (let seed = 1; seed <= 40; seed += 1) {
          for (const pad of open(seats, difficulty, seed).sequence) pads.add(pad);
        }
        expect([...pads].sort(), `${seats} Seats, ${difficulty}`).toEqual(
          padOwners(seats).map((_, pad) => pad),
        );
      }
    }
  });
});

describe('Color Echo Cooperative: repeating together', () => {
  it('counts each right pad for the Seat that owns it, and plays a sequence one longer once the group completes one', () => {
    let together = open(4, 'medium');
    const now = played(together);
    for (let step = 0; step < 2; step += 1) {
      const pressing = pressTogether(together, [next(together)], now);
      together = pressing.together;
      expect(outcomesOf(pressing)).toEqual([step === 0 ? 'correct' : 'repeated']);
    }
    expect(together).toMatchObject({ phase: 'playing', length: 3, completed: 1, entered: 0 });
    expect(together.since).toBe(now);
  });

  it('ignores a pad pressed by a Seat that does not own it', () => {
    const together = open(2);
    const now = played(together);
    const { pad, seat } = next(together);
    const other = seat === 0 ? 1 : 0;
    const pressing = pressTogether(together, [{ seat: other, pad, time: 0 }], now);
    expect(outcomesOf(pressing)).toEqual(['ignored']);
    expect(pressing.together).toEqual({ ...together, phase: 'repeating' });
  });

  it('ignores every press while the Arcade plays the sequence', () => {
    const together = open(3);
    const pressing = pressTogether(together, [next(together)], together.since + 100);
    expect(outcomesOf(pressing)).toEqual(['ignored']);
    expect(pressing.together).toEqual(together);
  });
});

describe('Color Echo Cooperative: shared lives', () => {
  it('shares three lives among the Seats; a wrong pad costs one whichever Seat pressed it, and the Arcade plays the same sequence again', () => {
    for (const seats of [2, 3, 4]) {
      let together = open(seats, 'medium', seats);
      expect(together.lives, `${seats} Seats`).toBe(3);
      let now = played(together);
      together = pressTogether(together, [next(together)], now).together;
      // Two slips, by two different Seats: each costs the group a life.
      const slipped = new Set<SeatIndex>();
      for (const slip of [0, 1]) {
        const asked = together.sequence[together.entered]!;
        const pad = together.owners.findIndex((owner, at) => !slipped.has(owner) && at !== asked);
        const seat = together.owners[pad]!;
        slipped.add(seat);
        const pressing = pressTogether(together, [{ seat, pad, time: 0 }], now);
        expect(outcomesOf(pressing)).toEqual(['wrong']);
        together = pressing.together;
        expect(together).toMatchObject({ lives: 2 - slip, phase: 'playing', length: 2 });
        expect(together).toMatchObject({ entered: 0, completed: 0, since: now });
        now = played(together);
      }
    }
  });
});

/** Repeats the whole current sequence, each pad pressed by its own Seat. */
const repeat = (together: Together) => {
  const now = played(together);
  for (let step = together.length; step > 0; step -= 1) {
    together = pressTogether(together, [next(together)], now).together;
  }
  return together;
};

describe('Color Echo Cooperative: the Result', () => {
  it('states a target length for each Difficulty, longer for harder ones and never past the longest sequence', () => {
    expect(TARGET.easy).toBeLessThan(TARGET.medium);
    expect(TARGET.medium).toBeLessThan(TARGET.hard);
    expect(TARGET.hard).toBeLessThanOrEqual(LONGEST);
  });

  it('is a success once the group completes a sequence of the target length, scoring the sequences completed', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      let together = open(2, difficulty);
      const first = together.length;
      let sequences = 0;
      while (together.phase !== 'over') {
        expect(togetherResult(together)).toBeNull();
        together = repeat(together);
        sequences += 1;
        expect(sequences).toBeLessThanOrEqual(LONGEST);
      }
      expect(together.length).toBe(TARGET[difficulty]);
      const completed = TARGET[difficulty] - first + 1;
      expect(togetherResult(together)).toEqual({
        kind: 'cooperative',
        success: true,
        score: completed,
      });
    }
  });

  it('is a failure when the lives run out first, scoring the sequences completed, and ignores any press after', () => {
    let together = repeat(open(3, 'easy', 5));
    let now = played(together);
    for (let slip = 0; slip < 3; slip += 1) {
      expect(togetherResult(together)).toBeNull();
      const pad = (together.sequence[together.entered]! + 1) % together.owners.length;
      const pressing = pressTogether(
        together,
        [{ seat: together.owners[pad]!, pad, time: 0 }],
        now,
      );
      expect(outcomesOf(pressing)).toEqual(['wrong']);
      together = pressing.together;
      now = played(together);
    }
    expect(together).toMatchObject({ phase: 'over', lives: 0 });
    expect(togetherResult(together)).toEqual({ kind: 'cooperative', success: false, score: 1 });
    expect(outcomes(together, [next(together)], now + 10_000)).toEqual(['ignored']);
  });
});

describe('Color Echo Cooperative: presses that arrive together', () => {
  it('counts each for its own Seat, in the order of their timestamps rather than of their arrival', () => {
    // Four Seats, one pad each: a two-step sequence on two different Seats' pads.
    const seed = Array.from({ length: 200 }, (_, at) => at + 1).find((candidate) => {
      const [a, b] = open(4, 'medium', candidate).sequence;
      return a !== b;
    })!;
    const together = open(4, 'medium', seed);
    const now = played(together);
    const [a, b] = together.sequence as [number, number];
    const first = { seat: together.owners[a]!, pad: a, time: 1000 };
    const second = { seat: together.owners[b]!, pad: b, time: 1004 };
    const pressing = pressTogether(together, [second, first], now);
    expect(outcomesOf(pressing)).toEqual(['correct', 'repeated']);
    expect(pressing.together).toMatchObject({ completed: 1, length: 3 });
  });

  it('keeps the order of arrival between presses with the same timestamp', () => {
    const together = open(4, 'medium', 3);
    const now = played(together);
    const right = next(together, 500);
    const pad = (right.pad + 1) % together.owners.length;
    const slip = { seat: together.owners[pad]!, pad, time: 500 };
    expect(outcomes(together, [right, slip], now)).toEqual(['correct', 'wrong']);
    expect(outcomes(together, [slip, right], now)).toEqual(['wrong', 'ignored']);
  });
});
