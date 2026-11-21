import * as Phaser from 'phaser';
import type { ScreenSnapshot, SnapshotTarget } from '@/contract';
import { picture } from '@/kit/atlas';
import { createStage, type Stage } from '@/kit/stage';
import { iconButton } from '@/kit/controls';
import { colors, sizes } from '@/kit/theme';
import { GROWN_UPS } from './grown-ups';
import { LOBBY, type LobbyData } from './lobby/lobby-screen';
import type { ArcadeScreen, ScreenData } from './screen';

/** A Game Card's size in design units, from its art. */
const CARD = 560;

/**
 * The Home Screen: one Game Card per Game in the Catalog, in Catalog order, each opening that
 * Game's lobby; and in the corner the control that opens the status page for grown-ups.
 */
export class HomeScreen extends Phaser.Scene implements ArcadeScreen {
  stage!: Stage;
  private games: string[] = [];
  private targets: Record<string, SnapshotTarget> = {};

  create({ arcade }: ScreenData): void {
    this.stage = createStage(this, arcade.services.safeAreaInsets());
    this.stage.backdrop({ color: colors.meadow });
    const { safe } = this.stage;
    picture(this, safe.x + 160, safe.y + 160, 'arcade/sun');

    const spacing = CARD + sizes.gap * 2;
    const firstX = safe.x + safe.width / 2 - ((arcade.catalog.length - 1) * spacing) / 2;
    const y = safe.y + safe.height / 2;
    this.games = arcade.catalog.map((game) => game.id);
    this.targets = {};
    arcade.catalog.forEach((game, index) => {
      const x = firstX + index * spacing;
      picture(this, x, y, game.card.frame);
      this.add
        .rectangle(x, y, CARD, CARD)
        .setInteractive()
        .on('pointerup', (pointer: Phaser.Input.Pointer) => {
          if (pointer.wasCanceled) return;
          const data: Omit<LobbyData, 'arcade'> = { game };
          arcade.show(LOBBY, data);
        });
      this.targets[game.id] = {
        x,
        y,
        rect: { x: x - CARD / 2, y: y - CARD / 2, width: CARD, height: CARD },
      };
    });
    // The Grown-Up Gate will guard this control (slice 5d).
    this.targets[GROWN_UPS] = iconButton(this, {
      x: safe.x + safe.width - sizes.button / 2,
      y: safe.y + safe.height - sizes.button / 2,
      icon: 'arcade/grown-ups',
      onTap: () => arcade.show(GROWN_UPS),
    }).target;
    arcade.shown(this);
  }

  /** The state names the Games, in Catalog order; a Game Card's target is named by its Game. */
  snapshot(): ScreenSnapshot {
    return { state: { games: this.games }, targets: this.targets };
  }
}
