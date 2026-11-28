/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Vault slice context — second step of the milestone 5 split.
 *
 * The Import/Export hub was handed four vault collections and five vault actions as props it only
 * forwards to the backup panels, so any vault change re-rendered the whole hub. This slice carries
 * them on their own context and memoises the counts the panels derive from the collections.
 *
 * The store still returns all of its keys; this is an additional way in, not a replacement.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ArchivedHerdIndexEntry, VaultBackupMetadata } from '../../domain/backupVault';
import type { RollingBackupMeta } from '../../storage/storageProtection';

export type PreUpgradeBackupResult = {
  verified: boolean;
  fileName: string;
  checksumSha256: string;
} | null;

export interface VaultSliceValue {
  opfsSupported: boolean;
  opfsVaultBackups: VaultBackupMetadata[];
  rollingBackups: RollingBackupMeta[];
  archivedHerdBundles: ArchivedHerdIndexEntry[];
  /** Counts the backup panels would otherwise recompute on every render. */
  vaultBackupCount: number;
  rollingBackupCount: number;
  archivedBundleCount: number;
  onSaveManualOpfsVaultBackup: (note?: string) => Promise<unknown> | void;
  onCreateVerifiedPreUpgradeBackup: () => Promise<PreUpgradeBackupResult>;
  onRestoreOpfsVaultBackup: (key: string) => Promise<void>;
  onDeleteOpfsVaultBackup: (key: string) => Promise<void>;
  onRestoreRollingBackup: (key: string) => Promise<void>;
}

const VaultSliceContext = createContext<VaultSliceValue | null>(null);

export type VaultSliceProviderProps = Omit<
  VaultSliceValue,
  'vaultBackupCount' | 'rollingBackupCount' | 'archivedBundleCount'
> & { children: ReactNode };

export function VaultSliceProvider({
  opfsSupported,
  opfsVaultBackups,
  rollingBackups,
  archivedHerdBundles,
  onSaveManualOpfsVaultBackup,
  onCreateVerifiedPreUpgradeBackup,
  onRestoreOpfsVaultBackup,
  onDeleteOpfsVaultBackup,
  onRestoreRollingBackup,
  children,
}: VaultSliceProviderProps) {
  const value = useMemo<VaultSliceValue>(
    () => ({
      opfsSupported,
      opfsVaultBackups,
      rollingBackups,
      archivedHerdBundles,
      vaultBackupCount: opfsVaultBackups.length,
      rollingBackupCount: rollingBackups.length,
      archivedBundleCount: archivedHerdBundles.length,
      onSaveManualOpfsVaultBackup,
      onCreateVerifiedPreUpgradeBackup,
      onRestoreOpfsVaultBackup,
      onDeleteOpfsVaultBackup,
      onRestoreRollingBackup,
    }),
    [
      opfsSupported,
      opfsVaultBackups,
      rollingBackups,
      archivedHerdBundles,
      onSaveManualOpfsVaultBackup,
      onCreateVerifiedPreUpgradeBackup,
      onRestoreOpfsVaultBackup,
      onDeleteOpfsVaultBackup,
      onRestoreRollingBackup,
    ]
  );
  return <VaultSliceContext.Provider value={value}>{children}</VaultSliceContext.Provider>;
}

export function useVaultSlice(): VaultSliceValue {
  const value = useContext(VaultSliceContext);
  if (!value) {
    throw new Error('useVaultSlice must be used inside <VaultSliceProvider>.');
  }
  return value;
}
