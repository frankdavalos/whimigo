import { describe, expect, it } from 'vitest';
import { REPEAT_WINDOW_MS, errorScreenKind } from './error-screen';

describe('the error screen', () => {
  it('is the friendly picture for a first error, however soon after starting', () => {
    expect(errorScreenKind({ reloadedForError: false, msSinceStart: 0 })).toBe('friendly');
    expect(errorScreenKind({ reloadedForError: false, msSinceStart: 60_000 })).toBe('friendly');
  });

  it('shows the technical message for an error within a few seconds of a start its button made', () => {
    expect(REPEAT_WINDOW_MS).toBeGreaterThanOrEqual(3_000);
    expect(REPEAT_WINDOW_MS).toBeLessThanOrEqual(15_000);
    expect(errorScreenKind({ reloadedForError: true, msSinceStart: 0 })).toBe('technical');
    expect(errorScreenKind({ reloadedForError: true, msSinceStart: REPEAT_WINDOW_MS - 1 })).toBe(
      'technical',
    );
  });

  it('is the friendly picture again once the Arcade has run for those few seconds', () => {
    expect(errorScreenKind({ reloadedForError: true, msSinceStart: REPEAT_WINDOW_MS })).toBe(
      'friendly',
    );
  });
});
