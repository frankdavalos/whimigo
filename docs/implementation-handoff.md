# Implementation Handoff

For the next Claude Code session. It says where the project stands, what to do first, and how to move from the approved architecture into the ZSL Superpowers workflow.

## Where things stand

- The repository holds documentation only. There is no code, no `package.json` and no commit yet.
- The architecture was **accepted** by the owner on 2026-11-19, with three amendments: there is no voice, all sound is synthesized, and human involvement is kept low through Phase 3 (so art is drawn in code too). The test tablet is a 13-inch iPad Pro (M5).
- No GitHub issues exist. They are created by `/zsl:to-issues`, not by hand.
- ZSL Superpowers 2.3.0 is installed as the `zsl` plugin. `/zsl:setup-zsl-superpowers` has **not** been run in this repository. It is a user-invoked skill, so the owner must type it; an agent cannot start it.
- The remote is `github.com/frankdavalos/whimigo`: private, empty, with Issues enabled.

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

The repository has no commits, so the first one cannot be a pull request. Commit the documentation to `main` and push it. Everything after this goes through pull requests.

### Step 3. Run the ZSL setup

The owner types:

```
/zsl:setup-zsl-superpowers
```

Recommended answers:

| Section | Answer | Why |
|---|---|---|
| A. Issue tracker | GitHub | The remote is GitHub and Issues are enabled |
| B. Triage labels | The defaults | The repository has no labels of its own |
| C. Domain docs | Single-context | One `CONTEXT.md` at the root, ADRs in `docs/adr/` |
| D. Ship style | Pull request | `/zsl:tdd-parallel` works only with pull requests |
| E. Project board | Skip for now | Optional; can be added later without redoing the rest |
| F. Remote agent environment | Skip | Only needed for the overnight loop |

The setup adds an `## Agent skills` section to the existing `CLAUDE.md` and creates `docs/agents/`. It should leave the rest of `CLAUDE.md` alone; check that it did.

Then confirm the labels the skills apply exist in the repository, and create any that are missing:

```
gh label list
```

Needed: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `tracking`, `wontfix`, `backlog`, `enhancement`, `bug`.

### Step 4. Settle the one decision Phase 0 needs

The permanent web address and the static host behind it ([ADR-0013](adr/0013-permanent-origin.md)). It does not block writing the Phase 0 PRD or building its `[AFK]` slices. It blocks the hosting slice and the device run.

### Step 5. Write the Phase 0 PRD

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
- Keep `[HITL]` slices to the two that are unavoidable: connecting the hosting, and running the checklist on the iPad Pro. Everything else, including art and sound, is `[AFK]`.
- No file paths or code in the PRD; the skill's own rule.

### Step 6. Slice it

```
/zsl:to-issues <PRD number>
```

