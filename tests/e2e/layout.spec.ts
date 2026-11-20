import type { Rect } from '../../src/contract';
import { type Arcade, OTHER_VIEWPORTS, expect, test } from './arcade';

const DESIGN = { width: 2752, height: 2064 };
const MIN_TARGET = 256;
const MIN_GAP = 64;
/** Rounding between canvas pixels and CSS pixels, in CSS pixels. */
const EPSILON = 0.75;

const shapes = { 'this project’s viewport': null, ...OTHER_VIEWPORTS };

const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x - EPSILON &&
  inner.y >= outer.y - EPSILON &&
  inner.x + inner.width <= outer.x + outer.width + EPSILON &&
  inner.y + inner.height <= outer.y + outer.height + EPSILON;

const gapBetween = (a: Rect, b: Rect) =>
  Math.max(
    b.x - (a.x + a.width),
    a.x - (b.x + b.width),
    b.y - (a.y + a.height),
    a.y - (b.y + b.height),
  );

/** Visits every screen and hands each one's layout and snapshot to `check`. */
async function eachScreen(
  arcade: Arcade,
  check: (
    screen: string,
    layout: Awaited<ReturnType<Arcade['layout']>>,
    snapshot: Awaited<ReturnType<Arcade['snapshot']>>,
  ) => void,
) {
  await arcade.open();
  check('start', await arcade.layout(), await arcade.snapshot());
  await arcade.start();
  check('home', await arcade.layout(), await arcade.snapshot());
  const checks = await arcade.checks();
  for (const id of checks) {
    await arcade.call('openCheck', id);
    await expect.poll(() => arcade.screen()).toBe(id);
    check(id, await arcade.layout(), await arcade.snapshot());
  }
}

for (const [shape, viewport] of Object.entries(shapes)) {
  test.describe(`at ${shape}`, () => {
    test.beforeEach(async ({ page }) => {
      if (viewport) await page.setViewportSize(viewport);
    });

    test('the design frame is fully visible and centred, and every control is large, apart and safe', async ({
      arcade,
    }) => {
      await eachScreen(arcade, (screen, layout, snapshot) => {
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
          expect(rect.width / unit, `${screen}/${name} width`).toBeGreaterThanOrEqual(
            MIN_TARGET - 1,
          );
          expect(rect.height / unit, `${screen}/${name} height`).toBeGreaterThanOrEqual(
            MIN_TARGET - 1,
          );
          expect(contains(layout.safe!, rect), `${screen}/${name} inside the safe rectangle`).toBe(
            true,
          );
        }
        for (const [i, [a, first]] of controls.entries()) {
          for (const [b, second] of controls.slice(i + 1)) {
            expect(
              gapBetween(first.rect, second.rect) / unit,
              `${screen}: ${a} to ${b}`,
            ).toBeGreaterThanOrEqual(MIN_GAP - 1);
          }
        }
      });
    });
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
