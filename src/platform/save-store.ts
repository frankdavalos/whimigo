import type { Difficulty, GameId, MascotId, PlayStyle, Seating } from '@/contract';

/** The one key the save document is kept under. The prefix keeps it apart from sibling sites (ADR-0013). */
export const SAVE_KEY = 'whimigo:save';

/** Reduced motion as the grown-ups set it: as the device asks, always, or never. */
export type MotionSetting = 'system' | 'on' | 'off';

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
 * count of Rounds played and remembered choices, and the settings: the one Seating chosen for
 * every Game, sound and motion. Fields added since version 1 are optional, so a document written
 * before them still reads.
 */
export interface SaveDocument {
  readonly version: 1;
  readonly mascots: Readonly<Record<MascotId, { readonly stars: number }>>;
  readonly games: Readonly<Record<GameId, SavedGame>>;
  /** The Seating last chosen in any lobby; absent until one is chosen. */
  readonly seating?: Seating;
  /** Whether sound is switched on; absent until the grown-ups change it. */
  readonly sound?: boolean;
  /** Absent until the grown-ups change it. */
  readonly motion?: MotionSetting;
}

/** What the SaveStore needs of `localStorage`. Any call may throw. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The save document, read once and written synchronously after each change. */
export interface SaveStore {
  current(): SaveDocument;
  /** Never throws: without working storage the document is kept in memory for the visit. */
  write(document: SaveDocument): void;
  /** True when storage is missing or refuses: nothing will be kept after this visit. */
  memoryOnly(): boolean;
}

/** The window's `localStorage`, or null when it has none or refuses access to it. */
export function browserStorage(win: Window): KeyValueStore | null {
  try {
    return (win.localStorage as Storage | undefined) ?? null;
  } catch {
    return null;
  }
}

const FRESH: SaveDocument = { version: 1, mascots: {}, games: {} };

/**
 * Reads the save document from `storage`, or starts a fresh one when nothing is saved. When storage
 * is null, or throws on reading or on the write made at once to try it, the Arcade plays on with
 * the document in memory (ADR-0007). Trying storage leaves it as it was: what was read is written
 * back, and nothing is left when nothing was saved.
 */
export function createSaveStore(storage: KeyValueStore | null): SaveStore {
  let document: SaveDocument = FRESH;
  let kept: KeyValueStore | null = storage;
  const keep = (next: SaveDocument) => {
    try {
      kept?.setItem(SAVE_KEY, JSON.stringify(next));
    } catch {
      kept = null;
    }
  };
  let saved: string | null = null;
  try {
    saved = storage?.getItem(SAVE_KEY) ?? null;
  } catch {
    kept = null;
  }
  if (saved !== null) document = JSON.parse(saved) as SaveDocument;
  try {
    kept?.setItem(SAVE_KEY, saved ?? '');
    if (saved === null) kept?.removeItem(SAVE_KEY);
  } catch {
    kept = null;
  }
  return {
    current: () => document,
    write(next) {
      document = next;
      keep(next);
    },
    memoryOnly: () => kept === null,
  };
}
