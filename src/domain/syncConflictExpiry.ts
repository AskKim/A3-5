/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Expiry for the sync-conflict review log.
 *
 * The review log is an append-only history: every collision ever detected stays in IndexedDB, and
 * the UI sorts the whole thing on load. That is fine for a fresh install and steadily worse after a
 * year of editing from two devices.
 *
 * One rule matters more than the retention window: **an unresolved conflict is never expired.**
 * Resolving is a decision only the owner can make; dropping the row would silently pick a side and
 * hide that it ever happened. Only conflicts already marked resolved are eligible, and the clock runs
 * from `resolved_at` — when the owner actually made the decision — falling back to `detected_at`
 * for rows resolved before that field existed.
 */
import type { SyncConflictEntry } from './syncOutbox';

export const DEFAULT_SYNC_CONFLICT_RETENTION_DAYS = 30;

export interface SyncConflictRetentionPlan {
  kept: SyncConflictEntry[];
  expired: SyncConflictEntry[];
}

/**
 * Split the review log into what stays and what can be deleted. Pure: the caller owns persistence.
 *
 * Returns everything unchanged — same order, same instances — when nothing is eligible, so the
 * common load path does no work and cannot perturb the newest-first ordering.
 */
export function planSyncConflictRetention(
  conflicts: readonly SyncConflictEntry[],
  nowIso: string = new Date().toISOString(),
  retentionDays: number = DEFAULT_SYNC_CONFLICT_RETENTION_DAYS
): SyncConflictRetentionPlan {
  if (conflicts.length === 0) return { kept: [], expired: [] };
  if (!(retentionDays > 0)) return { kept: conflicts.slice(), expired: [] };

  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) return { kept: conflicts.slice(), expired: [] };
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;

  const expired: SyncConflictEntry[] = [];
  const kept: SyncConflictEntry[] = [];
  for (const conflict of conflicts) {
    const resolvedAt = Date.parse(
      String(conflict.resolved_at ?? conflict.detected_at ?? '')
    );
    const eligible =
      conflict.resolved === true && Number.isFinite(resolvedAt) && resolvedAt < cutoff;
    (eligible ? expired : kept).push(conflict);
  }

  if (expired.length === 0) return { kept: conflicts.slice(), expired: [] };
  return { kept, expired };
}
