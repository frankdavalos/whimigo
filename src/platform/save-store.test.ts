import { describe, expect, it } from 'vitest';
import { SAVE_KEY, createSaveStore, type KeyValueStore, type SaveDocument } from './save-store';

/** A store held in memory, standing in for localStorage. */
function memoryStore(): KeyValueStore & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
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
