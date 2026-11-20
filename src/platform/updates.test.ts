import { describe, expect, it } from 'vitest';
import { createUpdates } from './updates';

/**
 * The cold-start rule's guard against reloading in a loop. The whole path, with a real service
 * worker and a real deployment, is tested in the browser (tests/e2e/updates.spec.ts); a version
 * that is waiting again straight after the reload cannot be staged there.
 */

/** Just enough of a service worker: its state, and the message that activates it. */
function fakeWorker() {
  const worker = Object.assign(new EventTarget(), {
    state: 'installed' as ServiceWorkerState,
    scriptURL: '/whimigo/sw.js',
    messages: [] as unknown[],
    postMessage(message: unknown) {
      worker.messages.push(message);
      if ((message as { type?: string }).type !== 'SKIP_WAITING') return;
      queueMicrotask(() => {
        worker.state = 'activated';
        worker.dispatchEvent(new Event('statechange'));
      });
    },
  });
  return worker;
}

/** A page whose service worker registration has a version waiting, and a tab session. */
function fakePage(session: Map<string, string>) {
  const waiting = fakeWorker();
  const registration = Object.assign(new EventTarget(), {
    waiting: waiting as unknown as ServiceWorker | null,
    active: fakeWorker() as unknown as ServiceWorker | null,
    installing: null,
    update: () => Promise.resolve(),
  });
  const container = Object.assign(new EventTarget(), {
    getRegistration: () => Promise.resolve(registration),
    register: () => Promise.resolve(registration),
    ready: Promise.resolve(registration),
  });
  let reloads = 0;
  const win = {
    navigator: { serviceWorker: container },
    document: new EventTarget(),
    sessionStorage: {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => void session.set(key, value),
      removeItem: (key: string) => void session.delete(key),
    },
    location: { reload: () => (reloads += 1) },
    setTimeout: () => 0,
  } as unknown as Window;
  return { win, waiting, reloads: () => reloads };
}

const OPTIONS = { script: '/whimigo/sw.js', scope: '/whimigo/' };
/** Whether `start` resolves, letting the first screen show, within a few turns of the event loop. */
const settles = (promise: Promise<void>) =>
  Promise.race([promise.then(() => true), new Promise((r) => setTimeout(() => r(false), 20))]);

describe('a version left waiting, at a cold start', () => {
  it('is activated, and the page reloads before the first screen shows', async () => {
    const page = fakePage(new Map());
    const started = settles(createUpdates(page.win, OPTIONS).start());
    expect(await started).toBe(false);
    expect(page.waiting.messages).toEqual([{ type: 'SKIP_WAITING' }]);
    expect(page.reloads()).toBe(1);
  });

  it('is not applied again by the load that reload starts, so the page cannot reload in a loop', async () => {
    const session = new Map<string, string>();
    const first = fakePage(session);
    void createUpdates(first.win, OPTIONS).start();
    await expect.poll(first.reloads).toBe(1);

    // The reloaded page finds a version waiting again, however that came about.
    const second = fakePage(session);
    const updates = createUpdates(second.win, OPTIONS);
    expect(await settles(updates.start())).toBe(true);
    expect(second.reloads()).toBe(0);
    expect(second.waiting.messages).toEqual([]);
    expect(updates.state().updateWaiting).toBe(true);

    // The cold start after that applies it as usual.
    const third = fakePage(session);
    void createUpdates(third.win, OPTIONS).start();
    await expect.poll(third.reloads).toBe(1);
  });
});
