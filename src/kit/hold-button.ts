import type * as Phaser from 'phaser';
import type { SnapshotTarget } from '@/contract';
import { createHold, HOLD_MS } from './hold';
import { colors, sizes } from './theme';

export interface HoldButtonOptions {
  /** Centre, in design units. */
  readonly x: number;
  readonly y: number;
  /** Draws the button's picture, centred on (0, 0), into the given Graphics. */
  readonly icon: (graphics: Phaser.GameObjects.Graphics, size: number) => void;
  /** Called once each time a finger has stayed on the button for the whole hold. */
  readonly onHold: () => void;
  readonly duration?: number;
}

/**
 * A control that acts only on a deliberate hold of about half a second, filling a ring while it
 * is held. A short tap or a brush does nothing. Used for leaving a screen and resetting counters.
 */
export function holdButton(scene: Phaser.Scene, options: HoldButtonOptions): SnapshotTarget {
  const size = sizes.button;
  const radius = size / 2;
  const hold = createHold(options.duration ?? HOLD_MS);

  const face = scene.add.graphics({ x: options.x, y: options.y });
  face.fillStyle(colors.cream).fillCircle(0, 0, radius - sizes.outline);
  face.lineStyle(sizes.outline, colors.ink).strokeCircle(0, 0, radius - sizes.outline);
  options.icon(face, size);

  const ring = scene.add.graphics({ x: options.x, y: options.y });
  const hit = scene.add
    .rectangle(options.x, options.y, size, size)
    .setInteractive()
    .on('pointerdown', (pointer: Phaser.Input.Pointer) => hold.press(pointer.id, scene.time.now))
    .on('pointerout', (pointer: Phaser.Input.Pointer) => hold.release(pointer.id));
  const release = (pointer: Phaser.Input.Pointer) => hold.release(pointer.id);
  scene.input.on('pointerup', release);

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
