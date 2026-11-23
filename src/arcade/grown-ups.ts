import * as Phaser from 'phaser';
import type { ScreenSnapshot } from '@/contract';
import { createStage, type Stage } from '@/kit/stage';
import { colors } from '@/kit/theme';
import type { RunningAs } from '@/platform/display-mode';
import type { SafeAreaInsets } from '@/platform/safe-area';
import { describeChange, describeScreen, type ScreenMeasurement } from '@/platform/screen-watch';
import type { StorageState } from '@/platform/storage-state';
import type { UpdateState } from '@/platform/updates';
import type { ArcadeScreen, ScreenData } from './screen';
import {
  MOTION_SETTINGS,
  resetProgress,
  settingsOf,
  withMotion,
  withSound,
  type MotionSetting,
} from './settings';

/** The Grown-Ups Area's screen id. */
export const GROWN_UPS = 'grown-ups';

/** What the Grown-Ups Area tells a grown-up. */
export interface StatusReadings extends UpdateState {
  readonly buildId: string;
  readonly runningAs: RunningAs;
  readonly storage: StorageState;
  /** In CSS pixels. */
  readonly insets: SafeAreaInsets;
  readonly screen: ScreenMeasurement;
  /** Oldest first. */
  readonly screenChanges: readonly ScreenMeasurement[];
  /** The last few error messages, oldest first. */
  readonly errors: readonly string[];
}

const px = (value: number) => `${Math.round(value * 10) / 10} px`;

const STORAGE: Readonly<Record<StorageState, string>> = {
  persistent: 'Persistent: Progress is kept on this tablet.',
  'best-effort':
    'Best-effort: Progress is kept on this tablet, though the browser may clear it when space runs short.',
  'memory-only':
    'Memory-only: storage is unavailable, so Progress will not be kept after this visit.',
};

const TEXT = {
  build: ({ buildId }: StatusReadings) => buildId,
  offline: ({ offlineReady }: StatusReadings) =>
    offlineReady ? 'Ready to play offline' : 'Not ready offline yet',
  update: ({ updateWaiting }: StatusReadings) =>
    updateWaiting ? 'A newer version is waiting.' : 'No update waiting',
  'running-as': ({ runningAs }: StatusReadings) =>
    runningAs === 'installed' ? 'Installed app' : 'Browser tab',
  storage: ({ storage }: StatusReadings) => STORAGE[storage],
  insets: ({ insets }: StatusReadings) =>
    `Top ${px(insets.top)}, right ${px(insets.right)}, bottom ${px(insets.bottom)}, left ${px(insets.left)}`,
  screen: ({ screen }: StatusReadings) => describeScreen(screen).join('\n'),
  'screen-changes': ({ screenChanges }: StatusReadings) =>
    screenChanges.map(describeChange).join('\n'),
  errors: ({ errors }: StatusReadings) => (errors.length > 0 ? errors.join('\n') : 'None'),
} as const satisfies Record<string, (readings: StatusReadings) => string>;

/** The two questions Reset Progress asks, in turn. */
const RESET_QUESTIONS = [
  'Reset Progress? Every Mascot’s Stars and every Game’s remembered choices will be removed.',
  'Are you sure? This cannot be undone.',
];

/** Writes the readings into the Area's markup, which is in index.html. */
function fill(page: HTMLElement, readings: StatusReadings): void {
  for (const [reading, text] of Object.entries(TEXT)) {
    const slot = page.querySelector(`[data-reading="${reading}"]`);
    if (slot) slot.textContent = text(readings);
  }
  const update = page.querySelector<HTMLElement>('[data-action="update"]');
  if (update) update.hidden = !readings.updateWaiting;
  const install = page.querySelector<HTMLElement>('[data-install]');
  if (install) install.hidden = readings.runningAs === 'installed';
}

/**
 * The Grown-Ups Area, behind the Grown-Up Gate. Its words and controls are plain HTML over the whole
 * screen (ADR-0005), every control a real button or labelled form control under a heading; its Scene
 * draws only a backdrop and has nothing to touch, so while it shows the canvas takes no touches.
 * It holds the sound and motion settings, Update now, Reset Progress, the status readings and the
 * check screens, each of which returns here. Back returns to the Home Screen.
 */
