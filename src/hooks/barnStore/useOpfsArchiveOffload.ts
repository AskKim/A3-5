/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * OPFS /archives offload, extracted from `useBarnStore` as a sub-hook.
 *
 * Offloading retires animals out of the active database into a zipped archive bundle: load the
 * authoritative snapshot, hydrate photos, build the bundle, write it, replace the snapshot with the
 * stubs-only one, then drop selections that pointed at animals which left. It reads the adapter
 * rather than React state on purpose, so an offload queued right after a save cannot archive a stale
 * barn.
 *
 * The bundle builder stays a dynamic import in the default path so `backupVault` keeps its own
 * chunk; tests inject a builder instead of running the real ZIP pipeline.
 */
import { useCallback } from 'react';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import { isOpfsSupported, saveOpfsHerdArchive } from '../../storage/opfsStorage';

type BackupVaultModule = typeof import('../../domain/backupVault');
type ArchivedBundle = ReturnType<BackupVaultModule['buildArchivedAnimalsBundle']>;
type ArchivedBundleBuilder = BackupVaultModule['buildArchivedAnimalsBundle'];

async function loadBundleBuilder(): Promise<ArchivedBundleBuilder> {
  const mod = await import('../../domain/backupVault');
  return mod.buildArchivedAnimalsBundle;
}

/** The OPFS archive primitives this slice calls. */
export interface OpfsArchiveStoragePort {
  isOpfsSupported: typeof isOpfsSupported;
  saveOpfsHerdArchive: typeof saveOpfsHerdArchive;
}

export const OPFS_ARCHIVE_STORAGE_PORT: OpfsArchiveStoragePort = {
  isOpfsSupported,
  saveOpfsHerdArchive,
};

export interface OpfsOffloadResult {
  archivedCount: number;
  stubCount: number;
  removedCount: number;
  fileName: string;
}

export interface OpfsArchiveOffloadDeps {
  notify: (message: string) => void;
  reportPersistenceFailure: (action: string, error: unknown) => void;
  snapshotRef: { current: BarnDatabaseSnapshot | null };
  /** Reads the adapter (not React state) so a queued offload never archives a stale barn. */
  loadFreshSnapshot: () => Promise<BarnDatabaseSnapshot | null>;
  hydrateSnapshotForExport: (snapshot: BarnDatabaseSnapshot) => Promise<BarnDatabaseSnapshot>;
  replaceSnapshot: (snapshot: BarnDatabaseSnapshot) => Promise<void>;
  clearPhotoCache: () => void;
  selectedAnimalId: string | null;
  pedigreeAnimalId: string | null;
  clearSelectedAnimal: () => void;
  clearPedigreeAnimal: () => void;
  reloadFromAdapter: () => Promise<void>;
  enqueueStoreMutation: <T>(task: () => Promise<T>) => Promise<T>;
  /** Test seam; production leaves this unset and the real bundle builder is imported lazily. */
  buildArchivedBundle?: ArchivedBundleBuilder;
  /** Test seam; production leaves this unset to use the real OPFS module. */
  storage?: OpfsArchiveStoragePort;
}

const resolveStorage = (deps: OpfsArchiveOffloadDeps): OpfsArchiveStoragePort =>
  deps.storage ?? OPFS_ARCHIVE_STORAGE_PORT;

