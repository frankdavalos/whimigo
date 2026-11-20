import type * as Phaser from 'phaser';
import type { Rect } from '@/contract';
import { DESIGN_FRAME, safeRect, type Insets } from './frame';
import { renderScaleOf } from './render-scale';
import { cssColor } from './theme';

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
 * Points the Scene's one camera at the design frame, zoomed to the render scale, and keeps it
 * centred when the screen changes size; works out the safe rectangle from the safe-area insets the
 * device reports, which are in CSS pixels.
 */
export function createStage(scene: Phaser.Scene, reportedCssInsets: Insets): Stage {
  const camera = scene.cameras.main;
  const renderScale = renderScaleOf(scene.game);
  const centre = () =>
    camera
      .setZoom(renderScale)
      .centerOn(DESIGN_FRAME.x + DESIGN_FRAME.width / 2, DESIGN_FRAME.y + DESIGN_FRAME.height / 2);
  centre();
  scene.scale.on('resize', centre);
  scene.events.once('shutdown', () => scene.scale.off('resize', centre));

  const unitsPerCssPixel = scene.scale.displayScale.x / renderScale;
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
