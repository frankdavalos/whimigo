import type { Rect } from '@/contract';
import type { Rng } from '@/kit/rng';
import { nextSeat } from '@/kit/turn';

export function start(rng: Rng, board: Rect) {
  return { first: rng.int(0, 1), seat: nextSeat(0, 2), board };
}
