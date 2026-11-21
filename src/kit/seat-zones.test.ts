import { describe, expect, it } from 'vitest';
import type { SeatIndex, SeatTouch } from '@/contract';
import { safeRect } from './frame';
import { createSeatZones } from './seat-zones';
import type { TouchInput } from './seat-touches';
import { fromZoneLocal, zonesFor } from './zones';

const SAFE = safeRect({ top: 0, right: 0, bottom: 0, left: 0 });
const ZONES = zonesFor(SAFE, 4, 'around-the-table');

/** A point at Zone-local (100, 100) in a Seat's Zone. */
const at = (seat: number) => fromZoneLocal(ZONES[seat]!, 100, 100);
const touch = (kind: TouchInput['kind'], id: number, seat: number, time = 0): TouchInput => ({
  kind,
  id,
  ...at(seat),
  time,
});

/** SeatZones over four Zones around the table, with every report it makes written down. */
function listen() {
  const zones = createSeatZones(ZONES);
  const heard: string[] = [];
  zones.onDown((t: SeatTouch) => heard.push(`down ${t.seat}`));
  zones.onUp((t) => heard.push(`${t.canceled ? 'cancel' : 'up'} ${t.seat}`));
  return { zones, heard };
}

describe('SeatZones', () => {
  it('reports one touch down for each Seat when four land at once, in Zone-local coordinates', () => {
    const zones = createSeatZones(ZONES);
    const downs: SeatTouch[] = [];
    zones.onDown((t) => downs.push(t));
    [0, 1, 2, 3].forEach((seat) => zones.input(touch('down', seat + 1, seat, 500)));
    expect(downs).toEqual(
      [0, 1, 2, 3].map((seat) => ({ seat: seat as SeatIndex, x: 100, y: 100, time: 500 })),
    );
    expect(zones.held()).toEqual([0, 1, 2, 3]);
  });

  it('ignores a second finger in a Zone, then and when it lifts', () => {
    const { zones, heard } = listen();
    zones.input(touch('down', 1, 0));
    zones.input(touch('down', 2, 0));
    zones.input(touch('up', 2, 0));
    zones.input(touch('up', 1, 0));
    expect(heard).toEqual(['down 0', 'up 0']);
  });

  it('keeps a finger that slides into a neighbour’s Zone with the Seat it began in', () => {
    const { zones, heard } = listen();
    zones.input(touch('down', 1, 0));
    zones.input(touch('move', 1, 1));
    zones.input(touch('down', 2, 1));
    zones.input(touch('up', 1, 1));
    expect(heard).toEqual(['down 0', 'down 1', 'up 0']);
    expect(zones.held()).toEqual([1]);
  });

  it('reports a touch the system takes away as cancelled, never as an ordinary release', () => {
    const { zones, heard } = listen();
    zones.input(touch('down', 1, 2));
    zones.input(touch('cancel', 1, 2));
    expect(heard).toEqual(['down 2', 'cancel 2']);
    expect(zones.held()).toEqual([]);
  });

  it('reports nothing of a switched-off Seat until it is switched on, and the others play on', () => {
    const { zones, heard } = listen();
    zones.setEnabled(1, false);
    zones.input(touch('down', 1, 1));
    zones.input(touch('down', 2, 0));
    zones.input(touch('up', 1, 1));
    expect(heard).toEqual(['down 0']);

    zones.setEnabled(1, true);
    zones.input(touch('down', 3, 1));
    zones.input(touch('up', 3, 1));
    expect(heard).toEqual(['down 0', 'down 1', 'up 1']);
  });

  it('does not report the lifting of a touch whose Seat was switched off after it came down', () => {
    const { zones, heard } = listen();
    zones.input(touch('down', 1, 3));
    zones.setEnabled(3, false);
    zones.input(touch('up', 1, 3));
    expect(heard).toEqual(['down 3']);
  });

  it('forgets every touch on reset: no Seat holds one, a stale one lifting reports nothing, and a new touch in each Zone is accepted', () => {
    const { zones, heard } = listen();
    [0, 1, 2, 3].forEach((seat) => zones.input(touch('down', seat + 1, seat)));
    heard.length = 0;
    zones.reset();
    expect(zones.held()).toEqual([]);
    [0, 1, 2, 3].forEach((seat) => zones.input(touch('up', seat + 1, seat)));
    expect(heard).toEqual([]);
    [0, 1, 2, 3].forEach((seat) => zones.input(touch('down', seat + 11, seat)));
    expect(heard).toEqual(['down 0', 'down 1', 'down 2', 'down 3']);
  });

  it('reports no touch that begins outside every Zone', () => {
    const { zones, heard } = listen();
    zones.input({ kind: 'down', id: 1, x: SAFE.x - 10, y: SAFE.y + 10, time: 0 });
    zones.input({ kind: 'up', id: 1, x: at(0).x, y: at(0).y, time: 0 });
    expect(heard).toEqual([]);
  });
});
