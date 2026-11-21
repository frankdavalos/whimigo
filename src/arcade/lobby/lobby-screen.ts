import * as Phaser from 'phaser';
import type {
  Difficulty,
  GameManifest,
  MascotId,
  Motion,
  PlayStyle,
  ScreenSnapshot,
  Seating,
  SnapshotTarget,
} from '@/contract';
import {
  button,
  iconButton,
  seatBadge,
  type Button,
  type IconButton,
  type SeatBadge,
} from '@/kit/controls';
import type { DrawnNumber } from '@/kit/digits';
import { createMotion } from '@/kit/motion';
import { createStage, type Stage } from '@/kit/stage';
import { seats as SEAT_LOOKS, sizes } from '@/kit/theme';
import { MASCOTS, mascotFrame } from '../mascots';
import type { ArcadeScreen, ScreenData } from '../screen';
import { drawStarCount } from '../star-count';
import type { Arcade } from '../arcade';
import { openLobby, rememberSeating, startSession } from './memory';
import { DIFFICULTIES, SEATINGS, lobbyView, tapMascot, type LobbyChoices } from './rules';

/** The lobby's key. */
export const LOBBY = 'lobby';

export interface LobbyData extends ScreenData {
  readonly game: GameManifest;
}

/** Mascots stand in two rows of this many. */
const PER_ROW = 4;
/** From one row of Mascots to the next, leaving room for each Mascot's Stars beneath it. */
const ROW_SPACING = sizes.button + 256;
/** A Mascot's Stars, below its centre. */
const STARS_BELOW = sizes.button / 2 + 80;
/** The Seat badge a joined Mascot wears at its shoulder. */
const BADGE = 128;
/** The pictures of the choices: Play Style, Difficulty and Seating, one row each. */
const CHOICE = 256;
/** From one choice to the next in a row, centre to centre. */
const CHOICE_SPACING = CHOICE + sizes.gap;
/** From one row of choices to the next, centre to centre: a little more, to set the rows apart. */
const CHOICE_ROW_SPACING = CHOICE + sizes.gap * 1.5;

/** The rows of choices, top to bottom, each named by the targets it holds. */
type Row = 'style' | 'difficulty' | 'seating';

/**
 * Where Players sit down for a Game. Each taps a Mascot, which takes the lowest free Seat and wears
 * its shape in its colour; tapping it again frees the Seat. The choices that fit those who sat
 * down are offered as pictures down the right: Play Style when several fit, Difficulty when the
 * Play Style uses it, Seating with two or more Players. It opens with the choices last made for
 * this Game, so one press of start begins the same Session again.
 */
export class LobbyScreen extends Phaser.Scene implements ArcadeScreen {
  stage!: Stage;
  private arcade!: Arcade;
  private manifest!: GameManifest;
  private motion!: Motion;
  private choices!: LobbyChoices;
  private refusals = 0;
  private mascots = new Map<MascotId, Button>();
  private badges = new Map<MascotId, SeatBadge>();
  private stars = new Map<MascotId, DrawnNumber>();
  private rows!: Record<Row, Map<string, Button>>;
  private fixed: Record<string, SnapshotTarget> = {};
  private startButton!: IconButton;

  create({ arcade, game }: LobbyData): void {
    this.arcade = arcade;
    this.manifest = game;
    this.refusals = 0;
    this.choices = openLobby(arcade.services.save.current(), game);
    this.motion = createMotion(this, arcade.services.reducedMotion());
    this.stage = createStage(this, arcade.services.safeAreaInsets());
    this.stage.backdrop({ color: game.card.color });
    const { safe } = this.stage;
    const half = sizes.button / 2;

    this.mascots = new Map();
    this.badges = new Map();
    this.stars = new Map();
    const saved = arcade.services.save.current().mascots;
    const spacing = sizes.button + sizes.gap;
    const top = safe.y + sizes.button + sizes.gap * 3 + half;
    MASCOTS.forEach((mascot, index) => {
      const x = safe.x + half + (index % PER_ROW) * spacing;
      const y = top + Math.floor(index / PER_ROW) * ROW_SPACING;
      this.mascots.set(
        mascot,
        button(this, { x, y, frame: mascotFrame(mascot), onTap: () => this.tapMascot(mascot) }),
      );
      this.stars.set(mascot, drawStarCount(this, x, y + STARS_BELOW, saved[mascot]?.stars ?? 0));
      this.badges.set(mascot, seatBadge(this, { x: x + half - 32, y: y - half + 32, size: BADGE }));
    });

    const choice = (frame: string, onTap: () => void) =>
      button(this, { x: 0, y: 0, frame, size: CHOICE, onTap });
    const row = <T extends string>(
      prefix: string,
      values: readonly T[],
      onTap: (value: T) => void,
    ) =>
      new Map(
        values.map((value) => [value, choice(`arcade/${prefix}-${value}`, () => onTap(value))]),
      );
    this.rows = {
      style: row<PlayStyle>(
        'style',
        game.playStyles.map(({ style }) => style),
        (style) => this.change({ style }),
      ),
      difficulty: row<Difficulty>('difficulty', DIFFICULTIES, (difficulty) =>
        this.change({ difficulty }),
      ),
      seating: row<Seating>('seating', SEATINGS, (seating) => this.chooseSeating(seating)),
    };

    this.fixed = {
      home: iconButton(this, {
        x: safe.x + half,
        y: safe.y + half,
        icon: 'arcade/home',
        onTap: () => arcade.show('home'),
      }).target,
    };
    this.startButton = iconButton(this, {
      x: safe.x + safe.width - half,
      y: safe.y + safe.height - half,
      icon: 'arcade/play',
      onTap: () => this.start(),
    });
    this.fixed.start = this.startButton.target;
    this.refresh();
    arcade.shown(this);
  }

