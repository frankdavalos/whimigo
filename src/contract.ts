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

/** A Seat's position in a Session. Seat 0 is the first Player to join. */
export type SeatIndex = 0 | 1 | 2 | 3;

/** How the Players are sitting. Decides where Zones go and which way they face. */
export type Seating = 'side-by-side' | 'around-the-table';

/** The region of the screen that belongs to one Seat during simultaneous play. */
export interface Zone {
  readonly seat: SeatIndex;
  readonly rect: Rect;
  /** Which way the Player in this Zone is facing, in degrees. */
  readonly facing: 0 | 180;
}

/** A touch that belongs to a Seat. */
export interface SeatTouch {
  readonly seat: SeatIndex;
  /** Position in the Seat's Zone-local coordinates, already rotated for its facing. */
  readonly x: number;
  readonly y: number;
  /** The browser's timestamp for the touch, in milliseconds. Use this, not frame time, to order touches. */
  readonly time: number;
}
