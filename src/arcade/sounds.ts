import type { SoundRecipe } from '@/contract';

/**
 * The Arcade's shared sounds, loaded at boot and kept for the life of the page. A Game asks for
 * one by its bare key. An ignored touch has no sound of its own, and must request none.
 */
export const SHARED_SOUNDS = {
  /** An accepted touch with no sound of the Game's own. */
  tap: { notes: [{ wave: 'sine', from: 880, to: 990, at: 0, for: 70, release: 50 }] },
  /** A choice that was accepted but was not the right one: soft and falling, never harsh. */
  wrong: {
    notes: [
      { wave: 'triangle', from: 392, to: 330, at: 0, for: 180, gain: 0.45 },
      { wave: 'triangle', from: 330, to: 262, at: 160, for: 260, gain: 0.4, release: 180 },
    ],
  },
  /** A Round won, or played to its end. */
  win: {
    notes: [
      { wave: 'triangle', from: 523, at: 0, for: 130 },
      { wave: 'triangle', from: 659, at: 110, for: 130 },
      { wave: 'triangle', from: 784, at: 220, for: 130 },
      { wave: 'triangle', from: 1047, at: 330, for: 380, release: 260 },
    ],
  },
} satisfies Record<string, SoundRecipe>;
