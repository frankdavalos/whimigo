import * as Phaser from 'phaser';
import type { GameManifest, MascotId, ScreenSnapshot, SnapshotTarget } from '@/contract';
import { picture } from '@/kit/atlas';
import type { DrawnNumber } from '@/kit/digits';
import { createStage, type Stage } from '@/kit/stage';
import { tapButton } from '@/kit/tap-button';
import { seats as SEAT_LOOKS, sizes } from '@/kit/theme';
import { MASCOTS, mascotFrame } from '../mascots';
import type { ArcadeScreen, ScreenData } from '../screen';
import { drawStarCount } from '../star-count';
import { buildSession, fittingStyles, join } from './rules';

/** The lobby's key. */
export const LOBBY = 'lobby';

export interface LobbyData extends ScreenData {
  readonly game: GameManifest;
}

/** Mascots stand in two rows of this many. */
const PER_ROW = 4;

/** From one row of Mascots to the next, leaving room for each Mascot's Stars beneath it. */
const ROW_SPACING = sizes.button + 256;

/**
 * Where Players sit down for a Game: each taps a Mascot, which takes the lowest free Seat and wears
 * its colour and shape; start opens a Session in the first Play Style that fits. Beneath each
 * Mascot are its Stars. Difficulty is Easy and Seating side by side until the lobby offers them.
 */
export class LobbyScreen extends Phaser.Scene implements ArcadeScreen {
  stage!: Stage;
  private manifest!: GameManifest;
  private joined: readonly MascotId[] = [];
  private targets: Record<string, SnapshotTarget> = {};
  private stars = new Map<MascotId, DrawnNumber>();

  create({ arcade, game }: LobbyData): void {
    this.manifest = game;
    this.joined = [];
    this.stage = createStage(this, arcade.services.safeAreaInsets());
    this.stage.backdrop({ color: game.card.color });
    const { safe } = this.stage;
    const half = sizes.button / 2;
    const spacing = sizes.button + sizes.gap * 2;
    const middle = { x: safe.x + safe.width / 2, y: safe.y + safe.height / 2 };

    const badges = new Map<MascotId, Phaser.GameObjects.Image>();
    const showSeats = () => {
      for (const badge of badges.values()) badge.setVisible(false);
      this.joined.forEach((mascot, seat) => {
        badges.get(mascot)?.setFrame(SEAT_LOOKS[seat]!.shape).setVisible(true);
      });
    };

    this.targets = {};
    this.stars = new Map();
    const saved = arcade.services.save.current().mascots;
    MASCOTS.forEach((mascot, index) => {
      const column = index % PER_ROW;
      const row = Math.floor(index / PER_ROW);
      const x = middle.x + (column - (PER_ROW - 1) / 2) * spacing;
      const y = middle.y + (row - 0.5) * ROW_SPACING;
      picture(this, x, y, mascotFrame(mascot));
      this.stars.set(mascot, drawStarCount(this, x, y + half + 80, saved[mascot]?.stars ?? 0));
      badges.set(
        mascot,
        picture(this, x + half, y - half, SEAT_LOOKS[0].shape)
          .setScale(0.5)
          .setVisible(false),
      );
      this.add
        .rectangle(x, y, sizes.button, sizes.button)
        .setInteractive()
        .on('pointerup', (pointer: Phaser.Input.Pointer) => {
          if (pointer.wasCanceled) return;
          this.joined = join(this.joined, mascot);
          showSeats();
        });
      this.targets[`mascot-${mascot}`] = {
        x,
        y,
        rect: { x: x - half, y: y - half, width: sizes.button, height: sizes.button },
      };
    });

    this.targets.home = tapButton(this, {
      x: safe.x + half,
      y: safe.y + half,
      icon: 'arcade/home',
      onTap: () => arcade.show('home'),
    }).target;
    this.targets.start = tapButton(this, {
      x: safe.x + safe.width - half,
      y: safe.y + safe.height - half,
      icon: 'arcade/play',
      onTap: () => {
        const style = fittingStyles(this.manifest, this.joined.length)[0];
        if (!style) return;
        arcade.host.open(
          buildSession({
            game: this.manifest,
            style,
            joined: this.joined,
            difficulty: 'easy',
            seating: 'side-by-side',
          }),
        );
      },
    }).target;
    arcade.shown(this);
  }

  snapshot(): ScreenSnapshot {
    const styles = fittingStyles(this.manifest, this.joined.length).map(({ style }) => style);
    return {
      state: {
        game: this.manifest.id,
        joined: this.joined.map((mascot, seat) => ({
          mascot,
          seat,
          color: SEAT_LOOKS[seat]!.color,
          shape: SEAT_LOOKS[seat]!.shape,
        })),
        styles,
        selected: styles[0] ?? null,
        stars: Object.fromEntries(
          [...this.stars].map(([mascot, drawn]) => [mascot, drawn.describe()]),
        ),
      },
      targets: this.targets,
    };
  }
}
