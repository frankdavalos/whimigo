import type * as Phaser from 'phaser';

/** What the Arcade holds in memory: Scenes, textures and cached sounds. */
export interface Counts {
  readonly scenes: number;
  readonly textures: number;
  readonly sounds: number;
}

/** The numbers that must return to where they were when a screen or a Game is left. */
export function countsOf(game: Phaser.Game): Counts {
  return {
    scenes: game.scene.scenes.length,
    textures: game.textures.getTextureKeys().length,
    sounds: game.cache.audio.getKeys().length,
  };
}
