/** The most the service worker may precache, in bytes: the whole Arcade (overview, Performance). */
export const PRECACHE_BUDGET_BYTES = 60_000_000;

/** The most one Game's own files may come to, in bytes: its chunk and its atlas. */
export const GAME_BUDGET_BYTES = 5_000_000;

/** A file the build emits, by its path inside the output folder with `/` separators. */
export interface BuiltFile {
  readonly path: string;
  readonly size: number;
}

/**
 * A Game's own files are named for it by the bundler: `assets/<id>-<eight-character hash>.<ext>`.
 * The fixed length of the hash keeps `color` from claiming the files of `color-echo`.
 */
export const isGameFile = (id: string, path: string) =>
  new RegExp(`^assets/${id}-[\\w-]{8}\\.\\w+$`).test(path);

/**
 * What is over budget in a build (story 32 AC3): each Game whose own files come to more than 5 MB,
 * and the precache when it comes to more than 60 MB. A Game with no files named for it is a fault
 * too, since its size could not be measured. Empty when the build is within both.
 */
export function budgetProblems(files: readonly BuiltFile[], gameIds: readonly string[]): string[] {
  const problems: string[] = [];
  for (const id of gameIds) {
    const own = files.filter((file) => isGameFile(id, file.path));
    const size = own.reduce((sum, file) => sum + file.size, 0);
    if (own.length === 0) problems.push(`${id}: the build has no files named for it`);
    else if (size > GAME_BUDGET_BYTES) {
      problems.push(
        `${id}: its files are ${size} bytes, over the ${GAME_BUDGET_BYTES} a Game may have`,
      );
    }
  }
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > PRECACHE_BUDGET_BYTES) {
    problems.push(`the precache is ${total} bytes, over the ${PRECACHE_BUDGET_BYTES} it may have`);
  }
  return problems;
}
