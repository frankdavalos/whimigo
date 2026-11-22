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
    {
      style: 'versus-computer',
      players: { min: 1, max: 1 },
      computerPlayers: 1,
      zoned: false,
      usesDifficulty: true,
    },
  ],
  card: { frame: 'arcade/game-card/tic-tac-toe', color: colors.sky },
  load: () => import('./index'),
};
