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
import { runDestructiveRestore } from './restoreOrchestrator';

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
  /** Reads back what the adapter committed; enables post-restore row-count verification. */
  readCommittedSnapshot?: () => Promise<BarnDatabaseSnapshot | null>;
  /** Test seam; production leaves this unset to use the real rolling-vault module. */
  storage?: RollingBackupStoragePort;
}

const resolveStorage = (deps: RollingBackupDeps): RollingBackupStoragePort =>
  deps.storage ?? ROLLING_BACKUP_STORAGE_PORT;

async function restoreRollingBackupUnqueued(
  deps: RollingBackupDeps,
  key: string
): Promise<void> {
  await runDestructiveRestore(
    {
      snapshotRef: deps.snapshotRef,
      wipedRecoveryDetected: deps.wipedRecoveryDetected,
      saveSafetyRollingBackup: deps.saveSafetyRollingBackup,
      clearPhotoCache: deps.clearPhotoCache,
      replaceSnapshot: deps.replaceSnapshot,
      clearLocalSyncAndBackupReminderState: deps.clearLocalSyncAndBackupReminderState,
      clearWipedRecoveryContext: deps.clearWipedRecoveryContext,
      reloadFromAdapter: deps.reloadFromAdapter,
      readCommittedSnapshot: deps.readCommittedSnapshot,
      notify: deps.notify,
      reportPersistenceFailure: deps.reportPersistenceFailure,
    },
    {
      action: 'restore rolling snapshot',
      missingMessage: 'Could not load that rolling backup snapshot.',
      safetyNote: 'Pre-rolling-restore safety snapshot',
      verifyRowCounts: true,
      successMessage: ({ snapshot }) =>
        `Restored rolling snapshot (${snapshot.animals.length} animals).`,
    },
    async () => {
      const snap = await resolveStorage(deps).loadRollingSnapshotBackup(key);
      return snap ? { snapshot: snap } : null;
    }
  );
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
    readCommittedSnapshot,
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
    readCommittedSnapshot,
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
      readCommittedSnapshot,
      storage,
    ]
  );

  const deleteRollingIdbBackupByKey = useCallback(
    (key: string) => deleteRollingBackupAction(actionDeps, key),
    [refreshVaultAndArchives, notify, storage]
  );

  return { restoreRollingBackupByKey, deleteRollingIdbBackupByKey };
}
