import type {
  Difficulty,
  GameManifest,
  MascotId,
  PlayStyle,
  PlayStyleOption,
  SeatIndex,
  Seating,
  Session,
} from '@/contract';
import { seats as SEAT_LOOKS } from '@/kit/theme';

/** A Session never has more Seats than this. */
export const MAX_SEATS = 4;

/** The Play Styles of a Game that accept this many Players, in the manifest's order. */
export function fittingStyles(game: GameManifest, players: number): PlayStyleOption[] {
  return game.playStyles.filter(({ players: { min, max } }) => min <= players && players <= max);
}

/**
 * The joined Mascots, in Seat order, after `mascot` is tapped. A Mascot that has not joined takes
 * the lowest free Seat; a joined one frees its Seat, and those after it close up. A fifth is
 * refused, changing nothing.
 */
export function tapMascot(
  joined: readonly MascotId[],
  mascot: MascotId,
): { readonly joined: readonly MascotId[]; readonly refused: boolean } {
  if (joined.includes(mascot)) {
    return { joined: joined.filter((other) => other !== mascot), refused: false };
  }
  if (joined.length >= MAX_SEATS) return { joined, refused: true };
  return { joined: [...joined, mascot], refused: false };
}

/** What the Players in a lobby have chosen, or had remembered for them. */
export interface LobbyChoices {
  /** In Seat order. */
  readonly joined: readonly MascotId[];
  /** The Play Style wanted, if it fits the Players joined. */
  readonly style: PlayStyle | null;
  readonly difficulty: Difficulty;
  /** The Seating chosen, or null if none has ever been chosen. */
  readonly seating: Seating | null;
}

/** A lobby where nothing has been chosen. */
export const NO_CHOICES: LobbyChoices = {
  joined: [],
  style: null,
  difficulty: 'easy',
  seating: null,
};

/** What a lobby shows and offers for the choices made so far. */
export interface LobbyView {
  /** The Play Styles that fit the Players joined; a choice only when there are several. */
  readonly styles: readonly PlayStyleOption[];
  /** The Play Style selected, or null when none fits. */
  readonly style: PlayStyleOption | null;
  /** The Difficulties offered: all three when the selected Play Style uses Difficulty, or none. */
  readonly difficulties: readonly Difficulty[];
  /** The Seatings offered: both with two or more Players, or none. */
  readonly seatings: readonly Seating[];
  /** The Seating selected among those offered, or null when none is offered. */
  readonly seating: Seating | null;
  /** The Session that start begins, or null when start is unavailable. */
  readonly session: Session | null;
}

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];
export const SEATINGS: readonly Seating[] = ['side-by-side', 'around-the-table'];

/**
 * The Seating for this many Players: side by side for one; for more, the one chosen, or until
 * one has ever been chosen, side by side for two and around the table for three or four.
 */
function seatingFor(players: number, chosen: Seating | null): Seating {
  if (players < 2) return 'side-by-side';
  return chosen ?? (players === 2 ? 'side-by-side' : 'around-the-table');
}

/** The lobby's rules: from what has been chosen to what it offers and what start begins. */
export function lobbyView(game: GameManifest, choices: LobbyChoices): LobbyView {
  const { joined } = choices;
  const styles = fittingStyles(game, joined.length);
  const style = styles.find(({ style }) => style === choices.style) ?? styles[0] ?? null;
  const seating = seatingFor(joined.length, choices.seating);
  const session = style
    ? buildSession({
        game,
        style,
        joined,
        difficulty: style.usesDifficulty ? choices.difficulty : 'easy',
        seating,
      })
    : null;
  return {
    styles,
    style,
    difficulties: style?.usesDifficulty ? DIFFICULTIES : [],
    seatings: joined.length >= 2 ? SEATINGS : [],
    seating: joined.length >= 2 ? seating : null,
    session,
  };
}

export interface SessionChoices {
  readonly game: GameManifest;
  readonly style: PlayStyleOption;
  /** In the order they joined. */
  readonly joined: readonly MascotId[];
  readonly difficulty: Difficulty;
  readonly seating: Seating;
}

/** The Session that start begins: the joined Mascots in order, then the Computer Players. */
export function buildSession({
  game,
  style,
  joined,
  difficulty,
  seating,
}: SessionChoices): Session {
  const occupants = [
    ...joined.map((mascot) => ({ kind: 'player', mascot }) as const),
    ...Array.from({ length: style.computerPlayers }, () => ({ kind: 'computer' }) as const),
  ];
  if (occupants.length > MAX_SEATS) {
    throw new Error(`A Session has at most ${MAX_SEATS} Seats, not ${occupants.length}`);
  }
  return {
    gameId: game.id,
    playStyle: style.style,
    difficulty,
    seating,
    seats: occupants.map((occupant, index) => ({
      index: index as SeatIndex,
      occupant,
      ...SEAT_LOOKS[index]!,
    })),
  };
}
