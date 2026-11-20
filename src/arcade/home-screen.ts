import * as Phaser from 'phaser';
import type { ScreenSnapshot, SnapshotTarget } from '@/contract';
import { picture } from '@/kit/atlas';
import { createStage, type Stage } from '@/kit/stage';
import { tapButton } from '@/kit/tap-button';
import { colors, sizes } from '@/kit/theme';
import { GROWN_UPS } from './grown-ups';
import type { ArcadeScreen, ScreenData, ScreenId } from './screen';

/**
 * The placeholder Home Screen: one control per registered check screen, and in the corner one
 * that opens the status page for grown-ups. Game Cards arrive with the first Game.
 */
export class HomeScreen extends Phaser.Scene implements ArcadeScreen {
  stage!: Stage;
  private checks: ScreenId[] = [];
  private targets: Record<string, SnapshotTarget> = {};

  create({ arcade }: ScreenData): void {
    this.stage = createStage(this, arcade.services.safeAreaInsets());
    this.stage.backdrop({ color: colors.meadow });
    const { safe } = this.stage;
    picture(this, safe.x + 160, safe.y + 160, 'arcade/sun');

    const size = sizes.button;
    const spacing = size + sizes.gap * 2;
    const firstX = safe.x + safe.width / 2 - ((arcade.checks.length - 1) * spacing) / 2;
    const y = safe.y + safe.height / 2;
    this.checks = arcade.checks.map((check) => check.id);
    this.targets = {};
    arcade.checks.forEach((check, index) => {
      const x = firstX + index * spacing;
      picture(this, x, y, 'arcade/card');
      picture(this, x, y, check.icon);
      this.add
        .rectangle(x, y, size, size)
        .setInteractive()
        .on('pointerup', (pointer: Phaser.Input.Pointer) => {
          if (!pointer.wasCanceled) arcade.show(check.id);
        });
      this.targets[check.id] = {
        x,
        y,
        rect: { x: x - size / 2, y: y - size / 2, width: size, height: size },
      };
    });
    // The Grown-Up Gate will guard this control (Phase 1).
    this.targets[GROWN_UPS] = tapButton(this, {
      x: safe.x + safe.width - size / 2,
      y: safe.y + safe.height - size / 2,
      icon: 'arcade/grown-ups',
      onTap: () => arcade.show(GROWN_UPS),
    }).target;
    arcade.shown(this);
  }

  /** The state names the check screens, in order; a target is named by the screen it opens. */
  snapshot(): ScreenSnapshot {
    return { state: { checks: this.checks }, targets: this.targets };
  }
}
