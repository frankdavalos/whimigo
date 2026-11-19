import type { Note, SoundRecipe } from '@/contract';

/** The pitches a recipe may use, in hertz: the range of human hearing. */
export const AUDIBLE_HZ = { min: 20, max: 20_000 } as const;

/** The longest a sound may last, in milliseconds: a cue, never a tune. */
export const MAX_SOUND_MS = 3000;

/** The end of a note, in milliseconds from the start of the sound. */
const endOf = (note: Note) => note.at + note.for;

/** Is `value` a number from `min` to `max`, inclusive? NaN is not. */
const within = (value: number, min: number, max: number) => value >= min && value <= max;

/**
 * What is wrong with a recipe, one message per problem, each naming the note it is about by its
 * index. An empty list means the recipe can be rendered.
 */
export function validateRecipe(recipe: SoundRecipe): string[] {
  if (recipe.notes.length === 0) return ['the sound has no notes'];
  const problems: string[] = [];
  recipe.notes.forEach((note, index) => {
    const problem = (text: string) => problems.push(`note ${index}: ${text}`);
    if (!(note.for > 0)) problem(`its duration must be more than 0 ms, not ${note.for}`);
    if (!(note.at >= 0)) problem(`its start must be 0 ms or later, not ${note.at}`);
    if (note.wave !== 'noise') {
      for (const pitch of new Set([note.from, note.to ?? note.from])) {
        if (!within(pitch, AUDIBLE_HZ.min, AUDIBLE_HZ.max)) {
          problem(`its pitch must be from ${AUDIBLE_HZ.min} to ${AUDIBLE_HZ.max} Hz, not ${pitch}`);
        }
      }
    }
    if (note.gain !== undefined && !within(note.gain, 0, 1)) {
      problem(`its gain must be from 0 to 1, not ${note.gain}`);
    }
    for (const [name, value] of [
      ['attack', note.attack],
      ['release', note.release],
    ] as const) {
      if (value !== undefined && !(value >= 0)) problem(`its ${name} must not be negative`);
    }
    if (endOf(note) > MAX_SOUND_MS) {
      problem(
        `it ends at ${endOf(note)} ms, after the longest a sound may last, ${MAX_SOUND_MS} ms`,
      );
    }
  });
  return problems;
}

/** Loudness, and fade-in and fade-out times in milliseconds, for a note that does not say. */
export const NOTE_DEFAULTS = { gain: 0.5, attack: 5, release: 30 } as const;

/** Every render of a recipe uses the same noise, so the same recipe always sounds the same. */
const NOISE_SEED = 0x5eed;

/** A small seeded random source (mulberry32): numbers from 0 to 1. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** One cycle of each pitched wave, for a phase from 0 to 1, starting at 0 and rising. */
const WAVES: Record<Exclude<Note['wave'], 'noise'>, (phase: number) => number> = {
  sine: (phase) => Math.sin(2 * Math.PI * phase),
  triangle: (phase) => 1 - 4 * Math.abs(((phase + 0.25) % 1) - 0.5),
  square: (phase) => (phase % 1 < 0.5 ? 1 : -1),
  sawtooth: (phase) => 2 * ((phase + 0.5) % 1) - 1,
};

/**
 * Renders a valid recipe (see `validateRecipe`) into mono samples at `sampleRate`: pure, with no
 * audio context, so it runs anywhere. There is one sample per tick up to the end of the last
 * note. Each note fades in over its attack and out over its release, reaching silence on its
 * first and last sample, so it starts and ends without a click. A glide moves its pitch
 * evenly in musical steps. Notes are added together; if overlapping notes would go beyond full
 * scale, the whole sound is scaled down to fit rather than clipped.
 */
export function renderRecipe(recipe: SoundRecipe, sampleRate: number): Float32Array<ArrayBuffer> {
  const tick = (ms: number) => Math.round((ms * sampleRate) / 1000);
  const mix = new Float64Array(tick(Math.max(...recipe.notes.map(endOf))));
  recipe.notes.forEach((note, index) => {
    const first = tick(note.at);
    const count = tick(endOf(note)) - first;
    const gain = note.gain ?? NOTE_DEFAULTS.gain;
    // A fade longer than the note is shortened, keeping the two fades' proportions.
    let attack = tick(note.attack ?? NOTE_DEFAULTS.attack);
    let release = tick(note.release ?? NOTE_DEFAULTS.release);
    const squeeze = Math.min(1, (count - 1) / Math.max(1, attack + release));
    attack *= squeeze;
    release *= squeeze;
    const envelope = (k: number) =>
      gain * Math.min(1, attack > 0 ? k / attack : 1, release > 0 ? (count - 1 - k) / release : 1);

    if (note.wave === 'noise') {
      const random = seededRandom(NOISE_SEED + index * 0x9e3779b9);
      for (let k = 0; k < count; k++) mix[first + k]! += (random() * 2 - 1) * envelope(k);
      return;
    }
    const wave = WAVES[note.wave];
    const ratio = (note.to ?? note.from) / note.from;
    let phase = 0;
    for (let k = 0; k < count; k++) {
      mix[first + k]! += wave(phase) * envelope(k);
      phase += (note.from * ratio ** (k / Math.max(1, count - 1))) / sampleRate;
    }
  });

  const loudest = mix.reduce((most, x) => Math.max(most, Math.abs(x)), 0);
  const scale = loudest > 1 ? 1 / loudest : 1;
  return Float32Array.from(mix, (x) => x * scale);
}
