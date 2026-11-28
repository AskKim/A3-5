/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The backup vault actions: take a snapshot, describe one, restore it, or delete it.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * OPFS Backup Vault actions, extracted from `useBarnStore` as a sub-hook.
 *
 * Four user-facing operations over the vault: save a manual snapshot, describe a stored backup by
 * key, delete one, and restore one by key. They are the only code that treats the vault as a
 * read/write store rather than as a listing, so they live together with the exact toasts and the
 * fixed order — safety snapshot, cache clear, snapshot replace, sync-state clear, reload — that
 * makes a restore safe to interrupt.
 *
 * Ownership split: the store keeps `opfsVaultBackups`, the storage-adapter ref, the photo cache and
 * the mutation queue. This slice receives them as narrow functions plus an injectable
 * `OpfsVaultStoragePort`, so tests drive every branch without OPFS or IndexedDB.
 */
import { useCallback } from 'react';
import { formatByteSizePure } from '../../domain/imageOptimizationSpec';
import type { VaultBackupMetadata } from '../../domain/backupVault';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import {
  deleteOpfsVaultBackup,
  isOpfsSupported,
  loadOpfsVaultBackup,
  readOpfsVaultBackupBlob,
  saveOpfsVaultBackup,
} from '../../storage/opfsStorage';
import { runDestructiveRestore } from './restoreOrchestrator';
import { saveRollingSnapshotBackup } from '../../storage/storageProtection';
import { downloadBlobDirect } from '../../utils/webFileActions';

/** The OPFS vault + download primitives this slice calls. */
export interface OpfsVaultStoragePort {
  isOpfsSupported: typeof isOpfsSupported;
  saveRollingSnapshotBackup: typeof saveRollingSnapshotBackup;
  saveOpfsVaultBackup: typeof saveOpfsVaultBackup;
  loadOpfsVaultBackup: typeof loadOpfsVaultBackup;
  readOpfsVaultBackupBlob: typeof readOpfsVaultBackupBlob;
  deleteOpfsVaultBackup: typeof deleteOpfsVaultBackup;
  downloadBlobDirect: typeof downloadBlobDirect;
}

export const OPFS_VAULT_STORAGE_PORT: OpfsVaultStoragePort = {
  isOpfsSupported,
  saveRollingSnapshotBackup,
  saveOpfsVaultBackup,
  loadOpfsVaultBackup,
  readOpfsVaultBackupBlob,
  deleteOpfsVaultBackup,
  downloadBlobDirect,
};

/**
 * Describe a stored backup the way the vault list speaks about it: a key may arrive as the entry
 * key or as its file name (restored archives and downloads use both).
 */
export function describeOpfsVaultBackup(
  backups: readonly VaultBackupMetadata[],
  key: string
): VaultBackupMetadata | null {
  return backups.find((backup) => backup.key === key || backup.fileName === key) ?? null;
}

export { stripRestoredBackupBookkeeping } from './restoreOrchestrator';

/** Migration suffix shown after a restore that had to upgrade the file's schema. */
export function formatRestoreMigrationNote(
  migratedFromVersion: number,
  schemaVersion: number
): string {
  return migratedFromVersion < schemaVersion
    ? ` (migrated v${migratedFromVersion} → v${schemaVersion})`
    : '';
}

export interface OpfsVaultDeps {
  notify: (message: string) => void;
  reportPersistenceFailure: (action: string, error: unknown) => void;
  /** React state snapshot, read by save so a manual save captures what the user sees. */
  snapshot: BarnDatabaseSnapshot | null;
  /** Latest committed snapshot, read by restore inside the queued mutation. */
  snapshotRef: { current: BarnDatabaseSnapshot | null };
  wipedRecoveryDetected: boolean;
  opfsVaultBackups: readonly VaultBackupMetadata[];
  hydrateSnapshotForExport: (snapshot: BarnDatabaseSnapshot) => Promise<BarnDatabaseSnapshot>;
  saveSafetyRollingBackup: (snapshot: BarnDatabaseSnapshot, note?: string) => Promise<unknown>;
  mirrorToNativeVault: (snapshot: BarnDatabaseSnapshot) => Promise<unknown>;
  replaceSnapshot: (snapshot: BarnDatabaseSnapshot) => Promise<void>;
  clearPhotoCache: () => void;
  clearLocalSyncAndBackupReminderState: () => Promise<void>;
  clearWipedRecoveryContext: () => void;
  setActiveSpeciesName: (name: string) => void;
  reloadFromAdapter: () => Promise<void>;
  refreshVaultAndArchives: () => Promise<void>;
  refreshStorageStatus: () => void | Promise<unknown>;
  recordBackupExport: (kind: 'json', fileName: string) => Promise<void>;
  enqueueStoreMutation: <T>(task: () => Promise<T>) => Promise<T>;
  /** Reads back what the adapter committed; enables post-restore row-count verification. */
  readCommittedSnapshot?: () => Promise<BarnDatabaseSnapshot | null>;
  /** Test seam; production leaves this unset to use the real OPFS modules. */
  storage?: OpfsVaultStoragePort;
}

