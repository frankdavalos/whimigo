import type { GameId, MascotId } from '@/contract';

/** The one key the save document is kept under. The prefix keeps it apart from sibling sites (ADR-0013). */
export const SAVE_KEY = 'whimigo:save';

/**
 * Everything the Arcade keeps between visits (ADR-0007): each Mascot's Progress and each Game's
 * count of Rounds played. Settings and remembered choices join it in later slices.
 */
export interface SaveDocument {
  readonly version: 1;
  readonly mascots: Readonly<Record<MascotId, { readonly stars: number }>>;
  readonly games: Readonly<Record<GameId, { readonly roundsPlayed: number }>>;
}

/** What the SaveStore needs of `localStorage`. Either call may throw. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

/** The save document, read once and written synchronously after each change. */
export interface SaveStore {
  current(): SaveDocument;
  write(document: SaveDocument): void;
}

const FRESH: SaveDocument = { version: 1, mascots: {}, games: {} };

/** Reads the save document from `storage`, or starts a fresh one when nothing is saved. */
export function createSaveStore(storage: KeyValueStore): SaveStore {
  const saved = storage.getItem(SAVE_KEY);
  let document: SaveDocument = saved === null ? FRESH : (JSON.parse(saved) as SaveDocument);
  return {
    current: () => document,
    write(next) {
      document = next;
      storage.setItem(SAVE_KEY, JSON.stringify(next));
    },
  };
}
