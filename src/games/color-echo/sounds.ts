import type { Note, SoundRecipe } from '@/contract';

/** A pad's tone: one soft note, shorter than the shortest time a pad stays lit. */
const tone = (from: number): SoundRecipe => ({
  notes: [{ wave: 'triangle', from, at: 0, for: 200, gain: 0.55, release: 120 } satisfies Note],
});

/** Each pad's tone, a major chord's notes apart so any sequence sounds pleasant. Synthesized (ADR-0014). */
export const sounds = {
  'color-echo/tone-circle': tone(523.25),
  'color-echo/tone-square': tone(659.25),
  'color-echo/tone-triangle': tone(783.99),
  'color-echo/tone-star': tone(1046.5),
} satisfies Record<string, SoundRecipe>;
