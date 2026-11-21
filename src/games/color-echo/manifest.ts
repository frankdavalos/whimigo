import type { GameManifest } from '@/contract';
import { colors } from '@/kit/theme';

export const manifest: GameManifest = {
  id: 'color-echo',
  title: 'Color Echo',
  minAge: 4,
  // Turn-Based (#19) and Cooperative (#20) follow.
  playStyles: [
    {
      style: 'solo',
      players: { min: 1, max: 1 },
      computerPlayers: 0,
      zoned: false,
      usesDifficulty: true,
    },
  ],
  card: { frame: 'arcade/game-card/color-echo', color: colors.lilac },
  load: () => import('./index'),
};
