import type { Difficulty, GameId, MascotId, PlayStyle, Seating } from '@/contract';

/** The one key the save document is kept under. The prefix keeps it apart from sibling sites (ADR-0013). */
export const SAVE_KEY = 'whimigo:save';

/** What a Game's lobby remembers from the last Session that started there. */
export interface RememberedChoices {
  readonly style: PlayStyle;
  readonly difficulty: Difficulty;
  /** In Seat order. */
  readonly mascots: readonly MascotId[];
}

/** What the Arcade keeps of one Game. */
export interface SavedGame {
  readonly roundsPlayed: number;
  readonly choices?: RememberedChoices;
}

/**
 * Everything the Arcade keeps between visits (ADR-0007): each Mascot's Progress, each Game's
 * count of Rounds played and remembered choices, and the one Seating chosen for every Game.
 * Settings join it in a later slice. Fields added since version 1 are optional, so a document
 * written before them still reads.
 */
export interface SaveDocument {
  readonly version: 1;
  readonly mascots: Readonly<Record<MascotId, { readonly stars: number }>>;
  readonly games: Readonly<Record<GameId, SavedGame>>;
  /** The Seating last chosen in any lobby; absent until one is chosen. */
  readonly seating?: Seating;
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
