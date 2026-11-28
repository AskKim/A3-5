// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The crash logger is the one subsystem that has to work precisely when the app is dying: it decides
 * what is worth keeping, how long it survives and what a breeder sees as a toast. Nothing here mocks
 * the module under test; `fake-indexeddb` supplies the verbose store and jsdom supplies real
 * `localStorage` / `sessionStorage` so the ring buffer and emergency trace are genuinely written.
 */

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DiagnosticLogEntry } from '../../domain/supportBundle';
import {
  captureMemorySample,
  clearAllDiagnosticLogs,
  clearEmergencySessionTrace,
  dismissAsyncErrorToast,
  emitAsyncErrorToast,
  getActiveAsyncErrorToasts,
  getDiagnosticConfig,
  getDiagnosticSummary,
  isMemoryLikeError,
  listDiagnosticLogs,
  logDiagnosticEvent,
  readEmergencySessionTrace,
  recordReactCrash,
  resetAsyncErrorToastsForTests,
  shouldIgnoreConsoleDiagnosticMessage,
  subscribeAsyncErrorToasts,
  subscribeDiagnosticLogs,
  updateDiagnosticConfig,
  writeEmergencySessionTraceSync,
} from '../crashLogger';

function entry(overrides: Partial<DiagnosticLogEntry> = {}): DiagnosticLogEntry {
  return {
    id: 'trace-1',
    timestampIso: '2026-11-28T10:00:00.000Z',
    timestampMs: Date.now() - 1_000,
    sessionId: 'session-test',
    level: 'error',
    category: 'runtime',
    route: '/herd',
    message: 'Boom',
    ...overrides,
  };
}

beforeEach(async () => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetAsyncErrorToastsForTests();
  await clearAllDiagnosticLogs();
});

