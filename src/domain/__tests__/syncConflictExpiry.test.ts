import { describe, expect, it } from 'vitest';
import type { SyncConflictEntry } from '../syncOutbox';
import {
  DEFAULT_SYNC_CONFLICT_RETENTION_DAYS,
  planSyncConflictRetention,
} from '../syncConflictExpiry';

const conflict = (over: Partial<SyncConflictEntry> = {}): SyncConflictEntry =>
  ({
    conflict_id: 'c1',
    entity_type: 'animal',
    entity_uuid: 'a1',
    entity_label: 'Doe',
    field_name: 'name',
    winning_value: 'a',
    winning_device_id: 'dev-2',
    winning_timestamp: '2026-01-01T00:00:00.000Z',
    losing_value: 'b',
    losing_device_id: 'dev-1',
    losing_timestamp: '2026-01-02T00:00:00.000Z',
    detected_at: '2026-01-03T00:00:00.000Z',
    resolved: true,
    ...over,
  }) as SyncConflictEntry;

const NOW = '2026-06-01T00:00:00.000Z';

describe('planSyncConflictRetention', () => {
  it('never expires an unresolved conflict, however old', () => {
    const unresolved = conflict({ conflict_id: 'open', resolved: false, detected_at: '2020-01-01T00:00:00.000Z' });
    const plan = planSyncConflictRetention([unresolved], NOW);
    expect(plan.expired).toEqual([]);
    expect(plan.kept).toEqual([unresolved]);
  });

  it('expires a resolved conflict older than the window', () => {
    const old = conflict({ conflict_id: 'old', detected_at: '2026-01-01T00:00:00.000Z' });
    const plan = planSyncConflictRetention([old], NOW);
    expect(plan.expired.map((c) => c.conflict_id)).toEqual(['old']);
    expect(plan.kept).toEqual([]);
  });

  it('keeps a recently resolved conflict', () => {
    const recent = conflict({ conflict_id: 'recent', detected_at: '2026-05-25T00:00:00.000Z' });
    const plan = planSyncConflictRetention([recent], NOW);
    expect(plan.expired).toEqual([]);
    expect(plan.kept).toHaveLength(1);
  });

  it('preserves the input order of survivors', () => {
    const a = conflict({ conflict_id: 'a', detected_at: '2026-05-30T00:00:00.000Z' });
    const b = conflict({ conflict_id: 'b', detected_at: '2026-05-29T00:00:00.000Z' });
    const plan = planSyncConflictRetention([a, b], NOW);
    expect(plan.kept.map((c) => c.conflict_id)).toEqual(['a', 'b']);
  });

  it('treats an unparseable timestamp as recent, not ancient', () => {
    const broken = conflict({ conflict_id: 'broken', detected_at: 'not-a-date' });
    const plan = planSyncConflictRetention([broken], NOW);
    expect(plan.expired).toEqual([]);
    expect(plan.kept).toHaveLength(1);
  });

  it('is a no-op for an empty log, a disabled window or a bad clock', () => {
    expect(planSyncConflictRetention([], NOW)).toEqual({ kept: [], expired: [] });
    const entry = conflict();
    expect(planSyncConflictRetention([entry], NOW, 0).expired).toEqual([]);
    expect(planSyncConflictRetention([entry], 'nonsense').expired).toEqual([]);
    expect(DEFAULT_SYNC_CONFLICT_RETENTION_DAYS).toBe(30);
  });
});
