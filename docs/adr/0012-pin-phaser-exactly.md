---
status: accepted
---

# Phaser is pinned to an exact version, and the project is scaffolded by hand

`phaser` is declared as exactly `4.2.1`, with no version range, and an upgrade is a deliberate task that ends with the full device checklist. Phaser 4 is the chosen engine and no blocker was found, but it is young: 4.0 shipped in April 2026, 4.2.1 in July 2026, and there has been no release or main-branch commit since August 2026 while defect reports keep arriving. A silent minor upgrade on a young engine is a risk we do not need.

The project is not created from the official Phaser templates. Their `dev` and `build` scripts send a usage ping to a third-party server, which conflicts with the no-analytics requirement.

## Consequences

- The features with open defects in 4.2.1 are avoided by rule: `Text`, `RenderTexture`, `DynamicTexture`, `Shader`, camera-zoom scaling, and destroying the `Phaser.Game`. Camera-zoom scaling here means zooming in to draw at the device's pixel ratio (Phaser issue #7351). The kit's render scale zooms every camera out instead, which on 2026-11-19 was confirmed to place and hit-test every target correctly in 4.2.1 (gate G8, [ADR-0003](0003-fixed-design-frame.md)).
- If a defect must be fixed locally, `patch-package` is the mechanism, and the patch is recorded here.
- Phaser 3 knowledge is not a safe guide. The installed type definitions and the v4 migration guide are the reference.
- Phaser is the only runtime dependency.
