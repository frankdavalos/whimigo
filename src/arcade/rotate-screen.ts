import * as Phaser from 'phaser';
import type { ScreenSnapshot } from '@/contract';
import { picture } from '@/kit/atlas';
import { DESIGN_FRAME } from '@/kit/frame';
import { createStage, type Stage } from '@/kit/stage';
import { colors } from '@/kit/theme';
import { loadArcadeArt } from './art';
import type { ArcadeScreen, ScreenData } from './screen';

/** The rotate picture's key. */
export const ROTATE = 'rotate';

/**
 * Covers everything while the screen is upright: a picture of the tablet turning back on its side.
 * iPadOS ignores the manifest's orientation, so the Arcade asks instead. It has nothing to touch.
 */
export class RotateScreen extends Phaser.Scene implements ArcadeScreen {
  stage!: Stage;

  preload(): void {
    // The tablet may be upright before the tap-to-start screen has loaded the Arcade's atlas.
    loadArcadeArt(this);
  }

  create({ arcade }: ScreenData): void {
    this.stage = createStage(this, arcade.services.safeAreaInsets());
    this.stage.backdrop({ color: colors.sky });
    picture(this, DESIGN_FRAME.width / 2, DESIGN_FRAME.height / 2, 'arcade/rotate');
    arcade.shown(this);
  }

  snapshot(): ScreenSnapshot {
    return { state: null, targets: {} };
  }
}
