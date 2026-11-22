# Implementation Handoff

For the next Claude Code session. It says where the project stands, what to do first, and how to move from the approved architecture into the ZSL Superpowers workflow.

## Where things stand

- The walking skeleton (issue #2) is built: a hand-made Vite, TypeScript and Phaser 4.2.1 project that boots to a placeholder Home Screen, with the test bridge, lint boundaries, Vitest, Playwright and CI. `npm run check` and `npm run e2e` exist. There are no Games yet.
- The asset build (issue #3) is built. A Vite plugin runs `scripts/assets/build-assets.ts` before the development server and the production build: it rasterises each set's SVG sources with `sharp` and packs them, with a packer written in `scripts/assets/atlas.ts`, into one atlas page per set (at most 4096 × 4096), and rasterises the app icons from `src/arcade/app-icon.svg`. Atlases go to `src/generated/atlases/` and icons to `public/icons/`, both ignored by git. The Arcade's own set is `src/arcade/art/`; the stand-in Game-sized set is `src/arcade/checks/standin-art/` and packs into one 2048 × 3774 page. The digits 0 to 9 are a bitmap font made from the Arcade's atlas, drawn with the kit's `drawNumber`.
- The Touch Check (issue #6) is built and listed on the placeholder Home Screen for everyone; it moves into the Grown-Ups Area when that is built. It marks every live touch with its slot number, shows the touches down now, the most at once and the touches the system took away, and counts taps in four Zones for either Seating. Its rules are pure and tested in Node: Zone geometry (`zonesFor`, `toZoneLocal`) and touch attribution (`attributeTouch`) are in `src/kit/`, and the screen's own readings in `src/arcade/checks/touch-readings.ts`. Its controls stand in a column at the left of the safe rectangle and its readings in a column at the right; the Zones fill the space between, 64 units clear of both. When the page is shown again after being hidden, `src/platform/lifecycle.ts` and the kit's `resetTouches` forget every touch that was down, so a stale touch cannot keep a slot or a Seat.
- The Sound check (issue #8) is built and listed on the placeholder Home Screen for everyone. Sound recipes (`SoundRecipe` and `Note` in `src/contract.ts`) are validated and rendered by pure code in `src/platform/synth.ts`, tested in Node: a note's pitch is 20 to 20000 Hz, its gain 0 to 1, and no sound lasts more than 3000 ms; noise is seeded, so renders repeat exactly. `src/platform/audio.ts` renders each recipe once into an `AudioBuffer` on Phaser's own audio context, puts it in `game.cache.audio` and plays it through Phaser's Web Audio sound manager, which Phaser 4.2.1 accepts (settled 2026-11-19; the snapshot reports the route as `phaser-sound-manager`). Unless sound is running, a request returns false at once and plays nothing. While the page is hidden the service suspends the context and sets the sound manager's `gameLostFocus`, which stops Phaser resuming it on every frame. When the page returns, Phaser's own `onGameVisible` (100 ms after the page is shown) and window focus may resume it without a tap, so in headless Chromium it is running again before any tap; on the tablet, any tap anywhere resumes it inside the gesture. The screen has one control for each of its seven sounds (`src/arcade/checks/sound-check-sounds.ts`), shows the audio state as a picture, and keeps a log of state changes and hidden and visible events, capped at 50 entries and held in memory only.
- The Performance check (issue #7) is built and listed on the placeholder Home Screen for everyone. Its standard load is 200 sprites of the stand-in set's token-sized frames, held as one texture (`performance-check/load`); each sprite's position is a pure function of elapsed time (`src/arcade/checks/standard-load.ts`). Work per frame is timed in the page from the game's `prestep` event to its `postrender` event, and both it and the frame rate are averaged over a rolling window of at least a second (`frame-meter.ts`) and drawn in bitmap digits, which now include a decimal point. A sharpness card of one-unit line pairs, grids and checks (`src/arcade/art/sharpness.svg`) and two rows of digits are drawn unscaled at whole units, for checklist item 15. One control runs the gate G6 loop (`scene-cycles.ts`): it adds a `standin` Scene that loads the stand-in pack (texture `standin`), accepts no input and sits below the check, then removes the Scene and the pack's textures, 50 times; leaving mid-loop stops it and removes whatever is loaded. 50 cycles leave `counts()` unchanged (settled 2026-11-19). The render scale (`src/kit/render-scale.ts`) is 0.5 only when the address has both `e2e=1` and `scale=0.5`; `tests/e2e/render-scale.spec.ts` shows every target of every screen in the same place at both scales and every press doing the same (gate G8, settled 2026-11-19).
- Every push to `main` is published to GitHub Pages (issue #4). The CI workflow runs `npm run check` and `npm run e2e`, publishes the very build the browser tests ran against, then fetches `build.json` from the published address and fails unless it names the commit just pushed. Pages publishes from that workflow; the throwaway `gh-pages` branch is gone.
- The Arcade installs and plays offline (issue #5, ADR-0008). `vite-plugin-pwa` 2.0.0 (a development dependency, pinned exactly) writes the manifest (`display: fullscreen`, `orientation: landscape`, the 192 and 512 icons, start address and scope `/whimigo/`) and a Workbox service worker, `sw.js`, that precaches every file the build emits; `scripts/precache.ts` holds the 60 MB budget. `src/platform/updates.ts` registers the worker itself, in prompt mode: a new version waits, and at a cold start, before the tap-to-start screen, a waiting version is activated and the page reloads once (a marker in the tab's session stops a second reload); each time the page becomes visible again it asks for an update check. The bridge reports `offlineReady()` and `updateWaiting()`. The adult status page, the seed of the Grown-Ups Area, is HTML in `index.html` filled by `src/arcade/grown-ups.ts`, opened by a tap control in the Home Screen's bottom-right corner with no Grown-Up Gate yet; its Scene has nothing to touch. The Home Screen's snapshot lists its check screens in `state.checks`, and tests visit check screens from that list. The update tests deploy a second build, made by Playwright's global setup, under a running page from a server of their own.
- The architecture was **accepted** by the owner on 2026-11-19, with three amendments: there is no voice, all sound is synthesized, and human involvement is kept low through Phase 3 (so art is drawn in code too). The test tablet is a 13-inch iPad Pro (M5).
- The Phase 0 PRD and its slices are on GitHub: PRD [#1](https://github.com/frankdavalos/whimigo/issues/1), labelled `tracking`, with eight sub-issues, [#2](https://github.com/frankdavalos/whimigo/issues/2) to [#9](https://github.com/frankdavalos/whimigo/issues/9). They are listed under [Phase 0 slices](#phase-0-slices). The issues, not this document, are the specification.
- ZSL Superpowers 2.3.0 is installed as the `zsl` plugin and set up for this repository: GitHub Issues, default labels, single-context docs, **direct push to `main`**.
- The remote is `github.com/frankdavalos/whimigo`, with Issues enabled. It is public, because GitHub Pages on the free plan needs a public repository.
- Hosting is GitHub Pages at the default address, `https://frankdavalos.github.io/whimigo/`, which now serves the Arcade. The owner confirmed on 2026-11-19, using the placeholder page published there before the Arcade existed, that the iPad's web filter allows that address. The same day the owner confirmed that the page installs to the Home Screen and opens as an app, that Guided Access can be switched on, and that four fingers pressed at once all register.

- **Phase 0 is complete (2026-11-20).** The owner ran the device checklist on the iPad Pro, iPadOS 27.2 ([record](device-runs/2026-11-20-ipad-pro.md)), and answered gates G1 to G8 the same day with `/zsl:grill-with-docs`: every answer is yes. Four Seats play Simultaneously on iPadOS; 60 frames per second is accepted, with the 3 ms work-per-frame budget kept; one atlas page per Game; resume-on-tap for sound, with no reload fallback; the 88-unit margin stays; per-Game unloading stays; Phaser 4.2.1 is dependable, with the portrait sizing workaround (`e14e3f5`) to recheck on any upgrade; the lighter render mode stays switched off. The answers, and where each is recorded, are under [Gate results](roadmap.md#gate-results) in the roadmap.
- **Phase 0's issues are all closed.** The owner cleared the device-run slice [#9](https://github.com/frankdavalos/whimigo/issues/9) with `/zsl:human-itl` and closed the PRD [#1](https://github.com/frankdavalos/whimigo/issues/1) on 2026-11-20. The coverage gap [#10](https://github.com/frankdavalos/whimigo/issues/10) (each Zone drawn in its Seat's colour) is closed too.
- **The Phase 1 PRD is written and sliced.** PRD [#11](https://github.com/frankdavalos/whimigo/issues/11), labelled `tracking`, has twelve sub-issues, [#12](https://github.com/frankdavalos/whimigo/issues/12) to [#23](https://github.com/frankdavalos/whimigo/issues/23), listed under [Phase 1 slices](#phase-1-slices); every acceptance criterion in the PRD is in exactly one of them. When it was sliced on 2026-11-20 the owner accepted the PRD's "gaps" as written, settled the typeface (none is bundled: canvas glyphs are drawn in the repository and the Grown-Ups Area uses the device's typeface; [ADR-0005](adr/0005-pictures-in-canvas-words-in-dom.md), [overview](architecture/overview.md#visual-system)), and added the dependencies the PRD's first slice table lacked, so wave 2 is no longer flat. The atlas key rule the PRD carried from #7 was settled the same day: a Game's atlas is the texture named by its bare id, and every other key starts with `${id}/` ([game contract](architecture/game-contract.md#asset-keys), [ADR-0011](adr/0011-svg-sources-atlas-per-game.md)); the stand-in pack's texture is now `standin`.
- **The Phase 1 slices are triaged (2026-11-20).** Each of [#12](https://github.com/frankdavalos/whimigo/issues/12) to [#23](https://github.com/frankdavalos/whimigo/issues/23) is labelled `enhancement` and carries an agent brief as its first comment; #12 to #22 are `ready-for-agent` and #23 is `ready-for-human`. Triage moved story 23 AC3 and AC4 (the storage state, the request for persistent storage and play from memory when storage is missing or throws) from Hardening ([#22](https://github.com/frankdavalos/whimigo/issues/22)) to the Grown-Ups Area ([#21](https://github.com/frankdavalos/whimigo/issues/21)), because #21's status line reports that state and #22 comes after it; the PRD's slice table says so.
- **Phase 1 slice 1 is built (#12, 2026-11-20).** Tic-Tac-Toe is the first Game: the Home Screen shows its Game Card, a first lobby seats Mascots in Seat order, and a Turn-Based Round plays to a Result screen with replay and home. What it created, and where later slices add to it:
  - The contract types are in `src/contract.ts`. A Game's pack has its own small type, `GamePack`, because Phaser's demands loader internals; colours are theme numbers. `RoundStart` and `Round` carry the Round's `number` in the Session, and `TurnRules.start` takes the Seat that moves `first`.
  - `GameHost` (`src/arcade/game-host.ts`) is a pure state machine (`host-state.ts`) plus Scene handling. The loading and Result screens are Arcade screens, and the Result screen runs over the Game's paused Scene. `openRound` is in `src/kit/round.ts`.
  - The kit gained the seeded `createRng`, `TurnRules` with `checkTurnRules`, a pure `TurnGate` with its Scene wiring, and the Turn pointer.
  - The lobby's rules are in `src/arcade/lobby/rules.ts`. The eight Mascot ids in `src/arcade/mascots.ts` are permanent; they were redrawn to the style guide in slice 4a.
  - Conformance checks are in `src/arcade/conformance.ts`. Manifests are checked in Node (`tests/conformance.test.ts`) and modules in the browser (`games.spec.ts`).
  - The asset build finds each Game's `art/` folder and `card.svg` by itself.
  - The check screens moved from the Home Screen to buttons on the status page.
  - Browser tests over the Catalog play each Game with `tests/e2e/play.ts`, which says which target to tap next. Every new Game adds a line there.
- **Phase 1 slice 2 is built (#13, 2026-11-20).** A Round pauses on a deliberate hold, and whenever the page is hidden or turned upright.
  - `openRound` mounts the pause control, a kit hold control named `pause` among the Round's targets, halfway down the safe rectangle's left edge. `RoundHost` gained `pause()`; `GameHost` gained `pause`, `resume` and the `paused` state. A Round that ends in the frame its pause began still reaches its Result. While paused, no Game sound is requested.
  - The pause screen (`src/arcade/pause-screen.ts`) runs over the Game's paused Scene, like the Result screen. Its targets are `home`, `play` and `demo`; the Demo target does nothing until slice 3b (#15) makes it play.
  - A Scene that resumes forgets its touches (`onTouchesReset` in `src/kit/touches.ts`), because it heard no finger lift while paused.
  - There was no rotate picture before this slice. It is the `rotate` Scene (`src/arcade/rotate-screen.ts`). When the canvas is taller than wide, the Arcade pauses every running Scene beneath it and holds every screen change until the screen is back on its side. The `e14e3f5` workaround is untouched. The layout tests' "narrow window" is now 1100 × 1000, which is still narrower than the design frame but no longer upright.
  - The bridge's `round()` reports the Round's Scene clock as `time` and its `zones`, which stay empty until slice 4b (#17). The pause control's placement test (`tests/e2e/pause.spec.ts`) iterates them.
- **Phase 1 slice 2c is built (#14, 2026-11-20).** A Mascot collects Stars for playing, and the Arcade keeps them.
  - The Star rule is `starsEarned(result, session)` in `src/arcade/progress.ts`, pure and tested in Node; `recordRound` adds a Round's Stars into the save document and counts the Round against its Game.
  - `SaveStore` (`src/platform/save-store.ts`) keeps one JSON document, version 1, under `whimigo:save`: `mascots` (Stars per Mascot) and `games` (Rounds played per Game). Settings and remembered choices join it in later slices. `createSaveStore` takes anything with `getItem` and `setItem`, and is tested against an in-memory store. It does not yet handle a corrupt, newer, missing or throwing store: that is slice 6 (#22).
  - `GameHost` awards and writes Stars synchronously when a Round finishes, once per Round, and hands them to the Result screen. Its snapshot gains `stars` for the celebrated Mascots. Leaving from the pause screen earns nothing.
  - The lobby draws each Mascot's Stars beneath it with `drawStarCount` (`src/arcade/star-count.ts`), the new `arcade/star` picture and the bitmap digits. Its snapshot reports each count as the digits drew it.
  - The test bridge gains `save()`, and `finish(result)`, which reports a Result to the open Round's host exactly as its Game would, so a test can report a second one.
- **Phase 1 slice 3b is built (#15, 2026-11-20).** Color Echo is the second Game, Solo only, and every Game now has a Demo, motion presets and the touch-feedback rules.
  - Color Echo's rules are pure in `src/games/color-echo/logic/rules.ts`: three pads on Easy and four on Medium and Hard; a sequence of the longest length (12) drawn from `round.rng` at the start; a first sequence of 1, 2 or 3 steps by Difficulty; a gap between steps of 1000 ms on Easy and 750 ms on Medium, and on Hard 600 ms shrinking 30 ms a step to a least gap of 350 ms; where the playing has reached as a function of elapsed Round time alone (`playingAt`); and the Solo Result scoring the sequences completed. Its pads (colour, shape, tone) are in `pads.ts`, its tones in `sounds.ts`, and its art is SVG in its own folder.
  - `openRound` is complete. `Round` gained `motion`, `demo(steps)`, and two additions agreed when the slice was planned: `now()`, the Round's own time, which stands still while paused and while the Demo plays (Phaser's `scene.time.now` jumps forward after a pause), and `refuse(target)`, a gentle wiggle with no sound that the bridge counts. `RoundHost.opened` takes a `RoundView` (snapshot, Demo report, refusals, show-the-Demo), and `RoundHost` gained `reducedMotion()`.
  - The Demo player is `src/kit/demo.ts`: a hand from the Arcade's atlas (`arcade/hand`) over an invisible cover that holds the Game's input; a touch skips it, and the cover stays until every finger that touched it lifts. The pause screen's Demo target resumes the Round and plays the Demo again. Tic-Tac-Toe has a Demo and refuses a taken cell.
  - The motion presets are data in `src/kit/motion-presets.ts`, played by `src/kit/motion.ts` one tween at a time. A Phaser `TweenChain`'s completion callback never fired in 4.2.1 here, so chains are not used. `src/platform/reduced-motion.ts` reads the device's request.
  - The Arcade's shared sounds are `tap`, `wrong` and `win` (`src/arcade/sounds.ts`), loaded at boot. There is no refusal sound: an ignored touch is silent. `tests/sounds.test.ts` checks every recipe of the Arcade and of every Game.
  - The bridge's `round()` reports `demo`, `refusals` and `motion`. Browser tests open a Session with `openSession` in `tests/e2e/play.ts`, which skips the Demo with a tap; `NEXT_TAP` may return null to wait for a Game that moves on by itself. The ignored- and accepted-touch tables are in `tests/e2e/feedback.spec.ts`, and a Game added to the Catalog without a case in each fails them.
  - Round time adds up Phaser's frame deltas, so in the software-rendered test browser it runs at about a third of wall time; waits on Color Echo allow for that.
- **Phase 1 slice 4a is built (#16, 2026-11-20).** The lobby is the real thing, and the Arcade has its look.
  - The [style guide](design/style-guide.md) is written. The palette in `src/kit/theme.ts` is its source of truth, and `tests/palette.test.ts` fails on any colour outside it in any SVG of the Arcade or of any Game (the stand-in check art excepted). The eight Mascots were redrawn to it; the Game Cards, controls, check icons and Color Echo's pads were recoloured to it; Play Style and Difficulty pictures are new and the Seating pictures show Seat shapes.
  - The final Seat colours are blue, yellow, red and aqua, with circle, square, triangle and star. `src/kit/theme.test.ts` holds them more than 20 apart in CIEDE2000 with ordinary vision and under simulated protanopia, deuteranopia and tritanopia (`src/kit/color-difference.ts`, Machado 2009); the least today is about 29.
  - The lobby's rules are pure: `lobbyView` in `src/arcade/lobby/rules.ts` turns the choices made into what is offered and the Session start would begin (null when start is unavailable); `tapMascot` joins, frees a Seat (the rest close up) or refuses a fifth. `src/arcade/lobby/memory.ts` reads and writes the save document: `openLobby`, `startSession` and `rememberSeating`.
  - The contract changed: `usesDifficulty` moved from the manifest to each `PlayStyleOption`. Tic-Tac-Toe for two Players does not use it; the Session then carries Easy.
  - The save document stays version 1 with two optional additions: `games[id].choices` (the last Play Style, Difficulty and Mascots in Seat order, written when a Session starts) and `seating` (written when a Seating is tapped, so the default by Player count holds until someone chooses one).
  - The kit's controls are `button`, `iconButton`, `holdButton`, `panel`, `seatBadge` (`src/kit/controls.ts`) and `turnPointer`; `tapButton` and `drawTurnPointer` are gone. An icon larger than 240 units is drawn smaller, to fit the 344-unit face.
  - The layout test now visits every Game's lobby with 0 to 4 Players, the pause and Result screens, and every Game in each Play Style, Seat count and Seating (`EVERY_ROUND` in `tests/e2e/layout.spec.ts`). It found Tic-Tac-Toe's cells touching: each cell now takes touches on 320 of its 384 units, and the Turn pointer is the size of a Seat shape (256).
  - The lobby's browser tests are in `tests/e2e/lobby.spec.ts`; those over the Catalog fire for a several-Play-Style lobby once #19 or #20 adds one.
- **Phase 1 slice 4b is built (#17, 2026-11-21).** Zones and Seating, and Reaction Rush, the third Game, for two to four Seats.
  - A Session carries `zoned`, from its Play Style. A zoned Round's Stage has `zones`, laid out by `roundZones` (`src/kit/zones.ts`): the documented Zones of the safe rectangle less the pause control's strip down its left edge (344 + 64 units), which settles the question the Game contract left open. `zoneContainer(seat)` is placed and turned by `zonePlacement`.
  - `round.seatZones` is the Round's SeatZones. Its rules are pure in `src/kit/seat-zones.ts` (one touch per Seat, the Zone where it began, `setEnabled`, cancel, reset). `openRound` hears it through an invisible rectangle over each Zone beneath everything the Game draws, so the Demo's cover blocks it; touches are forgotten when the page is shown again and when the Round resumes.
  - Reaction Rush's rules are pure in `src/games/reaction-rush/logic/rules.ts`. Every point's wait (1500 to 3500 ms) and decoys are drawn from `round.rng` when the Round starts. A press counts when the finger lands; presses are ordered by touch timestamp once the first has settled for 50 ms of Round time, and equal timestamps both score. A press before the signal, or while a decoy shows, is a false start and puts that Seat out until the next point; when every Seat is out the point is void. It is first to three, over at most ten points: then the Seats with the most points win, or it is a draw when nobody scored. Easy has no decoys, Medium one a point and Hard two; the signal stays up 3000, 2000 and 1200 ms. A press anywhere in a Seat's Zone is its press; the Seat's button is its one target. While its Demo plays, every lamp shows the signal and the hand presses two Seats' buttons, except that on Medium and Hard the first Seat's lamp shows a decoy, which the hand points at and refuses before pressing a button whose lamp shows the signal. `Round` gained `demoPlaying`, so a Game can draw what its Demo points at however the Demo began, the pause screen included.
  - The bridge's `round()` reports `now` (the Round's own time), `zones` with seat and facing, and `seatTouches` (the Seats holding a touch, and SeatZones' latest reports).
  - Test harness: `skipDemo` now taps the top of the pause strip, where no Zone or target is, because a tap in the middle could land in a Zone if the Demo had just ended. Phaser holds each frame's delta to 16.7 ms for its first 120 frames, and counts any frame slower than 200 ms as 16.7 ms. A CI runner's software-rendered page draws 3 or 4 frames a second, so there Round time runs at about a fifteenth of wall time, and a Round of Reaction Rush takes three minutes. `playToResult` waits in the page for each change (up to two minutes) and adds five minutes to its test for each Round it plays. Reaction Rush's tests use seed 7, whose first signals come soon. Counting every test frame in full (Phaser's `fps.min`) was tried and rejected: the pause, Demo and feedback tests then missed their windows, because they rely on Round time standing nearly still between two bridge calls. CI shares each Chromium project's tests among six jobs.
- **Phase 1 slice 5a is built (#18, 2026-11-21).** Tic-Tac-Toe plays Versus Computer at three Difficulties: one Player and one Computer Player, its second Play Style (Turn-Based stays first, so tests over `EVERY_STYLE[0]` are unchanged).
  - The look-ahead is `src/games/tic-tac-toe/logic/search.ts`, written against `TurnRules` alone so that Phase 2 can move it into the kit: `winningMoves`, `safeMoves` (after which the next Seat cannot win at once) and `scoreMoves`, a search to the end of the Round that keeps each position's score between calls, per set of rules. Four in a Row will need a depth limit and a bounded store instead.
  - The Computer Player is `computerPlayer` in `logic/computer-player.ts`. Easy chooses among all legal Moves; Medium takes a win, and otherwise a Move that leaves no immediate loss; Hard plays a best Move, except that one time in ten, where one exists, it plays a Move with a worse outcome. Over 500 fixed-seed Rounds Hard wins or draws about 95% against a random opponent and slips on about 10% of its chances; Easy loses about 69% to an opponent that takes any win.
  - On a Computer Player's Turn the Scene closes the Turn gate, waits 600 ms of the Round's own time (so it waits out a pause and the Demo), makes its Move with `round.rng`, and opens the gate once its mark has popped in. The snapshot's `computer` is `choosing`, `placing` or null. A touch on the board while the gate is closed wiggles the Turn pointer through `round.refuse`; the kit's `TurnPointer` gained `image` for it. The Versus Computer Demo taps once for the Player.
  - The ignored-touch table has a row for an empty cell tapped while the Computer Player chooses; a Case may now name its Play Style. `NEXT_TAP` waits out the Computer Player's Turn. Three tests in `tic-tac-toe.spec.ts` act inside the page, frame by frame (`inPage`): a touch while the mark is placed, the page hidden while the Computer Player chooses, and a touch every frame while it chooses, which checks the refused pointer still ends where the Turn passed. A touch sent from the test arrives frames later, and a busy page counts each frame up to 200 ms in full, so the 260 ms pop can be over first.
- **Next:** the other `[AFK]` slices one at a time in the order of the table below (#19 to #21 in any order, then #22). Read each slice's body and its agent brief before building it.

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

Hosting is settled: GitHub Pages at its default address ([ADR-0013](adr/0013-github-pages-default-address.md)). What was not known is whether the iPad would cooperate. Its web filter is not under the owner's control, and it may be a managed device. On 2026-11-19, before any code existed, a placeholder page was published at the address from a `gh-pages` branch, so the owner could check three things, which take five minutes:

1. Open `https://frankdavalos.github.io/whimigo/` in Safari. Does it load, or does the filter block it? **Done on 2026-11-19: it loads.**
2. Add it to the Home Screen. Is that allowed? **Done: it installs and opens as an app.**
3. Open Settings, Multitasking & Gestures, and Settings, Accessibility, Guided Access. Can they be changed? **Done for Guided Access: it can be switched on. The Multitasking & Gestures toggles are not yet confirmed.**

The placeholder also had four coloured Zones with tap counters and showed the number of touches now, the most at once, and how many were cancelled. Putting four fingers on it gave an early, rough answer to the four-finger question (gate G1) before Phase 0 was built. It was throwaway: the deploy slice (`2b`, [#4](https://github.com/frankdavalos/whimigo/issues/4)) switched Pages to publish from the CI workflow and deleted the `gh-pages` branch. The address now serves the Arcade itself, rebuilt on every push to `main`.

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

Done on 2026-11-20: all eight answered yes, one commit per gate. The answers are under [Gate results](roadmap.md#gate-results). Where a gate changed no decision but confirmed one, the ADR or the overview gained a dated line instead.

## Recommended implementation order

1. **Phase 0, slice 1** (walking skeleton, #2). Everything else stands on it.
2. **Phase 0, wave 2** (the asset build #3, the deploy workflow #4). In either order, one at a time.
3. **Phase 0, wave 3** (install and offline #5, and the three check screens #6 to #8). In any order, one at a time, once the asset build is on `main`.
4. **Phase 0 device run (#9) and gate.** The owner, with the iPad Pro; about half an hour. Run on 2026-11-20: [results](device-runs/2026-11-20-ipad-pro.md). Items 13 and 14 (turning to portrait) failed in the installed app, were fixed, and pass when repeated. The gate decisions were recorded the same day: all eight are yes.
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
| Any other Phase 1 slice | Phase 1 slice 1 ([#12](https://github.com/frankdavalos/whimigo/issues/12)) | It creates `contract.ts`, `GameHost`, `openRound` and the kit's folder structure. Two agents inventing these at once will collide |
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

The PRD is [#11](https://github.com/frankdavalos/whimigo/issues/11). Its twelve sub-issues are the plan; read each one with `gh issue view <n> --comments` before building it. Wave numbers are dependency depth; the PRD's own slice table uses the older names in the last column.

| Issue | Slice | Blocked by | PRD slice |
|---|---|---|---|
| [#12](https://github.com/frankdavalos/whimigo/issues/12) | `[AFK] 1 — Play a two-Player Round of Tic-Tac-Toe from the Home Screen to a Result and back` | Phase 0 | 1 |
| [#13](https://github.com/frankdavalos/whimigo/issues/13) | `[AFK] 2 — Pause and leave a Round: hold-to-pause, and pause when the page is hidden or turned` | #12 | 2a |
| [#14](https://github.com/frankdavalos/whimigo/issues/14) | `[AFK] 3a — Progress: Stars from each Result, saved per Mascot and shown` | #13 | 2c |
| [#15](https://github.com/frankdavalos/whimigo/issues/15) | `[AFK] 3b — Color Echo, Solo: synthesized tones, the Demo, motion presets and reduced motion` | #13 | 2d |
| [#16](https://github.com/frankdavalos/whimigo/issues/16) | `[AFK] 4a — Lobby: Mascots join Seats; Play Style, Difficulty and Seating chosen and remembered; style guide` | #14 | 2b |
| [#17](https://github.com/frankdavalos/whimigo/issues/17) | `[AFK] 4b — Zones and Seating, with Reaction Rush for two to four Seats` | #13, #15 | 2e |
| [#18](https://github.com/frankdavalos/whimigo/issues/18) | `[AFK] 5a — Tic-Tac-Toe Versus Computer at three Difficulties` | #16 | 3a |
| [#19](https://github.com/frankdavalos/whimigo/issues/19) | `[AFK] 5b — Color Echo, Turn-Based for two to four Seats` | #16, #15 | 3b |
| [#20](https://github.com/frankdavalos/whimigo/issues/20) | `[AFK] 5c — Color Echo, Cooperative, each Seat's pads in its Zone` | #15, #17 | 3c |
| [#21](https://github.com/frankdavalos/whimigo/issues/21) | `[AFK] 5d — Grown-Ups Area: gate, sound and motion settings, update, reset, status, check screens` (also builds the storage state) | #16, #15 | 3d |
| [#22](https://github.com/frankdavalos/whimigo/issues/22) | `[AFK] 6 — Hardening: storage and load failures, errors, offline, budgets, leak test across three Games` | #18 to #21 | 4 |
| [#23](https://github.com/frankdavalos/whimigo/issues/23) | `[HITL] 7 — Device acceptance on the iPad Pro, and the owner's review` | #12 to #22 | 5 |

Build them one at a time with `/zsl:tdd`, a slice only once its blockers are closed: #12, #13, then #14 and #15 in either order, then #16 and #17, then #18 to #21 in any order, then #22. `#23` is cleared by the owner with `/zsl:human-itl`.

Why the order differs from the first plan: several wave-2 criteria observe what a sibling builds. Remembered choices in the lobby need Progress's save document; leaving from the pause screen with no Stars needs both pausing and Progress; the Demo replayed from the pause screen needs pausing; Reaction Rush's Demo and the check that timed Rounds hold while paused need Color Echo; the Grown-Ups Area's reset and motion setting need the lobby and Color Echo. The PRD's slice table records the revision.

Some criteria are written over every Game in the Catalog, every screen or every Play Style (layout, conformance, Demos, touch feedback, unloading). The slice that builds the mechanism writes that test to iterate the list, so each later Game is held to it on its first push.

## Risks to settle before substantial implementation

These are the Phase 0 gate decisions. All were answered on 2026-11-20; see [Gate results](roadmap.md#gate-results).

| Risk | Checked by | If it goes badly |
|---|---|---|
| iPadOS cancels touches when it sees four fingers | Touch Check, checklist items 5 to 8. Settled 2026-11-20: no cancellations under any setting | Simultaneous play capped at three Seats on iPadOS |
| Work per frame on the iPad Pro leaves too little margin | Performance check. Settled 2026-11-20: 0.33 ms at 60 frames per second | Find the cost before Phase 1 |
| Art for the 2752 × 2064 frame does not fit one atlas page, or looks soft | Performance check, checklist item 15. Settled 2026-11-20: sharp, and one page fits | Two atlas pages per Game; fix the rasterising scale |
| Phaser will not play a sound rendered from a recipe | Sound check screen, in CI. Settled 2026-11-19: Phaser plays it | `platform/audio` plays the buffers itself |
| Half render scale does not draw or take touches correctly | Automated test in the performance-check slice. Settled 2026-11-19: targets and presses match at 0.5 | No lighter mode; slower tablets get the full frame |
| Sound does not return after backgrounding | Sound check, items 16 to 20. Settled 2026-11-20: sound returns | Reload at the Home Screen when sound is dead |
| The status bar covers the top of the screen | Checklist items 12 and 14. Settled 2026-11-20: nothing hidden | Larger margin, or no drawing under the status bar |
| Scenes and packs do not unload cleanly | Performance check, automated loop. Settled 2026-11-19: 50 cycles leave the counts unchanged | Keep assets loaded; revisit memory budget |
| A Phaser 4.2.1 defect appears on the iPad Pro | All three check screens | Patch or work around before Phase 1 |

Two things Phase 0 cannot settle:

- **Android.** There is no Android tablet to test, and the owner has said Android matters little in practice. The Arcade should run on one and is checked in Chromium, but the design frame is sized for the iPad Pro, so expect it to be heavy there.
- **Whether art drawn in code is good enough.** That is judged by the owner looking at Phase 1. The style guide written in the lobby slice is the main defence.
