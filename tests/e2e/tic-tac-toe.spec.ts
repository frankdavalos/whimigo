import type { Seating } from '../../src/contract';
import { seats as SEAT_LOOKS } from '../../src/kit/theme';
import { expect, test, type Arcade } from './arcade';
import { CATALOG, openSession, playToResult, sessionFor } from './play';

const GAME = CATALOG.find((game) => game.id === 'tic-tac-toe')!;
const TURN_BASED = GAME.playStyles.find((style) => style.style === 'turn-based')!;
const VERSUS_COMPUTER = GAME.playStyles.find((style) => style.style === 'versus-computer')!;

interface Board {
  board: (number | null)[];
  toMove: number;
  marks: ({ seat: number; shape: string; color: number } | null)[];
  computer: 'choosing' | 'placing' | null;
  pointer: { seat: number; at: { x: number; y: number } };
}
const board = async (arcade: Arcade) => (await arcade.round())!.state as Board;

/** Opens a two-Player Session directly and waits for its Round. */
async function openRound(arcade: Arcade, seating: Seating = 'side-by-side') {
  await openSession(arcade, sessionFor(GAME, TURN_BASED, seating), 1);
}

/** Taps a cell and waits for the mark. */
async function mark(arcade: Arcade, cell: number) {
  await arcade.tapRound(`cell-${cell}`);
  await expect.poll(async () => (await board(arcade)).board[cell]).not.toBeNull();
}

test.beforeEach(async ({ arcade }) => {
  await arcade.open();
  await arcade.start();
});

test('two Players go from the Home Screen through the lobby to a finished Round and back @smoke', async ({
  arcade,
}) => {
  const before = await arcade.counts();
  await arcade.tap('tic-tac-toe');
  await expect.poll(() => arcade.screen()).toBe('lobby');
  await arcade.tap('mascot-fox');
  await expect
    .poll(async () => (await arcade.snapshot()).state)
    .toMatchObject({
      joined: [{ mascot: 'fox', seat: 0, color: SEAT_LOOKS[0].color, shape: SEAT_LOOKS[0].shape }],
    });
  await arcade.tap('mascot-owl');
  await expect
    .poll(async () => (await arcade.snapshot()).state)
    .toMatchObject({
      joined: [
        { mascot: 'fox', seat: 0 },
        { mascot: 'owl', seat: 1, color: SEAT_LOOKS[1].color, shape: SEAT_LOOKS[1].shape },
      ],
    });
  expect(await arcade.call('inputScenes')).toEqual(['lobby']);
  await arcade.tap('start');
  await expect.poll(() => arcade.screen()).toBe('tic-tac-toe');
  await arcade.skipDemo();
  expect(await arcade.host()).toBe('playing');
  expect((await arcade.call('hostStates')).slice(-3)).toEqual(['idle', 'loading', 'playing']);
  const { session } = (await arcade.round())!;
  expect(session.seats.map((seat) => seat.occupant)).toEqual([
    { kind: 'player', mascot: 'fox' },
    { kind: 'player', mascot: 'owl' },
  ]);
  expect(await board(arcade)).toMatchObject({ board: Array(9).fill(null), toMove: 0 });

  // The first Seat takes the top row while the second plays the middle row.
  for (const cell of [0, 3, 1, 4, 2]) await arcade.tapRound(`cell-${cell}`);
  await expect.poll(() => arcade.host()).toBe('showing-result');
  // The host shows a Result a frame before its screen does.
  await expect.poll(() => arcade.screen()).toBe('result');
  expect((await arcade.snapshot()).state).toEqual({
    result: { kind: 'win', winners: [0] },
    celebrated: ['fox'],
    stars: { fox: 2 },
  });
  expect((await arcade.call('save')).mascots).toEqual({ fox: { stars: 2 }, owl: { stars: 1 } });

  await arcade.tap('home');
  await expect.poll(() => arcade.screen()).toBe('home');
  expect(await arcade.host()).toBe('idle');
  expect(await arcade.counts()).toEqual(before);
});

