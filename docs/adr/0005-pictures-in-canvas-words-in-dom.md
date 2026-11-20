---
status: accepted
---

# Pictures in the canvas, words in the DOM

Anything a child touches is drawn by Phaser using pictures and, where unavoidable, a bitmap font. Anything only an adult reads (the loading splash, the fatal error screen, the Grown-Ups Area) is plain HTML with no framework. Phaser's `Text` object is not used at all.

The split follows the audience: children cannot read and need one consistent, touch-safe surface; adults need real, sharp, selectable text, which HTML does better than a canvas. It also follows the engine: in Phaser 4.2.1, `Text` renders as black boxes on iPadOS 16.4 and earlier (#7392), draws wrongly when rotated (#7372, and far Zones are rotated 180°), and each instance is its own texture, which on mobile means its own draw call.

## Consequences

- There is no bundled typeface (decided by the owner on 2026-11-20, for the Phase 1 PRD, [#11](https://github.com/frankdavalos/whimigo/issues/11)). Words and digits in the canvas are glyphs drawn as SVG in the repository and packed into the Arcade's atlas, put together at run time by the kit; Phase 0 began this with its digits and a decimal point (2026-11-19), and Phase 1 redraws them to the style guide. The HTML screens use the device's own typeface. An earlier draft generated one bitmap font from a bundled open-licensed display face; that would bring in something made outside the repository, which [ADR-0016](0016-art-and-sound-made-in-code.md) rules out.
- The DOM screens are full-screen and never shown during a Round, so they do not interfere with touch handling (see [ADR-0001](0001-phaser-centric-arcade-no-react.md)).
- The error screen works even when Phaser or WebGL has failed.
- Adding a language affects only the Grown-Ups Area's HTML and possibly the set of glyphs drawn for the canvas. There is no speech to translate ([ADR-0014](0014-synthesized-sound-no-voice.md)).
