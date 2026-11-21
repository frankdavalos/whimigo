import { describe, expect, it } from 'vitest';
import type { GameManifest, PlayStyleOption } from '@/contract';
import { CATALOG } from '@/games/catalog';
import { MASCOTS } from '../mascots';
import { buildSession, fittingStyles, join } from './rules';

const style = (
  name: PlayStyleOption['style'],
  min: number,
  max: number,
  computerPlayers = 0,
): PlayStyleOption => ({ style: name, players: { min, max }, computerPlayers, zoned: false });

/** A made-up Game with overlapping Play Styles, beside the real Catalog. */
const FIXTURE: GameManifest = {
  id: 'fixture',
  title: 'Fixture',
  minAge: 4,
  usesDifficulty: true,
  playStyles: [
    style('versus-computer', 1, 1, 1),
    style('solo', 1, 1),
    style('turn-based', 2, 4),
    style('cooperative', 2, 4),
  ],
  card: { frame: 'arcade/card', color: 0 },
  load: () => Promise.reject(new Error('not loadable')),
};

describe('the lobby’s Play Styles', () => {
  for (const game of [...CATALOG, FIXTURE]) {
    for (const players of [0, 1, 2, 3, 4]) {
      it(`for ${game.id} with ${players} Players are those whose range includes ${players}`, () => {
        const expected = game.playStyles.filter(
          ({ players: range }) => range.min <= players && players <= range.max,
        );
        expect(fittingStyles(game, players)).toEqual(expected);
      });
    }
  }
});

describe('joining', () => {
  it('gives a Mascot the lowest free Seat', () => {
    expect(join([], 'fox')).toEqual(['fox']);
    expect(join(['fox'], 'owl')).toEqual(['fox', 'owl']);
  });

  it('lets a Mascot hold at most one Seat, and refuses a fifth Mascot', () => {
    expect(join(['fox', 'owl'], 'fox')).toEqual(['fox', 'owl']);
    const four = ['fox', 'owl', 'bear', 'frog'];
    expect(join(four, 'cat')).toEqual(four);
  });
});

describe('the Session built when start is pressed', () => {
  it('seats the joined Mascots in the order they joined, then the Computer Players', () => {
    const session = buildSession({
      game: FIXTURE,
      style: FIXTURE.playStyles[0]!,
      joined: ['owl'],
      difficulty: 'hard',
      seating: 'side-by-side',
    });
    expect(session).toMatchObject({
      gameId: 'fixture',
      playStyle: 'versus-computer',
      difficulty: 'hard',
      seating: 'side-by-side',
    });
    expect(session.seats.map((seat) => [seat.index, seat.occupant])).toEqual([
      [0, { kind: 'player', mascot: 'owl' }],
      [1, { kind: 'computer' }],
    ]);
  });

  it('gives each Seat its own colour and shape', () => {
    const session = buildSession({
      game: FIXTURE,
      style: FIXTURE.playStyles[2]!,
      joined: ['fox', 'owl', 'bear', 'frog'],
      difficulty: 'easy',
      seating: 'around-the-table',
    });
    expect(session.seats.map((seat) => seat.index)).toEqual([0, 1, 2, 3]);
    expect(new Set(session.seats.map((seat) => seat.color)).size).toBe(4);
    expect(new Set(session.seats.map((seat) => seat.shape)).size).toBe(4);
  });

  it('never has more than four Seats', () => {
    expect(() =>
      buildSession({
        game: FIXTURE,
        style: style('versus-computer', 1, 4, 1),
        joined: ['fox', 'owl', 'bear', 'frog'],
        difficulty: 'easy',
        seating: 'side-by-side',
      }),
    ).toThrow();
  });
});

describe('the Mascots', () => {
  it('are eight, each with its own id', () => {
    expect(MASCOTS).toHaveLength(8);
    expect(new Set(MASCOTS).size).toBe(8);
  });
});
