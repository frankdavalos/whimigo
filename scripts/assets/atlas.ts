/** One SVG file of a set: its path inside the set's folder, without `.svg`, and its text. */
export interface Source {
  readonly name: string;
  readonly svg: string;
}

/** Where one frame sits on the atlas page, in pixels. A frame's pixels are its design units. */
export interface PlacedFrame {
  readonly key: string;
  readonly source: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface AtlasPlan {
  readonly setId: string;
  readonly width: number;
  readonly height: number;
  readonly frames: readonly PlacedFrame[];
}

/** The largest atlas page, each way. A set gets exactly one page. */
export const PAGE_LIMIT = 4096;

/** Clear pixels kept around every frame, so filtering never mixes neighbouring frames. */
const PADDING = 2;

export function planAtlas(setId: string, sources: readonly Source[]): AtlasPlan {
  const sized = sources.map((source) => {
    const key = `${setId}/${source.name}`;
    return { key, source: source.name, ...svgSize(key, source) };
  });
  const misfit = (reason: string) =>
    new Error(
      `Atlas set "${setId}" does not fit one ${PAGE_LIMIT} × ${PAGE_LIMIT} atlas page: ${reason}`,
    );
  for (const frame of sized) {
    if (frame.width + 2 * PADDING > PAGE_LIMIT || frame.height + 2 * PADDING > PAGE_LIMIT) {
      throw misfit(`"${frame.source}" is ${frame.width} × ${frame.height}`);
    }
  }
  const widest = Math.max(0, ...sized.map((frame) => frame.width + 2 * PADDING));
  let best: AtlasPlan | null = null;
  for (let width = 1; width <= PAGE_LIMIT; width *= 2) {
    if (width < widest) continue;
    const plan = { setId, ...shelves(sized, width) };
    if (plan.height > PAGE_LIMIT) continue;
    if (!best || plan.width * plan.height < best.width * best.height) best = plan;
  }
  if (!best) throw misfit('its frames would need a second page');
  return best;
}

/** Tallest first, then widest, then by key: an order that depends only on the sources. */
const tallestFirst = (a: Omit<PlacedFrame, 'x' | 'y'>, b: Omit<PlacedFrame, 'x' | 'y'>) =>
  b.height - a.height || b.width - a.width || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/** Packs frames, tallest first, into rows across a page of the given width. */
function shelves(
  frames: readonly Omit<PlacedFrame, 'x' | 'y'>[],
  pageWidth: number,
): { width: number; height: number; frames: PlacedFrame[] } {
  const placed: PlacedFrame[] = [];
  let x = PADDING;
  let y = PADDING;
  let rowHeight = 0;
  for (const frame of [...frames].sort(tallestFirst)) {
    if (x + frame.width + PADDING > pageWidth) {
      x = PADDING;
      y += rowHeight + PADDING;
      rowHeight = 0;
    }
    placed.push({ ...frame, x, y });
    x += frame.width + PADDING;
    rowHeight = Math.max(rowHeight, frame.height);
  }
  return { width: pageWidth, height: y + rowHeight + PADDING, frames: placed };
}

/** The page's frame table in Phaser's JSON hash atlas format, as text. */
export function frameTable(plan: AtlasPlan, image: string): string {
  const frames = Object.fromEntries(
    plan.frames.map(({ key, x, y, width: w, height: h }) => [
      key,
      {
        frame: { x, y, w, h },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w, h },
        sourceSize: { w, h },
      },
    ]),
  );
  const meta = { image, size: { w: plan.width, h: plan.height }, scale: 1 };
  return `${JSON.stringify({ frames, meta }, null, 2)}\n`;
}

/** Reads the root element's width and height, which must be whole numbers of design units. */
function svgSize(key: string, source: Source): { width: number; height: number } {
  const root = /<svg\b[^>]*>/.exec(source.svg)?.[0] ?? '';
  const attribute = (name: string) => {
    const value = new RegExp(`\\s${name}="([^"]*)"`).exec(root)?.[1] ?? '';
    return /^[1-9]\d*$/.test(value) ? Number(value) : null;
  };
  const width = attribute('width');
  const height = attribute('height');
  if (width === null || height === null) {
    throw new Error(`"${key}" needs whole-number width and height attributes, in design units`);
  }
  return { width, height };
}
