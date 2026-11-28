/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The actions behind the backup reminder: export, snooze and reset.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Backup-reminder actions, extracted from `useBarnStore` as a sub-hook.
 *
 * The hook keeps ownership of state and persistence wiring; this slice takes the two mutation
 * helpers it needs (`enqueueStoreMutation`, `updateSettingsInternal`) plus the ref/setters it must
 * touch. The bodies live as plain functions so they can be exercised without a React renderer; the
 * sub-hook only supplies `useCallback` identity.
 */
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { LastBackupMeta } from '../../domain/backupStatus';
import type { BarnDatabaseSnapshot, BarnSettings } from '../../domain/models';
import { getAdjustedNowIsoUtc, getAdjustedNowMs } from '../../storage/storageProtection';
import {
  clearStoredSnoozedUntilMs,
  computeSnoozedUntilMs,
  writeStoredLastBackupMeta,
  writeStoredSnoozedUntilMs,
} from './backupReminder';

export type BackupExportFormat = 'zip' | 'sqlite' | 'json';

export interface BackupReminderActionDeps {
  /** Serialises writes through the store's single write queue. */
  enqueueStoreMutation: <T>(task: () => Promise<T>) => Promise<T>;
  /** Writes settings into the live snapshot; the caller owns revisions, outbox and notifications. */
  updateSettingsInternal: (
    patch: Partial<BarnSettings>,
    options?: { silent?: boolean }
  ) => Promise<void>;
  snapshotRef: MutableRefObject<BarnDatabaseSnapshot | null>;
  setLocalLastBackupMeta: Dispatch<SetStateAction<LastBackupMeta | null>>;
  setLocalSnoozedUntilMs: Dispatch<SetStateAction<number>>;
}

export async function recordBackupExportAction(
  deps: BackupReminderActionDeps,
  format: BackupExportFormat,
  fileName?: string
): Promise<void> {
  const meta: LastBackupMeta = {
    exportedAtIso: getAdjustedNowIsoUtc(),
    format,
    fileName,
  };
  deps.setLocalLastBackupMeta(meta);
  deps.setLocalSnoozedUntilMs(0);
  writeStoredLastBackupMeta(meta);
  clearStoredSnoozedUntilMs();
  if (deps.snapshotRef.current) {
    await deps.enqueueStoreMutation(() =>
      deps.updateSettingsInternal(
        { lastBackupMeta: meta, backupReminderSnoozedUntilMs: 0 },
        { silent: true }
      )
    );
  }
}

export async function snoozeBackupReminderAction(
  deps: BackupReminderActionDeps,
  hours: number = 24
): Promise<void> {
  const untilMs = computeSnoozedUntilMs(getAdjustedNowMs(), hours);
  deps.setLocalSnoozedUntilMs(untilMs);
  writeStoredSnoozedUntilMs(untilMs);
  if (deps.snapshotRef.current) {
    await deps.enqueueStoreMutation(() =>
      deps.updateSettingsInternal({ backupReminderSnoozedUntilMs: untilMs }, { silent: true })
    );
  }
}

export interface BackupReminderActions {
  recordBackupExport: (format: BackupExportFormat, fileName?: string) => Promise<void>;
  snoozeBackupReminder: (hours?: number) => Promise<void>;
}

export function useBackupReminderActions(deps: BackupReminderActionDeps): BackupReminderActions {
  const { enqueueStoreMutation, updateSettingsInternal, snapshotRef } = deps;
  const { setLocalLastBackupMeta, setLocalSnoozedUntilMs } = deps;

  const recordBackupExport = useCallback(
    (format: BackupExportFormat, fileName?: string) =>
      recordBackupExportAction(
        {
          enqueueStoreMutation,
          updateSettingsInternal,
          snapshotRef,
          setLocalLastBackupMeta,
          setLocalSnoozedUntilMs,
        },
        format,
        fileName
      ),
    [
      enqueueStoreMutation,
      updateSettingsInternal,
      snapshotRef,
      setLocalLastBackupMeta,
      setLocalSnoozedUntilMs,
    ]
  );

  const snoozeBackupReminder = useCallback(
    (hours: number = 24) =>
      snoozeBackupReminderAction(
        {
          enqueueStoreMutation,
          updateSettingsInternal,
          snapshotRef,
          setLocalLastBackupMeta,
          setLocalSnoozedUntilMs,
        },
        hours
      ),
    [
      enqueueStoreMutation,
      updateSettingsInternal,
      snapshotRef,
      setLocalLastBackupMeta,
      setLocalSnoozedUntilMs,
    ]
  );

  return { recordBackupExport, snoozeBackupReminder };
}
