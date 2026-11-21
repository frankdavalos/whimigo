/**
 * Types shared between the Arcade, the kit and Games. No runtime code.
 * Names and shapes follow docs/architecture/game-contract.md.
 */
import type * as Phaser from 'phaser';

/** Kebab-case, unique and stable for ever: it is a storage key and an asset namespace. */
export type GameId = string;

/** The stable identifier of a Mascot, such as 'fox'. Progress is keyed by it, so it never changes. */
export type MascotId = string;

/** How Seats share a Game. */
export type PlayStyle = 'solo' | 'versus-computer' | 'turn-based' | 'simultaneous' | 'cooperative';

/** A rectangle in design units. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A named point a test may tap, with the rectangle that accepts the touch. */
export interface SnapshotTarget {
  readonly x: number;
  readonly y: number;
  readonly rect: Rect;
}

/**
 * For automated tests only: a plain JSON picture of what a screen shows.
 * Targets are in design units; the test bridge converts them to page coordinates.
 */
export interface ScreenSnapshot {
  readonly state: unknown;
  readonly targets: Readonly<Record<string, SnapshotTarget>>;
}

/** A Seat's position in a Session. Seat 0 is the first Player to join. */
export type SeatIndex = 0 | 1 | 2 | 3;

/** How the Players are sitting. Decides where Zones go and which way they face. */
export type Seating = 'side-by-side' | 'around-the-table';

/** The region of the screen that belongs to one Seat during simultaneous play. */
export interface Zone {
  readonly seat: SeatIndex;
  readonly rect: Rect;
  /** Which way the Player in this Zone is facing, in degrees. */
  readonly facing: 0 | 180;
}

/** A touch that belongs to a Seat. */
export interface SeatTouch {
  readonly seat: SeatIndex;
  /** Position in the Seat's Zone-local coordinates, already rotated for its facing. */
  readonly x: number;
  readonly y: number;
  /** The browser's timestamp for the touch, in milliseconds. Use this, not frame time, to order touches. */
  readonly time: number;
}

/** A sound described as data. Rendered to a buffer once, when it is loaded (ADR-0014). */
export interface SoundRecipe {
  readonly notes: readonly Note[];
}

export interface Note {
  readonly wave: 'sine' | 'triangle' | 'square' | 'sawtooth' | 'noise';
  /** Pitch in hertz at the start of the note. Ignored for noise. */
  readonly from: number;
  /** Pitch at the end, for a glide. Defaults to `from`. */
  readonly to?: number;
  /** When the note starts, in milliseconds from the start of the sound. */
  readonly at: number;
  /** How long it lasts, in milliseconds. */
  readonly for: number;
  /** Loudness from 0 to 1. Defaults to 0.5. */
  readonly gain?: number;
  /** Fade-in and fade-out times in milliseconds. Short defaults prevent clicks. */
  readonly attack?: number;
  readonly release?: number;
}

/** A Round's random source, seeded from its RoundStart. The same seed gives the same Round. */
export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** A whole number in [min, max], inclusive. */
  int(min: number, max: number): number;
  /** One item of a list that is not empty. */
  pick<T>(items: readonly T[]): T;
  /** A new list holding the same items in a new order. The list given is unchanged. */
  shuffle<T>(items: readonly T[]): T[];
}

/** One of three levels chosen for a Session, which each Game interprets in its own way. */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** Scores by Seat, where a Game keeps them. */
export type Scores = Readonly<Partial<Record<SeatIndex, number>>>;

/**
 * How a Round ended. A Game reports what happened; the Arcade decides what it is worth.
 * Leaving a Round before it ends produces no Result.
 */
export type Result =
  | { readonly kind: 'win'; readonly winners: readonly SeatIndex[]; readonly scores?: Scores }
  | { readonly kind: 'draw'; readonly scores?: Scores }
  | { readonly kind: 'cooperative'; readonly success: boolean; readonly score?: number }
  | { readonly kind: 'solo'; readonly score: number };

