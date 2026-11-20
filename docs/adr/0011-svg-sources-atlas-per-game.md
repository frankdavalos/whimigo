---
status: accepted
---

# Art is authored as SVG and packed into one atlas per Game at build time

Each Game's artwork is kept as SVG beside the Game (the pipeline also accepts PNG, for hand-made art in a later phase), and a build script rasterises and packs it into a single texture atlas for that Game, plus one for the Arcade. We took on a build step because of how Phaser 4 draws on tablets: on mobile it batches one texture at a time, so every separately loaded image is its own draw call, and an open defect (#7414) makes frequent batch breaks slow in Chrome.

## Considered Options

- **Load each image separately at run time, including SVG through Phaser's loader.** Rejected for the draw-call cost above. It would have needed no build step.
- **Hand-made atlases from a packing tool.** Rejected. A manual step that a coding agent cannot run, and binary files to keep in step with their sources.
- **SVG sources, scripted atlas.** Chosen.

## Consequences

- SVG sources are small, diff well, are independent of the design-frame size, and can be written and edited by a coding agent. Through the first release that is how all art is made ([ADR-0016](0016-art-and-sound-made-in-code.md)).
- SVG features that render differently between rasterisers (filters, embedded text, fonts) are avoided. Text in art is converted to outlines.
- Atlases are generated, not committed. The script runs before `dev` and `build`.
- If the design frame changes ([ADR-0003](0003-fixed-design-frame.md)), vector art is re-rasterised at no cost; PNG art would have to be redrawn.
- A frame's key begins with its set's id, and a set's atlas is loaded as the texture of that name: the frame `tic-tac-toe/board` is in the texture `tic-tac-toe`, and the Arcade's `arcade/home` in `arcade`. A frame key alone therefore says where to find it, which is what lets the manifest, a Seat and the kit's controls name a picture with one string. Decided by the owner on 2026-11-20. The Game contract had asked for every pack key to start with `${id}/`, and the Phase 0 stand-in pack followed it with `standin/atlas`, which the kit could not draw from; the atlas is now the one key that is the bare id. Naming it `${id}/atlas` instead was rejected: with one page per Game the suffix says nothing, and it would have renamed the Arcade's own texture.
- Each Game has one atlas page of at most 4096 × 4096; a set that needs a second page fails the build with its name. Confirmed on 2026-11-20 (gate G3): art rasterised for the design frame is sharp on the iPad Pro, and a stand-in Game-sized set covering 1.15 times the frame's area packs into one 2048 × 3774 page, so one page per Game stays. Decoded, that page is about 31 MB of texture memory; the 5 MB per-Game budget is download size.
