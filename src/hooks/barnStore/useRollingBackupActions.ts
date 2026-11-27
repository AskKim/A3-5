/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Rolling IndexedDB backup actions, extracted from `useBarnStore` as a sub-hook.
 *
 * The rolling vault is the destination the app always has, even when OPFS is missing, so its
 * restore path is the one users can always reach. It mirrors the OPFS restore order minus the
 * species switch and migration note: safety snapshot, photo-cache clear, replace with bookkeeping
 * stripped, sync/reminder clear, reload. Unlike the OPFS path it keeps the currently selected
 * species — the rolling snapshot was written by this same app instance, so the selection is still
 * meaningful.
 */
import { useCallback } from 'react';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import {
  deleteRollingSnapshotBackup,
  loadRollingSnapshotBackup,
} from '../../storage/storageProtection';
import { stripRestoredBackupBookkeeping } from './useOpfsVaultActions';

/** The rolling-vault primitives this slice calls. */
export interface RollingBackupStoragePort {
  loadRollingSnapshotBackup: typeof loadRollingSnapshotBackup;
  deleteRollingSnapshotBackup: typeof deleteRollingSnapshotBackup;
}

export const ROLLING_BACKUP_STORAGE_PORT: RollingBackupStoragePort = {
  loadRollingSnapshotBackup,
  deleteRollingSnapshotBackup,
};

export interface RollingBackupDeps {
  notify: (message: string) => void;
  reportPersistenceFailure: (action: string, error: unknown) => void;
  snapshotRef: { current: BarnDatabaseSnapshot | null };
  wipedRecoveryDetected: boolean;
  saveSafetyRollingBackup: (snapshot: BarnDatabaseSnapshot, note?: string) => Promise<unknown>;
  clearPhotoCache: () => void;
  replaceSnapshot: (snapshot: BarnDatabaseSnapshot) => Promise<void>;
  clearLocalSyncAndBackupReminderState: () => Promise<void>;
  clearWipedRecoveryContext: () => void;
  reloadFromAdapter: () => Promise<void>;
  refreshVaultAndArchives: () => Promise<void>;
  enqueueStoreMutation: <T>(task: () => Promise<T>) => Promise<T>;
  /** Test seam; production leaves this unset to use the real rolling-vault module. */
  storage?: RollingBackupStoragePort;
}

const resolveStorage = (deps: RollingBackupDeps): RollingBackupStoragePort =>
  deps.storage ?? ROLLING_BACKUP_STORAGE_PORT;

async function restoreRollingBackupUnqueued(
  deps: RollingBackupDeps,
  key: string
): Promise<void> {
  const currentSnapshot = deps.snapshotRef.current;
  try {
    const snap = await resolveStorage(deps).loadRollingSnapshotBackup(key);
    if (!snap) {
      deps.notify('Could not load that rolling backup snapshot.');
      return;
    }
    if (currentSnapshot && !deps.wipedRecoveryDetected && currentSnapshot.animals.length > 0) {
      await deps.saveSafetyRollingBackup(currentSnapshot, 'Pre-rolling-restore safety snapshot');
    }
    deps.clearPhotoCache();
    await deps.replaceSnapshot(stripRestoredBackupBookkeeping(snap));
    await deps.clearLocalSyncAndBackupReminderState();
    deps.clearWipedRecoveryContext();
    await deps.reloadFromAdapter();
    deps.notify(`Restored rolling snapshot (${snap.animals.length} animals).`);
  } catch (err) {
    deps.reportPersistenceFailure('restore rolling snapshot', err);
    throw err;
  }
}

/** Restore a rolling snapshot, serialised with every other store mutation. */
export function restoreRollingBackupAction(deps: RollingBackupDeps, key: string): Promise<void> {
  return deps.enqueueStoreMutation(() => restoreRollingBackupUnqueued(deps, key));
}

/** Delete a rolling snapshot and refresh the vault listing. */
export async function deleteRollingBackupAction(
  deps: RollingBackupDeps,
  key: string
): Promise<void> {
  await resolveStorage(deps).deleteRollingSnapshotBackup(key);
  await deps.refreshVaultAndArchives();
  deps.notify('Removed local IndexedDB rolling snapshot.');
}

export interface RollingBackupActions {
  restoreRollingBackupByKey: (key: string) => Promise<void>;
  deleteRollingIdbBackupByKey: (key: string) => Promise<void>;
}

export function useRollingBackupActions(deps: RollingBackupDeps): RollingBackupActions {
  const {
    notify,
    reportPersistenceFailure,
    snapshotRef,
    wipedRecoveryDetected,
    saveSafetyRollingBackup,
    clearPhotoCache,
    replaceSnapshot,
    clearLocalSyncAndBackupReminderState,
    clearWipedRecoveryContext,
    reloadFromAdapter,
    refreshVaultAndArchives,
    enqueueStoreMutation,
    storage,
  } = deps;

  const actionDeps: RollingBackupDeps = {
    notify,
    reportPersistenceFailure,
    snapshotRef,
    wipedRecoveryDetected,
    saveSafetyRollingBackup,
    clearPhotoCache,
    replaceSnapshot,
    clearLocalSyncAndBackupReminderState,
    clearWipedRecoveryContext,
    reloadFromAdapter,
    refreshVaultAndArchives,
    enqueueStoreMutation,
    storage,
  };

  const restoreRollingBackupByKey = useCallback(
    (key: string) => restoreRollingBackupAction(actionDeps, key),
    [
      enqueueStoreMutation,
      snapshotRef,
      wipedRecoveryDetected,
      saveSafetyRollingBackup,
      clearPhotoCache,
      replaceSnapshot,
      clearLocalSyncAndBackupReminderState,
      clearWipedRecoveryContext,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
      storage,
    ]
  );

  const deleteRollingIdbBackupByKey = useCallback(
    (key: string) => deleteRollingBackupAction(actionDeps, key),
    [refreshVaultAndArchives, notify, storage]
  );

  return { restoreRollingBackupByKey, deleteRollingIdbBackupByKey };
}
