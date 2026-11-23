import * as Phaser from 'phaser';
import type { Result, Round, RoundStart, SeatIndex, SnapshotTarget, Zone } from '@/contract';
import { picture } from '@/kit/atlas';
import { touchArea } from '@/kit/control-areas';
import { openRound } from '@/kit/round';
import { colors } from '@/kit/theme';
import { turnGate } from '@/kit/turn-gate';
import { turnPointer, turnPointerRect } from '@/kit/turn-pointer';
import { fromZoneLocal, type ZonedSeats } from '@/kit/zones';
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
  TARGET,
  pressTogether,
  startTogether,
  togetherResult,
  LIVES as SHARED_LIVES,
  type Press,
} from '../logic/together';
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
/**
 * In a Zone: the largest pad, the least room between a pad and its Zone's edges taken together,
 * the room between two pads, and the strip at the Player's edge for the Seat's shape and the lives.
 */
const ZONED = { pad: 512, margin: 96, between: 128, strip: 176 } as const;
/** In that strip: the Seat's shape, and the shared lives beside it. */
const STRIP = { shape: 112, life: 80, gap: 16, apart: 32 } as const;
/** How strongly a Zone shows its Seat's colour behind everything in it. */
const ZONE_TINT = 0.18;
/** The edge left between a Zone's colour and its neighbour's. */
const ZONE_EDGE = 16;
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

/**
 * Where a Zone's pads stand, in Zone-local coordinates: one in the middle, or two along the Zone's
 * longer side, above a strip at the Player's edge for the Seat's shape and the lives.
 */
function zoneLayout(zone: Zone, count: number) {
  const { width: w, height: h } = zone.rect;
  const pad = Math.min(ZONED.pad, Math.min(w, h) - ZONED.margin);
  const y = (h - ZONED.strip) / 2;
  const half = (pad + ZONED.between) / 2;
  const places =
    count === 1
      ? [{ x: w / 2, y }]
      : h >= w
        ? [
            { x: w / 2, y: y - half },
            { x: w / 2, y: y + half },
          ]
        : [
            { x: w / 2 - half, y },
            { x: w / 2 + half, y },
          ];
  return { pad, places, strip: { x: w / 2, y: h - ZONED.strip / 2 } };
}

/** What the Scene needs of a Play Style's rules, whatever they are. */
interface Echoing {
  /** How many pads, and the Seat that owns each when each Seat has its own; null on one board. */
  readonly pads: number;
  readonly owners: readonly SeatIndex[] | null;
  /** Where the Arcade's playing has reached at `now`, or null when it is not playing. */
  playing(now: number): (Playing & { readonly since: number }) | null;
  /** Pads pressed at `now`: each with its outcome, in the order they counted. */
  press(presses: readonly Press[], now: number): readonly { pad: Pad; outcome: Outcome }[];
  result(): Result | null;
  /** The Seat whose Turn it is and every Seat's lives, when Seats take Turns; null otherwise. */
  turn(): { readonly toMove: SeatIndex; readonly lives: readonly number[] } | null;
  /** The lives the Seats share, when they play together; null otherwise. */
  shared(): number | null;
  /** The rules' part of the snapshot. */
  state(now: number): Record<string, unknown>;
}

