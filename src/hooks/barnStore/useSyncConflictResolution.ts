/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Sync-conflict resolution, extracted from `useBarnStore` as a sub-hook.
 *
 * Resolve is the loud sibling of dismiss: it turns the chosen side into an outbox operation, merges
 * that operation into the snapshot and the persisted operation log, then marks the conflict resolved.
 * It shares `buildResolvedSyncConflict` / `markSyncConflictResolved` with dismissal so both cleared
 * paths produce the same record, and it runs inside `enqueueStoreMutation` because it rewrites the
 * snapshot and the op log together.
 *
 * Ownership split: the store keeps `syncConflicts`, the sync-operation refs, the revision index and
 * the adapter. The pure sync engine is a port (`SYNC_RESOLUTION_ENGINE` by default) so tests can
 * assert the exact operation that would be created without running a real merge.
 */
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import {
  createOutboxOperation,
  mergeDeltaOperations,
  type SyncConflictEntry,
  type SyncOperation,
} from '../../domain/syncOutbox';
import {
  buildResolvedSyncConflict,
  markSyncConflictResolved,
} from './useSyncConflictDismissal';

/** The pure sync primitives resolution calls. */
export interface SyncResolutionEngine {
  createOperation: typeof createOutboxOperation;
  mergeOperations: typeof mergeDeltaOperations;
}

export const SYNC_RESOLUTION_ENGINE: SyncResolutionEngine = {
  createOperation: createOutboxOperation,
  mergeOperations: mergeDeltaOperations,
};

export type SyncConflictSide = 'winning' | 'losing';

export interface SyncConflictResolutionDeps {
  enqueueStoreMutation: <T>(task: () => Promise<T>) => Promise<T>;
  snapshotRef: { current: BarnDatabaseSnapshot | null };
  syncConflicts: readonly SyncConflictEntry[];
  setSyncConflicts: Dispatch<SetStateAction<SyncConflictEntry[]>>;
  syncOperationsRef: { current: SyncOperation[] };
  syncOperationsHydratedRef: { current: boolean };
  setSyncOperations: Dispatch<SetStateAction<SyncOperation[]>>;
  deviceId: string;
  allocateNextLogicalCounter: () => number;
  nextEntityRev: (entityUuid: string, currentRev?: number) => number;
  nowIsoUtc: () => string;
  loadSyncOperations: () => Promise<SyncOperation[]>;
  replaceSnapshot: (snapshot: BarnDatabaseSnapshot) => Promise<void>;
  replaceSyncOperations: (operations: SyncOperation[]) => Promise<unknown>;
  rebuildMaxRevIndex: (operations: SyncOperation[]) => void;
  saveConflict: (conflict: SyncConflictEntry) => Promise<unknown>;
  reloadFromAdapter: () => Promise<void>;
  notify: (message: string) => void;
  reportPersistenceFailure: (action: string, error: unknown) => void;
  /** Test seam; production leaves this unset to use the real sync engine. */
  engine?: SyncResolutionEngine;
}

/** Apply the chosen side of one conflict, then mark it resolved. */
export async function resolveSyncConflictAction(
  deps: SyncConflictResolutionDeps,
  conflictId: string,
  useSide: SyncConflictSide
): Promise<void> {
  return deps.enqueueStoreMutation(async () => {
    const currentSnapshot = deps.snapshotRef.current;
    if (!currentSnapshot) return;
    const conflict = deps.syncConflicts.find((c) => c.conflict_id === conflictId);
    if (!conflict) return;

    try {
      const engine = deps.engine ?? SYNC_RESOLUTION_ENGINE;
      const chosenValue = useSide === 'winning' ? conflict.winning_value : conflict.losing_value;
      const op = engine.createOperation({
        entityType: conflict.entity_type,
        entityUuid: conflict.entity_uuid,
        deviceId: deps.deviceId,
        logicalCounter: deps.allocateNextLogicalCounter(),
        fieldName: conflict.field_name,
        newValue: chosenValue,
        timestamp: deps.nowIsoUtc(),
        recordRev: deps.nextEntityRev(conflict.entity_uuid),
      });

      const baseOps = deps.syncOperationsHydratedRef.current
        ? deps.syncOperationsRef.current
        : await deps.loadSyncOperations();
      const applied = engine.mergeOperations(currentSnapshot, baseOps, [op], deps.deviceId);
      await deps.replaceSnapshot(applied.nextSnapshot);
      await deps.replaceSyncOperations(applied.mergedOperations);
      deps.rebuildMaxRevIndex(applied.mergedOperations);
      if (deps.syncOperationsHydratedRef.current) {
        deps.syncOperationsRef.current = applied.mergedOperations;
        deps.setSyncOperations(applied.mergedOperations);
      }

      const resolvedConflict = buildResolvedSyncConflict(conflict);
      await deps.saveConflict(resolvedConflict);
      deps.setSyncConflicts((prev) => markSyncConflictResolved(prev, resolvedConflict));
      await deps.reloadFromAdapter();
      deps.notify(`Applied chosen value for ${conflict.entity_label} (${conflict.field_name}).`);
    } catch (err) {
      deps.reportPersistenceFailure('resolve sync conflict', err);
    }
  });
}

export interface SyncConflictResolution {
  resolveSyncConflict: (conflictId: string, useSide: SyncConflictSide) => Promise<void>;
  resolveAllSyncConflicts: (useSide: SyncConflictSide) => Promise<number>;
}

/**
 * Apply the chosen side for every open conflict in one merge.
 *
 * Resolving conflicts one at a time rewrites the snapshot and the whole operation log once per
 * conflict, so clearing a review queue of twenty is twenty full merges. This builds every operation
 * first, merges once, then marks each conflict resolved. Returns how many were resolved.
 */
