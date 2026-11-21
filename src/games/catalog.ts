import type { GameManifest } from '@/contract';
import { manifest as colorEcho } from './color-echo/manifest';
import { manifest as reactionRush } from './reaction-rush/manifest';
import { manifest as ticTacToe } from './tic-tac-toe/manifest';

/**
 * The Catalog: every Game the Arcade offers, in the order the Home Screen shows them. Adding a
 * Game is one folder under src/games/ and one line here.
 */
export const CATALOG: readonly GameManifest[] = [ticTacToe, colorEcho, reactionRush];
