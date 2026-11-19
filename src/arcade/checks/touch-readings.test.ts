import { describe, expect, it } from 'vitest';
import type { Rect } from '@/contract';
import type { TouchInput } from '@/kit/seat-touches';
import { fromZoneLocal } from '@/kit/zones';
import {
  forgetTouches,
  readTouch,
  resetReadings,
  startReadings,
  switchSeating,
  type TouchReadings,
} from './touch-readings';

const AREA: Rect = { x: 496, y: 88, width: 1760, height: 1888 };
const OUTSIDE = { x: 200, y: 200 };

const touch = (kind: TouchInput['kind'], id: number, at: { x: number; y: number }): TouchInput => ({
  kind,
  id,
  ...at,
  time: 0,
});
const feed = (readings: TouchReadings, ...inputs: TouchInput[]) =>
  inputs.reduce(readTouch, readings);
const inZone = (readings: TouchReadings, seat: number) =>
  fromZoneLocal(readings.zones[seat]!, 100, 100);

describe('the Touch Check’s readings', () => {
  const start = startReadings(AREA, 'around-the-table');

  it('start with four Zones around the table and nothing counted', () => {
    expect(start.seating).toBe('around-the-table');
    expect(start.zones.map((zone) => [zone.seat, zone.facing])).toEqual([
      [0, 0],
      [1, 0],
      [2, 180],
      [3, 180],
    ]);
    expect(start).toMatchObject({ live: [], highest: 0, cancellations: 0, taps: [0, 0, 0, 0] });
  });

  it('list every live touch by its slot and position, in or out of a Zone', () => {
    const readings = feed(
      start,
      touch('down', 3, inZone(start, 0)),
      touch('down', 1, OUTSIDE),
      touch('move', 1, { x: 210, y: 220 }),
    );
    expect(readings.live).toEqual([
      { slot: 3, ...inZone(start, 0) },
      { slot: 1, x: 210, y: 220 },
    ]);
    expect(feed(readings, touch('up', 3, inZone(start, 0))).live).toEqual([
      { slot: 1, x: 210, y: 220 },
    ]);
  });

  it('keep the highest number of touches down at once, after they lift', () => {
    const readings = feed(
      start,
      touch('down', 1, OUTSIDE),
      touch('down', 2, OUTSIDE),
      touch('down', 3, OUTSIDE),
      touch('up', 1, OUTSIDE),
      touch('up', 2, OUTSIDE),
      touch('down', 4, OUTSIDE),
      touch('up', 3, OUTSIDE),
      touch('up', 4, OUTSIDE),
    );
    expect(readings.live).toEqual([]);
    expect(readings.highest).toBe(3);
  });

  it('count a tap for the Seat whose Zone it came down in, and show that Seat held meanwhile', () => {
    const held = feed(start, touch('down', 1, inZone(start, 2)));
    expect(held.held).toEqual([2]);
    expect(held.taps).toEqual([0, 0, 0, 0]);
    const lifted = feed(held, touch('up', 1, inZone(start, 1)));
    expect(lifted.held).toEqual([]);
    expect(lifted.taps).toEqual([0, 0, 1, 0]);
  });

  it('count a cancelled touch as a cancellation and as no tap', () => {
    const readings = feed(
      start,
      touch('down', 1, inZone(start, 0)),
      touch('down', 2, OUTSIDE),
      touch('cancel', 1, inZone(start, 0)),
      touch('cancel', 2, OUTSIDE),
      touch('cancel', 2, OUTSIDE),
    );
    expect(readings.cancellations).toBe(2);
    expect(readings.taps).toEqual([0, 0, 0, 0]);
    expect(readings.live).toEqual([]);
  });

  it('remember where each Seat’s latest touch came down, in its Zone’s own coordinates', () => {
    const readings = feed(start, touch('down', 1, fromZoneLocal(start.zones[3]!, 120, 700)));
    expect(readings.lastTouch).toEqual([null, null, null, { x: 120, y: 700 }]);
  });

  it('reset the highest count, the cancellations and every tap counter, and nothing else', () => {
    const used = feed(
      start,
      touch('down', 1, inZone(start, 0)),
      touch('up', 1, inZone(start, 0)),
      touch('down', 2, inZone(start, 1)),
      touch('cancel', 2, inZone(start, 1)),
      touch('down', 3, OUTSIDE),
    );
    const reset = resetReadings(used);
    expect(reset).toMatchObject({ highest: 0, cancellations: 0, taps: [0, 0, 0, 0] });
    expect(reset.live).toEqual(used.live);
  });

  it('forget every live touch when the page comes back, counting nothing for them', () => {
    const down = feed(start, touch('down', 1, inZone(start, 0)), touch('down', 2, OUTSIDE));
    const forgotten = forgetTouches(down);
    expect(forgotten).toMatchObject({ live: [], held: [], cancellations: 0, highest: 2 });
    const after = feed(forgotten, touch('up', 1, inZone(start, 0)), touch('cancel', 2, OUTSIDE));
    expect(after).toMatchObject({ taps: [0, 0, 0, 0], cancellations: 0 });
    expect(feed(after, touch('down', 1, inZone(start, 0))).held).toEqual([0]);
  });

  it('switch between the two Seatings, keeping what has been counted', () => {
    const tapped = feed(
      start,
      touch('down', 1, inZone(start, 3)),
      touch('up', 1, inZone(start, 3)),
    );
    const sideBySide = switchSeating(tapped);
    expect(sideBySide.seating).toBe('side-by-side');
    expect(sideBySide.zones.every((zone) => zone.facing === 0)).toBe(true);
    expect(sideBySide.taps).toEqual([0, 0, 0, 1]);
    expect(switchSeating(sideBySide).zones).toEqual(start.zones);
  });
});
