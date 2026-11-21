import type { GameModule } from '@/contract';
import image from '@/generated/atlases/color-echo.png?url&no-inline';
import frames from '@/generated/atlases/color-echo.json?url&no-inline';
import { manifest } from './manifest';
import { ColorEchoScene } from './scene/echo-scene';
import { sounds } from './sounds';

const module: GameModule = {
  pack: { files: [{ type: 'atlas', key: manifest.id, textureURL: image, atlasURL: frames }] },
  sounds,
  scene: ColorEchoScene,
};

export default module;
