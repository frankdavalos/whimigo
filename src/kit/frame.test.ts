import { describe, expect, it } from 'vitest';
import { DESIGN_FRAME, frameOnCanvas, safeRect } from './frame';

const none = { top: 0, right: 0, bottom: 0, left: 0 };

describe('the safe rectangle', () => {
  it('is the 2752 x 2064 design frame', () => {
    expect(DESIGN_FRAME).toEqual({ x: 0, y: 0, width: 2752, height: 2064 });
  });

  it('is inset by 88 units on every side when the device reports no inset', () => {
    expect(safeRect(none)).toEqual({ x: 88, y: 88, width: 2752 - 176, height: 2064 - 176 });
  });

  it('is still inset by 88 units where the reported inset is below 88', () => {
    expect(safeRect({ top: 40, right: 87, bottom: 1, left: 0 })).toEqual(safeRect(none));
  });

  it('follows the reported inset on each side where it is above 88', () => {
    expect(safeRect({ top: 120, right: 90, bottom: 200, left: 88 })).toEqual({
      x: 88,
      y: 120,
      width: 2752 - 88 - 90,
      height: 2064 - 120 - 200,
    });
  });
});

describe('the design frame on the canvas', () => {
  it('fills a 4:3 canvas exactly', () => {
    expect(frameOnCanvas({ width: 2752, height: 2064 }, 1)).toEqual(DESIGN_FRAME);
  });

  it('is centred across the extra width of a wider canvas', () => {
    expect(frameOnCanvas({ width: 3302, height: 2064 }, 1)).toEqual({
      x: 275,
      y: 0,
      width: 2752,
      height: 2064,
    });
  });

  it('is centred down the extra height of a narrower canvas', () => {
    expect(frameOnCanvas({ width: 2752, height: 2464 }, 1)).toEqual({
      x: 0,
      y: 200,
      width: 2752,
      height: 2064,
    });
  });

  it('shrinks with the render scale', () => {
    expect(frameOnCanvas({ width: 1651, height: 1032 }, 0.5)).toEqual({
      x: 137.5,
      y: 0,
      width: 1376,
      height: 1032,
    });
  });
});
