/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Development timers for the operations that get slow as the stored data grows.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Development timing instrumentation.
 *
 * Restores, offloads and exports are the operations that get slow as the stored dataset grows, and
 * "it feels slow" is not a measurement. These recorders hold a small ring of labelled durations so the
 * diagnostics screen can show where the time actually went, without a profiler attached and without
 * leaking timings into production behaviour.
 *
 * They never throw: a recorder failure must not break the operation it is measuring.
 */

export interface PerfTimingSample {
  label: string;
  durationMs: number;
  atIso: string;
}

export interface PerfTimingRecorder {
  /** Wrap an async operation; the duration is recorded whether it resolves or rejects. */
  time: <T>(label: string, operation: () => Promise<T>) => Promise<T>;
  record: (label: string, durationMs: number) => void;
  samples: () => PerfTimingSample[];
  clear: () => void;
}

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export interface PerfTimingRecorderOptions {
  /** Ring size: only the most recent samples are kept. */
  limit?: number;
  clock?: () => number;
  isoClock?: () => string;
}

export function createPerfTimingRecorder(
  options: PerfTimingRecorderOptions = {}
): PerfTimingRecorder {
  const limit = Math.max(1, Math.floor(options.limit ?? 50));
  const clock = options.clock ?? now;
  const isoClock = options.isoClock ?? (() => new Date().toISOString());
  const kept: PerfTimingSample[] = [];

  const record = (label: string, durationMs: number) => {
    try {
      kept.push({
        label,
        durationMs: Math.max(0, Math.round(durationMs * 100) / 100),
        atIso: isoClock(),
      });
      while (kept.length > limit) kept.shift();
    } catch {
      // Measurement must never break the measured operation.
    }
  };

  const time = async <T,>(label: string, operation: () => Promise<T>): Promise<T> => {
    const startedAt = clock();
    try {
      return await operation();
    } finally {
      record(label, clock() - startedAt);
    }
  };

  return {
    time,
    record,
    samples: () => kept.slice(),
    clear: () => {
      kept.length = 0;
    },
  };
}

/** Process-wide recorder used by the store's long-running operations. */
export const appPerfTimings = createPerfTimingRecorder();
