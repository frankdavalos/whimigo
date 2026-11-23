import { describe, expect, it } from 'vitest';
import {
  SAVE_KEY,
  browserStorage,
  createSaveStore,
  type KeyValueStore,
  type SaveDocument,
} from './save-store';

/** A store held in memory, standing in for localStorage. */
function memoryStore(): KeyValueStore & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

/** A store that throws on every write, as a full or locked-down storage does. */
function refusingStore(): KeyValueStore {
  return {
    getItem: () => null,
    setItem: () => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    },
    removeItem: () => undefined,
  };
}

const PLAYED: SaveDocument = {
  version: 1,
  mascots: { fox: { stars: 3 }, owl: { stars: 1 } },
  games: { 'tic-tac-toe': { roundsPlayed: 2 } },
};

describe('the SaveStore', () => {
  it('keeps one document under one key that begins whimigo:', () => {
    const storage = memoryStore();
    createSaveStore(storage).write(PLAYED);
    expect(SAVE_KEY.startsWith('whimigo:')).toBe(true);
    expect([...storage.items.keys()]).toEqual([SAVE_KEY]);
  });

  it('starts with no Stars and no Rounds played when nothing has been saved', () => {
    expect(createSaveStore(memoryStore()).current()).toEqual({
      version: 1,
      mascots: {},
      games: {},
    });
  });

  it('reads back a written document equal to it, in the same visit and the next', () => {
    const storage = memoryStore();
    const store = createSaveStore(storage);
    store.write(PLAYED);
    expect(store.current()).toEqual(PLAYED);
    expect(createSaveStore(storage).current()).toEqual(PLAYED);
  });
});

describe('the SaveStore without working storage', () => {
  const cases: [string, KeyValueStore | null][] = [
    ['missing', null],
    ['throwing on every write', refusingStore()],
    [
      'throwing on every read',
      {
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    ],
  ];

  for (const [name, storage] of cases) {
    it(`keeps the document in memory for the visit when storage is ${name}, and says so`, () => {
      const store = createSaveStore(storage);
      expect(store.memoryOnly()).toBe(true);
      expect(store.current()).toEqual({ version: 1, mascots: {}, games: {} });
      store.write(PLAYED);
      expect(store.current()).toEqual(PLAYED);
    });
  }

  it('is not memory-only when storage works', () => {
    const store = createSaveStore(memoryStore());
    expect(store.memoryOnly()).toBe(false);
    store.write(PLAYED);
    expect(store.memoryOnly()).toBe(false);
  });

  it('tries storage at the start without saving anything or changing what was saved', () => {
    const empty = memoryStore();
    createSaveStore(empty);
    expect([...empty.items.keys()]).toEqual([]);

    const played = memoryStore();
    createSaveStore(played).write(PLAYED);
    const saved = played.items.get(SAVE_KEY);
    createSaveStore(played);
    expect(played.items.get(SAVE_KEY)).toBe(saved);
  });
});

describe('the browser’s storage', () => {
  it('is missing when the window has none, or refuses access to it', () => {
    expect(browserStorage({} as Window)).toBeNull();
    const refusing = {
      get localStorage(): Storage {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    } as Window;
    expect(browserStorage(refusing)).toBeNull();
  });
});
