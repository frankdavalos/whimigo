---
status: accepted
---

# Phaser is pinned to an exact version, and the project is scaffolded by hand

`phaser` is declared as exactly `4.2.1`, with no version range, and an upgrade is a deliberate task that ends with the full device checklist. Phaser 4 is the chosen engine and no blocker was found, but it is young: 4.0 shipped in April 2026, 4.2.1 in July 2026, and there has been no release or main-branch commit since August 2026 while defect reports keep arriving. A silent minor upgrade on a young engine is a risk we do not need.

The project is not created from the official Phaser templates. Their `dev` and `build` scripts send a usage ping to a third-party server, which conflicts with the no-analytics requirement.

## Consequences

- The features with open defects in 4.2.1 are avoided by rule: `Text`, `RenderTexture`, `DynamicTexture`, `Shader`, camera-zoom scaling, and destroying the `Phaser.Game`. Camera-zoom scaling here means zooming in to draw at the device's pixel ratio (Phaser issue #7351). The kit's render scale zooms every camera out instead, which on 2026-11-19 was confirmed to place and hit-test every target correctly in 4.2.1 (gate G8, [ADR-0003](0003-fixed-design-frame.md)).
- If a defect must be fixed locally, `patch-package` is the mechanism, and the patch is recorded here.
- Confirmed on 2026-11-20 (gate G7): Phaser 4.2.1 is dependable on the iPad Pro, iPadOS 27.2. Atlas art and bitmap digits drew correctly and nothing crashed. One gap is worked around in our own code, not by patching Phaser: in the installed app, turning to portrait fires the window's resize before the page's box has its new width, and Phaser's Scale Manager kept the stale width. A `ResizeObserver` on the box in `src/main.ts` refreshes Phaser's sizing whenever the box changes (`e14e3f5`), and a layout test reproduces that order of events. Do not remove the observer on an upgrade without repeating device checklist items 13 and 14 in the installed app.
- Phaser 3 knowledge is not a safe guide. The installed type definitions and the v4 migration guide are the reference.
- Phaser is the only runtime dependency.
