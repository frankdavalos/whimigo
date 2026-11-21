import * as Phaser from 'phaser';

export class Bad extends Phaser.Scene {
  create() {
    this.game.canvas.ownerDocument.createElement('div');
  }
}
