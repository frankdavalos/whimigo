import { describe, expect, it } from 'vitest';
import { LOG_CAP, logEvent, type SoundLog } from './sound-log';

describe('the Sound check’s log', () => {
  it('records each event with its elapsed time in whole milliseconds, oldest first', () => {
    let log: SoundLog = [];
    log = logEvent(log, 'hidden', 120.4);
    log = logEvent(log, 'suspended', 121.6);
    log = logEvent(log, 'visible', 4000);
    expect(log).toEqual([
      { event: 'hidden', at: 120 },
      { event: 'suspended', at: 122 },
      { event: 'visible', at: 4000 },
    ]);
  });

  it(`holds at most ${LOG_CAP} entries, keeping the newest`, () => {
    let log: SoundLog = [];
    for (let at = 0; at < LOG_CAP + 10; at++) log = logEvent(log, 'running', at);
    expect(log).toHaveLength(LOG_CAP);
    expect(log[0]!.at).toBe(10);
    expect(log.at(-1)!.at).toBe(LOG_CAP + 9);
  });

  it('leaves the log it was given unchanged', () => {
    const log: SoundLog = [{ event: 'locked', at: 0 }];
    logEvent(log, 'running', 5);
    expect(log).toEqual([{ event: 'locked', at: 0 }]);
  });
});
