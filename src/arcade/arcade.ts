import type * as Phaser from 'phaser';
import type { GameManifest } from '@/contract';
import type { ScreenWatch } from '@/platform/screen-watch';
import type { Audio } from '@/platform/audio';
import type { RunningAs } from '@/platform/display-mode';
import type { SaveStore } from '@/platform/save-store';
import type { SafeAreaInsets } from '@/platform/safe-area';
import type { Updates } from '@/platform/updates';
import { GameHost } from './game-host';
import { GROWN_UPS, GrownUpsScreen } from './grown-ups';
import { HomeScreen } from './home-screen';
import { LOADING, LoadingScreen } from './loading-screen';
import { LOBBY, LobbyScreen } from './lobby/lobby-screen';
import { PAUSE, PauseScreen } from './pause-screen';
import { RESULT, ResultScreen } from './result-screen';
import { ROTATE, RotateScreen } from './rotate-screen';
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
  /** Progress, kept between visits. */
  readonly save: SaveStore;
  /** True when the device asks for reduced motion. */
  readonly reducedMotion: () => boolean;
}

/** The Arcade's own screens, added once and kept for the life of the page. */
const SCREENS: Readonly<Record<ScreenId, new () => ArcadeScreen>> = {
  start: StartScreen,
  home: HomeScreen,
  [GROWN_UPS]: GrownUpsScreen,
  [LOBBY]: LobbyScreen,
  [LOADING]: LoadingScreen,
  [RESULT]: ResultScreen,
  [PAUSE]: PauseScreen,
  [ROTATE]: RotateScreen,
};

/** What the rotate picture covers, and the steps that wait until it is gone. */
interface Covered {
  /** The screen on show before the picture. */
  beneath: Shown | null;
  /** The Scenes that were running, paused beneath it. */
  readonly paused: string[];
  readonly held: (() => void)[];
}

/**
 * Moves between screens. One screen's Scene runs at a time, except that the pause and Result
 * screens run over a Game's paused Scene, and the rotate picture over whatever it paused; either
 * way exactly one Scene accepts input (ADR-0004). Check screens and Games are added when opened
 * and removed when left.
 */
export class Arcade {
  readonly host: GameHost;
  private started: ScreenId | null = null;
  private showing: Shown | null = null;
  private portrait = false;
  private covered: Covered | null = null;

  constructor(
    readonly game: Phaser.Game,
    readonly services: ArcadeServices,
    readonly checks: readonly CheckScreen[],
    readonly catalog: readonly GameManifest[],
  ) {
    for (const [key, scene] of Object.entries(SCREENS)) game.scene.add(key, scene);
    this.host = new GameHost(this);
    const turn = () => this.turned(game.scale.gameSize.height > game.scale.gameSize.width);
    game.scale.on('resize', turn);
    if (game.isBooted) turn();
    else game.events.once('ready', turn);
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

  /**
   * Runs `step` at the start of the next frame, when no Scene is being processed. While the rotate
   * picture shows, the step waits until it is gone, so nothing changes beneath it.
   */
  nextFrame(step: () => void): void {
    this.game.events.once('prestep', () => (this.covered ? this.covered.held.push(step) : step()));
  }

  /**
   * The screen turned. Upright, a running Round pauses, and at the start of the next frame the
   * rotate picture covers everything; on its side again, what was beneath shows once more.
   */
  private turned(portrait: boolean): void {
    if (portrait === this.portrait) return;
    this.portrait = portrait;
    if (portrait) this.host.pause();
    this.game.events.once('prestep', () => this.cover());
  }

  /** Shows or removes the rotate picture to match the screen's shape. At the start of a frame only. */
  private cover(): void {
    const scenes = this.game.scene;
    if (this.portrait && !this.covered) {
      const paused = scenes.getScenes(true).map((scene) => scene.sys.settings.key);
      for (const key of paused) scenes.pause(key);
      this.covered = { beneath: this.showing, paused, held: [] };
      scenes.start(ROTATE, { arcade: this });
      scenes.bringToTop(ROTATE);
    } else if (!this.portrait && this.covered) {
      const { beneath, paused, held } = this.covered;
      this.covered = null;
      scenes.stop(ROTATE);
      for (const key of paused) scenes.resume(key);
      this.showing = beneath;
      for (const step of held) step();
    }
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

  /**
   * Called by each Arcade screen at the end of its create(). A screen that finishes loading while
   * the rotate picture shows waits beneath it, paused from the start of the next frame.
   */
  shown(screen: ArcadeScreen): void {
    const key = screen.scene.key;
    const shown = {
      id: key,
      scene: screen,
      stage: screen.stage,
      snapshot: () => screen.snapshot(),
    };
    const covered = this.covered;
    if (!covered || key === ROTATE) {
      this.showing = shown;
      return;
    }
    covered.beneath = shown;
    this.game.events.once('prestep', () => {
      if (this.covered !== covered) return;
      this.game.scene.pause(key);
      covered.paused.push(key);
    });
  }

  /** Called by the GameHost when a Round's Scene has been created. */
  showRound(shown: Shown): void {
    this.showing = shown;
  }
}
