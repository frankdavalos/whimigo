import { describe, expect, it } from 'vitest';
import { HOLD_MS, createHold } from './hold';

describe('a hold', () => {
  it('takes about half a second', () => {
    expect(HOLD_MS).toBe(500);
  });

  it('does nothing for a short tap', () => {
    const hold = createHold();
    hold.press(1, 1000);
    expect(hold.update(1200)).toBe(false);
    hold.release(1);
    expect(hold.update(1600)).toBe(false);
    expect(hold.progress(1600)).toBe(0);
  });

  it('completes once when the finger stays down for the whole hold', () => {
    const hold = createHold();
    hold.press(1, 1000);
    expect(hold.update(1499)).toBe(false);
    expect(hold.progress(1250)).toBeCloseTo(0.5);
    expect(hold.update(1500)).toBe(true);
    expect(hold.update(1600)).toBe(false);
    hold.release(1);
    expect(hold.update(2200)).toBe(false);
  });

  it('starts again from nothing after an early release', () => {
    const hold = createHold();
    hold.press(1, 1000);
    hold.release(1);
    hold.press(1, 1400);
    expect(hold.update(1600)).toBe(false);
    expect(hold.update(1900)).toBe(true);
  });

  it('belongs to the finger that started it', () => {
    const hold = createHold();
    hold.press(1, 1000);
    hold.press(2, 1300);
    hold.release(2);
    expect(hold.update(1500)).toBe(true);
  });

  it('needs a fresh press after it completes', () => {
    const hold = createHold();
    hold.press(1, 0);
    expect(hold.update(500)).toBe(true);
    hold.release(1);
    hold.press(1, 1000);
    expect(hold.update(1499)).toBe(false);
    expect(hold.update(1500)).toBe(true);
  });
});
