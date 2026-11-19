import type { Rect, SeatIndex, Seating, Zone } from '@/contract';
import {
  attributeTouch,
  heldSeats,
  isTap,
  noTouches,
  type Attribution,
  type TouchInput,
} from '@/kit/seat-touches';
import { zonesFor } from '@/kit/zones';

/** A touch that is down, by the slot Phaser gave it, at its latest position in design units. */
export interface LiveTouch {
  readonly slot: number;
  readonly x: number;
  readonly y: number;
}

type PerSeat<T> = readonly [T, T, T, T];

/**
 * Everything the Touch Check shows, as plain data. Changed only by the pure functions below, so
 * the rules are tested in Node and the Scene only draws.
 */
export interface TouchReadings {
  readonly seating: Seating;
  /** The area the four Zones share. */
  readonly area: Rect;
  readonly zones: readonly Zone[];
  readonly live: readonly LiveTouch[];
  /** The most touches down at once since the last reset. */
  readonly highest: number;
  /** Touches the system took away since the last reset. */
  readonly cancellations: number;
  /** Each Seat's taps since the last reset. */
  readonly taps: PerSeat<number>;
  /** The Seats with a touch down. */
  readonly held: readonly SeatIndex[];
  /** Where each Seat's latest touch came down, in its Zone's own coordinates. */
  readonly lastTouch: PerSeat<{ readonly x: number; readonly y: number } | null>;
  readonly attribution: Attribution;
}

export function startReadings(area: Rect, seating: Seating): TouchReadings {
  return {
    seating,
    area,
    zones: zonesFor(area, 4, seating),
    live: [],
    highest: 0,
    cancellations: 0,
    taps: [0, 0, 0, 0],
    held: [],
    lastTouch: [null, null, null, null],
    attribution: noTouches,
  };
}

/** One touch event. Events for a touch that is not down are ignored. */
export function readTouch(readings: TouchReadings, input: TouchInput): TouchReadings {
  const known = readings.live.some(({ slot }) => slot === input.id);
  if (input.kind !== 'down' && !known) return readings;

  const live =
    input.kind === 'down'
      ? [...readings.live, { slot: input.id, x: input.x, y: input.y }]
      : input.kind === 'move'
        ? readings.live.map((touch) =>
            touch.slot === input.id ? { slot: touch.slot, x: input.x, y: input.y } : touch,
          )
        : readings.live.filter(({ slot }) => slot !== input.id);

  const { state, event } = attributeTouch(readings.zones, readings.attribution, input);
  let { taps, lastTouch } = readings;
  if (event && isTap(event)) taps = withSeat(taps, event.touch.seat, taps[event.touch.seat] + 1);
  if (event?.kind === 'down') {
    lastTouch = withSeat(lastTouch, event.touch.seat, { x: event.touch.x, y: event.touch.y });
  }
  return {
    ...readings,
    live,
    highest: Math.max(readings.highest, live.length),
    cancellations: readings.cancellations + (input.kind === 'cancel' ? 1 : 0),
    taps,
    lastTouch,
    held: heldSeats(state),
    attribution: state,
  };
}

/** The reset control: the highest count, the cancellations and every tap counter go to zero. */
export function resetReadings(readings: TouchReadings): TouchReadings {
  return { ...readings, highest: 0, cancellations: 0, taps: [0, 0, 0, 0] };
}

/**
 * After the page has been hidden, the touches that were down are stale: the browser may never
 * report them lifting. They are forgotten, and count as neither taps nor cancellations.
 */
export function forgetTouches(readings: TouchReadings): TouchReadings {
  return { ...readings, live: [], held: [], attribution: noTouches };
}

/** The Seating control: side by side and around the table, in turn. */
export function switchSeating(readings: TouchReadings): TouchReadings {
  const seating = readings.seating === 'side-by-side' ? 'around-the-table' : 'side-by-side';
  return { ...readings, seating, zones: zonesFor(readings.area, 4, seating) };
}

function withSeat<T>(values: PerSeat<T>, seat: SeatIndex, value: T): PerSeat<T> {
  const copy = [...values] as [T, T, T, T];
  copy[seat] = value;
  return copy;
}
