import type { SeatIndex } from '@/contract';
import type { TurnRules } from '@/kit/turn';

/**
 * Looking ahead in any Game that follows the TurnRules convention. It knows nothing of
 * Tic-Tac-Toe, so the shared search of Phase 2 can take it as it is.
 */

const wonBy = <State, Move>(rules: TurnRules<State, Move>, state: State, seat: SeatIndex) => {
  const result = rules.result(state);
  return result?.kind === 'win' && result.winners.includes(seat);
};

/** The Moves that win at once for the Seat to move. */
export function winningMoves<State, Move>(rules: TurnRules<State, Move>, state: State): Move[] {
  const me = rules.seatToMove(state);
  return rules.legalMoves(state).filter((move) => wonBy(rules, rules.apply(state, move), me));
}

/** A win's score; each Move that it takes to come counts one less, so a sooner win scores more. */
const WIN = 1000;

/** A Move, and what perfect play after it gives the Seat that makes it. */
export interface ScoredMove<Move> {
  readonly move: Move;
  /** Above zero a win, zero a draw, below zero a loss; the further from zero, the sooner. */
  readonly score: number;
}

/**
 * Each set of rules' scores, by the Seat they are for and the position. A position's score does not
 * depend on how it was reached, so it holds for every later search: a Game small enough to search
 * to the end, like Tic-Tac-Toe, is scored once.
 */
const scores = new WeakMap<object, Map<string, number>>();

/**
 * Scores every legal Move for the Seat to move by searching to the end of the Round, supposing
 * every other Seat plays against it.
 */
export function scoreMoves<State, Move>(
  rules: TurnRules<State, Move>,
  state: State,
): ScoredMove<Move>[] {
  const me = rules.seatToMove(state);
  const known = scores.get(rules) ?? new Map<string, number>();
  scores.set(rules, known);
  const value = (position: State): number => {
    const key = `${me} ${JSON.stringify(position)}`;
    const cached = known.get(key);
    if (cached !== undefined) return cached;
    const result = rules.result(position);
    let found: number;
    if (result) {
      found = result.kind === 'win' ? (result.winners.includes(me) ? WIN : -WIN) : 0;
    } else {
      const children = rules.legalMoves(position).map((move) => value(rules.apply(position, move)));
      const best =
        rules.seatToMove(position) === me ? Math.max(...children) : Math.min(...children);
      found = best - Math.sign(best);
    }
    known.set(key, found);
    return found;
  };
  return rules.legalMoves(state).map((move) => ({ move, score: value(rules.apply(state, move)) }));
}

/** The Moves after which the next Seat to move cannot win at once. */
export function safeMoves<State, Move>(rules: TurnRules<State, Move>, state: State): Move[] {
  return rules.legalMoves(state).filter((move) => {
    const after = rules.apply(state, move);
    return rules.result(after) !== null || winningMoves(rules, after).length === 0;
  });
}
