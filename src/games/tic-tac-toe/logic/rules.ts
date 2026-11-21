import type { Result, SeatIndex } from '@/contract';
import type { TurnRules } from '@/kit/turn';

/** Nine cells, row by row from the top left; each empty or holding a Seat's mark. */
export type Board = readonly (SeatIndex | null)[];

export interface TicTacToe {
  readonly board: Board;
  readonly toMove: SeatIndex;
}

/** A Move is the index of the cell to mark. */
export type Cell = number;

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

function result({ board }: TicTacToe): Result | null {
  for (const [a, b, c] of LINES) {
    const seat = board[a];
    if (seat != null && seat === board[b] && seat === board[c]) {
      return { kind: 'win', winners: [seat] };
    }
  }
  return board.every((cell) => cell !== null) ? { kind: 'draw' } : null;
}

function legalMoves(state: TicTacToe): Cell[] {
  if (result(state)) return [];
  return state.board.flatMap((seat, cell) => (seat === null ? [cell] : []));
}

/** Two Seats take Turns marking cells; three in a line wins, a full board is a draw. */
export const rules: TurnRules<TicTacToe, Cell> = {
  start: ({ first }) => ({ board: Array<null>(9).fill(null), toMove: first }),
  seatToMove: (state) => state.toMove,
  legalMoves,
  apply(state, cell) {
    if (!legalMoves(state).includes(cell)) throw new Error(`Cell ${cell} cannot be marked`);
    const board = state.board.map((seat, index) => (index === cell ? state.toMove : seat));
    return { board, toMove: state.toMove === 0 ? 1 : 0 };
  },
  result,
};
