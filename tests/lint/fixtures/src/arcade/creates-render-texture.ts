import * as Phaser from 'phaser';

export class Painter extends Phaser.Scene {
  create() {
    this.add.renderTexture(0, 0, 256, 256);
  }
}
