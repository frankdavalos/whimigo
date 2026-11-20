---
status: accepted
---

# A fixed 2752 × 2064 design frame, scaled by Phaser's EXPAND mode

Every screen is laid out in one coordinate system: a 2752 × 2064 design frame that is always fully visible, with the canvas widening on screens wider than 4:3. That is the native resolution of the family's 13-inch iPad Pro (M5), so one design unit is one screen pixel on the tablet the Arcade is made for.

We do not render at each device's own pixel ratio. Phaser 4 has no support for it, and the usual workaround (a device-resolution canvas with a zoomed camera) has an open defect in 4.2.1 that breaks rendering and hit testing. So one size has to be chosen, and the owner chose the largest: Android matters little to this project in practice, and art made for the biggest screen scales down cleanly to smaller ones, where the reverse would not be true.

## Considered Options

- **A canvas sized per device, with the camera zoomed to match.** Rejected as the main approach: Phaser issue #7351 reports it failing, and the Arcade should not depend from day one on something that may be broken. It is kept in reserve and tested in Phase 0; see Consequences.
- **A scale factor applied to every coordinate in every Game.** Rejected. It is the only defect-free way to be sharp everywhere, but it puts a multiplication on every position, size and speed and is easy for a contributor to forget.
- **2048 × 1536.** The earlier proposal, a compromise between the iPad Pro and a typical Android tablet. Rejected once Android was set aside: it would have been stretched 1.34 times on the tablet that matters.
- **2752 × 2064.** Chosen.

## Consequences

- Every tablet draws the full frame, whatever its screen. An 11-inch iPad draws about 60% more pixels than it shows, which it can afford. A typical 1920 × 1200 Android tablet would draw about three times as many, with texture memory to match. That cost is accepted and unmeasured.
- Rasterised art is large. Atlas pages are capped at 4096 × 4096, and backdrops are flat fills or small tiling frames, never full-screen images: one image the size of the frame is about 23 MB of texture memory.
- Smaller iPads need nothing extra. An iPad mini (2266 × 1488) draws about twice the pixels it shows, which its processor handles easily. What changes on a mini is physical size: everything is about 56% as large, so the 256-unit minimum touch target is about 14 mm there, against 25 mm on the iPad Pro. Sizes are therefore judged at the smallest supported screen, the 8.3-inch mini.
- A lighter drawing mode is kept possible but is not switched on. The kit holds one hidden number, the render scale, fixed at 1. At 0.5 the canvas has half the pixels each way and every Scene's camera is zoomed to match, so Games, which work only in design units, do not change. Phase 0 proves or disproves that this works in Phaser 4.2.1, with an automated test that taps the same targets at both scales. If it works, a slower tablet can be given a lighter mode later by changing one place. If it does not, nothing else in this decision changes. Confirmed on 2026-11-19 (gate G8): at render scale 0.5 every named target of the Home Screen and the check screens sits within one CSS pixel of its place at 1 and a press there does the same, so a lighter mode is available whenever wanted. Phaser issue #7351 is about zooming the camera in for high pixel ratios; zooming it out to 0.5, as the kit does, places and hit-tests every target correctly in 4.2.1. The scale can be asked for only by a test, with `scale=0.5` beside `e2e=1` in the address.
- For that to stay possible, a Game may not add or reconfigure cameras, or place anything in screen pixels.
- After Games exist this number is expensive to change, because positions throughout are written against it.
- Games never read the window size or pixel ratio. They use `stage.safe` and `stage.backdrop`.
