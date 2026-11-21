import * as Phaser from 'phaser';

export class Bad extends Phaser.Scene {
  create() {
    this.scene.add('fixture-bad/more', Phaser.Scene, true);
  }
}
