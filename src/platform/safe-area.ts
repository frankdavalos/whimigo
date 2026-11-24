/** The safe-area insets the browser reports, in CSS pixels. */
export interface SafeAreaInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

const PROBE_ID = 'safe-area-probe';

/**
 * Reads `env(safe-area-inset-*)`, which needs `viewport-fit=cover` in the viewport meta tag. The
 * hidden element it measures is added on the first reading and kept, so no element is added to the
 * page while a Round plays (story 33 AC6).
 */
export function readSafeAreaInsets(doc: Document): SafeAreaInsets {
  let probe = doc.getElementById(PROBE_ID);
  if (!probe) {
    probe = doc.createElement('div');
    probe.id = PROBE_ID;
    probe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) ' +
      'env(safe-area-inset-bottom) env(safe-area-inset-left)';
    doc.body.append(probe);
  }
  const style = getComputedStyle(probe);
  const insets = {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };
  return insets;
}
