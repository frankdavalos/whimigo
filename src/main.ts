import * as Phaser from 'phaser';
import { Arcade } from '@/arcade/arcade';
import { checkScreens } from '@/arcade/checks';
import { installTestBridge } from '@/arcade/test-bridge';
import { DESIGN_FRAME } from '@/kit/frame';
import { RENDER_SCALE } from '@/kit/stage';
import { resetTouches } from '@/kit/touches';
import { colors, cssColor } from '@/kit/theme';
import { createAudio } from '@/platform/audio';
import { installErrorScreen } from '@/platform/error-screen';
import { onPageShown } from '@/platform/lifecycle';
import { guardPage } from '@/platform/page';
import { readSafeAreaInsets } from '@/platform/safe-area';

const errorScreen = document.getElementById('error-screen');
if (errorScreen) installErrorScreen(window, errorScreen);
guardPage(document);

const e2e = new URLSearchParams(window.location.search).get('e2e') === '1';

/** The one Phaser.Game. It is never destroyed (ADR-0002). */
const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'arcade',
  width: DESIGN_FRAME.width * RENDER_SCALE,
  height: DESIGN_FRAME.height * RENDER_SCALE,
  backgroundColor: cssColor(colors.sky),
  banner: false,
  scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 10, windowEvents: false },
  // Images load straight from their own URLs, not through a fetched blob and an object URL.
  loader: { imageLoadType: 'HTMLImageElement' },
  // Phaser makes the one audio context; without Web Audio the Arcade is silent.
  audio: { noAudio: typeof window.AudioContext !== 'function' },
});
const audio = createAudio(
  document,
  game.sound instanceof Phaser.Sound.WebAudioSoundManager
    ? { manager: game.sound, cache: game.cache.audio }
    : null,
);

const arcade = new Arcade(
  game,
  { audio, safeAreaInsets: () => readSafeAreaInsets(document) },
  checkScreens({ e2e }),
);
// Touches that were down while the page was hidden may never be reported lifting.
onPageShown(document, () => resetTouches(game));
if (e2e) installTestBridge(window, arcade, __BUILD_ID__);
arcade.show('start');
