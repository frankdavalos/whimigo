import type { GameManifest } from '@/contract';
import { colors } from '@/kit/theme';

export const manifest: GameManifest = {
  id: 'color-echo',
  title: 'Color Echo',
  minAge: 4,
  playStyles: [
    {
      style: 'solo',
      players: { min: 1, max: 1 },
      computerPlayers: 0,
      zoned: false,
      usesDifficulty: true,
    },
    {
      style: 'turn-based',
      players: { min: 2, max: 4 },
      computerPlayers: 0,
      zoned: false,
      usesDifficulty: true,
    },
    {
      style: 'cooperative',
      players: { min: 2, max: 4 },
      computerPlayers: 0,
      zoned: true,
      usesDifficulty: true,
    },
  ],
  card: { frame: 'arcade/game-card/color-echo', color: colors.lilac },
  load: () => import('./index'),
};
