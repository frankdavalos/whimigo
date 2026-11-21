import type { MotionPreset } from '@/contract';

/**
 * One tween of a preset. Values are relative to the target as it stood when the motion began:
 * `x` and `y` are offsets in design units, `angle` an offset in degrees, `scale` and `alpha`
 * factors. Each property goes from its first value to its second.
 */
export interface MotionStep {
  readonly props: Partial<
    Record<'x' | 'y' | 'angle' | 'scale' | 'alpha', readonly [number, number]>
  >;
  /** Milliseconds, one way. */
  readonly duration: number;
  /** Goes back to where it began, taking `duration` again. */
  readonly yoyo?: boolean;
  /** How many more times it plays. Never endless. */
  readonly repeat?: number;
  readonly ease?: string;
}

/**
 * The kit's motions (overview, Visual system). The reduced form keeps what carries meaning, as a
 * short fade, and drops what only decorates: a bounce is decoration, so its reduced form is empty.
 */
export const MOTION_PRESETS: Readonly<
  Record<
    MotionPreset,
    { readonly full: readonly MotionStep[]; readonly reduced: readonly MotionStep[] }
  >
> = {
  pop: {
    full: [{ props: { scale: [0.6, 1] }, duration: 260, ease: 'Back.easeOut' }],
    reduced: [{ props: { alpha: [0.4, 1] }, duration: 120 }],
  },
  bounce: {
    full: [{ props: { y: [0, -60] }, duration: 180, yoyo: true, repeat: 1, ease: 'Sine.easeOut' }],
    reduced: [],
  },
  wiggle: {
    full: [{ props: { angle: [-8, 8] }, duration: 80, yoyo: true, repeat: 2 }],
    reduced: [{ props: { alpha: [1, 0.6] }, duration: 100, yoyo: true }],
  },
  slide: {
    full: [{ props: { x: [-240, 0] }, duration: 300, ease: 'Cubic.easeOut' }],
    reduced: [{ props: { alpha: [0, 1] }, duration: 120 }],
  },
};

/** The steps a preset plays, in its full or reduced form. */
export const stepsOf = (preset: MotionPreset, reduced: boolean): readonly MotionStep[] =>
  MOTION_PRESETS[preset][reduced ? 'reduced' : 'full'];

/** How long a preset lasts, in milliseconds. */
export const lastsFor = (preset: MotionPreset, reduced: boolean): number =>
  stepsOf(preset, reduced).reduce(
    (total, step) => total + step.duration * (step.yoyo ? 2 : 1) * ((step.repeat ?? 0) + 1),
    0,
  );
