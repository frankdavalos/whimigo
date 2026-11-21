import * as Phaser from 'phaser';
import type { RoundStart, SnapshotTarget } from '@/contract';
import { picture } from '@/kit/atlas';
import { openRound } from '@/kit/round';
import { colors } from '@/kit/theme';
import { turnGate } from '@/kit/turn-gate';
import { advance, padCount, playingAt, press, result, start, type Pad } from '../logic/rules';
import { PADS } from '../pads';

/** A pad's size, and the distance between the centres of two neighbours, in design units. */
const PAD = 640;
const SPACING = 736;
/** How long a pressed pad stays lit, in Round time. */
const PRESSED_FOR = 300;

/** Where each pad sits, in spacings from the middle: a square of four, or a triangle of three. */
const PLACES: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  3: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0, 0.5],
  ],
  4: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
  ],
};

/** The Arcade plays a growing sequence of lit pads and tones; the Player repeats it. */
export class ColorEchoScene extends Phaser.Scene {
  /** Moves the Round on, once a frame. */
  private step: () => void = () => undefined;

  override update(): void {
    this.step();
  }

  create(begin: RoundStart): void {
    const round = openRound(this, begin);
    const { safe } = round.stage;
    round.stage.backdrop({ color: colors.sky });
    const pads = PADS.slice(0, padCount(round.session.difficulty));
    const middle = { x: safe.x + safe.width / 2, y: safe.y + safe.height / 2 };
    const gate = turnGate(this);

    let echo = start({ difficulty: round.session.difficulty, rng: round.rng, at: round.now() });
    /** The step of the sequence last lit, so each step's tone is asked for once. */
    let played: string | null = null;
    let pressed: { pad: Pad; until: number } | null = null;

    const targets: Record<string, SnapshotTarget> = {};
    const images = pads.map((pad, index) => {
      const [across, down] = PLACES[pads.length]![index]!;
      const x = middle.x + across * SPACING;
      const y = middle.y + down * SPACING;
      targets[`pad-${pad.name}`] = {
        x,
        y,
        rect: { x: x - PAD / 2, y: y - PAD / 2, width: PAD, height: PAD },
      };
      return picture(this, x, y, pad.frame);
    });

    const show = (lit: Pad | null) =>
      images.forEach((image, index) =>
        image.setFrame(index === lit ? pads[index]!.litFrame : pads[index]!.frame),
      );
    /** Lights a pad and asks for its tone together, so they share a Scene time. */
    const sound = (pad: Pad) => {
      show(pad);
      round.audio.sfx(pads[pad]!.tone);
    };

    const onPress = (pad: Pad) => {
      const now = round.now();
      const pressing = press(echo, pad, now);
      if (pressing.outcome === 'ignored') {
        round.refuse(images[pad]!);
        return;
      }
      echo = pressing.echo;
      pressed = { pad, until: now + PRESSED_FOR };
      sound(pad);
      const ended = result(echo);
      if (!ended) return;
      gate.close();
      round.audio.sfx(pressing.outcome === 'wrong' ? 'wrong' : 'win');
      round.finish(ended);
    };

    pads.forEach((pad, index) => {
      const { rect } = targets[`pad-${pad.name}`]!;
      this.add
        .rectangle(rect.x + PAD / 2, rect.y + PAD / 2, PAD, PAD)
        .setInteractive()
        .on(
          'pointerdown',
          gate.guard(() => onPress(index)),
        );
    });

    this.step = () => {
      const now = round.now();
      echo = advance(echo, now);
      let lit: Pad | null = null;
      if (echo.phase === 'playing') {
        const playing = playingAt(echo, now);
        const step = playing.step === null ? null : `${echo.since}:${playing.step}`;
        if (step !== null && step !== played) sound(playing.lit!);
        played = step ?? played;
        lit = playing.lit;
      }
      if (pressed && now < pressed.until) lit = pressed.pad;
      else pressed = null;
      show(lit);
    };

    // Follow the lights: the hand taps two pads, then shows that a third is not the one.
    const at = (index: number) => {
      const { x, y } = targets[`pad-${pads[index]!.name}`]!;
      return { x, y };
    };
    void round.demo([
      { wait: 400 },
      { tap: at(0) },
      { wait: 300 },
      { tap: at(1) },
      { wait: 300 },
      { refuse: at(2) },
    ]);

    round.expose(() => ({
      state: {
        phase: echo.phase,
        length: echo.length,
        entered: echo.entered,
        completed: echo.completed,
        pads: pads.map((pad) => pad.name),
        sequence: echo.sequence.slice(0, echo.length),
        result: result(echo),
      },
      targets,
    }));
  }
}
