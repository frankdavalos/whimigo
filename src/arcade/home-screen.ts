import * as Phaser from 'phaser';
import type { GameId, ScreenSnapshot, SnapshotTarget } from '@/contract';
import { picture } from '@/kit/atlas';
import { createStage, type Stage } from '@/kit/stage';
import { holdButton } from '@/kit/controls';
import { createMotion } from '@/kit/motion';
import { colors, sizes } from '@/kit/theme';
import { GROWN_UPS } from './grown-ups';
import { LOBBY, type LobbyData } from './lobby/lobby-screen';
import type { ArcadeScreen, ScreenData } from './screen';

/** A Game Card's size in design units, from its art. */
const CARD = 560;

/** The Grown-Up Gate's hold, in milliseconds: long enough that a small child will not make it by accident. */
const GATE_MS = 3000;

export interface HomeData extends ScreenData {
  /** A Game that has just failed to load: its Game Card shakes its head. */
  readonly refused?: GameId;
}

/**
 * The Home Screen: one Game Card per Game in the Catalog, in Catalog order, each opening that
 * Game's lobby; and in the corner the Grown-Up Gate, a three-second hold that opens the Grown-Ups
 * Area.
 */
export class HomeScreen extends Phaser.Scene implements ArcadeScreen {
  stage!: Stage;
  private games: string[] = [];
  private refused: GameId | null = null;
  private targets: Record<string, SnapshotTarget> = {};

  create({ arcade, refused }: HomeData): void {
    this.stage = createStage(this, arcade.services.safeAreaInsets());
    this.stage.backdrop({ color: colors.meadow });
    const { safe } = this.stage;
    picture(this, safe.x + 160, safe.y + 160, 'arcade/sun');

    const spacing = CARD + sizes.gap * 2;
    const firstX = safe.x + safe.width / 2 - ((arcade.catalog.length - 1) * spacing) / 2;
    const y = safe.y + safe.height / 2;
    this.games = arcade.catalog.map((game) => game.id);
    this.refused = refused ?? null;
    this.targets = {};
    const motion = createMotion(this, arcade.services.reducedMotion());
    arcade.catalog.forEach((game, index) => {
      const x = firstX + index * spacing;
      const card = picture(this, x, y, game.card.frame);
      if (game.id === refused) void motion.play(card, 'wiggle');
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
    this.targets[GROWN_UPS] = holdButton(this, {
      x: safe.x + safe.width - sizes.button / 2,
      y: safe.y + safe.height - sizes.button / 2,
      icon: 'arcade/grown-ups',
      duration: GATE_MS,
      onHold: () => arcade.openGrownUps(),
    }).target;
    arcade.shown(this);
  }

  /**
   * The state names the Games, in Catalog order, and the Game that has just refused to load, or
   * null; a Game Card's target is named by its Game.
   */
  snapshot(): ScreenSnapshot {
    return { state: { games: this.games, refused: this.refused }, targets: this.targets };
  }
}
