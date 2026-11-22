import type * as Phaser from 'phaser';
import type { Rect, SeatIndex, Seating, SnapshotTarget } from '@/contract';
import { picture } from './atlas';
import { CONTROL_AREAS, MIN_TOUCH } from './control-areas';
import { zonesFor, type ZonedSeats } from './zones';

/**
 * Where the Turn pointer stands for the Seat to move, the size of a Seat's shape: at the edge of the screen that belongs to
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
  const size = MIN_TOUCH;
  const { rect } = zone;
  return CONTROL_AREAS.turnPointer({
    x: rect.x + rect.width / 2,
    y: zone.facing === 0 ? rect.y + rect.height - size / 2 : rect.y + size / 2,
    width: size,
    height: size,
  });
}

/** The Turn pointer as drawn: it moves to the Seat whose Turn it is. */
export interface TurnPointer {
  /** Moves the pointer to `seat`'s edge and shows that Seat's shape. */
  point(seat: SeatIndex, shape: string): void;
  /** Where it stands now. */
  target(): SnapshotTarget;
  /**
   * The pointer's picture, for a Game to refuse a touch made out of Turn with. It sits at the centre
   * of what `point` moves, so a motion on it may play while the Turn passes.
   */
  readonly image: Phaser.GameObjects.Image;
}

/**
 * Draws the Turn pointer for a shared board: the shape of the Seat to move, at its edge of the
 * screen, so that every Player can see whose Turn it is without reading.
 */
export function turnPointer(
  scene: Phaser.Scene,
  safe: Rect,
  seats: number,
  seating: Seating,
): TurnPointer {
  const image = picture(scene, 0, 0, 'arcade/play');
  // A motion puts its target back where it stood when the motion began; moving the picture's
  // holder instead lets the pointer pass the Turn in the middle of a motion on the picture.
  const holder = scene.add.container(0, 0, [image]);
  let rect: Rect = { x: 0, y: 0, width: 0, height: 0 };
  return {
    point(seat, shape) {
      rect = turnPointerRect(safe, seats as ZonedSeats, seating, seat);
      image.setFrame(shape);
      holder.setPosition(rect.x + rect.width / 2, rect.y + rect.height / 2);
    },
    target: () => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, rect }),
    image,
  };
}
