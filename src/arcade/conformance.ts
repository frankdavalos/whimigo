import type { GameId, GameManifest, GameModule } from '@/contract';
import { MAX_SEATS } from './lobby/rules';

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const AUDIO_FILE = /\.(mp3|ogg|oga|wav|m4a|aac|flac|opus|webm)(\?|#|$)/i;

/**
 * The checks every manifest in the Catalog must pass (testing strategy, Level 2). Returns what is
 * wrong, one line per fault; an empty list means the Catalog conforms. `cardFrames` is every frame
 * of the Arcade's atlas.
 */
export function checkCatalog(
  catalog: readonly GameManifest[],
  cardFrames: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];
  const seen = new Set<GameId>();
  for (const game of catalog) {
    const { id } = game;
    if (seen.has(id)) problems.push(`${id}: the id is already used`);
    seen.add(id);
    if (!KEBAB.test(id)) problems.push(`${id}: the id is not in kebab case`);
    for (const { style, players, computerPlayers } of game.playStyles) {
      const badRange = players.min < 1 || players.max > MAX_SEATS || players.min > players.max;
      if (badRange) {
        problems.push(`${id}: ${style} accepts ${players.min} to ${players.max} Players`);
      }
      if (computerPlayers !== 0 && style !== 'versus-computer') {
        problems.push(`${id}: ${style} has Computer Players`);
      }
      if (!badRange && players.max + computerPlayers > MAX_SEATS) {
        problems.push(`${id}: ${style} can need ${players.max + computerPlayers} Seats`);
      }
    }
    if (!cardFrames.has(game.card.frame)) {
      problems.push(`${id}: the Game Card frame ${game.card.frame} is not in the Arcade’s atlas`);
    }
  }
  return problems;
}

/** The checks a Game's module must pass. Returns what is wrong; empty means it conforms. */
export function checkModule(id: GameId, module: Pick<GameModule, 'pack' | 'sounds'>): string[] {
  const problems: string[] = [];
  const files = module.pack.files;
  const atlases = files.filter((file) => file.type === 'atlas');
  if (atlases.length !== 1 || atlases[0]!.key !== id) {
    problems.push(`${id}: the pack must have exactly one atlas, keyed ${id}`);
  }
  for (const file of files) {
    if (file.type !== 'atlas' && !file.key.startsWith(`${id}/`)) {
      problems.push(`${id}: the pack key ${file.key} does not begin with ${id}/`);
    }
    const urls = Object.values(file).filter((value) => typeof value === 'string');
    if (file.type.startsWith('audio') || urls.some((url) => AUDIO_FILE.test(url))) {
      problems.push(`${id}: the pack lists an audio file, ${file.key}`);
    }
  }
  for (const key of Object.keys(module.sounds)) {
    if (!key.startsWith(`${id}/`))
      problems.push(`${id}: the sound key ${key} does not begin with ${id}/`);
  }
  return problems;
}
