import type { GameModule } from '@/contract';
import image from '@/generated/atlases/tic-tac-toe.png?url&no-inline';
import frames from '@/generated/atlases/tic-tac-toe.json?url&no-inline';
import { manifest } from './manifest';
import { TicTacToeScene } from './scene/board-scene';
import { sounds } from './sounds';

const module: GameModule = {
  pack: { files: [{ type: 'atlas', key: manifest.id, textureURL: image, atlasURL: frames }] },
  sounds,
  scene: TicTacToeScene,
};

export default module;
