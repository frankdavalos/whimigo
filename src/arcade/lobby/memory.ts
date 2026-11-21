import type { GameManifest, Seating, Session } from '@/contract';
import type { SaveDocument } from '@/platform/save-store';
import { NO_CHOICES, lobbyView, type LobbyChoices } from './rules';

/**
 * The choices a Game's lobby opens with: the Mascots and Play Style of the last Session that started
 * there, the Difficulty last chosen there (kept even through a Session whose Play Style ignores it),
 * and the Seating last chosen in any lobby.
 */
export function openLobby(document: SaveDocument, game: GameManifest): LobbyChoices {
  const remembered = document.games[game.id]?.choices;
  return {
    joined: remembered?.mascots ?? NO_CHOICES.joined,
    style: remembered?.style ?? NO_CHOICES.style,
    difficulty: remembered?.difficulty ?? NO_CHOICES.difficulty,
    seating: document.seating ?? NO_CHOICES.seating,
  };
}

/**
 * Start pressed: the Session it begins, and the save document remembering the choices that began
 * it. Null, changing nothing, when start is unavailable.
 */
export function startSession(
  document: SaveDocument,
  game: GameManifest,
  choices: LobbyChoices,
): { readonly session: Session; readonly document: SaveDocument } | null {
  const { session } = lobbyView(game, choices);
  if (!session) return null;
  const saved = document.games[game.id];
  const choicesSaved = {
    style: session.playStyle,
    difficulty: choices.difficulty,
    mascots: choices.joined,
  };
  return {
    session,
    document: {
      ...document,
      games: {
        ...document.games,
        [game.id]: { ...saved, roundsPlayed: saved?.roundsPlayed ?? 0, choices: choicesSaved },
      },
    },
  };
}

/** A Seating was chosen: every Game's lobby selects it from now on. */
export function rememberSeating(document: SaveDocument, seating: Seating): SaveDocument {
  return { ...document, seating };
}