The expected Phase 0 breakdown is under [Phase 0 slices](#phase-0-slices). Use it to judge what the skill proposes, not to override it.

### Step 7. Triage and build

```
/zsl:triage                     for each child issue
/zsl:tdd <issue number>         for slice 1, on its own
/zsl:tdd-parallel <PRD number>  for the wave-2 [AFK] slices, once slice 1 is merged
/zsl:human-itl <PRD number>     for the [HITL] slices
```

### Step 8. Record the gate

After the device run, the owner types `/zsl:grill-with-docs` and works through the eight gate decisions in [roadmap.md](roadmap.md#phase-0-technical-proof-of-concept). Each answer updates an ADR. Only then is the Phase 1 PRD written, by repeating steps 5 to 7 with the Phase 1 section of the roadmap.

## Recommended implementation order

1. **Phase 0, slice 1** (walking skeleton). Serial. Everything else stands on it.
2. **Phase 0, wave 2** (install and offline, the three check screens, hosting). Parallel.
3. **Phase 0 device run and gate.** The owner, with the iPad Pro; about half an hour.
4. **Phase 1, slice 1** (one Tic-Tac-Toe Round end to end). Serial. It creates the contract, the `GameHost` and the kit.
5. **Phase 1, the rest**, in waves as listed below.
6. **Phase 1 device acceptance.**
7. **Phase 2**: Memory Match, then Four in a Row with the search extraction, then the remaining Games in parallel.
8. **Phase 3**: one PRD, followed by the owner's review.

### What must be finished before parallel work is safe

| Before running these in parallel | This must be merged | Because |
|---|---|---|
| Any Phase 0 wave-2 slice | Phase 0 slice 1 | It creates the project, the lint rules, CI, and the list that check screens register in |
| Any Phase 1 wave-2 slice | Phase 1 slice 1 | It creates `contract.ts`, `GameHost`, `openRound` and the kit's folder structure. Two agents inventing these at once will collide |
| Color Echo Cooperative | Color Echo Solo **and** Zones | It needs both |
| The Phase 2 Games after Four in a Row | The search extraction | Dots and Boxes uses it; extracting it later means touching three Games |
| Any two slices that both change `kit/` or `contract.ts` | Agreement that the changes are additive | Same-wave slices are merged in order; a breaking change in one invalidates the others |

A rule for the whole project: within a wave, a slice may **add** to `kit/` and `contract.ts` but may not change or remove what is already there. A change that breaks an existing signature is its own slice, alone in its wave.

## Phase 0 slices

Titles follow the ZSL format. Wording will be refined by `/zsl:to-issues`.

| Slice | Blocked by |
|---|---|
| `[AFK] 1 — Walking skeleton: the Arcade boots to a placeholder Home Screen and passes CI` | None |
| `[AFK] 2a — Install and play offline: manifest, precaching service worker, update at cold start` | 1 |
| `[AFK] 2b — Touch Check screen: show and count simultaneous touches per Zone` | 1 |
| `[AFK] 2c — Performance check screen: frame rate under load, Scene add-and-remove counts, half render scale` | 1 |
| `[AFK] 2d — Sound and suspension check screen, with the recipe synthesizer` | 1 |
| `[HITL] 2e — Connect static hosting at the permanent address, deploying on merge to main` | 1 |
| `[HITL] 3 — Run the Phase 0 device checklist on the iPad Pro and record the results` | 2a to 2e |

`2e` and `3` are genuine manual actions: creating a hosting project and pointing a hostname at it, and handling the physical tablet. The gate decisions themselves are not a slice; they are made in step 8.

### The first three GitHub issues

To be created by `/zsl:to-issues` after approval, not by hand and not before.

**1. `[AFK] 1 — Walking skeleton: the Arcade boots to a placeholder Home Screen and passes CI`**

What to build: the smallest running Arcade. A hand-made Vite and TypeScript project with `phaser` pinned at exactly 4.2.1. One `Phaser.Game` at the 2752 × 2064 design frame in `EXPAND` mode with ten touch slots and window events off. The page-level touch hygiene from the overview. A "tap to start" screen that unlocks sound and leads to a placeholder Home Screen. The DOM error screen with a reload button. The test bridge behind `?e2e=1`. A list that check screens can register in. Lint rules for the import boundaries. Vitest, Playwright and a CI workflow.

Acceptance:
- `npm run check` passes: type-check, lint, and at least one unit test.
- `npm run e2e` passes: the page loads, a tap on "tap to start" leads to the Home Screen, and the bridge reports it.
- At 4:3, 16:10 and 16:9 viewports the design frame is fully visible.
- An exception thrown on purpose shows the error screen, and its button returns to the Home Screen.
- A file in `games/` that imports Phaser from `logic/`, or imports another Game, fails lint.
- The project makes no network request to any third party in `dev` or `build`.

**2. `[AFK] 2a — Install and play offline: manifest, precaching service worker, update at cold start`**

What to build: `vite-plugin-pwa` in prompt mode. A manifest with `display: fullscreen`, `orientation: landscape`, icons and an `apple-touch-icon`. Precaching of every built file, with the Workbox defaults for file types and the 2 MiB limit overridden. A check for a new version when the page becomes visible. A minimal "ready to play offline" and "update available" indication for an adult.

Acceptance:
- After one load, with the network off, a reload reaches the Home Screen.
- Every file the build emits is in the precache list.
- With a newer build served while the page is open, the page keeps running its own version; after a reload it runs the new one.
- The manifest passes Chrome's installability check.

**3. `[AFK] 2b — Touch Check screen: show and count simultaneous touches per Zone`**

What to build: a screen that draws a marker under every live touch with its slot number, shows the current and highest simultaneous counts and the number of cancelled touches, and shows the four **Zones** for either **Seating** with a tap counter in each. This is where the first, minimal form of Zone geometry and touch attribution is written, as pure functions with unit tests.

Acceptance:
- Four touches sent in one event to four Zones raise each Zone's counter by one.
- A second touch in an occupied Zone is not counted.
- A touch that slides into another Zone stays with its first Zone.
- A cancelled touch raises the cancellation count and no tap counter.
- An eleventh touch is ignored and the screen keeps working.
- The highest count shown matches the number of touches sent.

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

Wave 2 has five slices that all add to `kit/`. If merges become painful, split it into two waves.

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
