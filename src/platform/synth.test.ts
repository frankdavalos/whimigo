import { describe, expect, it } from 'vitest';
import type { Note, SoundRecipe } from '@/contract';
import { AUDIBLE_HZ, MAX_SOUND_MS, renderRecipe, validateRecipe } from './synth';

/** The Game contract's example: a two-note "correct" chime. */
const chime: SoundRecipe = {
  notes: [
    { wave: 'triangle', from: 660, at: 0, for: 120 },
    { wave: 'triangle', from: 880, at: 110, for: 220, release: 150 },
  ],
};

const withSecondNote = (change: Partial<Note>): SoundRecipe => ({
  notes: [chime.notes[0]!, { ...chime.notes[1]!, ...change }],
});

describe('validating a recipe', () => {
  it('accepts the Game contract’s example chime', () => {
    expect(validateRecipe(chime)).toEqual([]);
  });

  it('rejects a note lasting zero or less, naming the note', () => {
    for (const length of [0, -5]) {
      const problems = validateRecipe(withSecondNote({ for: length }));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(/^note 1: /);
      expect(problems[0]).toMatch(/duration/);
    }
  });

  it(`rejects a pitch outside the audible range, ${AUDIBLE_HZ.min} to ${AUDIBLE_HZ.max} Hz, at either end of a glide`, () => {
    for (const change of [
      { from: AUDIBLE_HZ.min - 1 },
      { from: AUDIBLE_HZ.max + 1 },
      { to: AUDIBLE_HZ.min - 1 },
      { to: AUDIBLE_HZ.max + 1 },
      { from: Number.NaN },
    ]) {
      const problems = validateRecipe(withSecondNote(change));
      expect(problems, JSON.stringify(change)).toHaveLength(1);
      expect(problems[0]).toMatch(/^note 1: .*pitch/);
    }
    for (const from of [AUDIBLE_HZ.min, AUDIBLE_HZ.max]) {
      expect(validateRecipe(withSecondNote({ from, to: from }))).toEqual([]);
    }
  });

  it('ignores the pitch of a noise note', () => {
    expect(validateRecipe(withSecondNote({ wave: 'noise', from: 0, to: 99_999 }))).toEqual([]);
  });

  it('rejects a gain outside 0 to 1', () => {
    for (const gain of [-0.1, 1.1]) {
      const problems = validateRecipe(withSecondNote({ gain }));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(/^note 1: .*gain/);
    }
    for (const gain of [0, 1]) expect(validateRecipe(withSecondNote({ gain }))).toEqual([]);
  });

  it('rejects a negative attack, release or start', () => {
    for (const [field, change] of [
      ['attack', { attack: -1 }],
      ['release', { release: -1 }],
      ['start', { at: -1 }],
    ] as const) {
      const problems = validateRecipe(withSecondNote(change));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(new RegExp(`^note 1: .*${field}`));
    }
  });

  it(`rejects a sound longer than ${MAX_SOUND_MS} ms, naming the note that runs past the end`, () => {
    expect(validateRecipe(withSecondNote({ at: MAX_SOUND_MS - 220 }))).toEqual([]);
    const problems = validateRecipe(withSecondNote({ at: MAX_SOUND_MS - 219 }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(new RegExp(`^note 1: .*${MAX_SOUND_MS} ms`));
  });

  it('rejects a sound with no notes', () => {
    expect(validateRecipe({ notes: [] })).toHaveLength(1);
  });

  it('lists every problem in every note', () => {
    const problems = validateRecipe({
      notes: [
        { wave: 'sine', from: 5, at: 0, for: 0 },
        { wave: 'square', from: 440, at: 0, for: 100, gain: 2 },
      ],
    });
    expect(problems.map((problem) => problem.slice(0, 7))).toEqual([
      'note 0:',
      'note 0:',
      'note 1:',
    ]);
  });
});

const WAVES = ['sine', 'triangle', 'square', 'sawtooth', 'noise'] as const;
const RATES = [44_100, 48_000];

const peak = (samples: Float32Array) => samples.reduce((most, x) => Math.max(most, Math.abs(x)), 0);
const rms = (samples: Float32Array) =>
  Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);

/** How many times a stretch of samples crosses zero going up, per second. */
function crossingsPerSecond(samples: Float32Array, sampleRate: number): number {
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i - 1]! < 0 && samples[i]! >= 0) crossings += 1;
  }
  return (crossings * sampleRate) / samples.length;
}

