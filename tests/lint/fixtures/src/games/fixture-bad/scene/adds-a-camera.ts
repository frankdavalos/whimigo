import * as Phaser from 'phaser';

export class Bad extends Phaser.Scene {
  create() {
    this.cameras.add(0, 0, 256, 256);
  }
}
