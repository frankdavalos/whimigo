import type { SoundRecipe } from '@/contract';

/** The signal, a decoy, and a point won. Synthesized (ADR-0014). */
export const sounds = {
  /** Bright and rising: go! */
  'reaction-rush/signal': {
    notes: [
      { wave: 'square', from: 880, to: 1320, at: 0, for: 120, gain: 0.3 },
      { wave: 'triangle', from: 1320, at: 110, for: 220, gain: 0.5, release: 160 },
    ],
  },
  /** Low and soft, nothing like the signal. */
  'reaction-rush/decoy': {
    notes: [{ wave: 'sine', from: 294, to: 262, at: 0, for: 220, gain: 0.4, release: 140 }],
  },
  /** A point won. */
  'reaction-rush/point': {
    notes: [
      { wave: 'triangle', from: 659, at: 0, for: 110 },
      { wave: 'triangle', from: 988, at: 100, for: 240, release: 180 },
    ],
  },
} satisfies Record<string, SoundRecipe>;
