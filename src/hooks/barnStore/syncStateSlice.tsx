/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Passes sync and backup state down to the screens that need it.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Sync-state slice context — third step of the milestone 5 split.
 *
 * The Import/Export hub was handed the outbox, backup status, storage-protection status and the
 * whole backup-sync/cloud-sync action surface as props it only forwards to the sync and backup
 * panels, so any outbox or cloud-sync change re-rendered the hub. This slice carries that state on
 * its own context and memoises the outbox count the sync panel derives from it.
 *
 * The store still returns all of its keys; this is an additional way in, not a replacement.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { BackupStatusEvaluation } from '../../domain/backupStatus';
import type { CloudSyncProvider, CloudSyncSettings } from '../../domain/cloudAppFolderSync';
import type { SyncOperation } from '../../domain/syncOutbox';
import type { CloudSyncClientState, RunCloudAppFolderSyncResult } from '../../storage/cloudAppFolderSync';
import type { BackupSyncStatus } from '../../storage/localSyncChannels';
import type { OpfsPruneSyncWarning } from '../../storage/opfsStorage';
import type { StorageProtectionStatus } from '../../storage/storageProtection';

/** Outbox rows are unwritten operations, so the pending count is the array length. */
export function selectPendingOperationCount(syncOperations: SyncOperation[]): number {
  return syncOperations.length;
}

export interface SyncStateSliceValue {
  backupStatus: BackupStatusEvaluation | null;
  syncOperations: SyncOperation[];
  /** Memoised length the sync panel would otherwise recompute on every render. */
  pendingOperationCount: number;
  backupSyncStatus: BackupSyncStatus | null;
  pruneSyncWarning: OpfsPruneSyncWarning | null;
  storageStatus: StorageProtectionStatus | null;
  cloudSyncState: CloudSyncClientState | null;
  cloudSyncBusy: boolean;
  onConnectBackupSync?: () => Promise<unknown>;
  onReauthorizeBackupSync?: () => Promise<unknown>;
  onDisconnectBackupSync?: () => Promise<unknown>;
  onSyncVaultToSyncNow?: () => Promise<unknown>;
  onDismissPruneWarning?: () => void;
  onUpdateCloudSyncSettings?: (patch: Partial<CloudSyncSettings>) => void;
  onConnectCloudSyncToken?: (provider: CloudSyncProvider, accessToken: string) => boolean;
  onDisconnectCloudSync?: (provider?: CloudSyncProvider) => void;
  onStartCloudSyncPkce?: (provider: CloudSyncProvider, clientId: string) => Promise<void>;
  onRunManualCloudSyncNow?: () => Promise<RunCloudAppFolderSyncResult>;
  onResetAndRetryCloudSync?: () => Promise<RunCloudAppFolderSyncResult>;
  onDismissCloudCircuitBreakerWarning?: () => void;
}

const SyncStateSliceContext = createContext<SyncStateSliceValue | null>(null);

export type SyncStateSliceProviderProps = Omit<SyncStateSliceValue, 'pendingOperationCount'> & {
  children: ReactNode;
};

export function SyncStateSliceProvider({
  backupStatus,
  syncOperations,
  backupSyncStatus = null,
  pruneSyncWarning = null,
  storageStatus = null,
  cloudSyncState = null,
  cloudSyncBusy = false,
  onConnectBackupSync,
  onReauthorizeBackupSync,
  onDisconnectBackupSync,
  onSyncVaultToSyncNow,
  onDismissPruneWarning,
  onUpdateCloudSyncSettings,
  onConnectCloudSyncToken,
  onDisconnectCloudSync,
  onStartCloudSyncPkce,
  onRunManualCloudSyncNow,
  onResetAndRetryCloudSync,
  onDismissCloudCircuitBreakerWarning,
  children,
}: SyncStateSliceProviderProps) {
  const value = useMemo<SyncStateSliceValue>(
    () => ({
      backupStatus,
      syncOperations,
      pendingOperationCount: selectPendingOperationCount(syncOperations),
      backupSyncStatus,
      pruneSyncWarning,
      storageStatus,
      cloudSyncState,
      cloudSyncBusy,
      onConnectBackupSync,
      onReauthorizeBackupSync,
      onDisconnectBackupSync,
      onSyncVaultToSyncNow,
      onDismissPruneWarning,
      onUpdateCloudSyncSettings,
      onConnectCloudSyncToken,
      onDisconnectCloudSync,
      onStartCloudSyncPkce,
      onRunManualCloudSyncNow,
      onResetAndRetryCloudSync,
      onDismissCloudCircuitBreakerWarning,
    }),
    [
      backupStatus,
      syncOperations,
      backupSyncStatus,
      pruneSyncWarning,
      storageStatus,
      cloudSyncState,
      cloudSyncBusy,
      onConnectBackupSync,
      onReauthorizeBackupSync,
      onDisconnectBackupSync,
      onSyncVaultToSyncNow,
      onDismissPruneWarning,
      onUpdateCloudSyncSettings,
      onConnectCloudSyncToken,
      onDisconnectCloudSync,
      onStartCloudSyncPkce,
      onRunManualCloudSyncNow,
      onResetAndRetryCloudSync,
      onDismissCloudCircuitBreakerWarning,
    ]
  );
  return (
    <SyncStateSliceContext.Provider value={value}>{children}</SyncStateSliceContext.Provider>
  );
}

export function useSyncStateSlice(): SyncStateSliceValue {
  const value = useContext(SyncStateSliceContext);
  if (!value) {
    throw new Error('useSyncStateSlice must be used inside <SyncStateSliceProvider>.');
  }
  return value;
}
