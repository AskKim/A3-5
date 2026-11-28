/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Sync-conflict dismissal, extracted from `useBarnStore` as a sub-hook.
 *
 * "Dismiss" is deliberately the quiet sibling of "resolve": it changes no data, applies no delta
 * operation and toasts nothing. It only marks one conflict resolved in IndexedDB and in the React
 * list, so the conflict card disappears without touching the barn. Because resolve performs the
 * same resolved-marking, both paths share the pure helpers here.
 */
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { SyncConflictEntry } from '../../domain/syncOutbox';

/** The resolved copy of a conflict, preserving every other field. */
export function buildResolvedSyncConflict(
  conflict: SyncConflictEntry,
  resolvedAtIso: string = new Date().toISOString()
): SyncConflictEntry {
  // Retention runs from this stamp, not from `detected_at`: a conflict detected months ago and
  // resolved today should live a full window from the decision, not vanish immediately.
  return { ...conflict, resolved: true, resolved_at: resolvedAtIso };
}

/** Mark one conflict resolved in a list, leaving every other entry identical. */
export function markSyncConflictResolved(
  conflicts: readonly SyncConflictEntry[],
  resolvedConflict: SyncConflictEntry
): SyncConflictEntry[] {
  return conflicts.map((conflict) =>
    conflict.conflict_id === resolvedConflict.conflict_id ? resolvedConflict : conflict
  );
}

export interface SyncConflictDismissalDeps {
  syncConflicts: readonly SyncConflictEntry[];
  setSyncConflicts: Dispatch<SetStateAction<SyncConflictEntry[]>>;
  saveConflict: (conflict: SyncConflictEntry) => Promise<unknown>;
  /** Injectable clock so the resolution stamp (and therefore retention) is testable. */
  nowIsoUtc?: () => string;
}

/**
 * Dismiss one conflict. An unknown id is a silent no-op (no toast, no write), which is what keeps a
 * stale click harmless.
 */
export async function dismissSyncConflictAction(
  deps: SyncConflictDismissalDeps,
  conflictId: string
): Promise<void> {
  const conflict = deps.syncConflicts.find((c) => c.conflict_id === conflictId);
  if (!conflict) return;
  const resolvedConflict = buildResolvedSyncConflict(
    conflict,
    (deps.nowIsoUtc ?? (() => new Date().toISOString()))()
  );
  await deps.saveConflict(resolvedConflict);
  deps.setSyncConflicts((prev) => markSyncConflictResolved(prev, resolvedConflict));
}

export interface SyncConflictDismissal {
  dismissSyncConflict: (conflictId: string) => Promise<void>;
}

export function useSyncConflictDismissal(
  deps: SyncConflictDismissalDeps
): SyncConflictDismissal {
  const { syncConflicts, setSyncConflicts, saveConflict } = deps;

  const dismissSyncConflict = useCallback(
    (conflictId: string) =>
      dismissSyncConflictAction({ syncConflicts, setSyncConflicts, saveConflict }, conflictId),
    [syncConflicts, setSyncConflicts, saveConflict]
  );

  return { dismissSyncConflict };
}
