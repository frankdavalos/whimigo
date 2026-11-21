import type * as Phaser from 'phaser';
import type { GameManifest } from '@/contract';
import type { ScreenWatch } from '@/platform/screen-watch';
import type { Audio } from '@/platform/audio';
import type { RunningAs } from '@/platform/display-mode';
import type { SafeAreaInsets } from '@/platform/safe-area';
import type { Updates } from '@/platform/updates';
import { GameHost } from './game-host';
import { GROWN_UPS, GrownUpsScreen } from './grown-ups';
import { HomeScreen } from './home-screen';
import { LOADING, LoadingScreen } from './loading-screen';
import { LOBBY, LobbyScreen } from './lobby/lobby-screen';
import { RESULT, ResultScreen } from './result-screen';
import type { ArcadeScreen, CheckScreen, ScreenData, ScreenId, Shown } from './screen';
import { StartScreen } from './start-screen';

export interface ArcadeServices {
  /** The commit this build was made from. */
  readonly buildId: string;
  readonly audio: Audio;
  readonly safeAreaInsets: () => SafeAreaInsets;
  readonly updates: Updates;
  readonly runningAs: () => RunningAs;
  /** The status page's markup, in index.html. */
  readonly grownUpsPage: HTMLElement;
  /** The screen as the browser measures it, and its changes since the page started. */
  readonly screen: ScreenWatch;
}

/** The Arcade's own screens, added once and kept for the life of the page. */
const SCREENS: Readonly<Record<ScreenId, new () => ArcadeScreen>> = {
  start: StartScreen,
  home: HomeScreen,
  [GROWN_UPS]: GrownUpsScreen,
  [LOBBY]: LobbyScreen,
  [LOADING]: LoadingScreen,
  [RESULT]: ResultScreen,
};

/**
 * Moves between screens. One screen's Scene runs at a time, except that the Result screen runs
 * over a Game's paused Scene; either way exactly one Scene accepts input (ADR-0004). Check screens
 * and Games are added when opened and removed when left.
 */
export class Arcade {
  readonly host: GameHost;
  private started: ScreenId | null = null;
  private showing: Shown | null = null;

  constructor(
    readonly game: Phaser.Game,
    readonly services: ArcadeServices,
    readonly checks: readonly CheckScreen[],
    readonly catalog: readonly GameManifest[],
  ) {
    for (const [key, scene] of Object.entries(SCREENS)) game.scene.add(key, scene);
    this.host = new GameHost(this);
  }

  /** What is on show, once its Scene has been created. */
  get screen(): Shown | null {
    return this.showing;
  }

  /** Changes screen at the start of the next frame. `data` adds to what the screen is given. */
  show(id: ScreenId, data: object = {}): void {
    const check = this.checks.find((candidate) => candidate.id === id);
    if (!check && !(id in SCREENS)) throw new Error(`No screen "${id}"`);
    this.nextFrame(() => {
      this.leave();
      const start: ScreenData = { ...data, arcade: this };
      if (check) this.game.scene.add(id, check.scene, true, start);
      else this.game.scene.start(id, start);
      this.started = id;
    });
  }

  /** Runs `step` at the start of the next frame, when no Scene is being processed. */
  nextFrame(step: () => void): void {
    this.game.events.once('prestep', step);
  }

  /**
   * Stops the screen that was started, removing it if it was added for this visit, and forgets
   * what was on show. Call only at the start of a frame.
   */
  leave(): void {
    const { started } = this;
    if (started) {
      this.game.scene.stop(started);
      if (this.checks.some((check) => check.id === started)) this.game.scene.remove(started);
    }
    this.started = null;
    this.showing = null;
  }

  /** Records that the GameHost started `id`, so that `show` will stop it. */
  adopt(id: ScreenId): void {
    this.started = id;
  }

  /** Called by each Arcade screen at the end of its create(). */
  shown(screen: ArcadeScreen): void {
    this.showing = {
      id: screen.scene.key,
      scene: screen,
      stage: screen.stage,
      snapshot: () => screen.snapshot(),
    };
  }

  /** Called by the GameHost when a Round's Scene has been created. */
  showRound(shown: Shown): void {
    this.showing = shown;
  }
}