/** Offload without touching the mutation queue; only call from code that already holds it. */
export async function offloadAnimalsToOpfsArchiveUnqueued(
  deps: OpfsArchiveOffloadDeps,
  animalIds: string[]
): Promise<OpfsOffloadResult | null> {
  if (animalIds.length === 0) return null;
  const storage = resolveStorage(deps);
  if (!storage.isOpfsSupported()) {
    deps.notify(
      'OPFS /archives storage is not available in this browser. Animals remain in the local Archived tab.'
    );
    return null;
  }
  try {
    const freshBase = await deps.loadFreshSnapshot();
    if (!freshBase) return null;
    const [hydrated, buildArchivedAnimalsBundle] = await Promise.all([
      deps.hydrateSnapshotForExport(freshBase),
      deps.buildArchivedBundle ? Promise.resolve(deps.buildArchivedBundle) : loadBundleBuilder(),
    ]);
    const built: ArchivedBundle = buildArchivedAnimalsBundle(hydrated, animalIds);
    if (built.indexEntry.animalCount === 0) {
      deps.notify('No eligible active/archived animals selected to offload.');
      return null;
    }
    await storage.saveOpfsHerdArchive(built.indexEntry, built.zipBytes);
    await deps.replaceSnapshot(built.nextActiveSnapshot);
    deps.clearPhotoCache();

    const removedSet = new Set(built.removedAnimalIds);
    if (deps.selectedAnimalId && removedSet.has(deps.selectedAnimalId)) deps.clearSelectedAnimal();
    if (deps.pedigreeAnimalId && removedSet.has(deps.pedigreeAnimalId)) deps.clearPedigreeAnimal();

    await deps.reloadFromAdapter();
    deps.notify(
      `Offloaded ${built.indexEntry.animalCount} animal${built.indexEntry.animalCount === 1 ? '' : 's'} to OPFS /archives (${built.stubAnimalIds.length} retained as Pedigree Reference stub${built.stubAnimalIds.length === 1 ? '' : 's'}).`
    );
    return {
      archivedCount: built.indexEntry.animalCount,
      stubCount: built.stubAnimalIds.length,
      removedCount: built.removedAnimalIds.length,
      fileName: built.fileName,
    };
  } catch (err) {
    deps.reportPersistenceFailure('offload animals to OPFS /archives', err);
    return null;
  }
}

/** Offload animals, serialised with every other store mutation. */
export function offloadAnimalsToOpfsArchiveAction(
  deps: OpfsArchiveOffloadDeps,
  animalIds: string[]
): Promise<OpfsOffloadResult | null> {
  return deps.enqueueStoreMutation(() => offloadAnimalsToOpfsArchiveUnqueued(deps, animalIds));
}

export interface OpfsArchiveOffload {
  offloadAnimalsToOpfsArchive: (animalIds: string[]) => Promise<OpfsOffloadResult | null>;
  offloadAnimalsToOpfsArchiveInternal: (
    animalIds: string[]
  ) => Promise<OpfsOffloadResult | null>;
}

export function useOpfsArchiveOffload(deps: OpfsArchiveOffloadDeps): OpfsArchiveOffload {
  const {
    notify,
    reportPersistenceFailure,
    snapshotRef,
    loadFreshSnapshot,
    hydrateSnapshotForExport,
    replaceSnapshot,
    clearPhotoCache,
    selectedAnimalId,
    pedigreeAnimalId,
    clearSelectedAnimal,
    clearPedigreeAnimal,
    reloadFromAdapter,
    enqueueStoreMutation,
    buildArchivedBundle,
    storage,
  } = deps;

  const actionDeps: OpfsArchiveOffloadDeps = {
    notify,
    reportPersistenceFailure,
    snapshotRef,
    loadFreshSnapshot,
    hydrateSnapshotForExport,
    replaceSnapshot,
    clearPhotoCache,
    selectedAnimalId,
    pedigreeAnimalId,
    clearSelectedAnimal,
    clearPedigreeAnimal,
    reloadFromAdapter,
    enqueueStoreMutation,
    buildArchivedBundle,
    storage,
  };

  const offloadAnimalsToOpfsArchiveInternal = useCallback(
    (animalIds: string[]) => offloadAnimalsToOpfsArchiveUnqueued(actionDeps, animalIds),
    [
      loadFreshSnapshot,
      hydrateSnapshotForExport,
      replaceSnapshot,
      clearPhotoCache,
      selectedAnimalId,
      pedigreeAnimalId,
      clearSelectedAnimal,
      clearPedigreeAnimal,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
      buildArchivedBundle,
      storage,
    ]
  );

  const offloadAnimalsToOpfsArchive = useCallback(
    (animalIds: string[]) => offloadAnimalsToOpfsArchiveAction(actionDeps, animalIds),
    [enqueueStoreMutation, offloadAnimalsToOpfsArchiveInternal]
  );

  return { offloadAnimalsToOpfsArchive, offloadAnimalsToOpfsArchiveInternal };
}
