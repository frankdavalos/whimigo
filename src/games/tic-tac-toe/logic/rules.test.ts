import { describe, expect, it } from 'vitest';
import { checkTurnRules } from '@/kit/turn';
import { rules, type Board } from './rules';

const start = (first: 0 | 1 = 0) => rules.start({ seats: 2, difficulty: 'easy', seed: 1, first });

/** Plays cells in order, alternating Seats from the first. */
const play = (cells: number[], first: 0 | 1 = 0) =>
  cells.reduce((state, cell) => rules.apply(state, cell), start(first));

describe('Tic-Tac-Toe rules', () => {
  it('start with an empty three-by-three board and the first Seat to move', () => {
    const state = start();
    expect(state.board).toEqual(Array(9).fill(null));
    expect(rules.seatToMove(state)).toBe(0);
    expect(rules.legalMoves(state)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(rules.result(state)).toBeNull();
  });

  it('let the Round say which Seat moves first', () => {
    expect(rules.seatToMove(start(1))).toBe(1);
    expect(play([4], 1).board[4]).toBe(1);
  });

  it('place the mark of the Seat to move and pass the Turn', () => {
    const state = play([4]);
    expect(state.board[4]).toBe(0);
    expect(rules.seatToMove(state)).toBe(1);
    expect(play([4, 0]).board[0]).toBe(1);
    expect(rules.seatToMove(play([4, 0]))).toBe(0);
  });

  it('refuse a taken cell and leave the state as it was', () => {
    const state = play([4]);
    expect(rules.legalMoves(state)).not.toContain(4);
    expect(() => rules.apply(state, 4)).toThrow();
    expect(() => rules.apply(state, 9)).toThrow();
    expect(state.board[4]).toBe(0);
    expect(rules.seatToMove(state)).toBe(1);
  });

  it('end the Round as a win for three marks of one Seat in any of the eight lines', () => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    for (const line of lines) {
      const others = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((cell) => !line.includes(cell));
      // Two marks of the second Seat can never make a line.
      const moves = [line[0]!, others[0]!, line[1]!, others[1]!, line[2]!];
      const state = play(moves);
      expect(rules.result(state), `line ${line.join('-')}`).toEqual({ kind: 'win', winners: [0] });
      expect(rules.legalMoves(state)).toEqual([]);
      expect(() => rules.apply(state, others[others.length - 1]!)).toThrow();
    }
  });

  it('end the Round as a win for the second Seat too', () => {
    expect(rules.result(play([0, 3, 1, 4, 8, 5]))).toEqual({ kind: 'win', winners: [1] });
  });

  it('end a full board with no line as a draw, after which no Move is accepted', () => {
    const state = play([0, 1, 2, 4, 3, 5, 7, 6, 8]);
    expect(rules.result(state)).toEqual({ kind: 'draw' });
    expect(rules.legalMoves(state)).toEqual([]);
  });

  it('never change the state they are given', () => {
    const state = play([4, 0]);
    const board: Board = [...state.board];
    rules.apply(state, 8);
    expect(state.board).toEqual(board);
  });

  it('pass the shared Turn-Based rules check', () => {
    expect(checkTurnRules(rules, { seats: [2] })).toEqual([]);
  });
});
