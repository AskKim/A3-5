/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * One destructive-restore path for every backup source.
 *
 * OPFS vault restores, rolling IndexedDB restores and (eventually) JSON/archive imports all replace
 * the live barn with bytes from elsewhere. Written separately they drifted: each had its own copy of
 * "safety snapshot first, clear the photo cache, strip backup bookkeeping, clear sync state, reset
 * recovery context, reload, toast". This orchestrator owns that order once, and adds the step none
 * of them had — after the replace, re-read what actually landed and roll back if it does not match
 * the file we loaded.
 *
 * Callers stay responsible for: serialising the restore through `enqueueStoreMutation`, decoding
 * their own file format, and anything specific to their source (the OPFS path switches species).
 */
import { appPerfTimings } from '../../utils/perfTiming';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import { computeSnapshotChecksum } from '../../domain/snapshotChecksum';
import { invalidateSpeciesSelectorCache } from './speciesSelectors';

/** Settings that must never ride along with a restored snapshot. */
export function stripRestoredBackupBookkeeping(
  snapshot: BarnDatabaseSnapshot
): BarnDatabaseSnapshot {
  return {
    ...snapshot,
    settings: {
      ...snapshot.settings,
      lastBackupMeta: undefined,
      backupReminderSnoozedUntilMs: undefined,
    },
  };
}

/** Every capability a restore source must supply to `runDestructiveRestore`. */
export interface DestructiveRestoreDeps {
  snapshotRef: { current: BarnDatabaseSnapshot | null };
  /** After a wiped-storage recovery there is nothing left worth backing up. */
  wipedRecoveryDetected: boolean;
  saveSafetyRollingBackup: (
    snapshot: BarnDatabaseSnapshot,
    note?: string
  ) => Promise<unknown>;
  clearPhotoCache: () => void;
  replaceSnapshot: (snapshot: BarnDatabaseSnapshot) => Promise<void>;
  clearLocalSyncAndBackupReminderState: () => Promise<void>;
  clearWipedRecoveryContext: () => void;
  reloadFromAdapter: () => Promise<void>;
  /** Reads back what the adapter actually holds; enables post-replace verification. */
  readCommittedSnapshot?: () => Promise<BarnDatabaseSnapshot | null>;
  notify: (message: string) => void;
  reportPersistenceFailure: (action: string, error: unknown) => void;
}

/** Minimum payload every restore source decodes: the snapshot to install. */
export interface RestorePayload {
  snapshot: BarnDatabaseSnapshot;
}

export interface DestructiveRestorePlan<P extends RestorePayload> {
  /** Label used for failure reporting, e.g. `restore OPFS vault backup`. */
  action: string;
  /** Toast when the source could not produce a readable snapshot. */
  missingMessage: string;
  /** Note stored on the pre-restore safety snapshot. */
  safetyNote: string;
  /** Source-specific work that must happen before the reload (OPFS switches species here). */
  afterReplace?: (payload: P) => void;
  successMessage: (payload: P) => string;
  /** Compare committed row counts with the loaded file and roll back on mismatch. */
  verifyRowCounts?: boolean;
  /**
   * Compare a structural checksum of the committed snapshot with the loaded one and roll back on
   * mismatch. Catches a restore that landed the right row counts with the wrong values.
   */
  verifyChecksum?: boolean;
}

const rowCounts = (snapshot: BarnDatabaseSnapshot) => ({
  animals: snapshot.animals.length,
  photos: (snapshot.animalPhotos ?? []).length,
});

/**
 * Replace the live barn with `load()`'s snapshot, in the safe order, and verify the result.
 * Returns the payload on success, or `null` when the source had nothing readable.
 * Throws (after attempting a rollback) when verification fails or a write errors.
 */
export async function runDestructiveRestore<P extends RestorePayload>(
  deps: DestructiveRestoreDeps,
  plan: DestructiveRestorePlan<P>,
  load: () => Promise<P | null>
): Promise<P | null> {
  // Restores are the operation most likely to get slow as the stored dataset grows; time it so the
  // diagnostics screen can show a real number instead of "it feels slow".
  return appPerfTimings.time('restore:destructive', () => runDestructiveRestoreInner(deps, plan, load));
}

async function runDestructiveRestoreInner<P extends RestorePayload>(
  deps: DestructiveRestoreDeps,
  plan: DestructiveRestorePlan<P>,
  load: () => Promise<P | null>
): Promise<P | null> {
  const currentSnapshot = deps.snapshotRef.current;
  try {
    const payload = await load();
    if (!payload) {
      deps.notify(plan.missingMessage);
      return null;
    }
    const expected = rowCounts(payload.snapshot);

    const safetySnapshot =
      currentSnapshot && !deps.wipedRecoveryDetected && currentSnapshot.animals.length > 0
        ? currentSnapshot
        : null;
    if (safetySnapshot) {
      await deps.saveSafetyRollingBackup(safetySnapshot, plan.safetyNote);
    }

    deps.clearPhotoCache();
    const replacedSnapshot = stripRestoredBackupBookkeeping(payload.snapshot);
    const expectedChecksum = plan.verifyChecksum ? computeSnapshotChecksum(replacedSnapshot) : null;
    await deps.replaceSnapshot(replacedSnapshot);
    // The restored rows may carry the same ids and revisions as the dataset they replace.
    invalidateSpeciesSelectorCache();
    await deps.clearLocalSyncAndBackupReminderState();
    deps.clearWipedRecoveryContext();
    plan.afterReplace?.(payload);

    if ((plan.verifyRowCounts || expectedChecksum) && deps.readCommittedSnapshot) {
      const committed = await deps.readCommittedSnapshot();
      const actual = committed ? rowCounts(committed) : null;
      const countsOk =
        !plan.verifyRowCounts ||
        (Boolean(actual) && actual!.animals === expected.animals && actual!.photos === expected.photos);
      const checksumOk =
        !expectedChecksum ||
        (committed !== null && computeSnapshotChecksum(committed) === expectedChecksum);
      if (!countsOk || !checksumOk) {
        if (safetySnapshot) {
          await deps.replaceSnapshot(safetySnapshot);
          invalidateSpeciesSelectorCache();
          await deps.reloadFromAdapter();
        }
        const detail = checksumOk
          ? `${actual ? `${actual.animals} / ${actual.photos}` : 'nothing'} rows`
          : 'the committed records do not match the file checksum';
        deps.notify(
          safetySnapshot
            ? `Restore verification failed (expected ${expected.animals} animals / ${expected.photos} photos, found ${detail}). Your previous barn was put back.`
            : `Restore verification failed (expected ${expected.animals} animals / ${expected.photos} photos, found ${detail}).`
        );
        throw new Error(
          checksumOk ? 'Restore verification failed' : 'Restore checksum verification failed'
        );
      }
    }

    await deps.reloadFromAdapter();
    deps.notify(plan.successMessage(payload));
    return payload;
  } catch (err) {
    deps.reportPersistenceFailure(plan.action, err);
    throw err;
  }
}
