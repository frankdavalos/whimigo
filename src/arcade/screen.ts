import type * as Phaser from 'phaser';
import type { ScreenSnapshot, Stage } from '@/contract';
import type { Arcade } from './arcade';

/** Identifies a screen: an Arcade screen's key, a check screen's id, or a Game's id. */
export type ScreenId = string;

/** Every Arcade screen is a Scene that can describe itself to the test bridge. */
export interface ArcadeScreen extends Phaser.Scene {
  readonly stage: Stage;
  snapshot(): ScreenSnapshot;
}

/** What is on show: an Arcade screen, or a Game's Scene playing a Round. */
export interface Shown {
  readonly id: ScreenId;
  readonly scene: Phaser.Scene;
  readonly stage: Stage;
  snapshot(): ScreenSnapshot;
}

/** What every Arcade screen is started with. Some screens are given more. */
export interface ScreenData {
  readonly arcade: Arcade;
}

/** A check screen: a tool for grown-ups, opened from the Grown-Ups Area. */
export interface CheckScreen {
  readonly id: ScreenId;
  /** Its name in the Grown-Ups Area. */
  readonly title: string;
  readonly scene: new () => ArcadeScreen;
  /** A frame in the Arcade's atlas that pictures it. */
  readonly icon: string;
}
