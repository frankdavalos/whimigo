import * as Phaser from 'phaser';
import type { ScreenSnapshot, SnapshotTarget } from '@/contract';
import { holdButton } from '@/kit/hold-button';
import { createStage, type Stage } from '@/kit/stage';
import { colors, sizes } from '@/kit/theme';
import type { ArcadeScreen, CheckScreen, ScreenData } from '../screen';

/**
 * A check screen with nothing on it but the leave control. Registered only for automated tests,
 * it proves the list of check screens, hold-to-leave and the bridge before any real check exists.
 */
class BlankCheckScreen extends Phaser.Scene implements ArcadeScreen {
  stage!: Stage;
  private leave!: SnapshotTarget;

  create({ arcade }: ScreenData): void {
    this.stage = createStage(this, arcade.services.safeAreaInsets());
    this.stage.backdrop({ color: colors.cream });
    const { safe } = this.stage;
    this.leave = holdButton(this, {
      x: safe.x + sizes.button / 2,
      y: safe.y + safe.height / 2,
      icon: 'arcade/home',
      onHold: () => arcade.show('home'),
    });
    arcade.shown(this);
  }

  snapshot(): ScreenSnapshot {
    return { state: {}, targets: { leave: this.leave } };
  }
}

export const blankCheck: CheckScreen = {
  id: 'blank-check',
  scene: BlankCheckScreen,
  icon: 'arcade/check-blank',
};
