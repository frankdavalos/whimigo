import type * as Phaser from 'phaser';
import type { SnapshotTarget } from '@/contract';
import { picture } from './atlas';
import { createHold } from './hold';
import { colors, sizes } from './theme';
import { onTouchesReset } from './touches';

export interface HoldButtonOptions {
  /** Centre, in design units. */
  readonly x: number;
  readonly y: number;
  /** The atlas frame drawn on the button's face. */
  readonly icon: string;
  /** Called once each time a finger has stayed on the button for the whole hold. */
  readonly onHold: () => void;
  /** Draws it, and takes its touches, above everything of a lower depth. Defaults to 0. */
  readonly depth?: number;
}

/** The face every hold control shares, from the Arcade's atlas, which is loaded at boot. */
const HOLD_FACE = 'arcade/hold';

/**
 * A control that acts only on a deliberate hold of about half a second, filling a ring while it
 * is held. A short tap or a brush does nothing. Used for pausing a Round, leaving a screen and
 * resetting counters.
 */
export function holdButton(scene: Phaser.Scene, options: HoldButtonOptions): SnapshotTarget {
  const size = sizes.button;
  const radius = size / 2;
  const hold = createHold();

  const depth = options.depth ?? 0;
  picture(scene, options.x, options.y, HOLD_FACE).setDepth(depth);
  picture(scene, options.x, options.y, options.icon).setDepth(depth);

  const ring = scene.add.graphics({ x: options.x, y: options.y }).setDepth(depth);
  const hit = scene.add
    .rectangle(options.x, options.y, size, size)
    .setDepth(depth)
    .setInteractive()
    .on('pointerdown', (pointer: Phaser.Input.Pointer) => hold.press(pointer.id, scene.time.now))
    .on('pointerout', (pointer: Phaser.Input.Pointer) => hold.release(pointer.id));
  const release = (pointer: Phaser.Input.Pointer) => hold.release(pointer.id);
  scene.input.on('pointerup', release);
  onTouchesReset(scene, () => hold.cancel());

  const update = () => {
    const now = scene.time.now;
    const done = hold.update(now);
    ring.clear();
    const progress = hold.progress(now);
    if (progress > 0) {
      ring
        .lineStyle(sizes.outline * 2, colors.coral)
        .beginPath()
        .arc(0, 0, radius - sizes.outline / 2, -Math.PI / 2, -Math.PI / 2 + progress * 2 * Math.PI)
        .strokePath();
    }
    if (done) options.onHold();
  };
  scene.events.on('update', update);
  scene.events.once('shutdown', () => {
    scene.events.off('update', update);
    scene.input.off('pointerup', release);
  });

  return {
    x: options.x,
    y: options.y,
    rect: { x: hit.x - size / 2, y: hit.y - size / 2, width: size, height: size },
  };
}
