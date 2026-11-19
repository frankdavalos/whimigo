import * as Phaser from 'phaser';
import type { ScreenSnapshot, SnapshotTarget } from '@/contract';
import { picture } from '@/kit/atlas';
import { holdButton } from '@/kit/hold-button';
import { createStage, type Stage } from '@/kit/stage';
import { tapButton } from '@/kit/tap-button';
import { colors, sizes } from '@/kit/theme';
import type { Audio, AudioState } from '@/platform/audio';
import { onPageHidden, onPageShown } from '@/platform/lifecycle';
import type { ArcadeScreen, CheckScreen, ScreenData } from '../screen';
import { type CheckSound, checkSounds } from './sound-check-sounds';
import { LOG_CAP, logEvent, type SoundLog, type SoundLogEntry } from './sound-log';

const SOUNDS = Object.keys(checkSounds) as CheckSound[];
const keyOf = (sound: CheckSound) => `sound-check/${sound}`;
const iconOf = (sound: CheckSound) => `arcade/sound-${sound}`;
const stateIcon = (state: AudioState) => `arcade/audio-${state}`;

/** The sound controls stand in two rows: four, then three. */
const ROWS: readonly (readonly CheckSound[])[] = [SOUNDS.slice(0, 4), SOUNDS.slice(4)];
/** Centre to centre, between neighbouring sound controls: wider than the least gap. */
const SPACING = sizes.button + 96;

/**
 * The Sound check: the measuring tool for gate G4, kept in the product. One control plays each
 * sound in its set, and a picture shows the audio state. Its sounds are rendered when it opens and
 * discarded when it is left. Its snapshot carries a capped log of each change of audio state and
 * each time the page is hidden or shown, with the time since it opened, held in memory only.
 *
 * The leave control stands halfway down the left of the safe rectangle, where every check screen
 * has it. The audio state picture and the two rows of sound controls are centred in the rest.
 */
class SoundCheckScreen extends Phaser.Scene implements ArcadeScreen {
  stage!: Stage;
  private audio!: Audio;
  private targets: Record<string, SnapshotTarget> = {};
  private statePicture!: Phaser.GameObjects.Image;
  private last: { sound: CheckSound; started: boolean } | null = null;
  private log: SoundLog = [];

  create({ arcade }: ScreenData): void {
    this.stage = createStage(this, arcade.services.safeAreaInsets());
    this.stage.backdrop({ color: colors.cream });
    const { safe } = this.stage;
    const audio = (this.audio = arcade.services.audio);
    this.last = null;

    const opened = performance.now();
    const record = (event: SoundLogEntry['event']) => {
      this.log = logEvent(this.log, event, performance.now() - opened);
    };
    this.log = [];
    record(audio.state());
    const stopListening = [
      audio.onStateChange(record),
      onPageHidden(document, () => record('hidden')),
      onPageShown(document, () => record('visible')),
    ];

    for (const sound of SOUNDS) audio.load(keyOf(sound), checkSounds[sound]);
    this.events.once('shutdown', () => {
      for (const sound of SOUNDS) audio.unload(keyOf(sound));
      for (const stop of stopListening) stop();
    });

    // The middle of the safe rectangle to the right of the leave control's column.
    const middle = {
      x: (safe.x + sizes.button + sizes.gap + safe.x + safe.width) / 2,
      y: safe.y + safe.height / 2,
    };

    this.targets = {
      leave: holdButton(this, {
        x: safe.x + sizes.button / 2,
        y: middle.y,
        icon: 'arcade/home',
        onHold: () => arcade.show('home'),
      }),
    };
    ROWS.forEach((row, rowIndex) => {
      row.forEach((sound, index) => {
        this.targets[sound] = tapButton(this, {
          x: middle.x + (index - (row.length - 1) / 2) * SPACING,
          y: middle.y - 100 + rowIndex * SPACING,
          icon: iconOf(sound),
          onTap: () => {
            this.last = { sound, started: audio.play(keyOf(sound)) };
          },
        }).target;
      });
    });

    this.statePicture = picture(this, middle.x, middle.y - 560, stateIcon(audio.state()));
    arcade.shown(this);
  }

  override update(): void {
    const icon = stateIcon(this.audio.state());
    if (this.statePicture.frame.name !== icon) this.statePicture.setFrame(icon);
  }

  snapshot(): ScreenSnapshot {
    const { audio } = this;
    return {
      state: {
        route: audio.route,
        audio: audio.state(),
        picture: this.statePicture.frame.name,
        sounds: SOUNDS.map((name) => ({ name, key: keyOf(name), icon: iconOf(name) })),
        last: this.last,
        playing: audio.playing(),
        log: this.log,
        logCap: LOG_CAP,
      },
      targets: this.targets,
    };
  }
}

export const soundCheck: CheckScreen = {
  id: 'sound-check',
  scene: SoundCheckScreen,
  icon: 'arcade/check-sound',
};
