import { test as base, expect, type CDPSession, type Page } from '@playwright/test';
import type { Rect } from '../../src/contract';
import type { TestBridge } from '../../src/arcade/test-bridge';

type Methods = {
  [
    K in keyof TestBridge as TestBridge[K] extends (...args: never[]) => unknown ? K : never
  ]: Extract<TestBridge[K], (...args: never[]) => unknown>;
};

export type Point = { readonly x: number; readonly y: number };

/** The design frame's width, in design units. */
export const DESIGN_WIDTH = 2752;

/** Nothing a child touches is smaller than this, in design units. */
export const MIN_TARGET = 256;
/** The least space between two controls, in design units. */
export const MIN_GAP = 64;

/** The space between two rectangles, negative when they overlap. */
export const gapBetween = (a: Rect, b: Rect) =>
  Math.max(
    b.x - (a.x + a.width),
    a.x - (b.x + b.width),
    b.y - (a.y + a.height),
    a.y - (b.y + b.height),
  );

/**
 * Screen shapes tested beyond each project's own viewport. Both are on their side: an upright one
 * shows the rotate picture.
 */
export const OTHER_VIEWPORTS = {
  '16:9': { width: 1600, height: 900 },
  // Narrower than the design frame, so the canvas grows downwards.
  'a narrow window': { width: 1100, height: 1000 },
} as const;

/** Drives the running Arcade the way a test should: through the bridge and real touches. */
export class Arcade {
  private cdp: Promise<CDPSession> | null = null;

  constructor(readonly page: Page) {}

  /**
   * Opens the Arcade with the test bridge on, and waits for the tap-to-start screen. `search` adds
   * to the address's query, as `&scale=0.5` does.
   */
  async open(search = ''): Promise<void> {
    await this.page.goto(`./?e2e=1${search}`);
    await expect.poll(() => this.screen()).toBe('start');
  }

  /** Calls the bridge inside the page. */
  async call<K extends keyof Methods>(
    name: K,
    ...args: Parameters<Methods[K]>
  ): Promise<ReturnType<Methods[K]>> {
    return this.page.evaluate(
      ([name, args]) => {
        const bridge = window.whimigo;
        if (!bridge) throw new Error('The test bridge is not on window');
        const member = bridge[name as keyof TestBridge] as (...a: unknown[]) => unknown;
        return member.apply(bridge, args as unknown[]);
      },
      [name, args] as const,
    ) as Promise<ReturnType<Methods[K]>>;
  }

  /** The screen showing, by id, or null while the Arcade is changing screen. */
  screen = async () => (await this.call('screen')).id;
  /** The GameHost's state. */
  host = async () => (await this.call('screen')).host;
  round = () => this.call('round');
  snapshot = () => this.call('snapshot');
  counts = () => this.call('counts');
  audio = () => this.call('audio');
  layout = () => this.call('layout');

  /** The check screens the status page lists, in order. */
  checks = () => this.call('checks');

  /** From the Home Screen, opens the status page and taps a check screen's button there. */
  async openCheck(id: string): Promise<void> {
    await this.tap('grown-ups');
    await expect.poll(() => this.screen()).toBe('grown-ups');
    await this.page.locator(`#grown-ups [data-check="${id}"]`).tap();
    await expect.poll(() => this.screen()).toBe(id);
  }

  async target(name: string): Promise<Point & { rect: Rect }> {
    const snapshot = await this.snapshot();
    const target = snapshot.targets[name];
    if (!target) throw new Error(`No target "${name}" in ${JSON.stringify(snapshot)}`);
    return target;
  }

  /** A real tap at a named target's centre. */
  async tap(name: string): Promise<void> {
    const { x, y } = await this.target(name);
    await this.page.touchscreen.tap(x, y);
  }

  /** A real tap at the centre of a target the Round names. */
  async tapRound(name: string): Promise<void> {
    const round = await this.round();
    const target = round?.targets[name];
    if (!target) throw new Error(`No Round target "${name}" in ${JSON.stringify(round)}`);
    await this.page.touchscreen.tap(target.x, target.y);
  }

