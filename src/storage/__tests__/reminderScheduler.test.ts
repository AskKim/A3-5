// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deliverDueReminders,
  getReminderPermissionState,
  loadReminderState,
  requestReminderPermission,
  resetReminderSchedulerForTests,
  saveReminderState,
  setRemindersEnabled,
  snoozeReminderEntry,
  type ReminderDeliveryEntry,
} from '../reminderScheduler';

interface FakeNotificationStatics {
  permission: NotificationPermission;
  requestPermission: ReturnType<typeof vi.fn>;
}

function stubNotification(
  permission: NotificationPermission,
  requestResult: NotificationPermission | Promise<NotificationPermission> = permission
): FakeNotificationStatics {
  const requestPermission = vi.fn(async () => requestResult);
  vi.stubGlobal('Notification', { permission, requestPermission });
  return { permission, requestPermission };
}

function stubServiceWorker(showNotification: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ showNotification }) },
  });
}

const entry = (key: string, fireAtIso = '2026-03-01T09:00:00.000Z'): ReminderDeliveryEntry => ({
  key,
  title: `Title ${key}`,
  detail: '',
  fireAtIso,
});

const NOW = '2026-03-01T10:00:00.000Z';

beforeEach(() => {
  resetReminderSchedulerForTests();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetReminderSchedulerForTests();
});

describe('reminder state persistence', () => {
  it('starts disabled with no history', () => {
    expect(loadReminderState()).toEqual({ enabled: false, snoozes: [], deliveredKeys: [] });
  });

  it('survives a malformed payload instead of throwing', () => {
    localStorage.setItem('pedigree.reminders.v1', '{not json');
    expect(loadReminderState().enabled).toBe(false);
    localStorage.setItem('pedigree.reminders.v1', '{"enabled":"yes","snoozes":"x"}');
    expect(loadReminderState()).toEqual({ enabled: false, snoozes: [], deliveredKeys: [] });
  });

  it('persists the opt-in without dropping delivered history', () => {
    saveReminderState({ deliveredKeys: ['a@2026-03-01#0'] });
    expect(setRemindersEnabled(true)).toEqual({
      enabled: true,
      snoozes: [],
      deliveredKeys: ['a@2026-03-01#0'],
    });
    expect(loadReminderState().enabled).toBe(true);
  });

  it('replaces a snooze for the same key and ignores unusable input', () => {
    snoozeReminderEntry('a@2026-03-01#0', '2026-03-01T12:00:00.000Z');
    const state = snoozeReminderEntry('a@2026-03-01#0', '2026-03-01T18:00:00.000Z');
    expect(state.snoozes).toEqual([{ key: 'a@2026-03-01#0', untilIso: '2026-03-01T18:00:00.000Z' }]);
    expect(snoozeReminderEntry('', '2026-03-01T18:00:00.000Z').snoozes).toHaveLength(1);
    expect(snoozeReminderEntry('b', 'nonsense').snoozes).toHaveLength(1);
  });
});

describe('reminder permission', () => {
  it('reports unsupported when the browser has no Notification API', () => {
    vi.stubGlobal('Notification', undefined);
    expect(getReminderPermissionState()).toBe('unsupported');
    return expect(requestReminderPermission()).resolves.toBe('unsupported');
  });

  it('maps the OS decision and never prompts twice', async () => {
    const fake = stubNotification('denied');
    expect(getReminderPermissionState()).toBe('denied');
    await expect(requestReminderPermission()).resolves.toBe('denied');
    expect(fake.requestPermission).not.toHaveBeenCalled();
  });

  it('asks once when the decision is still pending', async () => {
    const fake = stubNotification('default', 'granted');
    await expect(requestReminderPermission()).resolves.toBe('granted');
    expect(fake.requestPermission).toHaveBeenCalledTimes(1);
  });
});

describe('reminder delivery', () => {
  it('is a silent no-op while permission is denied', async () => {
    stubNotification('denied');
    const showNotification = vi.fn();
    stubServiceWorker(showNotification);
    setRemindersEnabled(true);
    const result = await deliverDueReminders([entry('a')], NOW);
    expect(result).toEqual({ delivered: [], skipped: 1, permission: 'denied' });
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('is a silent no-op until the user opts in', async () => {
    stubNotification('granted');
    const showNotification = vi.fn();
    stubServiceWorker(showNotification);
    const result = await deliverDueReminders([entry('a')], NOW);
    expect(result.delivered).toEqual([]);
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('skips delivery while the document is frozen', async () => {
    stubNotification('granted');
    const showNotification = vi.fn();
    stubServiceWorker(showNotification);
    setRemindersEnabled(true);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    const result = await deliverDueReminders([entry('a')], NOW);
    expect(result.skipped).toBe(1);
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('shows only what is due, then never repeats it', async () => {
    stubNotification('granted');
    const showNotification = vi.fn(async () => undefined);
    stubServiceWorker(showNotification);
    setRemindersEnabled(true);
    const entries = [
      entry('due-1'),
      entry('due-2', '2026-03-01T09:30:00.000Z'),
      entry('later', '2026-03-02T09:00:00.000Z'),
    ];
    const first = await deliverDueReminders(entries, NOW);
    expect(first.delivered).toEqual(['due-1', 'due-2']);
    expect(showNotification).toHaveBeenCalledTimes(2);
    expect(showNotification).toHaveBeenCalledWith('Title due-1', {
      body: '',
      tag: 'due-1',
      data: { key: 'due-1', fireAtIso: '2026-03-01T09:00:00.000Z' },
    });
    expect(loadReminderState().deliveredKeys).toEqual(['due-1', 'due-2']);

    const second = await deliverDueReminders(entries, '2026-03-02T10:00:00.000Z');
    expect(second.delivered).toEqual(['later']);
    expect(showNotification).toHaveBeenCalledTimes(3);
  });

  it('keeps going when one notification fails', async () => {
    stubNotification('granted');
    const showNotification = vi
      .fn()
      .mockRejectedValueOnce(new Error('notification blocked'))
      .mockResolvedValue(undefined);
    stubServiceWorker(showNotification);
    setRemindersEnabled(true);
    const result = await deliverDueReminders([entry('a'), entry('b')], NOW);
    expect(result.delivered).toEqual(['b']);
    expect(result.skipped).toBe(1);
    expect(loadReminderState().deliveredKeys).toEqual(['b']);
  });

  it('reports nothing delivered when the service worker is unavailable', async () => {
    stubNotification('granted');
    setRemindersEnabled(true);
    const result = await deliverDueReminders([entry('a')], NOW);
    expect(result).toEqual({ delivered: [], skipped: 1, permission: 'granted' });
  });
});
