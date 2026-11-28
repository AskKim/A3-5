/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import {
  addReminderDaysIso,
  buildReminderSchedule,
  parseReminderYmd,
  type ReminderScheduleSettings,
} from '@features/reminders';

const NOW = '2026-03-01T00:00:00.000Z';

const settings = (overrides: Partial<ReminderScheduleSettings> = {}): ReminderScheduleSettings => ({
  fireHour: 9,
  horizonDays: 30,
  graceDays: 0,
  ...overrides,
});

describe('reminderSchedule date helpers', () => {
  it('rejects impossible calendar days instead of rolling them forward', () => {
    expect(parseReminderYmd('2026-02-30')).toBeNull();
    expect(parseReminderYmd('2026-13-01')).toBeNull();
    expect(parseReminderYmd('2026-2-3')).toBeNull();
    expect(parseReminderYmd('')).toBeNull();
    expect(parseReminderYmd('2026-02-28')).toEqual({ year: 2026, month: 2, day: 28 });
  });

  it('crosses month, year and leap-day boundaries with UTC arithmetic', () => {
    expect(addReminderDaysIso('2026-01-20', 14)).toBe('2026-02-03');
    expect(addReminderDaysIso('2025-12-28', 7)).toBe('2026-01-04');
    expect(addReminderDaysIso('2028-02-28', 1)).toBe('2028-02-29');
    expect(addReminderDaysIso('2028-02-29', 1)).toBe('2028-03-01');
    expect(addReminderDaysIso('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('buildReminderSchedule tasks', () => {
  it('fires an incomplete task on its due day at the configured hour', () => {
    const [entry] = buildReminderSchedule({
      nowIso: NOW,
      settings: settings(),
      tasks: [{ id: 'task-1', title: 'Check water', dueDateIso: '2026-03-02', completed: false }],
    });
    expect(entry).toEqual({
      key: 'task-1@2026-03-02#0',
      sourceId: 'task-1',
      title: 'Check water',
      detail: '',
      reminderDateIso: '2026-03-02',
      fireAtIso: '2026-03-02T09:00:00.000Z',
      priority: 'normal',
    });
  });

  it('never reminds for a completed task', () => {
    const entries = buildReminderSchedule({
      nowIso: NOW,
      settings: settings(),
      tasks: [{ id: 'task-1', title: 'Check water', dueDateIso: '2026-03-02', completed: true }],
    });
    expect(entries).toEqual([]);
  });

  it('materialises lead reminders and drops the ones already in the past', () => {
    const entries = buildReminderSchedule({
      nowIso: NOW,
      settings: settings({ defaultLeadDays: [3, 1] }),
      tasks: [{ id: 'task-1', title: 'Check water', dueDateIso: '2026-03-02', completed: false }],
    });
    expect(entries.map((entry) => entry.reminderDateIso)).toEqual(['2026-03-01', '2026-03-02']);
    expect(entries.map((entry) => entry.key)).toEqual([
      'task-1@2026-03-01#1',
      'task-1@2026-03-02#0',
    ]);
  });

  it('prefers per-task lead days, ignores duplicates and negative offsets', () => {
    const entries = buildReminderSchedule({
      nowIso: NOW,
      settings: settings({ defaultLeadDays: [7] }),
      tasks: [
        {
          id: 'task-1',
          title: 'Check water',
          dueDateIso: '2026-03-05',
          completed: false,
          leadDays: [2, 2, -1],
        },
      ],
    });
    expect(entries.map((entry) => entry.reminderDateIso)).toEqual(['2026-03-03', '2026-03-05']);
  });

  it('ignores malformed due dates rather than inventing one', () => {
    const entries = buildReminderSchedule({
      nowIso: NOW,
      settings: settings(),
      tasks: [
        { id: 'bad', title: 'Impossible', dueDateIso: '2026-02-30', completed: false },
        { id: 'empty', title: 'Missing', dueDateIso: '', completed: false },
      ],
    });
    expect(entries).toEqual([]);
  });

  it('keeps a missed reminder inside the grace window and drops the rest', () => {
    const tasks = [
      { id: 'recent', title: 'Recent', dueDateIso: '2026-02-27', completed: false },
      { id: 'stale', title: 'Stale', dueDateIso: '2026-02-20', completed: false },
    ];
    const strict = buildReminderSchedule({ nowIso: NOW, settings: settings(), tasks });
    expect(strict).toEqual([]);
    const lenient = buildReminderSchedule({
      nowIso: NOW,
      settings: settings({ graceDays: 3 }),
      tasks,
    });
    expect(lenient.map((entry) => entry.sourceId)).toEqual(['recent']);
  });

  it('respects the horizon', () => {
    const entries = buildReminderSchedule({
      nowIso: NOW,
      settings: settings({ horizonDays: 10 }),
      tasks: [
        { id: 'soon', title: 'Soon', dueDateIso: '2026-03-05', completed: false },
        { id: 'later', title: 'Later', dueDateIso: '2026-04-05', completed: false },
      ],
    });
    expect(entries.map((entry) => entry.sourceId)).toEqual(['soon']);
  });
});

describe('buildReminderSchedule milestone offsets', () => {
  it('materialises the day-14/28/31/42 marks in order from one anchor', () => {
    const entries = buildReminderSchedule({
      nowIso: '2026-01-01T00:00:00.000Z',
      settings: settings({ horizonDays: 60 }),
      milestones: [
        { id: 'm14', anchorDateIso: '2026-01-01', offsetDays: 14, title: 'Check A' },
        { id: 'm28', anchorDateIso: '2026-01-01', offsetDays: 28, title: 'Prepare B' },
        { id: 'm31', anchorDateIso: '2026-01-01', offsetDays: 31, title: 'Due C' },
        { id: 'm42', anchorDateIso: '2026-01-01', offsetDays: 42, title: 'Wean D' },
      ],
    });
    expect(entries.map((entry) => entry.reminderDateIso)).toEqual([
      '2026-01-15',
      '2026-01-29',
      '2026-02-01',
      '2026-02-12',
    ]);
  });

  it('honours a caller-supplied variance in the offset without any species rule here', () => {
    const base = buildReminderSchedule({
      nowIso: '2026-01-01T00:00:00.000Z',
      settings: settings({ horizonDays: 60 }),
      milestones: [{ id: 'due', anchorDateIso: '2026-01-01', offsetDays: 31, title: 'Due' }],
    });
    const shifted = buildReminderSchedule({
      nowIso: '2026-01-01T00:00:00.000Z',
      settings: settings({ horizonDays: 60 }),
      milestones: [{ id: 'due', anchorDateIso: '2026-01-01', offsetDays: 35, title: 'Due' }],
    });
    expect(base[0]?.reminderDateIso).toBe('2026-02-01');
    expect(shifted[0]?.reminderDateIso).toBe('2026-02-05');
  });

  it('applies lead days relative to the offset milestone, not the anchor', () => {
    const entries = buildReminderSchedule({
      nowIso: '2026-01-01T00:00:00.000Z',
      settings: settings({ horizonDays: 60 }),
      milestones: [
        {
          id: 'm31',
          anchorDateIso: '2026-01-01',
          offsetDays: 31,
          title: 'Due',
          leadDays: [2],
        },
      ],
    });
    expect(entries.map((entry) => entry.reminderDateIso)).toEqual(['2026-01-30', '2026-02-01']);
  });
});

describe('buildReminderSchedule watermark, snooze and ordering', () => {
  it('never re-fires a key that is already in the watermark', () => {
    const entries = buildReminderSchedule({
      nowIso: NOW,
      settings: settings(),
      tasks: [{ id: 'task-1', title: 'Check water', dueDateIso: '2026-03-02', completed: false }],
      watermark: { deliveredKeys: ['task-1@2026-03-02#0'] },
    });
    expect(entries).toEqual([]);
  });

  it('defers a snoozed reminder to its wake time while keeping its identity', () => {
    const [entry] = buildReminderSchedule({
      nowIso: NOW,
      settings: settings(),
      tasks: [{ id: 'task-1', title: 'Check water', dueDateIso: '2026-03-02', completed: false }],
      snoozes: [{ key: 'task-1@2026-03-02#0', untilIso: '2026-03-02T18:30:00.000Z' }],
    });
    expect(entry?.key).toBe('task-1@2026-03-02#0');
    expect(entry?.fireAtIso).toBe('2026-03-02T18:30:00.000Z');
  });

  it('keeps a snooze that wakes inside the horizon even when the original slot has passed', () => {
    const [entry] = buildReminderSchedule({
      nowIso: NOW,
      settings: settings({ horizonDays: 3 }),
      tasks: [{ id: 'task-1', title: 'Check water', dueDateIso: '2026-02-28', completed: false }],
      snoozes: [{ key: 'task-1@2026-02-28#0', untilIso: '2026-03-02T08:00:00.000Z' }],
    });
    expect(entry?.fireAtIso).toBe('2026-03-02T08:00:00.000Z');
  });

  it('orders deterministically by fire time, then priority, then title', () => {
    const entries = buildReminderSchedule({
      nowIso: NOW,
      settings: settings(),
      tasks: [
        { id: 'a', title: 'Zebra', dueDateIso: '2026-03-02', completed: false, priority: 'low' },
        { id: 'b', title: 'Alpha', dueDateIso: '2026-03-02', completed: false, priority: 'high' },
        { id: 'c', title: 'Later', dueDateIso: '2026-03-03', completed: false },
        { id: 'd', title: 'Beta', dueDateIso: '2026-03-02', completed: false, priority: 'high' },
      ],
    });
    expect(entries.map((entry) => entry.sourceId)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('returns an empty schedule for an unusable clock or fire hour', () => {
    const tasks = [{ id: 'task-1', title: 'Check water', dueDateIso: '2026-03-02', completed: false }];
    expect(buildReminderSchedule({ nowIso: 'not-a-date', settings: settings(), tasks })).toEqual([]);
    expect(
      buildReminderSchedule({ nowIso: NOW, settings: settings({ fireHour: 24 }), tasks })
    ).toEqual([]);
  });
});