afterEach(async () => {
  resetAsyncErrorToastsForTests();
  await clearAllDiagnosticLogs();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('diagnostic config', () => {
  it('falls back to defaults for missing, corrupt or invalid stored config', () => {
    expect(getDiagnosticConfig()).toEqual({ verboseEnabled: true, retentionDays: 7, supportEmail: '' });

    updateDiagnosticConfig({ retentionDays: 3 });
    const key = Object.keys(window.localStorage).find((k) => k.includes('diagnostic'));
    expect(key).toBeTruthy();
    window.localStorage.setItem(key as string, '{corrupt');
    expect(getDiagnosticConfig().retentionDays).toBe(7);

    window.localStorage.setItem(key as string, JSON.stringify({ verboseEnabled: false, retentionDays: 30 }));
    expect(getDiagnosticConfig()).toEqual({ verboseEnabled: false, retentionDays: 7, supportEmail: '' });
  });

  it('persists a patch and rejects an unsupported retention window', () => {
    const saved = updateDiagnosticConfig({ verboseEnabled: false, retentionDays: 3, supportEmail: 'someone@example.com' });

    expect(saved).toEqual({ verboseEnabled: false, retentionDays: 3, supportEmail: '' });
    expect(getDiagnosticConfig()).toEqual(saved);

    // The type only allows 3/7/14; an out-of-range stored value is what exercises the clamp above.
    expect(updateDiagnosticConfig({ retentionDays: 14 }).retentionDays).toBe(14);
    expect(getDiagnosticConfig().retentionDays).toBe(14);
  });
});

describe('noise and memory classification', () => {
  it('drops only the known Vite proxy websocket noise', () => {
    expect(shouldIgnoreConsoleDiagnosticMessage('[vite] failed to connect to websocket')).toBe(true);
    expect(shouldIgnoreConsoleDiagnosticMessage('  [vite] server connection lost')).toBe(true);
    expect(shouldIgnoreConsoleDiagnosticMessage('[vite] connecting...')).toBe(true);
    expect(shouldIgnoreConsoleDiagnosticMessage('Failed to fetch animals')).toBe(false);
    expect(shouldIgnoreConsoleDiagnosticMessage('   ')).toBe(false);
  });

  it('recognises quota, allocation and out-of-memory failures', () => {
    expect(isMemoryLikeError(new Error('QuotaExceededError: storage full'))).toBe(true);
    expect(isMemoryLikeError('Array buffer allocation failed')).toBe(true);
    // Only strings and Errors carry text; a plain object stringifies to "[object Object]" and is not classified.
    expect(isMemoryLikeError(new RangeError('Maximum call stack size exceeded'))).toBe(true);
    expect(isMemoryLikeError({ name: 'RangeError' })).toBe(false);
    expect(isMemoryLikeError('Animal saved')).toBe(false);
  });

  it('samples the heap without inventing numbers jsdom cannot report', () => {
    const sample = captureMemorySample();
    expect(sample).toHaveProperty('usedHeapBytes');
    expect(sample.usedHeapBytes === null || typeof sample.usedHeapBytes === 'number').toBe(true);
    expect(sample.heapPercent === null || typeof sample.heapPercent === 'number').toBe(true);
  });
});

describe('async error toasts', () => {
  it('emits, notifies subscribers and dismisses', () => {
    const seen: number[] = [];
    const unsubscribe = subscribeAsyncErrorToasts((notices) => seen.push(notices.length));
    expect(seen).toEqual([0]);

    const notice = emitAsyncErrorToast({
      title: 'Backup failed',
      detail: 'Disk quota exceeded',
      severity: 'error',
      category: 'storage',
    });
    expect(notice).not.toBeNull();
    expect(getActiveAsyncErrorToasts()).toHaveLength(1);
    expect(notice?.sticky).toBe(true);
    expect(notice?.canOpenDiagnostics).toBe(true);

    dismissAsyncErrorToast(notice!.id);
    expect(getActiveAsyncErrorToasts()).toHaveLength(0);
    unsubscribe();
  });

  it('deduplicates an identical toast inside the dedupe window', () => {
    const params = { title: 'IndexedDB paused', detail: 'try again later', severity: 'warning' as const };
    expect(emitAsyncErrorToast(params)).not.toBeNull();
    expect(emitAsyncErrorToast(params)).toBeNull();
  });
});

describe('logging, retention and summary', () => {
  it('honours the verbose switch but always keeps errors', () => {
    updateDiagnosticConfig({ verboseEnabled: false });

    expect(
      logDiagnosticEvent({ level: 'info', category: 'lifecycle', message: 'booted' })
    ).toBeNull();

    const error = logDiagnosticEvent({ level: 'error', category: 'runtime', message: 'Import blew up' });
    expect(error).not.toBeNull();
    expect(error?.level).toBe('error');
  });

  it('reclassifies a quota failure as a memory fault', () => {
    const logged = logDiagnosticEvent({
      level: 'warn',
      category: 'storage',
      message: 'QuotaExceededError while writing the herd',
    });
    expect(logged?.category).toBe('memory');
  });

  it('records React crashes as fatal react entries', () => {
    const crash = recordReactCrash(new Error('Cannot read properties of undefined'), 'at HerdScreen');
    expect(crash).toMatchObject({ level: 'fatal', category: 'react' });
    expect(crash?.message).toContain('React Render Crash: Error: Cannot read properties of undefined');
    expect(crash?.componentStack).toContain('at HerdScreen');
  });

  it('scrubs inline image payloads and truncates oversized messages', () => {
    const dataUri = `data:image/png;base64,${'A'.repeat(200)}`;
    const logged = logDiagnosticEvent({
      level: 'error',
      category: 'runtime',
      message: `photo failed ${dataUri}`,
    });
    expect(logged?.message).toContain('[image-data-uri omitted]');

    const long = logDiagnosticEvent({
      level: 'error',
      category: 'runtime',
      message: 'x'.repeat(1200),
    });
    expect(long?.message.length).toBeLessThan(700);
    expect(long?.message).toContain('… [truncated]');
  });

  it('lists stored entries newest first and summarises them', async () => {
    const older = entry({ id: 'older', timestampMs: Date.now() - 5_000, timestampIso: '2026-11-28T09:00:00.000Z' });
    const newer = entry({ id: 'newer', timestampMs: Date.now() - 1_000, timestampIso: '2026-11-28T10:00:00.000Z', level: 'fatal' });

    expect(writeEmergencySessionTraceSync(older)).toBe(true);
    expect(writeEmergencySessionTraceSync(newer)).toBe(true);

    const list = await listDiagnosticLogs();
    expect(list.map((e) => e.id)).toEqual(['newer', 'older']);

    const summary = await getDiagnosticSummary(list);
    expect(summary.totalEntries).toBe(2);
    expect(summary.errorCount).toBe(2);
    expect(summary.crashCount).toBe(1);
    expect(summary.newestEntryIso).toBe('2026-11-28T10:00:00.000Z');
    expect(summary.oldestEntryIso).toBe('2026-11-28T09:00:00.000Z');

    await clearAllDiagnosticLogs();
    expect(await listDiagnosticLogs()).toEqual([]);
  });

  it('notifies log subscribers when an entry is written', () => {
    let notifications = 0;
    const unsubscribe = subscribeDiagnosticLogs(() => {
      notifications += 1;
    });

    logDiagnosticEvent({ level: 'error', category: 'runtime', message: 'notify me' });
    expect(notifications).toBeGreaterThan(0);
    unsubscribe();
  });
});

describe('emergency session trace', () => {
  it('compacts, deduplicates by id and clears', () => {
    const store = {
      value: null as string | null,
      getItem() {
        return this.value;
      },
      setItem(_key: string, next: string) {
        this.value = next;
      },
      removeItem() {
        this.value = null;
      },
    };

    const long = entry({ id: 'trace-long', message: 'y'.repeat(600) });
    expect(writeEmergencySessionTraceSync(long, store)).toBe(true);
    const stored = JSON.parse(store.value as string) as DiagnosticLogEntry[];
    expect(stored).toHaveLength(1);
    expect(stored[0].message.length).toBeLessThan(400);
    expect(stored[0].message).toContain('… [truncated]');

    expect(writeEmergencySessionTraceSync({ ...long, message: 'updated' }, store)).toBe(true);
    const deduped = readEmergencySessionTrace(store);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].message).toBe('updated');

    clearEmergencySessionTrace(store);
    expect(readEmergencySessionTrace(store)).toEqual([]);
    expect(writeEmergencySessionTraceSync(long, null)).toBe(false);
  });

  it('ignores a corrupt trace blob', () => {
    const store = {
      getItem: () => 'not json',
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(readEmergencySessionTrace(store)).toEqual([]);
  });
});
