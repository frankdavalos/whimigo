import { onPageShown } from './lifecycle';

export interface UpdatesOptions {
  /** The service worker's script, beneath the base path. */
  readonly script: string;
  /** The base path, which is the service worker's scope. */
  readonly scope: string;
}

/** What the service worker has done so far. */
export interface UpdateState {
  /** Every file is cached: the Arcade plays with no network. */
  readonly offlineReady: boolean;
  /** A newer version has been downloaded and waits for the next cold start. */
  readonly updateWaiting: boolean;
}

/**
 * The precaching service worker (ADR-0008), registered in prompt mode: a new version installs in
 * the background and waits. It is applied at a cold start, before the first screen shows, and
 * never while the Arcade is in use.
 */
export interface Updates {
  /**
   * Applies a version that was left waiting, by activating it and reloading the page once; or else
   * registers the service worker. Resolves once the first screen may be shown, which is never while
   * the page is reloading.
   */
  start(): Promise<void>;
  state(): UpdateState;
}

/** Set in the tab's session just before reloading to apply a version, so it happens only once. */
const APPLYING = 'whimigo:applying-update';
/** How long a waiting version may take to activate before the Arcade starts without it. */
const ACTIVATION_MS = 5000;

/** The tab's session storage, which a browser may refuse; then the reload is not guarded. */
function sessionOf(win: Window): Storage | null {
  try {
    return win.sessionStorage;
  } catch {
    return null;
  }
}

/** Resolves true once `worker` is active, false if it is discarded or slow. */
function activation(win: Window, worker: ServiceWorker): Promise<boolean> {
  return new Promise((resolve) => {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') resolve(true);
      if (worker.state === 'redundant') resolve(false);
    });
    win.setTimeout(() => resolve(false), ACTIVATION_MS);
  });
}

export function createUpdates(win: Window, options: UpdatesOptions): Updates {
  const container = 'serviceWorker' in win.navigator ? win.navigator.serviceWorker : null;
  let offlineReady = false;
  let updateWaiting = false;

  /** Whether the page is reloading to run a version that was waiting. */
  async function applyWaitingVersion(workers: ServiceWorkerContainer): Promise<boolean> {
    const session = sessionOf(win);
    if (session && session.getItem(APPLYING) !== null) {
      // This load is the reload that applied a version. Anything waiting now waits for the next.
      session.removeItem(APPLYING);
      return false;
    }
    const waiting = (await workers.getRegistration(options.scope))?.waiting;
    if (!waiting) return false;
    session?.setItem(APPLYING, waiting.scriptURL);
    const activated = activation(win, waiting);
    waiting.postMessage({ type: 'SKIP_WAITING' });
    if (!(await activated)) {
      session?.removeItem(APPLYING);
      return false;
    }
    win.location.reload();
    return true;
  }

  return {
    async start() {
      if (!container) return;
      try {
        if (await applyWaitingVersion(container)) return new Promise<never>(() => {});
      } catch {
        // Whatever went wrong, the Arcade starts on the version it has.
      }
      let registration: ServiceWorkerRegistration;
      try {
        registration = await container.register(options.script, { scope: options.scope });
      } catch {
        // Without a service worker the Arcade still plays; it is just not ready offline.
        return;
      }
      // A long-lived installed app rarely reloads, so it looks for a new version on each return.
      onPageShown(win.document, () => {
        registration.update().catch(() => {
          // Offline, or the server is unreachable: the next return tries again.
        });
      });
      const refresh = () => {
        updateWaiting = registration.waiting !== null && registration.active !== null;
      };
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', refresh);
      });
      container.addEventListener('controllerchange', refresh);
      refresh();
      // Resolves once a worker is active, which it becomes only after caching every file.
      void container.ready.then(() => {
        offlineReady = true;
      });
    },
    state: () => ({ offlineReady, updateWaiting }),
  };
}
