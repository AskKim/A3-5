/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Sync-conflict slice context.
 *
 * First step of the milestone 5 split. The store's single value is threaded through props to every
 * screen that needs a piece of it, so the Import/Export hub was handed four conflict props it only
 * forwards. This slice carries the conflict review state and its two actions on their own context,
 * which also gives the derived "open conflicts" list one identity per conflict-array change instead
 * of one per render.
 *
 * The store still returns all of its keys; this is an additional way in, not a replacement.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { SyncConflictEntry } from '../../domain/syncOutbox';

export type SyncConflictSide = 'winning' | 'losing';

export interface SyncConflictSliceValue {
  /** Every conflict in the review log, resolved or not. */
  syncConflicts: readonly SyncConflictEntry[];
  /** Derived list, memoised on the conflict array. */
  openConflicts: readonly SyncConflictEntry[];
  resolveSyncConflict: (
    conflictId: string | readonly string[],
    side: SyncConflictSide
  ) => Promise<void>;
  dismissSyncConflict: (conflictId: string) => Promise<void>;
}

/** Conflicts nobody has decided yet. Pure so it can be tested without a renderer. */
export function selectOpenConflicts(
  conflicts: readonly SyncConflictEntry[]
): SyncConflictEntry[] {
  return conflicts.filter((conflict) => !conflict.resolved);
}

const SyncConflictSliceContext = createContext<SyncConflictSliceValue | null>(null);

export interface SyncConflictSliceProviderProps {
  syncConflicts: readonly SyncConflictEntry[];
  resolveSyncConflict: SyncConflictSliceValue['resolveSyncConflict'];
  dismissSyncConflict: SyncConflictSliceValue['dismissSyncConflict'];
  children: ReactNode;
}

export function SyncConflictSliceProvider({
  syncConflicts,
  resolveSyncConflict,
  dismissSyncConflict,
  children,
}: SyncConflictSliceProviderProps) {
  const openConflicts = useMemo(() => selectOpenConflicts(syncConflicts), [syncConflicts]);
  const value = useMemo<SyncConflictSliceValue>(
    () => ({ syncConflicts, openConflicts, resolveSyncConflict, dismissSyncConflict }),
    [syncConflicts, openConflicts, resolveSyncConflict, dismissSyncConflict]
  );
  return (
    <SyncConflictSliceContext.Provider value={value}>{children}</SyncConflictSliceContext.Provider>
  );
}

export function useSyncConflictSlice(): SyncConflictSliceValue {
  const value = useContext(SyncConflictSliceContext);
  if (!value) {
    throw new Error('useSyncConflictSlice must be used inside <SyncConflictSliceProvider>.');
  }
  return value;
}
