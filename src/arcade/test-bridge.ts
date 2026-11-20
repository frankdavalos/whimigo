import * as Phaser from 'phaser';
import type { Rect, SnapshotTarget } from '@/contract';
import { DESIGN_FRAME, frameOnCanvas } from '@/kit/frame';
import { renderScaleOf } from '@/kit/render-scale';
import type { AudioState } from '@/platform/audio';
import type { Arcade } from './arcade';
import { type Counts, countsOf } from './counts';
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
  /** The screen showing, or null while the Arcade is changing screen. */
  screen(): ScreenId | null;
  snapshot(): PageSnapshot;
  layout(): PageLayout;
  counts(): Counts;
  /** What the showing screen draws: each image's texture and frame, and how many drawn shapes. */
  pictures(): Pictures;
  /** Opens a check screen directly, skipping the Home Screen. */
  openCheck(id: ScreenId): void;
  audio(): AudioState;
  /** Asks the audio service to play a loaded sound: whether it started, and how long the call took. */
  playSound(key: string): { started: boolean; ms: number };
  /** How many frames Phaser's loop has stepped. */
  frames(): number;
  /** Throws from inside the showing screen's next update, in Phaser's frame loop. */
  throwInUpdate(): void;
  /** Leaves a rejected promise unhandled. */
  rejectUnhandled(): void;
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

export function installTestBridge(win: Window, arcade: Arcade, buildId: string): void {
  const { game } = arcade;
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

  win.whimigo = {
    buildId,
    screen: () => arcade.screen?.scene.key ?? null,
    snapshot() {
      const { state, targets } = showing().snapshot();
      const onPage: Record<string, SnapshotTarget> = {};
      for (const [name, target] of Object.entries(targets)) {
        const centre = toPage({ x: target.x, y: target.y, width: 0, height: 0 });
        onPage[name] = { x: centre.x, y: centre.y, rect: toPage(target.rect) };
      }
      return JSON.parse(JSON.stringify({ state, targets: onPage })) as PageSnapshot;
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
      showing().children.list.forEach(visit);
      return { images, shapes };
    },
    openCheck(id) {
      if (!arcade.checks.some((check) => check.id === id)) throw new Error(`No check "${id}"`);
      arcade.show(id);
    },
    audio: () => arcade.services.audio.state(),
    playSound(key) {
      const start = win.performance.now();
      const started = arcade.services.audio.play(key);
      return { started, ms: win.performance.now() - start };
    },
    frames: () => game.loop.frame,
    throwInUpdate() {
      showing().events.once('update', () => {
        throw new Error('Thrown on purpose by the test bridge');
      });
    },
    rejectUnhandled() {
      void Promise.reject(new Error('Rejected on purpose by the test bridge'));
    },
  };
}
