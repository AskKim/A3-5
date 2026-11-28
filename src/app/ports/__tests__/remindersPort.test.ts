// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  browserRemindersPort,
  getRemindersPort,
  resetRemindersPort,
  setRemindersPort,
  type RemindersPort,
} from '../reminders';
import {
  loadReminderState,
  resetReminderSchedulerForTests,
  setRemindersEnabled,
} from '../../../storage/reminderScheduler';

const settings = { fireHour: 9, horizonDays: 7, graceDays: 1 };
const NOW = '2026-03-01T10:00:00.000Z';

beforeEach(() => {
  resetRemindersPort();
  resetReminderSchedulerForTests();
  vi.unstubAllGlobals();
});

afterEach(() => {
  resetRemindersPort();
  resetReminderSchedulerForTests();
  vi.unstubAllGlobals();
});

describe('browserRemindersPort', () => {
  it('composes the feature schedule with storage delivery', async () => {
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() });
    const showNotification = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ showNotification }) },
    });
    setRemindersEnabled(true);

    const result = await browserRemindersPort.runDue({
      nowIso: NOW,
      settings,
      tasks: [{ id: 'task-1', title: 'Check water', dueDateIso: '2026-03-01', completed: false }],
    });

    expect(result.scheduled).toHaveLength(1);
    expect(result.scheduled[0]?.key).toBe('task-1@2026-03-01#0');
    expect(result.delivered).toEqual(['task-1@2026-03-01#0']);
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(loadReminderState().deliveredKeys).toEqual(['task-1@2026-03-01#0']);
  });

  it('returns the schedule even when nothing may be delivered', async () => {
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() });
    const result = await browserRemindersPort.runDue({
      nowIso: NOW,
      settings,
      milestones: [
        { id: 'm14', anchorDateIso: '2026-02-20', offsetDays: 14, title: 'Check A' },
      ],
    });
    expect(result.scheduled).toHaveLength(1);
    expect(result.delivered).toEqual([]);
    expect(result.permission).toBe('denied');
  });

  it('honours a persisted snooze without a second reminder entry', async () => {
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() });
    const showNotification = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ showNotification }) },
    });
    setRemindersEnabled(true);
    browserRemindersPort.snooze('task-1@2026-03-01#0', '2026-03-01T18:00:00.000Z');

    const result = await browserRemindersPort.runDue({
      nowIso: NOW,
      settings,
      tasks: [{ id: 'task-1', title: 'Check water', dueDateIso: '2026-03-01', completed: false }],
    });

    expect(result.scheduled).toHaveLength(1);
    expect(result.scheduled[0]?.fireAtIso).toBe('2026-03-01T18:00:00.000Z');
    expect(result.delivered).toEqual([]);
  });
});

describe('reminders port injection', () => {
  it('swaps and restores the active port', () => {
    const fake: RemindersPort = {
      loadState: () => ({ enabled: true, snoozes: [], deliveredKeys: [] }),
      getPermission: () => 'granted',
      requestPermission: async () => 'granted',
      setEnabled: () => ({ enabled: true, snoozes: [], deliveredKeys: [] }),
      snooze: () => ({ enabled: true, snoozes: [], deliveredKeys: [] }),
      runDue: async () => ({ delivered: [], skipped: 0, permission: 'granted', scheduled: [] }),
    };
    expect(setRemindersPort(fake)).toBe(browserRemindersPort);
    expect(getRemindersPort()).toBe(fake);
    resetRemindersPort();
    expect(getRemindersPort()).toBe(browserRemindersPort);
  });
});
