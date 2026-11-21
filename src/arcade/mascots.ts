import type { MascotId } from '@/contract';

/**
 * The Mascots a Player can be, in the order the lobby shows them. Progress is saved against these
 * ids (ADR-0010), so they are permanent: an id is never renamed or reused, or the Stars saved
 * against it are lost. A Mascot may be redrawn freely; its picture is the frame
 * `arcade/mascot/<id>`. New Mascots are added at the end.
 */
export const MASCOTS: readonly MascotId[] = [
  'fox',
  'owl',
  'bear',
  'frog',
  'cat',
  'rabbit',
  'panda',
  'lion',
];

/** The frame of a Mascot's picture in the Arcade's atlas. */
export const mascotFrame = (mascot: MascotId) => `arcade/mascot/${mascot}`;
