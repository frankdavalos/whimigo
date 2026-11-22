import type { ComputerPlayer } from '@/kit/turn';
import { rules, type Cell, type TicTacToe } from './rules';
import { safeMoves, scoreMoves, winningMoves } from './search';

/** How often Hard makes a Move with a worse outcome than its best, where it has one. */
const SLIP = 0.1;

/**
 * Chooses the Computer Player's Move. Easy chooses among all legal Moves; Medium takes a win, and
 * otherwise a Move that leaves the other Seat no win at once; Hard plays a best Move, except about
 * one time in ten.
 */
export const computerPlayer: ComputerPlayer<TicTacToe, Cell> = (state, difficulty, rng) => {
  const legal = rules.legalMoves(state);
  if (difficulty === 'easy') return rng.pick(legal);
  if (difficulty === 'medium') {
    const winning = winningMoves(rules, state);
    if (winning.length > 0) return rng.pick(winning);
    const safe = safeMoves(rules, state);
    return rng.pick(safe.length > 0 ? safe : legal);
  }
  const scored = scoreMoves(rules, state);
  const top = Math.max(...scored.map(({ score }) => score));
  const best = scored.filter(({ score }) => score === top);
  const worse = scored.filter(({ score }) => Math.sign(score) < Math.sign(top));
  const slip = rng.next() < SLIP && worse.length > 0;
  return rng.pick(slip ? worse : best).move;
};
