import { describe, expect, it } from 'vitest';
import { createFrameMeter, READING_WINDOW_MS } from './frame-meter';

/** Records `count` frames, one every `interval` ms from `from`, each taking `work` ms. */
function frames(
  meter: ReturnType<typeof createFrameMeter>,
  { from, interval, work, count }: { from: number; interval: number; work: number; count: number },
): number {
  for (let index = 0; index < count; index++) meter.frame(from + index * interval, work);
  return from + count * interval;
}

describe('the frame meter', () => {
  it('averages over at least one second', () => {
    expect(READING_WINDOW_MS).toBeGreaterThanOrEqual(1000);
  });

  it('gives no reading until frames have covered the whole window', () => {
    const meter = createFrameMeter();
    expect(meter.reading()).toBeNull();
    frames(meter, { from: 0, interval: 1000 / 60, work: 2, count: 50 });
    expect(meter.reading()).toBeNull();
    frames(meter, { from: 50 * (1000 / 60), interval: 1000 / 60, work: 2, count: 20 });
    expect(meter.reading()).not.toBeNull();
  });

  it('reads frames per second from when frames end, and work per frame from the work measured', () => {
    const meter = createFrameMeter();
    frames(meter, { from: 0, interval: 1000 / 60, work: 2.5, count: 120 });
    const reading = meter.reading()!;
    expect(reading.fps).toBeCloseTo(60, 6);
    expect(reading.workMs).toBeCloseTo(2.5, 6);
    expect(reading.spanMs).toBeGreaterThanOrEqual(READING_WINDOW_MS);
  });

  it('does not derive work per frame from the frame rate', () => {
    const meter = createFrameMeter();
    frames(meter, { from: 0, interval: 1000 / 120, work: 1.25, count: 240 });
    expect(meter.reading()).toMatchObject({ fps: expect.closeTo(120, 6), workMs: 1.25 });
  });

  it('forgets frames older than the window, so the reading follows a change', () => {
    const meter = createFrameMeter();
    const end = frames(meter, { from: 0, interval: 1000 / 120, work: 1, count: 240 });
    frames(meter, { from: end, interval: 1000 / 30, work: 6, count: 60 });
    const reading = meter.reading()!;
    expect(reading.fps).toBeCloseTo(30, 6);
    expect(reading.workMs).toBeCloseTo(6, 6);
    expect(reading.spanMs).toBeGreaterThanOrEqual(READING_WINDOW_MS);
    expect(reading.spanMs).toBeLessThan(READING_WINDOW_MS + 1000 / 30);
  });

  it('starts again empty when reset', () => {
    const meter = createFrameMeter();
    frames(meter, { from: 0, interval: 10, work: 1, count: 200 });
    meter.reset();
    expect(meter.reading()).toBeNull();
  });
});
