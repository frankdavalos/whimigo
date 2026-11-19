import type * as Phaser from 'phaser';
import type { ScreenSnapshot } from '@/contract';
import type { Stage } from '@/kit/stage';
import type { Arcade } from './arcade';

/** Identifies an Arcade screen: 'start', 'home', or a check screen's id. */
export type ScreenId = string;

/** Every Arcade screen is a Scene that can describe itself to the test bridge. */
export interface ArcadeScreen extends Phaser.Scene {
  readonly stage: Stage;
  snapshot(): ScreenSnapshot;
}

/** What every screen is started with. */
export interface ScreenData {
  readonly arcade: Arcade;
}

/** A check screen: a tool for grown-ups, listed on the Home Screen. */
export interface CheckScreen {
  readonly id: ScreenId;
  readonly scene: new () => ArcadeScreen;
  /** Draws the check's picture, centred on (0, 0), for its control on the Home Screen. */
  readonly icon: (graphics: Phaser.GameObjects.Graphics, size: number) => void;
}
