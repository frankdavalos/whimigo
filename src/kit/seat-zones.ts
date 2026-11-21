import type { SeatIndex, SeatTouch, SeatZones, Zone } from '@/contract';
import { attributeTouch, heldSeats, noTouches, type TouchInput } from './seat-touches';

/** SeatZones apart from Phaser: the Scene feeds it every touch, in design units. */
export interface SeatZonesState extends SeatZones {
  input(touch: TouchInput): void;
  /** Forgets every touch, as when the page was hidden or the Round paused with fingers down. */
  reset(): void;
  /** The Seats that have a touch down. */
  held(): SeatIndex[];
}

/**
 * Attributes touches to Seats by Zone (attributeTouch) and reports them to the Game's handlers. A
 * switched-off Seat's touches still hold its Zone, so a second finger there is still ignored, but
 * nothing of them is reported; a touch whose coming down was not reported is not reported lifting.
 */
export function createSeatZones(zones: readonly Zone[]): SeatZonesState {
  let attribution = noTouches;
  const off = new Set<SeatIndex>();
  /** The touches whose coming down was reported. */
  const heard = new Set<number>();
  const downs: ((touch: SeatTouch) => void)[] = [];
  const ups: ((touch: SeatTouch & { readonly canceled: boolean }) => void)[] = [];

  return {
    onDown: (handler) => void downs.push(handler),
    onUp: (handler) => void ups.push(handler),
    setEnabled(seat, enabled) {
      if (enabled) off.delete(seat);
      else off.add(seat);
    },
    input(touch) {
      const { state, event } = attributeTouch(zones, attribution, touch);
      attribution = state;
      if (!event) return;
      if (event.kind === 'down') {
        if (off.has(event.touch.seat)) return;
        heard.add(touch.id);
        for (const handler of downs) handler(event.touch);
        return;
      }
      if (!heard.delete(touch.id) || off.has(event.touch.seat)) return;
      for (const handler of ups) handler(event.touch);
    },
    reset() {
      attribution = noTouches;
      heard.clear();
    },
    held: () => heldSeats(attribution),
  };
}
