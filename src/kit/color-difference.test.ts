import { describe, expect, it } from 'vitest';
import { ciede2000, colorDifference, simulate, type Lab } from './color-difference';

describe('CIEDE2000', () => {
  // Pairs from Sharma, Wu and Dalal (2005), "The CIEDE2000 color-difference formula", Table 1.
  const PAIRS: [Lab, Lab, number][] = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
    [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  ];
  for (const [a, b, expected] of PAIRS) {
    it(`gives ${expected} between L*a*b* ${a.join(', ')} and ${b.join(', ')}`, () => {
      expect(ciede2000(a, b)).toBeCloseTo(expected, 3);
      expect(ciede2000(b, a)).toBeCloseTo(expected, 3);
    });
  }
});

describe('simulated colour vision', () => {
  it('leaves colours unchanged in ordinary vision', () => {
    expect(simulate(0x3a86e0, 'ordinary')).toBe(0x3a86e0);
  });

  it('leaves greys unchanged under every deficiency', () => {
    for (const vision of ['protanopia', 'deuteranopia', 'tritanopia'] as const) {
      expect(simulate(0x808080, vision)).toBe(0x808080);
    }
  });

  it('makes red and green that differ by lightness alone nearly the same under deuteranopia', () => {
    // A red and a green chosen to be confused by red-green colour blindness.
    expect(colorDifference(0xb35900, 0x6b7a00, 'ordinary')).toBeGreaterThan(15);
    expect(colorDifference(0xb35900, 0x6b7a00, 'deuteranopia')).toBeLessThan(
      colorDifference(0xb35900, 0x6b7a00, 'ordinary') / 2,
    );
  });
});
