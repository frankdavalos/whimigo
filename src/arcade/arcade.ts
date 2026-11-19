import type * as Phaser from 'phaser';
import type { Audio } from '@/platform/audio';
import type { SafeAreaInsets } from '@/platform/safe-area';
import type { ArcadeScreen, CheckScreen, ScreenData, ScreenId } from './screen';
import { HomeScreen } from './home-screen';
import { StartScreen } from './start-screen';

export interface ArcadeServices {
  readonly audio: Audio;
  readonly safeAreaInsets: () => SafeAreaInsets;
}

/**
 * Moves between the Arcade's screens. Exactly one screen's Scene runs at a time, so exactly one
 * Scene accepts input (ADR-0004). Check screens are added when opened and removed when left, the
 * way a Game's Scene will be.
 */
export class Arcade {
  private started: ScreenId | null = null;
  private showing: ArcadeScreen | null = null;

  constructor(
    readonly game: Phaser.Game,
    readonly services: ArcadeServices,
    readonly checks: readonly CheckScreen[],
  ) {
    game.scene.add('start', StartScreen);
    game.scene.add('home', HomeScreen);
  }

  /** The screen on show, once its Scene has been created. */
  get screen(): ArcadeScreen | null {
    return this.showing;
  }

  /** Changes screen at the start of the next frame, when no Scene is being processed. */
  show(id: ScreenId): void {
    const check = this.checks.find((candidate) => candidate.id === id);
    if (!check && id !== 'start' && id !== 'home') throw new Error(`No screen "${id}"`);
    this.game.events.once('prestep', () => {
      const scenes = this.game.scene;
      if (this.started) {
        scenes.stop(this.started);
        if (this.checks.some((candidate) => candidate.id === this.started)) {
          scenes.remove(this.started);
        }
      }
      this.showing = null;
      this.started = id;
      const data: ScreenData = { arcade: this };
      if (check) scenes.add(id, check.scene, true, data);
      else scenes.start(id, data);
    });
  }

  /** Called by each screen at the end of its create(). */
  shown(screen: ArcadeScreen): void {
    this.showing = screen;
  }
}
