import { describe, expect, it } from 'vitest';
import type { GameManifest, PlayStyleOption } from '@/contract';
import { CATALOG } from '@/games/catalog';
import { MASCOTS } from '../mascots';
import {
  NO_CHOICES,
  buildSession,
  fittingStyles,
  lobbyView,
  tapMascot,
  type LobbyChoices,
} from './rules';

const style = (
  name: PlayStyleOption['style'],
  min: number,
  max: number,
  computerPlayers = 0,
  usesDifficulty = true,
): PlayStyleOption => ({
  style: name,
  players: { min, max },
  computerPlayers,
  zoned: false,
  usesDifficulty,
});

/** A made-up Game with overlapping Play Styles, beside the real Catalog. */
const FIXTURE: GameManifest = {
  id: 'fixture',
  title: 'Fixture',
  minAge: 4,
  playStyles: [
    style('versus-computer', 1, 1, 1),
    style('solo', 1, 1),
    style('turn-based', 2, 4),
    style('cooperative', 2, 4, 0, false),
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

/** The fixture's lobby with these Mascots joined and these choices made. */
const lobby = (joined: string[], choices: Partial<LobbyChoices> = {}) =>
  lobbyView(FIXTURE, { ...NO_CHOICES, joined, ...choices });

describe('the Play Style the lobby selects', () => {
  it('is the only one that fits, with nothing to choose', () => {
    const view = lobby(['fox'], { style: 'turn-based' });
    expect(view.styles.map(({ style }) => style)).toEqual(['versus-computer', 'solo']);
    const tic = lobbyView(
      CATALOG.find(({ id }) => id === 'tic-tac-toe')!,
      {
        ...NO_CHOICES,
        joined: ['fox', 'owl'],
      },
    );
    expect(tic.styles.map(({ style }) => style)).toEqual(['turn-based']);
    expect(tic.style?.style).toBe('turn-based');
  });

  it('is the one wanted, when several fit and it is among them', () => {
    expect(lobby(['fox', 'owl'], { style: 'cooperative' }).style?.style).toBe('cooperative');
    expect(lobby(['fox'], { style: 'solo' }).style?.style).toBe('solo');
  });

  it('is the first that fits when none is wanted, or the one wanted no longer fits', () => {
    expect(lobby(['fox', 'owl']).style?.style).toBe('turn-based');
    expect(lobby(['fox'], { style: 'cooperative' }).style?.style).toBe('versus-computer');
  });

  it('is none when nobody has joined, and then start begins no Session', () => {
    const view = lobby([]);
    expect(view.styles).toEqual([]);
    expect(view.style).toBeNull();
    expect(view.session).toBeNull();
  });

  it('is none when no Play Style accepts the Players joined', () => {
    const rush: GameManifest = { ...FIXTURE, playStyles: [style('simultaneous', 2, 4)] };
    expect(lobbyView(rush, { ...NO_CHOICES, joined: ['fox'] }).session).toBeNull();
  });

  it('is the Session’s Play Style, with the joined Mascots in their Seats', () => {
    const session = lobby(['owl', 'fox'], { style: 'cooperative' }).session!;
    expect(session.playStyle).toBe('cooperative');
    expect(session.seats.map(({ occupant }) => occupant)).toEqual([
      { kind: 'player', mascot: 'owl' },
      { kind: 'player', mascot: 'fox' },
    ]);
  });
});

describe('Difficulty in the lobby', () => {
  it('offers easy, medium and hard when the selected Play Style uses Difficulty', () => {
    expect(lobby(['fox', 'owl'], { style: 'turn-based' }).difficulties).toEqual([
      'easy',
      'medium',
      'hard',
    ]);
  });

  it('offers nothing when the selected Play Style does not use Difficulty', () => {
    expect(lobby(['fox', 'owl'], { style: 'cooperative' }).difficulties).toEqual([]);
    expect(lobby([]).difficulties).toEqual([]);
  });

  it('is carried by the Session, and is Easy when nothing is chosen', () => {
    expect(lobby(['fox']).session!.difficulty).toBe('easy');
    expect(lobby(['fox'], { difficulty: 'hard' }).session!.difficulty).toBe('hard');
  });

  it('is Easy in the Session when the Play Style does not use it', () => {
    const view = lobby(['fox', 'owl'], { style: 'cooperative', difficulty: 'hard' });
    expect(view.session!.difficulty).toBe('easy');
  });
});

describe('Seating in the lobby', () => {
  it('offers both Seatings with two or more Players', () => {
    for (const joined of [
      ['fox', 'owl'],
      ['fox', 'owl', 'bear'],
      ['fox', 'owl', 'bear', 'frog'],
    ]) {
      expect(lobby(joined).seatings).toEqual(['side-by-side', 'around-the-table']);
    }
  });

  it('offers none with one Player, whose Session is side by side', () => {
    const view = lobby(['fox'], { seating: 'around-the-table' });
    expect(view.seatings).toEqual([]);
    expect(view.session!.seating).toBe('side-by-side');
  });

  it('until one is chosen, is side by side for two Players and around the table for three or four', () => {
    expect(lobby(['fox', 'owl']).session!.seating).toBe('side-by-side');
    expect(lobby(['fox', 'owl', 'bear']).session!.seating).toBe('around-the-table');
    expect(lobby(['fox', 'owl', 'bear', 'frog']).session!.seating).toBe('around-the-table');
  });

  it('is selected even when no Play Style fits the Players joined', () => {
    const rush: GameManifest = { ...FIXTURE, playStyles: [style('turn-based', 2, 2)] };
    const view = lobbyView(rush, { ...NO_CHOICES, joined: ['fox', 'owl', 'bear'] });
    expect(view.session).toBeNull();
    expect(view.seating).toBe('around-the-table');
    expect(lobby(['fox']).seating).toBeNull();
  });

  it('once chosen, is the Seating for any number of Players above one', () => {
    for (const seating of ['side-by-side', 'around-the-table'] as const) {
      expect(lobby(['fox', 'owl'], { seating }).session!.seating).toBe(seating);
      expect(lobby(['fox', 'owl', 'bear'], { seating }).session!.seating).toBe(seating);
    }
  });
});

describe('tapping a Mascot', () => {
  it('gives a Mascot that has not joined the lowest free Seat', () => {
    expect(tapMascot([], 'fox')).toEqual({ joined: ['fox'], refused: false });
    expect(tapMascot(['fox'], 'owl')).toEqual({ joined: ['fox', 'owl'], refused: false });
  });

  it('frees a joined Mascot’s Seat, and the Mascots still joined close up in their order', () => {
    expect(tapMascot(['fox', 'owl', 'bear'], 'owl')).toEqual({
      joined: ['fox', 'bear'],
      refused: false,
    });
    expect(tapMascot(['fox'], 'fox')).toEqual({ joined: [], refused: false });
  });

  it('refuses a fifth Mascot and changes no Seat', () => {
    const four = ['fox', 'owl', 'bear', 'frog'];
    expect(tapMascot(four, 'cat')).toEqual({ joined: four, refused: true });
  });

  it('never seats a Mascot twice', () => {
    let joined: readonly string[] = [];
    for (const mascot of ['fox', 'owl', 'fox', 'fox', 'bear', 'owl', 'cat', 'frog', 'lion']) {
      joined = tapMascot(joined, mascot).joined;
      expect(new Set(joined).size).toBe(joined.length);
      expect(joined.length).toBeLessThanOrEqual(4);
    }
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

  it('is zoned exactly when its Play Style gives each Seat a Zone', () => {
    const begin = (zoned: boolean) =>
      buildSession({
        game: FIXTURE,
        style: { ...style('simultaneous', 2, 4), zoned },
        joined: ['fox', 'owl'],
        difficulty: 'easy',
        seating: 'around-the-table',
      });
    expect(begin(true).zoned).toBe(true);
    expect(begin(false).zoned).toBe(false);
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
