import { describe, expect, it } from 'vitest';
import type { Rect, SeatIndex, Seating } from '@/contract';
import { safeRect } from './frame';
import { turnPointerRect } from './turn-pointer';
import { zonesFor } from './zones';

const SAFE = safeRect({ top: 0, right: 0, bottom: 0, left: 0 });
const inside = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;
const middle = (rect: Rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

describe('the Turn pointer', () => {
  it('sits at the bottom edge under each Seat’s side when two sit side by side', () => {
    const left = turnPointerRect(SAFE, 2, 'side-by-side', 0);
    const right = turnPointerRect(SAFE, 2, 'side-by-side', 1);
    expect(middle(left).x).toBeLessThan(middle(SAFE).x);
    expect(middle(right).x).toBeGreaterThan(middle(SAFE).x);
    for (const rect of [left, right]) {
      expect(rect.y + rect.height).toBe(SAFE.y + SAFE.height);
    }
  });

  it('sits at the bottom edge for the near Seat and the top edge for the far one around the table', () => {
    const near = turnPointerRect(SAFE, 2, 'around-the-table', 0);
    const far = turnPointerRect(SAFE, 2, 'around-the-table', 1);
    expect(near.y + near.height).toBe(SAFE.y + SAFE.height);
    expect(far.y).toBe(SAFE.y);
  });

  for (const seating of ['side-by-side', 'around-the-table'] as Seating[]) {
    for (const count of [2, 3, 4] as const) {
      it(`lies inside the safe rectangle and the Seat’s own part of it, for ${count} Seats ${seating}`, () => {
        const zones = zonesFor(SAFE, count, seating);
        for (let seat = 0; seat < count; seat += 1) {
          const rect = turnPointerRect(SAFE, count, seating, seat as SeatIndex);
          expect(inside(SAFE, rect)).toBe(true);
          expect(inside(zones[seat]!.rect, rect)).toBe(true);
          expect(rect.width).toBeGreaterThanOrEqual(256);
          expect(rect.height).toBeGreaterThanOrEqual(256);
        }
      });
    }
  }
});
