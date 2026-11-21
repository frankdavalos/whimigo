import type {
  GameManifest,
  GameModule,
  Result,
  RoundHost,
  RoundStart,
  ScreenSnapshot,
  Session,
} from '@/contract';
import { createRng } from '@/kit/rng';
import type { Arcade } from './arcade';
import { nextHostState, type HostEvent, type HostState } from './host-state';
import { LOADING, type LoadingData } from './loading-screen';
import { RESULT, type ResultData } from './result-screen';

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
  readonly snapshot: ScreenSnapshot;
  /** Every sound requested since the Round began, in order. */
  readonly sounds: readonly RequestedSound[];
}

/** A Game that is open: from loading until it is closed. */
interface OpenGame {
  readonly manifest: GameManifest;
  readonly session: Session;
  module: GameModule | null;
  seed: number;
  number: number;
  sounds: RequestedSound[];
  describe: () => ScreenSnapshot;
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
      describe: () => ({ state: null, targets: {} }),
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

  /** The Round being played or whose Result shows, for the test bridge. */
  round(): RoundReport | null {
    const game = this.game;
    if (!game?.module) return null;
    return {
      session: game.session,
      seed: game.seed,
      number: game.number,
      snapshot: game.describe(),
      sounds: game.sounds,
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
    });
  }

  private failed(): void {
    this.game = null;
    this.step('failed');
    this.arcade.show('home');
  }

  /** Starts (or restarts) the Game's Scene with a fresh Round. At the start of a frame only. */
  private startRound(game: OpenGame): void {
    game.sounds = [];
    const start: RoundStart = {
      session: game.session,
      seed: game.seed,
      number: game.number,
      host: this.roundHost(game),
    };
    this.arcade.game.scene.start(game.manifest.id, start);
    this.arcade.adopt(game.manifest.id);
  }

  private roundHost(game: OpenGame): RoundHost {
    const { arcade } = this;
    return {
      insets: () => arcade.services.safeAreaInsets(),
      opened(scene, stage, describe) {
        game.describe = describe;
        arcade.showRound({ id: game.manifest.id, scene, stage, snapshot: describe });
      },
      sfx(key, time) {
        game.sounds.push({ key, time });
        arcade.services.audio.play(key);
      },
      finish: (result) => this.finish(game, result),
    };
  }

  private finish(game: OpenGame, result: Result): void {
    if (game !== this.game || !this.step('finish')) return;
    this.arcade.nextFrame(() => {
      const scenes = this.arcade.game.scene;
      scenes.pause(game.manifest.id);
      const data: ResultData = {
        arcade: this.arcade,
        result,
        session: game.session,
        replay: () => this.replay(),
        home: () => this.close(),
      };
      scenes.start(RESULT, data);
      scenes.bringToTop(RESULT);
      this.arcade.adopt(RESULT);
    });
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
