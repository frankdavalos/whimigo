import { describe, expect, it } from 'vitest';
import { STORAGE_STATES, watchStorage } from './storage-state';

/** Stands in for `navigator.storage`, counting requests; `granted` is the browser's answer. */
function fakeManager(granted: boolean | 'throws') {
  const manager = {
    requests: 0,
    persist() {
      manager.requests += 1;
      return granted === 'throws' ? Promise.reject(new Error('denied')) : Promise.resolve(granted);
    },
  };
  return manager;
}

const kept = { memoryOnly: () => false };
const inMemory = { memoryOnly: () => true };

describe('the storage state', () => {
  it('is one of persistent, best-effort and memory-only', () => {
    expect(STORAGE_STATES).toEqual(['persistent', 'best-effort', 'memory-only']);
  });

  it('asks the browser for persistent storage once, and is persistent when it agrees', async () => {
    const manager = fakeManager(true);
    const storage = watchStorage(kept, manager);
    expect(storage.state()).toBe('best-effort');
    await storage.asked;
    expect(storage.state()).toBe('persistent');
    storage.state();
    expect(manager.requests).toBe(1);
  });

  it('is best-effort when the browser refuses, fails or cannot be asked', async () => {
    const lacking = {} as Pick<StorageManager, 'persist'>;
    for (const manager of [fakeManager(false), fakeManager('throws'), undefined, lacking]) {
      const storage = watchStorage(kept, manager);
      await storage.asked;
      expect(storage.state()).toBe('best-effort');
    }
  });

  it('is memory-only whenever the save document is held in memory, whatever the browser says', async () => {
    const storage = watchStorage(inMemory, fakeManager(true));
    await storage.asked;
    expect(storage.state()).toBe('memory-only');
  });
});
