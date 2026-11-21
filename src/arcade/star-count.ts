import type * as Phaser from 'phaser';
import { picture } from '@/kit/atlas';
import { drawNumber, type DrawnNumber } from '@/kit/digits';

/** How large a count of Stars is drawn, against the digits' own size. */
const SCALE = 0.6;

/**
 * A count of Stars: the Star picture, then the number in bitmap digits, the pair centred on
 * (x, y) for a count of one digit. About 120 units tall.
 */
export function drawStarCount(
  scene: Phaser.Scene,
  x: number,
  y: number,
  count: number,
): DrawnNumber {
  picture(scene, x - 60, y, 'arcade/star').setScale(SCALE);
  const drawn = drawNumber(scene, x + 10, y, count);
  drawn.object.setOrigin(0, 0.5).setScale(SCALE);
  return drawn;
}
