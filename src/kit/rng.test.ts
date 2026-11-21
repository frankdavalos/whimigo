import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

const draw = (seed: number, count: number) => {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng.next());
};

describe('the random source', () => {
  it('gives the same sequence for the same seed, and another for another seed', () => {
    expect(draw(42, 20)).toEqual(draw(42, 20));
    expect(draw(42, 20)).not.toEqual(draw(43, 20));
  });

  it('gives floats from 0 up to but not including 1', () => {
    for (const value of draw(7, 2000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('gives whole numbers within inclusive bounds, reaching both ends', () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i += 1) {
      const value = rng.int(2, 6);
      expect(Number.isInteger(value)).toBe(true);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([2, 3, 4, 5, 6]);
    expect(createRng(3).int(5, 5)).toBe(5);
  });

  it('picks an item from a list, and every item in time', () => {
    const rng = createRng(11);
    const items = ['a', 'b', 'c'] as const;
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) seen.add(rng.pick(items));
    expect([...seen].sort()).toEqual(['a', 'b', 'c']);
    expect(() => rng.pick([])).toThrow();
  });

  it('shuffles into a permutation and leaves its input unchanged', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const copy = [...items];
    const shuffled = createRng(5).shuffle(items);
    expect(items).toEqual(copy);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(shuffled).not.toEqual(items);
    expect(createRng(5).shuffle(items)).toEqual(shuffled);
  });
});
