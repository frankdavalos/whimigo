import { describe, expect, it } from 'vitest';
import { nextHostState, type HostEvent, type HostState } from './host-state';

/** Every step the overview's lifecycle allows, in this slice. */
const ALLOWED: [HostState, HostEvent, HostState][] = [
  ['idle', 'open', 'loading'],
  ['loading', 'loaded', 'playing'],
  ['loading', 'failed', 'idle'],
  ['playing', 'finish', 'showing-result'],
  ['showing-result', 'replay', 'playing'],
  ['showing-result', 'home', 'closing'],
  ['closing', 'closed', 'idle'],
];

const STATES: HostState[] = ['idle', 'loading', 'playing', 'showing-result', 'closing'];
const EVENTS: HostEvent[] = ['open', 'loaded', 'failed', 'finish', 'replay', 'home', 'closed'];

describe('the GameHost’s states', () => {
  for (const [from, event, to] of ALLOWED) {
    it(`go from ${from} to ${to} on ${event}`, () => {
      expect(nextHostState(from, event)).toBe(to);
    });
  }

  it('refuse every other step, staying where they are', () => {
    for (const from of STATES) {
      for (const event of EVENTS) {
        if (ALLOWED.some(([f, e]) => f === from && e === event)) continue;
        expect(nextHostState(from, event), `${event} while ${from}`).toBeNull();
      }
    }
  });
});
