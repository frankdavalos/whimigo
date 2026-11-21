import * as Phaser from 'phaser';

export class Bad extends Phaser.Scene {
  create() {
    this.textures.addDynamicTexture('fixture-bad/canvas', 256, 256);
  }
}
