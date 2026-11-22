import { describe, expect, it } from 'vitest';
import type { Difficulty, Rng } from '@/contract';
import { createRng } from '@/kit/rng';
import { computerPlayer } from './computer-player';
import { rules, type Cell, type TicTacToe } from './rules';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** Every position a Round can reach where a Move is still to be made, from either first Seat. */
function reachable(): TicTacToe[] {
  const seen = new Map<string, TicTacToe>();
  const visit = (state: TicTacToe) => {
    const key = JSON.stringify(state);
    if (seen.has(key) || rules.result(state)) return;
    seen.set(key, state);
    for (const cell of rules.legalMoves(state)) visit(rules.apply(state, cell));
  };
  for (const first of [0, 1] as const) {
    visit(rules.start({ seats: 2, difficulty: 'easy', seed: 0, first }));
  }
  return [...seen.values()];
}

const POSITIONS = reachable();
/** The tests that visit every position take a second or two, and longer on a busy machine. */
const EVERY_POSITION = { timeout: 30_000 };

/** The Moves after which `seat` has three in a line. */
const winsFor = (state: TicTacToe, seat: number) =>
  rules.legalMoves(state).filter((cell) => {
    const board = state.board.map((mark, index) => (index === cell ? seat : mark));
    return rules.result({ ...state, board: board as TicTacToe['board'] })?.kind === 'win';
  });

/** True if, after `cell`, the other Seat can win with its next Move. */
const leavesALoss = (state: TicTacToe, cell: number) => {
  const after = rules.apply(state, cell);
  return !rules.result(after) && winsFor(after, rules.seatToMove(after)).length > 0;
};

/** What perfect play from here gives the Seat to move: 1 a win, 0 a draw, -1 a loss. */
const outcome = (() => {
  const known = new Map<string, number>();
  const value = (state: TicTacToe): number => {
    const key = JSON.stringify(state);
    const cached = known.get(key);
    if (cached !== undefined) return cached;
    const result = rules.result(state);
    // A finished Round was won by the Seat that just moved, so it is a loss for the Seat to move.
    const found = result
      ? result.kind === 'win'
        ? -1
        : 0
      : Math.max(...rules.legalMoves(state).map((cell) => -value(rules.apply(state, cell))));
    known.set(key, found);
    return found;
  };
  return value;
})();

/** True if `cell` gives the Seat to move a worse outcome than its best Move would. */
const isMistake = (state: TicTacToe, cell: number) =>
  -outcome(rules.apply(state, cell)) < outcome(state);

/** An opponent's way of choosing a Move. */
type Opponent = (state: TicTacToe, rng: Rng) => Cell;

/** Any legal Move. */
const random: Opponent = (state, rng) => rng.pick(rules.legalMoves(state));

/** A win whenever one is on offer, and otherwise any legal Move. */
const takesAnyWin: Opponent = (state, rng) => {
  const wins = winsFor(state, rules.seatToMove(state));
  return rng.pick(wins.length > 0 ? wins : rules.legalMoves(state));
};

const ROUNDS = 500;

/**
 * Plays fixed-seed Rounds of the Computer Player, in Seat 0, at `difficulty` against `opponent`,
 * each Seat moving first in turn. Returns how often the Computer Player won, drew and lost, and
 * how many of its Moves were mistakes out of those that could have been.
 */
function tally(difficulty: Difficulty, opponent: Opponent) {
  const counts = { win: 0, draw: 0, loss: 0, mistakes: 0, chances: 0 };
  for (let round = 0; round < ROUNDS; round += 1) {
    const mine = createRng(round);
    const theirs = createRng(round + ROUNDS);
    let state = rules.start({ seats: 2, difficulty, seed: round, first: (round % 2) as 0 | 1 });
    while (!rules.result(state)) {
      let cell: Cell;
      if (rules.seatToMove(state) === 0) {
        cell = computerPlayer(state, difficulty, mine);
        if (rules.legalMoves(state).some((other) => isMistake(state, other))) {
          counts.chances += 1;
          if (isMistake(state, cell)) counts.mistakes += 1;
        }
      } else {
        cell = opponent(state, theirs);
      }
      state = rules.apply(state, cell);
    }
    const result = rules.result(state)!;
    if (result.kind === 'draw') counts.draw += 1;
    else if (result.kind === 'win' && result.winners.includes(0)) counts.win += 1;
    else counts.loss += 1;
  }
  return counts;
}

