import type { Seating } from '../../src/contract';
import { seats as SEAT_LOOKS } from '../../src/kit/theme';
import { expect, test, type Arcade } from './arcade';
import { CATALOG, sessionFor } from './play';

const GAME = CATALOG.find((game) => game.id === 'tic-tac-toe')!;
const TURN_BASED = GAME.playStyles.find((style) => style.style === 'turn-based')!;

interface Board {
  board: (number | null)[];
  toMove: number;
  marks: ({ seat: number; frame: string } | null)[];
}
const board = async (arcade: Arcade) => (await arcade.round())!.state as Board;

/** Opens a two-Player Session directly and waits for its Round. */
async function openRound(arcade: Arcade, seating: Seating = 'side-by-side') {
  await arcade.call('open', sessionFor(GAME, TURN_BASED, seating), 1);
  await expect.poll(() => arcade.screen()).toBe('tic-tac-toe');
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
  expect(await arcade.screen()).toBe('result');
  expect((await arcade.snapshot()).state).toEqual({
    result: { kind: 'win', winners: [0] },
    celebrated: ['fox'],
  });

  await arcade.tap('home');
  await expect.poll(() => arcade.screen()).toBe('home');
  expect(await arcade.host()).toBe('idle');
  expect(await arcade.counts()).toEqual(before);
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

test('a mark is its Seat’s shape: the snapshot names the Seat, and the picture drawn is its shape frame', async ({
  arcade,
}) => {
  await openRound(arcade);
  await mark(arcade, 0);
  await mark(arcade, 8);
  const { marks } = await board(arcade);
  expect(marks[0]).toEqual({ seat: 0, frame: SEAT_LOOKS[0].shape });
  expect(marks[8]).toEqual({ seat: 1, frame: SEAT_LOOKS[1].shape });
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

test('a draw celebrates every Player’s Mascot', async ({ arcade }) => {
  await openRound(arcade);
  // X O X / X O O / O X X: a full board with no line.
  for (const cell of [0, 1, 2, 4, 3, 5, 7, 6, 8]) await arcade.tapRound(`cell-${cell}`);
  await expect.poll(() => arcade.screen()).toBe('result');
  expect((await arcade.snapshot()).state).toEqual({
    result: { kind: 'draw' },
    celebrated: ['fox', 'owl'],
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
