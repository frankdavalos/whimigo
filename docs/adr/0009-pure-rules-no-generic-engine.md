---
status: accepted
---

# Game rules are pure logic per Game; there is no generic rules engine

Each Game keeps its rules in its own `logic/` folder as plain TypeScript with no Phaser import, and its Scene draws whatever that logic says. There is no shared engine that all Games' rules must be expressed in. A noughts-and-crosses grid, a memory deck, a reaction timer and a pond of drifting food have too little in common for one model to serve them without becoming harder to use than writing each directly.

Turn-Based Games follow a shared shape, `TurnRules` (start, legal Moves, apply, result), because a shared test helper and a shared Computer Player search can then be written once. It is a convention for Games that fit it, not a requirement of the Game contract, and Simultaneous Games do not use it.

## Consequences

- Rules are tested in milliseconds with no browser.
- Shared code is extracted when a second Game needs it and not before. The game-tree search stays inside Tic-Tac-Toe until Four in a Row is built.
- A cross-cutting feature such as undo or replay would have to be added Game by Game. None is planned.
- Lint forbids `logic/` from importing Phaser, the DOM or a Scene.
