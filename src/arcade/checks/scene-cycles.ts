import * as Phaser from 'phaser';
import type { Insets } from '@/kit/frame';
import { createStage } from '@/kit/stage';
import { type Counts, countsOf } from '../counts';
import { STANDIN_ATLAS } from './standin';

/** How many times the loop adds and removes the stand-in Scene and its pack. */
export const LOOP_CYCLES = 50;

/** The stand-in plays the part of a Game with this id: its Scene's key and its keys' prefix. */
export const STANDIN_ID = 'standin';

/** The stand-in's pack, keyed `${id}/…` as a Game's must be (game contract, GameModule). */
const STANDIN_PACK = {
  [STANDIN_ID]: {
    files: [
      {
        type: 'atlas',
        key: `${STANDIN_ID}/atlas`,
        textureURL: STANDIN_ATLAS.image,
        atlasURL: STANDIN_ATLAS.frames,
      },
    ],
  },
};

export interface LoopReport {
  readonly state: 'idle' | 'running' | 'done';
  readonly cycles: number;
  readonly of: number;
  /** `counts()` before the first cycle, and after the last. */
  readonly before: Counts | null;
  readonly after: Counts | null;
  /** Every texture key that appeared while the stand-in Scene was loaded, over all cycles. */
  readonly added: readonly string[];
  /** Every Scene that accepted input while the stand-in Scene was loaded, by key. */
  readonly inputScenes: readonly string[];
}

/** What the stand-in Scene is started with. */
interface StandinData {
  readonly insets: Insets;
  /** Called once the Scene has drawn its first frame. */
  readonly drawn: () => void;
}

/**
 * Stands in for a Game's Scene: loads its pack, draws every frame of its atlas once across the
 * design frame, and accepts no input, because only one Scene may (ADR-0004).
 */
class StandinScene extends Phaser.Scene {
  init(): void {
    this.input.enabled = false;
  }

  preload(): void {
    this.load.addPack(STANDIN_PACK);
  }

  create({ insets, drawn }: StandinData): void {
    createStage(this, insets);
    const key = STANDIN_PACK[STANDIN_ID].files[0]!.key;
    this.textures
      .get(key)
      .getFrameNames()
      .forEach((frame, index) => {
        this.add.image(400 + (index % 5) * 500, 300 + Math.floor(index / 5) * 500, key, frame);
      });
    this.events.once('render', drawn);
  }
}

/**
 * The loop of gate G6: add a Scene and load the stand-in pack, then remove the Scene and the pack's
 * textures, the way the GameHost will open and close a Game, again and again. Each step waits for
 * the start of the next frame, when no Scene is being processed, as the Arcade's own screen
 * changes do. The stand-in Scene sits below its owner, whose backdrop hides it.
 *
 * Stopping, which the owner does when it shuts down, removes the stand-in Scene and its textures
 * at once, wherever the loop has got to.
 */
export class SceneCycles {
  private state: LoopReport['state'] = 'idle';
  private cycles = 0;
  private before: Counts | null = null;
  private after: Counts | null = null;
  private added = new Set<string>();
  private inputScenes = new Set<string>();
  private stopped = false;

  constructor(
    private readonly owner: Phaser.Scene,
    private readonly insets: Insets,
  ) {}

  /** Starts the loop from the beginning, unless it is already running. */
  start(): void {
    if (this.state === 'running' || this.stopped) return;
    this.state = 'running';
    this.cycles = 0;
    this.after = null;
    this.added = new Set();
    this.inputScenes = new Set();
    this.nextFrame(() => {
      this.before = countsOf(this.owner.game);
      this.add();
    });
  }

  /** Ends the loop for good, and removes whatever of the stand-in is loaded. */
  stop(): void {
    this.stopped = true;
    this.unload();
  }

  report(): LoopReport {
    return {
      state: this.state,
      cycles: this.cycles,
      of: LOOP_CYCLES,
      before: this.before,
      after: this.after,
      added: [...this.added],
      inputScenes: [...this.inputScenes],
    };
  }

  private add(): void {
    const { game } = this.owner;
    const textures = new Set(game.textures.getTextureKeys());
    const data: StandinData = {
      insets: this.insets,
      drawn: () => {
        for (const key of game.textures.getTextureKeys()) {
          if (!textures.has(key)) this.added.add(key);
        }
        // A Scene added but never started (the Home Screen, when a check is opened from the bridge)
        // has created nothing to touch, and is not counted.
        for (const scene of game.scene.scenes) {
          const started = scene.sys.settings.status >= Phaser.Scenes.START;
          if (started && scene.input?.isActive()) this.inputScenes.add(scene.sys.settings.key);
        }
        this.nextFrame(() => this.remove());
      },
    };
    game.scene.add(STANDIN_ID, StandinScene, true, data);
    game.scene.sendToBack(STANDIN_ID);
  }

  private remove(): void {
    this.unload();
    this.cycles += 1;
    if (this.cycles < LOOP_CYCLES) {
      this.add();
      return;
    }
    this.after = countsOf(this.owner.game);
    this.state = 'done';
  }

  /** Removes the stand-in Scene, if it is there, and then its pack's textures. */
  private unload(): void {
    const { game } = this.owner;
    if (game.scene.getScene(STANDIN_ID)) {
      game.scene.stop(STANDIN_ID);
      game.scene.remove(STANDIN_ID);
    }
    const loaded = STANDIN_PACK[STANDIN_ID].files.some(({ key }) => game.textures.exists(key));
    if (loaded) this.owner.load.removePack(STANDIN_PACK);
  }

  /** Runs `step` at the start of the next frame, unless the loop has been stopped by then. */
  private nextFrame(step: () => void): void {
    this.owner.game.events.once('prestep', () => {
      if (!this.stopped) step();
    });
  }
}
