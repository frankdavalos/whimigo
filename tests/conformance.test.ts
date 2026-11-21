import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { GameManifest, GameModule, PlayStyleOption } from '../src/contract';
import { CATALOG } from '../src/games/catalog';
import { ASSETS, frameNames } from '../scripts/assets/build-assets';
import { checkCatalog, checkModule } from '../src/arcade/conformance';

const root = fileURLToPath(new URL('..', import.meta.url));
const arcadeSet = ASSETS.sets.find((set) => set.id === 'arcade')!;
const arcadeFrames = new Set(await frameNames(root, arcadeSet));

const turnBased: PlayStyleOption = {
  style: 'turn-based',
  players: { min: 2, max: 2 },
  computerPlayers: 0,
  zoned: false,
  usesDifficulty: false,
};

const manifest = (changes: Partial<GameManifest> = {}): GameManifest => ({
  id: 'good-game',
  title: 'Good Game',
  minAge: 4,
  playStyles: [turnBased],
  card: { frame: 'arcade/card', color: 0 },
  load: () => Promise.reject(new Error('fixture')),
  ...changes,
});

type Module = Pick<GameModule, 'pack' | 'sounds'>;

const module = (changes: Partial<Module> = {}): Module => ({
  pack: { files: [{ type: 'atlas', key: 'good-game', textureURL: 'a.png', atlasURL: 'a.json' }] },
  sounds: { 'good-game/tap': { notes: [{ wave: 'sine', from: 440, at: 0, for: 100 }] } },
  ...changes,
});

describe('the Catalog', () => {
  it('passes the manifest checks, for every Game in it', () => {
    expect(checkCatalog(CATALOG, arcadeFrames)).toEqual([]);
  });
});

describe('the manifest checks', () => {
  const faults: Record<string, GameManifest[]> = {
    'an id already used': [manifest(), manifest()],
    'an id not in kebab case': [manifest({ id: 'Good_Game' })],
    'a Player range below one': [
      manifest({ playStyles: [{ ...turnBased, players: { min: 0, max: 2 } }] }),
    ],
    'a Player range above four': [
      manifest({ playStyles: [{ ...turnBased, players: { min: 2, max: 5 } }] }),
    ],
    'a Player range with its least above its most': [
      manifest({ playStyles: [{ ...turnBased, players: { min: 3, max: 2 } }] }),
    ],
    'Computer Players on a Play Style other than Versus Computer': [
      manifest({ playStyles: [{ ...turnBased, computerPlayers: 1 }] }),
    ],
    'more than four Seats': [
      manifest({
        playStyles: [
          {
            style: 'versus-computer',
            players: { min: 1, max: 4 },
            computerPlayers: 1,
            zoned: false,
            usesDifficulty: true,
          },
        ],
      }),
    ],
    'a Game Card frame missing from the Arcade’s atlas': [
      manifest({ card: { frame: 'arcade/no-such-card', color: 0 } }),
    ],
  };

  it('pass a good manifest', () => {
    expect(checkCatalog([manifest()], arcadeFrames)).toEqual([]);
  });

  for (const [fault, manifests] of Object.entries(faults)) {
    it(`fail ${fault}`, () => {
      expect(checkCatalog(manifests, arcadeFrames)).toHaveLength(1);
    });
  }
});

describe('the module checks', () => {
  const faults: Record<string, Module> = {
    'an atlas not keyed with the Game’s id': module({
      pack: { files: [{ type: 'atlas', key: 'other', textureURL: 'a.png', atlasURL: 'a.json' }] },
    }),
    'a second atlas': module({
      pack: {
        files: [
          { type: 'atlas', key: 'good-game', textureURL: 'a.png', atlasURL: 'a.json' },
          { type: 'atlas', key: 'good-game/more', textureURL: 'b.png', atlasURL: 'b.json' },
        ],
      },
    }),
    'another pack key not beginning with the id and a /': module({
      pack: {
        files: [
          { type: 'atlas', key: 'good-game', textureURL: 'a.png', atlasURL: 'a.json' },
          { type: 'json', key: 'levels', url: 'levels.json' },
        ],
      },
    }),
    'a sound key not beginning with the id and a /': module({
      sounds: { tap: { notes: [{ wave: 'sine', from: 440, at: 0, for: 100 }] } },
    }),
    'an audio file in the pack': module({
      pack: {
        files: [
          { type: 'atlas', key: 'good-game', textureURL: 'a.png', atlasURL: 'a.json' },
          { type: 'audio', key: 'good-game/music', url: 'music.mp3' },
        ],
      },
    }),
  };

  it('pass a good module', () => {
    expect(checkModule('good-game', module())).toEqual([]);
  });

  for (const [fault, fixture] of Object.entries(faults)) {
    it(`fail ${fault}`, () => {
      expect(checkModule('good-game', fixture)).toHaveLength(1);
    });
  }
});
