/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Remembers the last successful export and any snooze, so the reminder does not nag.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Backup-reminder persistence policy, split out of `useBarnStore`.
 *
 * Two pieces of state survive a reload: the last successful export and the "snoozed until"
 * deadline. The hook used to inline that storage handling in four places; it now lives here so the
 * behaviour can be tested without a React renderer. Every helper degrades to a no-op rather than
 * throwing — private browsing and sandboxed iframes reject `localStorage` at runtime.
 */
import type { LastBackupMeta } from '../../domain/backupStatus';

export const LAST_BACKUP_META_STORAGE_KEY = 'pedigree.lastBackupMeta.v1';
export const BACKUP_REMINDER_SNOOZE_STORAGE_KEY = 'pedigree.backupReminderSnoozedUntil.v1';

/** The subset of `Storage` this policy needs, so tests can pass a fake without a DOM. */
export type ReminderStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): ReminderStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Reads the snooze deadline; anything unparsable (or unavailable storage) counts as "not snoozed". */
export function readStoredSnoozedUntilMs(storage: ReminderStorage | null = defaultStorage()): number {
  try {
    const raw = storage?.getItem(BACKUP_REMINDER_SNOOZE_STORAGE_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export function writeStoredSnoozedUntilMs(
  untilMs: number,
  storage: ReminderStorage | null = defaultStorage()
): void {
  try {
    storage?.setItem(BACKUP_REMINDER_SNOOZE_STORAGE_KEY, String(untilMs));
  } catch {
    // Ignore private browsing / restricted iframe storage errors
  }
}

export function clearStoredSnoozedUntilMs(storage: ReminderStorage | null = defaultStorage()): void {
  try {
    storage?.removeItem(BACKUP_REMINDER_SNOOZE_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function readStoredLastBackupMeta(
  storage: ReminderStorage | null = defaultStorage()
): LastBackupMeta | null {
  try {
    const raw = storage?.getItem(LAST_BACKUP_META_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LastBackupMeta) : null;
  } catch {
    return null;
  }
}

export function writeStoredLastBackupMeta(
  meta: LastBackupMeta,
  storage: ReminderStorage | null = defaultStorage()
): void {
  try {
    storage?.setItem(LAST_BACKUP_META_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // Ignore private browsing storage quota warnings
  }
}

/** Clears both keys at once, as the reset path expects. */
export function clearStoredBackupReminderState(
  storage: ReminderStorage | null = defaultStorage()
): void {
  try {
    storage?.removeItem(LAST_BACKUP_META_STORAGE_KEY);
    storage?.removeItem(BACKUP_REMINDER_SNOOZE_STORAGE_KEY);
  } catch {
    // Ignore private browsing or restricted iframe storage errors
  }
}

/**
 * Snapshot settings win over the local mirror, including a stored `0` (an explicit "not snoozed"),
 * which is why this uses `??` and not a truthiness check.
 */
export function resolveEffectiveSnoozedUntilMs(
  snapshotSnoozedUntilMs: number | null | undefined,
  localSnoozedUntilMs: number | null | undefined
): number {
  return snapshotSnoozedUntilMs ?? localSnoozedUntilMs ?? 0;
}

/** Snooze deadlines are computed from the skew-adjusted clock the rest of the store uses. */
export function computeSnoozedUntilMs(nowMs: number, hours: number): number {
  return nowMs + hours * 60 * 60 * 1000;
}
