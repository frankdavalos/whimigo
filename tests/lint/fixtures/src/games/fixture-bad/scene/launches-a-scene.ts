import * as Phaser from 'phaser';

export class Bad extends Phaser.Scene {
  create() {
    this.scene.launch('fixture-bad/more');
  }
}
