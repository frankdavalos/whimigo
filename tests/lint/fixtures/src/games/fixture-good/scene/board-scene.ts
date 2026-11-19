import * as Phaser from 'phaser';
import { DESIGN_FRAME } from '@/kit/frame';
import { createHold } from '@/kit/hold';
import { start } from '../logic/rules';

export class BoardScene extends Phaser.Scene {
  create(data: { rng: Parameters<typeof start>[0] }) {
    const state = start(data.rng, DESIGN_FRAME);
    const hold = createHold();
    this.time.delayedCall(500, () => hold.update(this.time.now));
    this.add.rectangle(state.board.x, state.board.y, 256, 256, 0xffcc00);
  }
}
