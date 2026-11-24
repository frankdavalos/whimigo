import type { Difficulty, GameId, MascotId, PlayStyle, Seating } from '@/contract';

/** The one key the save document is kept under. The prefix keeps it apart from sibling sites (ADR-0013). */
export const SAVE_KEY = 'whimigo:save';

/**
 * Where a saved document the Arcade cannot use is set aside: one that cannot be read, fails
 * validation or is newer than this build understands. Only the last one is kept.
 */
export const SET_ASIDE_KEY = 'whimigo:save:set-aside';

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

/** Each value a field may take, as a set the compiler checks is complete. */
const oneOf = <T extends string>(values: Record<T, true>) => new Set<unknown>(Object.keys(values));
const PLAY_STYLES = oneOf<PlayStyle>({
  solo: true,
  'versus-computer': true,
  'turn-based': true,
  simultaneous: true,
  cooperative: true,
});
const DIFFICULTIES = oneOf<Difficulty>({ easy: true, medium: true, hard: true });
const SEATINGS = oneOf<Seating>({ 'side-by-side': true, 'around-the-table': true });
const MOTION_SETTINGS = oneOf<MotionSetting>({ system: true, on: true, off: true });

type Fields = Readonly<Record<string, unknown>>;
const isObject = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const everyValue = (value: unknown, valid: (entry: unknown) => boolean) =>
  isObject(value) && Object.values(value).every(valid);
const optional = (value: unknown, valid: (value: unknown) => boolean) =>
  value === undefined || valid(value);

const isChoices = (value: unknown) =>
  isObject(value) &&
  PLAY_STYLES.has(value['style']) &&
  DIFFICULTIES.has(value['difficulty']) &&
  Array.isArray(value['mascots']) &&
  value['mascots'].every((mascot) => typeof mascot === 'string');

/** Whether a parsed value is a save document of the current version that the Arcade can use. */
function isSaveDocument(value: unknown): value is SaveDocument {
  return (
    isObject(value) &&
    value['version'] === 1 &&
    everyValue(value['mascots'], (mascot) => isObject(mascot) && isCount(mascot['stars'])) &&
    everyValue(
      value['games'],
      (game) =>
        isObject(game) && isCount(game['roundsPlayed']) && optional(game['choices'], isChoices),
    ) &&
    optional(value['seating'], (seating) => SEATINGS.has(seating)) &&
    optional(value['sound'], (sound) => typeof sound === 'boolean') &&
    optional(value['motion'], (motion) => MOTION_SETTINGS.has(motion))
  );
}

/** A step that turns a parsed document of one version into one of a later version. */
export type Migration = (document: Fields) => unknown;

/** The migration steps, each keyed by the version it migrates from. */
export type Migrations = Readonly<Record<number, Migration>>;

/** Every step from an older version towards the current one: none yet, since 1 is the first. */
export const MIGRATIONS: Migrations = {};

const CURRENT_VERSION: SaveDocument['version'] = 1;

/**
 * The saved text as a document of the current version, migrated step by step from an older one,
 * or null when it cannot be read, no step migrates it, a step throws or does not raise the
 * version, or the result fails validation.
 */
function readDocument(saved: string, migrations: Migrations): SaveDocument | null {
  try {
    let document: unknown = JSON.parse(saved);
    while (isObject(document) && (document['version'] as number) < CURRENT_VERSION) {
      const version = document['version'] as number;
      const step = migrations[version];
      if (!step) return null;
      document = step(document);
      if (!isObject(document) || !((document['version'] as number) > version)) return null;
    }
    return isSaveDocument(document) ? document : null;
  } catch {
    return null;
  }
}

/**
 * Reads the save document from `storage`, migrated to the current version and validated, or starts
 * a fresh one when nothing is saved. A saved document it cannot use is moved to SET_ASIDE_KEY and
 * play starts fresh (ADR-0007). When storage is null, or throws on reading or on the write made at
 * once to try it, the Arcade plays on with the document in memory. Trying storage changes nothing
 * else: the document read is written back, migrated if a step ran, and nothing is left when
 * nothing was saved.
 */
export function createSaveStore(
  storage: KeyValueStore | null,
  migrations: Migrations = MIGRATIONS,
): SaveStore {
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
  const read = saved === null ? null : readDocument(saved, migrations);
  let document = read ?? FRESH;
  if (read) keep(read);
  else {
    try {
      if (saved !== null) kept?.setItem(SET_ASIDE_KEY, saved);
      else kept?.setItem(SAVE_KEY, '');
      kept?.removeItem(SAVE_KEY);
    } catch {
      kept = null;
    }
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
