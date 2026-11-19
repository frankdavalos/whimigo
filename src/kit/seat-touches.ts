import type { SeatIndex, SeatTouch, Zone } from '@/contract';
import { toZoneLocal, zoneAt } from './zones';

/**
 * One touch event, in design units. `id` stays the same from a touch's `down` to its `up` or
 * `cancel`. A `cancel` is a touch the system took away; Phaser reports it as a release with
 * `wasCanceled` set.
 */
export interface TouchInput {
  readonly kind: 'down' | 'move' | 'up' | 'cancel';
  readonly id: number;
  readonly x: number;
  readonly y: number;
  /** The browser's timestamp, in milliseconds. */
  readonly time: number;
}

/** What attribution reports: a Seat's touch coming down, or lifting (or being taken away). */
export type SeatEvent =
  | { readonly kind: 'down'; readonly touch: SeatTouch }
  | { readonly kind: 'up'; readonly touch: SeatTouch & { readonly canceled: boolean } };

/** Which touches are down, and the Seat each belongs to. Each Seat has at most one. */
export interface Attribution {
  readonly owned: readonly { readonly id: number; readonly seat: SeatIndex }[];
}

export const noTouches: Attribution = { owned: [] };

/**
 * Zoned touch attribution (ADR-0006), as a pure reducer. A touch belongs to the Seat in whose
 * Zone it came down, if that Seat has no other touch down, and keeps that Seat until it lifts,
 * wherever it slides. Any other touch belongs to nobody and is reported never. Pure: no Phaser,
 * no DOM.
 */
export function attributeTouch(
  zones: readonly Zone[],
  state: Attribution,
  input: TouchInput,
): { state: Attribution; event: SeatEvent | null } {
  const unchanged = { state, event: null };
  if (input.kind === 'down') {
    const zone = zoneAt(zones, input.x, input.y);
    if (!zone || state.owned.some(({ seat }) => seat === zone.seat)) return unchanged;
    return {
      state: { owned: [...state.owned, { id: input.id, seat: zone.seat }] },
      event: { kind: 'down', touch: seatTouch(zone, input) },
    };
  }

  const owner = state.owned.find(({ id }) => id === input.id);
  const zone = owner && zones.find(({ seat }) => seat === owner.seat);
  if (input.kind === 'move' || !owner || !zone) return unchanged;
  return {
    state: { owned: state.owned.filter(({ id }) => id !== input.id) },
    event: {
      kind: 'up',
      touch: { ...seatTouch(zone, input), canceled: input.kind === 'cancel' },
    },
  };
}

/** A tap is an attributed touch that lifts without being cancelled. */
export const isTap = (event: SeatEvent): boolean => event.kind === 'up' && !event.touch.canceled;

/** The Seats that have a touch down. */
export const heldSeats = (state: Attribution): SeatIndex[] => state.owned.map(({ seat }) => seat);

function seatTouch(zone: Zone, input: TouchInput): SeatTouch {
  return { seat: zone.seat, ...toZoneLocal(zone, input.x, input.y), time: input.time };
}
