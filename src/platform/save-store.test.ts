import { describe, expect, it } from 'vitest';
import {
  SAVE_KEY,
  SET_ASIDE_KEY,
  browserStorage,
  createSaveStore,
  type KeyValueStore,
  type Migrations,
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

describe('a saved document the SaveStore cannot use', () => {
  const cases: [string, string][] = [
    ['cannot be read', '{"version": 1, "mascots": {'],
    ['is not an object', '"fox"'],
    ['has no version', JSON.stringify({ mascots: {}, games: {} })],
    [
      'has Stars that are not a count',
      JSON.stringify({ ...PLAYED, mascots: { fox: { stars: -1 } } }),
    ],
    ['has a Game without its Rounds played', JSON.stringify({ ...PLAYED, games: { x: {} } })],
    [
      'has remembered choices of an unknown Play Style',
      JSON.stringify({
        ...PLAYED,
        games: {
          x: { roundsPlayed: 1, choices: { style: 'tag', difficulty: 'easy', mascots: [] } },
        },
      }),
    ],
    ['has a Seating that does not exist', JSON.stringify({ ...PLAYED, seating: 'stacked' })],
    ['has a sound setting that is not on or off', JSON.stringify({ ...PLAYED, sound: 'loud' })],
    ['has an unknown motion setting', JSON.stringify({ ...PLAYED, motion: 'fast' })],
    ['carries a newer version than is understood', JSON.stringify({ ...PLAYED, version: 2 })],
  ];

  for (const [name, saved] of cases) {
    it(`is set aside under a second key when it ${name}, and play starts fresh`, () => {
      const storage = memoryStore();
      storage.setItem(SAVE_KEY, saved);
      const store = createSaveStore(storage);
      expect(store.current()).toEqual({ version: 1, mascots: {}, games: {} });
      expect(store.memoryOnly()).toBe(false);
      expect(SET_ASIDE_KEY.startsWith('whimigo:')).toBe(true);
      expect(SET_ASIDE_KEY).not.toBe(SAVE_KEY);
      expect(storage.items.get(SET_ASIDE_KEY)).toBe(saved);
      expect(storage.items.has(SAVE_KEY)).toBe(false);

      store.write(PLAYED);
      expect(createSaveStore(storage).current()).toEqual(PLAYED);
      expect(storage.items.get(SET_ASIDE_KEY)).toBe(saved);
    });
  }

  it('reads a document with every setting and remembered choices as it was written', () => {
    const full: SaveDocument = {
      ...PLAYED,
      games: {
        'color-echo': {
          roundsPlayed: 4,
          choices: { style: 'cooperative', difficulty: 'hard', mascots: ['fox', 'owl'] },
        },
      },
      seating: 'around-the-table',
      sound: false,
      motion: 'on',
    };
    const storage = memoryStore();
    storage.setItem(SAVE_KEY, JSON.stringify(full));
    expect(createSaveStore(storage).current()).toEqual(full);
    expect(storage.items.has(SET_ASIDE_KEY)).toBe(false);
  });
});

describe('a saved document of an older version', () => {
  /** A step from a made-up version 0, which kept each Mascot's Stars as a bare number. */
  const migrations: Migrations = {
    0: (old) => ({
      version: 1,
      mascots: Object.fromEntries(
        Object.entries(old['stars'] as Record<string, number>).map(([id, stars]) => [
          id,
          { stars },
        ]),
      ),
      games: {},
    }),
  };
  const versionZero = JSON.stringify({ version: 0, stars: { fox: 3, owl: 1 } });

  it('is migrated to the current version on load, and kept as migrated', () => {
    const storage = memoryStore();
    storage.setItem(SAVE_KEY, versionZero);
    const store = createSaveStore(storage, migrations);
    const migrated = { version: 1, mascots: { fox: { stars: 3 }, owl: { stars: 1 } }, games: {} };
    expect(store.current()).toEqual(migrated);
    expect(JSON.parse(storage.items.get(SAVE_KEY)!)).toEqual(migrated);
    expect(storage.items.has(SET_ASIDE_KEY)).toBe(false);
  });

  it('is set aside when no step migrates it, or the migrated document fails validation', () => {
    for (const steps of [{}, { 0: () => ({ version: 1, mascots: 'none', games: {} }) }]) {
      const storage = memoryStore();
      storage.setItem(SAVE_KEY, versionZero);
      expect(createSaveStore(storage, steps).current()).toEqual({
        version: 1,
        mascots: {},
        games: {},
      });
      expect(storage.items.get(SET_ASIDE_KEY)).toBe(versionZero);
    }
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
