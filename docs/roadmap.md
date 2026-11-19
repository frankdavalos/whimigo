# Roadmap

Five phases. Each one ends with something a person can install and use, and with a gate that says whether to go on. Terms in **bold** are defined in [CONTEXT.md](../CONTEXT.md).

| Phase | Outcome | Ends when |
|---|---|---|
| 0 | The risky questions are answered on the family's iPad Pro | The gate decisions are recorded |
| 1 | Three Games, playable offline by the family | All three have been played on the iPad Pro |
| 2 | All eight Games | Every Game is playable alone and together |
| 3 | The Arcade is polished, accessible and dependable | The quality checklist is met |
| 4 | New Games as wanted | Open-ended |

There are no dates. Each phase is a ZSL PRD, sliced and built as described in [implementation-handoff.md](implementation-handoff.md).

Through Phase 3, human involvement is kept low on purpose ([ADR-0016](adr/0016-art-and-sound-made-in-code.md)). Art is drawn in code, sound is synthesized, and there is no voice. A person is needed for three things only: setting up hosting once, running the device checklist on the iPad Pro at each gate, and looking at the result and saying what should change.

## Phase 0: technical proof of concept

**Purpose.** Answer, on the family's 13-inch iPad Pro (M5), the questions that could change the architecture. Phase 0 is not throwaway: the project skeleton, the deployment, and the check screens all stay.

**What is built**

1. A walking skeleton: the pinned stack, one `Phaser.Game` at the 2752 × 2064 design frame, a "tap to start" screen that unlocks sound, a placeholder Home Screen, the DOM error screen, the test bridge, lint rules, and CI.
2. Installation and offline: manifest, service worker in prompt mode, everything precached, deployed to the permanent address.
3. **Touch Check** screen: every live touch drawn with its slot number, the highest simultaneous count, a cancellation counter, and four **Zones** with tap counters in both **Seatings**.
4. **Performance check** screen: a fixed load of moving sprites from one atlas with a frame-rate reading, and a loop that adds and removes a Scene with a pack and reports texture and Scene counts. It can also be opened at half render scale, to find out whether a lighter drawing mode is possible ([ADR-0003](adr/0003-fixed-design-frame.md)).
5. **Sound and suspension check** screen: plays synthesized sounds on demand and shows the audio state and visibility events as they happen. This is where the recipe synthesizer is first written, and where it is confirmed that Phaser will play a sound rendered from a recipe.

**Dependencies.** The permanent address (open decision 1). The skeleton and check screens can be built before it is settled; the device run cannot.

**Acceptance criteria**

