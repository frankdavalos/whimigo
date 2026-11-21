import type { SoundRecipe } from '@/contract';

/** A mark placed, and three in a line. Synthesized (ADR-0014). */
export const sounds = {
  'tic-tac-toe/place': {
    notes: [{ wave: 'triangle', from: 520, to: 620, at: 0, for: 120, release: 80 }],
  },
  'tic-tac-toe/line': {
    notes: [
      { wave: 'triangle', from: 523, at: 0, for: 140 },
      { wave: 'triangle', from: 659, at: 120, for: 140 },
      { wave: 'triangle', from: 784, at: 240, for: 320, release: 200 },
    ],
  },
} satisfies Record<string, SoundRecipe>;