  /**
   * Waits for the Demo that begins a Session's first Round, and skips it with a tap at the top of
   * the pause control's strip down the safe rectangle's left edge. The Demo takes it; and if the
   * Demo has ended just before it lands, it falls on no Zone and no target, so the Round never
   * sees it.
   */
  async skipDemo(): Promise<void> {
    await expect.poll(async () => (await this.round())?.demo.plays ?? 0).toBeGreaterThan(0);
    const { safe, frame } = await this.layout();
    const unit = frame.width / DESIGN_WIDTH;
    if ((await this.round())!.demo.playing) {
      await this.page.touchscreen.tap(safe!.x + 172 * unit, safe!.y + 100 * unit);
    }
    await expect.poll(async () => (await this.round())!.demo.playing).toBe(false);
  }

  /** Converts a point in design units to the page, in CSS pixels. */
  async toPage(point: Point): Promise<Point> {
    const { frame } = await this.layout();
    const unit = frame.width / DESIGN_WIDTH;
    return { x: frame.x + point.x * unit, y: frame.y + point.y * unit };
  }

  /**
   * Tells the page its visibility changed to each of `states` in turn. The browser under test
   * stays visible, so the page's own answers are overridden while it is hidden.
   */
  private async become(states: readonly ('hidden' | 'visible')[]): Promise<void> {
    await this.page.evaluate((states) => {
      for (const state of states) {
        if (state === 'hidden') {
          Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'hidden',
          });
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        } else {
          // Back to the browser's own answers.
          delete (document as { visibilityState?: unknown }).visibilityState;
          delete (document as { hidden?: unknown }).hidden;
        }
        document.dispatchEvent(new Event('visibilitychange'));
      }
    }, states);
  }

  /** Hides the page, as the home gesture or the screen locking would. */
  hide = () => this.become(['hidden']);

  /** Shows the page again after `hide`, as a return to the app would. */
  show = () => this.become(['visible']);

  /** Hides the page and shows it again, `times` times over. */
  hideAndShow = (times = 1) =>
    this.become(Array.from({ length: times }, () => ['hidden', 'visible'] as const).flat());

  /** Taps "tap to start" and waits for the Home Screen. */
  async start(): Promise<void> {
    await this.tap('start');
    await expect.poll(() => this.screen()).toBe('home');
  }

  /** Raw touch events through the Chromium DevTools protocol: several fingers, holds and drags. */
  async touch(
    type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
    points: readonly Point[],
  ): Promise<void> {
    this.cdp ??= this.page.context().newCDPSession(this.page);
    await (
      await this.cdp
    ).send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((point, id) => ({ x: point.x, y: point.y, id })),
    });
  }

  /**
   * Puts a finger on a named target and lifts it at once. The two events are sent together, so
   * a slow frame in a software-rendered browser cannot turn the brush into a hold.
   */
  async brush(name: string): Promise<void> {
    const { x, y } = await this.target(name);
    await Promise.all([this.touch('touchStart', [{ x, y }]), this.touch('touchEnd', [])]);
  }

  /** Puts one finger on a named target, keeps it there for `ms`, then lifts it. */
  async hold(name: string, ms: number): Promise<void> {
    const { x, y } = await this.target(name);
    await this.touch('touchStart', [{ x, y }]);
    await this.page.waitForTimeout(ms);
    await this.touch('touchEnd', []);
  }
}

/**
 * Every test gets an Arcade, and every request its page makes is checked against the Arcade's
 * own origin and base path once the test is done.
 */
export const test = base.extend<{ arcade: Arcade }>({
  page: async ({ page, baseURL }, use) => {
    const outside: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith(baseURL ?? '\u0000')) outside.push(request.url());
    });
    await use(page);
    expect(outside, 'requests outside the Arcade’s origin and base path').toEqual([]);
  },
  arcade: async ({ page }, use) => {
    await use(new Arcade(page));
  },
});

export { expect };
