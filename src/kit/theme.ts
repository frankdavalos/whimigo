/**
 * Provisional tokens until the style guide (Phase 1). Screens use these, not literal values.
 */
export const colors = {
  sky: 0x9ad8f5,
  meadow: 0xb8e6a7,
  sun: 0xffc94a,
  cream: 0xfff6e0,
  coral: 0xff8a73,
  lilac: 0xc9b8f0,
  ink: 0x2f3a56,
} as const;

/** Sizes in design units (overview, Visual system). */
export const sizes = {
  /** The standard control. Nothing a child touches may be smaller than 256 square. */
  button: 344,
  /** The least space between two controls. */
  gap: 64,
  /** Outline width for drawn pictures. */
  outline: 16,
} as const;

export const cssColor = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/**
 * Each Seat's colour and shape, in Seat order. The shapes are final; the colours are provisional
 * until the Phase 1 style guide chooses four that stay distinct under colour blindness. A colour
 * is never shown without its shape.
 */
export const seats = [
  { color: 0x3b8fd9, shape: 'arcade/seat-circle' },
  { color: 0xf2a13a, shape: 'arcade/seat-square' },
  { color: 0x2fae8a, shape: 'arcade/seat-triangle' },
  { color: 0xc56fb0, shape: 'arcade/seat-star' },
] as const;
