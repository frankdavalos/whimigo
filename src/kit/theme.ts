/**
 * The palette: every colour the Arcade and its Games draw with, in code and in SVG
 * (docs/design/style-guide.md). Screens and Games use these names, not literal values; a test
 * holds every SVG to them.
 */
export const colors = {
  /** Outlines, features, digits. Never a fill for something large. */
  ink: 0x2f3a56,
  /** Paper: faces of controls, panels, highlights on faces. */
  cream: 0xfff6e0,
  /** Shine and the whites of eyes. */
  white: 0xffffff,
  /** The rim of a control's face. */
  sand: 0xf2dfb4,
  /** Greys: fur, what is switched off. */
  mist: 0x9aa3b5,
  // Backdrops, and the pale form of a colour.
  sky: 0x9ad8f5,
  meadow: 0xb8e6a7,
  lilac: 0xc9b8f0,
  blush: 0xf6b8c6,
  butter: 0xfff0b0,
  // Accents.
  sun: 0xffc94a,
  coral: 0xff8a73,
  orange: 0xf28c3a,
  leaf: 0x6cc26a,
  pink: 0xe0609e,
  violet: 0x8a6ad8,
  bark: 0x8a5a3c,
  tan: 0xc99872,
  // The four Seat colours, also used as the strong form of blue, yellow, red and aqua.
  blue: 0x2f5bd3,
  yellow: 0xffd84a,
  red: 0xd23c46,
  aqua: 0x4fd0e0,
} as const;

/** Sizes in design units (overview, Visual system). */
export const sizes = {
  /** The standard control. Nothing a child touches may be smaller than 256 square. */
  button: 344,
  /** The least space between two controls. */
  gap: 64,
  /** Outline width for drawn pictures. */
  outline: 16,
  /** Corner radius of a control's face and of a panel. */
  corner: 48,
} as const;

export const cssColor = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/**
 * Each Seat's colour and shape, in Seat order. The colours stay more than
 * SEAT_COLOR_DIFFERENCE apart (CIEDE2000) in ordinary vision and under simulated protanopia,
 * deuteranopia and tritanopia. A colour is never shown without its shape.
 */
export const seats = [
  { color: colors.blue, shape: 'arcade/seat-circle' },
  { color: colors.yellow, shape: 'arcade/seat-square' },
  { color: colors.red, shape: 'arcade/seat-triangle' },
  { color: colors.aqua, shape: 'arcade/seat-star' },
] as const;

/** The least CIEDE2000 difference between any two Seat colours, with any colour vision. */
export const SEAT_COLOR_DIFFERENCE = 20;
