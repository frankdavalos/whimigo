import type * as Phaser from 'phaser';
import type { Rect } from '@/contract';
import { DESIGN_FRAME, safeRect, type Insets } from './frame';
import { cssColor } from './theme';

/**
 * The hidden render scale: canvas pixels per design unit. Fixed at 1. At 0.5 the canvas would
 * have half the pixels each way and every camera would be zoomed to match (ADR-0003).
 */
export const RENDER_SCALE = 1;

/** A theme colour for the backdrop. Tiling frames arrive with the atlas. */
export type BackdropFill = { readonly color: number };

/** The screen, in design units. A screen never reads the window size or the pixel ratio. */
export interface Stage {
  /** The design frame inset by the larger of the reported safe-area inset and 88 units. */
  readonly safe: Rect;
  /** Fill everything visible, including the extra width or height beyond the design frame. */
  backdrop(fill: BackdropFill): void;
}

/**
 * Points the Scene's one camera at the design frame, keeps it centred when the screen changes
 * size, and works out the safe rectangle from the insets the device reports in CSS pixels.
 */
export function createStage(scene: Phaser.Scene, reportedCssInsets: Insets): Stage {
  const camera = scene.cameras.main;
  const centre = () =>
    camera
      .setZoom(RENDER_SCALE)
      .centerOn(DESIGN_FRAME.x + DESIGN_FRAME.width / 2, DESIGN_FRAME.y + DESIGN_FRAME.height / 2);
  centre();
  scene.scale.on('resize', centre);
  scene.events.once('shutdown', () => scene.scale.off('resize', centre));

  const unitsPerCssPixel = scene.scale.displayScale.x / RENDER_SCALE;
  const inUnits = (css: number) => css * unitsPerCssPixel;
  return {
    safe: safeRect({
      top: inUnits(reportedCssInsets.top),
      right: inUnits(reportedCssInsets.right),
      bottom: inUnits(reportedCssInsets.bottom),
      left: inUnits(reportedCssInsets.left),
    }),
    backdrop(fill) {
      camera.setBackgroundColor(cssColor(fill.color));
    },
  };
}
