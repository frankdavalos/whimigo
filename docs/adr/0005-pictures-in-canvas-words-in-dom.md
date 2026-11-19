---
status: accepted
---

# Pictures in the canvas, words in the DOM

Anything a child touches is drawn by Phaser using pictures and, where unavoidable, a bitmap font. Anything only an adult reads (the loading splash, the fatal error screen, the Grown-Ups Area) is plain HTML with no framework. Phaser's `Text` object is not used at all.

The split follows the audience: children cannot read and need one consistent, touch-safe surface; adults need real, sharp, selectable text, which HTML does better than a canvas. It also follows the engine: in Phaser 4.2.1, `Text` renders as black boxes on iPadOS 16.4 and earlier (#7392), draws wrongly when rotated (#7372, and far Zones are rotated 180°), and each instance is its own texture, which on mobile means its own draw call.

## Consequences

- One bitmap font is generated once from the display typeface and committed. It covers digits and basic Latin letters.
- The DOM screens are full-screen and never shown during a Round, so they do not interfere with touch handling (see [ADR-0001](0001-phaser-centric-arcade-no-react.md)).
- The error screen works even when Phaser or WebGL has failed.
- Adding a language affects only the Grown-Ups Area's HTML and possibly the bitmap font's character set. There is no speech to translate ([ADR-0014](0014-synthesized-sound-no-voice.md)).
