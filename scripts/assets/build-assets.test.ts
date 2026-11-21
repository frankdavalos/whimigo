import {
  existsSync,
  mkdtempSync,
  readdirSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { ASSETS, assetSets, buildAssets, frameNames } from './build-assets';

const temporary: string[] = [];
afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A scratch project: `files` maps a path inside it to that file's text. */
function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'whimigo-assets-'));
  temporary.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const square = (width: number, height: number, fill: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${fill}"/></svg>`;

const ICON = square(64, 64, '#ffc94a');

interface Table {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
  meta: { image: string; size: { w: number; h: number } };
}

describe('building the assets', () => {
  it('rasterises every SVG of a set onto its page, at the place and size its frame table gives', async () => {
    const root = project({
      'art/red.svg': square(300, 200, '#ff0000'),
      'art/more/blue.svg': square(120, 260, '#0000ff'),
      'icon.svg': ICON,
    });
    await buildAssets({
      root,
      sets: [{ id: 'fox', dir: 'art' }],
      icon: 'icon.svg',
      atlasDir: 'out/atlases',
      iconDir: 'out/icons',
    });

    const table = JSON.parse(readFileSync(join(root, 'out/atlases/fox.json'), 'utf8')) as Table;
    expect(Object.keys(table.frames).sort()).toEqual(['fox/more/blue', 'fox/red']);
    expect(table.meta.image).toBe('fox.png');
    const page = join(root, 'out/atlases/fox.png');
    expect(await sharp(page).metadata()).toMatchObject({
      width: table.meta.size.w,
      height: table.meta.size.h,
    });

    const colourAt = async (key: string) => {
      const { x, y, w, h } = table.frames[key]!.frame;
      const pixels = await sharp(page)
        .extract({ left: x, top: y, width: w, height: h })
        .raw()
        .toBuffer();
      return [0, 1, 2, 3].map((channel) => {
        const values = pixels.filter((_, index) => index % 4 === channel);
        return [Math.min(...values), Math.max(...values)];
      });
    };
    expect(table.frames['fox/red']!.frame).toMatchObject({ w: 300, h: 200 });
    expect(await colourAt('fox/red')).toEqual([
      [255, 255],
      [0, 0],
      [0, 0],
      [255, 255],
    ]);
    expect(table.frames['fox/more/blue']!.frame).toMatchObject({ w: 120, h: 260 });
    expect(await colourAt('fox/more/blue')).toEqual([
      [0, 0],
      [0, 0],
      [255, 255],
      [255, 255],
    ]);
  });

  it('rasterises the app icon, opaque, at 192 and 512 pixels and as a 180-pixel apple-touch-icon', async () => {
    const root = project({ 'art/dot.svg': square(10, 10, '#000000'), 'icon.svg': ICON });
    await buildAssets({
      root,
      sets: [{ id: 'fox', dir: 'art' }],
      icon: 'icon.svg',
      atlasDir: 'out/atlases',
      iconDir: 'out/icons',
    });
    const sizes: Record<string, number> = {
      'icon-192.png': 192,
      'icon-512.png': 512,
      'apple-touch-icon.png': 180,
    };
    for (const [file, size] of Object.entries(sizes)) {
      const icon = sharp(join(root, 'out/icons', file));
      expect(await icon.metadata(), file).toMatchObject({
        format: 'png',
        width: size,
        height: size,
      });
      expect((await icon.stats()).isOpaque, file).toBe(true);
    }
  });

  it('gives the same frame table when built twice from the same sources', async () => {
    const files: Record<string, string> = { 'icon.svg': ICON };
    for (let index = 0; index < 30; index++) {
      files[`art/piece-${index}.svg`] = square(40 + ((index * 37) % 200), 300, '#336699');
    }
    const root = project(files);
    const tables = [];
    for (const out of ['first', 'second']) {
      await buildAssets({
        root,
        sets: [{ id: 'fox', dir: 'art' }],
        icon: 'icon.svg',
        atlasDir: `${out}/atlases`,
        iconDir: `${out}/icons`,
      });
      tables.push(readFileSync(join(root, out, 'atlases/fox.json')));
    }
    expect(tables[1]!.equals(tables[0]!)).toBe(true);
  });

  it('fails, naming the set, and writes no atlas when a set would need a second page', async () => {
    const files: Record<string, string> = { 'icon.svg': ICON, 'small/dot.svg': ICON };
    for (let index = 0; index < 5; index++) {
      files[`huge/wall-${index}.svg`] = square(2000, 2000, '#336699');
    }
    const root = project(files);
    await expect(
      buildAssets({
        root,
        sets: [
          { id: 'small', dir: 'small' },
          { id: 'huge', dir: 'huge' },
        ],
        icon: 'icon.svg',
        atlasDir: 'out/atlases',
        iconDir: 'out/icons',
      }),
    ).rejects.toThrow(/Atlas set "huge" does not fit one 4096 × 4096 atlas page/);
    expect(existsSync(join(root, 'out'))).toBe(false);
  });
});

describe('the Arcade’s own assets', () => {
  const root = fileURLToPath(new URL('../..', import.meta.url));

  it('pack each set onto one page, every SVG a frame keyed by its set and sized in design units', async () => {
    const out = mkdtempSync(join(tmpdir(), 'whimigo-assets-'));
    temporary.push(out);
    const plans = await buildAssets({
      ...ASSETS,
      root,
      atlasDir: join(out, 'atlases'),
      iconDir: join(out, 'icons'),
    });
    expect(plans.map((plan) => plan.setId)).toEqual(ASSETS.sets.map((set) => set.id));

    for (const [index, set] of ASSETS.sets.entries()) {
      const plan = plans[index]!;
      const files = [
        ...readdirSync(join(root, set.dir), { recursive: true, encoding: 'utf8' })
          .filter((file) => file.endsWith('.svg'))
          .map((file) => ({
            key: `${set.id}/${file.replace(/\.svg$/, '')}`,
            path: join(set.dir, file),
          })),
        ...(set.extras ?? []).map(({ name, file }) => ({ key: `${set.id}/${name}`, path: file })),
      ].sort((a, b) => a.key.localeCompare(b.key));
      expect(files.length, set.id).toBeGreaterThan(0);
      const frames = new Map(plan.frames.map((frame) => [frame.key, frame]));
      expect([...frames.keys()].sort()).toEqual(files.map(({ key }) => key));
      for (const { key, path } of files) {
        const { width, height } = await sharp(join(root, path)).metadata();
        const frame = frames.get(key)!;
        expect({ width: frame.width, height: frame.height }, key).toEqual({ width, height });
      }
      expect(plan.width).toBeLessThanOrEqual(4096);
      expect(plan.height).toBeLessThanOrEqual(4096);
    }
  });

  it('include a stand-in Game-sized set whose frames cover at least the design frame', async () => {
    const standin = ASSETS.sets.find((set) => set.id === 'standin')!;
    const files = readdirSync(join(root, standin.dir)).filter((file) => file.endsWith('.svg'));
    let area = 0;
    for (const file of files) {
      const { width = 0, height = 0 } = await sharp(join(root, standin.dir, file)).metadata();
      area += width * height;
    }
    expect(area).toBeGreaterThanOrEqual(2752 * 2064);
  });
});

describe('the sets of art', () => {
  it('are the Arcade’s, the stand-in’s, and one for each Game that has art, keyed by its folder', () => {
    const root = project({
      'src/games/tic-tac-toe/art/board.svg': square(10, 10, '#000000'),
      'src/games/tic-tac-toe/card.svg': square(10, 10, '#000000'),
      'src/games/no-art-yet/manifest.ts': '',
      'src/games/catalog.ts': '',
    });
    expect(assetSets(root)).toEqual([
      {
        id: 'arcade',
        dir: 'src/arcade/art',
        extras: [{ name: 'game-card/tic-tac-toe', file: 'src/games/tic-tac-toe/card.svg' }],
      },
      { id: 'standin', dir: 'src/arcade/checks/standin-art' },
      { id: 'tic-tac-toe', dir: 'src/games/tic-tac-toe/art' },
    ]);
  });

  it('pack each Game’s Game Card into the Arcade’s atlas under arcade/game-card/<id>', async () => {
    const root = project({
      'src/arcade/art/sun.svg': square(20, 20, '#ffc94a'),
      'src/arcade/checks/standin-art/token.svg': square(20, 20, '#ffc94a'),
      'src/games/fox-run/art/fox.svg': square(30, 30, '#ff8a73'),
      'src/games/fox-run/card.svg': square(40, 40, '#ff8a73'),
      'icon.svg': ICON,
    });
    const sets = assetSets(root);
    await buildAssets({ root, sets, icon: 'icon.svg', atlasDir: 'out', iconDir: 'icons' });
    const arcade = JSON.parse(readFileSync(join(root, 'out/arcade.json'), 'utf8')) as Table;
    expect(Object.keys(arcade.frames).sort()).toEqual(['arcade/game-card/fox-run', 'arcade/sun']);
    const game = JSON.parse(readFileSync(join(root, 'out/fox-run.json'), 'utf8')) as Table;
    expect(Object.keys(game.frames)).toEqual(['fox-run/fox']);
    expect(await frameNames(root, sets[0]!)).toEqual(['arcade/game-card/fox-run', 'arcade/sun']);
  });

  it('include this repository’s own Games', () => {
    const ids = ASSETS.sets.map((set) => set.id);
    expect(ids).toContain('tic-tac-toe');
  });
});