/** One way a Game can be played. The lobby offers those that fit the Players who joined. */
export interface PlayStyleOption {
  readonly style: PlayStyle;
  /** How many Players (people) this style accepts. */
  readonly players: { readonly min: number; readonly max: number };
  /** Computer Players the Arcade adds to the Session. Zero unless the style is 'versus-computer'. */
  readonly computerPlayers: number;
  /** True if each Seat gets its own Zone; false means one shared board. */
  readonly zoned: boolean;
}

/**
 * What the Home Screen and the lobby know of a Game. Always loaded, so it stays tiny: it imports
 * no Scene, no rules and no assets.
 */
export interface GameManifest {
  readonly id: GameId;
  /** For grown-ups, tests and logs. Children know a Game by its Game Card. */
  readonly title: string;
  /** The youngest age the Game is meant for. Shown to grown-ups only. */
  readonly minAge: number;
  readonly playStyles: readonly PlayStyleOption[];
  /** False for a Game where Difficulty means nothing. */
  readonly usesDifficulty: boolean;
  /** The Game Card: a frame in the Arcade's atlas (`arcade/…`) and a theme colour. */
  readonly card: { readonly frame: string; readonly color: number };
  /** Loads the module. A literal dynamic import, so the bundler makes one chunk per Game. */
  readonly load: () => Promise<{ readonly default: GameModule }>;
}

/** One file of a Game's pack, as Phaser's loader takes it: its type, its key and its URLs. */
export interface PackFile {
  readonly type: string;
  readonly key: string;
  readonly [setting: string]: unknown;
}

/** Every asset a Game needs, loaded in one go. */
export interface GamePack {
  readonly files: readonly PackFile[];
}

/** What a Game brings when it is opened. */
export interface GameModule {
  /**
   * Every asset the Game needs. Its one atlas is keyed with the Game's id exactly; every other
   * key starts with the id and a `/`. Loaded before the first Round, removed when the Game closes.
   */
  readonly pack: GamePack;
  /** The Game's own sounds. Keys start with the id and a `/`. Rendered on open, discarded on close. */
  readonly sounds: Readonly<Record<string, SoundRecipe>>;
  /** The one Scene that plays a Round. The Arcade adds it under the Game's id. */
  readonly scene: new () => Phaser.Scene;
}

/** One of up to four positions in a Session, each with a fixed colour and shape. */
export interface Seat {
  readonly index: SeatIndex;
  readonly occupant:
    { readonly kind: 'player'; readonly mascot: MascotId } | { readonly kind: 'computer' };
  /** The Seat's colour, from the theme. Never shown without its shape. */
  readonly color: number;
  /** The frame of the Seat's shape, for Players who cannot tell the colours apart. */
  readonly shape: string;
}

/** One visit to one Game by a fixed set of Seats. Made by the lobby; read-only to the Game. */
export interface Session {
  readonly gameId: GameId;
  readonly playStyle: PlayStyle;
  readonly difficulty: Difficulty;
  readonly seating: Seating;
  /** One to four Seats, in Seat order: Players in the order they joined, then Computer Players. */
  readonly seats: readonly Seat[];
}

/** What a Round's backdrop is filled with: a theme colour. */
export type BackdropFill = { readonly color: number };

/** The screen, in design units. A Game never reads the window size, the pixel ratio or the insets. */
export interface Stage {
  /**
   * The 2752 × 2064 design frame, inset on every side by the larger of the device's safe-area
   * inset and 88 units. Everything a child must see or touch goes inside.
   */
  readonly safe: Rect;
  /** Fill everything visible, including the extra width or height beyond the design frame. */
  backdrop(fill: BackdropFill): void;
}

/** For automated tests only: a plain JSON picture of a Round, its state and named targets. */
export type RoundSnapshot = ScreenSnapshot;

/** The kit's named motions. Each has a full form and a reduced one. */
export type MotionPreset = 'pop' | 'bounce' | 'wiggle' | 'slide';

/** Motion, as the device (and later the Grown-Ups Area) asks for it. */
export interface Motion {
  /** True when reduced motion is asked for. */
  readonly reduced: boolean;
  /**
   * Plays a preset on `target`, in its reduced form when motion is reduced, and resolves when it
   * ends. The target is left as it was before the motion began.
   */
  play(target: Phaser.GameObjects.GameObject, preset: MotionPreset): Promise<void>;
}

