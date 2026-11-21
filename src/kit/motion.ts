import type * as Phaser from 'phaser';
import type { Motion, MotionPreset } from '@/contract';
import { stepsOf, type MotionStep } from './motion-presets';

/** The properties a preset moves, as they stood when it began. */
type Pose = Record<'x' | 'y' | 'angle' | 'scale' | 'alpha', number>;

interface Moving {
  readonly pose: Pose;
  /** The step's tween playing now. */
  tween: Phaser.Tweens.Tween | null;
  readonly done: () => void;
  readonly destroyed: () => void;
}

type Movable = Phaser.GameObjects.GameObject & Pose;

/** A step's values, made absolute from where the target stood. */
function tweenOf(
  target: Phaser.GameObjects.GameObject,
  step: MotionStep,
  pose: Pose,
): Phaser.Types.Tweens.TweenBuilderConfig {
  const props: Record<string, Phaser.Types.Tweens.TweenPropConfig> = {};
  for (const [name, [from, to]] of Object.entries(step.props) as [keyof Pose, [number, number]][]) {
    const at = (value: number) =>
      name === 'scale' || name === 'alpha' ? pose[name] * value : pose[name] + value;
    props[name] = { getStart: () => at(from), getEnd: () => at(to) };
  }
  return {
    targets: target,
    props,
    duration: step.duration,
    yoyo: step.yoyo ?? false,
    repeat: step.repeat ?? 0,
    ease: step.ease ?? 'Linear',
  };
}

/**
 * The kit's motion presets in a Scene, on its tweens: they stop when the Scene pauses and go when
 * it resumes. A preset played on a target that is still moving first puts it back as it stood.
 */
export function createMotion(scene: Phaser.Scene, reduced: boolean): Motion {
  const moving = new Map<Phaser.GameObjects.GameObject, Moving>();

  const settle = (target: Phaser.GameObjects.GameObject) => {
    const current = moving.get(target);
    if (!current) return;
    moving.delete(target);
    target.off('destroy', current.destroyed);
    current.tween?.remove();
    if (target.scene) Object.assign(target, current.pose);
    current.done();
  };

  /** Plays the steps one after another, while `current` is still the target's motion. */
  const run = (target: Phaser.GameObjects.GameObject, current: Moving, steps: MotionStep[]) => {
    const [step, ...rest] = steps;
    if (moving.get(target) !== current) return;
    if (!step) {
      settle(target);
      return;
    }
    current.tween = scene.tweens.add({
      ...tweenOf(target, step, current.pose),
      onComplete: () => run(target, current, rest),
    });
  };

  return {
    reduced,
    play(target, preset: MotionPreset) {
      settle(target);
      const object = target as Movable;
      const pose: Pose = {
        x: object.x,
        y: object.y,
        angle: object.angle,
        scale: object.scale,
        alpha: object.alpha,
      };
      const steps = stepsOf(preset, reduced);
      if (steps.length === 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const destroyed = () => settle(target);
        const current: Moving = { pose, tween: null, done: resolve, destroyed };
        moving.set(target, current);
        target.once('destroy', destroyed);
        run(target, current, [...steps]);
      });
    },
  };
}
