import { describe, expect, it } from 'vitest';
import { ERRORS_KEPT, createErrorLog } from './error-log';

/** An uncaught exception, as the window reports it. */
const thrown = (message: string) => Object.assign(new Event('error'), { message });
/** An unhandled rejection, as the window reports it. */
const rejected = (reason: unknown) => Object.assign(new Event('unhandledrejection'), { reason });

describe('the error log', () => {
  it('keeps the message of each uncaught exception and unhandled rejection, oldest first', () => {
    const win = new EventTarget() as Window;
    const log = createErrorLog(win);
    win.dispatchEvent(thrown('Uncaught Error: one'));
    win.dispatchEvent(rejected(new Error('two')));
    win.dispatchEvent(rejected('three'));
    expect(log.messages()).toEqual(['Uncaught Error: one', 'two', 'three']);
  });

  it('keeps only the last few', () => {
    const win = new EventTarget() as Window;
    const log = createErrorLog(win);
    for (let index = 0; index < ERRORS_KEPT + 3; index += 1) {
      win.dispatchEvent(thrown(`error ${index}`));
    }
    expect(log.messages()).toHaveLength(ERRORS_KEPT);
    expect(log.messages().at(-1)).toBe(`error ${ERRORS_KEPT + 2}`);
    expect(log.messages()[0]).toBe('error 3');
  });

  it('tells a listener each time it changes', () => {
    const win = new EventTarget() as Window;
    const log = createErrorLog(win);
    const heard: string[][] = [];
    const stop = log.onChange((messages) => heard.push([...messages]));
    win.dispatchEvent(thrown('one'));
    stop();
    win.dispatchEvent(thrown('two'));
    expect(heard).toEqual([['one']]);
  });
});
