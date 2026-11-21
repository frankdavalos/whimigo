import * as Phaser from 'phaser';
import type { RoundStart, SeatIndex, SnapshotTarget } from '@/contract';
import { picture } from '@/kit/atlas';
import { openRound } from '@/kit/round';
import { colors } from '@/kit/theme';
import { turnGate } from '@/kit/turn-gate';
import { drawTurnPointer } from '@/kit/turn-pointer';
import { rules, type Cell } from '../logic/rules';

/** A cell's size in design units; the board's art is three cells and a border across. */
const CELL = 384;

/** Two Players take Turns on one board. */
export class TicTacToeScene extends Phaser.Scene {
  create(start: RoundStart): void {
    const round = openRound(this, start);
    const { safe } = round.stage;
    const { seats, seating, difficulty } = round.session;
    round.stage.backdrop({ color: colors.sky });

    let state = rules.start({
      seats: seats.length,
      difficulty,
      seed: start.seed,
      first: (round.number % seats.length) as SeatIndex,
    });
    const middle = { x: safe.x + safe.width / 2, y: safe.y + safe.height / 2 };
    picture(this, middle.x, middle.y, 'tic-tac-toe/board');

    const marks: (Phaser.GameObjects.Image | null)[] = state.board.map(() => null);
    const pointer = drawTurnPointer(this, safe, seats.length, seating);
    pointer.point(rules.seatToMove(state), seats[rules.seatToMove(state)]!.shape);
    const gate = turnGate(this);

    const place = (cell: Cell, x: number, y: number) => {
      if (!rules.legalMoves(state).includes(cell)) return;
      const seat = rules.seatToMove(state);
      state = rules.apply(state, cell);
      marks[cell] = picture(this, x, y, seats[seat]!.shape);
      const result = rules.result(state);
      if (result) {
        gate.close();
        round.audio.sfx(result.kind === 'win' ? 'tic-tac-toe/line' : 'tic-tac-toe/place');
        round.finish(result);
        return;
      }
      round.audio.sfx('tic-tac-toe/place');
      const next = rules.seatToMove(state);
      pointer.point(next, seats[next]!.shape);
    };

    const targets: Record<string, SnapshotTarget> = {};
    state.board.forEach((_, cell) => {
      const x = middle.x + ((cell % 3) - 1) * CELL;
      const y = middle.y + (Math.floor(cell / 3) - 1) * CELL;
      this.add
        .rectangle(x, y, CELL, CELL)
        .setInteractive()
        .on(
          'pointerdown',
          gate.guard(() => place(cell, x, y)),
        );
      targets[`cell-${cell}`] = {
        x,
        y,
        rect: { x: x - CELL / 2, y: y - CELL / 2, width: CELL, height: CELL },
      };
    });

    round.expose(() => ({
      state: {
        board: state.board,
        toMove: rules.seatToMove(state),
        marks: marks.map((mark, cell) =>
          mark ? { seat: state.board[cell], frame: mark.frame.name } : null,
        ),
        result: rules.result(state),
      },
      targets: { ...targets, 'turn-pointer': pointer.target() },
    }));
  }
}
