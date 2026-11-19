/** Stops a handler being called. */
export type Unsubscribe = () => void;

function onVisibility(doc: Document, visible: boolean, handler: () => void): Unsubscribe {
  const listener = () => {
    if ((doc.visibilityState === 'visible') === visible) handler();
  };
  doc.addEventListener('visibilitychange', listener);
  return () => doc.removeEventListener('visibilitychange', listener);
}

/**
 * Calls `handler` each time the page is hidden: by the home gesture, an app switch or the screen
 * locking. The tablet may freeze or close the page soon after, so this is when to fall quiet.
 */
export function onPageHidden(doc: Document, handler: () => void): Unsubscribe {
  return onVisibility(doc, false, handler);
}

/**
 * Calls `handler` each time the page becomes visible again after being hidden. Touches that were
 * down when the page was hidden may never be reported lifting, so this is when they are forgotten.
 */
export function onPageShown(doc: Document, handler: () => void): Unsubscribe {
  return onVisibility(doc, true, handler);
}
