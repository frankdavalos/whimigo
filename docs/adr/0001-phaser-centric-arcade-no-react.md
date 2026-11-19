---
status: accepted
---

# The Arcade is built in Phaser, without React

Every screen a child touches (the Home Screen, the lobby, the pause and Result screens, and every Game) is a Phaser Scene. The starting proposal put a React shell around Phaser; we rejected it because the shell has no forms, text input or long lists for React to help with, and it would have meant two rendering systems, two sets of buttons and a bridge between them.

## Considered Options

- **React shell with Phaser mounted inside it.** Rejected. Besides the duplication, Phaser 4.2.1 listens for touches on the whole window, so a touch on an HTML element uses up one of its ten touch slots, and it drops finger movement that passes over HTML. With four children touching the screen, HTML over the canvas works against us.
- **Phaser only, with no DOM at all.** Rejected for the adult-facing screens; see [ADR-0005](0005-pictures-in-canvas-words-in-dom.md).
- **Phaser for children, plain DOM for adults.** Chosen.

## Consequences

- Menu layout is done by hand in design units. This is acceptable because there are few screens and each is a handful of large pictures.
- A screen reader cannot read the child-facing screens. The audience cannot read either; accessibility is addressed through size, shape, sound and motion.
- If the Arcade ever needs real forms or long text for children, this decision should be reopened.
