# Whimigo

Whimsy + Amigo + Go. A private, offline arcade of short mini-games for children aged 4–8, played by one to four children sharing a tablet.

The architecture was accepted on 2026-11-19. The walking skeleton is built: the Arcade boots to a placeholder Home Screen, with lint boundaries, unit tests, browser tests and CI, and every push to `main` that passes the checks is published to GitHub Pages. There are no Games yet.

`npm run check` runs the type-check, lint and unit tests; `npm run e2e` builds the Arcade and runs the browser tests against it. See [docs/testing-strategy.md](docs/testing-strategy.md).

| Document | What it is |
|---|---|
| [CONTEXT.md](CONTEXT.md) | The project's vocabulary and constraints |
| [docs/product/game-catalog.md](docs/product/game-catalog.md) | The eight Games of the first release |
| [docs/architecture/overview.md](docs/architecture/overview.md) | The architecture and the reasons for it |
| [docs/architecture/game-contract.md](docs/architecture/game-contract.md) | What a Game provides and what it is given |
| [docs/adr/](docs/adr/) | Architecture decision records |
| [docs/roadmap.md](docs/roadmap.md) | The five phases and their gates |
| [docs/testing-strategy.md](docs/testing-strategy.md) | How it is tested, including the real-device checklist |
| [docs/implementation-handoff.md](docs/implementation-handoff.md) | What to do next |
