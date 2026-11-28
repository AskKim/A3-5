import { describe, expect, it, vi } from 'vitest';
import { createPerfTimingRecorder } from '../perfTiming';

const makeClock = (ticks: number[]) => {
  let index = 0;
  return () => ticks[index++] ?? ticks[ticks.length - 1];
};

describe('createPerfTimingRecorder', () => {
  it('records the duration of a resolved operation and returns its result', async () => {
    const recorder = createPerfTimingRecorder({ clock: makeClock([10, 35]) });

    await expect(recorder.time('restore', async () => 'ok')).resolves.toBe('ok');

    expect(recorder.samples()).toEqual([
      { label: 'restore', durationMs: 25, atIso: expect.any(String) },
    ]);
  });

  it('records the duration of a rejected operation and rethrows', async () => {
    const recorder = createPerfTimingRecorder({ clock: makeClock([0, 12]) });

    await expect(
      recorder.time('restore', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(recorder.samples()).toHaveLength(1);
    expect(recorder.samples()[0].durationMs).toBe(12);
  });

  it('keeps only the most recent samples', () => {
    const recorder = createPerfTimingRecorder({ limit: 2 });
    recorder.record('a', 1);
    recorder.record('b', 2);
    recorder.record('c', 3);
    expect(recorder.samples().map((sample) => sample.label)).toEqual(['b', 'c']);
  });

  it('clears and rounds without throwing', () => {
    const recorder = createPerfTimingRecorder();
    recorder.record('x', 12.3456);
    expect(recorder.samples()[0].durationMs).toBe(12.35);
    recorder.clear();
    expect(recorder.samples()).toEqual([]);
    expect(() => recorder.record('y', Number.NaN)).not.toThrow();
  });

  it('does not blow up when the clock misbehaves', async () => {
    const recorder = createPerfTimingRecorder({ clock: () => Number.NaN });
    await expect(recorder.time('x', async () => 1)).resolves.toBe(1);
    expect(recorder.samples()).toHaveLength(1);
  });
});
