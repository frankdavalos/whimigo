/**
 * Calls `handler` each time the page becomes visible again after being hidden: after the home
 * gesture, an app switch or the screen locking. Touches that were down when the page was hidden
 * may never be reported lifting, so this is when they are forgotten.
 */
export function onPageShown(doc: Document, handler: () => void): void {
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible') handler();
  });
}
