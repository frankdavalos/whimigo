/**
 * Page-level touch hygiene that CSS alone does not cover (the CSS is in index.html, so it applies
 * even if script fails). Together they stop pinch and double-tap zoom, text selection, the
 * long-press callout and the context menu.
 */
export function guardPage(doc: Document): void {
  const prevent = (event: Event) => event.preventDefault();
  doc.addEventListener('contextmenu', prevent);
  doc.addEventListener('selectstart', prevent);
  doc.addEventListener('dragstart', prevent);
  // Safari's own pinch events, which it raises even where touch-action is none.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    doc.addEventListener(type, prevent);
  }
  // Any multi-finger move that reaches the page would be a pinch or a scroll.
  doc.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) event.preventDefault();
    },
    { passive: false },
  );
}
