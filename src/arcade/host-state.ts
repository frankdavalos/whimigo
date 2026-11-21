/** Where the GameHost is in a Game's lifecycle (overview, Game lifecycle). */
export type HostState = 'idle' | 'loading' | 'playing' | 'showing-result' | 'closing';

/** What moves the GameHost on. */
export type HostEvent = 'open' | 'loaded' | 'failed' | 'finish' | 'replay' | 'home' | 'closed';

const STEPS: Readonly<Record<HostState, Partial<Record<HostEvent, HostState>>>> = {
  idle: { open: 'loading' },
  loading: { loaded: 'playing', failed: 'idle' },
  playing: { finish: 'showing-result' },
  'showing-result': { replay: 'playing', home: 'closing' },
  closing: { closed: 'idle' },
};

/** The state after `event`, or null when the event means nothing in this state. */
export function nextHostState(state: HostState, event: HostEvent): HostState | null {
  return STEPS[state][event] ?? null;
}