for (const difficulty of ['easy', 'medium', 'hard'] as const) {
  test(`one Player in the lobby plays Versus Computer on ${difficulty} to a Result (story 16)`, async ({
    arcade,
  }) => {
    test.slow();
    await arcade.tap('tic-tac-toe');
    await expect.poll(() => arcade.screen()).toBe('lobby');
    await arcade.tap('mascot-fox');
    await expect
      .poll(async () => (await arcade.snapshot()).state)
      .toMatchObject({ style: 'versus-computer' });
    await arcade.tap(`difficulty-${difficulty}`);
    await expect.poll(async () => (await arcade.snapshot()).state).toMatchObject({ difficulty });
    await arcade.tap('start');
    await expect.poll(() => arcade.screen()).toBe('tic-tac-toe');
    await arcade.skipDemo();
    const { session } = (await arcade.round())!;
    expect(session).toMatchObject({ playStyle: 'versus-computer', difficulty });
    expect(session.seats.map((seat) => seat.occupant)).toEqual([
      { kind: 'player', mascot: 'fox' },
      { kind: 'computer' },
    ]);

    await playToResult(arcade, GAME.id);
    await expect.poll(() => arcade.screen()).toBe('result');
    const cells = (await board(arcade)).board;
    expect(cells.filter((seat) => seat === 1).length, 'the Computer Player moved').toBeGreaterThan(
      0,
    );
  });
}

/** Opens a Versus Computer Session, skips its Demo, and makes the Player's first Move. */
async function openVersusComputer(arcade: Arcade) {
  await openSession(arcade, sessionFor(GAME, VERSUS_COMPUTER), 1);
  await mark(arcade, 4);
}

type Point = { readonly x: number; readonly y: number };

/** One step of what `inPage` does, frame by frame, inside the page. */
type Step =
  /** Touches a point and lifts at once, as the browser's own touch events. */
  | { readonly tap: Point }
  /** Waits until the Computer Player is in this phase. */
  | { readonly until: Board['computer'] }
  /** Touches a point once a frame for as long as the Computer Player is in this phase. */
  | { readonly tap: Point; readonly while: Board['computer'] }
  /** Hides the page, as the home gesture would. */
  | 'hide';

/**
 * Plays `steps` inside the page, checking the Round once a frame, so that nothing the Round does
 * comes between a step and the next, however slowly the page draws. A touch sent from the test
 * arrives frames later, and a busy page counts each frame up to 200 ms in full.
 */
async function inPage(arcade: Arcade, steps: readonly Step[]) {
  await arcade.page.evaluate(
    (steps) =>
      new Promise<void>((resolve) => {
        const round = () => window.whimigo!.round()!;
        const phase = () => (round().state as { computer: unknown }).computer;
        const canvas = document.querySelector('canvas')!;
        const tap = ({ x, y }: { x: number; y: number }) => {
          const finger = new Touch({
            identifier: 1,
            target: canvas,
            clientX: x,
            clientY: y,
            pageX: x,
            pageY: y,
          });
          for (const [type, touches] of [
            ['touchstart', [finger]],
            ['touchend', []],
          ] as const) {
            canvas.dispatchEvent(
              new TouchEvent(type, {
                touches: [...touches],
                targetTouches: [...touches],
                changedTouches: [finger],
                bubbles: true,
                cancelable: true,
              }),
            );
          }
        };
        let next = 0;
        const look = () => {
          while (next < steps.length) {
            const step = steps[next]!;
            if (step === 'hide') {
              Object.defineProperty(document, 'visibilityState', {
                configurable: true,
                get: () => 'hidden',
              });
              Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
              document.dispatchEvent(new Event('visibilitychange'));
            } else if ('while' in step) {
              if (phase() === step.while) {
                tap(step.tap);
                break;
              }
            } else if ('tap' in step) {
              tap(step.tap);
            } else if (phase() !== step.until) {
              break;
            }
            next += 1;
          }
          if (next < steps.length) requestAnimationFrame(look);
          else resolve();
        };
        look();
      }),
    steps,
  );
}

test('while the Computer Player’s mark is placed, a tap on an empty cell makes no Move, and play goes on after it (story 16)', async ({
  arcade,
}) => {
  await openVersusComputer(arcade);
  const { targets } = (await arcade.round())!;
  await inPage(arcade, [{ until: 'placing' }, { tap: targets['cell-0']! }]);
  await expect.poll(async () => (await board(arcade)).computer).toBeNull();
  const { board: cells, toMove } = await board(arcade);
  expect(
    cells.filter((seat) => seat === 0),
    'the Player’s one mark',
  ).toHaveLength(1);
  expect(
    cells.filter((seat) => seat === 1),
    'the Computer Player’s one mark',
  ).toHaveLength(1);
  expect(toMove).toBe(0);
  expect((await arcade.round())!.refusals).toBe(1);
  const empty = cells.findIndex((seat) => seat === null);
  await mark(arcade, empty);
});

