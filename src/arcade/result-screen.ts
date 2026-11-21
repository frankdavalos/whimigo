import * as Phaser from 'phaser';
import type { MascotId, Result, ScreenSnapshot, Session, SnapshotTarget } from '@/contract';
import { picture } from '@/kit/atlas';
import { createStage, type Stage } from '@/kit/stage';
import { tapButton } from '@/kit/tap-button';
import { colors, sizes } from '@/kit/theme';
import type { Stars } from './progress';
import { mascotFrame } from './mascots';
import type { ArcadeScreen, ScreenData } from './screen';
import { drawStarCount } from './star-count';

/** The Result screen's key. */
export const RESULT = 'result';

export interface ResultData extends ScreenData {
  readonly result: Result;
  readonly session: Session;
  /** The Stars each Player's Mascot earned from the Round. */
  readonly stars: Stars;
  readonly replay: () => void;
  readonly home: () => void;
}

/**
 * The Mascots a Result celebrates: the winners', or every Player's for a draw or anything played
 * together. Computer Players have no Mascot and are never celebrated.
 */
export function celebrated(result: Result, session: Session): MascotId[] {
  return session.seats.flatMap((seat) => {
    if (seat.occupant.kind !== 'player') return [];
    if (result.kind === 'win' && !result.winners.includes(seat.index)) return [];
    return [seat.occupant.mascot];
  });
}

/**
 * Shows how a Round ended, over the Game's paused Scene: the celebrated Mascots, then replay and
 * home. Only this Scene accepts input while it shows (ADR-0004).
 */
export class ResultScreen extends Phaser.Scene implements ArcadeScreen {
  stage!: Stage;
  private state: { result: Result; celebrated: MascotId[]; stars: Stars } | null = null;
  private targets: Record<string, SnapshotTarget> = {};

  create({ arcade, result, session, stars, replay, home }: ResultData): void {
    this.stage = createStage(this, arcade.services.safeAreaInsets());
    const { safe } = this.stage;
    const middle = { x: safe.x + safe.width / 2, y: safe.y + safe.height / 2 };
    this.add.rectangle(middle.x, middle.y, safe.width, safe.height, colors.cream, 0.92);

    const mascots = celebrated(result, session);
    const spacing = sizes.button + sizes.gap;
    mascots.forEach((mascot, index) => {
      const x = middle.x + (index - (mascots.length - 1) / 2) * spacing;
      picture(this, x, middle.y - 280, 'arcade/sun').setScale(0.6);
      picture(this, x, middle.y - 200, mascotFrame(mascot));
      drawStarCount(this, x, middle.y + 70, stars[mascot] ?? 0);
    });

    this.state = {
      result,
      celebrated: mascots,
      stars: Object.fromEntries(mascots.map((mascot) => [mascot, stars[mascot] ?? 0])),
    };
    this.targets = {
      replay: tapButton(this, {
        x: middle.x - spacing,
        y: middle.y + 360,
        icon: 'arcade/replay',
        onTap: replay,
      }).target,
      home: tapButton(this, {
        x: middle.x + spacing,
        y: middle.y + 360,
        icon: 'arcade/home',
        onTap: home,
      }).target,
    };
    arcade.shown(this);
  }

  snapshot(): ScreenSnapshot {
    return { state: this.state, targets: this.targets };
  }
}
