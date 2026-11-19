import * as Phaser from 'phaser';
import type { ScreenSnapshot } from '@/contract';
import { DESIGN_FRAME } from '@/kit/frame';
import { createStage, type Stage } from '@/kit/stage';
import { picture } from '@/kit/atlas';
import { addDigitFont } from '@/kit/digits';
import { colors } from '@/kit/theme';
import { loadArcadeArt } from './art';
import type { ArcadeScreen, ScreenData } from './screen';

const CENTRE = { x: DESIGN_FRAME.width / 2, y: DESIGN_FRAME.height / 2 };

/** "Tap to start": one picture, and a tap anywhere in the design frame unlocks sound and goes home. */
export class StartScreen extends Phaser.Scene implements ArcadeScreen {
  stage!: Stage;

  preload(): void {
    loadArcadeArt(this);
  }

  create({ arcade }: ScreenData): void {
    this.stage = createStage(this, arcade.services.safeAreaInsets());
    this.stage.backdrop({ color: colors.sky });
    addDigitFont(this);
    picture(this, CENTRE.x, CENTRE.y, 'arcade/play');

    let started = false;
    this.add
      .zone(CENTRE.x, CENTRE.y, DESIGN_FRAME.width, DESIGN_FRAME.height)
      .setInteractive()
      .on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (started || pointer.wasCanceled) return;
        started = true;
        arcade.services.audio.unlock();
        arcade.show('home');
      });
    arcade.shown(this);
  }

  snapshot(): ScreenSnapshot {
    return { state: {}, targets: { start: { ...CENTRE, rect: DESIGN_FRAME } } };
  }
}
