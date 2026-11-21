import { describe, expect, it } from 'vitest';
import type { Rect, Seat, SeatIndex, Seating, Zone } from '@/contract';
import { CONTROL_AREAS } from './control-areas';
import { safeRect } from './frame';
import { sizes } from './theme';
import {
  pausePlace,
  fromZoneLocal,
  roundZones,
  toZoneLocal,
  zoneAt,
  zonePlacement,
  zonesFor,
} from './zones';

const SAFE = safeRect({ top: 0, right: 0, bottom: 0, left: 0 });
/** A safe rectangle with uneven insets, and a smaller area such as a check screen leaves. */
const AREAS: Record<string, Rect> = {
  'the safe rectangle': SAFE,
  'an unevenly inset safe rectangle': safeRect({ top: 140, right: 90, bottom: 210, left: 120 }),
  'the area beside a column of controls': { x: 496, y: 88, width: 1760, height: 1888 },
};
const SEATINGS: readonly Seating[] = ['side-by-side', 'around-the-table'];
const COUNTS = [2, 3, 4] as const;

const right = (rect: Rect) => rect.x + rect.width;
const bottom = (rect: Rect) => rect.y + rect.height;
const centre = (rect: Rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(right(a), right(b)) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y));

describe('Zones', () => {
  for (const [name, area] of Object.entries(AREAS)) {
    for (const seating of SEATINGS) {
      for (const count of COUNTS) {
        describe(`for ${count} Seats ${seating} in ${name}`, () => {
          const zones = zonesFor(area, count, seating);

          it('give each Seat one Zone, in Seat order', () => {
            expect(zones.map((zone) => zone.seat)).toEqual([0, 1, 2, 3].slice(0, count));
          });

          it('lie inside the area', () => {
            for (const { rect } of zones) {
              expect(rect.x).toBeGreaterThanOrEqual(area.x);
              expect(rect.y).toBeGreaterThanOrEqual(area.y);
              expect(right(rect)).toBeLessThanOrEqual(right(area));
              expect(bottom(rect)).toBeLessThanOrEqual(bottom(area));
              expect(rect.width).toBeGreaterThan(0);
              expect(rect.height).toBeGreaterThan(0);
            }
          });

          it('do not overlap', () => {
            for (const [i, a] of zones.entries()) {
              for (const b of zones.slice(i + 1)) expect(overlap(a.rect, b.rect)).toBe(0);
            }
          });

          it('are the same size', () => {
            for (const zone of zones) {
              expect(zone.rect.width).toBeCloseTo(zones[0]!.rect.width);
              expect(zone.rect.height).toBeCloseTo(zones[0]!.rect.height);
            }
          });
        });
      }
    }

    describe(`side by side in ${name}`, () => {
      it('are full-height columns from left to right, all facing 0°', () => {
        for (const count of COUNTS) {
          const zones = zonesFor(area, count, 'side-by-side');
          zones.forEach((zone, i) => {
            expect(zone.facing).toBe(0);
            expect(zone.rect.y).toBe(area.y);
            expect(zone.rect.height).toBe(area.height);
            expect(zone.rect.width).toBeCloseTo(area.width / count);
            expect(zone.rect.x).toBeCloseTo(area.x + (i * area.width) / count);
          });
        }
      });
    });

    describe(`around the table in ${name}`, () => {
      const top = (zone: Zone) => zone.rect.y === area.y && bottom(zone.rect) <= centre(area).y;
      const low = (zone: Zone) =>
        bottom(zone.rect) === bottom(area) && zone.rect.y >= centre(area).y;
      const left = (zone: Zone) => right(zone.rect) <= centre(area).x;
      const rightSide = (zone: Zone) => zone.rect.x >= centre(area).x;

      it('for two Seats: the bottom half faces 0°, the top half faces 180°', () => {
        const [near, far] = zonesFor(area, 2, 'around-the-table');
        expect(near).toEqual({
          seat: 0,
          facing: 0,
          rect: {
            x: area.x,
            y: area.y + area.height / 2,
            width: area.width,
            height: area.height / 2,
          },
        });
        expect(far).toEqual({
          seat: 1,
          facing: 180,
          rect: { x: area.x, y: area.y, width: area.width, height: area.height / 2 },
        });
      });

      it('for three Seats: bottom-left and bottom-right face 0°, top-centre faces 180°', () => {
        const [a, b, c] = zonesFor(area, 3, 'around-the-table');
        expect(low(a!) && left(a!) && a!.facing === 0).toBe(true);
        expect(low(b!) && rightSide(b!) && b!.facing === 0).toBe(true);
        expect(top(c!) && c!.facing === 180).toBe(true);
        expect(centre(c!.rect).x).toBeCloseTo(centre(area).x);
      });

      it('for four Seats: bottom-left, bottom-right face 0°; top-right, top-left face 180°', () => {
        const [a, b, c, d] = zonesFor(area, 4, 'around-the-table');
        expect(low(a!) && left(a!) && a!.facing === 0).toBe(true);
        expect(low(b!) && rightSide(b!) && b!.facing === 0).toBe(true);
        expect(top(c!) && rightSide(c!) && c!.facing === 180).toBe(true);
        expect(top(d!) && left(d!) && d!.facing === 180).toBe(true);
      });
    });
  }
});