  private tapMascot(mascot: MascotId): void {
    const { joined, refused } = tapMascot(this.choices.joined, mascot);
    if (refused) {
      this.refusals += 1;
      void this.motion.play(this.mascots.get(mascot)!.face, 'wiggle');
      return;
    }
    this.change({ joined });
  }

  private chooseSeating(seating: Seating): void {
    const { save } = this.arcade.services;
    save.write(rememberSeating(save.current(), seating));
    this.change({ seating });
  }

  private change(choices: Partial<LobbyChoices>): void {
    this.choices = { ...this.choices, ...choices };
    this.refresh();
  }

  private start(): void {
    const { save } = this.arcade.services;
    const started = startSession(save.current(), this.manifest, this.choices);
    if (!started) return;
    save.write(started.document);
    this.arcade.host.open(started.session);
  }

  /** Draws the Seats and the choices offered for what has been chosen. */
  private refresh(): void {
    const { joined } = this.choices;
    for (const [mascot, badge] of this.badges) {
      const seat = joined.indexOf(mascot);
      badge.show(seat < 0 ? null : SEAT_LOOKS[seat]!);
    }
    const view = lobbyView(this.manifest, this.choices);
    const offered: Record<Row, readonly string[]> = {
      style: view.styles.length > 1 ? view.styles.map(({ style }) => style) : [],
      difficulty: view.difficulties,
      seating: view.seatings,
    };
    const selected: Record<Row, string | null> = {
      style: view.style?.style ?? null,
      difficulty: view.session?.difficulty ?? null,
      seating: view.seating,
    };
    const { safe } = this.stage;
    const right = safe.x + safe.width - CHOICE / 2;
    (['style', 'difficulty', 'seating'] as const).forEach((name, index) => {
      const y = safe.y + CHOICE / 2 + index * CHOICE_ROW_SPACING;
      const shown = offered[name];
      for (const [value, control] of this.rows[name]) {
        const at = shown.indexOf(value);
        if (at < 0) control.hide();
        else control.show(right - (shown.length - 1 - at) * CHOICE_SPACING, y);
        control.setSelected(value === selected[name]);
      }
    });
    this.startButton.setAvailable(view.session !== null);
  }

  snapshot(): ScreenSnapshot {
    const view = lobbyView(this.manifest, this.choices);
    const targets: Record<string, SnapshotTarget> = { ...this.fixed };
    for (const [mascot, control] of this.mascots) targets[`mascot-${mascot}`] = control.target;
    for (const [name, row] of Object.entries(this.rows)) {
      for (const [value, control] of row) {
        if (control.shown) targets[`${name}-${value}`] = control.target;
      }
    }
    return {
      state: {
        game: this.manifest.id,
        mascots: MASCOTS.map((mascot) => ({ mascot, frame: mascotFrame(mascot) })),
        joined: this.choices.joined.map((mascot, seat) => ({
          mascot,
          seat,
          color: SEAT_LOOKS[seat]!.color,
          shape: SEAT_LOOKS[seat]!.shape,
        })),
        refusals: this.refusals,
        styles: view.styles.map(({ style }) => style),
        style: view.style?.style ?? null,
        difficulties: view.difficulties,
        difficulty: view.difficulties.length > 0 ? (view.session?.difficulty ?? null) : null,
        seatings: view.seatings,
        seating: view.seating,
        start: { available: view.session !== null },
        stars: Object.fromEntries(
          [...this.stars].map(([mascot, drawn]) => [mascot, drawn.describe()]),
        ),
      },
      targets,
    };
  }
}
