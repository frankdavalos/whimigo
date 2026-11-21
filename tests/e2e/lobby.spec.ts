import type { GameManifest, MascotId, Session } from '../../src/contract';
import { fittingStyles } from '../../src/arcade/lobby/rules';
import { MASCOTS, mascotFrame } from '../../src/arcade/mascots';
import { seats as SEAT_LOOKS } from '../../src/kit/theme';
import { expect, test, type Arcade } from './arcade';
import { CATALOG } from './play';

/** What the lobby's snapshot reports. */
interface Lobby {
  game: string;
  mascots: { mascot: MascotId; frame: string }[];
  joined: { mascot: MascotId; seat: number; color: number; shape: string }[];
  refusals: number;
  styles: string[];
  style: string | null;
  difficulties: string[];
  difficulty: string | null;
  seatings: string[];
  seating: string | null;
  start: { available: boolean };
}

const lobby = async (arcade: Arcade) => (await arcade.snapshot()).state as Lobby;
const targets = async (arcade: Arcade) => Object.keys((await arcade.snapshot()).targets);

/** Each choice target named is drawn as its picture, a frame of the Arcade's atlas named alike. */
async function expectPictures(arcade: Arcade, names: readonly string[]) {
  const { images } = await arcade.call('pictures');
  for (const name of names)
    expect(images).toContainEqual({ texture: 'arcade', frame: `arcade/${name}` });
}

/** From the Home Screen, opens a Game's lobby. */
async function openLobby(arcade: Arcade, game: GameManifest | string) {
  await arcade.tap(typeof game === 'string' ? game : game.id);
  await expect.poll(() => arcade.screen()).toBe('lobby');
}

/** Taps Mascots in turn, waiting for each tap to be seen. */
async function tapMascots(arcade: Arcade, mascots: readonly MascotId[]) {
  for (const mascot of mascots) {
    const before = JSON.stringify(await lobby(arcade));
    await arcade.tap(`mascot-${mascot}`);
    await expect.poll(async () => JSON.stringify(await lobby(arcade))).not.toBe(before);
  }
}

/** Taps start and waits for the Round; returns its Session. */
async function start(arcade: Arcade, gameId: string): Promise<Session> {
  await arcade.tap('start');
  await expect.poll(() => arcade.screen()).toBe(gameId);
  await expect.poll(async () => (await arcade.round()) !== null).toBe(true);
  return (await arcade.round())!.session;
}

const TIC_TAC_TOE = CATALOG.find(({ id }) => id === 'tic-tac-toe')!;
const COLOR_ECHO = CATALOG.find(({ id }) => id === 'color-echo')!;

test.beforeEach(async ({ arcade }) => {
  await arcade.open();
  await arcade.start();
});

test('lists eight Mascots, each a named target whose picture is a frame in the Arcade’s atlas', async ({
  arcade,
}) => {
  await openLobby(arcade, CATALOG[0]!);
  const { mascots } = await lobby(arcade);
  expect(mascots).toEqual(MASCOTS.map((mascot) => ({ mascot, frame: mascotFrame(mascot) })));
  expect(await targets(arcade)).toEqual(
    expect.arrayContaining(MASCOTS.map((mascot) => `mascot-${mascot}`)),
  );
  const { images } = await arcade.call('pictures');
  for (const { frame } of mascots) expect(images).toContainEqual({ texture: 'arcade', frame });
});

test('tapping a joined Mascot frees its Seat, and those still joined keep their order with no gap', async ({
  arcade,
}) => {
  await openLobby(arcade, CATALOG[0]!);
  await tapMascots(arcade, ['fox', 'owl', 'bear', 'owl']);
  expect((await lobby(arcade)).joined).toEqual([
    { mascot: 'fox', seat: 0, color: SEAT_LOOKS[0].color, shape: SEAT_LOOKS[0].shape },
    { mascot: 'bear', seat: 1, color: SEAT_LOOKS[1].color, shape: SEAT_LOOKS[1].shape },
  ]);
});

test('a Mascot tapped when four have joined is refused, with no Seat changed', async ({
  arcade,
}) => {
  await openLobby(arcade, CATALOG[0]!);
  await tapMascots(arcade, ['fox', 'owl', 'bear', 'frog']);
  const four = (await lobby(arcade)).joined;
  await arcade.tap('mascot-cat');
  await expect.poll(async () => (await lobby(arcade)).refusals).toBe(1);
  expect((await lobby(arcade)).joined).toEqual(four);
});

