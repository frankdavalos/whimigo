import type { Rect } from '@/contract';

/** The design frame: the 13-inch iPad Pro's native size. Every screen is laid out in it. */
export const DESIGN_FRAME: Rect = { x: 0, y: 0, width: 2752, height: 2064 };

/** Nothing a child must touch sits closer than this to an edge, whatever the device reports. */
export const SAFE_MARGIN = 88;

/** Insets on each side of a rectangle. */
export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * The design frame inset on each side by the larger of the reported safe-area inset, in design
 * units, and the fixed margin.
 */
export function safeRect(reported: Insets): Rect {
  const top = Math.max(reported.top, SAFE_MARGIN);
  const right = Math.max(reported.right, SAFE_MARGIN);
  const bottom = Math.max(reported.bottom, SAFE_MARGIN);
  const left = Math.max(reported.left, SAFE_MARGIN);
  return {
    x: DESIGN_FRAME.x + left,
    y: DESIGN_FRAME.y + top,
    width: DESIGN_FRAME.width - left - right,
    height: DESIGN_FRAME.height - top - bottom,
  };
}

/**
 * Where the design frame lies on a canvas of the given size in pixels, at the given render scale.
 * The kit keeps it centred: extra width or height on screens that are not 4:3 shows backdrop only.
 */
export function frameOnCanvas(
  canvas: { readonly width: number; readonly height: number },
  renderScale: number,
): Rect {
  const width = DESIGN_FRAME.width * renderScale;
  const height = DESIGN_FRAME.height * renderScale;
  return { x: (canvas.width - width) / 2, y: (canvas.height - height) / 2, width, height };
}