const resolveStorage = (deps: OpfsVaultDeps): OpfsVaultStoragePort =>
  deps.storage ?? OPFS_VAULT_STORAGE_PORT;

/**
 * Save a manual vault snapshot. Returns the OPFS metadata when it was written there, or `null`
 * when the browser has no OPFS and the rolling IndexedDB vault is the only destination.
 */
export async function saveManualOpfsVaultBackupAction(
  deps: OpfsVaultDeps,
  note?: string
): Promise<VaultBackupMetadata | null> {
  if (!deps.snapshot) return null;
  try {
    const hydrated = await deps.hydrateSnapshotForExport(deps.snapshot);
    const storage = resolveStorage(deps);
    const [, opfsRes, nativeRes] = await Promise.allSettled([
      storage.saveRollingSnapshotBackup(hydrated),
      storage.isOpfsSupported()
        ? storage.saveOpfsVaultBackup(hydrated, {
            kind: 'manual',
            note: note?.trim() || 'Manual snapshot saved to Vault',
          })
        : Promise.resolve(null),
      deps.mirrorToNativeVault(hydrated),
    ]);
    const meta = opfsRes.status === 'fulfilled' ? opfsRes.value : null;
    const mirroredNative = nativeRes.status === 'fulfilled' && nativeRes.value;
    await deps.refreshVaultAndArchives();
    if (mirroredNative) {
      void deps.refreshStorageStatus();
    }
    if (meta) {
      await deps.recordBackupExport('json', meta.fileName);
      deps.notify(
        `Saved snapshot to OPFS Backup Vault (${meta.animalCount} animals, ${meta.photoCount} photos · ${formatByteSizePure(meta.byteSize)}).`
      );
      return meta;
    }
    await deps.recordBackupExport('json', 'rolling-local-snapshot');
    deps.notify(
      mirroredNative
        ? 'Saved snapshot to IndexedDB Rolling Vault and Native Android Backup Vault.'
        : 'Saved snapshot to IndexedDB Rolling Vault (OPFS directory access is unavailable in this browser).'
    );
    return null;
  } catch (err) {
    deps.reportPersistenceFailure('save snapshot to backup vault', err);
    throw err;
  }
}

/**
 * Restore without touching the mutation queue. Callers that already hold the queue (the
 * wiped-recovery path) use this so the restore never waits on its own lock.
 */
export async function restoreOpfsVaultBackupUnqueued(
  deps: OpfsVaultDeps,
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
      action: 'restore OPFS vault backup',
      missingMessage: 'Could not read or verify that OPFS backup file.',
      safetyNote: 'Pre-vault-restore safety snapshot',
      verifyRowCounts: true,
      verifyChecksum: true,
      afterReplace: (payload) =>
        deps.setActiveSpeciesName(payload.migrated.snapshot.settings.defaultSpecies || 'Rabbit'),
      successMessage: (payload) => {
        const migrated = payload.migrated;
        return `Restored ${migrated.snapshot.animals.length} animals & ${(migrated.snapshot.animalPhotos ?? []).length} photos from OPFS Vault${formatRestoreMigrationNote(
          migrated.migratedFromVersion,
          migrated.schemaVersion
        )}.`;
      },
    },
    async () => {
      const loaded = await resolveStorage(deps).loadOpfsVaultBackup(
        key,
        deps.snapshotRef.current?.settings
      );
      return loaded ? { snapshot: loaded.migrated.snapshot, migrated: loaded.migrated } : null;
    }
  );
}

/** Restore a vault backup, serialised with every other store mutation. */
export function restoreOpfsVaultBackupAction(
  deps: OpfsVaultDeps,
  key: string
): Promise<void> {
  return deps.enqueueStoreMutation(() => restoreOpfsVaultBackupUnqueued(deps, key));
}

/** Download a stored vault backup, preferring the listed file name over the blob's own. */
export async function downloadOpfsVaultBackupAction(
  deps: OpfsVaultDeps,
  key: string
): Promise<void> {
  const storage = resolveStorage(deps);
  const res = await storage.readOpfsVaultBackupBlob(key);
  if (!res) {
    deps.notify('Could not read OPFS vault backup file for download.');
    return;
  }
  const matched = describeOpfsVaultBackup(deps.opfsVaultBackups, key);
  const fileName = matched?.fileName || res.fileName;
  await storage.downloadBlobDirect(fileName, res.blob);
  deps.notify(`Downloaded ${fileName}.`);
}

