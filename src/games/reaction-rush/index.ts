import type { GameModule } from '@/contract';
import image from '@/generated/atlases/reaction-rush.png?url&no-inline';
import frames from '@/generated/atlases/reaction-rush.json?url&no-inline';
import { manifest } from './manifest';
import { ReactionRushScene } from './scene/rush-scene';
import { sounds } from './sounds';

const module: GameModule = {
  pack: { files: [{ type: 'atlas', key: manifest.id, textureURL: image, atlasURL: frames }] },
  sounds,
  scene: ReactionRushScene,
};

export default module;
