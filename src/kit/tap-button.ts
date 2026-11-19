import type * as Phaser from 'phaser';
import type { SnapshotTarget } from '@/contract';
import { picture } from './atlas';
import { sizes } from './theme';
import { onTouchesReset } from './touches';

export interface TapButtonOptions {
  /** Centre, in design units. */
  readonly x: number;
  readonly y: number;
  /** The atlas frame drawn on the button's face. */
  readonly icon: string;
  /** Called when a finger that came down on the button lifts on it, uncancelled. */
  readonly onTap: () => void;
}

export interface TapButton {
  readonly target: SnapshotTarget;
  /** Draws a different icon on the button's face. */
  setIcon(icon: string): void;
}

/** The face every tap control shares, from the Arcade's atlas, which is loaded at boot. */
const TAP_FACE = 'arcade/card';

/**
 * A control that acts on a tap: a finger that comes down on it and lifts on it. A finger that
 * slides off first, or a touch the system takes away, does nothing.
 */
export function tapButton(scene: Phaser.Scene, options: TapButtonOptions): TapButton {
  const size = sizes.button;
  const pressed = new Set<number>();

  picture(scene, options.x, options.y, TAP_FACE);
  const icon = picture(scene, options.x, options.y, options.icon);
  scene.add
    .rectangle(options.x, options.y, size, size)
    .setInteractive()
    .on('pointerdown', (pointer: Phaser.Input.Pointer) => pressed.add(pointer.id))
    .on('pointerout', (pointer: Phaser.Input.Pointer) => pressed.delete(pointer.id))
    .on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pressed.delete(pointer.id) && !pointer.wasCanceled) options.onTap();
    });
  const forget = (pointer: Phaser.Input.Pointer) => pressed.delete(pointer.id);
  scene.input.on('pointerup', forget);
  onTouchesReset(scene, () => pressed.clear());
  scene.events.once('shutdown', () => scene.input.off('pointerup', forget));

  return {
    target: {
      x: options.x,
      y: options.y,
      rect: { x: options.x - size / 2, y: options.y - size / 2, width: size, height: size },
    },
    setIcon: (frame) => void icon.setFrame(frame),
  };
}
