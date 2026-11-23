import * as Phaser from 'phaser';
import type {
  DemoReport,
  DemoStep,
  Rect,
  Result,
  ScreenSnapshot,
  SeatIndex,
  SeatTouchReport,
  Session,
  SnapshotTarget,
} from '@/contract';
import { DESIGN_FRAME, frameOnCanvas } from '@/kit/frame';
import { renderScaleOf } from '@/kit/render-scale';
import type { AudioState } from '@/platform/audio';
import type { SaveDocument } from '@/platform/save-store';
import type { Arcade } from './arcade';
import { checkModule } from './conformance';
import { type Counts, countsOf } from './counts';
import type { HostState, RequestedSound } from './game-host';
import type { ScreenId } from './screen';

/** A screen's snapshot with every target converted to page coordinates (CSS pixels). */
export interface PageSnapshot {
  readonly state: unknown;
  readonly targets: Readonly<Record<string, SnapshotTarget>>;
}

/** Where things are on the page, in CSS pixels. */
export interface PageLayout {
  readonly viewport: { readonly width: number; readonly height: number };
  readonly canvas: Rect;
  /** The canvas's own size in pixels. */
  readonly canvasPixels: { readonly width: number; readonly height: number };
  /** Canvas pixels per design unit (ADR-0003). */
  readonly renderScale: number;
  readonly frame: Rect;
  /** The showing screen's safe rectangle, or null before the first screen is shown. */
  readonly safe: Rect | null;
}

/**
 * The test bridge (ADR-0015): on `window.whimigo`, and only when the page is opened with `?e2e=1`.
 * Every call returns plain JSON.
 */
export interface TestBridge {
  /** The commit this build was made from. */
  readonly buildId: string;
  /** Whether the service worker has finished caching every file, so the Arcade plays offline. */
  offlineReady(): boolean;
  /** Whether a newer version has been downloaded and waits for the next cold start. */
  updateWaiting(): boolean;
  /** The screen showing, or null while the Arcade is changing screen, and the GameHost's state. */
  screen(): { readonly id: ScreenId | null; readonly host: HostState };
  snapshot(): PageSnapshot;
  /** Starts a Session directly, skipping the Home Screen and the lobby. */
  open(session: Session, seed: number): void;
  /**
   * The Round being played, paused or whose Result shows: its seed, its number in the Session, its
   * state, and its named targets and Zones in page coordinates. Null when no Game is open.
   */
  round(): RoundPage | null;
  /** Reports a Result for the Round being played, exactly as its Game would. */
  finish(result: Result): void;
  /** The current save document. */
  save(): SaveDocument;
  /** The last few states the GameHost has been in, oldest first. */
  hostStates(): HostState[];
  /** Every sound the Round has requested since it began, with its key and Scene time. */
  sounds(): readonly RequestedSound[];
  /** The Scenes that accept input now, by key. Exactly one, whenever a screen shows. */
  inputScenes(): string[];
  /** The ids of the check screens, in the order the Grown-Ups Area lists them. */
  checks(): string[];
  /**
   * Opens the Grown-Ups Area as the Grown-Up Gate does, skipping the hold: nothing happens unless
   * the GameHost is idle.
   */
  openGrownUps(): void;
  /** Loads every Game's module and runs the module conformance checks; empty when all pass. */
  conformance(): Promise<string[]>;
  layout(): PageLayout;
  counts(): Counts;
  /** What `counts()` counts, by key: Scenes, textures and cached sounds. */
  keys(): { readonly scenes: string[]; readonly textures: string[]; readonly sounds: string[] };
  /** What the showing screen draws: each image's texture and frame, and how many drawn shapes. */
  pictures(): Pictures;
  /** Opens a check screen directly, skipping the Home Screen. */
  openCheck(id: ScreenId): void;
  audio(): AudioState;
  /** Asks the audio service to play a loaded sound: whether it started, and how long the call took. */
  playSound(key: string): { started: boolean; ms: number };
  /** How many sounds have started anywhere in the Arcade since the page loaded. */
  soundsStarted(): number;
  /** How many frames Phaser's loop has stepped. */
  frames(): number;
  /** Throws from inside the showing screen's next update, in Phaser's frame loop. */
  throwInUpdate(): void;
  /** Leaves a rejected promise unhandled. */
  rejectUnhandled(): void;
}

export interface RoundPage extends PageSnapshot {
  readonly session: Session;
  readonly seed: number;
  readonly number: number;
  /** The Round's Scene clock, in milliseconds. */
  readonly time: number;
  /** The Round's own time, in milliseconds: it stands still while paused and while its Demo plays. */
  readonly now: number;
  /** Each Seat's Zone, in page coordinates, with its Seat and the way it faces. */
  readonly zones: readonly (Rect & { readonly seat: SeatIndex; readonly facing: 0 | 180 })[];
  /** What the Round's SeatZones has reported to its Game. */
  readonly seatTouches: SeatTouchReport;
  /** Where the Round's Demo stands; the points its steps name are in page coordinates. */
  readonly demo: DemoReport;
  /** How many touches the Game has refused in this Round. */
  readonly refusals: number;
  readonly motion: 'full' | 'reduced';
}

export interface Pictures {
  readonly images: readonly { readonly texture: string; readonly frame: string }[];
  /** Graphics objects, and shape objects with a fill or an outline. */
  readonly shapes: number;
}

declare global {
  interface Window {
    whimigo?: TestBridge;
  }
}