test('a touch refused while the Computer Player chooses does not keep the Turn pointer at its edge once the Turn passes', async ({
  arcade,
}) => {
  await openSession(arcade, sessionFor(GAME, VERSUS_COMPUTER), 1);
  const { targets } = (await arcade.round())!;
  // A touch every frame of the Computer Player's choosing is refused every frame, so the pointer's
  // wiggle, about half a second, is still playing when the Turn passes, however slow the frames.
  await inPage(arcade, [
    { tap: targets['cell-4']! },
    { tap: targets['cell-0']!, while: 'choosing' },
  ]);
  await expect.poll(async () => (await board(arcade)).computer).toBeNull();
  // Long enough for any wiggle to have ended.
  await arcade.page.waitForTimeout(1000);
  const round = (await arcade.round())!;
  expect(round.refusals).toBeGreaterThan(0);
  const drawn = await arcade.toPage((round.state as Board).pointer.at);
  const target = round.targets['turn-pointer']!;
  expect(drawn.x).toBeCloseTo(target.x, 0);
  expect(drawn.y).toBeCloseTo(target.y, 0);
});

test('the Computer Player never moves while the Round is paused, and moves once play resumes (story 16)', async ({
  arcade,
  page,
}) => {
  await openVersusComputer(arcade);
  // The page hides in the very frame the Computer Player is seen choosing.
  await inPage(arcade, [{ until: 'choosing' }, 'hide']);
  await expect.poll(() => arcade.host()).toBe('paused');
  const paused = (await arcade.round())!;
  await page.waitForTimeout(3000);
  const later = (await arcade.round())!;
  expect(later.now).toBe(paused.now);
  expect(later.state).toEqual(paused.state);
  expect((later.state as Board).computer).toBe('choosing');
  expect((later.state as Board).board.filter((seat) => seat === 1)).toHaveLength(0);

  await arcade.show();
  await expect.poll(() => arcade.screen()).toBe('pause');
  await arcade.tap('play');
  await expect.poll(() => arcade.screen()).toBe('tic-tac-toe');
  await expect
    .poll(async () => (await board(arcade)).board.filter((seat) => seat === 1))
    .toHaveLength(1);
});

test('a tap on an empty cell places the mark of the Seat to move and passes the Turn; a taken cell does nothing', async ({
  arcade,
  page,
}) => {
  await openRound(arcade);
  const cells = Object.keys((await arcade.round())!.targets).filter((name) =>
    name.startsWith('cell-'),
  );
  expect(cells.sort()).toEqual(Array.from({ length: 9 }, (_, cell) => `cell-${cell}`));
  await mark(arcade, 4);
  expect(await board(arcade)).toMatchObject({ toMove: 1 });
  expect((await board(arcade)).board.filter((cell) => cell !== null)).toHaveLength(1);

  await arcade.tapRound('cell-4');
  await page.waitForTimeout(300);
  expect(await board(arcade)).toMatchObject({ toMove: 1 });
  expect((await board(arcade)).board.filter((cell) => cell !== null)).toHaveLength(1);
});

test('a mark is its Seat’s shape: the snapshot names the Seat, the shape frame drawn and its colour', async ({
  arcade,
}) => {
  await openRound(arcade);
  await mark(arcade, 0);
  await mark(arcade, 8);
  const { marks } = await board(arcade);
  expect(marks[0]).toEqual({ seat: 0, shape: SEAT_LOOKS[0].shape, color: SEAT_LOOKS[0].color });
  expect(marks[8]).toEqual({ seat: 1, shape: SEAT_LOOKS[1].shape, color: SEAT_LOOKS[1].color });
});

test('two taps on two empty cells in one touch event make exactly one Move', async ({ arcade }) => {
  await openRound(arcade);
  const { targets } = (await arcade.round())!;
  await arcade.touch('touchStart', [targets['cell-0']!, targets['cell-8']!]);
  await arcade.touch('touchEnd', []);
  await expect
    .poll(async () => (await board(arcade)).board.filter((c) => c !== null))
    .toHaveLength(1);
  expect(await board(arcade)).toMatchObject({ toMove: 1 });
  // The gate opens again once both fingers have lifted.
  await mark(arcade, 4);
});

test('a touch at a cell’s centre marks that cell and no other', async ({ arcade }) => {
  await openRound(arcade);
  await mark(arcade, 5);
  expect((await board(arcade)).board.map((seat) => seat !== null)).toEqual([
    false,
    false,
    false,
    false,
    false,
    true,
    false,
    false,
    false,
  ]);
});