test('the home control returns to the Home Screen with no Session, leaving the counts as they were', async ({
  arcade,
}) => {
  const before = await arcade.counts();
  await openLobby(arcade, CATALOG[0]!);
  await tapMascots(arcade, ['fox', 'owl']);
  await arcade.tap('home');
  await expect.poll(() => arcade.screen()).toBe('home');
  expect(await arcade.host()).toBe('idle');
  expect(await arcade.round()).toBeNull();
  expect(await arcade.counts()).toEqual(before);
});

for (const game of CATALOG) {
  test(`${game.id}: the Play Styles offered follow from who sat down, and start is unavailable when none fits`, async ({
    arcade,
  }) => {
    await openLobby(arcade, game);
    for (const players of [0, 1, 2, 3, 4]) {
      if (players > 0) await tapMascots(arcade, [MASCOTS[players - 1]!]);
      const fitting = fittingStyles(game, players).map(({ style }) => style);
      const shown = await lobby(arcade);
      const named = (await targets(arcade)).filter((name) => name.startsWith('style-'));
      expect(shown.styles, `${players} Players`).toEqual(fitting);
      expect(shown.style, `${players} Players`).toBe(fitting[0] ?? null);
      expect(named, `${players} Players`).toEqual(
        fitting.length > 1 ? fitting.map((style) => `style-${style}`) : [],
      );
      await expectPictures(arcade, named);
      expect(shown.start.available, `${players} Players`).toBe(fitting.length > 0);
      if (fitting.length === 0) {
        // A screen change happens at the start of the next frame: let several pass, then look.
        const frames = await arcade.call('frames');
        await arcade.tap('start');
        await expect.poll(() => arcade.call('frames')).toBeGreaterThan(frames + 5);
        expect(await arcade.screen()).toBe('lobby');
        expect(await arcade.host()).toBe('idle');
      }
    }
  });
}

test('offers easy, medium and hard as pictures only when the Play Style uses Difficulty, and the Session carries the one chosen', async ({
  arcade,
}) => {
  await openLobby(arcade, TIC_TAC_TOE);
  await tapMascots(arcade, ['fox', 'owl']);
  expect((await lobby(arcade)).difficulties).toEqual([]);
  expect((await targets(arcade)).filter((name) => name.startsWith('difficulty-'))).toEqual([]);
  await arcade.tap('home');
  await expect.poll(() => arcade.screen()).toBe('home');

  await openLobby(arcade, COLOR_ECHO);
  await tapMascots(arcade, ['fox']);
  const shown = await lobby(arcade);
  expect(shown.difficulties).toEqual(['easy', 'medium', 'hard']);
  expect(shown.difficulty).toBe('easy');
  for (const level of shown.difficulties)
    expect(await targets(arcade)).toContain(`difficulty-${level}`);
  await expectPictures(
    arcade,
    shown.difficulties.map((level) => `difficulty-${level}`),
  );
  await arcade.tap('difficulty-hard');
  await expect.poll(async () => (await lobby(arcade)).difficulty).toBe('hard');
  expect((await start(arcade, COLOR_ECHO.id)).difficulty).toBe('hard');
});

test('offers the two Seatings as pictures with two or more Players, side by side for two and around the table for three until one is chosen', async ({
  arcade,
}) => {
  await openLobby(arcade, TIC_TAC_TOE);
  await tapMascots(arcade, ['fox']);
  expect((await lobby(arcade)).seatings).toEqual([]);
  expect((await targets(arcade)).filter((name) => name.startsWith('seating-'))).toEqual([]);

  await tapMascots(arcade, ['owl']);
  expect(await lobby(arcade)).toMatchObject({
    seatings: ['side-by-side', 'around-the-table'],
    seating: 'side-by-side',
  });
  expect(await targets(arcade)).toEqual(
    expect.arrayContaining(['seating-side-by-side', 'seating-around-the-table']),
  );
  await expectPictures(arcade, ['seating-side-by-side', 'seating-around-the-table']);
  await tapMascots(arcade, ['bear']);
  expect((await lobby(arcade)).seating).toBe('around-the-table');
  expect((await arcade.call('save')).seating).toBeUndefined();
});

test('a Session of one Player is side by side, with no Seating to choose', async ({ arcade }) => {
  await openLobby(arcade, COLOR_ECHO);
  await tapMascots(arcade, ['fox']);
  expect((await start(arcade, COLOR_ECHO.id)).seating).toBe('side-by-side');
});

