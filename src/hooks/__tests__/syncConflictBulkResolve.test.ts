import { describe, expect, it, vi } from 'vitest';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import type { SyncConflictEntry } from '../../domain/syncOutbox';
import type { SyncConflictResolutionDeps } from '../barnStore/useSyncConflictResolution';
import { resolveAllSyncConflictsAction } from '../barnStore/useSyncConflictResolution';

const conflict = (id: string, resolved = false): SyncConflictEntry =>
  ({
    conflict_id: id,
    entity_type: 'animal',
    entity_uuid: `animal-${id}`,
    entity_label: `Animal ${id}`,
    field_name: 'name',
    winning_value: 'winner',
    winning_device_id: 'dev-2',
    winning_timestamp: '2026-05-01T00:00:00.000Z',
    losing_value: 'loser',
    losing_device_id: 'dev-1',
    losing_timestamp: '2026-05-02T00:00:00.000Z',
    detected_at: '2026-05-03T00:00:00.000Z',
    resolved,
  }) as SyncConflictEntry;

function makeDeps(conflicts: SyncConflictEntry[]) {
  const snapshot = { animals: [] } as unknown as BarnDatabaseSnapshot;
  const nextSnapshot = { animals: [], replaced: true } as unknown as BarnDatabaseSnapshot;
  const mergedOperations = [{ op_id: 'merged' }];
  const createOperation = vi.fn((args: Record<string, unknown>) => ({ op_id: `op-${args.entityUuid}` }));
  const mergeOperations = vi.fn(() => ({ nextSnapshot, mergedOperations }));

  const deps: SyncConflictResolutionDeps = {
    enqueueStoreMutation: vi.fn(async (fn: () => Promise<unknown>) => fn()) as unknown as <
      T,
    >(
      fn: () => Promise<T>
    ) => Promise<T>,
    snapshotRef: { current: snapshot },
    syncConflicts: conflicts,
    setSyncConflicts: vi.fn(),
    syncOperationsRef: { current: [] },
    syncOperationsHydratedRef: { current: true },
    setSyncOperations: vi.fn(),
    deviceId: 'dev-1',
    allocateNextLogicalCounter: vi.fn(() => 1),
    nextEntityRev: vi.fn(() => 2),
    nowIsoUtc: vi.fn(() => '2026-05-04T00:00:00.000Z'),
    loadSyncOperations: vi.fn(async () => []),
    replaceSnapshot: vi.fn(async () => undefined),
    replaceSyncOperations: vi.fn(async () => undefined),
    rebuildMaxRevIndex: vi.fn(),
    saveConflict: vi.fn(async () => undefined),
    reloadFromAdapter: vi.fn(async () => undefined),
    notify: vi.fn(),
    reportPersistenceFailure: vi.fn(),
    engine: { createOperation, mergeOperations } as unknown as SyncConflictResolutionDeps['engine'],
  };
  return { deps, createOperation, mergeOperations };
}

describe('resolveAllSyncConflictsAction', () => {
  it('merges every open conflict in a single pass', async () => {
    const { deps, createOperation, mergeOperations } = makeDeps([
      conflict('a'),
      conflict('b'),
      conflict('c', true),
    ]);

    const count = await resolveAllSyncConflictsAction(deps, 'losing');

    expect(count).toBe(2);
    expect(createOperation).toHaveBeenCalledTimes(2);
    expect(mergeOperations).toHaveBeenCalledTimes(1);
    expect(deps.saveConflict).toHaveBeenCalledTimes(2);
    expect(deps.replaceSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.notify).toHaveBeenCalledWith('Applied losing values for 2 sync conflicts.');
  });

  it('uses the chosen side for every operation', async () => {
    const { deps, createOperation } = makeDeps([conflict('a')]);
    await resolveAllSyncConflictsAction(deps, 'winning');
    expect(createOperation.mock.calls[0][0]).toMatchObject({ newValue: 'winner' });
  });

  it('does nothing and says so when there is nothing open', async () => {
    const { deps, mergeOperations } = makeDeps([conflict('a', true)]);
    const count = await resolveAllSyncConflictsAction(deps, 'winning');
    expect(count).toBe(0);
    expect(mergeOperations).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith('No open sync conflicts to resolve.');
  });

  it('reports a failure instead of claiming conflicts were applied', async () => {
    const { deps, mergeOperations } = makeDeps([conflict('a')]);
    mergeOperations.mockImplementationOnce(() => {
      throw new Error('merge failed');
    });
    const count = await resolveAllSyncConflictsAction(deps, 'winning');
    expect(count).toBe(0);
    expect(deps.reportPersistenceFailure).toHaveBeenCalledWith(
      'resolve all sync conflicts',
      expect.any(Error)
    );
    expect(deps.notify).not.toHaveBeenCalled();
  });
});
