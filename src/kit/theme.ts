/**
 * Provisional tokens until the style guide (Phase 1). Screens use these, not literal values.
 */
export const colors = {
  sky: 0x9ad8f5,
  meadow: 0xb8e6a7,
  sun: 0xffc94a,
  cream: 0xfff6e0,
  coral: 0xff8a73,
  ink: 0x2f3a56,
} as const;

/** Sizes in design units (overview, Visual system). */
export const sizes = {
  /** Nothing a child touches is smaller than this, square. */
  minTarget: 256,
  /** The standard control. */
  button: 344,
  /** The least space between two controls. */
  gap: 64,
  /** Outline width for drawn pictures. */
  outline: 16,
} as const;

export const cssColor = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
