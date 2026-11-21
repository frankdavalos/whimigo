/**
 * The asset build (ADR-0011): rasterises each set's SVG sources at design resolution and packs
 * them into one atlas page per set, and rasterises the app icons. Run by the Vite plugin in
 * vite.config.ts before the development server and the production build. Needs no network.
 */
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { frameTable, planAtlas, type AtlasPlan, type Source } from './atlas.ts';

/** A set of art: every SVG under `dir` becomes a frame keyed `${id}/<path without .svg>`. */
export interface AtlasSet {
  readonly id: string;
  /** Relative to the project root. */
  readonly dir: string;
  /** SVG files kept elsewhere that join the set, each as the frame `${id}/<name>`. */
  readonly extras?: readonly { readonly name: string; readonly file: string }[];
}

export interface BuildOptions {
  readonly root: string;
  readonly sets: readonly AtlasSet[];
  /** The app icon's SVG, relative to the root. */
  readonly icon: string;
  /** Where each set's `<id>.png` and `<id>.json` are written, relative to the root. */
  readonly atlasDir: string;
  /** Where the app icons are written, relative to the root. */
  readonly iconDir: string;
}

const GAMES = 'src/games';

/**
 * The sets of art in a project. The Arcade's own set also holds each Game's Game Card, which is
 * kept with the Game as `card.svg` and becomes the frame `arcade/game-card/<id>`. Each Game with
 * an `art/` folder has a set of its own, keyed by the Game's folder, which is its id (game
 * contract, Asset keys). So adding a Game needs no change here.
 */
export function assetSets(root: string): AtlasSet[] {
  const games = existsSync(join(root, GAMES))
    ? readdirSync(join(root, GAMES), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];
  const has = (id: string, path: string) => existsSync(join(root, GAMES, id, path));
  const cards = games
    .filter((id) => has(id, 'card.svg'))
    .map((id) => ({ name: `game-card/${id}`, file: `${GAMES}/${id}/card.svg` }));
  return [
    { id: 'arcade', dir: 'src/arcade/art', ...(cards.length > 0 ? { extras: cards } : {}) },
    // A Game-sized set that the Performance check loads as a pack.
    { id: 'standin', dir: 'src/arcade/checks/standin-art' },
    ...games.filter((id) => has(id, 'art')).map((id) => ({ id, dir: `${GAMES}/${id}/art` })),
  ];
}

/**
 * The Arcade's assets. Atlases are imported by the code that loads them, so the bundler gives
 * them content-hashed names; icons are public files with fixed names. Both folders are ignored
 * by git.
 */
export const ASSETS = {
  sets: assetSets(fileURLToPath(new URL('../..', import.meta.url))),
  icon: 'src/arcade/app-icon.svg',
  atlasDir: 'src/generated/atlases',
  iconDir: 'public/icons',
} as const satisfies Omit<BuildOptions, 'root'>;

/** Every frame key a set will have, without building it. */
export async function frameNames(root: string, set: AtlasSet): Promise<string[]> {
  return (await readSet(root, set)).map(({ name }) => `${set.id}/${name}`).sort();
}

/** A set's sources: its folder's SVGs and its extras. */
async function readSet(root: string, set: AtlasSet): Promise<Source[]> {
  const extras = await Promise.all(
    (set.extras ?? []).map(async ({ name, file }) => ({
      name,
      svg: await readFile(join(root, file), 'utf8'),
    })),
  );
  return [...(await readSources(join(root, set.dir))), ...extras];
}

/**
 * Plans every set before writing anything, so a set that does not fit fails the build with
 * nothing half-written. Returns each set's plan.
 */
export async function buildAssets(options: BuildOptions): Promise<AtlasPlan[]> {
  const { root } = options;
  const planned = await Promise.all(
    options.sets.map(async (set) => {
      const sources = await readSet(root, set);
      return { plan: planAtlas(set.id, sources), sources };
    }),
  );
  await mkdir(resolve(root, options.atlasDir), { recursive: true });
  for (const { plan, sources } of planned) {
    await writeAtlas(plan, sources, resolve(root, options.atlasDir));
  }
  await writeIcons(await readFile(join(root, options.icon)), resolve(root, options.iconDir));
  return planned.map(({ plan }) => plan);
}

/** The icon files and their sizes in pixels: the manifest's two, and the one iPadOS asks for. */
const ICON_SIZES = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 };

/** Square, and opaque: iPadOS shows transparency in a home-screen icon as black. */
async function writeIcons(svg: Buffer, outDir: string) {
  const { width = 0 } = await sharp(svg).metadata();
  await mkdir(outDir, { recursive: true });
  for (const [file, size] of Object.entries(ICON_SIZES)) {
    await sharp(svg, { density: (72 * size) / width })
      .resize(size, size, { fit: 'fill' })
      .flatten({ background: '#ffffff' })
      .png({ compressionLevel: 9 })
      .toFile(join(outDir, file));
  }
}

/** Every `.svg` under `dir`, named by its path inside it with `/` separators and no extension. */
async function readSources(dir: string): Promise<Source[]> {
  const files = (await readdir(dir, { recursive: true, encoding: 'utf8' }))
    .filter((file) => file.endsWith('.svg'))
    .sort();
  return Promise.all(
    files.map(async (file) => ({
      name: file
        .split(sep)
        .join('/')
        .replace(/\.svg$/, ''),
      svg: await readFile(join(dir, file), 'utf8'),
    })),
  );
}

async function writeAtlas(plan: AtlasPlan, sources: readonly Source[], outDir: string) {
  const svgOf = new Map(sources.map((source) => [source.name, source.svg]));
  const layers = await Promise.all(
    plan.frames.map(async (frame) => ({
      input: await sharp(Buffer.from(svgOf.get(frame.source) ?? ''), { density: 72 })
        .resize(frame.width, frame.height, { fit: 'fill' })
        .png()
        .toBuffer(),
      left: frame.x,
      top: frame.y,
    })),
  );
  const image = `${plan.setId}.png`;
  await sharp({
    create: {
      width: plan.width,
      height: plan.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, image));
  await writeFile(join(outDir, `${plan.setId}.json`), frameTable(plan, image));
}
