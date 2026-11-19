import { describe, expect, it } from 'vitest';
import { PAGE_LIMIT, frameTable, planAtlas, type PlacedFrame, type Source } from './atlas';

const svg = (width: number, height: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}"/></svg>`;

const source = (name: string, width: number, height: number): Source => ({
  name,
  svg: svg(width, height),
});

/** Frames of many sizes, the way a Game's art will be. */
const assorted = Array.from({ length: 40 }, (_, index) =>
  source(`frame-${index}`, 120 + ((index * 97) % 600), 100 + ((index * 61) % 500)),
);

/** Space kept clear between frames, so filtering never mixes one frame's pixels into another. */
const apart = (a: PlacedFrame, b: PlacedFrame) =>
  a.x + a.width + 2 <= b.x ||
  b.x + b.width + 2 <= a.x ||
  a.y + a.height + 2 <= b.y ||
  b.y + b.height + 2 <= a.y;

describe('planning a set’s atlas', () => {
  it('makes every source a frame keyed by the set’s id, at its size in design units', () => {
    const plan = planAtlas('fox', [source('board', 900, 700), source('pieces/red', 256, 256)]);
    expect(plan.frames.map(({ key, width, height }) => ({ key, width, height }))).toEqual(
      expect.arrayContaining([
        { key: 'fox/board', width: 900, height: 700 },
        { key: 'fox/pieces/red', width: 256, height: 256 },
      ]),
    );
    expect(plan.frames).toHaveLength(2);
  });

  it('places frames on one page of at most 4096 x 4096, apart from one another', () => {
    const plan = planAtlas('fox', assorted);
    expect(PAGE_LIMIT).toBe(4096);
    expect(plan.width).toBeLessThanOrEqual(PAGE_LIMIT);
    expect(plan.height).toBeLessThanOrEqual(PAGE_LIMIT);
    for (const [index, frame] of plan.frames.entries()) {
      expect(frame.x).toBeGreaterThanOrEqual(0);
      expect(frame.y).toBeGreaterThanOrEqual(0);
      expect(frame.x + frame.width).toBeLessThanOrEqual(plan.width);
      expect(frame.y + frame.height).toBeLessThanOrEqual(plan.height);
      for (const other of plan.frames.slice(index + 1)) {
        expect(apart(frame, other), `${frame.key} and ${other.key}`).toBe(true);
      }
    }
  });

  it('fails, naming the set, when the set would need a second page', () => {
    const oversized = Array.from({ length: 5 }, (_, index) => source(`wall-${index}`, 2000, 2000));
    expect(() => planAtlas('too-big', oversized)).toThrow(
      /"too-big" does not fit one 4096 × 4096 atlas page/,
    );
  });

  it('fails, naming the set and the source, when one frame is larger than a page', () => {
    expect(() => planAtlas('wide', [source('banner', 4200, 300)])).toThrow(
      /"wide" does not fit one 4096 × 4096 atlas page: "banner" is 4200 × 300/,
    );
  });

  it('gives the same frame table, byte for byte, from the same sources in any order', () => {
    // Equal sizes everywhere, so only the frames' names can decide their order.
    const twins = Array.from({ length: 12 }, (_, index) => source(`twin-${index}`, 300, 300));
    const sets = [assorted, [...assorted].reverse(), twins, [...twins].reverse()];
    const [first, reversed, twinsFirst, twinsReversed] = sets.map((sources) =>
      frameTable(planAtlas('fox', sources), 'fox.png'),
    );
    expect(reversed).toBe(first);
    expect(twinsReversed).toBe(twinsFirst);
  });

  it('refuses a source whose size is not a whole number of design units', () => {
    const bad = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm"/>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="10.5" height="10"/>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="10"/>',
    ];
    for (const text of bad) {
      expect(() => planAtlas('fox', [{ name: 'odd', svg: text }]), text).toThrow(
        /"fox\/odd" needs whole-number width and height attributes, in design units/,
      );
    }
  });
});

describe('the frame table', () => {
  it('is a Phaser JSON hash atlas naming the page image, with every frame untrimmed', () => {
    const plan = planAtlas('fox', [source('board', 900, 700)]);
    const table = JSON.parse(frameTable(plan, 'fox.png')) as unknown;
    const [frame] = plan.frames;
    expect(table).toEqual({
      frames: {
        'fox/board': {
          frame: { x: frame!.x, y: frame!.y, w: 900, h: 700 },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: 900, h: 700 },
          sourceSize: { w: 900, h: 700 },
        },
      },
      meta: {
        image: 'fox.png',
        size: { w: plan.width, h: plan.height },
        scale: 1,
      },
    });
  });
});