/** One step of a Demo, in design units. */
export type DemoStep =
  /** The hand moves to a point and taps it. */
  | { readonly tap: { readonly x: number; readonly y: number } }
  /** The hand points at a point and shakes: "not this one". */
  | { readonly refuse: { readonly x: number; readonly y: number } }
  /** The hand waits, for this many milliseconds. */
  | { readonly wait: number };

/** How a Game asks for sound. Keys without a Game prefix are the Arcade's shared sounds. */
export interface RoundAudio {
  /** Requests a sound. Nothing plays if sound is off or not yet unlocked; never wait on it. */
  sfx(key: string): void;
}

/**
 * The Arcade's side of a Round. Opaque to a Game, which passes it to `openRound` and nothing else;
 * only the kit calls it.
 */
export interface RoundHost {
  /** The device's safe-area insets, in CSS pixels. */
  insets(): {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
  /** True when the device asks for reduced motion. */
  reducedMotion(): boolean;
  /** The Round has opened in `scene`; `view` is what the Arcade may see and ask of it. */
  opened(scene: Phaser.Scene, stage: Stage, view: RoundView): void;
  /** A sound was requested at `time`, in the Scene's time. */
  sfx(key: string, time: number): void;
  /** The Round ended. The kit calls it at most once; the Arcade ignores any later call. */
  finish(result: Result): void;
  /** A Player held the pause control: the Arcade pauses the Round and shows the pause screen. */
  pause(): void;
}

/** Where a Round's Demo stands, for the test bridge. */
export interface DemoReport {
  /** True while the Demo plays. */
  readonly playing: boolean;
  /** How many times the Demo has started in this Round. */
  readonly plays: number;
  /** The steps the Game gave, or none before it gives them. */
  readonly steps: readonly DemoStep[];
}

/** What the kit lets the Arcade see of an open Round, and ask of it. */
export interface RoundView {
  /** The Game's snapshot, with the pause control among its targets. */
  snapshot(): RoundSnapshot;
  demo(): DemoReport;
  /** How many touches the Game has refused in this Round. */
  refusals(): number;
  /** Plays the Game's Demo again, as asked for from the pause screen. */
  showDemo(): void;
}

/** What the Arcade starts a Game's Scene with: passed to its `create(data)`. */
export interface RoundStart {
  readonly session: Session;
  /** Seed for this Round. Replaying gives a new one; a test can fix it. */
  readonly seed: number;
  /** Which Round of the Session this is, counting from 0. */
  readonly number: number;
  readonly host: RoundHost;
}

/** What `openRound(scene, start)` gives a Game's Scene: everything one Round needs. */
export interface Round {
  readonly session: Session;
  readonly stage: Stage;
  readonly rng: Rng;
  readonly audio: RoundAudio;
  /** Which Round of the Session this is, counting from 0. */
  readonly number: number;
  readonly motion: Motion;
  /**
   * The Round's own time, in milliseconds from when it opened. It stands still while the Round is
   * paused and while its Demo plays, so time-driven play goes on from where it stopped.
   */
  now(): number;
  /**
   * Shows the Game's Demo: an animated hand performs the steps on the real board, holding the
   * Game's input while it plays; a tap skips it. It plays on the first Round of a Session and
   * when a Player asks from the pause screen; otherwise it resolves at once. Resolves when it ends.
   */
  demo(steps: readonly DemoStep[]): Promise<void>;
  /**
   * Answers a touch the Game ignores: `target` gives a gentle wiggle, and no sound is requested.
   * The Game changes nothing else.
   */
  refuse(target: Phaser.GameObjects.GameObject): void;
  /**
   * Reports how the Round ended. Call once; later calls are ignored. Afterwards the Arcade pauses
   * the Scene and shows the Result.
   */
  finish(result: Result): void;
  /** For automated tests only: registers what the test bridge's `round()` returns. */
  expose(describe: () => RoundSnapshot): void;
}
