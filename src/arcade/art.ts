import type * as Phaser from 'phaser';
import image from '@/generated/atlases/arcade.png?url&no-inline';
import frames from '@/generated/atlases/arcade.json?url&no-inline';

/** The Arcade's own atlas: loaded once by the tap-to-start screen and never removed. */
export const ARCADE_ATLAS = 'arcade';

/** Queues the Arcade's atlas in a Scene's preload, unless it is already loaded. */
export function loadArcadeArt(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ARCADE_ATLAS)) scene.load.atlas(ARCADE_ATLAS, image, frames);
}
