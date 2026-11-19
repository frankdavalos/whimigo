/**
 * The fatal error screen: plain HTML, so it works when Phaser or WebGL has failed. Its markup is
 * in index.html; this shows it on any uncaught exception or unhandled promise rejection, and its
 * one button reloads the page.
 */
export function installErrorScreen(win: Window, screen: HTMLElement): void {
  const button = screen.querySelector('button');
  const show = () => {
    if (!screen.hidden) return;
    screen.hidden = false;
    button?.focus();
  };
  win.addEventListener('error', show);
  win.addEventListener('unhandledrejection', show);
  button?.addEventListener('click', () => win.location.reload());
}
