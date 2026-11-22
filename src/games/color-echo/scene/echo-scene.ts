import * as Phaser from 'phaser';
import type { Result, Round, RoundStart, SeatIndex, SnapshotTarget } from '@/contract';
import { picture } from '@/kit/atlas';
import { openRound } from '@/kit/round';
import { colors } from '@/kit/theme';
import { turnGate } from '@/kit/turn-gate';
import { turnPointer, turnPointerRect } from '@/kit/turn-pointer';
import type { ZonedSeats } from '@/kit/zones';
import {
  advance,
  padCount,
  playingAt,
  press,
  result,
  start,
  type Outcome,
  type Pad,
  type Playing,
} from '../logic/rules';
import {
  LIVES,
  lengthOf,
  phaseAt,
  pressTurn,
  startTurns,
  turnRules,
  playingAt as turnPlayingAt,
} from '../logic/turns';
import { PADS } from '../pads';

/** The size the pads' art is drawn at, in design units. */
const ART = 640;
/**
 * A pad's size, and the distance between the centres of two neighbours, in design units. On a
 * shared board taking Turns the pads are smaller, leaving room at the top and bottom edges for the
 * Turn pointer and each Seat's lives.
 */
const BOARD = {
  solo: { pad: 640, spacing: 736 },
  turns: { pad: 512, spacing: 576 },
} as const;
/** How long a pressed pad stays lit, in Round time. */
const PRESSED_FOR = 300;
/** A life's size, and the room between two lives and between the lives and the Turn pointer. */
const LIFE = 80;
const LIFE_GAP = 32;
/** How a lost life is drawn. */
const LOST_ALPHA = 0.25;

/** Where each pad sits, in spacings from the middle: a square of four, or a triangle of three. */
const PLACES: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  3: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0, 0.5],
  ],
  4: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
  ],
};

/** What the Scene needs of a Play Style's rules, whatever they are. */
interface Echoing {
  /** Where the Arcade's playing has reached at `now`, or null when it is not playing. */
  playing(now: number): (Playing & { readonly since: number }) | null;
  /** A pad pressed at `now`. */
  press(pad: Pad, now: number): Outcome;
  result(): Result | null;
  /** The Seat whose Turn it is and every Seat's lives, when Seats take Turns; null otherwise. */
  turn(): { readonly toMove: SeatIndex; readonly lives: readonly number[] } | null;
  /** The rules' part of the snapshot. */
  state(now: number): Record<string, unknown>;
}

/** One Player repeats a growing sequence until a slip. */
function solo(round: Round): Echoing {
  let echo = start({ difficulty: round.session.difficulty, rng: round.rng, at: round.now() });
  return {
    playing(now) {
      echo = advance(echo, now);
      return echo.phase === 'playing' ? { ...playingAt(echo, now), since: echo.since } : null;
    },
    press(pad, now) {
      const pressing = press(echo, pad, now);
      echo = pressing.echo;
      return pressing.outcome;
    },
    result: () => result(echo),
    turn: () => null,
    state: () => ({
      phase: echo.phase,
      length: echo.length,
      entered: echo.entered,
      completed: echo.completed,
      sequence: echo.sequence.slice(0, echo.length),
      result: result(echo),
    }),
  };
}

/** Two to four Seats take Turns at the sequence, each with three lives. */
function turns(round: Round, seed: number): Echoing {
  const { seats, difficulty } = round.session;
  let echo = startTurns({
    seats: seats.length,
    difficulty,
    seed,
    first: (round.number % seats.length) as SeatIndex,
    at: round.now(),
  });
  return {
    playing(now) {
      return phaseAt(echo, now) === 'playing'
        ? { ...turnPlayingAt(echo, now), since: echo.since }
        : null;
    },
    press(pad, now) {
      const pressing = pressTurn(echo, pad, now);
      echo = pressing.echo;
      return pressing.outcome;
    },
    result: () => turnRules.result(echo.turns),
    turn: () => ({ toMove: turnRules.seatToMove(echo.turns), lives: echo.turns.lives }),
    state(now) {
      const length = lengthOf(echo.turns);
      return {
        phase: phaseAt(echo, now),
        length,
        entered: echo.pressed.length,
        toMove: turnRules.seatToMove(echo.turns),
        sequence: echo.turns.sequence.slice(0, length),
        result: turnRules.result(echo.turns),
      };
    },
  };
}

/** The Arcade plays a growing sequence of lit pads and tones; the Players repeat it. */
export class ColorEchoScene extends Phaser.Scene {
  /** Moves the Round on, once a frame. */
  private step: () => void = () => undefined;

  override update(): void {
    this.step();
  }

