import * as Phaser from 'phaser';
import type { ScreenSnapshot, SnapshotTarget } from '@/contract';
import { drawNumber, type DrawnNumber } from '@/kit/digits';
import { holdButton } from '@/kit/controls';
import { createStage, type Stage } from '@/kit/stage';
import { colors, sizes } from '@/kit/theme';
import type { ArcadeScreen, CheckScreen, ScreenData } from '../screen';

/**
 * A check screen with nothing on it but the leave control and a number in bitmap digits.
 * Registered only for automated tests, it proves the list of check screens, hold-to-leave, the
 * digits and the bridge before any real check exists.
 */
class BlankCheckScreen extends Phaser.Scene implements ArcadeScreen {
  stage!: Stage;
  private leave!: SnapshotTarget;
  private number!: DrawnNumber;

  create({ arcade }: ScreenData): void {
    this.stage = createStage(this, arcade.services.safeAreaInsets());
    this.stage.backdrop({ color: colors.cream });
    const { safe } = this.stage;
    this.leave = holdButton(this, {
      x: safe.x + sizes.button / 2,
      y: safe.y + safe.height / 2,
      icon: 'arcade/home',
      onHold: () => arcade.show('home'),
    }).target;
    // Every digit once, so a test can see each glyph drawn.
    this.number = drawNumber(this, safe.x + safe.width / 2, safe.y + safe.height / 2, 1234567890);
    arcade.shown(this);
  }

  snapshot(): ScreenSnapshot {
    return { state: { number: this.number.describe() }, targets: { leave: this.leave } };
  }
}

export const blankCheck: CheckScreen = {
  id: 'blank-check',
  title: 'Blank check (for tests)',
  scene: BlankCheckScreen,
  icon: 'arcade/check-blank',
};