test('a chosen Seating is saved and selected in every Game’s lobby with two or more Players, after a reload too', async ({
  arcade,
}) => {
  // It visits every Game's lobby, so it takes longer with each Game added.
  test.slow();
  await openLobby(arcade, TIC_TAC_TOE);
  await tapMascots(arcade, ['fox', 'owl']);
  await arcade.tap('seating-around-the-table');
  await expect.poll(async () => (await lobby(arcade)).seating).toBe('around-the-table');
  expect((await arcade.call('save')).seating).toBe('around-the-table');

  await arcade.open();
  await arcade.start();
  for (const game of CATALOG) {
    await openLobby(arcade, game);
    const joined = (await lobby(arcade)).joined.length;
    if (joined < 2) await tapMascots(arcade, MASCOTS.slice(4, 6).slice(0, 2 - joined));
    expect((await lobby(arcade)).seating, game.id).toBe('around-the-table');
    await arcade.tap('home');
    await expect.poll(() => arcade.screen()).toBe('home');
  }
});

test('after a reload, a second visit to a Game’s lobby shows the same Mascots and choices, and one press of start begins the same Session, with the Stars kept @smoke', async ({
  arcade,
}) => {
  await openLobby(arcade, TIC_TAC_TOE);
  await tapMascots(arcade, ['panda', 'lion']);
  await arcade.tap('seating-around-the-table');
  await expect.poll(async () => (await lobby(arcade)).seating).toBe('around-the-table');
  const first = await start(arcade, TIC_TAC_TOE.id);
  expect((await arcade.call('save')).games[TIC_TAC_TOE.id]?.choices).toEqual({
    style: 'turn-based',
    difficulty: 'easy',
    mascots: ['panda', 'lion'],
  });
  await arcade.skipDemo();
  await arcade.call('finish', { kind: 'win', winners: [1] });
  await expect.poll(() => arcade.screen()).toBe('result');
  const saved = await arcade.call('save');

  await arcade.open();
  expect(await arcade.call('save')).toEqual(saved);
  await arcade.start();
  await openLobby(arcade, TIC_TAC_TOE);
  expect(await lobby(arcade)).toMatchObject({
    joined: [
      { mascot: 'panda', seat: 0 },
      { mascot: 'lion', seat: 1 },
    ],
    style: 'turn-based',
    seating: 'around-the-table',
    start: { available: true },
  });
  expect(await start(arcade, TIC_TAC_TOE.id)).toEqual(first);
  expect((await arcade.call('save')).mascots).toMatchObject({
    panda: { stars: 1 },
    lion: { stars: 2 },
  });
});

test('what is remembered for one Game does not change what another Game’s lobby shows', async ({
  arcade,
}) => {
  await openLobby(arcade, TIC_TAC_TOE);
  await tapMascots(arcade, ['panda', 'lion']);
  await start(arcade, TIC_TAC_TOE.id);
  await arcade.open();
  await arcade.start();
  await openLobby(arcade, COLOR_ECHO);
  expect(await lobby(arcade)).toMatchObject({ joined: [], style: null, difficulty: null });
});

/** What a page may report about the device it runs on. */
const REPORTED_DEVICES = {
  // iPadOS reports itself as a Mac, with touch points.
  'an iPad on iPadOS': {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 5,
  },
  'an Android tablet': {
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    platform: 'Linux armv8l',
    maxTouchPoints: 10,
  },
  'a desktop with no touch at all': {
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    platform: 'Linux x86_64',
    maxTouchPoints: 0,
  },
} as const;

for (const [device, reported] of Object.entries(REPORTED_DEVICES)) {
  test.describe(`on a page that reports ${device}`, () => {
    test.use({ userAgent: reported.userAgent });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(({ platform, maxTouchPoints }) => {
        Object.defineProperty(Navigator.prototype, 'platform', { get: () => platform });
        Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => maxTouchPoints });
      }, reported);
    });

    for (const game of CATALOG) {
      for (const style of game.playStyles.filter((option) =>
        ['simultaneous', 'cooperative'].includes(option.style),
      )) {
        test(`${game.id} ${style.style} offers a Seat to every Player it accepts, four included (story 3)`, async ({
          arcade,
        }) => {
          await openLobby(arcade, game);
          await tapMascots(arcade, MASCOTS.slice(0, style.players.max));
          const shown = await lobby(arcade);
          expect(shown.styles).toContain(style.style);
          if (shown.style !== style.style) await arcade.tap(`style-${style.style}`);
          expect((await lobby(arcade)).start.available).toBe(true);
          const session = await start(arcade, game.id);
          expect(session.seats).toHaveLength(style.players.max);
          expect((await arcade.round())!.zones).toHaveLength(style.zoned ? style.players.max : 0);
        });
      }
    }
  });
}
