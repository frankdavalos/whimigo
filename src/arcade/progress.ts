import type { GameId, MascotId, Result, Seat, Session } from '@/contract';
import type { SaveDocument } from '@/platform/save-store';

/** Stars by Mascot. */
export type Stars = Readonly<Record<MascotId, number>>;

/** One Star for finishing, and one more for winning or succeeding together. */
function starsFor(result: Result, seat: Seat): number {
  switch (result.kind) {
    case 'win':
      return result.winners.includes(seat.index) ? 2 : 1;
    case 'cooperative':
      return result.success ? 2 : 1;
    case 'draw':
    case 'solo':
      return 1;
  }
}

/**
 * The Star rule (overview, decision 4): the Stars each Player's Mascot earns from a Round. Computer
 * Players earn nothing, and a Round left without a Result earns nothing. Games never know Stars
 * exist.
 */
export function starsEarned(result: Result | null, session: Session): Stars {
  if (!result) return {};
  return Object.fromEntries(
    session.seats.flatMap((seat) =>
      seat.occupant.kind === 'player' ? [[seat.occupant.mascot, starsFor(result, seat)]] : [],
    ),
  );
}

/** The save document after a Round of `game` that earned `stars`: totals add across every Game. */
export function recordRound(document: SaveDocument, game: GameId, stars: Stars): SaveDocument {
  const mascots = { ...document.mascots };
  for (const [mascot, earned] of Object.entries(stars)) {
    mascots[mascot] = { stars: (mascots[mascot]?.stars ?? 0) + earned };
  }
  const roundsPlayed = (document.games[game]?.roundsPlayed ?? 0) + 1;
  return { ...document, mascots, games: { ...document.games, [game]: { roundsPlayed } } };
}
