import { describe, expect, it, vi } from 'vitest';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import type { SyncConflictEntry, SyncOperation } from '../../domain/syncOutbox';
import {
  resolveSyncConflictAction,
  type SyncConflictResolutionDeps,
} from '../barnStore/useSyncConflictResolution';

const snapshot = { animals: [] } as unknown as BarnDatabaseSnapshot;

const conflict = (over: Partial<SyncConflictEntry> = {}): SyncConflictEntry =>
  ({
    conflict_id: 'c1',
    entity_type: 'animal',
    entity_uuid: 'u1',
    entity_label: 'Doe #12',
    field_name: 'weight',
    winning_value: '4.2',
    losing_value: '3.9',
    resolved: false,
    ...over,
  }) as SyncConflictEntry;

const op = (id: string) => ({ op_id: id } as unknown as SyncOperation);

function makeDeps(over: Partial<SyncConflictResolutionDeps> = {}) {
  const calls: string[] = [];
  const applied = {
    nextSnapshot: { animals: [{ id: 'applied' }] } as unknown as BarnDatabaseSnapshot,
    mergedOperations: [op('m1'), op('m2')],
  };
  const createOperation = vi.fn((params: Record<string, unknown>) => {
    calls.push(`op:${String(params.fieldName)}:${String(params.newValue)}`);
    return op('new');
  });
  const mergeOperations = vi.fn(() => {
    calls.push('merge');
    return applied;
  });
  const deps: SyncConflictResolutionDeps = {
    enqueueStoreMutation: (async (task: () => Promise<unknown>) => {
      calls.push('enqueue');
      return task();
    }) as unknown as <T>(task: () => Promise<T>) => Promise<T>,
    snapshotRef: { current: snapshot },
    syncConflicts: [conflict()],
    setSyncConflicts: vi.fn((update: unknown) => {
      calls.push('setConflicts');
      if (typeof update === 'function') {
        (update as (prev: SyncConflictEntry[]) => SyncConflictEntry[])([conflict()]);
      }
    }) as unknown as SyncConflictResolutionDeps['setSyncConflicts'],
    syncOperationsRef: { current: [op('ref1')] },
    syncOperationsHydratedRef: { current: true },
    setSyncOperations: vi.fn(() => {
      calls.push('setOps');
    }) as unknown as SyncConflictResolutionDeps['setSyncOperations'],
    deviceId: 'dev-1',
    allocateNextLogicalCounter: vi.fn(() => 41),
    nextEntityRev: vi.fn(() => 7),
    nowIsoUtc: vi.fn(() => '2026-01-01T00:00:00.000Z'),
    loadSyncOperations: vi.fn(async () => [op('loaded')]),
    replaceSnapshot: vi.fn(async () => {
      calls.push('replaceSnapshot');
    }),
    replaceSyncOperations: vi.fn(async () => {
      calls.push('replaceOps');
    }),
    rebuildMaxRevIndex: vi.fn(() => {
      calls.push('rebuild');
    }),
    saveConflict: vi.fn(async () => {
      calls.push('saveConflict');
    }),
    reloadFromAdapter: vi.fn(async () => {
      calls.push('reload');
    }),
    notify: vi.fn((m: string) => {
      calls.push(`notify:${m}`);
    }),
    reportPersistenceFailure: vi.fn(),
    engine: { createOperation, mergeOperations } as never,
    ...over,
  };
  return { deps, calls, applied, createOperation, mergeOperations };
}

describe('resolveSyncConflictAction', () => {
  it('applies the winning value through an outbox operation and marks the conflict resolved', async () => {
    const { deps, calls, createOperation, mergeOperations, applied } = makeDeps();

    await resolveSyncConflictAction(deps, 'c1', 'winning');

    expect(createOperation).toHaveBeenCalledWith({
      entityType: 'animal',
      entityUuid: 'u1',
      deviceId: 'dev-1',
      logicalCounter: 41,
      fieldName: 'weight',
      newValue: '4.2',
      timestamp: '2026-01-01T00:00:00.000Z',
      recordRev: 7,
    });
    expect(mergeOperations).toHaveBeenCalledWith(deps.snapshotRef.current, [op('ref1')], [op('new')], 'dev-1');
    expect(deps.replaceSnapshot).toHaveBeenCalledWith(applied.nextSnapshot);
    expect(deps.replaceSyncOperations).toHaveBeenCalledWith(applied.mergedOperations);
    expect(deps.saveConflict).toHaveBeenCalledWith(expect.objectContaining({ conflict_id: 'c1', resolved: true }));
    expect(deps.notify).toHaveBeenCalledWith('Applied chosen value for Doe #12 (weight).');
    expect(calls).toEqual([
      'enqueue',
      'op:weight:4.2',
      'merge',
      'replaceSnapshot',
      'replaceOps',
      'rebuild',
      'setOps',
      'saveConflict',
      'setConflicts',
      'reload',
      'notify:Applied chosen value for Doe #12 (weight).',
    ]);
  });

  it('applies the losing value when that side is chosen', async () => {
    const { deps, createOperation } = makeDeps();
    await resolveSyncConflictAction(deps, 'c1', 'losing');
    expect(createOperation).toHaveBeenCalledWith(expect.objectContaining({ newValue: '3.9' }));
  });

  it('loads the operation log when it is not hydrated yet, and leaves React state alone', async () => {
    const { deps, mergeOperations } = makeDeps({
      syncOperationsHydratedRef: { current: false },
    });

    await resolveSyncConflictAction(deps, 'c1', 'winning');

    expect(deps.loadSyncOperations).toHaveBeenCalledTimes(1);
    expect(mergeOperations).toHaveBeenCalledWith(deps.snapshotRef.current, [op('loaded')], [op('new')], 'dev-1');
    expect(deps.setSyncOperations).not.toHaveBeenCalled();
    expect(deps.syncOperationsRef.current).toEqual([op('ref1')]);
  });

  it('does nothing without a loaded snapshot', async () => {
    const { deps } = makeDeps({ snapshotRef: { current: null } });
    await resolveSyncConflictAction(deps, 'c1', 'winning');
    expect(deps.replaceSnapshot).not.toHaveBeenCalled();
    expect(deps.saveConflict).not.toHaveBeenCalled();
  });

  it('does nothing for an unknown conflict id', async () => {
    const { deps } = makeDeps();
    await resolveSyncConflictAction(deps, 'missing', 'winning');
    expect(deps.replaceSnapshot).not.toHaveBeenCalled();
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it('reports a failure without marking the conflict resolved', async () => {
    const err = new Error('merge failed');
    const { deps } = makeDeps({ replaceSnapshot: vi.fn(async () => Promise.reject(err)) });

    await resolveSyncConflictAction(deps, 'c1', 'winning');

    expect(deps.reportPersistenceFailure).toHaveBeenCalledWith('resolve sync conflict', err);
    expect(deps.saveConflict).not.toHaveBeenCalled();
  });
});
