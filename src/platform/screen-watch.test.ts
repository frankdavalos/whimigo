import { describe, expect, it } from 'vitest';
import {
  describeChange,
  describeScreen,
  SCREEN_CHANGES_KEPT,
  SETTLE_MS,
  watchScreen,
} from './screen-watch';

/** Just enough of a window, a screen and the Arcade's box to measure, with a clock run by hand. */
function fakeWindow() {
  const timers: { at: number; run: () => void }[] = [];
  let clock = 0;
  const rect = (width: number, height: number) => () => ({ width, height }) as DOMRect;
  const win = Object.assign(new EventTarget(), {
    innerWidth: 1376,
    innerHeight: 1032,
    performance: { now: () => clock },
    document: { documentElement: { clientWidth: 1376, clientHeight: 1032 } },
    visualViewport: Object.assign(new EventTarget(), { width: 1376, height: 1032, scale: 1 }),
    screen: {
      width: 1032,
      height: 1376,
      orientation: Object.assign(new EventTarget(), { type: 'landscape-primary' }),
    },
    setTimeout: (run: () => void, ms: number) => timers.push({ at: clock + ms, run }),
  });
  const canvas = { width: 2752, height: 2064, getBoundingClientRect: rect(1376, 1032) };
  const box = { getBoundingClientRect: rect(1376, 1032), querySelector: () => canvas };
  return {
    win: win as unknown as Window,
    box: box as unknown as HTMLElement,
    turn(width: number, height: number) {
      Object.assign(win, { innerWidth: width, innerHeight: height });
      win.dispatchEvent(new Event('resize'));
    },
    advance(ms: number) {
      clock += ms;
      for (const timer of timers.filter((t) => t.at <= clock)) {
        timers.splice(timers.indexOf(timer), 1);
        timer.run();
      }
    },
  };
}

describe('the screen watch', () => {
  it('measures the screen at the start', () => {
    const { win, box } = fakeWindow();
    const [start] = watchScreen(win, box).changes();
    expect(start).toMatchObject({
      at: 0,
      cause: 'start',
      window: { width: 1376, height: 1032 },
      visible: { width: 1376, height: 1032, scale: 1 },
      page: { width: 1376, height: 1032 },
      orientation: 'landscape-primary',
      canvasPixels: { width: 2752, height: 2064 },
    });
  });

  it('measures each change as it happens, and again once the browser has settled', () => {
    const fake = fakeWindow();
    const watch = watchScreen(fake.win, fake.box);
    let told = 0;
    watch.onChange(() => (told += 1));
    fake.advance(200);
    fake.turn(1032, 1376);
    expect(watch.changes().map((m) => [m.at, m.cause, m.window.width])).toEqual([
      [0, 'start', 1376],
      [200, 'resize', 1032],
    ]);
    fake.advance(SETTLE_MS - 1);
    expect(watch.changes()).toHaveLength(2);
    fake.advance(1);
    expect(watch.changes().at(-1)).toMatchObject({ at: 1200, cause: 'settled' });
    expect(told).toBe(2);
  });

  it('keeps only the most recent changes', () => {
    const fake = fakeWindow();
    const watch = watchScreen(fake.win, fake.box);
    for (let turn = 0; turn < 20; turn += 1) {
      fake.advance(10);
      fake.turn(1000 + turn, 1376);
    }
    const kept = watch.changes();
    expect(kept).toHaveLength(SCREEN_CHANGES_KEPT);
    expect(kept.at(-1)!.window.width).toBe(1019);
  });

  it('describes a measurement for the Grown-Ups Area', () => {
    const fake = fakeWindow();
    const [start] = watchScreen(fake.win, fake.box).changes();
    expect(describeScreen(start!)).toEqual([
      'Window 1376 × 1032',
      'Visible 1376 × 1032 at zoom 1',
      'Page 1376 × 1032',
      'Screen 1032 × 1376, landscape-primary',
      'Arcade box 1376 × 1032',
      'Canvas 1376 × 1032 (2752 × 2064 pixels)',
    ]);
    expect(describeChange(start!)).toBe(
      '0.0 s start: window 1376 × 1032, visible 1376 × 1032 at zoom 1, page 1376 × 1032, landscape-primary, box 1376 × 1032, canvas 1376 × 1032',
    );
  });
});
