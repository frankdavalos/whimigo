import * as Phaser from 'phaser';
import { Arcade } from '@/arcade/arcade';
import { checkScreens } from '@/arcade/checks';
import { installTestBridge } from '@/arcade/test-bridge';
import { DESIGN_FRAME } from '@/kit/frame';
import { renderScaleFor } from '@/kit/render-scale';
import { resetTouches } from '@/kit/touches';
import { colors, cssColor } from '@/kit/theme';
import { createAudio } from '@/platform/audio';
import { runningAs } from '@/platform/display-mode';
import { watchScreen } from '@/platform/screen-watch';
import { installErrorScreen } from '@/platform/error-screen';
import { onPageShown } from '@/platform/lifecycle';
import { guardPage } from '@/platform/page';
import { readSafeAreaInsets } from '@/platform/safe-area';
import { createUpdates } from '@/platform/updates';

const errorScreen = document.getElementById('error-screen');
if (errorScreen) installErrorScreen(window, errorScreen);
guardPage(document);

const e2e = new URLSearchParams(window.location.search).get('e2e') === '1';
const renderScale = renderScaleFor(window.location.search);

/** The box the canvas fills. */
const arcadeBox = document.getElementById('arcade')!;
// Measured from the start, so the grown-ups' status page can show how the screen has changed.
const screen = watchScreen(window, arcadeBox);

/** The one Phaser.Game. It is never destroyed (ADR-0002). */
const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'arcade',
  width: DESIGN_FRAME.width * renderScale,
  height: DESIGN_FRAME.height * renderScale,
  backgroundColor: cssColor(colors.sky),
  banner: false,
  scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 10, windowEvents: false },
  // Images load straight from their own URLs, not through a fetched blob and an object URL.
  loader: { imageLoadType: 'HTMLImageElement' },
  // Phaser makes the one audio context; without Web Audio the Arcade is silent.
  audio: { noAudio: typeof window.AudioContext !== 'function' },
});

// Phaser sizes the canvas from the box when the window reports a resize. An installed iPad app
// that turns from landscape to portrait reports it before the box has its new width, and Phaser's
// own recheck never caught up (device checklist items 13 and 14). So the canvas also follows the
// box whenever the box itself changes size.
game.events.once(Phaser.Core.Events.READY, () => {
  new ResizeObserver(() => {
    if (game.scale.getParentBounds()) game.scale.refresh();
  }).observe(arcadeBox);
});

const audio = createAudio(
  document,
  game.sound instanceof Phaser.Sound.WebAudioSoundManager
    ? { manager: game.sound, cache: game.cache.audio }
    : null,
);

const base = import.meta.env.BASE_URL;
const updates = createUpdates(window, { script: `${base}sw.js`, scope: base });

const arcade = new Arcade(
  game,
  {
    buildId: __BUILD_ID__,
    audio,
    safeAreaInsets: () => readSafeAreaInsets(document),
    updates,
    runningAs: () => runningAs(window),
    grownUpsPage: document.getElementById('grown-ups')!,
    screen,
  },
  checkScreens({ e2e }),
);
// Touches that were down while the page was hidden may never be reported lifting.
onPageShown(document, () => resetTouches(game));
if (e2e) installTestBridge(window, arcade);
// The development server has no service worker.
void (import.meta.env.PROD ? updates.start() : Promise.resolve()).then(() => arcade.show('start'));
