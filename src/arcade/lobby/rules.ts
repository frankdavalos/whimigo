import type {
  Difficulty,
  GameManifest,
  MascotId,
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
 * The joined Mascots, in Seat order, after `mascot` is tapped: it takes the lowest free Seat.
 * A Mascot already joined, or a fifth, changes nothing.
 */
export function join(joined: readonly MascotId[], mascot: MascotId): readonly MascotId[] {
  if (joined.includes(mascot) || joined.length >= MAX_SEATS) return joined;
  return [...joined, mascot];
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
