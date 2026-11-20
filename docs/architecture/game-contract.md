# Game Contract

What a Game must provide to the Arcade, what the Arcade provides to a Game, and the rules that keep Games independent of one another. Terms in **bold** are defined in [CONTEXT.md](../../CONTEXT.md). The reasons behind these shapes are in [overview.md](overview.md) and the [ADRs](../adr/).

These are design contracts. The TypeScript below fixes names, shapes and responsibilities; it is not yet code, and small details may move when the first Game is built against it. A change to anything in [The contract](#the-contract) after Phase 1 should be treated as a decision, because every Game depends on it.

## The idea in one paragraph

A Game is a folder. It contributes a small **manifest** (data the Home Screen needs, always loaded) and a lazily loaded **module** (one Phaser Scene plus the list of assets it needs). The Arcade loads the module, hands the Scene a **Session**, and waits for the Scene to report a **Result**. Everything else a Game needs (the screen geometry, whose touch is whose, sounds, motion, randomness) comes from a small shared kit that the Scene calls. A Game never reaches into the Arcade, the browser, storage, or another Game.

## Folder layout

```
src/
  contract.ts            types in this document; no runtime code
  arcade/                the Arcade's own screens and the GameHost
  platform/              browser-facing services (storage, audio, lifecycle, PWA, device)
  kit/                   shared helpers Games call (stage, seat input, UI, motion, rng, turn)
  games/
    catalog.ts           the ordered list of manifests
    tic-tac-toe/
      manifest.ts        GameManifest; imports nothing heavy
      index.ts           GameModule; the lazily loaded entry point
      logic/             pure TypeScript: rules, Computer Player, tests
      scene/             the Phaser Scene and its view code
      art/               SVG sources, packed into one atlas at build time
      sounds.ts          this Game's sound recipes
```

Adding a Game means adding one folder under `games/` and one line in `catalog.ts`. If adding a Game requires editing anything else, the contract has a gap and the gap is fixed in the contract, not worked around in the Game.

## Dependency rules

Enforced by lint, so an agent finds out at once and not in review.

| Code in | May import | May not import |
|---|---|---|
| `games/<id>/logic/` | `contract.ts`, `kit/rng`, `kit/turn` (types and pure functions) | `phaser`, anything in `scene/`, `arcade/`, `platform/`, the DOM |
| `games/<id>/scene/` | its own `logic/`, `contract.ts`, `kit/`, `phaser` | `arcade/`, `platform/`, any other `games/<other>/` |
| `kit/` | `contract.ts`, `phaser`, `platform/` (through interfaces) | `games/`, `arcade/` |
| `arcade/` | everything except a Game's internals; Games only through `catalog.ts` and `manifest.load()` | `games/<id>/logic/` or `scene/` directly |
| `platform/` | `contract.ts`, browser APIs | `games/`, `arcade/`, `kit/` |

Two further rules for Game code:

- **Use scene time, never wall-clock time.** Timers and tweens come from the Scene (`this.time`, `this.tweens`). `setTimeout`, `setInterval`, `Date.now()` and `requestAnimationFrame` are banned in `games/`. This is what makes pause, resume and device suspension work without each Game handling them.
- **Use the Round's random source, never `Math.random()`.** This is what makes a **Round** reproducible from its seed.

## The contract

### Identity and vocabulary

```ts
/** Kebab-case, unique, stable for ever: it is a storage key and an asset namespace. */
export type GameId = string;

/** Stable identifier of a Mascot, e.g. 'fox'. */
export type MascotId = string;

/** A Seat's position in a Session. Seat 0 is the first Player to join. */
export type SeatIndex = 0 | 1 | 2 | 3;

export type PlayStyle =
  | 'solo'
  | 'versus-computer'
  | 'turn-based'
  | 'simultaneous'
  | 'cooperative';

export type Difficulty = 'easy' | 'medium' | 'hard';

/** How the Players are sitting. Decides where Zones go and which way they face. */
export type Seating = 'side-by-side' | 'around-the-table';

/** A rectangle in design units. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What a backdrop is filled with: a theme colour token, or a tiling frame from the Game's atlas. */
export type BackdropFill = { readonly color: string } | { readonly frame: string };

export type MotionPreset = 'pop' | 'bounce' | 'wiggle' | 'slide';
```

### GameManifest

Always loaded. It must stay tiny: it is bundled with the Home Screen, so it imports no Phaser Scene, no logic and no assets.

```ts
export interface GameManifest {
  readonly id: GameId;

  /** For adults, tests and logs. Children recognise a Game by its Game Card. */
  readonly title: string;

  /** Youngest age the Game is meant for. Shown to adults only. */
  readonly minAge: number;

  /** Every way this Game can be played. The lobby offers those that fit the Players who joined. */
  readonly playStyles: readonly PlayStyleOption[];

  /** False for a Game where Difficulty means nothing; the lobby then hides the choice. */
  readonly usesDifficulty: boolean;

  /** Game Card artwork: a frame in the Arcade's own atlas (so `arcade/…`), and a theme colour token. */
  readonly card: { readonly frame: string; readonly color: string };

  /** Loads the module. Must be a literal dynamic import so the bundler makes one chunk per Game. */
  readonly load: () => Promise<{ default: GameModule }>;
}

export interface PlayStyleOption {
  readonly style: PlayStyle;

  /** How many human Players this style accepts. */
  readonly players: { readonly min: number; readonly max: number };

  /** Computer Players the Arcade adds to the Session. Zero unless the style is 'versus-computer'. */
  readonly computerPlayers: number;

  /** True if each Seat gets its own Zone. False means one shared board. */
  readonly zoned: boolean;
}
```

Example:

```ts
export const manifest: GameManifest = {
  id: 'tic-tac-toe',
  title: 'Tic-Tac-Toe',
  minAge: 4,
  usesDifficulty: true,
  playStyles: [
    { style: 'versus-computer', players: { min: 1, max: 1 }, computerPlayers: 1, zoned: false },
    { style: 'turn-based',      players: { min: 2, max: 2 }, computerPlayers: 0, zoned: false },
  ],
  card: { frame: 'arcade/card/tic-tac-toe', color: 'sky' },
  load: () => import('./index'),
};
```

### GameModule

Loaded only when a child opens the Game.

```ts
export interface GameModule {
  /**
   * Every asset the Game needs, as a Phaser pack. The Game's one atlas is keyed `${id}`
   * exactly; every other key must start with `${id}/`. See "Asset keys" below.
   * The Arcade loads the pack before the first Round and removes it when the Session ends.
   */
  readonly pack: Phaser.Types.Loader.FileTypes.PackFileSection;

  /**
   * The Game's own sounds, as synthesis recipes. Keys must start with `${id}/`.
   * The Arcade renders them when the Game opens and discards them when the Session ends.
   */
  readonly sounds: Readonly<Record<string, SoundRecipe>>;

  /** The Scene that plays one Round. The Arcade adds it under the key `${id}`. */
  readonly scene: new () => Phaser.Scene;
}
```

A Game has exactly one Scene registered with the Arcade. A Game that wants internal screens builds them inside that Scene. This is deliberate: only one Scene at a time may receive touches (see [ADR-0004](../adr/0004-one-input-scene-at-a-time.md)).

#### Asset keys

One rule, decided by the owner on 2026-11-20 ([ADR-0011](../adr/0011-svg-sources-atlas-per-game.md)):

- **A frame is keyed `${id}/<name>`**, and it lives in the texture named by the part before the first `/`. So the frame `tic-tac-toe/board` is in the texture `tic-tac-toe`, and a frame key alone says where to find it. The Arcade's own frames are `arcade/<name>` in the texture `arcade`.
- **A Game's atlas is therefore keyed `${id}` exactly.** A Game has one atlas page, so there is one such texture per Game.
- **Every other key a Game owns starts with `${id}/`**: any other file in its pack, and every sound recipe.

Every field in this contract that holds a frame (`card.frame`, `Seat.shape`, a `BackdropFill`'s `frame`, a control's icon) holds the frame key and nothing else, and the kit finds the texture from it. Scenes, textures and sounds are kept in separate lists by Phaser, so a Game's Scene and its atlas sharing the key `${id}` do not collide.

### Session and Seat

Created by the Arcade's lobby, read-only to the Game.

```ts
export interface Session {
  readonly gameId: GameId;
  readonly playStyle: PlayStyle;
  readonly difficulty: Difficulty;
  readonly seating: Seating;
  /** One to four Seats, in Seat order. */
  readonly seats: readonly Seat[];
}

export interface Seat {
  readonly index: SeatIndex;
  readonly occupant:
    | { readonly kind: 'player'; readonly mascot: MascotId }
    | { readonly kind: 'computer' };
  /** Theme token for this Seat's colour. Always paired with the Seat's shape; never colour alone. */
  readonly color: string;
  /** Frame name of this Seat's shape marker, for Players who cannot tell the colours apart. */
  readonly shape: string;
}
```

### RoundStart and Round

The Arcade starts the Scene with a `RoundStart`. The Scene turns it into a `Round`, the toolkit for that one **Round**, by calling `openRound` first thing in `create`.

```ts
/** Passed by the Arcade to the Scene's init(data) and create(data). */
export interface RoundStart {
  readonly session: Session;
  /** Seed for this Round. Replaying gives a new seed; a test can fix it. */
  readonly seed: number;
  /** Opaque handle to the Arcade's services. A Game passes it to openRound and nothing else. */
  readonly host: RoundHost;
}

/** What openRound(scene, start) returns. */
export interface Round {
  readonly session: Session;
  readonly stage: Stage;
  readonly rng: Rng;
  readonly audio: RoundAudio;
  readonly motion: Motion;

  /**
   * Report how the Round ended. Call exactly once. After this the Scene must not
   * start new sounds or accept touches; the Arcade pauses it and shows the Result.
   */
  finish(result: Result): void;

  /**
   * Show the Game's Demo: an animated hand performs these steps on the real board.
   * The kit decides whether to play it (the first Round of a Session, or when a child
   * asks from the pause screen), holds input while it runs, and lets a tap skip it.
   */
  demo(steps: readonly DemoStep[]): Promise<void>;

  /**
   * For automated tests only. Register a function that returns a plain JSON picture of the
   * Round: its state, and the named points a test may tap. See testing-strategy.md.
   */
  expose(describe: () => RoundSnapshot): void;
}

/** One step of a Demo, in design units. */
export type DemoStep =
  | { readonly tap: { readonly x: number; readonly y: number } }
  | { readonly refuse: { readonly x: number; readonly y: number } }   // point, then shake: "not this one"
  | { readonly wait: number };                                        // milliseconds of scene time

export interface RoundSnapshot {
  /** Whatever the Game's tests want to assert on. Must be plain JSON. */
  readonly state: unknown;
  /** Named tap targets in design units, e.g. { 'cell-4': { x: 1376, y: 1032 } }. */
  readonly targets: Readonly<Record<string, { readonly x: number; readonly y: number }>>;
}
```

`openRound` also does the things every Game would otherwise repeat: it mounts the hold-to-pause control inside the Scene, connects pause and resume to the Arcade, and registers cleanup for when the Scene shuts down. A Game does not draw its own pause or exit control.

A minimal Scene:

```ts
export class TicTacToeScene extends Phaser.Scene {
  create(start: RoundStart) {
    const round = openRound(this, start);
    const view = new BoardView(this, round);          // this Game's own view code
    let state = rules.start({ seats: round.session.seats.length, difficulty: round.session.difficulty, seed: start.seed });
    // ...wire view touches to rules.apply, and when rules.result(state) is non-null:
    // round.finish(result);
  }
}
```

There is no base class. `openRound` is a function a Scene calls, so a Game's Scene extends `Phaser.Scene` directly and nothing else.

### Result

```ts
export type Result =
  | { readonly kind: 'win'; readonly winners: readonly SeatIndex[]; readonly scores?: Scores }
  | { readonly kind: 'draw'; readonly scores?: Scores }
  | { readonly kind: 'cooperative'; readonly success: boolean; readonly score?: number }
  | { readonly kind: 'solo'; readonly score: number };

export type Scores = Readonly<Partial<Record<SeatIndex, number>>>;
```

- `win` may name more than one winner: two Seats that tap within the same touch sample in Reaction Rush both win.
- Leaving a **Round** before it ends produces no Result.
- A Game reports what happened. The Arcade decides what it is worth: converting a Result into **Stars** is the Arcade's job, so the reward rules are the same in every Game.
- **Achievements** are not part of the Phase 1 contract. When they are built (Phase 3) they arrive as an optional field on Result and an optional list on the manifest, which breaks no existing Game.

## The kit

Shared helpers a Scene reaches through its `Round`. Each exists because at least two of the first three Games need it.

### Stage

The screen, in design units. A Game never reads the window size, the device pixel ratio or the safe-area insets.

```ts
export interface Stage {
  /**
   * The 2752 x 2064 design frame, inset on every side by the larger of the device's
   * safe-area inset and a fixed 88-unit margin. Constant for the whole Round.
   * Everything a child must see or touch goes inside.
   */
  readonly safe: Rect;
  /**
   * Fill everything visible, including the extra width on screens wider than 4:3.
   * The backdrop follows the screen if its size changes, so a Game never handles resize.
   */
  backdrop(fill: BackdropFill): void;
  /** One Zone per Seat for this Session's Seating. Empty unless the Play Style is zoned. */
  readonly zones: readonly Zone[];
  /** A Container placed and rotated for a Seat's Zone. Draw Zone content into it in Zone-local coordinates. */
  zoneContainer(seat: SeatIndex): Phaser.GameObjects.Container;
}

export interface Zone {
  readonly seat: SeatIndex;
  readonly rect: Rect;
  /** Which way the Player in this Zone is facing, in degrees. */
  readonly facing: 0 | 180;
}
```

Zone positions for each **Seating** and Seat count are decided once, in the kit. A Game asks for its Zones; it does not compute them. The kit's `zonesFor(area, seats, seating)` lays them out inside the area it is given. The Touch Check gives it the part of the safe rectangle between its two columns of controls; for a Game, which has no controls beside its Zones, the area is meant to be the whole safe rectangle, and that is settled when `GameHost` is built.

| Seats | `side-by-side` | `around-the-table` |
|---|---|---|
| 2 | left half, right half; both face 0° | bottom half faces 0°, top half faces 180° |
| 3 | three columns; all face 0° | bottom-left and bottom-right face 0°, top-centre faces 180° |
| 4 | four columns; all face 0° | bottom-left and bottom-right face 0°, top-right and top-left face 180° |

### Seat input

Every touch a Game acts on belongs to exactly one **Seat**. There are two rules for deciding which, and a Game uses the one that matches its Play Style.

```ts
/** Shared board (not zoned): a touch belongs to the Seat whose Turn it is. */
export interface TurnGate {
  /** Wrap a Phaser input handler. The handler runs only if the gate is open and no other guarded touch is down. */
  guard<A extends unknown[]>(handler: (...args: A) => void): (...args: A) => void;
  /** Close while an animation plays or a Computer Player is thinking; open when a Player may act. */
  close(): void;
  open(): void;
  readonly isOpen: boolean;
}

/** Zoned: a touch belongs to the Seat in whose Zone it began, until it lifts. */
export interface SeatZones {
  onDown(handler: (touch: SeatTouch) => void): void;
  onUp(handler: (touch: SeatTouch & { readonly canceled: boolean }) => void): void;
  /** Ignore a Seat's touches, e.g. after a false start. */
  setEnabled(seat: SeatIndex, enabled: boolean): void;
}

export interface SeatTouch {
  readonly seat: SeatIndex;
  /** Position in the Seat's Zone-local coordinates, already rotated for its facing. */
  readonly x: number;
  readonly y: number;
  /** The browser's timestamp for the touch, in milliseconds. Use this, not frame time, to order touches. */
  readonly time: number;
}
```

Behaviour the kit guarantees, so no Game re-implements it:

- **Shared board.** Games use ordinary Phaser interactive objects for cells, cards and columns, with handlers wrapped in `guard`. While one guarded touch is down, others are ignored, so two children pressing at once produce one **Move**, not two.
- **Zoned.** A touch is attributed where it starts and keeps that Seat until it lifts, even if the finger slides into a neighbour's Zone. Each Seat has one active touch; a second finger or a resting palm in the same Zone is ignored. A touch that starts outside every Zone belongs to nobody.
- **Cancellation.** A touch the system takes away (for example an iPadOS gesture) is reported as `onUp` with `canceled: true` and never as a tap.

### RoundAudio

All sound is synthesized. There are no audio files and no speech ([ADR-0014](../adr/0014-synthesized-sound-no-voice.md)).

```ts
export interface RoundAudio {
  /** Play a sound. Keys without a Game prefix are the Arcade's shared sounds ('tap', 'win'). */
  sfx(key: string): void;
}

/** A sound described as data. Rendered to a buffer once, when the Game opens. */
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
```

Example, a two-note "correct" chime:

```ts
export const sounds = {
  'color-echo/correct': {
    notes: [
      { wave: 'triangle', from: 660, at: 0,   for: 120 },
      { wave: 'triangle', from: 880, at: 110, for: 220, release: 150 },
    ],
  },
} satisfies Record<string, SoundRecipe>;
```

A Game never touches the audio context, the mute setting or the unlock state. If sound is off or not yet unlocked, `sfx` does nothing, so a Game must not depend on sound to make progress.

### Motion

```ts
export interface Motion {
  /** True when the device or the Grown-Ups Area asks for reduced motion. */
  readonly reduced: boolean;
  /** Named presets: 'pop', 'bounce', 'wiggle', 'slide'. Each has a reduced form chosen automatically. */
  play(target: Phaser.GameObjects.GameObject, preset: MotionPreset): Promise<void>;
}
```

Motion that carries meaning (a disc dropping into a column) still happens when `reduced` is true, shortened to a fade or a direct placement. Motion that only decorates is skipped.

### Rng

```ts
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}
```

Seeded from `RoundStart.seed`. The same seed and the same sequence of touches produce the same **Round**.

### UI

Factory functions that build the Arcade's standard controls inside any Scene: `button`, `iconButton`, `holdButton`, `panel`, `seatBadge`, `turnPointer`. They apply the touch-target minimums and theme tokens from [overview.md](overview.md#visual-system), so a Game cannot accidentally make a control too small. Labels are icons or bitmap digits. Phaser `Text` objects are not used in Games ([ADR-0005](../adr/0005-pictures-in-canvas-words-in-dom.md)).

## A convention for Turn-Based Games

Not part of the contract. Any Game whose rules are "Seats take **Turns** making **Moves**" should shape its logic this way, because the shared test helper and the shared **Computer Player** search are written against it.

```ts
export interface TurnRules<State, Move> {
  start(setup: { seats: number; difficulty: Difficulty; seed: number }): State;
  /** The Seat whose Turn it is. */
  seatToMove(state: State): SeatIndex;
  legalMoves(state: State): Move[];
  /** Returns a new State. Never mutates. Throws on an illegal Move. */
  apply(state: State, move: Move): State;
  /** Null while the Round is in progress. */
  result(state: State): Result | null;
}

/** Chooses a Move for a Computer Player. Pure: all randomness comes from rng. */
export type ComputerPlayer<State, Move> = (state: State, difficulty: Difficulty, rng: Rng) => Move;
```

Simultaneous Games (Reaction Rush, Hungry Critters) do not fit this and are not forced to. They keep their scoring and round rules in pure functions in `logic/` and let the Scene own motion.

The shared game-tree search does not exist until Four in a Row needs it. Tic-Tac-Toe carries its own small search, written against `TurnRules` so that extraction is a move and not a rewrite.

## The Arcade's side: GameHost

Not visible to Games. Recorded here because it is the other half of the contract.

```ts
export interface GameHost {
  /** Load the Game's chunk and pack, add its Scene, start the first Round. */
  open(session: Session): Promise<void>;
  pause(): void;
  resume(): void;
  /** Start a new Round in the same Session with a new seed. */
  replay(): void;
  /** Stop and remove the Scene, remove the pack, return to the Home Screen. */
  close(): Promise<void>;
  readonly state: HostState;
}

export type HostState = 'idle' | 'loading' | 'playing' | 'paused' | 'showing-result' | 'closing';
```

The state machine and failure paths are in [overview.md](overview.md#game-lifecycle).

## What a Game must do

1. Export a manifest and a module of the shapes above, with its atlas keyed `${id}` and every other asset key prefixed `${id}/` (see [Asset keys](#asset-keys)).
2. Keep its rules in `logic/` with no Phaser import, and test them there.
3. Call `openRound` first in `create`, and `round.finish` exactly once.
4. Keep everything a child must see or touch inside `stage.safe`, and call `round.expose` so the browser tests can drive it.
5. Attribute every touch through `TurnGate` or `SeatZones`.
6. Use scene time and `round.rng` only.
7. Show every state with a picture, a shape or motion as well as with colour or sound.
8. Show how to play with `round.demo`, and with nothing else. There are no words and no voice to fall back on.
9. Leave nothing behind: every listener, timer and object it creates belongs to its Scene, so that removing the Scene removes the Game.

## What a Game must not do

- Read or write storage, or know that **Progress** exists.
- Register a service worker, touch the DOM, or read `window`, `navigator` or `document`.
- Add, start, stop or remove Scenes.
- Add or reconfigure cameras, or place anything in screen pixels. Everything is positioned in design units through the Scene's one camera, which the kit owns ([ADR-0003](../adr/0003-fixed-design-frame.md)).
- Import from another Game.
- Draw its own pause, exit or replay controls.
- Load audio or image files that were not made in the repository. Through the first release, art is SVG drawn here and sound is a recipe ([ADR-0016](../adr/0016-art-and-sound-made-in-code.md)).
- Create Phaser `Text`, `RenderTexture`, `DynamicTexture` or `Shader` objects. The first has open rendering defects on target devices; the others lose their contents when the device suspends the app and have open leaks in Phaser 4.2.1. A Game with a real need raises it as a decision first.

## Conformance

Every Game is checked by the same automated tests, described in [testing-strategy.md](../testing-strategy.md):

- A manifest test: unique id, valid Play Style ranges, a card frame that exists.
- For Games following `TurnRules`: a shared property test that plays many seeded random **Rounds** and checks that `apply` never mutates, that a Round always ends, and that the Result is consistent with the final state.
- A browser smoke test: open the Game with a fixed seed for each Play Style, play to a Result through the test bridge, replay, close, and check that the Game's Scene and textures are gone.
