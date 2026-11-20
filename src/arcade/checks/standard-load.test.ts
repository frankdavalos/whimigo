import { describe, expect, it } from 'vitest';
import type { Rect } from '@/contract';
import { createStandardLoad, LOAD_SPRITES } from './standard-load';

const area: Rect = { x: 500, y: 100, width: 1400, height: 1800 };
const frames = [
  { name: 'standin/card-1', width: 400, height: 520 },
  { name: 'standin/token-1', width: 300, height: 300 },
  { name: 'standin/critter', width: 640, height: 640 },
];

/** Steps a fresh load through `total` milliseconds in steps of `step`, and reads its positions. */
function after(total: number, step: number) {
  const load = createStandardLoad(frames, area);
  for (let elapsed = 0; elapsed < total; elapsed += step) load.advance(step);
  return load.sprites();
}

describe('the standard load', () => {
  it('is a fixed number of sprites, every one a frame of the given atlas', () => {
    const sprites = createStandardLoad(frames, area).sprites();
    expect(sprites).toHaveLength(LOAD_SPRITES);
    const names = new Set(frames.map((frame) => frame.name));
    expect(sprites.every((sprite) => names.has(sprite.frame))).toBe(true);
    expect(new Set(sprites.map((sprite) => sprite.frame))).toEqual(names);
  });

  it('gives the same positions for the same elapsed time, in steps of 8, 16 or 33 milliseconds', () => {
    // 4224 milliseconds is a whole number of steps of each size.
    const at8 = after(4224, 8);
    expect(after(4224, 16)).toEqual(at8);
    expect(after(4224, 33)).toEqual(at8);
  });

  it('moves every sprite as time passes', () => {
    const start = after(0, 16);
    const later = after(1600, 16);
    for (const [index, sprite] of later.entries()) {
      expect(sprite, `sprite ${index}`).not.toEqual(start[index]);
    }
  });

  it('keeps every sprite wholly inside its area', () => {
    for (const total of [0, 1000, 5000, 60_000, 600_000]) {
      for (const sprite of after(total, 1000)) {
        const frame = frames.find((candidate) => candidate.name === sprite.frame)!;
        expect(sprite.x - frame.width / 2).toBeGreaterThanOrEqual(area.x);
        expect(sprite.x + frame.width / 2).toBeLessThanOrEqual(area.x + area.width);
        expect(sprite.y - frame.height / 2).toBeGreaterThanOrEqual(area.y);
        expect(sprite.y + frame.height / 2).toBeLessThanOrEqual(area.y + area.height);
      }
    }
  });
});
