import { describe, expect, it } from 'vitest';
import type { Difficulty, SeatIndex } from '@/contract';
import { checkTurnRules } from '@/kit/turn';
import { LONGEST } from './rules';
import {
  LIVES,
  lengthOf,
  phaseAt,
  playingAt,
  pressTurn,
  startTurns,
  turnRules,
  type TurnEcho,
  type Turns,
} from './turns';

const open = (seats: number, first: SeatIndex = 0, difficulty: Difficulty = 'easy', seed = 1) =>
  turnRules.start({ seats, difficulty, seed, first });

/** The pads the sequence asks for in the current Turn. */
const right = (turns: Turns) => turns.sequence.slice(0, lengthOf(turns));

/** The current Turn's pads up to `slip`, then a wrong one there. */
const wrongAt = (turns: Turns, slip = 0) => {
  const pads = right(turns).slice(0, slip);
  return [...pads, (turns.sequence[slip]! + 1) % 3];
};

describe('Color Echo Turn-Based: Turns', () => {
  it('gives each Seat in order a Turn at the same length, starting from the first, and grows the sequence only after every Seat has had one', () => {
    for (const seats of [2, 3, 4]) {
      let turns = open(seats, 1);
      const seen: { seat: number; length: number }[] = [];
      for (let turn = 0; turn < seats * 2; turn += 1) {
        seen.push({ seat: turnRules.seatToMove(turns), length: lengthOf(turns) });
        turns = turnRules.apply(turns, right(turns));
      }
      const order = Array.from({ length: seats }, (_, index) => (1 + index) % seats);
      expect(seen).toEqual([
        ...order.map((seat) => ({ seat, length: 1 })),
        ...order.map((seat) => ({ seat, length: 2 })),
      ]);
    }
  });

  it('passes the Turn after a wrong pad too, and still grows only once every Seat has had a Turn', () => {
    let turns = open(3);
    turns = turnRules.apply(turns, wrongAt(turns));
    expect(turnRules.seatToMove(turns)).toBe(1);
    expect(lengthOf(turns)).toBe(1);
    turns = turnRules.apply(turns, right(turns));
    turns = turnRules.apply(turns, wrongAt(turns));
    expect(turnRules.seatToMove(turns)).toBe(0);
    expect(lengthOf(turns)).toBe(2);
  });

  it('gives each Seat three lives; a wrong pad costs the Seat whose Turn it is one, and a Seat with a life left plays on', () => {
    let turns = open(2, 1);
    expect(turns.lives).toEqual([LIVES, LIVES]);
    turns = turnRules.apply(turns, wrongAt(turns));
    expect(turns.lives).toEqual([3, 2]);
    turns = turnRules.apply(turns, right(turns));
    expect(turns.lives).toEqual([3, 2]);
    turns = turnRules.apply(turns, wrongAt(turns));
    expect(turns.lives).toEqual([3, 1]);
    expect(turnRules.result(turns)).toBeNull();
    expect(turnRules.seatToMove(turns)).toBe(0);
  });

  it('counts a wrong pad after some right ones, and refuses pads that are not a whole Turn', () => {
    const given = open(2, 0, 'hard');
    const before = JSON.stringify(given);
    const turns = turnRules.apply(given, wrongAt(given, 2));
    expect(turns.lives).toEqual([2, 3]);
    expect(JSON.stringify(given), 'the state given is unchanged').toBe(before);
    const fresh = open(2, 0, 'hard');
    expect(() => turnRules.apply(fresh, right(fresh).slice(0, 2))).toThrow();
    expect(() => turnRules.apply(fresh, [...wrongAt(fresh), 0])).toThrow();
    expect(() => turnRules.apply(fresh, [7])).toThrow();
  });

  it('offers as Moves the whole sequence, and every slip at every step', () => {
    const turns = open(2, 0, 'medium');
    const moves = turnRules.legalMoves(turns);
    // Two steps on Medium, four pads: the sequence, or one of three wrong pads at either step.
    expect(moves).toHaveLength(1 + 2 * 3);
    expect(moves).toContainEqual(right(turns));
    for (const move of moves) expect(() => turnRules.apply(turns, move)).not.toThrow();
  });

  it('ends when a Seat loses its last life, naming the Seats with the most lives left as winners', () => {
    let turns = open(3);
    // Seat 0 slips three times; Seat 1 slips once and Seat 2 never does.
    const slips = [true, true, false, true, false, false, true];
    for (const slip of slips) {
      expect(turnRules.result(turns)).toBeNull();
      turns = turnRules.apply(turns, slip ? wrongAt(turns) : right(turns));
    }
    expect(turns.lives).toEqual([0, 2, 3]);
    expect(turnRules.result(turns)).toEqual({
      kind: 'win',
      winners: [2],
      scores: { 0: 0, 1: 2, 2: 3 },
    });
    expect(turnRules.legalMoves(turns)).toEqual([]);
  });

  it('names every Seat tied on the most lives as a winner', () => {
    let turns = open(3);
    for (const slip of [true, false, false, true, false, false, true]) {
      turns = turnRules.apply(turns, slip ? wrongAt(turns) : right(turns));
    }
    expect(turnRules.result(turns)).toMatchObject({ kind: 'win', winners: [1, 2] });
  });

  it('ends once every Seat has had its Turn at the longest length: a draw when every Seat has the same lives', () => {
    let turns = open(2, 0, 'hard');
    while (!turnRules.result(turns)) {
      expect(lengthOf(turns)).toBeLessThanOrEqual(LONGEST);
      turns = turnRules.apply(turns, right(turns));
    }
    expect(turns.turn).toBe(2 * (LONGEST - 2));
    expect(turnRules.result(turns)).toEqual({ kind: 'draw', scores: { 0: 3, 1: 3 } });
  });

  it('ends at the longest length with the Seat that slipped least winning', () => {
    let turns = open(2, 0, 'hard');
    turns = turnRules.apply(turns, wrongAt(turns));
    while (!turnRules.result(turns)) turns = turnRules.apply(turns, right(turns));
    expect(turnRules.result(turns)).toMatchObject({ kind: 'win', winners: [1] });
  });

  it('starts at the Difficulty’s first length', () => {
    expect(lengthOf(open(2, 0, 'easy'))).toBe(1);
    expect(lengthOf(open(2, 0, 'medium'))).toBe(2);
    expect(lengthOf(open(2, 0, 'hard'))).toBe(3);
  });

  it('draws a sequence of the longest length from the seed', () => {
    expect(open(2).sequence).toHaveLength(LONGEST);
    expect(open(2, 0, 'medium', 9).sequence).toEqual(open(3, 1, 'medium', 9).sequence);
  });
});