/** Delete a stored vault backup and refresh the vault listing. */
export async function deleteOpfsVaultBackupAction(
  deps: OpfsVaultDeps,
  key: string
): Promise<void> {
  await resolveStorage(deps).deleteOpfsVaultBackup(key);
  await deps.refreshVaultAndArchives();
  deps.notify('Removed backup from OPFS Vault.');
}

export interface OpfsVaultActions {
  saveManualOpfsVaultBackup: (note?: string) => Promise<VaultBackupMetadata | null>;
  describeOpfsVaultBackup: (key: string) => VaultBackupMetadata | null;
  downloadOpfsVaultBackupByKey: (key: string) => Promise<void>;
  deleteOpfsVaultBackupByKey: (key: string) => Promise<void>;
  restoreOpfsVaultBackup: (key: string) => Promise<void>;
  restoreOpfsVaultBackupUnqueued: (key: string) => Promise<void>;
}

export function useOpfsVaultActions(deps: OpfsVaultDeps): OpfsVaultActions {
  const {
    notify,
    reportPersistenceFailure,
    snapshot,
    snapshotRef,
    wipedRecoveryDetected,
    opfsVaultBackups,
    hydrateSnapshotForExport,
    saveSafetyRollingBackup,
    mirrorToNativeVault,
    replaceSnapshot,
    clearPhotoCache,
    clearLocalSyncAndBackupReminderState,
    clearWipedRecoveryContext,
    setActiveSpeciesName,
    reloadFromAdapter,
    refreshVaultAndArchives,
    refreshStorageStatus,
    recordBackupExport,
    enqueueStoreMutation,
    readCommittedSnapshot,
    storage,
  } = deps;

  const actionDeps: OpfsVaultDeps = {
    notify,
    reportPersistenceFailure,
    snapshot,
    snapshotRef,
    wipedRecoveryDetected,
    opfsVaultBackups,
    hydrateSnapshotForExport,
    saveSafetyRollingBackup,
    mirrorToNativeVault,
    replaceSnapshot,
    clearPhotoCache,
    clearLocalSyncAndBackupReminderState,
    clearWipedRecoveryContext,
    setActiveSpeciesName,
    reloadFromAdapter,
    refreshVaultAndArchives,
    refreshStorageStatus,
    recordBackupExport,
    enqueueStoreMutation,
    readCommittedSnapshot,
    storage,
  };

  const saveManualOpfsVaultBackup = useCallback(
    (note?: string) => saveManualOpfsVaultBackupAction(actionDeps, note),
    [
      snapshot,
      hydrateSnapshotForExport,
      mirrorToNativeVault,
      refreshVaultAndArchives,
      refreshStorageStatus,
      recordBackupExport,
      notify,
      reportPersistenceFailure,
      storage,
    ]
  );

  const describeOpfsVaultBackupByKey = useCallback(
    (key: string) => describeOpfsVaultBackup(opfsVaultBackups, key),
    [opfsVaultBackups]
  );

  const downloadOpfsVaultBackupByKey = useCallback(
    (key: string) => downloadOpfsVaultBackupAction(actionDeps, key),
    [opfsVaultBackups, notify, storage]
  );

  const deleteOpfsVaultBackupByKey = useCallback(
    (key: string) => deleteOpfsVaultBackupAction(actionDeps, key),
    [refreshVaultAndArchives, notify, storage]
  );

  const restoreOpfsVaultBackup = useCallback(
    (key: string) => restoreOpfsVaultBackupAction(actionDeps, key),
    [
      enqueueStoreMutation,
      snapshotRef,
      wipedRecoveryDetected,
      saveSafetyRollingBackup,
      clearPhotoCache,
      replaceSnapshot,
      clearLocalSyncAndBackupReminderState,
      clearWipedRecoveryContext,
      setActiveSpeciesName,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
      storage,
    ]
  );

  const restoreOpfsVaultBackupUnqueuedCallback = useCallback(
    (key: string) => restoreOpfsVaultBackupUnqueued(actionDeps, key),
    [
      snapshotRef,
      wipedRecoveryDetected,
      saveSafetyRollingBackup,
      clearPhotoCache,
      replaceSnapshot,
      clearLocalSyncAndBackupReminderState,
      clearWipedRecoveryContext,
      setActiveSpeciesName,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
      readCommittedSnapshot,
      storage,
    ]
  );

  return {
    saveManualOpfsVaultBackup,
    describeOpfsVaultBackup: describeOpfsVaultBackupByKey,
    downloadOpfsVaultBackupByKey,
    deleteOpfsVaultBackupByKey,
    restoreOpfsVaultBackup,
    restoreOpfsVaultBackupUnqueued: restoreOpfsVaultBackupUnqueuedCallback,
  };
}