export class GrownUpsScreen extends Phaser.Scene implements ArcadeScreen {
  stage!: Stage;

  create({ arcade }: ScreenData): void {
    const { services } = arcade;
    const { save } = services;
    this.stage = createStage(this, services.safeAreaInsets());
    this.stage.backdrop({ color: colors.cream });

    const page = services.grownUpsPage;
    const doc = page.ownerDocument;
    const listening = new AbortController();
    const on = (selector: string, type: string, listener: (target: HTMLElement) => void) => {
      for (const element of page.querySelectorAll<HTMLElement>(selector)) {
        element.addEventListener(type, () => listener(element), { signal: listening.signal });
      }
    };
    const element = <T extends HTMLElement>(selector: string) => page.querySelector<T>(selector)!;

    const show = () =>
      fill(page, {
        buildId: services.buildId,
        ...services.updates.state(),
        runningAs: services.runningAs(),
        storage: services.storage.state(),
        insets: services.safeAreaInsets(),
        screen: services.screen.now(),
        screenChanges: services.screen.changes(),
        errors: services.errors.messages(),
      });
    show();
    void services.storage.asked.then(show);
    const stopWatching = services.updates.onChange(show);
    const stopMeasuring = services.screen.onChange(show);
    const stopErrors = services.errors.onChange(show);
    this.scale.on('resize', show);

    const settings = settingsOf(save.current());
    element<HTMLInputElement>('[data-setting="sound"]').checked = settings.sound;
    on('[data-setting="sound"]', 'change', (input) =>
      save.write(withSound(save.current(), (input as HTMLInputElement).checked)),
    );
    for (const input of page.querySelectorAll<HTMLInputElement>('[data-setting="motion"]')) {
      input.checked = input.value === settings.motion;
    }
    on('[data-setting="motion"]', 'change', (input) => {
      const motion = (input as HTMLInputElement).value as MotionSetting;
      if (MOTION_SETTINGS.includes(motion)) save.write(withMotion(save.current(), motion));
    });

    on('[data-action="update"]', 'click', () => void services.updates.applyNow());

    // Reset Progress asks twice; declining at either question changes nothing.
    const confirm = element('[data-confirm]');
    const question = element('[data-question]');
    const reset = element('[data-action="reset"]');
    const done = element('[data-reset-done]');
    let asked = 0;
    const ask = (step: number) => {
      asked = step;
      confirm.hidden = step === 0;
      reset.hidden = step > 0;
      question.textContent = RESET_QUESTIONS[step - 1] ?? '';
    };
    ask(0);
    done.textContent = '';
    on('[data-action="reset"]', 'click', () => {
      done.textContent = '';
      ask(1);
    });
    on('[data-action="decline"]', 'click', () => ask(0));
    on('[data-action="confirm"]', 'click', () => {
      if (asked < RESET_QUESTIONS.length) return ask(asked + 1);
      save.write(resetProgress(save.current()));
      ask(0);
      done.textContent = 'Progress was reset.';
    });

    on('[data-action="back"]', 'click', () => arcade.show('home'));
    const checks = element('[data-checks]');
    checks.replaceChildren(
      ...arcade.checks.map((check) => {
        const item = doc.createElement('li');
        const button = item.appendChild(doc.createElement('button'));
        button.type = 'button';
        button.textContent = check.title;
        button.dataset.check = check.id;
        button.addEventListener('click', () => arcade.show(check.id), {
          signal: listening.signal,
        });
        return item;
      }),
    );
    page.hidden = false;
    page.scrollTop = 0;
    this.events.once('shutdown', () => {
      checks.replaceChildren();
      page.hidden = true;
      listening.abort();
      stopWatching();
      stopMeasuring();
      stopErrors();
      this.scale.off('resize', show);
    });
    arcade.shown(this);
  }

  snapshot(): ScreenSnapshot {
    return { state: {}, targets: {} };
  }
}
