import { describe, expect, it } from 'vitest';
import type { Result, SeatIndex } from '@/contract';
import { checkTurnRules, type TurnRules } from './turn';

/** A fair little game: Seats take Turns adding 1 or 2 to a count; whoever reaches 10 wins. */
interface Count {
  readonly total: number;
  readonly seats: number;
  readonly toMove: SeatIndex;
  readonly winner: SeatIndex | null;
}
const counting: TurnRules<Count, 1 | 2> = {
  start: ({ seats, first }) => ({ total: 0, seats, toMove: first, winner: null }),
  seatToMove: (state) => state.toMove,
  legalMoves: (state) => (state.winner === null ? [1, 2] : []),
  apply(state, move) {
    if (state.winner !== null) throw new Error('The Round is over');
    const total = state.total + move;
    return {
      ...state,
      total,
      winner: total >= 10 ? state.toMove : null,
      toMove: ((state.toMove + 1) % state.seats) as SeatIndex,
    };
  },
  result: (state): Result | null =>
    state.winner === null ? null : { kind: 'win', winners: [state.winner] },
};

describe('the shared Turn-Based rules check', () => {
  it('passes rules that keep every promise, for two, three and four Seats', () => {
    expect(checkTurnRules(counting, { seats: [2, 3, 4] })).toEqual([]);
  });

  it('fails rules that change the state they are given', () => {
    const mutating: TurnRules<{ total: number; toMove: SeatIndex }, 1> = {
      start: ({ first }) => ({ total: 0, toMove: first }),
      seatToMove: (state) => state.toMove,
      legalMoves: (state) => (state.total < 5 ? [1] : []),
      apply(state) {
        state.total += 1;
        return { ...state };
      },
      result: (state) => (state.total < 5 ? null : { kind: 'draw' }),
    };
    expect(checkTurnRules(mutating)).toEqual([expect.stringMatching(/changed the state/)]);
  });

  it('fails rules whose Rounds never end', () => {
    const endless: TurnRules<Count, 1 | 2> = { ...counting, apply: (state) => ({ ...state }) };
    expect(checkTurnRules(endless)).toEqual([expect.stringMatching(/did not end/)]);
  });

  it('fails rules whose Result names a Seat not in the Session', () => {
    const stranger: TurnRules<Count, 1 | 2> = {
      ...counting,
      result: (state) =>
        state.winner === null
          ? null
          : { kind: 'win', winners: [state.seats as SeatIndex], scores: {} },
    };
    expect(checkTurnRules(stranger)).toEqual([expect.stringMatching(/not in the Session/)]);
  });

  it('fails rules that give the Turn to a Seat not in the Session', () => {
    const wandering: TurnRules<Count, 1 | 2> = { ...counting, seatToMove: () => 3 };
    expect(checkTurnRules(wandering)).toEqual([expect.stringMatching(/Turn to Seat 3/)]);
  });

  it('fails rules that run out of legal Moves before a Result', () => {
    const stuck: TurnRules<Count, 1 | 2> = {
      ...counting,
      legalMoves: (state) => (state.total < 4 ? [1, 2] : []),
    };
    expect(checkTurnRules(stuck)).toEqual([expect.stringMatching(/no legal Move/)]);
  });
});
