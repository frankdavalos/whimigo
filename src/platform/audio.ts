/** Whether sound can play yet. Browsers keep audio silent until a real tap. */
export type AudioState = 'locked' | 'running';

/** The one audio context, shared with Phaser's sound manager. */
export interface Audio {
  readonly context: AudioContext | null;
  state(): AudioState;
  /** Call from inside a real tap: it is what browsers require before sound may start. */
  unlock(): void;
}

export function createAudio(win: Window & typeof globalThis): Audio {
  const context = typeof win.AudioContext === 'function' ? new win.AudioContext() : null;
  return {
    context,
    state: () => (context?.state === 'running' ? 'running' : 'locked'),
    unlock() {
      // A refusal leaves sound locked; it is not an error worth stopping the Arcade for.
      context?.resume().catch(() => undefined);
    },
  };
}
