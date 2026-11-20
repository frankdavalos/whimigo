import * as Phaser from 'phaser';
import type { ScreenSnapshot } from '@/contract';
import { createStage, type Stage } from '@/kit/stage';
import { colors } from '@/kit/theme';
import type { RunningAs } from '@/platform/display-mode';
import type { SafeAreaInsets } from '@/platform/safe-area';
import type { UpdateState } from '@/platform/updates';
import type { ArcadeScreen, ScreenData } from './screen';

/** The status page's screen id. */
export const GROWN_UPS = 'grown-ups';

/** What the status page tells a grown-up. */
export interface StatusReadings extends UpdateState {
  readonly buildId: string;
  readonly runningAs: RunningAs;
  /** In CSS pixels. */
  readonly insets: SafeAreaInsets;
}

const px = (value: number) => `${Math.round(value * 10) / 10} px`;

const TEXT = {
  build: ({ buildId }: StatusReadings) => buildId,
  offline: ({ offlineReady }: StatusReadings) =>
    offlineReady ? 'Ready to play offline' : 'Not ready offline yet',
  update: ({ updateWaiting }: StatusReadings) =>
    updateWaiting
      ? 'An update is waiting. It is applied the next time the Arcade starts.'
      : 'No update waiting',
  'running-as': ({ runningAs }: StatusReadings) =>
    runningAs === 'installed' ? 'Installed app' : 'Browser tab',
  insets: ({ insets }: StatusReadings) =>
    `Top ${px(insets.top)}, right ${px(insets.right)}, bottom ${px(insets.bottom)}, left ${px(insets.left)}`,
} as const satisfies Record<string, (readings: StatusReadings) => string>;

/** Writes the readings into the status page's markup, which is in index.html. */
function fill(page: HTMLElement, readings: StatusReadings): void {
  for (const [reading, text] of Object.entries(TEXT)) {
    const slot = page.querySelector(`[data-reading="${reading}"]`);
    if (slot) slot.textContent = text(readings);
  }
}

/**
 * The adult status page, the seed of the Grown-Ups Area. Its words are plain HTML over the whole
 * screen (ADR-0005); its Scene draws only a backdrop and has nothing to touch, so while the page
 * shows the canvas takes no touches. Back returns to the Home Screen.
 */
export class GrownUpsScreen extends Phaser.Scene implements ArcadeScreen {
  stage!: Stage;

  create({ arcade }: ScreenData): void {
    const { services } = arcade;
    this.stage = createStage(this, services.safeAreaInsets());
    this.stage.backdrop({ color: colors.cream });

    const page = services.grownUpsPage;
    const show = () =>
      fill(page, {
        buildId: services.buildId,
        ...services.updates.state(),
        runningAs: services.runningAs(),
        insets: services.safeAreaInsets(),
      });
    show();
    const stopWatching = services.updates.onChange(show);
    this.scale.on('resize', show);
    const back = page.querySelector('button');
    const goHome = () => arcade.show('home');
    back?.addEventListener('click', goHome);
    page.hidden = false;
    this.events.once('shutdown', () => {
      page.hidden = true;
      stopWatching();
      this.scale.off('resize', show);
      back?.removeEventListener('click', goHome);
    });
    arcade.shown(this);
  }

  snapshot(): ScreenSnapshot {
    return { state: {}, targets: {} };
  }
}
