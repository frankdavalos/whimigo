import type { Unsubscribe } from './lifecycle';

/** A width and a height, in CSS pixels unless said otherwise. */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** The screen as the browser measures it at one moment. */
export interface ScreenMeasurement {
  /** Milliseconds since the page started. */
  readonly at: number;
  /** What prompted the measurement: `start`, the browser event, or `settled` a second after one. */
  readonly cause: string;
  /** `innerWidth` and `innerHeight`. */
  readonly window: Size;
  /** The visual viewport and its zoom, where the browser has one. */
  readonly visible: (Size & { readonly scale: number }) | null;
  /** The root element's client size: the layout viewport. */
  readonly page: Size;
  /** `screen.width` and `screen.height`. */
  readonly screen: Size;
  readonly orientation: string;
  /** The box the canvas sits in. */
  readonly arcadeBox: Size;
  /** The canvas as laid out, or null before it exists. */
  readonly canvas: Size | null;
  /** The canvas's own size in pixels. */
  readonly canvasPixels: Size | null;
}

/** How many measurements the list of changes keeps: the most recent. */
export const SCREEN_CHANGES_KEPT = 12;
/** How long after a change the screen is measured again, once the browser has settled. */
export const SETTLE_MS = 1000;

const round = (value: number) => Math.round(value * 10) / 10;
const size = (of: Size) => `${round(of.width)} × ${round(of.height)}`;

/** The measurement as lines of text, for the Grown-Ups Area. */
export function describeScreen(m: ScreenMeasurement): string[] {
  return [
    `Window ${size(m.window)}`,
    m.visible ? `Visible ${size(m.visible)} at zoom ${round(m.visible.scale)}` : 'Visible: unknown',
    `Page ${size(m.page)}`,
    `Screen ${size(m.screen)}, ${m.orientation}`,
    `Arcade box ${size(m.arcadeBox)}`,
    m.canvas && m.canvasPixels
      ? `Canvas ${size(m.canvas)} (${size(m.canvasPixels)} pixels)`
      : 'Canvas: none yet',
  ];
}

/** One entry of the list of changes, on one line. */
export function describeChange(m: ScreenMeasurement): string {
  const visible = m.visible ? `visible ${size(m.visible)} at zoom ${round(m.visible.scale)}` : '';
  const canvas = m.canvas ? `canvas ${size(m.canvas)}` : 'no canvas';
  return [
    `${(m.at / 1000).toFixed(1)} s ${m.cause}: window ${size(m.window)}`,
    visible,
    `page ${size(m.page)}`,
    m.orientation,
    `box ${size(m.arcadeBox)}`,
    canvas,
  ]
    .filter(Boolean)
    .join(', ');
}

export interface ScreenWatch {
  /** The screen measured now. */
  now(): ScreenMeasurement;
  /** The most recent measurements, oldest first, from the page's start. */
  changes(): readonly ScreenMeasurement[];
  /** Calls `listener` after each new entry in the list of changes. */
  onChange(listener: () => void): Unsubscribe;
}

/**
 * Measures the screen from the page's start and each time the window, the visible area or the
 * orientation changes, and again a second later. The Grown-Ups Area shows the result, so
 * a fault seen only on a tablet can be read off it. Kept in memory only, and sent nowhere.
 */
export function watchScreen(win: Window, box: HTMLElement): ScreenWatch {
  const doc = win.document;
  const started = win.performance.now();
  const log: ScreenMeasurement[] = [];
  const listeners = new Set<() => void>();

  const measure = (cause: string): ScreenMeasurement => {
    const canvas = box.querySelector('canvas');
    const laidOut = canvas?.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const viewport = win.visualViewport;
    return {
      at: win.performance.now() - started,
      cause,
      window: { width: win.innerWidth, height: win.innerHeight },
      visible: viewport
        ? { width: viewport.width, height: viewport.height, scale: viewport.scale }
        : null,
      page: { width: doc.documentElement.clientWidth, height: doc.documentElement.clientHeight },
      screen: { width: win.screen.width, height: win.screen.height },
      orientation: win.screen.orientation?.type ?? 'orientation unknown',
      arcadeBox: { width: boxRect.width, height: boxRect.height },
      canvas: laidOut ? { width: laidOut.width, height: laidOut.height } : null,
      canvasPixels: canvas ? { width: canvas.width, height: canvas.height } : null,
    };
  };

  const record = (cause: string) => {
    log.push(measure(cause));
    if (log.length > SCREEN_CHANGES_KEPT) log.splice(0, log.length - SCREEN_CHANGES_KEPT);
    for (const listener of listeners) listener();
  };
  const changed = (event: Event) => {
    record(event.type);
    win.setTimeout(() => record('settled'), SETTLE_MS);
  };

  record('start');
  win.addEventListener('resize', changed);
  win.addEventListener('orientationchange', changed);
  win.screen.orientation?.addEventListener('change', () => changed(new Event('orientation')));
  win.visualViewport?.addEventListener('resize', () => changed(new Event('visible resize')));

  return {
    now: () => measure('now'),
    changes: () => [...log],
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
