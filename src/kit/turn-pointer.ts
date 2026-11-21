import type * as Phaser from 'phaser';
import type { Rect, SeatIndex, Seating, SnapshotTarget } from '@/contract';
import { picture } from './atlas';
import { sizes } from './theme';
import { zonesFor, type ZonedSeats } from './zones';

/**
 * Where the Turn pointer stands for the Seat to move: at the edge of the screen that belongs to
 * that Seat, which is the outer edge of the part of the safe rectangle its Zone would cover. The
 * bottom edge for a Seat facing 0°, the top edge for one facing 180°.
 */
export function turnPointerRect(
  safe: Rect,
  seats: ZonedSeats,
  seating: Seating,
  seat: SeatIndex,
): Rect {
  const zone = zonesFor(safe, seats, seating)[seat];
  if (!zone) throw new Error(`No Seat ${seat} among ${seats}`);
  const size = sizes.button;
  const { rect } = zone;
  return {
    x: rect.x + rect.width / 2 - size / 2,
    y: zone.facing === 0 ? rect.y + rect.height - size : rect.y,
    width: size,
    height: size,
  };
}

/** The Turn pointer as drawn: it moves to the Seat whose Turn it is. */
export interface TurnPointer {
  /** Moves the pointer to `seat`'s edge and shows that Seat's shape. */
  point(seat: SeatIndex, shape: string): void;
  /** Where it stands now. */
  target(): SnapshotTarget;
}

/**
 * Draws the Turn pointer for a shared board: the shape of the Seat to move, at its edge of the
 * screen, so that every Player can see whose Turn it is without reading.
 */
export function drawTurnPointer(
  scene: Phaser.Scene,
  safe: Rect,
  seats: number,
  seating: Seating,
): TurnPointer {
  const image = picture(scene, 0, 0, 'arcade/play');
  let rect: Rect = { x: 0, y: 0, width: 0, height: 0 };
  return {
    point(seat, shape) {
      rect = turnPointerRect(safe, seats as ZonedSeats, seating, seat);
      image.setFrame(shape).setPosition(rect.x + rect.width / 2, rect.y + rect.height / 2);
    },
    target: () => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, rect }),
  };
}
