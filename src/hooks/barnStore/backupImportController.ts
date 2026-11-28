/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Shared install path for a snapshot decoded from a file.
 *
 * The JSON backup import and the archive (.zip / .json) import both replace the live barn with rows
 * read from disk, and both had grown their own copy of the same order: pre-replace safety snapshot,
 * purge the photo cache, flag duplicate/mismatch animals and surface the alert, strip backup
 * bookkeeping, replace the snapshot, reset sync state and recovery context, reload. The sources
 * differ only in how they decode bytes and in their toast copy, so the install order lives here once.
 *
 * Callers stay responsible for: serialising the import through `enqueueStoreMutation`, decoding their
 * own format (plus the photos-only archive special case), their success toasts and error reporting.
 */
import type { ImportConflictFlagResult } from '../../domain/animalConflicts';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import { applyImportConflictAttentionFlags } from '../../domain/animalConflicts';
import { stripRestoredBackupBookkeeping } from './restoreOrchestrator';

export type BackupImportMode = 'merge' | 'replace';

/** Store capabilities the install path needs; built once per store render. */
export interface BackupImportPorts {
  snapshotRef: { current: BarnDatabaseSnapshot | null };
  saveSafetyRollingBackup: (snapshot: BarnDatabaseSnapshot, note?: string) => Promise<unknown>;
  clearPhotoCache: () => void;
  replaceSnapshot: (snapshot: BarnDatabaseSnapshot) => Promise<void>;
  clearLocalSyncAndBackupReminderState: () => Promise<void>;
  clearWipedRecoveryContext: () => void;
  reloadFromAdapter: () => Promise<void>;
  setImportConflictAlert: (alert: {
    message: string;
    speciesNames: string[];
    conflictedCount: number;
  }) => void;
  logDiagnosticEvent: (params: {
    level: 'warn';
    category: 'storage';
    message: string;
  }) => void;
}

/** What the install landed, so the caller can word its own toast. */
export interface ImportedSnapshotResult {
  /** The snapshot the adapter now holds. */
  snapshot: BarnDatabaseSnapshot;
  /** Warning surfaced about duplicate/mismatched animals, when the import produced one. */
  alertMessage?: string | null;
  /** Row counts folded in; only present for `mode: 'merge'`. */
  merged?: { animalsAdded: number; animalsUpdated: number; photosMerged: number };
}

/**
 * Installs `incoming` into the live barn.
 *
 * `replace` is destructive: it takes a safety snapshot first, resets sync bookkeeping and the
 * wiped-recovery context. `merge` folds the file into the current snapshot and leaves both alone.
 * Returns `null` when the store has no snapshot loaded yet.
 */
export async function installImportedSnapshot(
  ports: BackupImportPorts,
  params: { mode: BackupImportMode; incoming: BarnDatabaseSnapshot; safetyNote: string }
): Promise<ImportedSnapshotResult | null> {
  const currentSnapshot = ports.snapshotRef.current;
  if (!currentSnapshot) return null;

  const surfaceConflictAlert = (flagRes: ImportConflictFlagResult) => {
    if (!flagRes.alertMessage) return;
    const speciesNames = Array.from(
      new Set(
        flagRes.animals
          .filter((animal) => flagRes.conflictedAnimalIds.includes(animal.id))
          .map((animal) => animal.species)
      )
    );
    ports.setImportConflictAlert({
      message: flagRes.alertMessage,
      speciesNames,
      conflictedCount: flagRes.conflictedAnimalIds.length,
    });
    ports.logDiagnosticEvent({
      level: 'warn',
      category: 'storage',
      message: flagRes.alertMessage,
    });
  };

  if (params.mode === 'replace') {
    if (currentSnapshot.animals.length > 0) {
      await ports.saveSafetyRollingBackup(currentSnapshot, params.safetyNote);
    }
    ports.clearPhotoCache();
    const flagRes = applyImportConflictAttentionFlags(params.incoming.animals);
    const nextSnapshot: BarnDatabaseSnapshot = {
      ...stripRestoredBackupBookkeeping(params.incoming),
      animals: flagRes.animals,
    };
    await ports.replaceSnapshot(nextSnapshot);
    await ports.clearLocalSyncAndBackupReminderState();
    ports.clearWipedRecoveryContext();
    await ports.reloadFromAdapter();
    surfaceConflictAlert(flagRes);
    return { snapshot: nextSnapshot, alertMessage: flagRes.alertMessage };
  }

  const { mergeBarnSnapshots } = await import('../../domain/syncAndExports');
  const merged = mergeBarnSnapshots(currentSnapshot, params.incoming);
  const importedIds = new Set(params.incoming.animals.map((animal) => animal.id));
  const flagRes = applyImportConflictAttentionFlags(merged.snapshot.animals, importedIds);
  const nextSnapshot: BarnDatabaseSnapshot = { ...merged.snapshot, animals: flagRes.animals };
  await ports.replaceSnapshot(nextSnapshot);
  await ports.reloadFromAdapter();
  surfaceConflictAlert(flagRes);
  return {
    snapshot: nextSnapshot,
    alertMessage: flagRes.alertMessage,
    merged: {
      animalsAdded: merged.animalsAdded,
      animalsUpdated: merged.animalsUpdated,
      photosMerged: merged.photosMerged,
    },
  };
}
