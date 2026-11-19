/**
 * Types shared between the Arcade, the kit and Games. No runtime code.
 * Names and shapes follow docs/architecture/game-contract.md.
 */

/** A rectangle in design units. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A named point a test may tap, with the rectangle that accepts the touch. */
export interface SnapshotTarget {
  readonly x: number;
  readonly y: number;
  readonly rect: Rect;
}

/**
 * For automated tests only: a plain JSON picture of what a screen shows.
 * Targets are in design units; the test bridge converts them to page coordinates.
 */
export interface ScreenSnapshot {
  readonly state: unknown;
  readonly targets: Readonly<Record<string, SnapshotTarget>>;
}
