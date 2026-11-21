import * as Phaser from 'phaser';

export class Bad extends Phaser.Scene {
  create() {
    this.add.renderTexture(0, 0, 256, 256);
  }
}
