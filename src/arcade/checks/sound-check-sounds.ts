import type { SoundRecipe } from '@/contract';

/**
 * The Sound check's set, one control each: every waveform, a glide and a sequence of notes. The
 * pitches are notes of C major, so the set sounds like one family. Square and sawtooth get lower
 * gains because they sound louder than a sine at the same gain.
 */
export const checkSounds = {
  sine: { notes: [{ wave: 'sine', from: 523.25, at: 0, for: 450, release: 250 }] },
  triangle: { notes: [{ wave: 'triangle', from: 659.25, at: 0, for: 450, release: 250 }] },
  square: { notes: [{ wave: 'square', from: 392, at: 0, for: 350, gain: 0.2, release: 150 }] },
  sawtooth: {
    notes: [{ wave: 'sawtooth', from: 329.63, at: 0, for: 350, gain: 0.25, release: 150 }],
  },
  noise: {
    notes: [{ wave: 'noise', from: 0, at: 0, for: 300, gain: 0.3, attack: 2, release: 250 }],
  },
  glide: { notes: [{ wave: 'triangle', from: 329.63, to: 987.77, at: 0, for: 500, release: 120 }] },
  sequence: {
    notes: [
      { wave: 'triangle', from: 523.25, at: 0, for: 140 },
      { wave: 'triangle', from: 659.25, at: 130, for: 140 },
      { wave: 'triangle', from: 783.99, at: 260, for: 140 },
      { wave: 'triangle', from: 1046.5, at: 390, for: 320, release: 220 },
    ],
  },
} as const satisfies Record<string, SoundRecipe>;

export type CheckSound = keyof typeof checkSounds;
