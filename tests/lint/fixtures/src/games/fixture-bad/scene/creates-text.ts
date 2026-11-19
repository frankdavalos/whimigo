import * as Phaser from 'phaser';

export class Labelled extends Phaser.Scene {
  create() {
    this.add.text(100, 100, 'Hello');
  }
}
