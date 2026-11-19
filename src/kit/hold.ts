/** How long a deliberate hold lasts, in milliseconds of scene time. */
export const HOLD_MS = 500;

/**
 * A press that counts only when one finger stays down for the whole hold.
 * Times are scene time in milliseconds, so a paused Scene pauses the hold too.
 */
export interface Hold {
  /** A finger went down on the control. Ignored while another finger is holding it. */
  press(pointerId: number, time: number): void;
  /** A finger lifted, was cancelled or left the control. */
  release(pointerId: number): void;
  /** Forgets the press, whichever finger made it: every touch was reset. */
  cancel(): void;
  /** True exactly once, on the first update at which the hold is complete. */
  update(time: number): boolean;
  /** How far through the hold the current press is, from 0 to 1. */
  progress(time: number): number;
}

export function createHold(duration: number = HOLD_MS): Hold {
  let holder: { pointerId: number; since: number; done: boolean } | null = null;

  const progress = (time: number) =>
    holder ? Math.min(1, Math.max(0, (time - holder.since) / duration)) : 0;

  return {
    press(pointerId, time) {
      holder ??= { pointerId, since: time, done: false };
    },
    release(pointerId) {
      if (holder?.pointerId === pointerId) holder = null;
    },
    cancel() {
      holder = null;
    },
    update(time) {
      if (!holder || holder.done || progress(time) < 1) return false;
      holder.done = true;
      return true;
    },
    progress,
  };
}
