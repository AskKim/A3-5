import { describe, expect, it } from 'vitest';
import type { SyncOperation } from '../../domain/syncOutbox';
import { selectPendingOperationCount } from '../barnStore/syncStateSlice';

const op = (id: string): SyncOperation =>
  ({
    op_id: id,
    entity_type: 'animal',
    entity_uuid: id,
    device_id: 'device-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    logical_counter: 1,
    field_name: '__create__',
    new_value: null,
  }) as SyncOperation;

describe('selectPendingOperationCount', () => {
  it('counts every unwritten outbox row', () => {
    expect(selectPendingOperationCount([op('a'), op('b'), op('c')])).toBe(3);
  });

  it('is zero for an empty outbox', () => {
    expect(selectPendingOperationCount([])).toBe(0);
  });

  it('does not mutate or copy the outbox', () => {
    const outbox = [op('a')];
    expect(selectPendingOperationCount(outbox)).toBe(outbox.length);
    expect(outbox).toHaveLength(1);
  });
});
