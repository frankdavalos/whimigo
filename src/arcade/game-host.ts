import type {
  DemoReport,
  GameManifest,
  GameModule,
  Result,
  RoundHost,
  RoundStart,
  RoundView,
  ScreenSnapshot,
  SeatTouchReport,
  Session,
  Zone,
} from '@/contract';
import { createRng } from '@/kit/rng';
import type { Arcade } from './arcade';
import { recordRound, starsEarned } from './progress';
import { nextHostState, type HostEvent, type HostState } from './host-state';
import type { HomeData } from './home-screen';
import { LOADING, type LoadingData } from './loading-screen';
import { PAUSE, type PauseData } from './pause-screen';
import { RESULT, type ResultData } from './result-screen';
import type { Shown } from './screen';

export type { HostState } from './host-state';

/** A sound a Game asked for, and when, in its Scene's time. */
export interface RequestedSound {
  readonly key: string;
  readonly time: number;
}

/** What the test bridge can see of the Round being played. */
export interface RoundReport {
  readonly session: Session;
  readonly seed: number;
  readonly number: number;
  /** The Round's Scene clock, in milliseconds: it stands still while the Round is paused. */
  readonly time: number;
  /** The Round's own time (`Round.now()`), in milliseconds: still while paused or in its Demo. */
  readonly now: number;
  readonly snapshot: ScreenSnapshot;
  /** Every sound requested since the Round began, in order. */
  readonly sounds: readonly RequestedSound[];
  /** Each Seat's Zone, in design units: none unless the Session is zoned. */
  readonly zones: readonly Zone[];
  /** What the Round's SeatZones has reported. */
  readonly seatTouches: SeatTouchReport;
  readonly demo: DemoReport;
  /** How many touches the Game has refused in this Round. */
  readonly refusals: number;
  /** The motion the Round was opened with. */
  readonly motion: 'full' | 'reduced';
}

/** A Game that is open: from loading until it is closed. */
interface OpenGame {
  readonly manifest: GameManifest;
  readonly session: Session;
  module: GameModule | null;
  seed: number;
  number: number;
  sounds: RequestedSound[];
  /** What the kit lets the Arcade see of the Round, once it has opened. */
  view: RoundView | null;
  /** Whether the Round was opened with reduced motion. */
  reduced: boolean;
  /** The Round's Scene as shown, once it has opened. */
  shown: Shown | null;
  /** Asked to pause while still loading: the first Round opens paused. */
  pauseOnOpen: boolean;
  /** The Arcade's side of the Round being played, as its Game holds it. */
  roundHost: RoundHost | null;
}

const SEEDS = 2 ** 31;

/** How many states the host remembers. */
const HISTORY = 20;

/** The seed of the next Round: always different from the last. */
function nextSeed(seed: number): number {
  const next = createRng(seed).int(0, SEEDS - 1);
  return next === seed ? (seed + 1) % SEEDS : next;
}

/** The pack as Phaser's loader takes it: sections keyed by a name, here the Game's id. */
const packOf = (game: OpenGame) => ({ [game.manifest.id]: game.module!.pack });

/**
 * Holds the Session and runs a Game's lifecycle (overview, Game lifecycle): loads its chunk and
 * pack, adds its Scene under its id, starts Rounds with seeds, shows the Result over the paused
 * Scene, and on close removes the Scene, the pack's textures and the Game's sounds (ADR-0002).
 * Every change of Scene happens at the start of a frame.
 */
export class GameHost {
  private current: HostState = 'idle';
  private game: OpenGame | null = null;
  /** The states the host has been in, oldest first: the last few, for the test bridge. */
  readonly history: HostState[] = ['idle'];

  constructor(private readonly arcade: Arcade) {}

  get state(): HostState {
    return this.current;
  }

  /** Opens a Session's Game and starts its first Round. A test may fix the seed. */
  open(session: Session, seed = Math.floor(Math.random() * SEEDS)): void {
    const manifest = this.arcade.catalog.find((game) => game.id === session.gameId);
    if (!manifest) throw new Error(`No Game "${session.gameId}" in the Catalog`);
    if (!this.step('open')) return;
    this.game = {
      manifest,
      session,
      module: null,
      seed,
      number: 0,
      sounds: [],
      view: null,
      reduced: false,
      shown: null,
      pauseOnOpen: false,
      roundHost: null,
    };
    const data: Omit<LoadingData, 'arcade'> = {
      manifest,
      loaded: (module) => this.loaded(module),
      failed: () => this.failed(),
    };
    this.arcade.show(LOADING, data);
  }

  /** Starts a new Round of the same Session with a new seed. */
  replay(): void {
    const game = this.game;
    if (!game || !this.step('replay')) return;
    this.arcade.nextFrame(() => {
      this.arcade.leave();
      game.seed = nextSeed(game.seed);
      game.number += 1;
      this.startRound(game);
    });
  }

  /**
   * Pauses the Round being played and shows the pause screen over it. Asked while the Game is still
   * loading, it pauses the first Round as soon as it opens.
   */
  pause(): void {
    const game = this.game;
    if (game && this.current === 'loading') game.pauseOnOpen = true;
    if (!game || !this.step('pause')) return;
    this.arcade.nextFrame(() => {
      // The Round may have ended, or been resumed, in the frame it was paused in.
      if (this.current !== 'paused') return;
      const data: PauseData = {
        arcade: this.arcade,
        play: () => this.resume(),
        home: () => this.close(),
        demo: () => this.resume(() => game.view?.showDemo()),
      };
      this.over(game, PAUSE, data);
    });
  }