/** One Player repeats a growing sequence until a slip. */
function solo(round: Round): Echoing {
  let echo = start({ difficulty: round.session.difficulty, rng: round.rng, at: round.now() });
  return {
    pads: padCount(round.session.difficulty),
    owners: null,
    playing(now) {
      echo = advance(echo, now);
      return echo.phase === 'playing' ? { ...playingAt(echo, now), since: echo.since } : null;
    },
    press: (presses, now) =>
      presses.map(({ pad }) => {
        const pressing = press(echo, pad, now);
        echo = pressing.echo;
        return { pad, outcome: pressing.outcome };
      }),
    result: () => result(echo),
    turn: () => null,
    shared: () => null,
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
    pads: padCount(difficulty),
    owners: null,
    playing(now) {
      return phaseAt(echo, now) === 'playing'
        ? { ...turnPlayingAt(echo, now), since: echo.since }
        : null;
    },
    press: (presses, now) =>
      presses.map(({ pad }) => {
        const pressing = pressTurn(echo, pad, now);
        echo = pressing.echo;
        return { pad, outcome: pressing.outcome };
      }),
    result: () => turnRules.result(echo.turns),
    turn: () => ({ toMove: turnRules.seatToMove(echo.turns), lives: echo.turns.lives }),
    shared: () => null,
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

/** Two to four Seats repeat the sequence together, each pressing its own pads, sharing three lives. */
function together(round: Round): Echoing {
  const { seats, difficulty } = round.session;
  let echo = startTogether({ difficulty, seats: seats.length, rng: round.rng, at: round.now() });
  return {
    pads: echo.owners.length,
    owners: echo.owners,
    playing(now) {
      echo = advance(echo, now);
      return echo.phase === 'playing' ? { ...playingAt(echo, now), since: echo.since } : null;
    },
    press(presses, now) {
      const pressing = pressTogether(echo, presses, now);
      echo = pressing.together;
      return pressing.pressed;
    },
    result: () => togetherResult(echo),
    turn: () => null,
    shared: () => echo.lives,
    state: () => ({
      phase: echo.phase,
      length: echo.length,
      entered: echo.entered,
      completed: echo.completed,
      target: TARGET[difficulty],
      lives: echo.lives,
      sequence: echo.sequence.slice(0, echo.length),
      result: togetherResult(echo),
    }),
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
    const { seats, seating, playStyle } = round.session;
    round.stage.backdrop({ color: colors.sky });
    const middle = { x: safe.x + safe.width / 2, y: safe.y + safe.height / 2 };
    const gate = turnGate(this);
    const takingTurns = playStyle === 'turn-based';
    const echoing =
      playStyle === 'cooperative'
        ? together(round)
        : takingTurns
          ? turns(round, begin.seed)
          : solo(round);
    const pads = PADS.slice(0, echoing.pads);
    const { owners } = echoing;

    /** The step of the sequence last lit, so each step's tone is asked for once. */
    let played: string | null = null;
    let pressed: { pad: Pad; until: number }[] = [];

    const targets: Record<string, SnapshotTarget> = {};
    const board = takingTurns ? BOARD.turns : BOARD.solo;
    /** Each Seat's Zone, its colour behind it, and its shape and the shared lives at its edge. */
    const zoned = round.stage.zones.map((zone) => {
      const seat = seats[zone.seat]!;
      const mine = pads.flatMap((_, pad) => (owners?.[pad] === zone.seat ? [pad] : []));
      const layout = zoneLayout(zone, mine.length);
      const { width: w, height: h } = zone.rect;
      const tint = this.add.rectangle(
        w / 2,
        h / 2,
        w - ZONE_EDGE,
        h - ZONE_EDGE,
        seat.color,
        ZONE_TINT,
      );
      const row =
        STRIP.shape + STRIP.apart + SHARED_LIVES * STRIP.life + (SHARED_LIVES - 1) * STRIP.gap;
      const left = layout.strip.x - row / 2;
      const shape = picture(this, left + STRIP.shape / 2, layout.strip.y, seat.shape);
      shape.setDisplaySize(STRIP.shape, STRIP.shape);
      const lives = Array.from({ length: SHARED_LIVES }, (_, place) =>
        picture(
          this,
          left + STRIP.shape + STRIP.apart + STRIP.life / 2 + place * (STRIP.life + STRIP.gap),
          layout.strip.y,
          'color-echo/life',
        ).setDisplaySize(STRIP.life, STRIP.life),
      );
      round.stage.zoneContainer(zone.seat).add([tint, shape, ...lives]);
      const places = mine.map((pad, at) => ({ pad, ...layout.places[at]! }));
      return { zone, size: layout.pad, places, lives };
    });

    /** Where a pad stands: in its Seat's Zone, facing its Player, or on the one board in the middle. */
    const placeOf = (pad: Pad) => {
      for (const { zone, size, places } of zoned) {
        const local = places.find((place) => place.pad === pad);
        if (local) return { zone, size, local, at: fromZoneLocal(zone, local.x, local.y) };
      }
      const [across, down] = PLACES[pads.length]![pad]!;
      const at = { x: middle.x + across * board.spacing, y: middle.y + down * board.spacing };
      return { zone: null, size: board.pad, local: at, at };
    };
    const images = pads.map((pad, index) => {
      const { zone, size, local, at } = placeOf(index);
      targets[`pad-${pad.name}`] = { ...at, rect: touchArea({ ...at, width: size, height: size }) };
      const image = picture(this, local.x, local.y, pad.frame).setScale(size / ART);
      if (zone) round.stage.zoneContainer(zone.seat).add(image);
      return image;
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
    const showLives = () => {
      const turn = echoing.turn();
      if (turn) {
        pointer?.point(turn.toMove, seats[turn.toMove]!.shape);
        turn.lives.forEach((left, seat) =>
          lives[seat]!.forEach((life, place) => life.setAlpha(place < left ? 1 : LOST_ALPHA)),
        );
      }
      const shared = echoing.shared();
      if (shared === null) return;
      for (const { lives } of zoned) {
        lives.forEach((life, place) => life.setAlpha(place < shared ? 1 : LOST_ALPHA));
      }
    };
    showLives();

    const show = (lit: readonly Pad[]) =>
      images.forEach((image, index) =>
        image.setFrame(lit.includes(index) ? pads[index]!.litFrame : pads[index]!.frame),
      );
    /** Asks for a pad's tone; the pad is lit in the same frame. */
    const sound = (pad: Pad) => round.audio.sfx(pads[pad]!.tone);

    const onPresses = (presses: readonly Press[]) => {
      const now = round.now();
      const counted = echoing.press(presses, now);
      const ended = echoing.result();
      // The Round ends at the last press that counted; any after it are no one's, and pass unheard.
      const ending = ended ? counted.findLastIndex(({ outcome }) => outcome !== 'ignored') : -1;
      const taken = ended ? counted.slice(0, ending + 1) : counted;
      for (const [at, { pad, outcome }] of taken.entries()) {
        if (outcome === 'ignored') {
          // Out of Turn, the pointer, which shows whose Turn it is, gives the gentle no.
          round.refuse(pointer?.image ?? images[pad]!);
          continue;
        }
        pressed = [...pressed.filter((lit) => lit.pad !== pad), { pad, until: now + PRESSED_FOR }];
        show(pressed.map((lit) => lit.pad));
        sound(pad);
        if (outcome === 'wrong' && at !== ending) round.audio.sfx('wrong');
      }
      showLives();
      if (!ended) return;
      gate.close();
      // One closing sound, for the press that ended the Round. Solo ends on a slip, and the Seats
      // playing together fail on the slip that spends their last life, which is not a win; taking
      // Turns, some Seat always wins or they draw.
      const { outcome } = taken[ending]!;
      const lost = outcome === 'wrong' && (ended.kind === 'solo' || ended.kind === 'cooperative');
      round.audio.sfx(lost ? 'wrong' : 'win');
      round.finish(ended);
    };

    /**
     * Presses in the Seats' Zones, heard since the last frame: a press is a touch that began on one
     * of its own Seat's pads. Those that arrive together count in the order of their timestamps.
     */
    let heard: Press[] = [];
    if (owners) {
      round.seatZones.onDown(({ seat, x, y, time }) => {
        const { size, places } = zoned.find(({ zone }) => zone.seat === seat)!;
        const on = places.find(
          (place) => Math.abs(x - place.x) <= size / 2 && Math.abs(y - place.y) <= size / 2,
        );
        if (on) heard.push({ seat, pad: on.pad, time });
      });
    } else {
      pads.forEach((pad, index) => {
        const { rect } = targets[`pad-${pad.name}`]!;
        this.add
          .rectangle(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height)
          .setInteractive()
          .on(
            'pointerdown',
            gate.guard(() => onPresses([{ seat: 0, pad: index, time: 0 }])),
          );
      });
    }

    this.step = () => {
      if (heard.length > 0 && !echoing.result()) onPresses(heard);
      heard = [];
      const now = round.now();
      const playing = echoing.playing(now);
      const lit: Pad[] = [];
      if (playing) {
        const step = playing.step === null ? null : `${playing.since}:${playing.step}`;
        if (step !== null && step !== played) sound(playing.lit!);
        played = step ?? played;
        if (playing.lit !== null) lit.push(playing.lit);
      }
      pressed = pressed.filter(({ until }) => now < until);
      show([...lit, ...pressed.map(({ pad }) => pad)]);
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
      if (owners) {
        const inZones = zoned.map(({ zone, places }) => ({
          ...shown(zone.seat),
          pads: places.map(({ pad }) => pads[pad]!.name),
        }));
        return { state: { ...state, seats: inZones }, targets };
      }
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
