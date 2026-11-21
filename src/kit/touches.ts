import type * as Phaser from 'phaser';

/** The game event that says every touch was forgotten. */
const TOUCHES_RESET = 'whimigo-touches-reset';

/**
 * Forgets every touch Phaser is tracking, then tells the running screen. Called when the page is
 * shown again: a touch that was down when it was hidden may never be reported lifting, and would
 * otherwise keep one of the ten touch slots, and its Seat, for ever.
 */
export function resetTouches(game: Phaser.Game): void {
  for (const pointer of game.input.pointers) pointer.reset();
  game.events.emit(TOUCHES_RESET);
}

/**
 * Calls `handler` whenever the Scene's touches must be forgotten, for as long as the Scene runs:
 * every touch was reset, or the Scene resumes after a pause, during which it heard no touch lift.
 */
export function onTouchesReset(scene: Phaser.Scene, handler: () => void): void {
  const events = scene.game.events;
  events.on(TOUCHES_RESET, handler);
  scene.events.on('resume', handler);
  scene.events.once('shutdown', () => {
    events.off(TOUCHES_RESET, handler);
    scene.events.off('resume', handler);
  });
}
