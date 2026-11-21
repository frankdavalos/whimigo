import type * as Phaser from 'phaser';
import { onTouchesReset } from './touches';

/** The least a guarded handler's first argument carries: the touch's identity. */
interface Touch {
  readonly id: number;
}

/**
 * On a shared board a touch belongs to the Seat whose Turn it is (ADR-0006). The gate decides
 * whether it counts at all: only while the gate is open, and only if no other guarded touch is
 * down, so two children pressing at once make one Move.
 */
export interface TurnGate {
  /** Wraps an input handler whose first argument is the touch (a Phaser Pointer). */
  guard<A extends unknown[]>(
    handler: (touch: Touch, ...args: A) => void,
  ): (touch: Touch, ...args: A) => void;
  /** Close while something animates or a Computer Player chooses; open when a Player may act. */
  close(): void;
  open(): void;
  readonly isOpen: boolean;
}

/** The gate's rules, apart from Phaser: the Scene reports each touch that lifts. */
export interface TurnGateState extends TurnGate {
  /** A touch lifted, or was taken away by the system. */
  lift(id: number): void;
  /** Forgets every touch, as when the page was hidden with fingers down. */
  reset(): void;
}

export function createTurnGate(): TurnGateState {
  let open = true;
  let down: number | null = null;
  return {
    guard:
      (handler) =>
      (touch, ...args) => {
        if (!open || down !== null) return;
        down = touch.id;
        handler(touch, ...args);
      },
    close: () => void (open = false),
    open: () => void (open = true),
    get isOpen() {
      return open;
    },
    lift(id) {
      if (down === id) down = null;
    },
    reset: () => void (down = null),
  };
}

/** A Turn gate for a Scene: it hears every touch lift in the Scene, and forgets stale ones. */
export function turnGate(scene: Phaser.Scene): TurnGate {
  const gate = createTurnGate();
  const lift = (pointer: Phaser.Input.Pointer) => gate.lift(pointer.id);
  scene.input.on('pointerup', lift);
  scene.input.on('pointerupoutside', lift);
  onTouchesReset(scene, () => gate.reset());
  scene.events.once('shutdown', () => {
    scene.input.off('pointerup', lift);
    scene.input.off('pointerupoutside', lift);
  });
  return gate;
}
