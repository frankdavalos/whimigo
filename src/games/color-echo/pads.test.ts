import { describe, expect, it } from 'vitest';
import { padCount } from './logic/rules';
import { PADS } from './pads';
import { sounds } from './sounds';

describe('Color Echo’s pads', () => {
  it('are enough for the most pads any Difficulty uses', () => {
    expect(PADS).toHaveLength(Math.max(padCount('easy'), padCount('medium'), padCount('hard')));
  });

  it('each have their own colour, shape and tone', () => {
    for (const field of ['color', 'frame', 'litFrame', 'tone'] as const) {
      expect(new Set(PADS.map((pad) => pad[field])).size, field).toBe(PADS.length);
    }
    for (const pad of PADS) {
      expect(pad.frame.startsWith('color-echo/')).toBe(true);
      expect(sounds[pad.tone as keyof typeof sounds], pad.tone).toBeDefined();
    }
  });

  it('have tones that never share a pitch', () => {
    const pitches = PADS.flatMap((pad) =>
      sounds[pad.tone as keyof typeof sounds].notes.flatMap((note) => [
        note.from,
        note.to ?? note.from,
      ]),
    );
    const byPad = PADS.map(
      (pad) => new Set(sounds[pad.tone as keyof typeof sounds].notes.map((n) => n.from)),
    );
    for (const [i, a] of byPad.entries()) {
      for (const b of byPad.slice(i + 1)) expect([...a].filter((p) => b.has(p))).toEqual([]);
    }
    expect(pitches.length).toBeGreaterThanOrEqual(PADS.length);
  });
});
