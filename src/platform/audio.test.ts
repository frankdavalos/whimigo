import { describe, expect, it } from 'vitest';
import type { SoundRecipe } from '@/contract';
import { createAudio, type PhaserAudio } from './audio';
import { renderRecipe } from './synth';

const beep: SoundRecipe = { notes: [{ wave: 'sine', from: 440, at: 0, for: 100 }] };

/** Just enough of a document: its visibility, the event that says it changed, and taps. */
function fakeDocument() {
  const doc = Object.assign(new EventTarget(), {
    visibilityState: 'visible' as DocumentVisibilityState,
  });
  return {
    doc: doc as unknown as Document,
    become(state: DocumentVisibilityState) {
      doc.visibilityState = state;
      doc.dispatchEvent(new Event('visibilitychange'));
    },
    tap: () => doc.dispatchEvent(new Event('touchend')),
  };
}

/**
 * Stands in for Web Audio and the parts of Phaser's sound manager the platform uses. The context
 * changes state at once, as a browser does when its promise settles; `allowed` says whether the
 * browser would let it resume.
 */
function fakePhaser() {
  const context = Object.assign(new EventTarget(), {
    state: 'suspended' as AudioContextState,
    sampleRate: 48_000,
    allowed: true,
    to(state: AudioContextState) {
      context.state = state;
      context.dispatchEvent(new Event('statechange'));
    },
    resume() {
      if (context.allowed) context.to('running');
      return Promise.resolve();
    },
    suspend() {
      context.to('suspended');
      return Promise.resolve();
    },
    createBuffer: (_channels: number, length: number, sampleRate: number) => ({
      length,
      sampleRate,
      samples: null as Float32Array | null,
      copyToChannel(samples: Float32Array) {
        this.samples = samples;
      },
    }),
  });
  const cache = new Map<string, unknown>();
  const started: string[] = [];
  const sounds = new Map<string, { isPlaying: boolean }>();
  const manager = {
    context,
    gameLostFocus: false,
    add(key: string) {
      if (!cache.has(key)) throw new Error(`Audio key "${key}" not found in cache`);
      const sound = {
        isPlaying: false,
        play() {
          started.push(key);
          sound.isPlaying = true;
          return true;
        },
      };
      sounds.set(key, sound);
      return sound;
    },
    removeByKey(key: string) {
      sounds.delete(key);
      return 1;
    },
  };
  const phaser = {
    manager,
    cache: {
      add: (key: string, value: unknown) => cache.set(key, value),
      remove: cache.delete.bind(cache),
    },
  } as unknown as PhaserAudio;
  return { phaser, context, manager, cache, sounds, started };
}

describe('the audio service', () => {
  it('renders a loaded recipe into a buffer in Phaser’s audio cache, at the context’s sample rate', () => {
    const { phaser, cache } = fakePhaser();
    const audio = createAudio(fakeDocument().doc, phaser);
    audio.load('check/beep', beep);
    const buffer = cache.get('check/beep') as { sampleRate: number; samples: Float32Array };
    expect(buffer.sampleRate).toBe(48_000);
    expect(buffer.samples).toEqual(renderRecipe(beep, 48_000));
  });

  it('refuses to load a recipe that does not validate, naming the note', () => {
    const { phaser, cache } = fakePhaser();
    const audio = createAudio(fakeDocument().doc, phaser);
    expect(() =>
      audio.load('check/bad', { notes: [{ wave: 'sine', from: 440, at: 0, for: 0 }] }),
    ).toThrow(/check\/bad.*note 0/);
    expect(cache.size).toBe(0);
  });

  it('removes an unloaded sound from the cache and from Phaser’s sound manager', () => {
    const { phaser, cache, sounds } = fakePhaser();
    const audio = createAudio(fakeDocument().doc, phaser);
    audio.load('check/beep', beep);
    audio.unload('check/beep');
    expect(cache.size).toBe(0);
    expect(sounds.size).toBe(0);
  });

  it('is locked until the context first runs, and a request meanwhile plays nothing, even later', async () => {
    const { phaser, context, started } = fakePhaser();
    const audio = createAudio(fakeDocument().doc, phaser);
    audio.load('check/beep', beep);
    expect(audio.state()).toBe('locked');
    expect(audio.play('check/beep')).toBe(false);
    audio.unlock();
    await Promise.resolve();
    expect(context.state).toBe('running');
    expect(audio.state()).toBe('running');
    expect(started).toEqual([]);
  });

  it('plays a loaded sound through Phaser’s sound manager once running', () => {
    const { phaser, started } = fakePhaser();
    const audio = createAudio(fakeDocument().doc, phaser);
    audio.load('check/beep', beep);
    audio.unlock();
    expect(audio.route).toBe('phaser-sound-manager');
    expect(audio.play('check/beep')).toBe(true);
    expect(started).toEqual(['check/beep']);
    expect(audio.playing()).toEqual(['check/beep']);
    expect(audio.play('check/never-loaded')).toBe(false);
  });

  it('is off, and plays nothing, without Phaser’s Web Audio', () => {
    const audio = createAudio(fakeDocument().doc, null);
    expect(audio.state()).toBe('off');
    expect(audio.route).toBe('none');
    audio.load('check/beep', beep);
    audio.unlock();
    expect(audio.play('check/beep')).toBe(false);
    expect(audio.playing()).toEqual([]);
  });
});
