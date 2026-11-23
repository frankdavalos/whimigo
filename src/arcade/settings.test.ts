import { describe, expect, it } from 'vitest';
import type { SaveDocument } from '@/platform/save-store';
import {
  MOTION_SETTINGS,
  motionReduced,
  resetProgress,
  settingsOf,
  withMotion,
  withSound,
} from './settings';

const FRESH: SaveDocument = { version: 1, mascots: {}, games: {} };

const PLAYED: SaveDocument = {
  version: 1,
  mascots: { fox: { stars: 3 }, owl: { stars: 1 } },
  games: {
    'tic-tac-toe': {
      roundsPlayed: 2,
      choices: { style: 'turn-based', difficulty: 'hard', mascots: ['fox', 'owl'] },
    },
  },
  seating: 'around-the-table',
  sound: false,
  motion: 'on',
};

describe('the grown-ups’ settings', () => {
  it('start with sound on and motion following the device', () => {
    expect(settingsOf(FRESH)).toEqual({ sound: true, motion: 'system' });
  });

  it('are kept in the save document', () => {
    const changed = withMotion(withSound(FRESH, false), 'off');
    expect(settingsOf(changed)).toEqual({ sound: false, motion: 'off' });
    expect(settingsOf(withSound(changed, true)).sound).toBe(true);
  });

  it('motion: on reduces it when the device does not ask, off does not when it does, and system follows the device', () => {
    expect(MOTION_SETTINGS).toEqual(['system', 'on', 'off']);
    expect(motionReduced('on', false)).toBe(true);
    expect(motionReduced('off', true)).toBe(false);
    expect(motionReduced('system', true)).toBe(true);
    expect(motionReduced('system', false)).toBe(false);
  });
});

describe('resetting Progress', () => {
  it('leaves no Mascot with Stars and no Game with remembered choices', () => {
    const reset = resetProgress(PLAYED);
    expect(reset.mascots).toEqual({});
    expect(Object.values(reset.games).some((game) => game.choices)).toBe(false);
  });

  it('keeps the sound, motion and Seating settings', () => {
    const reset = resetProgress(PLAYED);
    expect(settingsOf(reset)).toEqual(settingsOf(PLAYED));
    expect(reset.seating).toBe('around-the-table');
  });

  it('keeps no setting that was never chosen', () => {
    expect(resetProgress({ ...FRESH, mascots: { fox: { stars: 1 } } })).toEqual(FRESH);
  });
});
