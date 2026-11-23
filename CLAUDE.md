# Whimigo

A private, offline, tablet-first arcade of mini-games for children aged 4–8, played by one to four children on one shared tablet. Phaser 4, TypeScript, Vite, installed as a PWA. No backend, accounts, ads or analytics.

**Current state:** the architecture was accepted on 2026-11-19. Phase 0 is complete (2026-11-20). Phase 1 has begun: Tic-Tac-Toe (issue #12) is the first Game, with the contract, `GameHost`, `openRound` and a first lobby; Color Echo (#15) is the second, with the Demo, motion presets and touch feedback; the real lobby, remembered choices and the style guide arrived with #16; Zones, SeatZones and Reaction Rush, the third, with #17. Tic-Tac-Toe plays Versus Computer at three Difficulties with #18. Color Echo plays Turn-Based for two to four Seats with #19. Color Echo plays Cooperative, each Seat's pads in its Zone, with #20. Every push to `main` that passes the checks is published to GitHub Pages. Start at [docs/implementation-handoff.md](docs/implementation-handoff.md).

## Read before working

- [CONTEXT.md](CONTEXT.md): the project's vocabulary. Use these terms exactly in code, tests, commits and issues. A **Game** is a catalog entry, a **Round** is one play of it, a **Session** is a visit; a **Player** is a person, a **Seat** is a position.
- [docs/architecture/overview.md](docs/architecture/overview.md): the decisions and their reasons.
- [docs/architecture/game-contract.md](docs/architecture/game-contract.md): the interfaces and the rules for Game code.
- [docs/testing-strategy.md](docs/testing-strategy.md): what "done" means.
- [docs/adr/](docs/adr/): read the records that touch what you are changing. If your change contradicts one, say so; do not silently override it.

## Rules that are easy to break

- **This is Phaser 4.** Do not rely on Phaser 3 knowledge. Check `node_modules/phaser/types/phaser.d.ts` and the v4 migration guide before using an API.
- **Phaser stays pinned at exactly 4.2.1.** Upgrading is its own task.
- **A Game lives in its own folder** under `src/games/` and imports only its own code, `src/contract.ts` and `src/kit/`. It never imports another Game, `src/arcade/` or `src/platform/`.
- **Imports that leave a module's folder use the `@/` alias** (`@/kit/frame`, not `../kit/frame`). Lint refuses relative imports that climb out of a module, because the boundary rules can only see aliases.
- **Rules are pure.** `logic/` never imports Phaser, a Scene or the DOM.
- **In Game code, never use** `setTimeout`, `setInterval`, `Date.now()`, `requestAnimationFrame` or `Math.random()`. Use the Scene's clock and tweens, and `round.rng`.
- **In Game code, never create** Phaser `Text`, `RenderTexture`, `DynamicTexture` or `Shader` objects, a second Scene, or HTML elements.
- **The design frame is 2752 × 2064**, the iPad Pro's native size. **Everything a child touches is at least 256 design units square** and is built with the kit's UI functions.
- **No runtime network requests** and no third-party services of any kind. Nothing from a CDN.
- **Nothing from outside the repository.** Art is SVG written here. Sound is a synthesis recipe written here. There are no audio files and no voice, recorded or synthesized. How to play is shown by a wordless **Demo**.
- **Keep human work to a minimum.** Through Phase 3, do not plan work that waits on a person to record, draw, pick assets or play-test. The owner runs the device checklist on the iPad Pro at each gate, and reviews the result.
- **Do not add a dependency** without a decision recorded in `docs/adr/`. Phaser is the only runtime dependency.
- **The repository and the site are public.** Never commit personal details: no email addresses, children's names, device identifiers or network details. Commits use the owner's GitHub no-reply address, which is this repository's configured `user.email`; do not change it.
- **The Arcade is served under `/whimigo/`** on GitHub Pages, not at the root of a domain. Paths, the manifest and the service worker scope must all respect the base path.

## Working in this repository

- The only test device is a 13-inch iPad Pro (M5). Android matters little and is unverified.
- Work follows the ZSL Superpowers loop described in the handoff: PRD, vertical-slice issues, triage, test-driven implementation, review.
- Commands: `npm run check` (type-check, lint, Vitest) and `npm run e2e` (production build, then Playwright). They are described in the testing strategy.

## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues for `frankdavalos/whimigo`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The six triage roles use their default label names. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` at the root, ADRs in `docs/adr/`. See `docs/agents/domain.md`.

### Ship style

Direct push to `main`; no pull requests. Agents push without asking, but only when the checks pass. See `docs/agents/ship-style.md`.
