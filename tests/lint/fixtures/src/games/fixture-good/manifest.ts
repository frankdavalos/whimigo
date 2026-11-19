import type { GameManifest } from '@/contract';

export const manifest: GameManifest = {
  id: 'fixture-good',
  load: () => import('./index'),
};
