import * as Phaser from 'phaser';
import type { ScreenSnapshot, SnapshotTarget } from '@/contract';
import { picture } from '@/kit/atlas';
import { createStage, type Stage } from '@/kit/stage';
import { colors, sizes } from '@/kit/theme';
import type { ArcadeScreen, ScreenData } from './screen';

/**
 * The placeholder Home Screen: one control per registered check screen. Game Cards arrive with
 * the first Game.
 */
export class HomeScreen extends Phaser.Scene implements ArcadeScreen {
  stage!: Stage;
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
    arcade.shown(this);
  }

  snapshot(): ScreenSnapshot {
    return { state: {}, targets: this.targets };
  }
}
