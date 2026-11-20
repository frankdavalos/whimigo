/** Readings are averaged over at least this many milliseconds of frames. */
export const READING_WINDOW_MS = 1000;

export interface FrameReading {
  /** Frames per second over the window. */
  readonly fps: number;
  /** The mean time the engine spent stepping and drawing one frame, in milliseconds. */
  readonly workMs: number;
  /** How many milliseconds the window covers: at least READING_WINDOW_MS. */
  readonly spanMs: number;
}

export interface FrameMeter {
  /** One frame ended at `at` (milliseconds), after `workMs` of work. */
  frame(at: number, workMs: number): void;
  /** The readings over the most recent window, or null until frames have covered one. */
  reading(): FrameReading | null;
  /** Forgets every frame. */
  reset(): void;
}

/**
 * Frames per second and work per frame, over a rolling window of at least a second. Work per frame
 * is measured, not derived from the frame rate, which the display caps. Pure: times come in.
 */
export function createFrameMeter(windowMs: number = READING_WINDOW_MS): FrameMeter {
  let frames: { at: number; workMs: number }[] = [];

  return {
    frame(at, workMs) {
      frames.push({ at, workMs });
      // Drop the oldest frame while the rest still cover the window.
      while (frames.length > 2 && frames[frames.length - 1]!.at - frames[1]!.at >= windowMs) {
        frames.shift();
      }
    },
    reading() {
      const first = frames[0];
      const last = frames[frames.length - 1];
      if (!first || !last || last.at - first.at < windowMs) return null;
      const spanMs = last.at - first.at;
      // Each frame after the first ends one interval of the span.
      const ended = frames.slice(1);
      return {
        fps: (ended.length * 1000) / spanMs,
        workMs: ended.reduce((sum, frame) => sum + frame.workMs, 0) / ended.length,
        spanMs,
      };
    },
    reset() {
      frames = [];
    },
  };
}