export function installTestBridge(win: Window, arcade: Arcade): void {
  const { game, services } = arcade;
  const renderScale = renderScaleOf(game);

  const toPage = (rect: Rect): Rect => {
    const canvas = game.canvas;
    const box = canvas.getBoundingClientRect();
    const frame = frameOnCanvas(canvas, renderScale);
    const pixelsPerUnit = frame.width / DESIGN_FRAME.width;
    // CSS stretches the canvas to its box; each axis has its own ratio after rounding.
    const cssX = box.width / canvas.width;
    const cssY = box.height / canvas.height;
    return {
      x: box.left + (frame.x + rect.x * pixelsPerUnit) * cssX,
      y: box.top + (frame.y + rect.y * pixelsPerUnit) * cssY,
      width: rect.width * pixelsPerUnit * cssX,
      height: rect.height * pixelsPerUnit * cssY,
    };
  };

  const showing = () => {
    const screen = arcade.screen;
    if (!screen) throw new Error('No screen is showing yet');
    return screen;
  };

  const pointOnPage = ({ x, y }: { x: number; y: number }) => {
    const { x: px, y: py } = toPage({ x, y, width: 0, height: 0 });
    return { x: px, y: py };
  };
  const stepOnPage = (step: DemoStep): DemoStep => {
    if ('tap' in step) return { tap: pointOnPage(step.tap) };
    if ('refuse' in step) return { refuse: pointOnPage(step.refuse) };
    return step;
  };

  const onPage = ({ state, targets }: ScreenSnapshot): PageSnapshot => {
    const converted: Record<string, SnapshotTarget> = {};
    for (const [name, target] of Object.entries(targets)) {
      const centre = toPage({ x: target.x, y: target.y, width: 0, height: 0 });
      converted[name] = { x: centre.x, y: centre.y, rect: toPage(target.rect) };
    }
    return JSON.parse(JSON.stringify({ state, targets: converted })) as PageSnapshot;
  };

  win.whimigo = {
    buildId: services.buildId,
    offlineReady: () => services.updates.state().offlineReady,
    updateWaiting: () => services.updates.state().updateWaiting,
    screen: () => ({ id: arcade.screen?.id ?? null, host: arcade.host.state }),
    snapshot: () => onPage(showing().snapshot()),
    open: (session, seed) => arcade.host.open(session, seed),
    round() {
      const round = arcade.host.round();
      if (!round) return null;
      const { session, seed, number, time, now, demo, refusals, motion, seatTouches } = round;
      return {
        session,
        seed,
        number,
        time,
        now,
        zones: round.zones.map(({ rect, seat, facing }) => ({ ...toPage(rect), seat, facing })),
        seatTouches,
        demo: { ...demo, steps: demo.steps.map(stepOnPage) },
        refusals,
        motion,
        ...onPage(round.snapshot),
      };
    },
    finish: (result) => arcade.host.report(result),
    save: () => JSON.parse(JSON.stringify(services.save.current())) as SaveDocument,
    hostStates: () => [...arcade.host.history],
    sounds: () => JSON.parse(JSON.stringify(arcade.host.round()?.sounds ?? [])) as RequestedSound[],
    inputScenes: () =>
      game.scene.scenes
        .filter(
          (scene) => scene.sys.settings.status >= Phaser.Scenes.START && scene.input?.isActive(),
        )
        .map((scene) => scene.sys.settings.key),
    checks: () => arcade.checks.map((check) => check.id),
    openGrownUps: () => arcade.openGrownUps(),
    async conformance() {
      const modules = await Promise.all(
        arcade.catalog.map(async (manifest) => ({
          id: manifest.id,
          module: (await manifest.load()).default,
        })),
      );
      return modules.flatMap(({ id, module }) => checkModule(id, module));
    },
    layout() {
      const box = game.canvas.getBoundingClientRect();
      const screen = arcade.screen;
      return {
        viewport: { width: win.innerWidth, height: win.innerHeight },
        canvas: { x: box.left, y: box.top, width: box.width, height: box.height },
        canvasPixels: { width: game.canvas.width, height: game.canvas.height },
        renderScale,
        frame: toPage(DESIGN_FRAME),
        safe: screen ? toPage(screen.stage.safe) : null,
      };
    },
    counts: () => countsOf(game),
    keys: () => ({
      scenes: game.scene.scenes.map((scene) => scene.sys.settings.key),
      textures: game.textures.getTextureKeys(),
      sounds: game.cache.audio.getKeys(),
    }),
    pictures() {
      const images: { texture: string; frame: string }[] = [];
      let shapes = 0;
      const visit = (object: Phaser.GameObjects.GameObject) => {
        if (object instanceof Phaser.GameObjects.Container) object.list.forEach(visit);
        else if (object instanceof Phaser.GameObjects.Image) {
          images.push({ texture: object.texture.key, frame: object.frame.name });
        } else if (object instanceof Phaser.GameObjects.Graphics) shapes += 1;
        else if (
          object instanceof Phaser.GameObjects.Shape &&
          (object.isFilled || object.isStroked)
        ) {
          shapes += 1;
        }
      };
      showing().scene.children.list.forEach(visit);
      return { images, shapes };
    },
    openCheck(id) {
      if (!arcade.checks.some((check) => check.id === id)) throw new Error(`No check "${id}"`);
      arcade.show(id);
    },
    audio: () => services.audio.state(),
    playSound(key) {
      const start = win.performance.now();
      const started = services.audio.play(key);
      return { started, ms: win.performance.now() - start };
    },
    soundsStarted: () => services.audio.started(),
    frames: () => game.loop.frame,
    throwInUpdate() {
      showing().scene.events.once('update', () => {
        throw new Error('Thrown on purpose by the test bridge');
      });
    },
    rejectUnhandled() {
      void Promise.reject(new Error('Rejected on purpose by the test bridge'));
    },
  };
}
