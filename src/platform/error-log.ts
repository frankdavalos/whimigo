import type { Unsubscribe } from './lifecycle';

/** How many error messages the log keeps. */
export const ERRORS_KEPT = 5;

/**
 * The last few error messages, for the Grown-Ups Area. Held in memory only, and sent nowhere
 * (overview, Failure handling).
 */
export interface ErrorLog {
  /** Oldest first. */
  messages(): readonly string[];
  onChange(listener: (messages: readonly string[]) => void): Unsubscribe;
}

const messageOf = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

/** Listens for every uncaught exception and unhandled rejection from now on. */
export function createErrorLog(win: Window): ErrorLog {
  const messages: string[] = [];
  const listeners = new Set<(messages: readonly string[]) => void>();
  const add = (message: string) => {
    messages.push(message);
    if (messages.length > ERRORS_KEPT) messages.shift();
    for (const listener of listeners) listener(messages);
  };
  win.addEventListener('error', (event) => add((event as ErrorEvent).message));
  win.addEventListener('unhandledrejection', (event) =>
    add(messageOf((event as PromiseRejectionEvent).reason)),
  );
  return {
    messages: () => [...messages],
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