- `npm run check` and `npm run e2e` pass in CI.
- The Arcade installs on the iPad Pro from the permanent address and starts in aeroplane mode.
- Items marked **(P0)** on the [device checklist](testing-strategy.md#real-device-checklist) have been run on the iPad Pro and the results written down. One adult can do this alone in about half an hour.
- Each gate decision below has an answer, and any ADR it changes is revised.

**Gate decisions**

| # | Question | If yes | If no |
|---|---|---|---|
| G1 | Do four simultaneous touches survive on the iPad, in some combination of settings? | Four **Seats** in **Simultaneous** play on iPadOS; the settings go in the family guide | Simultaneous play is capped at three Seats on iPadOS, and four-Seat Reaction Rush is Android-only or dropped |
| G2 | Is the work per frame on the iPad Pro under 3 milliseconds with the standard load? | Keep going; there is room for Low Power Mode, heat and older iPads | Find the cost before Phase 1; a tablet this fast should not be close |
| G3 | Does art rasterised for the 2752 × 2064 frame look sharp, and does a full screen's worth fit in one 4096 × 4096 atlas page? | Keep one atlas page per Game | Allow two pages per Game and record it in [ADR-0011](adr/0011-svg-sources-atlas-per-game.md) |
| G4 | Does sound return after backgrounding, locking and relaunching? | Keep the simple resume-on-tap design | Add the reload-at-Home-Screen fallback to Phase 1 |
| G5 | Is the top of the screen usable in the installed app with the 88-unit margin? | Keep it | Increase the margin or stop drawing under the status bar |
| G6 | Does adding and removing a Scene and its pack 50 times leave counts unchanged? | Keep per-Game unloading | Investigate before Phase 1; fall back to keeping assets loaded |
| G7 | Is Phaser 4.2.1 dependable on the iPad Pro (atlas art and bitmap digits draw correctly, no crashes)? | Proceed | Record the defect, patch it or work around it, before Phase 1 |
| G8 | At half render scale, does the picture match and do taps land on the same targets? Answered by an automated test, not on the tablet | A lighter mode is available whenever wanted; it stays switched off | Record in ADR-0003 that slower tablets get the full frame. Nothing else changes |

**Risks.** The answer to G1 may be "no", which reduces what four children can do on the iPad but does not block the project. Nothing in this phase says anything about Android: with no Android tablet to test, its touch limits, speed and full-screen behaviour stay unverified, and the check screens are kept so they can be run on one later.

**Complete when.** Every gate decision is recorded and the architecture documents reflect the answers.

## Phase 1: three-Game vertical slice

**Purpose.** A real, small Arcade: Tic-Tac-Toe, Color Echo and Reaction Rush, chosen because together they need every shared capability the other five Games use.

**What is built**, in dependency order. Each line is a vertical slice that ends in something playable.

1. **A two-Player Round of Tic-Tac-Toe from the Home Screen to a Result and back.** This first slice creates the Game contract, `GameHost`, `openRound`, the Stage, `TurnGate`, the first UI controls and the asset pipeline, each only as far as this one path needs.
2. **Pausing and leaving:** the hold-to-pause control, the pause screen, pause on app hidden, exit to the Home Screen.
3. **The lobby:** **Mascots** join **Seats**, the **Play Style** follows from who joined, **Difficulty** is chosen, choices are remembered. This slice also writes the style guide and draws the first Mascots to it.
4. **Tic-Tac-Toe Versus Computer** at three Difficulties.
5. **Progress:** `SaveStore`, **Stars** awarded from a Result and shown on the Mascots.
6. **Color Echo, Solo:** synthesized pad tones, the **Demo**, motion presets and reduced motion.
7. **Color Echo, Turn-Based** for two to four Players.
8. **Zones and Seating:** `SeatZones`, the Seating choice in the lobby, and **Reaction Rush** for two to four Seats.
9. **Color Echo, Cooperative**, each Seat owning a pad in its Zone.
10. **The Grown-Ups Area:** the gate, sound and motion settings, update, reset Progress, Touch Check, version and storage status, install steps.
11. **Hardening:** corrupt and unavailable storage, a Game that fails to load, the update flow, the leak test across all three Games.
12. **Device acceptance:** the full checklist on the iPad Pro.

Slices 2 to 5 depend only on 1 and can proceed in parallel with one another. Slices 6 and 8 depend on 1 and are independent of each other. Slice 9 needs 6 and 8.

**Dependencies.** Phase 0 complete. Nothing from outside the repository: art is drawn in code to the style guide and sound is synthesized.

**Acceptance criteria**

- All three Games pass the per-Game definition of done in [testing-strategy.md](testing-strategy.md#for-agents-working-on-one-game).
- A **Session** can be started for every Play Style each Game declares, with every valid number of Players.
- Stars and remembered choices survive closing and reopening the installed app.
- The installed Arcade plays all three Games with no network.
- Opening and closing all three Games 20 times leaves counts unchanged.
- The full device checklist passes on the iPad Pro, within the limits recorded at the Phase 0 gate.
- Each Game's **Demo** plays on the first **Round** of a **Session** and can be replayed from the pause screen.
- The owner has played all three Games on the iPad Pro and listed what should change. Watching a child try each Game from its Demo alone is recommended, because there are no words or voice to fall back on, but it is not a gate.

**Risks.** The contract is shaped by one Game and then tested by two very different ones; expect it to move during slices 6 and 8, and treat that as the point of the phase. Art drawn in code may need more than one pass before it looks right, and a Demo may not be enough to teach a Game; both show up only when someone looks.

**Complete when.** Three Games can be played on the installed Arcade, alone and together, without explanation. The Game contract is then considered stable, and its ADRs are `accepted`.

## Phase 2: eight-Game playable Arcade

**Purpose.** The full first-release **Catalog**.

**What is built**, in order:

1. **Memory Match** (Solo, Turn-Based, Cooperative). Adds seeded shuffling.
2. **Four in a Row** (Versus Computer, Turn-Based). The game-tree search is extracted from Tic-Tac-Toe into the kit here, with both Games using it.
3. **Snakes and Ladders** (Turn-Based, Versus Computer). Adds a visible seeded die and a **Computer Player** that only rolls.
4. **Dots and Boxes** (Turn-Based, Versus Computer).
5. **Hungry Critters** (Simultaneous, Versus Computer). Adds continuous motion.
6. **Reaction Rush Versus Computer**, so that every Game can be played alone.

Once the search is extracted in step 2, the five Games are independent of one another and can be built in parallel, one agent per Game. This is where `/zsl:tdd-parallel` earns its keep.

**Dependencies.** Phase 1 complete and the contract stable. Open product decisions in [game-catalog.md](product/game-catalog.md#open-product-decisions) settled.

**Acceptance criteria**

- All eight Games pass the per-Game definition of done.
- Every Game can be started by one Player alone.
- No Game required a change to another Game's folder. Changes to the kit or contract made during this phase are listed, each with its reason.
- The precache is within 60 MB and each Game within 5 MB.
- The full device checklist passes with all eight Games.

**Risks.** Hungry Critters is the first Game with continuous motion and may show performance limits the others did not. Dots and Boxes has the smallest touch targets in the Catalog. Five Games' worth of art, all drawn in code to one style guide, is the largest content task in the project.

**Complete when.** Eight Games are installed and playable, alone and together.

## Phase 3: quality, accessibility and visual polish

**Purpose.** Turn a working Arcade into one that delights and can be trusted.

**What is built**

One PRD, through `/zsl:tdd-parallel`:

- **Achievements:** the optional contract fields, stickers per Mascot, a place to see them.
- **Accessibility, automated:** every target meets the size and spacing minimums in every Game at every viewport; every state shown by colour also has a shape; the four Seat colours stay distinguishable under simulated colour-vision deficiencies, checked by computed colour difference; reduced motion completes every Game.
- **Robustness:** a longer soak test; behaviour with storage full; update while offline.
- **Installation polish:** icons, splash screens, the offline-ready indicator.
- **Performance:** measure against the budgets and fix what misses.
- **Art and motion pass:** every Mascot, Game Card and Game redrawn or tightened to the style guide; screen transitions and celebrations. Drawn in code.
- **Sound pass:** every recipe reviewed for consistency and loudness.
- **The family guide:** one page on installing, the recommended device settings, and what to do if there is no sound. Written by an agent.

The owner's review, which is not a PRD:

- The owner plays everything on the iPad Pro, reads the family guide, and lists what should change. That list is the remaining scope of the phase.

**Dependencies.** Phase 2 complete.

**Acceptance criteria**

- Every budget in [overview.md](architecture/overview.md#performance-and-memory) is met on the iPad Pro.
- The automated accessibility checks pass for all eight Games.
- The owner can install the Arcade and set up the tablet using only the family guide.
- The owner's review list has no unresolved item marked as blocking.

**Risks.** Polish has no natural end. The owner's review list is the scope, and anything not on it waits for Phase 4. Art drawn in code has a ceiling; if the result is not good enough, the answer is hand-made art in Phase 4, not more passes here.

**Complete when.** The family would be happy to show it to another family.

## Phase 4: future expansion

**Purpose.** Add Games and features as the family wants them, without reworking what exists.

**Candidates.** Cooperative challenges, racing, picture bingo, mazes, drawing, simple physics arcade Games. A per-Seat handicap. Optional names for Mascots. Background music. Testing on an Android tablet.

This is also where more human involvement becomes welcome: recorded voice and richer recorded sound, hand-made illustration, and play-testing with children as a regular practice.

**How a new Game is added**

1. Add it to [game-catalog.md](product/game-catalog.md) with its Play Styles, Difficulty meanings and Round length.
2. Check it against the contract. If it needs something the contract lacks, decide that first and record it.
3. Write a small PRD for it, slice it, and build it in its own folder.

**Known gaps a future Game may hit**, none of which is built in advance:

| A Game that needs | Would require |
|---|---|
| Dragging or drawing | A drag form of seat input; today only press and release are defined |
| Two fingers from one Player | Revisiting [ADR-0006](adr/0006-touch-attribution-by-turn-or-zone.md) |
| Drawing that persists on screen | A dynamic texture, which is currently banned for leak and suspension reasons |
| Real physics | Phaser's bundled Arcade or Matter physics; no new dependency |
| Zones on all four sides of the tablet | 90° and 270° facings in the Stage |
| Saving a Round in progress | A new capability; today Rounds are never saved |

**Acceptance criteria for any addition.** It passes the per-Game definition of done, it changed no other Game, and any kit or contract change is recorded.

**Complete when.** Never; this phase is the product's ordinary life.