test('each accepted Move asks for a sound, reported with its key and Scene time', async ({
  arcade,
}) => {
  await openRound(arcade);
  expect(await arcade.call('sounds')).toEqual([]);
  await mark(arcade, 4);
  await mark(arcade, 0);
  const sounds = await arcade.call('sounds');
  expect(sounds.map(({ key }) => key)).toEqual(['tic-tac-toe/place', 'tic-tac-toe/place']);
  expect(sounds[1]!.time).toBeGreaterThan(sounds[0]!.time);
});

for (const seating of ['side-by-side', 'around-the-table'] as const) {
  test(`the Turn pointer is at the edge of the Seat to move, ${seating}`, async ({ arcade }) => {
    await openRound(arcade, seating);
    const pointer = async () => (await arcade.round())!.targets['turn-pointer']!;
    const { canvas } = await arcade.layout();
    const first = await pointer();
    await mark(arcade, 4);
    const second = await pointer();
    if (seating === 'side-by-side') {
      expect(first.x).toBeLessThan(canvas.x + canvas.width / 2);
      expect(second.x).toBeGreaterThan(canvas.x + canvas.width / 2);
      expect(second.y).toBeCloseTo(first.y, 3);
      expect(first.y).toBeGreaterThan(canvas.y + canvas.height / 2);
    } else {
      expect(first.y).toBeGreaterThan(canvas.y + canvas.height / 2);
      expect(second.y).toBeLessThan(canvas.y + canvas.height / 2);
    }
  });
}

test('the Seat that moves first alternates from one Round to the next', async ({ arcade }) => {
  await openRound(arcade);
  expect(await board(arcade)).toMatchObject({ toMove: 0 });
  for (const cell of [0, 3, 1, 4, 2]) await mark(arcade, cell);
  await expect.poll(() => arcade.screen()).toBe('result');
  await arcade.tap('replay');
  await expect.poll(() => arcade.screen()).toBe('tic-tac-toe');
  expect(await board(arcade)).toMatchObject({ board: Array(9).fill(null), toMove: 1 });
});

test('a draw celebrates every Player’s Mascot, each with one Star', async ({ arcade }) => {
  await openRound(arcade);
  // X O X / X O O / O X X: a full board with no line.
  for (const cell of [0, 1, 2, 4, 3, 5, 7, 6, 8]) await arcade.tapRound(`cell-${cell}`);
  await expect.poll(() => arcade.screen()).toBe('result');
  expect((await arcade.snapshot()).state).toEqual({
    result: { kind: 'draw' },
    celebrated: ['fox', 'owl'],
    stars: { fox: 1, owl: 1 },
  });
});

test('while the Result shows, touches at the board change nothing, and only the Result screen takes input', async ({
  arcade,
  page,
}) => {
  await openRound(arcade);
  for (const cell of [0, 3, 1, 4, 2]) await mark(arcade, cell);
  await expect.poll(() => arcade.screen()).toBe('result');
  const finished = await board(arcade);
  expect(await arcade.call('inputScenes')).toEqual(['result']);
  const { targets } = (await arcade.round())!;
  for (const cell of [5, 6, 7, 8]) {
    // Not where the Result screen's own controls are.
    const { x, y } = targets[`cell-${cell}`]!;
    const { replay, home } = (await arcade.snapshot()).targets;
    const near = (a: { x: number; y: number; rect: { width: number } }) =>
      Math.abs(a.x - x) < a.rect.width && Math.abs(a.y - y) < a.rect.width;
    if (near(replay!) || near(home!)) continue;
    await page.touchscreen.tap(x, y);
  }
  await page.waitForTimeout(300);
  expect(await board(arcade)).toEqual(finished);
  expect(await arcade.screen()).toBe('result');
});

test('a finger on the board when the Round pauses, lifted while it is paused, does not hold the board after play', async ({
  arcade,
}) => {
  await openRound(arcade);
  const { targets } = (await arcade.round())!;
  // One child marks a cell and keeps a finger there while another holds the pause control.
  await arcade.touch('touchStart', [targets['cell-0']!, targets['pause']!]);
  await expect.poll(() => arcade.screen(), { timeout: 3000 }).toBe('pause');
  await arcade.touch('touchEnd', []);
  await arcade.tap('play');
  await expect.poll(() => arcade.screen()).toBe('tic-tac-toe');
  expect(await board(arcade)).toMatchObject({ toMove: 1 });
  await mark(arcade, 4);
});
