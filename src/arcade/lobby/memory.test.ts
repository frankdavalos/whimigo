import { describe, expect, it } from 'vitest';
import type { GameManifest, PlayStyleOption } from '@/contract';
import type { SaveDocument } from '@/platform/save-store';
import { openLobby, rememberSeating, startSession } from './memory';
import { NO_CHOICES, lobbyView, tapMascot, type LobbyChoices } from './rules';

const style = (
  name: PlayStyleOption['style'],
  min: number,
  max: number,
  usesDifficulty = true,
): PlayStyleOption => ({
  style: name,
  players: { min, max },
  computerPlayers: 0,
  zoned: false,
  usesDifficulty,
});

const game = (id: string, playStyles: PlayStyleOption[]): GameManifest => ({
  id,
  title: id,
  minAge: 4,
  playStyles,
  card: { frame: 'arcade/card', color: 0 },
  load: () => Promise.reject(new Error('not loadable')),
});

const ECHO = game('echo', [
  style('solo', 1, 1),
  style('turn-based', 2, 4),
  style('cooperative', 2, 4),
]);
const TOE = game('toe', [style('turn-based', 2, 2, false)]);

const FRESH: SaveDocument = { version: 1, mascots: { fox: { stars: 4 } }, games: {} };

/** Starts a Session from these choices and returns the save document afterwards. */
function played(document: SaveDocument, manifest: GameManifest, choices: Partial<LobbyChoices>) {
  const started = startSession(document, manifest, { ...NO_CHOICES, ...choices });
  if (!started) throw new Error('start was unavailable');
  return started;
}

describe('remembered choices', () => {
  it('are none before a Game has been played', () => {
    expect(openLobby(FRESH, ECHO)).toEqual(NO_CHOICES);
  });

  it('once a Session starts, hold that Game’s Play Style, Difficulty and Mascots in Seat order', () => {
    const { session, document } = played(FRESH, ECHO, {
      joined: ['owl', 'fox', 'bear'],
      style: 'cooperative',
      difficulty: 'medium',
    });
    expect(session.playStyle).toBe('cooperative');
    expect(document.games['echo']?.choices).toEqual({
      style: 'cooperative',
      difficulty: 'medium',
      mascots: ['owl', 'fox', 'bear'],
    });
    expect(document.mascots).toEqual(FRESH.mascots);
  });

  it('keep the Rounds already played', () => {
    const before: SaveDocument = { ...FRESH, games: { echo: { roundsPlayed: 3 } } };
    const { document } = played(before, ECHO, { joined: ['fox'] });
    expect(document.games['echo']?.roundsPlayed).toBe(3);
  });

  it('open the lobby again with the same Mascots and choices, so one press of start begins the same Session', () => {
    const seated = rememberSeating(FRESH, 'around-the-table');
    const { session, document } = played(seated, ECHO, {
      joined: ['frog', 'cat'],
      style: 'cooperative',
      difficulty: 'hard',
      seating: 'around-the-table',
    });
    const reopened = startSession(document, ECHO, openLobby(document, ECHO));
    expect(reopened?.session).toEqual(session);
  });

  it('of one Game do not change what another Game’s lobby shows', () => {
    const { document } = played(FRESH, ECHO, { joined: ['fox', 'owl'], difficulty: 'hard' });
    expect(openLobby(document, TOE)).toEqual(NO_CHOICES);
    const after = played(document, TOE, { joined: ['bear', 'cat'] }).document;
    expect(openLobby(after, ECHO)).toEqual(openLobby(document, ECHO));
  });

  it('select the first Play Style that fits when the remembered one no longer fits', () => {
    const { document } = played(FRESH, ECHO, {
      joined: ['fox', 'owl'],
      style: 'cooperative',
    });
    const reopened = openLobby(document, ECHO);
    const alone = { ...reopened, joined: tapMascot(reopened.joined, 'owl').joined };
    expect(lobbyView(ECHO, alone).style?.style).toBe('solo');
  });

  it('keep the last Difficulty chosen when the Play Style played does not use one', () => {
    const { document } = played(FRESH, TOE, { joined: ['fox', 'owl'], difficulty: 'hard' });
    expect(openLobby(document, TOE).difficulty).toBe('hard');
  });

  it('are not written when start is unavailable', () => {
    expect(startSession(FRESH, TOE, { ...NO_CHOICES, joined: ['fox'] })).toBeNull();
  });
});

describe('the remembered Seating', () => {
  it('is none until a Seating has been chosen', () => {
    expect(openLobby(FRESH, ECHO).seating).toBeNull();
  });

  it('once chosen, is selected in every Game’s lobby', () => {
    const document = rememberSeating(FRESH, 'around-the-table');
    expect(openLobby(document, ECHO).seating).toBe('around-the-table');
    expect(openLobby(document, TOE).seating).toBe('around-the-table');
    expect(document.mascots).toEqual(FRESH.mascots);
  });

  it('survives a Session of another Game', () => {
    const document = rememberSeating(FRESH, 'side-by-side');
    const after = played(document, ECHO, { joined: ['fox', 'owl', 'bear'] }).document;
    expect(openLobby(after, TOE).seating).toBe('side-by-side');
  });
});
