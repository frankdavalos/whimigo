import type { GameManifest } from '@/contract';
import { colors } from '@/kit/theme';

export const manifest: GameManifest = {
  id: 'tic-tac-toe',
  title: 'Tic-Tac-Toe',
  minAge: 4,
  playStyles: [
    {
      style: 'turn-based',
      players: { min: 2, max: 2 },
      computerPlayers: 0,
      zoned: false,
      usesDifficulty: false,
    },
  ],
  card: { frame: 'arcade/game-card/tic-tac-toe', color: colors.sky },
  load: () => import('./index'),
};
