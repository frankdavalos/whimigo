import type * as Phaser from 'phaser';

/**
 * Pictures come from atlases built from SVG (ADR-0011). Every frame key begins with its set's
 * id, and each set's atlas is loaded as the texture of that name, so a frame key alone says
 * where to find it: 'arcade/home' is the frame 'arcade/home' of the texture 'arcade'.
 */
export const atlasOf = (frame: string): string => frame.split('/')[0] ?? frame;

/** Draws an atlas frame centred on (x, y), at its size in design units. */
export function picture(
  scene: Phaser.Scene,
  x: number,
  y: number,
  frame: string,
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, atlasOf(frame), frame);
}
