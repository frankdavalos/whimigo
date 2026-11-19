import type * as Phaser from 'phaser';
import { colors, sizes } from '@/kit/theme';

/**
 * Provisional pictures drawn with plain shapes, each centred on (0, 0) and fitting `size`.
 * The asset-build slice replaces them with SVG art from the Arcade's atlas.
 */
export type Picture = (graphics: Phaser.GameObjects.Graphics, size: number) => void;

/** A big round button with a "play" triangle: tap here to begin. */
export const playPicture: Picture = (g, size) => {
  const r = size / 2;
  g.fillStyle(colors.sun).fillCircle(0, 0, r);
  g.lineStyle(sizes.outline * 2, colors.ink).strokeCircle(0, 0, r);
  g.fillStyle(colors.ink).fillTriangle(-r * 0.3, -r * 0.45, -r * 0.3, r * 0.45, r * 0.5, 0);
};

/** A little house: go home. */
export const homePicture: Picture = (g, size) => {
  const s = size * 0.22;
  g.fillStyle(colors.coral).fillTriangle(-s * 1.3, -s * 0.1, s * 1.3, -s * 0.1, 0, -s * 1.3);
  g.fillStyle(colors.sun).fillRect(-s, -s * 0.1, s * 2, s * 1.3);
  g.fillStyle(colors.ink).fillRect(-s * 0.3, s * 0.4, s * 0.6, s * 0.8);
};

/** An empty card: the blank test check. */
export const blankPicture: Picture = (g, size) => {
  const s = size * 0.25;
  g.lineStyle(sizes.outline, colors.ink).strokeRoundedRect(-s, -s, s * 2, s * 2, s * 0.3);
};

/** A friendly sun for the Home Screen's sky. Decoration only. */
export const sunPicture: Picture = (g, size) => {
  const r = size / 2;
  g.fillStyle(colors.sun).fillCircle(0, 0, r * 0.6);
  g.lineStyle(sizes.outline, colors.sun);
  for (let ray = 0; ray < 8; ray++) {
    const angle = (ray * Math.PI) / 4;
    g.lineBetween(
      Math.cos(angle) * r * 0.75,
      Math.sin(angle) * r * 0.75,
      Math.cos(angle) * r,
      Math.sin(angle) * r,
    );
  }
};
