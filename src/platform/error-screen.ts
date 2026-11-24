import type { ErrorLog } from './error-log';

/**
 * How soon after a start made by the error screen's button another error shows the technical
 * message rather than the picture, in milliseconds since the page began loading.
 */
export const REPEAT_WINDOW_MS = 10_000;

/** Left in the tab's session by the button, so the page it reloads knows why it started. */
const RELOADED_KEY = 'whimigo:reloaded-for-error';

export type ErrorScreenKind = 'friendly' | 'technical';

/**
 * Which error screen an unexpected error shows (overview, Errors and recovery): the picture and its
 * button, unless the error comes within a few seconds of a start its button made. Then reloading
 * has not helped, so the screen shows the technical message for a grown-up, and the Arcade cannot
 * loop.
 */
export function errorScreenKind(start: {
  readonly reloadedForError: boolean;
  readonly msSinceStart: number;
}): ErrorScreenKind {
  return start.reloadedForError && start.msSinceStart < REPEAT_WINDOW_MS ? 'technical' : 'friendly';
}

/** Reads and clears the mark the button left, if the tab's session can be read at all. */
function takeReloadMark(win: Window): boolean {
  try {
    const marked = win.sessionStorage.getItem(RELOADED_KEY) !== null;
    win.sessionStorage.removeItem(RELOADED_KEY);
    return marked;
  } catch {
    return false;
  }
}

/**
 * The fatal error screen: plain HTML, so it works when Phaser or WebGL has failed. Its markup is
 * in index.html; this shows it on any uncaught exception or unhandled promise rejection. Its one
 * button reloads the page, and never by itself. When the error repeats soon after that reload, the
 * screen also shows the last few error messages.
 */
export function installErrorScreen(win: Window, screen: HTMLElement, errors: ErrorLog): void {
  const button = screen.querySelector('button');
  const message = screen.querySelector<HTMLElement>('#error-message');
  const reloadedForError = takeReloadMark(win);
  const show = () => {
    const kind = errorScreenKind({ reloadedForError, msSinceStart: win.performance.now() });
    if (message && kind === 'technical') {
      message.textContent = errors.messages().join('\n');
      message.hidden = false;
    }
    if (!screen.hidden) return;
    screen.hidden = false;
    button?.focus();
  };
  win.addEventListener('error', show);
  win.addEventListener('unhandledrejection', show);
  button?.addEventListener('click', () => {
    try {
      win.sessionStorage.setItem(RELOADED_KEY, '1');
    } catch {
      // Without the tab's session the next start cannot tell; it shows the picture again.
    }
    win.location.reload();
  });
}
