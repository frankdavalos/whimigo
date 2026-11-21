import type * as Phaser from 'phaser';
import type { Round, RoundSnapshot, RoundStart } from '@/contract';
import { createDemo } from './demo';
import { holdButton } from './hold-button';
import { createMotion } from './motion';
import { createRng } from './rng';
import { createStage } from './stage';
import { sizes } from './theme';

const NOTHING_EXPOSED: RoundSnapshot = { state: null, targets: {} };

/** Above anything a Game draws, so nothing hides the pause control or takes its touches. */
const PAUSE_DEPTH = 1_000_000;
/** The Demo plays above the Game and below the pause control, which works while it plays. */
const DEMO_DEPTH = PAUSE_DEPTH - 1;

/**
 * The first thing a Game's Scene does in `create`: turns what the Arcade started it with into the
 * Round's toolkit (its Session, Stage, random source, sound, motion and Demo), mounts the pause
 * control halfway down the safe rectangle's left edge, and tells the Arcade the Round has opened.
 * There is no base class to extend.
 */
export function openRound(scene: Phaser.Scene, start: RoundStart): Round {
  const { host } = start;
  const stage = createStage(scene, host.insets());
  const { safe } = stage;
  const pause = holdButton(scene, {
    x: safe.x + sizes.button / 2,
    y: safe.y + safe.height / 2,
    icon: 'arcade/pause',
    onHold: () => host.pause(),
    depth: PAUSE_DEPTH,
  });
  const motion = createMotion(scene, host.reducedMotion());
  const demo = createDemo(scene, { safe, motion, depth: DEMO_DEPTH });

  // The Round's own time: Scene frames only, and none while the Demo plays.
  let now = 0;
  const tick = (_time: number, delta: number) => {
    if (!demo.playing) now += delta;
  };
  scene.events.on('preupdate', tick);
  scene.events.once('shutdown', () => scene.events.off('preupdate', tick));

  let describe = () => NOTHING_EXPOSED;
  let finished = false;
  let refusals = 0;
  host.opened(scene, stage, {
    snapshot() {
      const { state, targets } = describe();
      return { state, targets: { ...targets, pause } };
    },
    demo: () => demo.report(),
    refusals: () => refusals,
    showDemo: () => demo.replay(),
  });
  return {
    session: start.session,
    stage,
    rng: createRng(start.seed),
    number: start.number,
    motion,
    now: () => now,
    audio: {
      sfx(key) {
        if (!finished) host.sfx(key, scene.time.now);
      },
    },
    demo: (steps) => demo.run(steps, start.number === 0),
    refuse(target) {
      if (finished) return;
      refusals += 1;
      void motion.play(target, 'wiggle');
    },
    finish(result) {
      if (finished) return;
      finished = true;
      host.finish(result);
    },
    expose(snapshot) {
      describe = snapshot;
    },
  };
}
