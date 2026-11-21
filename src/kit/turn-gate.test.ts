import { describe, expect, it } from 'vitest';
import { createTurnGate } from './turn-gate';

const touch = (id: number) => ({ id });

describe('the Turn gate', () => {
  it('runs a guarded handler while it is open, and not while it is closed', () => {
    const gate = createTurnGate();
    const calls: number[] = [];
    const onCell = gate.guard((pointer: { id: number }, cell: number) => calls.push(cell));

    onCell(touch(1), 4);
    gate.lift(1);
    gate.close();
    expect(gate.isOpen).toBe(false);
    onCell(touch(2), 5);
    gate.lift(2);
    gate.open();
    onCell(touch(3), 6);
    expect(calls).toEqual([4, 6]);
  });

  it('ignores a second guarded touch while the first is down, even on another target', () => {
    const gate = createTurnGate();
    const calls: string[] = [];
    const onA = gate.guard(() => calls.push('a'));
    const onB = gate.guard(() => calls.push('b'));

    onA(touch(1));
    onB(touch(2));
    onA(touch(3));
    gate.lift(2);
    onB(touch(4));
    gate.lift(1);
    onB(touch(5));
    expect(calls).toEqual(['a', 'b']);
  });

  it('forgets every touch when touches are reset', () => {
    const gate = createTurnGate();
    const calls: string[] = [];
    const onA = gate.guard(() => calls.push('a'));
    onA(touch(1));
    gate.reset();
    onA(touch(2));
    expect(calls).toEqual(['a', 'a']);
  });
});
