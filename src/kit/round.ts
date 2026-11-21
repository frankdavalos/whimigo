import type * as Phaser from 'phaser';
import type { Round, RoundSnapshot, RoundStart } from '@/contract';
import { holdButton } from './hold-button';
import { createRng } from './rng';
import { createStage } from './stage';
import { sizes } from './theme';

const NOTHING_EXPOSED: RoundSnapshot = { state: null, targets: {} };

/** Above anything a Game draws, so nothing hides the pause control or takes its touches. */
const PAUSE_DEPTH = 1_000_000;

/**
 * The first thing a Game's Scene does in `create`: turns what the Arcade started it with into the
 * Round's toolkit, mounts the pause control halfway down the safe rectangle's left edge, and tells
 * the Arcade the Round has opened. There is no base class to extend.
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
  let describe = () => NOTHING_EXPOSED;
  let finished = false;
  host.opened(scene, stage, () => {
    const { state, targets } = describe();
    return { state, targets: { ...targets, pause } };
  });
  return {
    session: start.session,
    stage,
    rng: createRng(start.seed),
    number: start.number,
    audio: {
      sfx(key) {
        if (!finished) host.sfx(key, scene.time.now);
      },
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