describe('Zone-local coordinates', () => {
  const zones = zonesFor(SAFE, 4, 'around-the-table');
  const near = zones.find((zone) => zone.facing === 0);
  const far = zones.find((zone) => zone.facing === 180);

  it('start at the top-left corner of the Zone as its Player sees it', () => {
    const { rect } = near!;
    expect(toZoneLocal(near!, rect.x, rect.y)).toEqual({ x: 0, y: 0 });
    expect(toZoneLocal(far!, right(far!.rect), bottom(far!.rect))).toEqual({ x: 0, y: 0 });
  });

  it('are the same for the same place relative to the Player, whichever way the Zone faces', () => {
    const place = { x: 120, y: 700 };
    const onNear = fromZoneLocal(near!, place.x, place.y);
    const onFar = fromZoneLocal(far!, place.x, place.y);
    expect(onNear).toEqual({ x: near!.rect.x + 120, y: near!.rect.y + 700 });
    expect(onFar).toEqual({ x: right(far!.rect) - 120, y: bottom(far!.rect) - 700 });
    expect(toZoneLocal(near!, onNear.x, onNear.y)).toEqual(place);
    expect(toZoneLocal(far!, onFar.x, onFar.y)).toEqual(place);
  });
});

describe('the Zone at a point', () => {
  const zones = zonesFor(SAFE, 2, 'side-by-side');
  const [first, second] = zones;

  it('is the Zone the point lies in', () => {
    expect(zoneAt(zones, first!.rect.x + 10, first!.rect.y + 10)).toBe(first);
    expect(zoneAt(zones, second!.rect.x + 10, bottom(second!.rect) - 10)).toBe(second);
  });

  it('is exactly one Zone on the edge two Zones share', () => {
    expect(zoneAt(zones, second!.rect.x, centre(SAFE).y)).toBe(second);
  });

  it('is none outside every Zone', () => {
    expect(zoneAt(zones, SAFE.x - 1, centre(SAFE).y)).toBeNull();
    expect(zoneAt(zones, right(SAFE), centre(SAFE).y)).toBeNull();
    expect(zoneAt(zones, centre(SAFE).x, bottom(SAFE))).toBeNull();
  });
});

const seatsOf = (count: number): Seat[] =>
  Array.from({ length: count }, (_, index) => ({
    index: index as SeatIndex,
    occupant: { kind: 'player', mascot: `mascot-${index}` },
    color: 0,
    shape: 'arcade/seat-circle',
  }));

describe('a Round’s Zones', () => {
  const pause = (safe: Rect) => {
    const { x, y } = pausePlace(safe);
    return CONTROL_AREAS.holdButton({ x, y, width: sizes.button, height: sizes.button });
  };
  const gap = (a: Rect, b: Rect) =>
    Math.max(b.x - right(a), a.x - right(b), b.y - bottom(a), a.y - bottom(b));

  for (const [name, safe] of Object.entries(AREAS).slice(0, 2)) {
    for (const seating of SEATINGS) {
      for (const count of COUNTS) {
        it(`for a zoned Session of ${count} Seats ${seating}, in ${name}, are the documented Zones of the safe rectangle less the pause control’s strip`, () => {
          const zones = roundZones(safe, { zoned: true, seating, seats: seatsOf(count) });
          const strip = sizes.button + sizes.gap;
          const area = { ...safe, x: safe.x + strip, width: safe.width - strip };
          expect(zones).toEqual(zonesFor(area, count, seating));
          for (const zone of zones) {
            expect(gap(pause(safe), zone.rect), `Zone ${zone.seat}`).toBeGreaterThanOrEqual(
              sizes.gap,
            );
          }
        });
      }
    }
  }

  it('are none for an unzoned Session, whatever its Seats and Seating', () => {
    for (const seating of SEATINGS) {
      for (const count of [1, 2, 3, 4]) {
        expect(roundZones(SAFE, { zoned: false, seating, seats: seatsOf(count) })).toEqual([]);
      }
    }
  });

  it('are none for a zoned Session of one Seat, which has nobody to share with', () => {
    expect(roundZones(SAFE, { zoned: true, seating: 'side-by-side', seats: seatsOf(1) })).toEqual(
      [],
    );
  });
});

describe('a Zone’s placement, for a container of Zone-local content', () => {
  /** Where a point of a container placed and turned like this lands in the design frame. */
  const place = (zone: Zone, local: { x: number; y: number }) => {
    const { x, y, angle } = zonePlacement(zone);
    const turn = (angle * Math.PI) / 180;
    return {
      x: x + local.x * Math.cos(turn) - local.y * Math.sin(turn),
      y: y + local.x * Math.sin(turn) + local.y * Math.cos(turn),
    };
  };

  for (const seating of SEATINGS) {
    for (const zone of zonesFor(SAFE, 4, seating)) {
      it(`puts Zone-local content where fromZoneLocal says, ${seating}, Seat ${zone.seat} facing ${zone.facing}°`, () => {
        expect(zonePlacement(zone).angle).toBe(zone.facing);
        for (const local of [
          { x: 0, y: 0 },
          { x: 120, y: 700 },
          { x: zone.rect.width, y: zone.rect.height },
        ]) {
          const at = place(zone, local);
          const expected = fromZoneLocal(zone, local.x, local.y);
          expect(at.x).toBeCloseTo(expected.x, 6);
          expect(at.y).toBeCloseTo(expected.y, 6);
        }
      });
    }
  }
});
