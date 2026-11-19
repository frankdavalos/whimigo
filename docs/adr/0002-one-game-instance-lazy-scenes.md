---
status: accepted
---

# One Phaser.Game for the whole Arcade; Games are lazily imported Scenes

The Arcade creates a single `Phaser.Game` at start-up and never destroys it. A Game is a Scene that is imported on demand, added to that instance when opened, and removed with its assets when closed. We chose this over giving each Game its own Phaser instance (or its own iframe) because isolation is not worth its cost here.

## Considered Options

- **A new `Phaser.Game` per mini-game.** Rejected. Phaser 4.2.1 never removes its `wheel` listener on destroy, so each destroyed instance can stay in memory, and every switch would re-create the WebGL context and reload shared art and sounds.
- **One iframe per Game.** Rejected. Strong isolation, but separate audio unlocking, duplicated engine memory, and no shared Mascots or controls.
- **One instance, Scenes added and removed.** Chosen. Phaser supports adding and removing Scenes at run time and removing every asset in a pack in one call.

## Consequences

- A Game cannot crash-proof the Arcade: an uncaught error in one Game takes the page down, and recovery is a reload.
- Games share global texture and sound caches, so asset keys must be namespaced by Game id.
- A Game must own nothing outside its Scene, or it will leak when the Scene is removed.
