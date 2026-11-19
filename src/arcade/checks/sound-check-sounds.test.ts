import { describe, expect, it } from 'vitest';
import type { SoundRecipe } from '@/contract';
import { validateRecipe } from '@/platform/synth';
import { checkSounds } from './sound-check-sounds';

const recipes: Readonly<Record<string, SoundRecipe>> = checkSounds;

describe('the Sound check’s sounds', () => {
  it('are all valid recipes', () => {
    for (const [name, recipe] of Object.entries(recipes)) {
      expect(validateRecipe(recipe), name).toEqual([]);
    }
  });

  it('cover every waveform, a glide and a sequence of notes', () => {
    const notes = Object.values(recipes).flatMap((recipe) => recipe.notes);
    expect(new Set(notes.map((note) => note.wave))).toEqual(
      new Set(['sine', 'triangle', 'square', 'sawtooth', 'noise']),
    );
    expect(notes.some((note) => note.to !== undefined && note.to !== note.from)).toBe(true);
    expect(Object.values(recipes).some((recipe) => recipe.notes.length >= 3)).toBe(true);
  });
});
