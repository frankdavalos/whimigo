import { describe, expect, it } from 'vitest';
import { runningAs } from './display-mode';

/** A window whose display mode is `mode`, as its media queries report it. */
function windowIn(mode: string, standalone?: boolean): Window {
  return {
    matchMedia: (query: string) => ({ matches: query === `(display-mode: ${mode})` }),
    navigator: standalone === undefined ? {} : { standalone },
  } as unknown as Window;
}

describe('how the Arcade is running', () => {
  it('is in a browser tab when the page shows in the browser', () => {
    expect(runningAs(windowIn('browser'))).toBe('browser-tab');
    expect(runningAs(windowIn('browser', false))).toBe('browser-tab');
  });

  it('is an installed app when opened from the home screen, in any app display mode', () => {
    for (const mode of ['fullscreen', 'standalone', 'minimal-ui']) {
      expect(runningAs(windowIn(mode)), mode).toBe('installed');
    }
  });

  it('is an installed app when iPadOS says the page is standalone', () => {
    expect(runningAs(windowIn('browser', true))).toBe('installed');
  });
});
