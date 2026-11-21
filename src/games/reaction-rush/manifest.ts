import type { GameManifest } from '@/contract';
import { colors } from '@/kit/theme';

export const manifest: GameManifest = {
  id: 'reaction-rush',
  title: 'Reaction Rush',
  minAge: 4,
  // Versus Computer follows in Phase 2.
  playStyles: [
    {
      style: 'simultaneous',
      players: { min: 2, max: 4 },
      computerPlayers: 0,
      zoned: true,
      usesDifficulty: true,
    },
  ],
  card: { frame: 'arcade/game-card/reaction-rush', color: colors.meadow },
  load: () => import('./index'),
};