  create(begin: RoundStart): void {
    const round = openRound(this, begin);
    const { safe } = round.stage;
    const { seats, seating } = round.session;
    round.stage.backdrop({ color: colors.sky });
    const pads = PADS.slice(0, padCount(round.session.difficulty));
    const middle = { x: safe.x + safe.width / 2, y: safe.y + safe.height / 2 };
    const gate = turnGate(this);
    const takingTurns = round.session.playStyle === 'turn-based';
    const echoing = takingTurns ? turns(round, begin.seed) : solo(round);
    const board = takingTurns ? BOARD.turns : BOARD.solo;

    /** The step of the sequence last lit, so each step's tone is asked for once. */
    let played: string | null = null;
    let pressed: { pad: Pad; until: number } | null = null;

    const targets: Record<string, SnapshotTarget> = {};
    const images = pads.map((pad, index) => {
      const [across, down] = PLACES[pads.length]![index]!;
      const x = middle.x + across * board.spacing;
      const y = middle.y + down * board.spacing;
      const half = board.pad / 2;
      targets[`pad-${pad.name}`] = {
        x,
        y,
        rect: { x: x - half, y: y - half, width: board.pad, height: board.pad },
      };
      return picture(this, x, y, pad.frame).setScale(board.pad / ART);
    });

    // On a shared board taking Turns: the Turn pointer, and each Seat's lives at its edge, drawn
    // as its shape.
    const pointer = takingTurns ? turnPointer(this, safe, seats.length, seating) : null;
    const lives = takingTurns
      ? seats.map(({ index, shape }) => {
          const rect = turnPointerRect(safe, seats.length as ZonedSeats, seating, index);
          // On the side of the pointer's place that faces the pads.
          const below = rect.y + rect.height / 2 < middle.y;
          const y = below
            ? rect.y + rect.height + LIFE_GAP + LIFE / 2
            : rect.y - LIFE_GAP - LIFE / 2;
          const x = rect.x + rect.width / 2;
          const step = LIFE + LIFE_GAP;
          return Array.from({ length: LIVES }, (_, place) =>
            picture(this, x + (place - (LIVES - 1) / 2) * step, y, shape).setDisplaySize(
              LIFE,
              LIFE,
            ),
          );
        })
      : [];
    const showTurn = () => {
      const turn = echoing.turn();
      if (!turn) return;
      pointer?.point(turn.toMove, seats[turn.toMove]!.shape);
      turn.lives.forEach((left, seat) =>
        lives[seat]!.forEach((life, place) => life.setAlpha(place < left ? 1 : LOST_ALPHA)),
      );
    };
    showTurn();

    const show = (lit: Pad | null) =>
      images.forEach((image, index) =>
        image.setFrame(index === lit ? pads[index]!.litFrame : pads[index]!.frame),
      );
    /** Lights a pad and asks for its tone together, so they share a Scene time. */
    const sound = (pad: Pad) => {
      show(pad);
      round.audio.sfx(pads[pad]!.tone);
    };

    const onPress = (pad: Pad) => {
      const now = round.now();
      const outcome = echoing.press(pad, now);
      if (outcome === 'ignored') {
        // Out of Turn, the pointer, which shows whose Turn it is, gives the gentle no.
        round.refuse(pointer?.image ?? images[pad]!);
        return;
      }
      pressed = { pad, until: now + PRESSED_FOR };
      sound(pad);
      showTurn();
      const ended = echoing.result();
      if (!ended) {
        if (outcome === 'wrong') round.audio.sfx('wrong');
        return;
      }
      gate.close();
      // One closing sound. Solo ends on a slip, which is not a win; taking Turns, some Seat always
      // wins or they draw.
      round.audio.sfx(ended.kind === 'solo' && outcome === 'wrong' ? 'wrong' : 'win');
      round.finish(ended);
    };

    pads.forEach((pad, index) => {
      const { rect } = targets[`pad-${pad.name}`]!;
      this.add
        .rectangle(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height)
        .setInteractive()
        .on(
          'pointerdown',
          gate.guard(() => onPress(index)),
        );
    });

    this.step = () => {
      const now = round.now();
      const playing = echoing.playing(now);
      let lit: Pad | null = null;
      if (playing) {
        const step = playing.step === null ? null : `${playing.since}:${playing.step}`;
        if (step !== null && step !== played) sound(playing.lit!);
        played = step ?? played;
        lit = playing.lit;
      }
      if (pressed && now < pressed.until) lit = pressed.pad;
      else pressed = null;
      show(lit);
    };

    // Follow the lights: the hand taps two pads, then shows that a third is not the one.
    const at = (index: number) => {
      const { x, y } = targets[`pad-${pads[index]!.name}`]!;
      return { x, y };
    };
    void round.demo([
      { wait: 400 },
      { tap: at(0) },
      { wait: 300 },
      { tap: at(1) },
      { wait: 300 },
      { refuse: at(2) },
    ]);

    /** Each Seat shown, as drawn: its shape, and the colour that shape is drawn in. */
    const shown = (seat: SeatIndex) => ({
      seat,
      shape: seats[seat]!.shape,
      color: seats[seat]!.color,
    });
    round.expose(() => {
      const state = { ...echoing.state(round.now()), pads: pads.map((pad) => pad.name) };
      const turn = echoing.turn();
      if (!turn || !pointer) return { state, targets };
      return {
        state: {
          ...state,
          pointer: shown(turn.toMove),
          lives: turn.lives.map((left, seat) => ({ ...shown(seat as SeatIndex), lives: left })),
        },
        targets: { ...targets, 'turn-pointer': pointer.target() },
      };
    });
  }
}
