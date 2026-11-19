# Implementation Handoff

For the next Claude Code session. It says where the project stands, what to do first, and how to move from the approved architecture into the ZSL Superpowers workflow.

## Where things stand

- The repository holds documentation only. There is no code and no `package.json`.
- The architecture was **accepted** by the owner on 2026-11-19, with three amendments: there is no voice, all sound is synthesized, and human involvement is kept low through Phase 3 (so art is drawn in code too). The test tablet is a 13-inch iPad Pro (M5).
- The Phase 0 PRD and its slices are on GitHub: PRD [#1](https://github.com/frankdavalos/whimigo/issues/1), labelled `tracking`, with eight sub-issues, [#2](https://github.com/frankdavalos/whimigo/issues/2) to [#9](https://github.com/frankdavalos/whimigo/issues/9). They are listed under [Phase 0 slices](#phase-0-slices). The issues, not this document, are the specification.
- ZSL Superpowers 2.3.0 is installed as the `zsl` plugin and set up for this repository: GitHub Issues, default labels, single-context docs, **direct push to `main`**.
- The remote is `github.com/frankdavalos/whimigo`, with Issues enabled. It is public, because GitHub Pages on the free plan needs a public repository.
- Hosting is GitHub Pages at the default address, `https://frankdavalos.github.io/whimigo/`. The owner confirmed on 2026-11-19 that the iPad's web filter allows that address. The same day the owner confirmed that the page installs to the Home Screen and opens as an app, that Guided Access can be switched on, and that four fingers pressed at once all register.

## Read these first

In this order. Together they are about fifteen minutes of reading.

1. [CONTEXT.md](../CONTEXT.md): the words. Use them exactly, in code, tests and issue titles.
2. [architecture/overview.md](architecture/overview.md): the decisions and why.
3. [architecture/game-contract.md](architecture/game-contract.md): the interfaces and the rules for Game code.
4. [roadmap.md](roadmap.md): the phase you are working on.
5. [testing-strategy.md](testing-strategy.md): what "done" means.
6. The [ADRs](adr/) that touch what you are about to change.

## Three things an agent will get wrong without being told

- **This is Phaser 4, not Phaser 3.** Much of what a model remembers about Phaser is version 3. Check the installed type definitions (`node_modules/phaser/types/phaser.d.ts`) and the [v4 migration guide](https://github.com/phaserjs/phaser/blob/v4.2.1/changelog/v4/4.0/MIGRATION-GUIDE.md) before using an API. The `skills/` folder in the Phaser repository is a useful summary but has known errors.
- **Several ordinary Phaser habits are banned here on purpose**: a parallel UI Scene over a Game, `Text` objects, `RenderTexture`, camera-zoom scaling, `setTimeout`, `Math.random()`, HTML over the canvas. Each has an ADR. Do not "fix" them.
- **Nothing comes from outside the repository.** No audio files, no recorded or synthesized speech, no downloaded art or asset packs. Art is SVG written here; sound is a recipe written here; how to play is shown by a wordless **Demo**. Do not create slices that wait on a person to record, draw or choose assets.

## From approval to the first issue

### Step 1. Approve the architecture

Done on 2026-11-19. The ADRs and the overview are marked accepted.

### Step 2. Make the first commit

Done on 2026-11-19. The documentation is on `main` and pushed. From here on, changes are pushed straight to `main` by the agent that made them, once the checks pass.

### Step 3. Run the ZSL setup

Done on 2026-11-19. The owner's answers:

| Section | Answer | Note |
|---|---|---|
| A. Issue tracker | GitHub Issues | |
| B. Triage labels | The default names | The five missing labels and `backlog` were created |
| C. Domain docs | Single-context | |
| D. Ship style | **Direct push to `main`** | Agents push without asking, but only when `npm run check` and `npm run e2e` pass |
| E. Project board | Skipped | Can be added later |
| F. Remote agent environment | Skipped | The overnight loop needs pull requests |

The result is the `## Agent skills` section of `CLAUDE.md` and the four files in [docs/agents/](agents/). Read [docs/agents/ship-style.md](agents/ship-style.md) before shipping anything.

Direct push rules out `/zsl:tdd-parallel` and the overnight loop, which work only with pull requests. Slices are built one at a time with `/zsl:tdd`.

### Step 4. Check the iPad before building anything

Hosting is settled: GitHub Pages at its default address ([ADR-0013](adr/0013-github-pages-default-address.md)). What is not known is whether the iPad will cooperate. Its web filter is not under the owner's control, and it may be a managed device. A placeholder page is published at the address from a `gh-pages` branch, so the owner can check three things, which take five minutes:

1. Open `https://frankdavalos.github.io/whimigo/` in Safari. Does it load, or does the filter block it? **Done on 2026-11-19: it loads.**
2. Add it to the Home Screen. Is that allowed? **Done: it installs and opens as an app.**
3. Open Settings, Multitasking & Gestures, and Settings, Accessibility, Guided Access. Can they be changed? **Done for Guided Access: it can be switched on. The Multitasking & Gestures toggles are not yet confirmed.**

The placeholder also has four coloured Zones with tap counters and shows the number of touches now, the most at once, and how many were cancelled. Putting four fingers on it gives an early, rough answer to the four-finger question (gate G1) before Phase 0 is built. It is throwaway: the deploy slice (`2b`, [#4](https://github.com/frankdavalos/whimigo/issues/4)) switches Pages to the workflow and deletes the `gh-pages` branch.

An early result on gate G1: four fingers pressed at once on the placeholder all registered. That is encouraging and not conclusive. It does not cover 30 seconds of sustained tapping, fingers that slide, or whether any touches were cancelled, and those are what the Phase 0 Touch Check measures.

If 1 fails, stop: hosting has to be rethought before any code is written. If 2 or 3 fails, carry on, and record it; the Arcade then runs in a Safari tab, or Simultaneous play is capped at three Seats.

### Step 5. Write the Phase 0 PRD

Done on 2026-11-19: [#1](https://github.com/frankdavalos/whimigo/issues/1). The notes below are kept for writing the Phase 1 PRD the same way.

`/zsl:to-prd` packages what is already in the conversation and does not interview anyone. Start a fresh session and load the material first, so the PRD is built from these documents and not from guesses:

```
Read CONTEXT.md, docs/architecture/overview.md, docs/architecture/game-contract.md,
docs/testing-strategy.md, and the Phase 0 section of docs/roadmap.md.
We are writing the PRD for Phase 0 only. Then run /zsl:to-prd.
```

Things to hold `/zsl:to-prd` to:

- Every user story needs at least one automatable `AC<n>:`. Write them against what the tests can observe: a rule's outcome, a value from the test bridge, a saved value. See [testing-strategy.md](testing-strategy.md#acceptance-criteria-and-zsl).
- The actors are a **Player**, a grown-up, and a developer adding a Game.
- The device checklist is not a user story. It becomes a `[HITL]` slice in the next step.
- Keep `[HITL]` slices to the one that is unavoidable: running the checklist on the iPad Pro. Everything else, including art and sound, is `[AFK]`.
- No file paths or code in the PRD; the skill's own rule.

### Step 6. Slice it

```
/zsl:to-issues <PRD number>
```

Done on 2026-11-19: eight slices, [#2](https://github.com/frankdavalos/whimigo/issues/2) to [#9](https://github.com/frankdavalos/whimigo/issues/9), listed under [Phase 0 slices](#phase-0-slices). The skill split the asset build out of the Performance check into a slice of its own, which the earlier seven-slice plan did not have.

### Step 7. Triage and build

```
/zsl:triage                     for each child issue
/zsl:tdd <issue number>         for each [AFK] slice, one at a time, in wave order
/zsl:human-itl <PRD number>     for the [HITL] slices
/zsl:verify-coverage <PRD number>   once the slices have shipped
```

### Step 8. Record the gate

After the device run, the owner types `/zsl:grill-with-docs` and works through the eight gate decisions in [roadmap.md](roadmap.md#phase-0-technical-proof-of-concept). Each answer updates an ADR. Only then is the Phase 1 PRD written, by repeating steps 5 to 7 with the Phase 1 section of the roadmap.

## Recommended implementation order

1. **Phase 0, slice 1** (walking skeleton, #2). Everything else stands on it.
2. **Phase 0, wave 2** (the asset build #3, the deploy workflow #4). In either order, one at a time.
3. **Phase 0, wave 3** (install and offline #5, and the three check screens #6 to #8). In any order, one at a time, once the asset build is on `main`.
4. **Phase 0 device run (#9) and gate.** The owner, with the iPad Pro; about half an hour.
5. **Phase 1, slice 1** (one Tic-Tac-Toe Round end to end). It creates the contract, the `GameHost` and the kit.
6. **Phase 1, the rest**, in waves as listed below.
7. **Phase 1 device acceptance.**
8. **Phase 2**: Memory Match, then Four in a Row with the search extraction, then the remaining Games in any order.
9. **Phase 3**: one PRD, followed by the owner's review.

### What must be finished first

Slices are built one at a time and pushed to `main`. A slice's wave number says what it depends on; slices in the same wave can be built in any order. Do not run two agents in the same checkout at once: with direct push there is no merge step to catch a collision.

| Before building | This must be on `main` | Because |
|---|---|---|
| Any other Phase 0 slice | Phase 0 slice 1 (#2) | It creates the project, the lint rules, CI, the test bridge, and the list that check screens register in |
| Install and offline, or any check screen (#5 to #8) | The asset build (#3) | They need the icons, the bitmap digits and the Arcade's atlas |
| Any Phase 1 wave-2 slice | Phase 1 slice 1 | It creates `contract.ts`, `GameHost`, `openRound` and the kit's folder structure. Two agents inventing these at once will collide |
| Color Echo Cooperative | Color Echo Solo **and** Zones | It needs both |
| The Phase 2 Games after Four in a Row | The search extraction | Dots and Boxes uses it; extracting it later means touching three Games |

A rule for the whole project: a slice may **add** to `kit/` and `contract.ts` freely, but a change that breaks an existing signature is its own slice, with every Game it affects updated in the same push.

## Phase 0 slices

The PRD is [#1](https://github.com/frankdavalos/whimigo/issues/1). Its eight sub-issues are the plan; read each one with `gh issue view <n> --comments` before building it.

| Issue | Slice | Blocked by |
|---|---|---|
| [#2](https://github.com/frankdavalos/whimigo/issues/2) | `[AFK] 1 — Walking skeleton: the Arcade boots to a placeholder Home Screen and passes CI` | None |
| [#3](https://github.com/frankdavalos/whimigo/issues/3) | `[AFK] 2a — Asset build: SVG art, bitmap digits and app icons packed into atlases` | #2 |
| [#4](https://github.com/frankdavalos/whimigo/issues/4) | `[AFK] 2b — Deploy to GitHub Pages on every push to main` | #2 |
| [#5](https://github.com/frankdavalos/whimigo/issues/5) | `[AFK] 3a — Install and play offline: manifest, precaching service worker, update at cold start` | #3 |
| [#6](https://github.com/frankdavalos/whimigo/issues/6) | `[AFK] 3b — Touch Check screen: show and count simultaneous touches per Zone` | #3 |
| [#7](https://github.com/frankdavalos/whimigo/issues/7) | `[AFK] 3c — Performance check screen: frame time under load, Scene add-and-remove, half render scale` | #3 |
| [#8](https://github.com/frankdavalos/whimigo/issues/8) | `[AFK] 3d — Sound and suspension check screen, with the recipe synthesizer` | #3 |
| [#9](https://github.com/frankdavalos/whimigo/issues/9) | `[HITL] 4 — Run the Phase 0 device checklist on the iPad Pro and record the results` | #4 to #8 |

Build them one at a time with `/zsl:tdd`, in wave order: #2; then #3 and #4 in either order; then #5 to #8 in any order. A slice starts only when its blockers are closed.

`#9` is the only genuine manual action: handling the physical tablet. `#4` is not: an agent writes the deploy workflow and switches Pages on through the GitHub CLI, and there is no DNS to configure. The gate decisions themselves are not a slice; they are made in step 8.

Three acceptance criteria are open questions rather than certainties: 50 Scene add-and-remove cycles leaving the counts unchanged (#7, gate G6), half render scale matching targets and taps (#7, gate G8), and Phaser playing a ready-made sound buffer (#8). If Phaser 4.2.1 cannot meet one, the slice records the finding on its issue, takes the documented fallback, and revises the criterion and the affected ADR in the same push. The walking skeleton (#2) also records what Phaser does when an exception is thrown inside its frame loop.

## Phase 1 slices

For orientation. The Phase 1 PRD is written after the Phase 0 gate and may differ.

| Slice | Blocked by |
|---|---|
| `[AFK] 1 — Play a two-Player Round of Tic-Tac-Toe from the Home Screen to a Result and back` | Phase 0 |
| `[AFK] 2a — Pause and leave a Round: hold-to-pause, pause on app hidden, exit` | 1 |
| `[AFK] 2b — Lobby: Mascots join Seats, choose Difficulty, choices remembered; style guide and first Mascots` | 1 |
| `[AFK] 2c — Progress: Stars saved per Mascot and shown` | 1 |
| `[AFK] 2d — Color Echo, Solo: synthesized tones, Demo, motion presets` | 1 |
| `[AFK] 2e — Zones and Seating, with Reaction Rush for two to four Seats` | 1 |
| `[AFK] 3a — Tic-Tac-Toe Versus Computer at three Difficulties` | 2b |
| `[AFK] 3b — Color Echo, Turn-Based` | 2b, 2d |
| `[AFK] 3c — Color Echo, Cooperative` | 2d, 2e |
| `[AFK] 3d — Grown-Ups Area: gate, settings, update, reset, Touch Check` | 2c |
| `[AFK] 4 — Hardening: storage failures, load failures, leak test across three Games` | 3a to 3d |
| `[HITL] 5 — Device acceptance on the iPad Pro, and the owner's review` | 4 |

Wave 2 has five slices that all add to `kit/`. Built one at a time, each starts from what the last one pushed.

## Risks to settle before substantial implementation

These are the Phase 0 gate decisions. Nothing in Phase 1 should start until they have answers.

| Risk | Checked by | If it goes badly |
|---|---|---|
| iPadOS cancels touches when it sees four fingers | Touch Check, checklist items 5 to 8 | Simultaneous play capped at three Seats on iPadOS |
| Work per frame on the iPad Pro leaves too little margin | Performance check | Find the cost before Phase 1 |
| Art for the 2752 × 2064 frame does not fit one atlas page, or looks soft | Performance check, checklist item 15 | Two atlas pages per Game; fix the rasterising scale |
| Phaser will not play a sound rendered from a recipe | Sound check screen, in CI | `platform/audio` plays the buffers itself |
| Half render scale does not draw or take touches correctly | Automated test in the performance-check slice | No lighter mode; slower tablets get the full frame |
| Sound does not return after backgrounding | Sound check, items 16 to 20 | Reload at the Home Screen when sound is dead |
| The status bar covers the top of the screen | Checklist items 12 and 14 | Larger margin, or no drawing under the status bar |
| Scenes and packs do not unload cleanly | Performance check, automated loop | Keep assets loaded; revisit memory budget |
| A Phaser 4.2.1 defect appears on the iPad Pro | All three check screens | Patch or work around before Phase 1 |

Two things Phase 0 cannot settle:

- **Android.** There is no Android tablet to test, and the owner has said Android matters little in practice. The Arcade should run on one and is checked in Chromium, but the design frame is sized for the iPad Pro, so expect it to be heavy there.
- **Whether art drawn in code is good enough.** That is judged by the owner looking at Phase 1. The style guide written in the lobby slice is the main defence.
