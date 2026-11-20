# Testing Strategy

How Whimigo is tested, what is automated, and what can only be checked with a tablet in a child's hands. Terms in **bold** are defined in [CONTEXT.md](../CONTEXT.md).

## Principles

1. **Test rules without a browser.** A Game's rules are pure functions, so most of what can go wrong is caught in milliseconds.
2. **Test the running Arcade in a real browser.** Scenes are not unit-tested and Phaser is not mocked ([ADR-0015](adr/0015-test-bridge-not-scene-unit-tests.md)).
3. **Test what a child can observe.** Assert on a **Result**, a **Turn**, a count of **Stars**; never on a private field or a pixel.
4. **Be honest about emulation.** A desktop browser cannot reproduce iPadOS gestures, a tablet's touch limit, its audio policy or its speed. Those are on the [device checklist](#real-device-checklist) and nowhere else.
5. **One command per level.** An agent working on one Game should be able to run that Game's tests alone and get an answer in seconds.

## The four levels

| Level | Tool | Runs | Answers |
|---|---|---|---|
| 1. Logic | Vitest, Node | On every save; under 10 seconds for everything | Are the rules, the **Computer Players** and the shared pure helpers correct? |
| 2. Conformance | Vitest, Node | With level 1 | Does every Game keep the contract? |
| 3. Arcade | Playwright, against the production build | Before every push to `main`, and again in CI after it; a few minutes | Does the real Arcade load, play, pause, save and work offline? |
| 4. Device | One adult with the checklist and the iPad Pro | At each phase gate, and after any Phaser or iPadOS upgrade | Does it work on the real tablet? |

## Level 1: logic

Lives beside the code as `*.test.ts`. No DOM, no Phaser.

**Each Game's `logic/`**

- Every rule: legal and illegal **Moves**, every way a **Round** can end, edge cases (a full board, a last pair, a false start).
- `apply` returns a new state and leaves the old one unchanged.
- Scoring and **Result** construction.

**Computer Players**

- Always return a legal **Move**.
- Are deterministic for a given state, **Difficulty** and seed.
- Take a winning **Move** and block a losing one where the level's definition says they must.
- Behave statistically as intended, measured over a few hundred fixed-seed **Rounds** against a random opponent. For example: Hard wins or draws at least 85%, Easy loses at least 60% to a player who takes any available win. The thresholds are chosen per Game and are loose enough not to flicker.

**Randomness**

- `Rng` with the same seed gives the same sequence; `shuffle` returns a permutation and does not change its input.
- No test calls `Math.random()`. Lint forbids it in `games/`.

**Shared pure code**

- **Zone** geometry for every Seat count and **Seating**: Zones do not overlap, lie within `stage.safe`, and face the documented way.
- Touch attribution, tested as a pure function of a sequence of touch events: first touch in a Zone wins, a second is ignored, ownership survives sliding out, a cancelled touch is never a tap, a touch outside every Zone belongs to nobody.
- `TurnGate`: a guarded handler does not run while the gate is closed or while another guarded touch is down.
- The Star rule: from a Result and a **Session** to the Stars each **Mascot** earns.
- Sound recipes: every note has a positive duration, a pitch in the audible range and a gain between 0 and 1; no sound runs longer than a few seconds; rendering a recipe gives a buffer of the expected length that is not silent and does not clip.
- Seat colours: the four stay distinguishable from one another under simulated protanopia, deuteranopia and tritanopia, measured as a computed colour difference above a threshold.
- `SaveStore`, against an in-memory store: round trip, migration from each older version, a corrupt document set aside, a store that throws on write, a store that is absent.

## Level 2: conformance

The same checks applied to every Game in the **Catalog**, so adding a Game adds its tests for free.

