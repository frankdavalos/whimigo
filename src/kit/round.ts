import type * as Phaser from 'phaser';
import type { Round, RoundSnapshot, RoundStart } from '@/contract';
import { createRng } from './rng';
import { createStage } from './stage';

const NOTHING_EXPOSED: RoundSnapshot = { state: null, targets: {} };

/**
 * The first thing a Game's Scene does in `create`: turns what the Arcade started it with into the
 * Round's toolkit, and tells the Arcade the Round has opened. There is no base class to extend.
 */
export function openRound(scene: Phaser.Scene, start: RoundStart): Round {
  const { host } = start;
  const stage = createStage(scene, host.insets());
  let describe = () => NOTHING_EXPOSED;
  let finished = false;
  host.opened(scene, stage, () => describe());
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
