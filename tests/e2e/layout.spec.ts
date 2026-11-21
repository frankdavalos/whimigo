import type { Rect, Seating } from '../../src/contract';
import { MASCOTS } from '../../src/arcade/mascots';
import {
  type Arcade,
  MIN_GAP,
  MIN_TARGET,
  OTHER_VIEWPORTS,
  expect,
  gapBetween,
  test,
} from './arcade';
import { CATALOG, EVERY_STYLE, openSession, sessionFor } from './play';

const DESIGN = { width: 2752, height: 2064 };
/** Rounding between canvas pixels and CSS pixels, in CSS pixels. */
const EPSILON = 0.75;

const shapes = { 'this project’s viewport': null, ...OTHER_VIEWPORTS };

const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x - EPSILON &&
  inner.y >= outer.y - EPSILON &&
  inner.x + inner.width <= outer.x + outer.width + EPSILON &&
  inner.y + inner.height <= outer.y + outer.height + EPSILON;

type Check = (
  screen: string,
  layout: Awaited<ReturnType<Arcade['layout']>>,
  snapshot: Awaited<ReturnType<Arcade['snapshot']>>,
) => void;

/**
 * Visits every Arcade screen and hands each one's layout and snapshot to `check`: the tap-to-start
 * screen, the Home Screen, every check screen, every Game's lobby with each number of Players
 * joined, and the pause and Result screens.
 */
async function eachScreen(arcade: Arcade, check: Check) {
  const visit = async (name: string) => check(name, await arcade.layout(), await arcade.snapshot());
  await arcade.open();
  await visit('start');
  await arcade.start();
  await visit('home');
  for (const game of CATALOG) {
    await arcade.tap(game.id);
    await expect.poll(() => arcade.screen()).toBe('lobby');
    await visit(`${game.id} lobby with 0 Players`);
    for (const [index, mascot] of MASCOTS.slice(0, 4).entries()) {
      const before = JSON.stringify((await arcade.snapshot()).state);
      await arcade.tap(`mascot-${mascot}`);
      await expect
        .poll(async () => JSON.stringify((await arcade.snapshot()).state))
        .not.toBe(before);
      await visit(`${game.id} lobby with ${index + 1} Players`);
    }
    await arcade.tap('home');
    await expect.poll(() => arcade.screen()).toBe('home');
  }
  for (const id of await arcade.checks()) {
    await arcade.call('openCheck', id);
    await expect.poll(() => arcade.screen()).toBe(id);
    await visit(id);
  }
  const { game, style } = EVERY_STYLE[0]!;
  await openSession(arcade, sessionFor(game, style), 1);
  await arcade.hold('pause', 900);
  await expect.poll(() => arcade.screen()).toBe('pause');
  await visit('pause');
  await arcade.tap('play');
  await expect.poll(() => arcade.screen()).toBe(game.id);
  await arcade.call('finish', { kind: 'win', winners: [0] });
  await expect.poll(() => arcade.screen()).toBe('result');
  await visit('result');
}

/** Every Game in each Play Style, with each number of Seats it accepts, in each Seating that applies. */
const EVERY_ROUND = EVERY_STYLE.flatMap(({ game, style, name }) =>
  Array.from(
    { length: style.players.max - style.players.min + 1 },
    (_, i) => style.players.min + i,
  ).flatMap((players) => {
    const seats = players + style.computerPlayers;
    // As the lobby offers them: a choice of Seating only with two or more Players.
    const seatings: Seating[] =
      players >= 2 ? ['side-by-side', 'around-the-table'] : ['side-by-side'];
    return seatings.map((seating) => ({
      name: `${name} with ${seats} Seats ${seating}`,
      session: sessionFor(game, style, seating, players),
    }));
  }),
);

/** Checks a screen's frame, and that every named target is large, apart and inside the safe rectangle. */
const checkLayout: Check = (screen, layout, snapshot) => {
  const { canvas, frame, viewport: page } = layout;
  expect(canvas, 'the canvas fills the page').toEqual({ x: 0, y: 0, ...page });
  expect(contains(canvas, frame), `${screen}: frame inside canvas`).toBe(true);
  expect(frame.x + frame.width / 2).toBeCloseTo(canvas.x + canvas.width / 2, 0);
  expect(frame.y + frame.height / 2).toBeCloseTo(canvas.y + canvas.height / 2, 0);
  expect(frame.width / frame.height).toBeCloseTo(DESIGN.width / DESIGN.height, 2);
  expect(
    Math.abs(frame.width - canvas.width) < EPSILON ||
      Math.abs(frame.height - canvas.height) < EPSILON,
    `${screen}: the frame fills the canvas one way`,
  ).toBe(true);
  if (page.width / page.height > DESIGN.width / DESIGN.height + 0.01) {
    expect(layout.canvasPixels.width).toBeGreaterThan(DESIGN.width);
    expect(layout.canvasPixels.height).toBe(DESIGN.height);
  }

  const controls = Object.entries(snapshot.targets);
  for (const [name, target] of controls) {
    expect(contains(frame, target.rect), `${screen}/${name} inside the frame`).toBe(true);
  }
  if (screen === 'start') return; // Its one target is the whole frame: tap anywhere.

  const unit = frame.width / DESIGN.width;
  expect(controls.length, `${screen} has controls`).toBeGreaterThan(0);
  for (const [name, { rect }] of controls) {
    expect(rect.width / unit, `${screen}/${name} width`).toBeGreaterThanOrEqual(MIN_TARGET - 1);
    expect(rect.height / unit, `${screen}/${name} height`).toBeGreaterThanOrEqual(MIN_TARGET - 1);
    expect(contains(layout.safe!, rect), `${screen}/${name} inside the safe rectangle`).toBe(true);
  }
  for (const [i, [a, first]] of controls.entries()) {
    for (const [b, second] of controls.slice(i + 1)) {
      expect(
        gapBetween(first.rect, second.rect) / unit,
        `${screen}: ${a} to ${b}`,
      ).toBeGreaterThanOrEqual(MIN_GAP - 1);
    }
  }
};

