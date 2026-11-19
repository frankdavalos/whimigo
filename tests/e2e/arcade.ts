import { test as base, expect, type CDPSession, type Page } from '@playwright/test';
import type { Rect } from '../../src/contract';
import type { TestBridge } from '../../src/arcade/test-bridge';

type Methods = {
  [
    K in keyof TestBridge as TestBridge[K] extends (...args: never[]) => unknown ? K : never
  ]: Extract<TestBridge[K], (...args: never[]) => unknown>;
};

export type Point = { readonly x: number; readonly y: number };

/** Screen shapes tested beyond each project's own viewport. */
export const OTHER_VIEWPORTS = {
  '16:9': { width: 1600, height: 900 },
  'a narrow window': { width: 900, height: 1000 },
} as const;

/** Drives the running Arcade the way a test should: through the bridge and real touches. */
export class Arcade {
  private cdp: Promise<CDPSession> | null = null;

  constructor(readonly page: Page) {}

  /** Opens the Arcade with the test bridge on, and waits for the tap-to-start screen. */
  async open(): Promise<void> {
    await this.page.goto('./?e2e=1');
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

  screen = () => this.call('screen');
  snapshot = () => this.call('snapshot');
  counts = () => this.call('counts');
  audio = () => this.call('audio');
  layout = () => this.call('layout');

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
