import { describe, expect, it } from 'vitest';
import type { Difficulty } from '@/contract';
import { createRng } from '@/kit/rng';
import {
  LEAST_GAP,
  LONGEST,
  advance,
  gapFor,
  padCount,
  playingAt,
  press,
  result,
  start,
  type Echo,
  type Playing,
} from './rules';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

const open = (difficulty: Difficulty = 'easy', seed = 1, at = 0) =>
  start({ difficulty, rng: createRng(seed), at });

describe('Color Echo pads and sequence', () => {
  it('have three pads on Easy and four on Medium and Hard', () => {
    expect(padCount('easy')).toBe(3);
    expect(padCount('medium')).toBe(4);
    expect(padCount('hard')).toBe(4);
  });

  it('draw a sequence of the longest length from the Round’s random source, using only its pads', () => {
    for (const difficulty of DIFFICULTIES) {
      const { sequence } = open(difficulty, 5);
      expect(sequence).toHaveLength(LONGEST);
      for (const pad of sequence) {
        expect(pad).toBeGreaterThanOrEqual(0);
        expect(pad).toBeLessThan(padCount(difficulty));
      }
    }
  });

  it('give the same sequence for the same seed, and another for another seed', () => {
    expect(open('medium', 9).sequence).toEqual(open('medium', 9).sequence);
    const seeds = Array.from({ length: 10 }, (_, seed) => open('medium', seed).sequence.join());
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it('start with the Arcade playing, one step on Easy', () => {
    const echo = open('easy');
    expect(echo.phase).toBe('playing');
    expect(echo.length).toBe(1);
    expect(echo.completed).toBe(0);
  });
});

describe('Color Echo tempo', () => {
  it('leaves a longer gap between steps on Easy than on Medium, and a shorter one on Hard', () => {
    for (let length = 1; length <= LONGEST; length += 1) {
      expect(gapFor('easy', length)).toBeGreaterThan(gapFor('medium', length));
      expect(gapFor('hard', length)).toBeLessThan(gapFor('medium', length));
    }
  });

  it('keeps Easy and Medium steady, and shrinks Hard as the sequence grows, never below the least gap', () => {
    expect(gapFor('easy', 1)).toBe(gapFor('easy', LONGEST));
    expect(gapFor('medium', 1)).toBe(gapFor('medium', LONGEST));
    expect(gapFor('hard', 5)).toBeLessThan(gapFor('hard', 1));
    for (let length = 2; length <= 100; length += 1) {
      expect(gapFor('hard', length)).toBeLessThanOrEqual(gapFor('hard', length - 1));
      expect(gapFor('hard', length)).toBeGreaterThanOrEqual(LEAST_GAP);
    }
    expect(gapFor('hard', 100)).toBe(LEAST_GAP);
  });
});

describe('Color Echo playing', () => {
  it('lights each pad of the sequence in turn, one at a time, then is done', () => {
    const echo = { ...open('hard', 3), length: 3 };
    const lit: number[] = [];
    let last: number | null = null;
    let done = false;
    for (let now = 0; now < 20_000 && !done; now += 1) {
      const playing = playingAt(echo, now);
      if (playing.step !== null && playing.step !== last) lit.push(echo.sequence[playing.step]!);
      if (playing.step !== null) expect(playing.lit).toBe(echo.sequence[playing.step]);
      else expect(playing.lit).toBeNull();
      last = playing.step;
      done = playing.done;
    }
    expect(done).toBe(true);
    expect(lit).toEqual(echo.sequence.slice(0, 3));
  });

  it('depends only on elapsed Round time: steps of 8, 16 or 33 ms reach the same step at the same time', () => {
    const echo = { ...open('hard', 4, 1000), length: 6 };
    const walk = (tick: number) => {
      const seen = new Map<number, Playing & { phase: Echo['phase'] }>();
      let state = echo;
      for (let now = 1000; now <= 1000 + 12 * 528; now += tick) {
        state = advance(state, now);
        if ((now - 1000) % 528 === 0)
          seen.set(now, { ...playingAt(state, now), phase: state.phase });
      }
      return seen;
    };
    const by8 = walk(8);
    expect(walk(16)).toEqual(by8);
    expect(walk(33)).toEqual(by8);
    expect([...by8.values()].some((seen) => seen.step !== null)).toBe(true);
  });

  it('hands over to the Player once the sequence has played, and not before', () => {
    const echo = open('easy', 2, 500);
    expect(advance(echo, 500).phase).toBe('playing');
    let now = 500;
    while (!playingAt(echo, now).done) now += 1;
    expect(advance(echo, now - 1).phase).toBe('playing');
    expect(advance(echo, now)).toMatchObject({ phase: 'repeating', entered: 0 });
  });
});

/** The Round moved on until the Player may repeat the sequence, and when that is. */
function handOver(echo: Echo): { echo: Echo; now: number } {
  let now = echo.since;
  while (!playingAt(echo, now).done) now += 1;
  return { echo: advance(echo, now), now };
}

/** Repeats the current sequence correctly, from the moment the Player may. */
function repeat(echo: Echo): { echo: Echo; now: number } {
  let { echo: state, now } = handOver(echo);
  for (const pad of state.sequence.slice(0, state.length)) {
    now += 200;
    state = press(state, pad, now).echo;
  }
  return { echo: state, now };
}

describe('Color Echo pressing', () => {
  it('ignores a pad pressed while the Arcade plays the sequence, changing nothing', () => {
    const echo = open('easy', 6);
    const pressed = press(echo, echo.sequence[0]!, 800);
    expect(pressed.outcome).toBe('ignored');
    expect(pressed.echo).toBe(echo);
  });

  it('accepts the right pad, and makes the next sequence the last one with one step added', () => {
    const before = open('medium', 7);
    const { echo: repeating, now } = handOver(before);
    const first = press(repeating, repeating.sequence[0]!, now + 100);
    expect(first.outcome).toBe('correct');
    expect(first.echo).toMatchObject({ phase: 'repeating', entered: 1 });

    const { echo: after, now: then } = repeat(before);
    expect(after).toMatchObject({ phase: 'playing', length: before.length + 1, completed: 1 });
    expect(after.sequence.slice(0, before.length)).toEqual(before.sequence.slice(0, before.length));
    expect(after.since).toBe(then);
    expect(result(after)).toBeNull();
  });

  it('ends a Solo Round on a wrong pad, scoring the sequences completed', () => {
    let echo = open('easy', 8);
    echo = repeat(echo).echo;
    echo = repeat(echo).echo;
    const { echo: repeating, now } = handOver(echo);
    const wrong = (repeating.sequence[0]! + 1) % padCount('easy');
    const pressed = press(repeating, wrong, now + 50);
    expect(pressed.outcome).toBe('wrong');
    expect(pressed.echo.phase).toBe('over');
    expect(result(pressed.echo)).toEqual({ kind: 'solo', score: 2 });
    expect(press(pressed.echo, 0, now + 100).outcome).toBe('ignored');
  });

  it('ends the Round on its own once a sequence of the longest length has been repeated', () => {
    for (const difficulty of DIFFICULTIES) {
      let echo = open(difficulty, 11);
      const first = echo.length;
      while (echo.phase !== 'over') {
        expect(echo.length).toBeLessThanOrEqual(LONGEST);
        echo = repeat(echo).echo;
      }
      expect(echo.length).toBe(LONGEST);
      expect(result(echo)).toEqual({ kind: 'solo', score: LONGEST - first + 1 });
    }
  });
});