describe('rendering a recipe', () => {
  it('gives one sample per tick of the sample rate, up to the end of the last note', () => {
    for (const sampleRate of RATES) {
      // The second note ends last, though the first starts first.
      expect(renderRecipe(chime, sampleRate)).toHaveLength(Math.round(0.33 * sampleRate));
      const late: SoundRecipe = {
        notes: [
          { wave: 'sine', from: 440, at: 0, for: 900 },
          { wave: 'sine', from: 440, at: 100, for: 50 },
        ],
      };
      expect(renderRecipe(late, sampleRate)).toHaveLength(Math.round(0.9 * sampleRate));
    }
  });

  it('is not silent, for every waveform', () => {
    for (const wave of WAVES) {
      const samples = renderRecipe({ notes: [{ wave, from: 440, at: 0, for: 200 }] }, 48_000);
      expect(rms(samples), wave).toBeGreaterThan(0.1);
    }
  });

  it('plays a note at gain 0.5 unless told otherwise', () => {
    const samples = renderRecipe(
      { notes: [{ wave: 'square', from: 440, at: 0, for: 200 }] },
      48_000,
    );
    expect(peak(samples)).toBeCloseTo(0.5, 5);
  });

  it('never goes beyond full scale, even when loud notes overlap', () => {
    for (const wave of WAVES) {
      const notes = [220, 330, 440, 550].map((from, i) => ({
        wave,
        from,
        at: i * 10,
        for: 300,
        gain: 1,
      }));
      const samples = renderRecipe({ notes }, 44_100);
      expect(peak(samples), wave).toBeLessThanOrEqual(1);
      expect(peak(samples), wave).toBeGreaterThan(0.5);
    }
  });

  it('starts and ends at silence with the default attack and release', () => {
    for (const wave of WAVES) {
      for (const sampleRate of RATES) {
        const samples = renderRecipe(
          { notes: [{ wave, from: 1000, at: 0, for: 250, gain: 1 }] },
          sampleRate,
        );
        expect(Math.abs(samples[0]!), `${wave} starts`).toBe(0);
        expect(Math.abs(samples.at(-1)!), `${wave} ends`).toBe(0);
        // No jump: within the first and last millisecond it stays well below full loudness.
        const ms = Math.round(sampleRate / 1000);
        expect(peak(samples.subarray(0, ms / 4)), `${wave} rises`).toBeLessThan(0.25);
        expect(peak(samples.subarray(-ms / 4)), `${wave} falls`).toBeLessThan(0.25);
      }
    }
  });

  it('gives identical samples when the same recipe is rendered twice, noise included', () => {
    for (const wave of WAVES) {
      const recipe: SoundRecipe = {
        notes: [
          { wave, from: 300, to: 900, at: 0, for: 200 },
          { wave: 'noise', from: 0, at: 150, for: 200 },
        ],
      };
      expect(renderRecipe(recipe, 44_100)).toEqual(renderRecipe(recipe, 44_100));
    }
  });

  it('gives each noise note its own noise, so two notes are not the same hiss', () => {
    const samples = renderRecipe(
      {
        notes: [
          { wave: 'noise', from: 0, at: 0, for: 100 },
          { wave: 'noise', from: 0, at: 100, for: 100 },
        ],
      },
      48_000,
    );
    const half = samples.length / 2;
    expect(Array.from(samples.subarray(1000, 1100))).not.toEqual(
      Array.from(samples.subarray(half + 1000, half + 1100)),
    );
  });

  it('measurably changes pitch over a glide, in the stated direction', () => {
    const sampleRate = 48_000;
    for (const [from, to] of [
      [300, 1200],
      [1200, 300],
    ] as const) {
      for (const wave of ['sine', 'triangle', 'square', 'sawtooth'] as const) {
        const samples = renderRecipe({ notes: [{ wave, from, to, at: 0, for: 1000 }] }, sampleRate);
        const fifth = samples.length / 5;
        const start = crossingsPerSecond(samples.subarray(0, fifth), sampleRate);
        const end = crossingsPerSecond(samples.subarray(-fifth), sampleRate);
        if (from < to) expect(end / start, `${wave} up`).toBeGreaterThan(2);
        else expect(start / end, `${wave} down`).toBeGreaterThan(2);
      }
    }
  });

  it('holds its pitch without a glide', () => {
    const sampleRate = 48_000;
    const samples = renderRecipe(
      { notes: [{ wave: 'sine', from: 500, at: 0, for: 1000 }] },
      sampleRate,
    );
    expect(crossingsPerSecond(samples, sampleRate)).toBeCloseTo(500, -1);
  });
});