  /** Hides the pause screen and resumes the Round's Scene as it was, then does `then`. */
  resume(then: () => void = () => undefined): void {
    const game = this.game;
    if (!game || !this.step('resume')) return;
    this.arcade.nextFrame(() => {
      const scenes = this.arcade.game.scene;
      const id = game.manifest.id;
      // Resumed in the frame it was paused in: the pause screen never showed.
      if (this.current !== 'playing' || !scenes.isPaused(id)) return;
      this.arcade.leave();
      scenes.resume(id);
      this.arcade.adopt(id);
      this.arcade.showRound(game.shown!);
      then();
    });
  }

  /** Closes the Game: removes its Scene, textures and sounds, and returns to the Home Screen. */
  close(): void {
    const game = this.game;
    if (!game || !this.step('home')) return;
    this.arcade.nextFrame(() => {
      const { scene: scenes } = this.arcade.game;
      const id = game.manifest.id;
      this.arcade.leave();
      scenes.stop(id);
      scenes.remove(id);
      scenes.getScene(LOADING)!.load.removePack(packOf(game));
      for (const key of Object.keys(game.module!.sounds)) this.arcade.services.audio.unload(key);
      this.game = null;
      this.step('closed');
      this.arcade.show('home');
    });
  }

  /** For the test bridge: reports a Result for the Round being played, exactly as its Game would. */
  report(result: Result): void {
    this.game?.roundHost?.finish(result);
  }

  /** The Round being played, paused or whose Result shows, for the test bridge. */
  round(): RoundReport | null {
    const game = this.game;
    if (!game?.shown || !game.view) return null;
    const { view } = game;
    return {
      session: game.session,
      seed: game.seed,
      number: game.number,
      time: game.shown.scene.time.now,
      now: view.now(),
      snapshot: view.snapshot(),
      sounds: game.sounds,
      zones: game.shown.stage.zones,
      seatTouches: view.seatTouches(),
      demo: view.demo(),
      refusals: view.refusals(),
      motion: game.reduced ? 'reduced' : 'full',
    };
  }

  private loaded(module: GameModule): void {
    const game = this.game!;
    game.module = module;
    for (const [key, recipe] of Object.entries(module.sounds)) {
      this.arcade.services.audio.load(key, recipe);
    }
    this.arcade.nextFrame(() => {
      this.step('loaded');
      this.arcade.leave();
      this.arcade.game.scene.add(game.manifest.id, module.scene, false);
      this.startRound(game);
      if (game.pauseOnOpen) this.pause();
    });
  }

  /** The Game's files failed to load: back to the Home Screen, where its Game Card refuses. */
  private failed(): void {
    const refused = this.game!.manifest.id;
    this.game = null;
    this.step('failed');
    const data: Omit<HomeData, 'arcade'> = { refused };
    this.arcade.show('home', data);
  }

  /** Starts (or restarts) the Game's Scene with a fresh Round. At the start of a frame only. */
  private startRound(game: OpenGame): void {
    game.sounds = [];
    game.view = null;
    game.roundHost = this.roundHost(game);
    const start: RoundStart = {
      session: game.session,
      seed: game.seed,
      number: game.number,
      host: game.roundHost,
    };
    this.arcade.game.scene.start(game.manifest.id, start);
    this.arcade.adopt(game.manifest.id);
  }

  private roundHost(game: OpenGame): RoundHost {
    const { arcade } = this;
    return {
      insets: () => arcade.services.safeAreaInsets(),
      reducedMotion() {
        game.reduced = arcade.services.reducedMotion();
        return game.reduced;
      },
      opened(scene, stage, view) {
        game.view = view;
        game.shown = { id: game.manifest.id, scene, stage, snapshot: () => view.snapshot() };
        arcade.showRound(game.shown);
      },
      sfx: (key, time) => {
        // No Game sound while paused, even in the frame the pause control filled.
        if (this.current !== 'playing') return;
        game.sounds.push({ key, time });
        arcade.services.audio.play(key);
      },
      finish: (result) => this.finish(game, result),
      pause: () => {
        if (game === this.game) this.pause();
      },
    };
  }

  /** The Round ended: awards its Stars and saves them at once, then shows the Result. Once per Round. */
  private finish(game: OpenGame, result: Result): void {
    if (game !== this.game || !this.step('finish')) return;
    const { save } = this.arcade.services;
    const stars = starsEarned(result, game.session);
    save.write(recordRound(save.current(), game.manifest.id, stars));
    this.arcade.nextFrame(() => {
      const data: ResultData = {
        arcade: this.arcade,
        result,
        session: game.session,
        stars,
        replay: () => this.replay(),
        home: () => this.close(),
      };
      this.over(game, RESULT, data);
    });
  }

  /** Pauses the Round's Scene and starts the Arcade screen `id` over it. At the start of a frame only. */
  private over(game: OpenGame, id: string, data: object): void {
    const scenes = this.arcade.game.scene;
    scenes.pause(game.manifest.id);
    scenes.start(id, data);
    scenes.bringToTop(id);
    this.arcade.adopt(id);
  }

  /** Moves the state machine on; false, changing nothing, if the event means nothing now. */
  private step(event: HostEvent): boolean {
    const next = nextHostState(this.current, event);
    if (!next) return false;
    this.current = next;
    this.history.push(next);
    if (this.history.length > HISTORY) this.history.shift();
    return true;
  }
}
