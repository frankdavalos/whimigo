---
status: accepted
---

# Exactly one Scene accepts input at any moment

The pause control is drawn inside the Game's own Scene, not in a heads-up Scene laid over it, and a Game registers exactly one Scene with the Arcade. Phaser delivers each touch event to Scenes from the top down and lets a Scene that hits an interactive object stop lower Scenes from seeing the event; because one touch event can carry several fingers, a finger on an overlay's button can swallow another child's tap in the Game underneath.

## Consequences

- `openRound` mounts the pause control into the Game's Scene. A Game does not draw its own.
- The pause and Result screens are separate Scenes, but they are only shown after the Game's Scene has been paused, at which point it receives no input.
- A Game that wants internal screens builds them inside its one Scene.
- A contributor who knows Phaser will expect a parallel UI Scene. This record is why there is not one.