- **Manifest:** the id is unique and kebab-case; every **Play Style** range is between 1 and 4 and has `min ≤ max`; `computerPlayers` is zero unless the style is `versus-computer`; Seats never exceed four; the card frame exists in the Arcade's atlas.
- **Module:** every key in the pack and every sound recipe key starts with the Game's id; the pack lists no audio files.
- **`TurnRules`:** a shared helper, `checkTurnRules(rules)`, plays many random seeded Rounds and checks that there is always a legal Move until there is a Result, that every Round ends within a bound, that `apply` never mutates, that `seatToMove` is always a Seat in the Session, and that the Result names only Seats that exist. A Turn-Based Game opts in with one line.
- **Boundaries:** lint is the test. `logic/` cannot import Phaser; a Game cannot import another Game or the Arcade; timers and `Math.random()` are banned in `games/`.

## Level 3: the running Arcade

Playwright drives the production build served by `vite preview`, so the service worker and the real chunks are what is tested.

### The test bridge

A canvas has no buttons for a test to find. The Arcade exposes a small object on `window` when the page is opened with `?e2e=1`.

| Call | Returns or does |
|---|---|
| `screen()` | Which Arcade screen is showing, and the `GameHost` state |
| `open(session, seed)` | Starts a Session directly, skipping the Home Screen and lobby |
| `round()` | The current Round's snapshot from `round.expose`: its state, and its named targets converted to page coordinates |
| `counts()` | Numbers of Scenes, textures and cached sounds |
| `save()` | The current save document |

A test reads `round().targets['cell-4']`, taps that point with a real touch, and then asserts on `round().state` or `screen()`. Nothing in a test depends on art, layout or animation timing.

### Browser projects

