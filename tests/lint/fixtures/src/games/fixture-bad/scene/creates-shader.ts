import * as Phaser from 'phaser';

export class Bad extends Phaser.Scene {
  create() {
    this.add.shader('fixture-bad/glow', 0, 0, 256, 256);
  }
}
