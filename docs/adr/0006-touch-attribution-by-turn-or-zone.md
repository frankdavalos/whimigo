---
status: accepted
---

# A touch belongs to a Seat by Turn or by Zone, and by nothing else

A tablet cannot tell whose finger is on it. Every touch a Game acts on is given exactly one Seat by one of two rules. On a shared board, it belongs to the Seat whose Turn it is. In a zoned Play Style, it belongs to the Seat in whose Zone it started, and it keeps that Seat until it lifts.

We considered asking children to identify themselves before each Move (tap your Mascot, then tap the board) and rejected it: it doubles the taps and a four-year-old will not do it. We considered one general input router that every touch passes through and rejected that too, because shared boards are served perfectly well by ordinary Phaser interactive objects behind a gate.

## Consequences

- On a shared board, a child can make a Move during a sibling's Turn. The design answer is a Turn indicator that cannot be missed, not software enforcement.
- Each Seat has at most one active touch in its Zone. A second finger or a resting palm there is ignored.
- A finger that slides out of its Zone still belongs to the Seat it started in, so children cannot press each other's buttons by dragging.
- A touch cancelled by the operating system is reported as cancelled and is never treated as a tap.
- Games that need two fingers from one Player are not supported. None is planned.