| Project | Viewport | Purpose |
|---|---|---|
| Chromium, tablet 4:3 | 1376 × 1032, touch (the 13-inch iPad Pro's size in CSS pixels) | The main run |
| Chromium, small tablet | 1133 × 744, touch (the iPad mini's size in CSS pixels) | Layout on the smallest supported screen |
| Chromium, tablet 16:10 | 1280 × 800, touch | Layout on the common Android shape |
| WebKit, tablet 4:3 | 1024 × 768, touch | Smoke only: boots, opens a Game, finishes a Round |

Playwright's WebKit is not Safari and does not behave like an iPad. It catches gross engine differences and nothing more.

### What is covered

**Every Game, for every Play Style**

- Open with a fixed seed, play to a Result through the bridge, check the Result and the Stars awarded.
- Replay: a new Round starts with a clean state.
- The **Demo** plays on the first Round of a Session, holds input while it runs, is skipped by a tap, and does not play on a replay.
- Close: the Game's Scene and textures are gone and the Home Screen is showing.

**Lifecycle**

- Hold-to-pause: a short tap does not pause, a full hold does; resume continues; exit returns home.
- Hiding the page pauses a running Round; returning shows the pause screen.
- A timed Game does not advance while paused.
- Open and close every Game 20 times: `counts()` returns to its starting values. This is the automated memory-leak guard.
- A Game whose chunk fails to load leaves the child on the Home Screen.
- An exception thrown in a Scene shows the error screen, and its button reloads to the Home Screen.

**Multitouch**

Playwright's own touchscreen is single-point. Multi-finger tests use the Chromium DevTools protocol, which accepts several touch points in one event and produces real, trusted touch events. They run in Chromium only.

- Four fingers down in four Zones in one event: each **Seat** registers exactly one touch.
- Two fingers in one Zone: the second is ignored.
- A finger that slides into a neighbouring Zone still belongs to its original Seat.
- A cancelled touch does not count as a tap.
- Reaction Rush: of two touches with different timestamps, the earlier wins regardless of event order; two with the same timestamp both score.
- On a shared board, two simultaneous taps produce one **Move**.
- Eleven fingers: the Arcade keeps working.

**Persistence**

- Stars and remembered choices survive a reload.
- With `localStorage` disabled, the Arcade plays normally and reports memory-only storage.
- A corrupt save document yields fresh Progress and no error screen.

**Offline and updates**

- After the first load, with the network switched off, a reload reaches the Home Screen and every Game opens.
- With a newer build deployed while a Session is running, the running page keeps its files; the new version is used after a reload.

**Layout**

- At 4:3, 16:10, 16:9 and a narrow window, every named target of every Game lies inside the visible canvas and inside `stage.safe`.
- Every target is at least the minimum touch size, and no two overlap.
- In portrait the rotate screen shows and the Round is paused.
- At half render scale, every named target of the check screens sits at the same place on the page and responds to a tap there. This is the test that says whether a lighter drawing mode is possible.
- With reduced motion requested, a Round still completes.

### What is deliberately not automated

- **How anything looks.** No screenshot comparison. Art is reviewed by a person.
- **Whether it is fun, clear or frustrating.** Children decide.
- **Performance.** A desktop's frame rate says nothing about a tablet's.
- **How anything sounds.** Tests check that the right sound was requested and that its recipe renders; they cannot judge whether it is pleasant.
- **Coverage percentages.** No target. The conformance tests and the smoke tests are the floor.

## Level 4: real devices

### What must be tested on a device, and why

| Area | Why emulation is not enough |
|---|---|
| Four or more simultaneous touches | The hardware's touch limit, and what happens beyond it, differ per tablet. iPadOS reports a fixed, meaningless number |
| iPadOS system gestures | They are recognised by the operating system, outside the browser |
| Sound | Unlocking, silent mode, and recovery after backgrounding are platform behaviour, with open defects |
| Installation and the status bar | Standalone display, safe-area insets and window controls differ between iPadOS versions and modes |
| Storage durability | Eviction and the installed-app exemption happen over days |
| Suspension | When the tablet freezes or closes the app is decided by the operating system |
| Performance and memory | Depends on the GPU, the screen resolution and the thermal state |
| Children | A four-year-old's hand, patience and aim are not simulated. Checking this is optional through Phase 3 |

### Real-device checklist

Run on the 13-inch iPad Pro (M5) at each phase gate, and on any other tablet if one becomes available. Record the tablet, iPadOS version and date with each run. Items marked **(P0)** are the Phase 0 questions. One adult can do everything except the last section alone, and the last section is optional.

No Android tablet is available, and Android matters little to this project, so that half of the platform is unverified. Nothing below has been run on Android.

**Install and offline**

1. Install to the home screen from the GitHub Pages address. It opens without browser controls. If the tablet is managed and will not allow this, record it and carry on in a Safari tab.
2. Wait for "ready to play offline". Turn on aeroplane mode. Close the app fully and reopen it: the Home Screen appears. **(P0)**
3. Still offline, open every Game.
4. Deploy a new version. Reopen while online: the old version runs. Close and reopen: the new version runs. **(P0)**

**Touch (P0)**

5. On the Touch Check screen, place fingers one at a time up to ten. Record the highest count shown, and what happens on the next finger.
6. Hold one finger in each of the four Zones, using both hands. All four register and stay registered.
7. Tap repeatedly in all four Zones for 30 seconds, the way four children would. Count the cancellations shown.
8. If the tablet is managed and these settings are locked, record that and skip the variants that need them. Otherwise repeat 6 and 7 three ways: default settings; with the gesture toggles off in Settings, Multitasking & Gestures; and with Guided Access on. Record which combination, if any, gives zero cancellations.
9. Rest a palm in a Zone and tap with the other hand.
10. Swipe in from each edge and each corner during a Round. Record what the system does.
11. Try to pinch-zoom, double-tap-zoom, long-press and select text. None should do anything.

**Screen**

12. Nothing a child must touch is hidden by the status bar, the home indicator, a camera cut-out or window controls.
13. Rotate to portrait and back. The rotate picture appears and the Round resumes.
14. On iPadOS, try Windowed Apps mode. Record whether the Arcade is usable.
15. Vector art and bitmap digits look sharp, pixel for pixel, with no visible softness. On the Performance check's sharpness card, the one-unit line pairs, grids and checks show as distinct lines, not grey. **(P0)**

**Sound (P0)**

16. The first tap starts sound, and every synthesized sound on the check screen plays without clicks or distortion.
17. Background the app for 10 seconds and return. Sound works after tapping play.
18. Lock the screen for a minute and return. Sound works.
19. Close and reopen the app. Sound works.
20. With silent mode on, the Arcade is silent; with it off, sound returns.
21. Color Echo tones play in time with the pad animations.

**Suspension**

22. Background the app mid-Round and return within a minute: the pause screen is showing and the Round continues.
23. Open several heavy apps, then return: the Arcade is either as it was left or has restarted at the Home Screen. It is never frozen or blank.

**Performance (P0)**

24. The performance check screen reports under 3 milliseconds of work per frame (the reading beside the hourglass) with its standard load, and motion is smooth at the display's full rate. Run its add-and-remove loop once: it counts to 50.
25. Open and close Games for five minutes. The app is not closed by the system and does not slow down.
26. Turn on Low Power Mode. Games play at the same speed, only less smoothly.

**Durability**

27. Earn Stars, close the app, reopen: the Stars are there.
28. Leave the tablet unused for at least a week, then reopen: the Stars are there.

**With children (optional; not a gate through Phase 3)**

29. A four-year-old can start a Game from the Home Screen without help, and understands what to do from the Demo alone.
30. A child understands whose Turn it is without being told.
31. Four children can play Reaction Rush around the tablet without touching each other's Zones by accident, and no touches are cancelled.
32. Nobody pauses, exits or reaches the Grown-Ups Area by accident in ten minutes of play.
33. Note where anyone gets stuck, confused or upset.

### Device settings to recommend to the family

Collected into a one-page guide in Phase 3. The working list:

- **iPadOS:** Settings, Multitasking & Gestures: choose Full Screen Apps; turn off Four & Five Finger App Switching, Productivity Gestures, Shake to Undo and Swipe Finger from Corner. Use Guided Access (Settings, Accessibility) with Motion off to hold landscape and block leaving the app. Keep Low Power Mode off.
- **Android:** install from Chrome; turn on app pinning; turn off any three-finger screenshot gesture.

Whether these settings are enough for four-child play on iPadOS 27 is exactly what checklist item 8 finds out.

## For agents working on one Game

A Game is finished when all of these are true.

1. Its rules are in `logic/` with tests for every rule and every ending.
2. If it is Turn-Based, it passes `checkTurnRules`.
3. Any **Computer Player** has the legality, determinism and statistical tests above.
4. Its manifest passes the conformance test.
5. Its Scene calls `round.expose` with a state and named targets.
6. It has a Demo, and its sounds are recipes in `sounds.ts`. It loads no audio files.
7. A smoke test plays each of its Play Styles to a Result, replays, and closes.
8. The layout test passes at every viewport.
9. `npm run check` and `npm run e2e` pass.

Commands, once the project is scaffolded:

| Command | Does |
|---|---|
| `npm run check` | Type-check, lint and all Vitest tests |
| `npm test -- tic-tac-toe` | Vitest for one Game |
| `npm run e2e` | Build, then all Playwright tests |
| `npm run e2e -- --grep tic-tac-toe` | Playwright for one Game |

## Acceptance criteria and ZSL

`/zsl:to-prd` refuses a user story that has no automatable acceptance criterion, and `/zsl:verify-coverage` generates tests from those criteria. Criteria should therefore be written against what levels 1 to 3 can observe: a rule's outcome, a **Result**, a `GameHost` state, a saved value, a target's position and size.

Anything on the device checklist is not a user story. It is a `[HITL]` slice: the owner runs the checklist and records what happened. There is one such slice per phase.

How something looks or sounds is not a user story either. Art and sound are produced by agents inside ordinary slices, against criteria that can be checked (the frame exists in the atlas, the recipe renders, the target is large enough), and judged by the owner's review at the end of the phase.
