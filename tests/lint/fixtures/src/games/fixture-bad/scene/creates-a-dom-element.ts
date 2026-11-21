import * as Phaser from 'phaser';

export class Bad extends Phaser.Scene {
  create() {
    this.add.dom(0, 0, 'div');
  }
}
