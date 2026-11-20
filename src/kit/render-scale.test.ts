import { describe, expect, it } from 'vitest';
import { renderScaleFor } from './render-scale';

describe('the render scale', () => {
  it('is 1 when the page is opened normally', () => {
    expect(renderScaleFor('')).toBe(1);
    expect(renderScaleFor('?e2e=1')).toBe(1);
  });

  it('is half only when the test bridge is on and half is asked for', () => {
    expect(renderScaleFor('?e2e=1&scale=0.5')).toBe(0.5);
    expect(renderScaleFor('?scale=0.5&e2e=1')).toBe(0.5);
  });

  it('ignores the scale asked for without the test bridge', () => {
    expect(renderScaleFor('?scale=0.5')).toBe(1);
    expect(renderScaleFor('?e2e=0&scale=0.5')).toBe(1);
  });

  it('ignores any scale other than half', () => {
    for (const scale of ['2', '0.25', '0', '-1', 'half', '']) {
      expect(renderScaleFor(`?e2e=1&scale=${scale}`), scale).toBe(1);
    }
  });
});
