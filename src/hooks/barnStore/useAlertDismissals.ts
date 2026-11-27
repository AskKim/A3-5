/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Alert-dismissal actions, extracted from `useBarnStore` as a sub-hook.
 *
 * Three settings-only mutations: permanently ignoring task ids, clearing one species' overdue-task
 * alert group, and dismissing a species memo alert. The hook keeps ownership of state,
 * persistence, revisions and the outbox; this slice takes the two mutation helpers it needs plus
 * the snapshot ref and notifier. Bodies live as plain functions so they can be exercised without a
 * React renderer; the sub-hook only supplies `useCallback` identity.
 *
 * The `*Key` / `*Signatures` merges are pure and exported on their own because they decide whether a
 * dismissed alert stays dismissed — the one behaviour a refactor can silently break.
 */
import { useCallback, type MutableRefObject } from 'react';
import type { BarnDatabaseSnapshot, BarnSettings } from '../../domain/models';

/** Species bucket key used by every dismissal map: trimmed, lower-cased. */
export const normalizeAlertSpeciesKey = (speciesName: string): string =>
  speciesName.trim().toLowerCase();

/** Appends task ids to the permanent-ignore list without duplicating existing entries. */
export function mergeIgnoredTaskIds(
  existing: readonly string[] | undefined,
  taskIds: readonly string[]
): string[] {
  return Array.from(new Set([...(existing || []), ...taskIds]));
}

/** An empty group signature means "nothing to clear"; the caller must skip persistence. */
export function isEmptyGroupSignature(groupSignature: string | string[]): boolean {
  return Array.isArray(groupSignature) ? groupSignature.length === 0 : !groupSignature;
}

/**
 * Returns the next per-species group-signature map, or `null` when there is nothing to record.
 */
export function buildDismissedTaskGroupKeys(
  previous: Record<string, string | string[]> | undefined,
  speciesName: string,
  groupSignature: string | string[]
): Record<string, string | string[]> | null {
  if (isEmptyGroupSignature(groupSignature)) return null;
  return { ...(previous || {}), [normalizeAlertSpeciesKey(speciesName)]: groupSignature };
}

/**
 * Returns the next per-species memo-signature map, or `null` when the signature is blank.
 */
export function buildDismissedMemoAlertSignatures(
  previous: Record<string, string> | undefined,
  speciesName: string,
  memoSignature: string
): Record<string, string> | null {
  if (!memoSignature) return null;
  return { ...(previous || {}), [normalizeAlertSpeciesKey(speciesName)]: memoSignature };
}

export interface AlertDismissalDeps {
  /** Serialises writes through the store's single write queue. */
  enqueueStoreMutation: <T>(task: () => Promise<T>) => Promise<T>;
  /** Writes settings into the live snapshot; the caller owns revisions, outbox and notifications. */
  updateSettingsInternal: (
    patch: Partial<BarnSettings>,
    options?: { silent?: boolean }
  ) => Promise<void>;
  snapshotRef: MutableRefObject<BarnDatabaseSnapshot | null>;
  notify: (message: string) => void;
}

export async function ignoreTaskAlertsPermanentlyAction(
  deps: AlertDismissalDeps,
  taskIds: string[]
): Promise<void> {
  if (taskIds.length === 0) return;
  await deps.enqueueStoreMutation(async () => {
    const currentSnapshot = deps.snapshotRef.current;
    if (!currentSnapshot) return;
    const merged = mergeIgnoredTaskIds(currentSnapshot.settings.ignoredTaskIds, taskIds);
    await deps.updateSettingsInternal({ ignoredTaskIds: merged }, { silent: true });
    deps.notify(`Dismissed ${taskIds.length} task alert(s) permanently.`);
  });
}

export async function clearTaskAlertGroupAction(
  deps: AlertDismissalDeps,
  speciesName: string,
  groupSignature: string | string[]
): Promise<void> {
  if (isEmptyGroupSignature(groupSignature)) return;
  await deps.enqueueStoreMutation(async () => {
    const currentSnapshot = deps.snapshotRef.current;
    if (!currentSnapshot) return;
    const nextMap = buildDismissedTaskGroupKeys(
      currentSnapshot.settings.dismissedTaskGroupKeys,
      speciesName,
      groupSignature
    );
    if (!nextMap) return;
    await deps.updateSettingsInternal({ dismissedTaskGroupKeys: nextMap }, { silent: true });
    deps.notify(`Cleared alert for current ${speciesName} overdue tasks.`);
  });
}

export async function dismissSpeciesMemoAlertAction(
  deps: AlertDismissalDeps,
  speciesName: string,
  memoSignature: string
): Promise<void> {
  if (!memoSignature) return;
  await deps.enqueueStoreMutation(async () => {
    const currentSnapshot = deps.snapshotRef.current;
    if (!currentSnapshot) return;
    const nextMap = buildDismissedMemoAlertSignatures(
      currentSnapshot.settings.dismissedMemoAlertSignatures,
      speciesName,
      memoSignature
    );
    if (!nextMap) return;
    await deps.updateSettingsInternal({ dismissedMemoAlertSignatures: nextMap }, { silent: true });
  });
}

export interface AlertDismissals {
  ignoreTaskAlertsPermanently: (taskIds: string[]) => Promise<void>;
  clearTaskAlertGroup: (
    speciesName: string,
    groupSignature: string | string[]
  ) => Promise<void>;
  dismissSpeciesMemoAlert: (speciesName: string, memoSignature: string) => Promise<void>;
}

export function useAlertDismissals(deps: AlertDismissalDeps): AlertDismissals {
  const { enqueueStoreMutation, updateSettingsInternal, snapshotRef, notify } = deps;

  const ignoreTaskAlertsPermanently = useCallback(
    (taskIds: string[]) =>
      ignoreTaskAlertsPermanentlyAction(
        { enqueueStoreMutation, updateSettingsInternal, snapshotRef, notify },
        taskIds
      ),
    [enqueueStoreMutation, updateSettingsInternal, snapshotRef, notify]
  );

  const clearTaskAlertGroup = useCallback(
    (speciesName: string, groupSignature: string | string[]) =>
      clearTaskAlertGroupAction(
        { enqueueStoreMutation, updateSettingsInternal, snapshotRef, notify },
        speciesName,
        groupSignature
      ),
    [enqueueStoreMutation, updateSettingsInternal, snapshotRef, notify]
  );

  const dismissSpeciesMemoAlert = useCallback(
    (speciesName: string, memoSignature: string) =>
      dismissSpeciesMemoAlertAction(
        { enqueueStoreMutation, updateSettingsInternal, snapshotRef, notify },
        speciesName,
        memoSignature
      ),
    [enqueueStoreMutation, updateSettingsInternal, snapshotRef, notify]
  );

  return { ignoreTaskAlertsPermanently, clearTaskAlertGroup, dismissSpeciesMemoAlert };
}