export async function resolveAllSyncConflictsAction(
  deps: SyncConflictResolutionDeps,
  useSide: SyncConflictSide
): Promise<number> {
  return deps.enqueueStoreMutation(async () => {
    const currentSnapshot = deps.snapshotRef.current;
    const open = deps.syncConflicts.filter((c) => !c.resolved);
    if (!currentSnapshot || open.length === 0) {
      deps.notify('No open sync conflicts to resolve.');
      return 0;
    }

    try {
      const engine = deps.engine ?? SYNC_RESOLUTION_ENGINE;
      const ts = deps.nowIsoUtc();
      const ops = open.map((conflict) =>
        engine.createOperation({
          entityType: conflict.entity_type,
          entityUuid: conflict.entity_uuid,
          deviceId: deps.deviceId,
          logicalCounter: deps.allocateNextLogicalCounter(),
          fieldName: conflict.field_name,
          newValue: useSide === 'winning' ? conflict.winning_value : conflict.losing_value,
          timestamp: ts,
          recordRev: deps.nextEntityRev(conflict.entity_uuid),
        })
      );

      const baseOps = deps.syncOperationsHydratedRef.current
        ? deps.syncOperationsRef.current
        : await deps.loadSyncOperations();
      const applied = engine.mergeOperations(currentSnapshot, baseOps, ops, deps.deviceId);
      await deps.replaceSnapshot(applied.nextSnapshot);
      await deps.replaceSyncOperations(applied.mergedOperations);
      deps.rebuildMaxRevIndex(applied.mergedOperations);
      if (deps.syncOperationsHydratedRef.current) {
        deps.syncOperationsRef.current = applied.mergedOperations;
        deps.setSyncOperations(applied.mergedOperations);
      }

      const resolvedConflicts = open.map((conflict) => buildResolvedSyncConflict(conflict));
      for (const resolvedConflict of resolvedConflicts) {
        await deps.saveConflict(resolvedConflict);
      }
      deps.setSyncConflicts((prev) =>
        resolvedConflicts.reduce(
          (acc, resolvedConflict) => markSyncConflictResolved(acc, resolvedConflict),
          prev
        )
      );
      await deps.reloadFromAdapter();
      deps.notify(
        `Applied ${useSide} values for ${resolvedConflicts.length} sync conflict${
          resolvedConflicts.length === 1 ? '' : 's'
        }.`
      );
      return resolvedConflicts.length;
    } catch (err) {
      deps.reportPersistenceFailure('resolve all sync conflicts', err);
      return 0;
    }
  });
}

export function useSyncConflictResolution(
  deps: SyncConflictResolutionDeps
): SyncConflictResolution {
  const {
    enqueueStoreMutation,
    snapshotRef,
    syncConflicts,
    setSyncConflicts,
    syncOperationsRef,
    syncOperationsHydratedRef,
    setSyncOperations,
    deviceId,
    allocateNextLogicalCounter,
    nextEntityRev,
    nowIsoUtc,
    loadSyncOperations,
    replaceSnapshot,
    replaceSyncOperations,
    rebuildMaxRevIndex,
    saveConflict,
    reloadFromAdapter,
    notify,
    reportPersistenceFailure,
    engine,
  } = deps;

  const resolveSyncConflict = useCallback(
    (conflictId: string, useSide: SyncConflictSide) =>
      resolveSyncConflictAction(
        {
          enqueueStoreMutation,
          snapshotRef,
          syncConflicts,
          setSyncConflicts,
          syncOperationsRef,
          syncOperationsHydratedRef,
          setSyncOperations,
          deviceId,
          allocateNextLogicalCounter,
          nextEntityRev,
          nowIsoUtc,
          loadSyncOperations,
          replaceSnapshot,
          replaceSyncOperations,
          rebuildMaxRevIndex,
          saveConflict,
          reloadFromAdapter,
          notify,
          reportPersistenceFailure,
          engine,
        },
        conflictId,
        useSide
      ),
    [
      enqueueStoreMutation,
      snapshotRef,
      syncConflicts,
      setSyncConflicts,
      syncOperationsRef,
      syncOperationsHydratedRef,
      setSyncOperations,
      deviceId,
      allocateNextLogicalCounter,
      nextEntityRev,
      nowIsoUtc,
      loadSyncOperations,
      replaceSnapshot,
      replaceSyncOperations,
      rebuildMaxRevIndex,
      saveConflict,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
      engine,
    ]
  );

  const resolveAllSyncConflicts = useCallback(
    (useSide: SyncConflictSide) =>
      resolveAllSyncConflictsAction(
        {
          enqueueStoreMutation,
          snapshotRef,
          syncConflicts,
          setSyncConflicts,
          syncOperationsRef,
          syncOperationsHydratedRef,
          setSyncOperations,
          deviceId,
          allocateNextLogicalCounter,
          nextEntityRev,
          nowIsoUtc,
          loadSyncOperations,
          replaceSnapshot,
          replaceSyncOperations,
          rebuildMaxRevIndex,
          saveConflict,
          reloadFromAdapter,
          notify,
          reportPersistenceFailure,
          engine,
        },
        useSide
      ),
    [
      enqueueStoreMutation,
      snapshotRef,
      syncConflicts,
      setSyncConflicts,
      syncOperationsRef,
      syncOperationsHydratedRef,
      setSyncOperations,
      deviceId,
      allocateNextLogicalCounter,
      nextEntityRev,
      nowIsoUtc,
      loadSyncOperations,
      replaceSnapshot,
      replaceSyncOperations,
      rebuildMaxRevIndex,
      saveConflict,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
      engine,
    ]
  );

  return { resolveSyncConflict, resolveAllSyncConflicts };
}
