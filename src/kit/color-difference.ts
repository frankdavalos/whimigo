/**
 * How different two theme colours look, to ordinary vision and to the three common colour-vision
 * deficiencies, for the test that keeps the Seat colours apart. Pure, and used only by tests.
 */

/** A colour in CIE L*a*b*. */
export type Lab = readonly [number, number, number];

export type Vision = 'ordinary' | 'protanopia' | 'deuteranopia' | 'tritanopia';

/**
 * Machado, Oliveira and Fernandes (2009), severity 1.0: each deficiency as a matrix applied to
 * linear RGB.
 */
const DEFICIENCY: Readonly<Record<Exclude<Vision, 'ordinary'>, readonly number[][]>> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

const toLinear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const toByte = (linear: number) => {
  const c = Math.min(1, Math.max(0, linear));
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(s * 255);
};
const linearOf = (color: number) =>
  [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff].map(toLinear);

/** A 0xRRGGBB colour as it looks with `vision`. */
export function simulate(color: number, vision: Vision): number {
  if (vision === 'ordinary') return color;
  const rgb = linearOf(color);
  const [r, g, b] = DEFICIENCY[vision].map((row) =>
    toByte(row[0]! * rgb[0]! + row[1]! * rgb[1]! + row[2]! * rgb[2]!),
  );
  return (r! << 16) | (g! << 8) | b!;
}

/** A 0xRRGGBB sRGB colour in CIE L*a*b*, D65 white. */
export function labOf(color: number): Lab {
  const [r, g, b] = linearOf(color) as [number, number, number];
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const RAD = Math.PI / 180;

/** The CIEDE2000 colour difference between two L*a*b* colours. */
export function ciede2000([l1, a1, b1]: Lab, [l2, a2, b2]: Lab): number {
  const meanC = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const g = 0.5 * (1 - Math.sqrt(meanC ** 7 / (meanC ** 7 + 25 ** 7)));
  const ap1 = (1 + g) * a1;
  const ap2 = (1 + g) * a2;
  const c1 = Math.hypot(ap1, b1);
  const c2 = Math.hypot(ap2, b2);
  const hue = (a: number, b: number) => {
    if (a === 0 && b === 0) return 0;
    const h = Math.atan2(b, a) / RAD;
    return h < 0 ? h + 360 : h;
  };
  const h1 = hue(ap1, b1);
  const h2 = hue(ap2, b2);

  const dL = l2 - l1;
  const dC = c2 - c1;
  let dh = 0;
  if (c1 * c2 !== 0) {
    dh = h2 - h1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(c1 * c2) * Math.sin((dh * RAD) / 2);

  const meanL = (l1 + l2) / 2;
  const meanCp = (c1 + c2) / 2;
  let meanH = h1 + h2;
  if (c1 * c2 !== 0) {
    if (Math.abs(h1 - h2) > 180) meanH += meanH < 360 ? 360 : -360;
    meanH /= 2;
  }
  const t =
    1 -
    0.17 * Math.cos((meanH - 30) * RAD) +
    0.24 * Math.cos(2 * meanH * RAD) +
    0.32 * Math.cos((3 * meanH + 6) * RAD) -
    0.2 * Math.cos((4 * meanH - 63) * RAD);
  const dTheta = 30 * Math.exp(-(((meanH - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(meanCp ** 7 / (meanCp ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (meanL - 50) ** 2) / Math.sqrt(20 + (meanL - 50) ** 2);
  const sc = 1 + 0.045 * meanCp;
  const sh = 1 + 0.015 * meanCp * t;
  const rt = -Math.sin(2 * dTheta * RAD) * rc;
  return Math.sqrt((dL / sl) ** 2 + (dC / sc) ** 2 + (dH / sh) ** 2 + rt * (dC / sc) * (dH / sh));
}

/** How different two 0xRRGGBB colours look with `vision`, in CIEDE2000. */
export const colorDifference = (a: number, b: number, vision: Vision): number =>
  ciede2000(labOf(simulate(a, vision)), labOf(simulate(b, vision)));
