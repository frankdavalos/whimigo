import { colors } from '@/kit/theme';

/**
 * The four pads, in order. Easy uses the first three. Each has its own colour, shape and tone, so
 * a Player who cannot tell the colours apart, or cannot hear, can still tell the pads apart. No pad
 * is in a Seat colour, so a pad is never taken for a Seat (docs/design/style-guide.md).
 */
export const PADS = [
  {
    name: 'circle',
    color: colors.pink,
    frame: 'color-echo/pad-circle',
    litFrame: 'color-echo/pad-circle-lit',
    tone: 'color-echo/tone-circle',
  },
  {
    name: 'square',
    color: colors.violet,
    frame: 'color-echo/pad-square',
    litFrame: 'color-echo/pad-square-lit',
    tone: 'color-echo/tone-square',
  },
  {
    name: 'triangle',
    color: colors.orange,
    frame: 'color-echo/pad-triangle',
    litFrame: 'color-echo/pad-triangle-lit',
    tone: 'color-echo/tone-triangle',
  },
  {
    name: 'star',
    color: colors.leaf,
    frame: 'color-echo/pad-star',
    litFrame: 'color-echo/pad-star-lit',
    tone: 'color-echo/tone-star',
  },
] as const;
