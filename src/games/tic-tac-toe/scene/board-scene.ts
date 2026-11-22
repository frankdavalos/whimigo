import * as Phaser from 'phaser';
import type { RoundStart, SeatIndex, SnapshotTarget } from '@/contract';
import { picture } from '@/kit/atlas';
import { openRound } from '@/kit/round';
import { colors, sizes } from '@/kit/theme';
import { turnGate } from '@/kit/turn-gate';
import { turnPointer } from '@/kit/turn-pointer';
import { computerPlayer } from '../logic/computer-player';
import { rules, type Cell } from '../logic/rules';

/** A cell's size in design units; the board's art is three cells and a border across. */
const CELL = 384;
/** The part of a cell that takes touches, leaving the standard gap between neighbouring cells. */
const TOUCH = CELL - sizes.gap;
/** How long the Computer Player takes to choose, in milliseconds of the Round's own time. */
const CHOOSING = 600;

/** What a Computer Player is doing on its Turn: choosing its Move, then placing its mark. */
type ComputerTurn =
  { readonly phase: 'choosing'; readonly until: number } | { readonly phase: 'placing' };

/** Two Seats take Turns on one board: two Players, or a Player and a Computer Player. */
export class TicTacToeScene extends Phaser.Scene {
  /** Moves the Round on, once a frame. */
  private step: () => void = () => undefined;

  override update(): void {
    this.step();
  }

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
    const pointer = turnPointer(this, safe, seats.length, seating);
    const gate = turnGate(this);
    const versusComputer = seats.some(({ occupant }) => occupant.kind === 'computer');
    let computer: ComputerTurn | null = null;

    /** Gives the Turn to `seat`; a Computer Player's Turn closes the gate while it plays. */
    const turnTo = (seat: SeatIndex) => {
      pointer.point(seat, seats[seat]!.shape);
      if (seats[seat]!.occupant.kind !== 'computer') return;
      gate.close();
      computer = { phase: 'choosing', until: round.now() + CHOOSING };
    };
    turnTo(rules.seatToMove(state));

    const targets: Record<string, SnapshotTarget> = {};
    const centre = (cell: Cell) => targets[`cell-${cell}`]!;

    /** Makes a legal Move for the Seat to move; returns its mark, or null if the Round ended. */
    const move = (cell: Cell) => {
      const seat = rules.seatToMove(state);
      state = rules.apply(state, cell);
      const mark = picture(this, centre(cell).x, centre(cell).y, seats[seat]!.shape);
      marks[cell] = mark;
      const result = rules.result(state);
      if (result) {
        gate.close();
        round.audio.sfx(result.kind === 'win' ? 'tic-tac-toe/line' : 'tic-tac-toe/place');
        round.finish(result);
        return null;
      }
      round.audio.sfx('tic-tac-toe/place');
      turnTo(rules.seatToMove(state));
      return mark;
    };

    const place = (cell: Cell) => {
      if (rules.legalMoves(state).includes(cell)) {
        move(cell);
        return;
      }
      const taken = marks[cell];
      if (taken) round.refuse(taken);
    };

    this.step = () => {
      if (computer?.phase !== 'choosing' || round.now() < computer.until) return;
      computer = { phase: 'placing' };
      const mark = move(computerPlayer(state, difficulty, round.rng));
      if (!mark) {
        computer = null;
        return;
      }
      void round.motion.play(mark, 'pop').then(() => {
        computer = null;
        gate.open();
      });
    };

    state.board.forEach((_, cell) => {
      const x = middle.x + ((cell % 3) - 1) * CELL;
      const y = middle.y + (Math.floor(cell / 3) - 1) * CELL;
      targets[`cell-${cell}`] = {
        x,
        y,
        rect: { x: x - TOUCH / 2, y: y - TOUCH / 2, width: TOUCH, height: TOUCH },
      };
      const tap = gate.guard(() => place(cell));
      this.add
        .rectangle(x, y, TOUCH, TOUCH)
        .setInteractive()
        // Out of Turn, the pointer, which shows whose Turn it is, gives the gentle no.
        .on('pointerdown', (touch: Phaser.Input.Pointer) =>
          gate.isOpen ? tap(touch) : round.refuse(pointer.image),
        );
    });

    // A mark in the middle, and "not that one" at the middle again. Between two Players, the
    // other Seat marks a corner in between.
    const at = (cell: Cell) => ({ x: centre(cell).x, y: centre(cell).y });
    void round.demo([
      { tap: at(4) },
      { wait: 300 },
      ...(versusComputer ? [] : [{ tap: at(0) }, { wait: 300 }]),
      { refuse: at(4) },
    ]);

    /** Where a picture is drawn, in design units, whatever holds it. */
    const drawnAt = (image: Phaser.GameObjects.Image) => {
      const { tx, ty } = image.getWorldTransformMatrix();
      return { x: tx, y: ty };
    };
    const shown = (seat: SeatIndex) => ({
      seat,
      shape: seats[seat]!.shape,
      color: seats[seat]!.color,
    });
    round.expose(() => ({
      state: {
        board: state.board,
        toMove: rules.seatToMove(state),
        // Each Seat shown, as drawn: its shape, and the colour that shape is drawn in.
        pointer: { ...shown(rules.seatToMove(state)), at: drawnAt(pointer.image) },
        marks: marks.map((mark, cell) =>
          mark ? { ...shown(state.board[cell] as SeatIndex), shape: mark.frame.name } : null,
        ),
        computer: computer?.phase ?? null,
        result: rules.result(state),
      },
      targets: { ...targets, 'turn-pointer': pointer.target() },
    }));
  }
}
