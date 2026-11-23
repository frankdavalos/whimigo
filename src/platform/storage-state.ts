import type { SaveStore } from './save-store';

/** The storage states, from safest to least safe. */
export const STORAGE_STATES = ['persistent', 'best-effort', 'memory-only'] as const;

/**
 * How safely Progress is kept (overview, Storage): `persistent` when the browser has promised not to
 * clear it to free space, `best-effort` when it may, and `memory-only` when it is not kept at all.
 */
export type StorageState = (typeof STORAGE_STATES)[number];

export interface StorageWatch {
  state(): StorageState;
  /** Settles once the browser has answered the request for persistent storage. */
  readonly asked: Promise<void>;
}

/**
 * Asks the browser once, now, for persistent storage, and reports the storage state from then on.
 * `manager` is `navigator.storage`, which some browsers lack.
 */
export function watchStorage(
  save: Pick<SaveStore, 'memoryOnly'>,
  manager: Pick<StorageManager, 'persist'> | undefined,
): StorageWatch {
  let persistent = false;
  const ask = async () => {
    // Older browsers have no such request: their storage is best-effort.
    if (typeof manager?.persist === 'function') persistent = await manager.persist();
  };
  const asked = ask().catch(() => undefined);
  return {
    state: () => (save.memoryOnly() ? 'memory-only' : persistent ? 'persistent' : 'best-effort'),
    asked,
  };
}
