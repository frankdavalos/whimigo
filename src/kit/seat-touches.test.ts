import { describe, expect, it } from 'vitest';
import type { Seating } from '@/contract';
import { safeRect } from './frame';
import {
  attributeTouch,
  isTap,
  noTouches,
  type SeatEvent,
  type Attribution,
  type TouchInput,
} from './seat-touches';
import { fromZoneLocal, zonesFor, type ZonedSeats } from './zones';

const SAFE = safeRect({ top: 0, right: 0, bottom: 0, left: 0 });

/** Feeds a sequence of touch events through attribution, collecting what it reports. */
function run(seats: ZonedSeats, seating: Seating, inputs: readonly TouchInput[]) {
  const zones = zonesFor(SAFE, seats, seating);
  let state: Attribution = noTouches;
  const events: SeatEvent[] = [];
  for (const input of inputs) {
    const result = attributeTouch(zones, state, input);
    state = result.state;
    if (result.event) events.push(result.event);
  }
  return { state, events, taps: events.filter(isTap).map((event) => event.touch.seat) };
}

/** A point well inside a Seat's Zone, at Zone-local (100, 100). */
const inZone = (seats: ZonedSeats, seating: Seating, seat: number) =>
  fromZoneLocal(zonesFor(SAFE, seats, seating)[seat]!, 100, 100);

const down = (id: number, at: { x: number; y: number }, time = 0): TouchInput => ({
  kind: 'down',
  id,
  ...at,
  time,
});
const move = (id: number, at: { x: number; y: number }, time = 0): TouchInput => ({
  kind: 'move',
  id,
  ...at,
  time,
});
const up = (id: number, at: { x: number; y: number }, time = 0): TouchInput => ({
  kind: 'up',
  id,
  ...at,
  time,
});
const cancel = (id: number, at: { x: number; y: number }, time = 0): TouchInput => ({
  kind: 'cancel',
  id,
  ...at,
  time,
});

const SEATINGS: readonly Seating[] = ['side-by-side', 'around-the-table'];
const COUNTS: readonly ZonedSeats[] = [2, 3, 4];

for (const seating of SEATINGS) {
  for (const seats of COUNTS) {
    describe(`Touch attribution for ${seats} Seats ${seating}`, () => {
      const at = (seat: number) => inZone(seats, seating, seat);
      const everySeat = Array.from({ length: seats }, (_, seat) => seat);

      it('gives a Zone’s first touch to its Seat, and its lifting is a tap', () => {
        for (const seat of everySeat) {
          const { events, taps } = run(seats, seating, [down(1, at(seat)), up(1, at(seat))]);
          expect(events.map((event) => [event.kind, event.touch.seat])).toEqual([
            ['down', seat],
            ['up', seat],
          ]);
          expect(taps).toEqual([seat]);
        }
      });

      it('gives one touch to each Seat when every Zone is touched at once', () => {
        const { state, taps } = run(seats, seating, [
          ...everySeat.map((seat) => down(seat + 1, at(seat))),
          ...everySeat.map((seat) => up(seat + 1, at(seat))),
        ]);
        expect(taps).toEqual(everySeat);
        expect(state).toEqual(noTouches);
      });

      it('ignores a second touch in a Zone that already has one', () => {
        const { events, taps } = run(seats, seating, [
          down(1, at(0)),
          down(2, { x: at(0).x + 50, y: at(0).y + 50 }),
          up(2, at(0)),
          up(1, at(0)),
        ]);
        expect(events.map((event) => event.kind)).toEqual(['down', 'up']);
        expect(taps).toEqual([0]);
      });

      it('keeps a touch with its first Seat when it slides into a neighbour’s Zone', () => {
        const { events, taps } = run(seats, seating, [
          down(1, at(0)),
          move(1, at(1)),
          up(1, at(1)),
        ]);
        expect(taps).toEqual([0]);
        expect(events.every((event) => event.touch.seat === 0)).toBe(true);
      });

      it('keeps a neighbour’s Zone free for its own Seat while a touch slides through it', () => {
        const { taps } = run(seats, seating, [
          down(1, at(0)),
          move(1, at(1)),
          down(2, at(1)),
          up(2, at(1)),
          up(1, at(1)),
        ]);
        expect(taps).toEqual([1, 0]);
      });

      it('never reports a cancelled touch as a tap', () => {
        const { events, taps, state } = run(seats, seating, [down(1, at(0)), cancel(1, at(0))]);
        expect(taps).toEqual([]);
        expect(events.at(-1)).toMatchObject({ kind: 'up', touch: { seat: 0, canceled: true } });
        expect(state).toEqual(noTouches);
      });

      it('gives a touch outside every Zone to nobody, even when it slides into one', () => {
        const outside = { x: SAFE.x - 40, y: SAFE.y + 400 };
        const { events } = run(seats, seating, [down(1, outside), move(1, at(0)), up(1, at(0))]);
        expect(events).toEqual([]);
      });

      it('accepts a new touch in a Zone once the first has lifted', () => {
        const { taps } = run(seats, seating, [
          down(1, at(0)),
          up(1, at(0)),
          down(2, at(0)),
          up(2, at(0)),
          down(1, at(0)),
          cancel(1, at(0)),
          down(3, at(0)),
          up(3, at(0)),
        ]);
        expect(taps).toEqual([0, 0, 0]);
      });
    });
  }
}

describe('A Seat touch', () => {
  it('carries its position in Zone-local coordinates and the browser’s timestamp', () => {
    const zones = zonesFor(SAFE, 4, 'around-the-table');
    const far = zones[3]!;
    const point = fromZoneLocal(far, 120, 700);
    const { events } = run(4, 'around-the-table', [down(7, point, 1234.5), up(7, point, 1300)]);
    expect(events).toEqual([
      { kind: 'down', touch: { seat: 3, x: 120, y: 700, time: 1234.5 } },
      { kind: 'up', touch: { seat: 3, x: 120, y: 700, time: 1300, canceled: false } },
    ]);
  });

  it('lifts where it lifted, in its own Zone’s coordinates, even outside that Zone', () => {
    const zones = zonesFor(SAFE, 2, 'side-by-side');
    const start = fromZoneLocal(zones[0]!, 100, 100);
    const end = fromZoneLocal(zones[1]!, 10, 100);
    const { events } = run(2, 'side-by-side', [down(1, start), move(1, end), up(1, end)]);
    expect(events[1]!.touch).toMatchObject({ x: zones[0]!.rect.width + 10, y: 100 });
  });

  it('is ignored when it lifts without having come down', () => {
    const at = inZone(2, 'side-by-side', 0);
    expect(run(2, 'side-by-side', [move(4, at), up(4, at), cancel(5, at)]).events).toEqual([]);
  });
});
