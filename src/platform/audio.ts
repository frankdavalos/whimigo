import type * as Phaser from 'phaser';
import type { SoundRecipe } from '@/contract';
import { onPageHidden, type Unsubscribe } from './lifecycle';
import { renderRecipe, validateRecipe } from './synth';

/**
 * Whether sound can play, as the audio context reports it. `locked` until the context has run
 * once, since browsers keep audio silent until a real tap; `interrupted` is iPadOS taking sound
 * away, for a call or an alarm; `off` when there is no Web Audio at all.
 */
export type AudioState = 'off' | 'locked' | 'running' | 'suspended' | 'interrupted';

/**
 * How rendered sounds reach the speaker. Phaser 4.2.1 accepts a ready-made buffer in its audio
 * cache, so its own Web Audio sound manager plays them (ADR-0014); `none` when sound is off.
 */
export type PlaybackRoute = 'phaser-sound-manager' | 'none';

/** The parts of Phaser's Web Audio sound manager and audio cache that the platform uses. */
export interface PhaserAudio {
  readonly manager: Pick<
    Phaser.Sound.WebAudioSoundManager,
    'context' | 'add' | 'removeByKey' | 'gameLostFocus'
  >;
  readonly cache: Pick<Phaser.Cache.BaseCache, 'add' | 'remove'>;
}

/**
 * Sound, on Phaser's own audio context. Nothing here ever waits, and nothing throws on play.
 *
 * While the page is hidden sound is suspended. Any tap starts it, or brings it back after the page
 * was hidden or the tablet interrupted it, because a real tap is what browsers require. Phaser may
 * also resume it on its own when the page is shown or the window regains focus.
 */
export interface Audio {
  readonly route: PlaybackRoute;
  state(): AudioState;
  /** Call from inside a real tap: it is what browsers require before sound may start. */
  unlock(): void;
  /** Calls `listener` with the new state each time the audio context changes state. */
  onStateChange(listener: (state: AudioState) => void): Unsubscribe;
  /** Renders a recipe once and keeps it under `key` until `unload`. Throws if it is not valid. */
  load(key: string, recipe: SoundRecipe): void;
  unload(key: string): void;
  /**
   * Starts a loaded sound and says whether it started. Unless sound is running it returns at
   * once and plays nothing, then or later.
   */
  play(key: string): boolean;
  /** The keys of the loaded sounds playing now. */
  playing(): string[];
}

/** `phaser` is null when Phaser has no Web Audio sound manager: sound is then off. */
export function createAudio(doc: Document, phaser: PhaserAudio | null): Audio {
  const context = phaser?.manager.context ?? null;
  const sounds = new Map<string, Phaser.Sound.BaseSound>();
  const listeners = new Set<(state: AudioState) => void>();
  let unlocked = false;

  const state = (): AudioState => {
    if (!context || context.state === 'closed') return 'off';
    if (context.state === 'running') unlocked = true;
    if (!unlocked) return 'locked';
    return context.state;
  };

  const unlock = () => {
    if (!phaser || !context || doc.visibilityState === 'hidden') return;
    phaser.manager.gameLostFocus = false;
    // A refusal leaves sound as it was; it is not an error worth stopping the Arcade for.
    if (context.state !== 'running') context.resume().catch(() => undefined);
  };

  if (phaser && context) {
    context.addEventListener('statechange', () => {
      const now = state();
      for (const listener of listeners) listener(now);
    });
    onPageHidden(doc, () => {
      // Phaser resumes a suspended context on every frame unless it thinks the game lost focus.
      // A hidden page has, until a tap or the window regaining focus says otherwise.
      phaser.manager.gameLostFocus = true;
      context.suspend().catch(() => undefined);
    });
    // In the capture phase, so that no screen can keep a tap from it.
    for (const type of ['touchend', 'pointerup']) {
      doc.addEventListener(type, unlock, { capture: true });
    }
  }

  return {
    route: phaser ? 'phaser-sound-manager' : 'none',
    state,
    unlock,
    onStateChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load(key, recipe) {
      const problems = validateRecipe(recipe);
      if (problems.length > 0) throw new Error(`Sound "${key}": ${problems.join('; ')}`);
      if (!phaser || !context) return;
      const samples = renderRecipe(recipe, context.sampleRate);
      const buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.copyToChannel(samples, 0);
      phaser.cache.add(key, buffer);
      sounds.set(key, phaser.manager.add(key));
    },
    unload(key) {
      if (!phaser) return;
      phaser.manager.removeByKey(key);
      phaser.cache.remove(key);
      sounds.delete(key);
    },
    play(key) {
      const sound = sounds.get(key);
      if (!sound || state() !== 'running') return false;
      sound.play();
      return sound.isPlaying;
    },
    playing: () => [...sounds].filter(([, sound]) => sound.isPlaying).map(([key]) => key),
  };
}
