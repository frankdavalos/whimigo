export interface UpdatesOptions {
  /** The service worker's script, beneath the base path. */
  readonly script: string;
  /** The base path, which is the service worker's scope. */
  readonly scope: string;
}

/**
 * The precaching service worker (ADR-0008), registered in prompt mode: a new version installs in
 * the background and waits.
 */
export interface Updates {
  /** Registers the service worker. Resolves once the first screen may be shown. */
  start(): Promise<void>;
}

export function createUpdates(win: Window, options: UpdatesOptions): Updates {
  const container = 'serviceWorker' in win.navigator ? win.navigator.serviceWorker : null;
  return {
    async start() {
      if (!container) return;
      try {
        await container.register(options.script, { scope: options.scope });
      } catch {
        // Without a service worker the Arcade still plays; it is just not ready offline.
      }
    },
  };
}
