import type { Rect, SeatIndex, Seating, Zone } from '@/contract';

/** How many Seats can have Zones. Zones are for simultaneous play, which needs two or more. */
export type ZonedSeats = 2 | 3 | 4;

/**
 * Where each Seat's Zone lies in an area, and which way it faces, as tabulated in the Game
 * contract. Pure: no Phaser, no DOM. A Game's area is the safe rectangle less the room its
 * controls need; a Game asks for its Zones and never computes them.
 *
 * | Seats | side-by-side                 | around-the-table                                         |
 * |-------|------------------------------|----------------------------------------------------------|
 * | 2     | left half, right half; 0°    | bottom half 0°, top half 180°                            |
 * | 3     | three columns; 0°            | bottom-left and bottom-right 0°, top-centre 180°         |
 * | 4     | four columns; 0°             | bottom-left, bottom-right 0°; top-right, top-left 180°   |
 *
 * Seats go round the table anticlockwise as seen from above: the near Seats left to right, then
 * the far Seats right to left.
 */
export function zonesFor(area: Rect, seats: ZonedSeats, seating: Seating): Zone[] {
  if (seating === 'side-by-side') {
    const width = area.width / seats;
    return seatIndices(seats).map((seat) => ({
      seat,
      facing: 0,
      rect: { x: area.x + seat * width, y: area.y, width, height: area.height },
    }));
  }

  const height = area.height / 2;
  const far = area.y;
  const near = area.y + height;
  if (seats === 2) {
    return [
      { seat: 0, facing: 0, rect: { x: area.x, y: near, width: area.width, height } },
      { seat: 1, facing: 180, rect: { x: area.x, y: far, width: area.width, height } },
    ];
  }
  const width = area.width / 2;
  const left = area.x;
  const right = area.x + width;
  const zones: Zone[] = [
    { seat: 0, facing: 0, rect: { x: left, y: near, width, height } },
    { seat: 1, facing: 0, rect: { x: right, y: near, width, height } },
  ];
  if (seats === 3) {
    zones.push({ seat: 2, facing: 180, rect: { x: left + width / 2, y: far, width, height } });
  } else {
    zones.push(
      { seat: 2, facing: 180, rect: { x: right, y: far, width, height } },
      { seat: 3, facing: 180, rect: { x: left, y: far, width, height } },
    );
  }
  return zones;
}

const seatIndices = (seats: ZonedSeats) => ([0, 1, 2, 3] as const).slice(0, seats) as SeatIndex[];

/**
 * The Zone a point lies in, or null. A Zone includes its top and left edges and not its bottom
 * and right ones, so a point on an edge two Zones share lies in exactly one of them.
 */
export function zoneAt(zones: readonly Zone[], x: number, y: number): Zone | null {
  return (
    zones.find(
      ({ rect }) =>
        x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height,
    ) ?? null
  );
}

/**
 * A point in Zone-local coordinates: measured from the Zone's top-left corner as its Player sees
 * it, with x to the Player's right and y towards the Player. In a Zone facing 180° both run the
 * other way across the screen, so the same place relative to the Player has the same coordinates
 * whichever way the Zone faces.
 */
export function toZoneLocal(zone: Zone, x: number, y: number): { x: number; y: number } {
  const { rect } = zone;
  return zone.facing === 0
    ? { x: x - rect.x, y: y - rect.y }
    : { x: rect.x + rect.width - x, y: rect.y + rect.height - y };
}

/** The design-frame point at Zone-local coordinates: the inverse of toZoneLocal. */
export function fromZoneLocal(zone: Zone, x: number, y: number): { x: number; y: number } {
  const { rect } = zone;
  return zone.facing === 0
    ? { x: rect.x + x, y: rect.y + y }
    : { x: rect.x + rect.width - x, y: rect.y + rect.height - y };
}
