/** The part of `window` that says what motion the device asks for. */
export interface MotionQuery {
  readonly matchMedia?: (query: string) => { readonly matches: boolean };
}

/** True when the device asks for reduced motion. Asked afresh each time, so a change applies. */
export function prefersReducedMotion(win: MotionQuery): boolean {
  return win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
