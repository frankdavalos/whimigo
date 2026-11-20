/** Whether the Arcade was opened from the home screen or is showing in a browser tab. */
export type RunningAs = 'installed' | 'browser-tab';

/** The display modes a manifest can open an installed app in. */
const APP_MODES = ['fullscreen', 'standalone', 'minimal-ui'];

/**
 * How the page is showing: the `display-mode` media query, and on iPadOS, whose installed web apps
 * may not match it, `navigator.standalone`.
 */
export function runningAs(win: Window): RunningAs {
  const standalone = (win.navigator as { standalone?: boolean }).standalone === true;
  const inAppMode = APP_MODES.some((mode) => win.matchMedia(`(display-mode: ${mode})`).matches);
  return standalone || inAppMode ? 'installed' : 'browser-tab';
}
