import { describe, expect, it } from 'vitest';
import type { SyncOperation } from '../../domain/syncOutbox';
import {
  DEFAULT_SYNC_RETENTION_POLICY,
  planSyncOperationRetention,
} from '../../domain/syncRetention';

const op = (over: Partial<SyncOperation>): SyncOperation =>
  ({
    op_id: `op-${over.logical_counter ?? 0}`,
    entity_type: 'animal',
    entity_uuid: 'a1',
    device_id: 'dev-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    logical_counter: 1,
    field_name: 'name',
    new_value: 'x',
    record_rev: 1,
    ...over,
  }) as SyncOperation;

const now = '2026-06-01T00:00:00.000Z';

describe('planSyncOperationRetention', () => {
  it('leaves a small, recent log completely untouched', () => {
    const ops = [
      op({ logical_counter: 1, timestamp: '2026-05-01T00:00:00.000Z' }),
      op({ logical_counter: 2, timestamp: '2026-05-02T00:00:00.000Z' }),
    ];
    const plan = planSyncOperationRetention(ops, DEFAULT_SYNC_RETENTION_POLICY, now);
    expect(plan.dropped).toEqual([]);
    expect(plan.retained).toHaveLength(2);
  });

  it('drops operations older than the retention window', () => {
    const ops = [
      op({ logical_counter: 1, timestamp: '2025-01-01T00:00:00.000Z' }),
      op({ logical_counter: 2, timestamp: '2026-05-30T00:00:00.000Z' }),
    ];
    const plan = planSyncOperationRetention(ops, DEFAULT_SYNC_RETENTION_POLICY, now);
    expect(plan.dropped.map((o) => o.logical_counter)).toEqual([1]);
    expect(plan.retained.map((o) => o.logical_counter)).toEqual([2]);
  });

  it('enforces the cap by dropping the oldest operations', () => {
    const ops = [
      op({ logical_counter: 3, timestamp: '2026-05-03T00:00:00.000Z' }),
      op({ logical_counter: 1, timestamp: '2026-05-01T00:00:00.000Z' }),
      op({ logical_counter: 2, timestamp: '2026-05-02T00:00:00.000Z' }),
    ];
    const plan = planSyncOperationRetention(
      ops,
      { maxOperations: 2, retentionDays: 365 },
      now
    );
    expect(plan.retained.map((o) => o.logical_counter).sort()).toEqual([2, 3]);
    expect(plan.dropped.map((o) => o.logical_counter)).toEqual([1]);
  });

  it('orders by timestamp first and counter second, so clock ties cannot invert age', () => {
    const ops = [
      op({ logical_counter: 9, timestamp: '2026-05-01T00:00:00.000Z' }),
      op({ logical_counter: 2, timestamp: '2026-05-01T00:00:00.000Z' }),
    ];
    const plan = planSyncOperationRetention(ops, { maxOperations: 1, retentionDays: 365 }, now);
    expect(plan.retained.map((o) => o.logical_counter)).toEqual([9]);
    expect(plan.dropped.map((o) => o.logical_counter)).toEqual([2]);
  });

  it('is a no-op for an empty log', () => {
    expect(planSyncOperationRetention([], DEFAULT_SYNC_RETENTION_POLICY, now)).toEqual({
      retained: [],
      dropped: [],
    });
  });

  it('never treats an unparseable timestamp as ancient', () => {
    const ops = [
      op({ logical_counter: 1, timestamp: 'not-a-date' }),
      op({ logical_counter: 2, timestamp: '2026-05-30T00:00:00.000Z' }),
    ];
    const plan = planSyncOperationRetention(ops, DEFAULT_SYNC_RETENTION_POLICY, now);
    expect(plan.dropped).toEqual([]);
    expect(plan.retained).toHaveLength(2);
  });
});
