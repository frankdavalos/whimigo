import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PADS } from '../src/games/color-echo/pads';
import { DECOY_KINDS } from '../src/games/reaction-rush/logic/rules';
import { DECOYS, SIGNAL } from '../src/games/reaction-rush/pictures';
import { cssColor, seats } from '../src/kit/theme';

const root = fileURLToPath(new URL('..', import.meta.url));

/** The SVG source of a Game's frame, `<game>/<name>`, from that Game's art folder. */
const source = (frame: string) => {
  const [game, name] = frame.split('/');
  return readFile(`${root}src/games/${game}/art/${name}.svg`, 'utf8');
};

/**
 * Pictures a Player must tell apart, each with the frame it is drawn as and the colour it shows. A
 * Color Echo pad not lit is drawn in the pale form of its colour; lit, in the colour itself.
 */
const SHOWN: Record<string, readonly { frame: string; color: number }[]> = {
  'Color Echo’s pads, lit': PADS.map(({ litFrame, color }) => ({ frame: litFrame, color })),
  'Reaction Rush’s signal and decoys': [SIGNAL, ...DECOYS],
};

describe('pictures as well as colours (story 14)', () => {
  const apart = { ...SHOWN, 'Color Echo’s pads, not lit': PADS };
  for (const [name, pictures] of Object.entries(apart)) {
    it(`${name} each have their own frame and their own colour, none of them a Seat colour`, () => {
      expect(new Set(pictures.map((picture) => picture.frame)).size).toBe(pictures.length);
      expect(new Set(pictures.map((picture) => picture.color)).size).toBe(pictures.length);
      for (const { color } of pictures) {
        expect(seats.map((seat) => seat.color)).not.toContain(color);
      }
    });
  }

  for (const [name, pictures] of Object.entries(SHOWN)) {
    it(`${name} are each drawn in the colour they show`, async () => {
      for (const { frame, color } of pictures) {
        expect((await source(frame)).toLowerCase(), frame).toContain(cssColor(color));
      }
    });
  }

  it('Reaction Rush has a picture for every kind of decoy its rules show', () => {
    expect(DECOYS).toHaveLength(DECOY_KINDS);
  });
});
