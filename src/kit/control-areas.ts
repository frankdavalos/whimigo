import type { Rect } from '@/contract';

/** Nothing a child touches is smaller than this, in design units (overview, Visual system). */
export const MIN_TOUCH = 256;

/** Where a control is asked to stand, and how big it is asked to be, in design units. */
export interface AskedArea {
  /** Centre. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The rectangle that takes a control's touches: as asked, but never under MIN_TOUCH either way. */
export function touchArea({ x, y, width, height }: AskedArea): Rect {
  const w = Math.max(width, MIN_TOUCH);
  const h = Math.max(height, MIN_TOUCH);
  return { x: x - w / 2, y: y - h / 2, width: w, height: h };
}

/**
 * The touch rectangle each of the kit's controls reports for what it was asked. Controls are built
 * only through the kit, so every one meets the minimum whatever a screen or Game asks of it.
 */
export const CONTROL_AREAS = {
  button: touchArea,
  iconButton: touchArea,
  holdButton: touchArea,
  panel: touchArea,
  seatBadge: touchArea,
  turnPointer: touchArea,
} as const satisfies Record<string, (asked: AskedArea) => Rect>;
