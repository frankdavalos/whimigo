import type { AudioState } from '@/platform/audio';

/** The most entries the Sound check's log holds. Older entries are dropped. */
export const LOG_CAP = 50;

/** A change of audio state, or the page being hidden or shown, and when, in milliseconds. */
export interface SoundLogEntry {
  readonly event: AudioState | 'hidden' | 'visible';
  /** Since the Sound check opened. */
  readonly at: number;
}

/** Held in memory only, for as long as the Sound check is open, and sent nowhere. */
export type SoundLog = readonly SoundLogEntry[];

/** The log with one more entry, at most `LOG_CAP` long. */
export function logEvent(log: SoundLog, event: SoundLogEntry['event'], at: number): SoundLog {
  return [...log, { event, at: Math.round(at) }].slice(-LOG_CAP);
}
