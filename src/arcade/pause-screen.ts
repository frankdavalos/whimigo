import * as Phaser from 'phaser';
import type { ScreenSnapshot, SnapshotTarget } from '@/contract';
import { createStage, type Stage } from '@/kit/stage';
import { iconButton } from '@/kit/controls';
import { colors, sizes } from '@/kit/theme';
import type { ArcadeScreen, ScreenData } from './screen';

/** The pause screen's key. */
export const PAUSE = 'pause';

export interface PauseData extends ScreenData {
  /** Resumes the Round as it was. */
  readonly play: () => void;
  /** Closes the Game with no Result. */
  readonly home: () => void;
  /** Shows the Game's Demo. */
  readonly demo: () => void;
}

/**
 * Shown over a paused Round: play, home and show-the-Demo. Only this Scene accepts input while it
 * shows (ADR-0004). Its play target is the large, real tap that browsers require before sound may
 * resume after the page was hidden.
 */
export class PauseScreen extends Phaser.Scene implements ArcadeScreen {
  stage!: Stage;
  private targets: Record<string, SnapshotTarget> = {};

  create({ arcade, play, home, demo }: PauseData): void {
    this.stage = createStage(this, arcade.services.safeAreaInsets());
    const { safe } = this.stage;
    const middle = { x: safe.x + safe.width / 2, y: safe.y + safe.height / 2 };
    this.add.rectangle(middle.x, middle.y, safe.width, safe.height, colors.cream, 0.92);

    const spacing = sizes.button + sizes.gap * 2;
    const button = (x: number, icon: string, onTap: () => void) =>
      iconButton(this, { x, y: middle.y, icon, onTap }).target;
    this.targets = {
      home: button(middle.x - spacing, 'arcade/home', home),
      play: button(middle.x, 'arcade/resume', play),
      demo: button(middle.x + spacing, 'arcade/demo', demo),
    };
    arcade.shown(this);
  }

  snapshot(): ScreenSnapshot {
    return { state: null, targets: this.targets };
  }
}
