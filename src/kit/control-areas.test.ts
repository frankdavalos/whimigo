import { describe, expect, it } from 'vitest';
import { CONTROL_AREAS, MIN_TOUCH } from './control-areas';
import { sizes } from './theme';

const ASKED = [0, 1, 100, 255, 256, 300, sizes.button, 600];

describe('the kit’s controls', () => {
  it('are button, iconButton, holdButton, panel, seatBadge and turnPointer', () => {
    expect(Object.keys(CONTROL_AREAS).sort()).toEqual(
      ['button', 'holdButton', 'iconButton', 'panel', 'seatBadge', 'turnPointer'].sort(),
    );
  });

  for (const [name, areaOf] of Object.entries(CONTROL_AREAS)) {
    for (const size of ASKED) {
      it(`${name} asked for ${size} units reports a touch rectangle at least ${MIN_TOUCH} square, centred where asked`, () => {
        const centre = { x: 1000, y: 800 };
        const area = areaOf({ ...centre, width: size, height: size });
        expect(area.width).toBeGreaterThanOrEqual(MIN_TOUCH);
        expect(area.height).toBeGreaterThanOrEqual(MIN_TOUCH);
        expect(area.width).toBeGreaterThanOrEqual(size);
        expect(area.x + area.width / 2).toBeCloseTo(centre.x);
        expect(area.y + area.height / 2).toBeCloseTo(centre.y);
      });
    }
  }

  it('makes no touch rectangle smaller than the overview’s minimum of 256', () => {
    expect(MIN_TOUCH).toBe(256);
  });
});
