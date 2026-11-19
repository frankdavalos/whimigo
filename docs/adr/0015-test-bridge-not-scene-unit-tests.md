---
status: accepted
---

# Scenes are tested in a real browser through a test bridge, not as unit tests

Game rules are unit-tested as pure logic. Scenes are not unit-tested at all: they are exercised by Playwright in a real browser against the production build, through a small bridge that reports each Round's state and named tap targets. We do not run Phaser headless under a simulated DOM, and we do not compare screenshots.

Phaser can run headless, but only with the canvas, WebGL and image loading mocked, and a test that passes against mocks says little about a tablet. Screenshot comparison breaks on every art change and every animation frame. Asking the running Game "what is your state, and where is the cell I should tap" is stable, fast to write, and tests the thing a child actually uses.

## Consequences

- The bridge ships in the production build, switched on only by a query parameter. An installed app has no address bar, so a child cannot reach it.
- Every Game must call `round.expose`. A Game that does not cannot pass its smoke test.
- Multi-finger tests use the Chromium DevTools protocol and so run in Chromium only. WebKit gets a smoke test; real Safari behaviour is checked on a device.
- How a Game looks is not tested automatically. It is reviewed by a person.
