import { describe, expect, it } from 'vitest';
import type { SoundRecipe } from '../src/contract';
import { checkSounds } from '../src/arcade/checks/sound-check-sounds';
import { SHARED_SOUNDS } from '../src/arcade/sounds';
import { CATALOG } from '../src/games/catalog';
import { renderRecipe, validateRecipe } from '../src/platform/synth';

type Recipes = Readonly<Record<string, SoundRecipe>>;

/** Each Game's sounds.ts, by its folder. */
const gameSounds = Object.fromEntries(
  Object.entries(
    import.meta.glob<{ sounds: Recipes }>('../src/games/*/sounds.ts', { eager: true }),
  ).map(([path, module]) => [path.split('/').at(-2)!, module.sounds]),
);

/** Every recipe the Arcade and its Games have, by key. */
const EVERY_RECIPE: Recipes = {
  ...SHARED_SOUNDS,
  ...checkSounds,
  ...Object.assign({}, ...Object.values(gameSounds)),
};

/** Quieter than this at its loudest, a sound is as good as silent. */
const AUDIBLE = 0.05;

describe('every sound recipe', () => {
  it('is found: each Game in the Catalog has its own sounds', () => {
    for (const game of CATALOG) {
      expect(Object.keys(gameSounds[game.id] ?? {}).length, game.id).toBeGreaterThan(0);
    }
  });

  it('of the Arcade’s shared sounds has no Game prefix: a tap, a wrong choice and a win', () => {
    expect(Object.keys(SHARED_SOUNDS).sort()).toEqual(['tap', 'win', 'wrong']);
  });

  it('passes validation, and renders to samples that are not silent and never exceed full scale', () => {
    expect(Object.keys(EVERY_RECIPE).length).toBeGreaterThan(Object.keys(SHARED_SOUNDS).length);
    for (const [key, recipe] of Object.entries(EVERY_RECIPE)) {
      expect(validateRecipe(recipe), key).toEqual([]);
      const samples = renderRecipe(recipe, 48_000);
      const loudest = samples.reduce((most, x) => Math.max(most, Math.abs(x)), 0);
      expect(loudest, `${key} is not silent`).toBeGreaterThan(AUDIBLE);
      expect(loudest, `${key} never exceeds full scale`).toBeLessThanOrEqual(1);
    }
  });
});