describe('Color Echo Turn-Based: the shared rules check', () => {
  it('passes for two, three and four Seats', () => {
    expect(checkTurnRules(turnRules, { seats: [2, 3, 4] })).toEqual([]);
  });
});

describe('Color Echo Turn-Based: a Turn, press by press', () => {
  const begin = (seats = 2, difficulty: Difficulty = 'easy') =>
    startTurns({ seats, difficulty, seed: 3, first: 0, at: 100 });

  /** The Round time when the Arcade has played the current Turn's sequence. */
  const played = (echo: TurnEcho) => {
    let now = echo.since;
    while (phaseAt(echo, now) === 'playing') now += 10;
    return now;
  };

  it('plays the sequence for the Seat whose Turn it is, and ignores a pad pressed meanwhile', () => {
    const echo = begin();
    expect(phaseAt(echo, 100)).toBe('playing');
    expect(playingAt(echo, played(echo) - 1).done).toBe(false);
    const pressing = pressTurn(echo, echo.turns.sequence[0]!, 101);
    expect(pressing).toEqual({ echo, outcome: 'ignored' });
    expect(phaseAt(echo, played(echo))).toBe('repeating');
  });

  it('counts every press for the Seat whose Turn it is, then passes the Turn and plays the sequence again for the next Seat', () => {
    let echo = begin(2, 'medium');
    const now = played(echo);
    const [a, b] = echo.turns.sequence;
    let pressing = pressTurn(echo, a!, now);
    expect(pressing.outcome).toBe('correct');
    echo = pressing.echo;
    expect(echo.pressed).toEqual([a]);
    expect(turnRules.seatToMove(echo.turns)).toBe(0);
    pressing = pressTurn(echo, b!, now + 5);
    expect(pressing.outcome).toBe('repeated');
    echo = pressing.echo;
    expect(turnRules.seatToMove(echo.turns)).toBe(1);
    expect(echo.pressed).toEqual([]);
    expect(echo.since).toBe(now + 5);
    expect(phaseAt(echo, now + 6)).toBe('playing');
  });

  it('takes a life from the Seat whose Turn it is for a wrong pad, and passes the Turn', () => {
    const echo = begin(3);
    const wrong = (echo.turns.sequence[0]! + 1) % 3;
    const pressing = pressTurn(echo, wrong, played(echo));
    expect(pressing.outcome).toBe('wrong');
    expect(pressing.echo.turns.lives).toEqual([2, 3, 3]);
    expect(turnRules.seatToMove(pressing.echo.turns)).toBe(1);
  });

  it('is over once the Round has a Result, and ignores every pad then', () => {
    let echo = begin(2);
    while (!turnRules.result(echo.turns)) {
      const wrong = (echo.turns.sequence[echo.pressed.length]! + 1) % 3;
      echo = pressTurn(echo, wrong, played(echo)).echo;
    }
    expect(phaseAt(echo, echo.since)).toBe('over');
    expect(pressTurn(echo, 0, echo.since + 10_000).outcome).toBe('ignored');
  });
});
