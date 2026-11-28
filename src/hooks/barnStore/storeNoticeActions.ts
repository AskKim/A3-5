/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The store actions that clear a status message, dismiss an import warning, or jump to the herd.
 * PART 2 — FOR AI / DEVELOPERS:
 * Store notice and herd-locate actions, extracted from `useBarnStore`'s return literal.
 *
 * These four actions are the store's only "navigation-shaped" surface: clearing the transient
 * status/error banner, dismissing the import-conflict alert, and jumping from a conflict report into
 * the herd view. They were inline arrows inside the 200-key return literal, which meant the one place
 * that must stay a plain data literal also carried closures. This module keeps them as factories
 * over the store's own setters so the literal can list the keys without building them.
 *
 * Ownership split: the store owns the state and the setters; this slice only decides what a clear or
 * a locate does to that state.
 */
export interface StoreImportConflictAlert {
  message: string;
  speciesNames: string[];
  conflictedCount: number;
}

export interface StoreNoticeDeps {
  setStatusMessage: (value: null) => void;
  setErrorMessage: (value: null) => void;
  setImportConflictAlert: (value: StoreImportConflictAlert | null) => void;
}

export interface StoreNoticeActions {
  clearStatusMessage: () => void;
  clearErrorMessage: () => void;
  dismissImportConflictAlert: () => void;
}

export function createStoreNoticeActions(deps: StoreNoticeDeps): StoreNoticeActions {
  return {
    clearStatusMessage: () => deps.setStatusMessage(null),
    clearErrorMessage: () => deps.setErrorMessage(null),
    dismissImportConflictAlert: () => deps.setImportConflictAlert(null),
  };
}

export interface LocateConflictsDeps {
  setActiveSpeciesName: (name: string) => void;
  clearSelectedAnimal: () => void;
  requestHerdConflictView: () => void;
  navigateToHerd: () => void;
}

/** Jumps from a conflict report to the herd view, optionally switching species first. */
export function createLocateConflictsInHerd(
  deps: LocateConflictsDeps
): (speciesName?: string) => void {
  return (speciesName?: string) => {
    if (speciesName) {
      deps.setActiveSpeciesName(speciesName);
    }
    deps.clearSelectedAnimal();
    deps.requestHerdConflictView();
    deps.navigateToHerd();
  };
}
