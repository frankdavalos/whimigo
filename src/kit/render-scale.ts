import type * as Phaser from 'phaser';
import { DESIGN_FRAME } from './frame';

/**
 * The hidden render scale (ADR-0003): canvas pixels per design unit. It is 1, so one design unit is
 * one pixel of the 13-inch iPad Pro. At 0.5 the canvas has half the pixels each way and the kit
 * zooms every Scene's camera to match, so screens keep working in design units only. Half is asked
 * for with `scale=0.5` in the address, and honoured only together with the test bridge's `e2e=1`:
 * an installed app has no address bar, so nothing a child can reach changes it.
 */
export function renderScaleFor(search: string): number {
  const query = new URLSearchParams(search);
  return query.get('e2e') === '1' && query.get('scale') === '0.5' ? 0.5 : 1;
}

/**
 * The render scale a game was made with. The game's configured width is the design frame's at that
 * scale, and it never changes after boot, so it is the one place the number is kept.
 */
export function renderScaleOf(game: Phaser.Game): number {
  return Number(game.config.width) / DESIGN_FRAME.width;
}