for (const [shape, viewport] of Object.entries(shapes)) {
  test.describe(`at ${shape}`, () => {
    test.beforeEach(async ({ page }) => {
      if (viewport) await page.setViewportSize(viewport);
    });

    test('the design frame is fully visible and centred, and every control of every Arcade screen is large, apart and safe', async ({
      arcade,
    }) => {
      test.slow();
      await eachScreen(arcade, checkLayout);
    });

    for (const { name, session } of EVERY_ROUND) {
      test(`every target of ${name} is large, apart and safe`, async ({ arcade }) => {
        await arcade.open();
        await openSession(arcade, session, 1);
        checkLayout(name, await arcade.layout(), await arcade.snapshot());
      });
    }
  });
}

test.describe('at 1376 x 1032 with a device pixel ratio of 2', () => {
  test.use({ viewport: { width: 1376, height: 1032 }, deviceScaleFactor: 2 });

  test('the canvas is exactly 2752 x 2064 pixels', async ({ arcade }) => {
    await arcade.open();
    expect((await arcade.layout()).canvasPixels).toEqual({ width: 2752, height: 2064 });
  });
});

test('the safe rectangle is the design frame less 88 units each side when no inset is reported', async ({
  arcade,
}) => {
  await arcade.open();
  const { frame, safe } = await arcade.layout();
  const unit = frame.width / DESIGN.width;
  expect((safe!.x - frame.x) / unit).toBeCloseTo(88, 0);
  expect((safe!.y - frame.y) / unit).toBeCloseTo(88, 0);
  expect(safe!.width / unit).toBeCloseTo(DESIGN.width - 176, 0);
  expect(safe!.height / unit).toBeCloseTo(DESIGN.height - 176, 0);
});

/**
 * When an installed iPad app turns from landscape to portrait, the window reports its new size
 * before the Arcade's box has taken it (device checklist items 13 and 14). Phaser measured the old
 * width then, and its own recheck, which runs from its frame loop, never caught up, so the picture
 * stayed zoomed with its corners cut off.
 */
test.describe('when the window turns before the Arcade’s box does, as an installed iPad app’s does', () => {
  test.use({ viewport: { width: 1376, height: 1000 } });

  /** Where the screen is turned from, and the named targets there. */
  const FROM = {
    'the Home Screen': {
      reach: async () => undefined,
      targets: async (arcade: Arcade) => (await arcade.snapshot()).targets,
    },
    'a Round': {
      reach: async (arcade: Arcade) => {
        const { game, style } = EVERY_STYLE[0]!;
        await openSession(arcade, sessionFor(game, style), 1);
      },
      targets: async (arcade: Arcade) => (await arcade.round())!.targets,
    },
  };

  for (const [from, { reach, targets }] of Object.entries(FROM)) {
    test(`from ${from}, the canvas follows the box once the box takes its new size, without waiting on Phaser’s frame loop, and every named target stays inside it`, async ({
      arcade,
      page,
    }) => {
      await arcade.open();
      await arcade.start();
      await reach(arcade);
      // Stop Phaser's frame loop for good (an exception in an update does that), so its own recheck
      // of the box cannot run and only the Arcade's following of the box can resize the canvas.
      await arcade.call('throwInUpdate');
      await expect(page.locator('#error-screen')).toBeVisible();

      // The box keeps its landscape width while the window turns to portrait, then takes the new one.
      await page.evaluate(() => {
        const box = document.getElementById('arcade')!;
        box.style.right = 'auto';
        box.style.width = '1376px';
      });
      await page.setViewportSize({ width: 1032, height: 1344 });
      // As on the iPad: Phaser has sized the canvas from the box while the box was still too wide.
      await expect
        .poll(() =>
          page.evaluate(() => {
            const canvas = document.querySelector('#arcade canvas')!.getBoundingClientRect();
            return [Math.round(canvas.width), Math.round(canvas.height)];
          }),
        )
        .toEqual([1376, 1344]);
      await page.evaluate(() => {
        const box = document.getElementById('arcade')!;
        box.style.right = '';
        box.style.width = '';
      });

      const canvasFitsBox = () =>
        page.evaluate((epsilon) => {
          const element = document.querySelector('#arcade canvas') as HTMLCanvasElement;
          const canvas = element.getBoundingClientRect();
          const box = document.getElementById('arcade')!.getBoundingClientRect();
          return (
            box.width === 1032 &&
            Math.abs(canvas.width - box.width) <= epsilon &&
            Math.abs(canvas.height - box.height) <= epsilon &&
            // Expanded downwards: the design frame's full width across a portrait screen.
            element.width === 2752
          );
        }, EPSILON);
      await expect.poll(canvasFitsBox, { timeout: 5000 }).toBe(true);
      const { canvas } = await arcade.layout();
      for (const [name, target] of Object.entries(await targets(arcade))) {
        expect(contains(canvas, target.rect), `${name} inside the visible canvas`).toBe(true);
      }
    });
  }
});
