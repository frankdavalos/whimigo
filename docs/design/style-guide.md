# Style guide

Everything a child sees is drawn in code ([ADR-0016](../adr/0016-art-and-sound-made-in-code.md)): SVG written in the repository, packed into atlases. This guide says how it should look, so that eight Mascots, every Game Card, every control and every Game look like one place. Written in Phase 1, slice 4a ([#16](https://github.com/frankdavalos/whimigo/issues/16)), before the Mascots and controls were redrawn to it. Every later Game is drawn to it from the start.

## The look

- **Flat colour.** No gradients, no shading, no shadows, no textures. Depth comes from overlapping shapes and outlines, not light. Transparency is used only for a shine (a pad's highlight) and for the scrim over a paused Round.
- **Bold outlines.** Every shape a child should see as a thing has an ink outline: 16 units on a 344-unit picture (`sizes.outline`), 10 to 12 on the parts inside it, and no less than 5 on the smallest features (a nose, a whisker, a Seat shape inside a 256-unit picture). Joins and line ends are round.
- **Rounded geometric forms.** Circles, ellipses, rounded rectangles (a 48-unit corner on a 344-unit tile, `sizes.corner`), triangles with round joins. If a shape needs more than a few curves, it is too detailed.
- **A limited palette.** Only the tokens below. A test (`tests/palette.test.ts`) fails if any SVG of the Arcade or of any Game uses another colour.
- **Big and few.** Pictures are seen from a metre away by a four-year-old. A detail smaller than about 20 units at design size is too small to carry meaning: it may decorate (a robot's eyes, a rabbit's teeth), but nothing may depend on seeing it.

## The palette

The tokens in [`src/kit/theme.ts`](../../src/kit/theme.ts) are the source of truth: code and SVG both use these values, and nothing else.

| Token | Value | Use |
|---|---|---|
| `ink` | `#2f3a56` | Outlines, eyes, digits. Never a large fill (the panda's patches are the exception) |
| `cream` | `#fff6e0` | Paper: faces of controls, muzzles, eye discs (the owl's, the frog's) |
| `white` | `#ffffff` | The shine in an eye, the panda, teeth, the Difficulty tiles, the strokes of the digits |
| `sand` | `#f2dfb4` | The rim of a control's face |
| `mist` | `#9aa3b5` | Grey fur; what is switched off |
| `sky`, `meadow`, `lilac`, `blush`, `butter` | `#9ad8f5`, `#b8e6a7`, `#c9b8f0`, `#f6b8c6`, `#fff0b0` | Backdrops, tiles, and the pale form of a colour (a pad that is not lit) |
| `sun`, `coral`, `orange`, `leaf` | `#ffc94a`, `#ff8a73`, `#f28c3a`, `#6cc26a` | Accents and fur |
| `bark`, `tan` | `#8a5a3c`, `#c99872` | Browns |
| `blue`, `yellow`, `red`, `aqua` | `#2f5bd3`, `#ffd84a`, `#d23c46`, `#4fd0e0` | The four Seat colours, and the strong form of those hues |

A Game picks its backdrop and accent from these and brings its own pictures drawn with them. It never restyles the shared controls.

## Seats

Seats 1 to 4 are **blue circle, yellow square, red triangle, aqua star**. A Seat's colour is never shown without its shape. The four Seat colours mean "this Seat" and nothing else: a Game's own pieces use other tokens (Color Echo's pads are pink, violet, orange and leaf), even where they share a Seat's shape. The four colours stay more than 20 apart in CIEDE2000 colour difference with ordinary vision and under simulated protanopia, deuteranopia and tritanopia (Machado et al., 2009). `src/kit/theme.test.ts` measures it, and the least difference today is about 29.

## No "up"

Around the table, children look at the board from opposite sides. Art on a shared board, and anything a Game shows to every Seat, must read the right way from any side: a circle, a star, a heart, a pad. It has no text, no arrow that means one direction, and no figure standing on a floor. Pictures that belong to one Seat, inside its Zone, are turned with the Zone and may have an up. The Arcade's own screens (Home Screen, lobby, pause, Result) are seen from one side and may have one.

## Mascots

Each Mascot is a head on a 344-unit square, with nothing cut off at the edge. They share one anatomy, so that they look like a family:

- A head that fills most of the square, outlined at 16.
- Eyes as ink dots of 16 to 22 units with a white shine up and to the left, set where the animal's eyes are (the frog's on top, the owl's in discs, the panda's in patches).
- A small mouth in ink, line width about 12, where the animal has one (the owl has a beak, the rabbit its teeth); a nose where the animal has one.
- Blush cheeks where the face is light enough for them to show.

What tells them apart is the **silhouette**: the fox's tall pointed ears and cream mask, the owl's tufts, eye discs and beak, the bear's round ears and muzzle, the frog's eyes on top, the cat's whiskers, the rabbit's long ears, the panda's black ears and eye patches, the lion's mane. Each one should still be recognisable as a solid shadow.

## Controls

Built only with the kit's `button`, `iconButton`, `holdButton`, `panel` and `seatBadge` ([`src/kit/controls.ts`](../../src/kit/controls.ts)) and `turnPointer` ([`src/kit/turn-pointer.ts`](../../src/kit/turn-pointer.ts)), each of which reports a touch rectangle of at least 256 units square, whatever it was asked for.

- An **icon button** is a 344-unit cream face with a sand rim and an ink outline (`arcade/card`), with an icon of at most 240 units on it.
- A **hold button** is the round face (`arcade/hold`); a coral ring fills as it is held.
- A **choice** (a Play Style, a Difficulty, a Seating) is a 256-unit rounded tile in a palette colour with a picture on it. The one chosen has an ink ring around it.
- A choice that is not on offer is not shown at all (no Difficulty for a Play Style without one, no Seating for one Player). A control that is shown but would do nothing now, like start before anyone has joined, is faded, never hidden.

## Pictures for ideas

Play Styles, Difficulties and Seatings are shown as pictures, never words:

- **People** are pawns, a round head over a rounded body, in cream. They are never in a Seat colour, so that they are not mistaken for a Seat.
- **Solo:** one person. **Turn-Based:** two people and an arrow from one to the other. **Simultaneous:** three people, each with a chevron above, all going at once. **Cooperative:** two people holding hands under a heart. **Versus Computer:** a person and a robot.
- **Difficulty:** three bars rising left to right; easy fills one in leaf, medium two in sun, hard all three in coral.
- **Seating:** the tablet and the four Seat shapes, in a row beneath it (side by side) or on both sides of it (around the table).

## Digits

The bitmap digits are ink outlines around white strokes, round-ended, built by the kit's `drawNumber`. They are the only glyphs in the canvas.

## What the palette test leaves out

The stand-in art of the Performance check (`src/arcade/checks/standin-art/`) is load for a measuring tool for grown-ups, not art for children, and is exempt from the palette test.
