import { describe, expect, it } from 'vitest';
import { prefersReducedMotion } from './reduced-motion';

const windowAsking = (reduce: boolean | null) => ({
  matchMedia: (query: string) => ({
    matches:
      reduce !== null &&
      query === `(prefers-reduced-motion: ${reduce ? 'reduce' : 'no-preference'})`,
  }),
});

describe('the device’s request for reduced motion', () => {
  it('is reduced when the device asks for it', () => {
    expect(prefersReducedMotion(windowAsking(true))).toBe(true);
  });

  it('is full when the device asks for none, or cannot say', () => {
    expect(prefersReducedMotion(windowAsking(false))).toBe(false);
    expect(prefersReducedMotion(windowAsking(null))).toBe(false);
    expect(prefersReducedMotion({})).toBe(false);
  });
});
