import { colors } from '@/kit/theme';

/**
 * What a point shows in each Seat's lamp. The signal and each decoy differ by picture as well as
 * by colour, and none is in a Seat colour (docs/design/style-guide.md), so a Player who cannot
 * tell the colours apart can still tell the signal from a decoy.
 */
export const SIGNAL = { frame: 'reaction-rush/signal', color: colors.leaf } as const;

/** The decoys, by kind: the rules' `decoy` is an index into this list. */
export const DECOYS = [
  { frame: 'reaction-rush/decoy-moon', color: colors.violet },
  { frame: 'reaction-rush/decoy-heart', color: colors.coral },
] as const;

/** The lamp with nothing in it, and the face of each Seat's button. */
export const LAMP = 'reaction-rush/lamp';
export const BUTTON = 'reaction-rush/button';