describe('Tic-Tac-Toe’s Computer Player', () => {
  it(
    'always returns a legal Move, and the same state, Difficulty and seed give the same Move',
    EVERY_POSITION,
    () => {
      expect(POSITIONS.length).toBeGreaterThan(4000);
      POSITIONS.forEach((state, seed) => {
        for (const difficulty of DIFFICULTIES) {
          const move = computerPlayer(state, difficulty, createRng(seed));
          expect(rules.legalMoves(state)).toContain(move);
          expect(computerPlayer(state, difficulty, createRng(seed))).toBe(move);
        }
      });
    },
  );

  it(
    'on Medium takes a winning Move whenever one exists, and otherwise blocks an immediate loss whenever it can',
    EVERY_POSITION,
    () => {
      let wins = 0;
      let blocks = 0;
      for (const state of POSITIONS) {
        const me = rules.seatToMove(state);
        const winning = winsFor(state, me);
        const threatened = rules.legalMoves(state).some((cell) => leavesALoss(state, cell));
        const blocking = rules.legalMoves(state).filter((cell) => !leavesALoss(state, cell));
        for (const seed of [1, 2, 3]) {
          const move = computerPlayer(state, 'medium', createRng(seed));
          if (winning.length > 0) {
            expect(winning, JSON.stringify(state)).toContain(move);
            wins += 1;
          } else if (threatened && blocking.length > 0) {
            expect(blocking, JSON.stringify(state)).toContain(move);
            blocks += 1;
          }
        }
      }
      expect(wins).toBeGreaterThan(0);
      expect(blocks).toBeGreaterThan(0);
    },
  );

  it('on Easy chooses among all legal Moves, a win or a block no likelier than any other', () => {
    // The second Seat, to move, can win at cell 5, and must block the top row at cell 2.
    let state = rules.start({ seats: 2, difficulty: 'easy', seed: 0, first: 0 });
    for (const cell of [0, 3, 1, 4, 8]) state = rules.apply(state, cell);
    expect(winsFor(state, rules.seatToMove(state))).toEqual([5]);
    // Every other Move loses at once.
    expect(rules.legalMoves(state).filter((cell) => !leavesALoss(state, cell))).toEqual([2, 5]);
    const counts = new Map<number, number>();
    for (let seed = 0; seed < 400; seed += 1) {
      const move = computerPlayer(state, 'easy', createRng(seed));
      counts.set(move, (counts.get(move) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual(rules.legalMoves(state));
    // Each of the four is chosen about 100 times in 400.
    for (const [cell, count] of counts) {
      expect(count, `cell ${cell}`).toBeGreaterThan(60);
      expect(count, `cell ${cell}`).toBeLessThan(140);
    }
  });

  it(`over ${ROUNDS} fixed-seed Rounds, Hard wins or draws at least 85% against a random opponent`, () => {
    const { win, draw } = tally('hard', random);
    expect((win + draw) / ROUNDS).toBeGreaterThanOrEqual(0.85);
  });

  it(`over ${ROUNDS} fixed-seed Rounds, Easy loses at least 60% to an opponent that takes any win on offer`, () => {
    const { loss } = tally('easy', takesAnyWin);
    expect(loss / ROUNDS).toBeGreaterThanOrEqual(0.6);
  });

  it('makes a Move that is not the best about one time in ten on Hard, so no level plays perfectly', () => {
    for (const opponent of [random, takesAnyWin]) {
      const { mistakes, chances } = tally('hard', opponent);
      expect(chances).toBeGreaterThan(200);
      expect(mistakes / chances).toBeGreaterThan(0.05);
      expect(mistakes / chances).toBeLessThan(0.15);
    }
    for (const difficulty of ['easy', 'medium'] as const) {
      const { mistakes } = tally(difficulty, random);
      expect(mistakes, difficulty).toBeGreaterThan(0);
    }
  });
});
