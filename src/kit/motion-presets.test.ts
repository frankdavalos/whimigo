import { describe, expect, it } from 'vitest';
import type { MotionPreset } from '@/contract';
import { MOTION_PRESETS, lastsFor } from './motion-presets';

const PRESETS: readonly MotionPreset[] = ['pop', 'bounce', 'wiggle', 'slide'];

describe('motion presets', () => {
  it('are pop, bounce, wiggle and slide, each with a full and a reduced form', () => {
    expect(Object.keys(MOTION_PRESETS).sort()).toEqual([...PRESETS].sort());
    for (const preset of PRESETS) {
      expect(MOTION_PRESETS[preset].full.length, preset).toBeGreaterThan(0);
      expect(Array.isArray(MOTION_PRESETS[preset].reduced), preset).toBe(true);
    }
  });

  it('end, in both forms: every step lasts a finite time and repeats a finite number of times', () => {
    for (const preset of PRESETS) {
      for (const form of ['full', 'reduced'] as const) {
        for (const step of MOTION_PRESETS[preset][form]) {
          expect(step.duration, `${preset} ${form}`).toBeGreaterThan(0);
          expect(Number.isFinite(step.duration)).toBe(true);
          expect(Number.isInteger(step.repeat ?? 0)).toBe(true);
          expect(step.repeat ?? 0).toBeGreaterThanOrEqual(0);
        }
        expect(Number.isFinite(lastsFor(preset, form === 'reduced'))).toBe(true);
      }
    }
  });

  it('never last longer reduced than full', () => {
    for (const preset of PRESETS) {
      expect(lastsFor(preset, true), preset).toBeLessThanOrEqual(lastsFor(preset, false));
    }
  });

  it('count a step that goes there and back, and each repeat, in how long a preset lasts', () => {
    const step = MOTION_PRESETS.wiggle.full[0]!;
    const once = step.duration * (step.yoyo ? 2 : 1);
    expect(lastsFor('wiggle', false)).toBeGreaterThanOrEqual(once * ((step.repeat ?? 0) + 1));
  });
});
