import * as Phaser from 'phaser';
import type { ScreenSnapshot } from '@/contract';
import { createStage, type Stage } from '@/kit/stage';
import { colors } from '@/kit/theme';
import type { RunningAs } from '@/platform/display-mode';
import type { SafeAreaInsets } from '@/platform/safe-area';
import { describeChange, describeScreen, type ScreenMeasurement } from '@/platform/screen-watch';
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
  readonly screen: ScreenMeasurement;
  /** Oldest first. */
  readonly screenChanges: readonly ScreenMeasurement[];
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
  screen: ({ screen }: StatusReadings) => describeScreen(screen).join('\n'),
  'screen-changes': ({ screenChanges }: StatusReadings) =>
    screenChanges.map(describeChange).join('\n'),
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
 * shows the canvas takes no touches. It lists the check screens, each a button that opens it.
 * Back returns to the Home Screen.
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
        screen: services.screen.now(),
        screenChanges: services.screen.changes(),
      });
    show();
    const stopWatching = services.updates.onChange(show);
    const stopMeasuring = services.screen.onChange(show);
    this.scale.on('resize', show);
    const back = page.querySelector('[data-action="back"]');
    const goHome = () => arcade.show('home');
    back?.addEventListener('click', goHome);
    const checks = page.querySelector('[data-checks]');
    checks?.replaceChildren(
      ...arcade.checks.map((check) => {
        const item = page.ownerDocument.createElement('li');
        const button = item.appendChild(page.ownerDocument.createElement('button'));
        button.type = 'button';
        button.textContent = check.title;
        button.dataset.check = check.id;
        button.addEventListener('click', () => arcade.show(check.id));
        return item;
      }),
    );
    page.hidden = false;
    this.events.once('shutdown', () => {
      checks?.replaceChildren();
      page.hidden = true;
      stopWatching();
      stopMeasuring();
      this.scale.off('resize', show);
      back?.removeEventListener('click', goHome);
    });
    arcade.shown(this);
  }

  snapshot(): ScreenSnapshot {
    return { state: {}, targets: {} };
  }
}
