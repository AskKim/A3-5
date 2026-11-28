/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Sync operation log retention.
 *
 * The outbox is append-only while it is being written, and the whole log is rewritten after every
 * merge. Without a bound it grows for the life of the install: every animal edit, photo caption and
 * task check-off stays in IndexedDB forever, and each rewrite gets slower because it writes the
 * entire history back.
 *
 * The policy is deliberately conservative, because dropping an operation that a peer has not yet
 * pulled would silently lose a change:
 *  - an operation is only expired once it is older than the retention window (peers have had many
 *    opportunities to exchange it),
 *  - the cap is a hard ceiling for pathological growth, and only the oldest operations over it go,
 *  - ordering is by timestamp with the logical counter as the tie-break, so a clock skew cannot
 *    make a newer operation look older than an older one from the same device.
 */
import type { SyncOperation } from './syncOutbox';

export interface SyncRetentionPolicy {
  /** Hard ceiling on retained operations. */
  maxOperations: number;
  /** Age at which an operation may be dropped even below the ceiling. */
  retentionDays: number;
}

export const DEFAULT_SYNC_RETENTION_POLICY: SyncRetentionPolicy = {
  maxOperations: 20_000,
  retentionDays: 120,
};

export interface SyncRetentionPlan {
  retained: SyncOperation[];
  dropped: SyncOperation[];
}

const timestampOf = (op: SyncOperation): number => {
  const parsed = Date.parse(String(op.timestamp ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const counterOf = (op: SyncOperation): number => {
  const counter = Number(op.logical_counter);
  return Number.isFinite(counter) ? counter : 0;
};

const oldestFirst = (a: SyncOperation, b: SyncOperation): number => {
  const byTime = timestampOf(a) - timestampOf(b);
  if (byTime !== 0) return byTime;
  return counterOf(a) - counterOf(b);
};

/**
 * Decide which operations to keep. Pure: the caller owns persistence.
 *
 * Returns every operation unchanged when the log is inside both limits, so the common case does no
 * work and cannot perturb ordering.
 */
export function planSyncOperationRetention(
  operations: readonly SyncOperation[],
  policy: SyncRetentionPolicy = DEFAULT_SYNC_RETENTION_POLICY,
  nowIso: string = new Date().toISOString()
): SyncRetentionPlan {
  const maxOperations = Math.max(1, Math.floor(policy.maxOperations));
  const retentionDays = Math.max(0, policy.retentionDays);
  if (operations.length === 0) return { retained: [], dropped: [] };

  const now = Date.parse(nowIso);
  const cutoff =
    Number.isFinite(now) && retentionDays > 0 ? now - retentionDays * 24 * 60 * 60 * 1000 : null;

  const sortedOldestFirst = [...operations].sort(oldestFirst);

  // Expire by age first: an operation younger than the window is never dropped by age alone.
  const expired: SyncOperation[] = [];
  const fresh: SyncOperation[] = [];
  for (const op of sortedOldestFirst) {
    if (cutoff !== null && timestampOf(op) > 0 && timestampOf(op) < cutoff) expired.push(op);
    else fresh.push(op);
  }

  if (fresh.length <= maxOperations) {
    if (expired.length === 0) return { retained: operations.slice(), dropped: [] };
    const keep = new Set(fresh);
    return { retained: operations.filter((op) => keep.has(op)), dropped: expired };
  }

  const keepFromFresh = fresh.length - maxOperations;
  const droppedFromFresh = fresh.slice(0, keepFromFresh);
  const remaining = fresh.slice(keepFromFresh);
  const keepIds = new Set(remaining);

  return {
    retained: operations.filter((op) => keepIds.has(op)),
    dropped: [...expired, ...droppedFromFresh],
  };
}
