import type { Rng } from '@/contract';

/**
 * A seeded random source (mulberry32): small, fast and the same in every browser. Games use it
 * through `round.rng` and never `Math.random()`, so a Round can be replayed from its seed.
 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('Cannot pick from an empty list');
      return items[int(0, items.length - 1)]!;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const result = [...items];
      for (let i = result.length - 1; i > 0; i -= 1) {
        const j = int(0, i);
        [result[i], result[j]] = [result[j]!, result[i]!];
      }
      return result;
    },
  };
}
