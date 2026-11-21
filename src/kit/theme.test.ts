import { describe, expect, it } from 'vitest';
import { colorDifference, type Vision } from './color-difference';
import { SEAT_COLOR_DIFFERENCE, seats } from './theme';

const VISIONS: readonly Vision[] = ['ordinary', 'protanopia', 'deuteranopia', 'tritanopia'];

describe('the four Seats', () => {
  it('have four different shapes: circle, square, triangle and star', () => {
    expect(seats.map(({ shape }) => shape)).toEqual([
      'arcade/seat-circle',
      'arcade/seat-square',
      'arcade/seat-triangle',
      'arcade/seat-star',
    ]);
  });

  it('keep a stated threshold of colour difference that is clearly visible', () => {
    expect(SEAT_COLOR_DIFFERENCE).toBeGreaterThanOrEqual(20);
  });

  for (const vision of VISIONS) {
    it(`have colours that differ from one another by more than the threshold in ${vision}`, () => {
      for (const [i, a] of seats.entries()) {
        for (const b of seats.slice(i + 1)) {
          const difference = colorDifference(a.color, b.color, vision);
          expect(difference, `${a.shape} and ${b.shape}`).toBeGreaterThan(SEAT_COLOR_DIFFERENCE);
        }
      }
    });
  }
});
