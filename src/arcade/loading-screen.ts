import * as Phaser from 'phaser';
import type { GameManifest, GameModule, ScreenSnapshot } from '@/contract';
import { picture } from '@/kit/atlas';
import { createStage, type Stage } from '@/kit/stage';
import type { ArcadeScreen, ScreenData } from './screen';

/** The loading screen's key. */
export const LOADING = 'loading';

export interface LoadingData extends ScreenData {
  readonly manifest: GameManifest;
  /** Called once the Game's chunk and every file of its pack have loaded. */
  readonly loaded: (module: GameModule) => void;
  readonly failed: () => void;
}

/**
 * Shows the Game Card while a Game's chunk and pack load. It has nothing to touch. Its loader is
 * the one the GameHost uses to load a Game's pack and, when the Game closes, to remove it.
 */
export class LoadingScreen extends Phaser.Scene implements ArcadeScreen {
  stage!: Stage;
  private gameId = '';

  create({ arcade, manifest, loaded, failed }: LoadingData): void {
    this.gameId = manifest.id;
    this.stage = createStage(this, arcade.services.safeAreaInsets());
    this.stage.backdrop({ color: manifest.card.color });
    const { safe } = this.stage;
    picture(this, safe.x + safe.width / 2, safe.y + safe.height / 2, manifest.card.frame);
    arcade.shown(this);

    manifest.load().then(({ default: module }) => {
      if (!this.sys.isActive()) return;
      let broken = false;
      this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => (broken = true));
      this.load.once(Phaser.Loader.Events.COMPLETE, () => (broken ? failed() : loaded(module)));
      this.load.addPack({ [manifest.id]: module.pack });
      this.load.start();
    }, failed);
  }

  snapshot(): ScreenSnapshot {
    return { state: { game: this.gameId }, targets: {} };
  }
}
