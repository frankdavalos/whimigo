import type { Rect } from '@/contract';

/**
 * How many sprites the standard load moves. The busiest Round planned for the first release
 * (Hungry Critters, or Memory Match's full board) moves or shows about fifty pictures at once; the
 * standard load is four times that, all of Game size, so the reading on the iPad Pro shows the
 * margin a real Round leaves.
 */
export const LOAD_SPRITES = 200;

/** A frame of the load's one atlas, and its size in design units. */
export interface LoadFrame {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

/** Where one sprite of the load is: the centre of its frame, in design units. */
export interface LoadSprite {
  readonly frame: string;
  readonly x: number;
  readonly y: number;
}

export interface StandardLoad {
  /** Lets `ms` milliseconds of time pass. */
  advance(ms: number): void;
  /** Every sprite, where it is after the time that has passed. */
  sprites(): LoadSprite[];
}

/** Each sprite's own path across the area: where it starts, and its speed in units per ms. */
interface Path {
  readonly frame: LoadFrame;
  readonly start: { readonly x: number; readonly y: number };
  readonly speed: { readonly x: number; readonly y: number };
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const SLOWEST = 0.15;
const FASTEST = 0.6;

/**
 * The Performance check's standard load: a fixed number of sprites, every one a frame of one atlas,
 * each sliding at its own steady speed and bouncing off the edges of an area. A sprite's position
 * is a function of the time that has passed and nothing else, so the same time gives the same
 * picture at 30, 60 or 120 frames per second. Pure: no Phaser, no DOM.
 */
export function createStandardLoad(frames: readonly LoadFrame[], area: Rect): StandardLoad {
  const paths: Path[] = Array.from({ length: LOAD_SPRITES }, (_, index) => {
    const angle = index * GOLDEN_ANGLE;
    const speed = SLOWEST + (FASTEST - SLOWEST) * fraction(index * 0.754877666);
    return {
      frame: frames[index % frames.length]!,
      start: { x: fraction(index * 0.618033989), y: fraction(index * 0.381966011 + 0.5) },
      speed: { x: speed * Math.cos(angle), y: speed * Math.sin(angle) },
    };
  });
  let elapsed = 0;

  return {
    advance(ms) {
      elapsed += ms;
    },
    sprites: () =>
      paths.map(({ frame, start, speed }) => {
        const across = { min: area.x + frame.width / 2, span: area.width - frame.width };
        const down = { min: area.y + frame.height / 2, span: area.height - frame.height };
        return {
          frame: frame.name,
          x: bounce(across.min, across.span, start.x * 2 * across.span + speed.x * elapsed),
          y: bounce(down.min, down.span, start.y * 2 * down.span + speed.y * elapsed),
        };
      }),
  };
}

/** The fractional part of a number, from 0 up to 1. */
const fraction = (value: number) => value - Math.floor(value);

/** Where a point is after travelling `distance` from `min` along a span it bounces back across. */
function bounce(min: number, span: number, distance: number): number {
  if (span <= 0) return min;
  const along = distance - Math.floor(distance / (2 * span)) * 2 * span;
  return min + (along <= span ? along : 2 * span - along);
}
