import type * as Phaser from 'phaser';
import type { DemoReport, DemoStep, Motion, Rect } from '@/contract';
import { picture } from './atlas';
import { DESIGN_FRAME } from './frame';
import { onTouchesReset } from './touches';

/** The hand, from the Arcade's atlas, which is loaded at boot. Its fingertip is the point. */
const HAND = 'arcade/hand';
const FINGERTIP = { x: 0.41, y: 0.12 } as const;

/** Milliseconds: the hand gliding to a point, pressing, and resting once the last step is done. */
const GLIDE = 450;
const PRESS = 140;
const REST = 400;
/** The hand jumps to a point in reduced motion, and stays this long before acting. */
const ARRIVE_REDUCED = 150;

/** A Round's Demo player. */
export interface DemoPlayer {
  /** True while the Demo plays. */
  readonly playing: boolean;
  report(): DemoReport;
  /** Keeps the Game's steps and plays them if `play`. Resolves when the Demo ends. */
  run(steps: readonly DemoStep[], play: boolean): Promise<void>;
  /** Plays the steps again from the start, as asked for from the pause screen. */
  replay(): void;
}

interface Showing {
  readonly hand: Phaser.GameObjects.Image;
  readonly tweens: Set<Phaser.Tweens.Tween>;
}

/**
 * Plays a Demo over the real board, at `depth`: an invisible cover takes every touch, so the Game
 * hears none while it plays, and a touch on it skips the Demo; the hand performs the steps above
 * it. The cover stays until every finger that came down on it has lifted, so no finger of the tap
 * that skipped the Demo reaches the board. Everything belongs to the Scene: it pauses with it and
 * goes when it shuts down.
 */
export function createDemo(
  scene: Phaser.Scene,
  options: { readonly safe: Rect; readonly motion: Motion; readonly depth: number },
): DemoPlayer {
  const { safe, motion, depth } = options;
  let steps: readonly DemoStep[] = [];
  let plays = 0;
  let showing: Showing | null = null;
  let ended: (() => void)[] = [];
  let cover: Phaser.GameObjects.Rectangle | null = null;
  /** The fingers that came down on the cover and have not lifted. */
  const held = new Set<number>();

  /** Takes the cover away once the Demo has ended and no finger that touched it is down. */
  const uncover = () => {
    if (showing || held.size > 0 || !cover) return;
    cover.destroy();
    cover = null;
  };
  const lift = (pointer: Phaser.Input.Pointer) => {
    held.delete(pointer.id);
    uncover();
  };
  scene.input.on('pointerup', lift);
  scene.input.on('pointerupoutside', lift);
  onTouchesReset(scene, () => {
    held.clear();
    uncover();
  });

  /** A tween of the Demo's, resolved when it completes; never, if the Demo is stopped first. */
  const tween = (show: Showing, config: Phaser.Types.Tweens.TweenBuilderConfig) =>
    new Promise<void>((resolve) => {
      const added = scene.tweens.add({ ...config, onComplete: () => resolve() });
      show.tweens.add(added);
    });
  const wait = (show: Showing, ms: number) =>
    tween(show, { targets: { t: 0 }, t: 1, duration: ms });

  const moveTo = async (show: Showing, point: { x: number; y: number }) => {
    if (motion.reduced) {
      show.hand.setPosition(point.x, point.y);
      return wait(show, ARRIVE_REDUCED);
    }
    return tween(show, {
      targets: show.hand,
      x: point.x,
      y: point.y,
      duration: GLIDE,
      ease: 'Sine.easeInOut',
    });
  };

  const press = (show: Showing) =>
    tween(show, {
      targets: show.hand,
      ...(motion.reduced ? { alpha: 0.6 } : { scale: 0.85 }),
      duration: PRESS,
      yoyo: true,
    });

  const perform = async (show: Showing, step: DemoStep) => {
    if ('wait' in step) return wait(show, step.wait);
    if ('tap' in step) {
      await moveTo(show, step.tap);
      return press(show);
    }
    await moveTo(show, step.refuse);
    return motion.play(show.hand, 'wiggle');
  };

  const clear = () => {
    if (!showing) return;
    for (const added of showing.tweens) added.remove();
    showing.hand.destroy();
    showing = null;
  };

  const end = () => {
    clear();
    uncover();
    const waiting = ended;
    ended = [];
    for (const resolve of waiting) resolve();
  };

  const play = () => {
    clear();
    plays += 1;
    cover ??= scene.add
      .rectangle(
        DESIGN_FRAME.width / 2,
        DESIGN_FRAME.height / 2,
        DESIGN_FRAME.width * 3,
        DESIGN_FRAME.height * 3,
      )
      .setDepth(depth)
      .setInteractive()
      .on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        held.add(pointer.id);
        if (showing) end();
      });
    const hand = picture(scene, safe.x + safe.width * 0.8, safe.y + safe.height * 0.85, HAND)
      .setOrigin(FINGERTIP.x, FINGERTIP.y)
      .setDepth(depth);
    const show: Showing = { hand, tweens: new Set() };
    showing = show;
    void (async () => {
      for (const step of steps) {
        await perform(show, step);
        if (showing !== show) return;
      }
      await wait(show, REST);
      if (showing === show) end();
    })();
  };

  // Shutting down mid-Demo takes its objects with the Scene; there is nothing left to resolve for.
  scene.events.once('shutdown', () => {
    scene.input.off('pointerup', lift);
    scene.input.off('pointerupoutside', lift);
    showing = null;
    cover = null;
    ended = [];
  });

  return {
    get playing() {
      return showing !== null;
    },
    report: () => ({ playing: showing !== null, plays, steps }),
    run(given, shouldPlay) {
      steps = given;
      if (!shouldPlay || steps.length === 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        ended.push(resolve);
        if (!showing) play();
      });
    },
    replay() {
      if (steps.length > 0) play();
    },
  };
}
