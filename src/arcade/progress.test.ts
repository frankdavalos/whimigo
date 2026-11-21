import { describe, expect, it } from 'vitest';
import type { GameManifest, MascotId, PlayStyle, Result, Session } from '@/contract';
import { buildSession } from './lobby/rules';
import type { SaveDocument } from '@/platform/save-store';
import { recordRound, starsEarned } from './progress';

const GAME = { id: 'fixture' } as GameManifest;

/** A Session of these Mascots, in Seat order, then this many Computer Players. */
function session(style: PlayStyle, joined: MascotId[], computerPlayers = 0): Session {
  return buildSession({
    game: GAME,
    style: { style, players: { min: 1, max: 4 }, computerPlayers, zoned: false },
    joined,
    difficulty: 'easy',
    seating: 'side-by-side',
  });
}

describe('the Star rule', () => {
  it('gives two Stars to each winning Seat’s Mascot and one to every other Player’s', () => {
    const result: Result = { kind: 'win', winners: [0, 2] };
    expect(starsEarned(result, session('turn-based', ['fox', 'owl', 'bear']))).toEqual({
      fox: 2,
      owl: 1,
      bear: 2,
    });
  });

  it('gives one Star each for a draw', () => {
    expect(starsEarned({ kind: 'draw' }, session('turn-based', ['fox', 'owl']))).toEqual({
      fox: 1,
      owl: 1,
    });
  });

  it('gives two Stars each for a cooperative success, and one each otherwise', () => {
    const together = session('cooperative', ['fox', 'owl', 'cat']);
    expect(starsEarned({ kind: 'cooperative', success: true }, together)).toEqual({
      fox: 2,
      owl: 2,
      cat: 2,
    });
    expect(starsEarned({ kind: 'cooperative', success: false }, together)).toEqual({
      fox: 1,
      owl: 1,
      cat: 1,
    });
  });

  it('gives one Star for a solo Result, whatever the score', () => {
    for (const score of [0, 7, 100]) {
      expect(starsEarned({ kind: 'solo', score }, session('solo', ['frog']))).toEqual({ frog: 1 });
    }
  });

  it('gives a Computer Player nothing, whether it wins or loses', () => {
    const versus = session('versus-computer', ['fox'], 1);
    expect(starsEarned({ kind: 'win', winners: [1] }, versus)).toEqual({ fox: 1 });
    expect(starsEarned({ kind: 'win', winners: [0] }, versus)).toEqual({ fox: 2 });
    expect(starsEarned({ kind: 'draw' }, versus)).toEqual({ fox: 1 });
  });

  it('gives nothing when there is no Result', () => {
    expect(starsEarned(null, session('turn-based', ['fox', 'owl']))).toEqual({});
  });
});

describe('a Round recorded in the save document', () => {
  const FRESH: SaveDocument = { version: 1, mascots: {}, games: {} };

  it('adds each Mascot’s Stars and counts one more Round of the Game', () => {
    const after = recordRound(FRESH, 'tic-tac-toe', { fox: 2, owl: 1 });
    expect(after).toEqual({
      version: 1,
      mascots: { fox: { stars: 2 }, owl: { stars: 1 } },
      games: { 'tic-tac-toe': { roundsPlayed: 1 } },
    });
  });

  it('adds a Mascot’s Stars from different Games into one total, counting each Game’s Rounds apart', () => {
    let document = recordRound(FRESH, 'tic-tac-toe', { fox: 2, owl: 1 });
    document = recordRound(document, 'color-echo', { fox: 1 });
    document = recordRound(document, 'tic-tac-toe', { owl: 2, fox: 1 });
    expect(document.mascots).toEqual({ fox: { stars: 4 }, owl: { stars: 3 } });
    expect(document.games).toEqual({
      'tic-tac-toe': { roundsPlayed: 2 },
      'color-echo': { roundsPlayed: 1 },
    });
  });

  it('leaves the document it was given unchanged', () => {
    const before = recordRound(FRESH, 'tic-tac-toe', { fox: 2 });
    const copy = structuredClone(before);
    recordRound(before, 'tic-tac-toe', { fox: 1 });
    expect(before).toEqual(copy);
  });
});
