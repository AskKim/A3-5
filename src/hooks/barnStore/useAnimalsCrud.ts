/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Adding, editing, archiving and deleting animals, all written through one queue.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Animal create/update/archive/delete, extracted from `useBarnStore` as a sub-hook.
 *
 * These four actions share one shape: serialise through `enqueueStoreMutation`, read the committed
 * snapshot, build revisioned rows, write rows and outbox operations together, reload, then toast.
 * Keeping them together is what makes the invariants visible — every animal row that changes gets a
 * `_rev` bump and a matching outbox operation, and a destructive delete writes a safety snapshot
 * before it unlinks or removes anything.
 *
 * Ownership split: the store keeps the snapshot ref, the adapter instance, the mutation queue and
 * the selection state; this slice receives them as narrow functions and never reads React state
 * except through the documented fallback.
 */
import { useCallback } from 'react';
import type { AnimalSaveDraft } from '../../domain/animalConflicts';
import { ConcurrentEditConflictError, mergeConcurrentAnimalEdit } from '../../domain/animalConflicts';
import type { OptimizedImagePayload } from '../../domain/imageOptimizationSpec';
import type {
  Animal,
  AnimalPhoto,
  BarnDatabaseSnapshot,
} from '../../domain/models';
import {
  generateUuid,
  isSameSpecies,
  normalizeIgnoredConflicts,
  normalizeRufusLevel,
  reconcileCarrierTraitLists,
} from '../../domain/models';
import {
  createOutboxOperation,
  diffEntityFieldsToOperations,
  type SyncOperation,
} from '../../domain/syncOutbox';
import { logDiagnosticEvent } from '../../storage/crashLogger';

/** The adapter methods animal mutations use. */
export interface AnimalsCrudAdapter {
  saveAnimal(animal: Animal): Promise<void>;
  saveAnimalPhotosBatch(photos: AnimalPhoto[]): Promise<void>;
  saveAnimalsBatch(animals: Animal[]): Promise<void>;
  deleteAnimalsBatch(ids: string[]): Promise<void>;
  syncFromPersistedStorageIfStale?: () => Promise<boolean>;
}

export interface AnimalsCrudDeps {
  enqueueStoreMutation: <T>(task: () => Promise<T>) => Promise<T>;
  snapshotRef: { current: BarnDatabaseSnapshot | null };
  /** React-state snapshot; only a fallback for when `snapshotRef.current` is still empty. */
  fallbackSnapshot: BarnDatabaseSnapshot | null;
  adapter: AnimalsCrudAdapter;
  deviceId: string;
  nextEntityRev: (entityUuid: string, currentRev?: number) => number;
  allocateNextLogicalCounter: () => number;
  nowIsoUtc: () => string;
  recordOutboxOps: (operations: SyncOperation[]) => Promise<void>;
  reloadFromAdapter: () => Promise<void>;
  reloadFromAdapterSilently: () => Promise<void>;
  notify: (message: string) => void;
  reportPersistenceFailure: (action: string, error: unknown) => void;
  rememberPhoto: (photoId: string, dataUrl: string) => void;
  forgetPhoto: (photoId: string) => void;
  saveSafetyRollingBackup: (snapshot: BarnDatabaseSnapshot) => Promise<unknown>;
  selectedAnimalId: string | null;
  pedigreeAnimalId: string | null;
  clearSelectedAnimal: () => void;
  clearPedigreeAnimal: () => void;
  isOpfsSupported: () => boolean;
  /** Late-bound: the offload action is created after this hook, so it is read at call time. */
  getOffloadAnimals: () => ((animalIds: string[]) => Promise<unknown | null>) | null;
}

/** Create or update one animal, optionally linking it as a parent and attaching photos. */
export async function saveAnimalAction(
  deps: AnimalsCrudDeps,
  draft: AnimalSaveDraft,
  linkParentTarget?: { childId: string; asSire: boolean },
  initialPhotos?: Array<OptimizedImagePayload & { caption?: string }>
): Promise<string | null> {
  return deps.enqueueStoreMutation(async () => {
    const adapter = deps.adapter;
    if (adapter.syncFromPersistedStorageIfStale) {
      const synced = await adapter.syncFromPersistedStorageIfStale().catch(() => false);
      if (synced) {
        await deps.reloadFromAdapterSilently();
      }
    }
    const { _concurrentBase, _forceConcurrentOverwrite, ...cleanDraft } = draft;
    const latestSnapshot = deps.snapshotRef.current ?? deps.fallbackSnapshot;
    const previous = cleanDraft.id
      ? latestSnapshot?.animals.find((a) => a.id === cleanDraft.id)
      : undefined;
    const hasExplicitRaw = typeof cleanDraft.genotypeRaw === 'string';
    const trimmedRaw = (cleanDraft.genotypeRaw || '').trim();
    const needsGeneticsEngine =
      (hasExplicitRaw && Boolean(trimmedRaw)) ||
      (!hasExplicitRaw && Boolean(cleanDraft.genotype && cleanDraft.genotype.length > 0));
    let parsedGeno =
      !hasExplicitRaw && cleanDraft.genotype && cleanDraft.genotype.length > 0
        ? cleanDraft.genotype
        : [];
    let normalizedRaw = trimmedRaw;
    if (needsGeneticsEngine) {
      const { formatGenotypeArray, parseGenotypeString } = await import('../../domain/geneticsEngine');
      if (hasExplicitRaw && trimmedRaw) {
        parsedGeno =
          cleanDraft.genotype &&
          cleanDraft.genotype.length > 0 &&
          formatGenotypeArray(cleanDraft.genotype) === trimmedRaw
            ? cleanDraft.genotype
            : parseGenotypeString(trimmedRaw, cleanDraft.species);
      }
      normalizedRaw = trimmedRaw || (hasExplicitRaw ? '' : formatGenotypeArray(parsedGeno));
    }

    const carriers = reconcileCarrierTraitLists(
      cleanDraft.suspectedCarrierOf,
      cleanDraft.confirmedCarrierOf,
      cleanDraft.clearedCarrierOf
    );

    const resolvedIgnored = normalizeIgnoredConflicts(
      cleanDraft.ignoredConflicts ?? previous?.ignoredConflicts
    );

    const animalId = cleanDraft.id || generateUuid();
    const rev = deps.nextEntityRev(animalId, previous?._rev);
    let adjustedTs = deps.nowIsoUtc();
    if (previous?.updatedAt && adjustedTs <= previous.updatedAt) {
      const prevMs = Date.parse(previous.updatedAt);
      if (Number.isFinite(prevMs)) {
        adjustedTs = new Date(prevMs + 1).toISOString();
      }
    }

    const candidateAnimal: Animal = {
      ...cleanDraft,
      id: animalId,
      tattoo: cleanDraft.tattoo.trim(),
      name: cleanDraft.name.trim(),
      archived: Boolean(cleanDraft.archived),
      needsAttention: Boolean(cleanDraft.needsAttention),
      ignoredConflicts: resolvedIgnored,
      genotype: parsedGeno,
      genotypeRaw: normalizedRaw,
      rufusLevel: normalizeRufusLevel(cleanDraft.rufusLevel),
      suspectedCarrierOf: carriers.suspectedCarrierOf,
      confirmedCarrierOf: carriers.confirmedCarrierOf,
      clearedCarrierOf: carriers.clearedCarrierOf,
      _rev: rev,
      createdAt: cleanDraft.createdAt || previous?.createdAt || adjustedTs,
      updatedAt: adjustedTs,
    };

    let animal = candidateAnimal;
    let mergedRemoteLabels: string[] = [];
    if (previous && _concurrentBase && !_forceConcurrentOverwrite) {
      const mergeResult = mergeConcurrentAnimalEdit({
        base: _concurrentBase,
        remote: previous,
        local: candidateAnimal,
      });
      if (mergeResult.status === 'conflict') {
        throw new ConcurrentEditConflictError(mergeResult.conflictingFields, previous);
      }
      if (mergeResult.status === 'merged') {
        animal = mergeResult.mergedAnimal;
        mergedRemoteLabels = mergeResult.mergedRemoteFields.map((f) => f.label);
      }
    }

    try {
      await adapter.saveAnimal(animal);
      await deps.recordOutboxOps(
        diffEntityFieldsToOperations({
          entityType: 'animal',
          previous,
          next: animal,
          deviceId: deps.deviceId,
          nextCounter: deps.allocateNextLogicalCounter,
          timestamp: adjustedTs,
          recordRev: rev,
        })
      );

      if (initialPhotos && initialPhotos.length > 0) {
        const existingPhotos = (latestSnapshot?.animalPhotos ?? []).filter(
          (p) => p.animalId === animal.id
        );
        const hasPrimary = existingPhotos.some((p) => p.isPrimary);
        const newPhotoRecords: AnimalPhoto[] = initialPhotos.map((pay, idx) => ({
          id: generateUuid(),
          species: animal.species,
          animalId: animal.id,
          isPrimary: !hasPrimary && idx === 0,
          sortOrder: existingPhotos.length + idx,
          caption: (pay.caption || '').trim(),
          originalFileName: pay.originalFileName,
          mimeType: pay.mimeType,
          width: pay.width,
          height: pay.height,
          originalBytes: pay.originalBytes,
          storedBytes: pay.storedBytes,
          thumbnailDataUrl: pay.thumbnailDataUrl,
          dataUrl: pay.dataUrl,
          createdAt: adjustedTs,
          updatedAt: adjustedTs,
        }));
        await adapter.saveAnimalPhotosBatch(newPhotoRecords);
        for (const rec of newPhotoRecords) {
          deps.rememberPhoto(rec.id, rec.dataUrl);
        }
      }

      if (linkParentTarget && latestSnapshot) {
        const child = latestSnapshot.animals.find((a) => a.id === linkParentTarget.childId);
        const expectedSex = linkParentTarget.asSire ? 'Male' : 'Female';
        if (child && isSameSpecies(child.species, animal.species) && child.id !== animal.id) {
          if (animal.sex !== expectedSex) {
            logDiagnosticEvent({
              level: 'warn',
              category: 'storage',
              message: `Prevented parent sex mismatch when linking "${animal.name}" (${animal.sex}) as ${
                linkParentTarget.asSire ? 'Sire' : 'Dam'
              } of "${child.name}"`,
            });
          } else {
            const childRev = deps.nextEntityRev(child.id, child._rev);
            const updatedChild: Animal = {
              ...child,
              sireId: linkParentTarget.asSire ? animal.id : child.sireId,
              damId: !linkParentTarget.asSire ? animal.id : child.damId,
              _rev: childRev,
              updatedAt: adjustedTs,
            };
            await adapter.saveAnimal(updatedChild);
            await deps.recordOutboxOps(
              diffEntityFieldsToOperations({
                entityType: 'animal',
                previous: child,
                next: updatedChild,
                deviceId: deps.deviceId,
                nextCounter: deps.allocateNextLogicalCounter,
                timestamp: adjustedTs,
                recordRev: childRev,
              })
            );
          }
        }
      }

      await deps.reloadFromAdapter();
      const baseNotify =
        initialPhotos && initialPhotos.length > 0
          ? `${animal.name} saved with ${initialPhotos.length} optimized photo(s).`
          : `${animal.name} (${animal.tattoo || 'No ID'}) saved.`;
      deps.notify(
        mergedRemoteLabels.length > 0
          ? `${baseNotify} Merged concurrent updates (${mergedRemoteLabels.join(', ')}).`
          : baseNotify
      );
      return animal.id;
    } catch (err) {
      deps.reportPersistenceFailure(`save ${animal.name}`, err);
      return null;
    }
  });
}

/** Archive or restore a batch of animals, auto-offloading retired stock when configured. */
export async function archiveAnimalsAction(
  deps: AnimalsCrudDeps,
  animalIds: string[],
  archived: boolean
): Promise<void> {
  if (animalIds.length === 0) return;
  return deps.enqueueStoreMutation(async () => {
    const currentSnapshot = deps.snapshotRef.current;
    if (!currentSnapshot) return;
    const idSet = new Set(animalIds);
    const ts = deps.nowIsoUtc();
    const ops: SyncOperation[] = [];
    const updatedBatch: Animal[] = [];

    for (const animal of currentSnapshot.animals) {
      if (!idSet.has(animal.id)) continue;
      const rev = deps.nextEntityRev(animal.id, animal._rev);
      const nextStatus =
        !archived &&
        (animal.status === 'Archived' ||
          animal.status === 'Deceased' ||
          animal.status === 'Sold' ||
          animal.status === 'Retired')
          ? 'Active'
          : archived && (animal.status === 'Active' || animal.status === 'Junior')
          ? 'Archived'
          : animal.status;
      const updated: Animal = {
        ...animal,
        archived,
        status: nextStatus,
        _rev: rev,
        updatedAt: ts,
      };
      updatedBatch.push(updated);
      ops.push(
        ...diffEntityFieldsToOperations({
          entityType: 'animal',
          previous: animal,
          next: updated,
          deviceId: deps.deviceId,
          nextCounter: deps.allocateNextLogicalCounter,
          timestamp: ts,
          recordRev: rev,
        })
      );
    }

    try {
      if (updatedBatch.length > 0) {
        await deps.adapter.saveAnimalsBatch(updatedBatch);
      }
      await deps.recordOutboxOps(ops);
      const autoOffloadIds =
        archived && currentSnapshot.settings.autoOffloadRetiredToOpfs && deps.isOpfsSupported()
          ? updatedBatch
              .filter((a) => a.status === 'Sold' || a.status === 'Deceased')
              .map((a) => a.id)
          : [];
      const offload = deps.getOffloadAnimals();
      if (autoOffloadIds.length > 0 && offload) {
        const offloaded = await offload(autoOffloadIds);
        if (offloaded) return;
      }
      await deps.reloadFromAdapter();
      deps.notify(
        archived
          ? `Moved ${animalIds.length} animal${animalIds.length === 1 ? '' : 's'} to Archived (retained for pedigrees).`
          : `Restored ${animalIds.length} animal${animalIds.length === 1 ? '' : 's'} back to Active herd.`
      );
    } catch (err) {
      deps.reportPersistenceFailure(archived ? 'archive animal(s)' : 'restore animal(s)', err);
    }
  });
}

/** Delete animals after a safety snapshot, unlinking offspring parent references first. */
export async function deleteAnimalsBatchAction(
  deps: AnimalsCrudDeps,
  animalIds: string[]
): Promise<void> {
  if (animalIds.length === 0) return;
  return deps.enqueueStoreMutation(async () => {
    const currentSnapshot = deps.snapshotRef.current;
    if (!currentSnapshot) return;
    try {
      await deps.saveSafetyRollingBackup(currentSnapshot);
      const idSet = new Set(animalIds);
      const ts = deps.nowIsoUtc();
      const ops: SyncOperation[] = [];

      // Unlink offspring sire/dam references pointing to deleted animals in a single batch
      const unlinkedChildren: Animal[] = [];
      for (const a of currentSnapshot.animals) {
        if (idSet.has(a.id)) continue;
        const clearSire = a.sireId && idSet.has(a.sireId);
        const clearDam = a.damId && idSet.has(a.damId);
        if (clearSire || clearDam) {
          const childRev = deps.nextEntityRev(a.id, a._rev);
          const nextChild: Animal = {
            ...a,
            sireId: clearSire ? '' : a.sireId,
            damId: clearDam ? '' : a.damId,
            _rev: childRev,
            updatedAt: ts,
          };
          unlinkedChildren.push(nextChild);
          ops.push(
            ...diffEntityFieldsToOperations({
              entityType: 'animal',
              previous: a,
              next: nextChild,
              deviceId: deps.deviceId,
              nextCounter: deps.allocateNextLogicalCounter,
              timestamp: ts,
              recordRev: childRev,
            })
          );
        }
      }
      if (unlinkedChildren.length > 0) {
        await deps.adapter.saveAnimalsBatch(unlinkedChildren);
      }

      await deps.adapter.deleteAnimalsBatch(Array.from(idSet));
      for (const photo of currentSnapshot.animalPhotos ?? []) {
        if (idSet.has(photo.animalId)) {
          deps.forgetPhoto(photo.id);
        }
      }
      for (const id of idSet) {
        const deletedAnimal = currentSnapshot.animals.find((a) => a.id === id);
        ops.push(
          createOutboxOperation({
            entityType: 'animal',
            entityUuid: id,
            deviceId: deps.deviceId,
            logicalCounter: deps.allocateNextLogicalCounter(),
            fieldName: '__delete__',
            newValue: true,
            timestamp: ts,
            recordRev: deps.nextEntityRev(id, deletedAnimal?._rev),
          })
        );
      }

      if (deps.selectedAnimalId && idSet.has(deps.selectedAnimalId)) deps.clearSelectedAnimal();
      if (deps.pedigreeAnimalId && idSet.has(deps.pedigreeAnimalId)) deps.clearPedigreeAnimal();
      await deps.recordOutboxOps(ops);
      await deps.reloadFromAdapter();
      deps.notify(`Deleted ${idSet.size} selected animal${idSet.size === 1 ? '' : 's'}.`);
    } catch (err) {
      deps.reportPersistenceFailure('delete selected animal(s)', err);
    }
  });
}

/** Delete a single animal; a thin wrapper so callers never re-implement the batch path. */
export function deleteAnimalAction(deps: AnimalsCrudDeps, animal: Animal): Promise<void> {
  return deleteAnimalsBatchAction(deps, [animal.id]);
}

export interface AnimalsCrud {
  saveAnimal: (
    draft: AnimalSaveDraft,
    linkParentTarget?: { childId: string; asSire: boolean },
    initialPhotos?: Array<OptimizedImagePayload & { caption?: string }>
  ) => Promise<string | null>;
  archiveAnimals: (animalIds: string[], archived: boolean) => Promise<void>;
  deleteAnimalsBatch: (animalIds: string[]) => Promise<void>;
  deleteAnimal: (animal: Animal) => Promise<void>;
}

/** Actions are plain functions, so the hook only supplies stable, dependency-tracked wrappers. */
export function useAnimalsCrud(deps: AnimalsCrudDeps): AnimalsCrud {
  const saveAnimal = useCallback(
    (
      draft: AnimalSaveDraft,
      linkParentTarget?: { childId: string; asSire: boolean },
      initialPhotos?: Array<OptimizedImagePayload & { caption?: string }>
    ) => saveAnimalAction(deps, draft, linkParentTarget, initialPhotos),
    [
      deps.fallbackSnapshot,
      deps.deviceId,
      deps.nextEntityRev,
      deps.enqueueStoreMutation,
      deps.recordOutboxOps,
      deps.reloadFromAdapter,
      deps.reloadFromAdapterSilently,
      deps.notify,
      deps.reportPersistenceFailure,
      deps.adapter,
    ]
  );

  const archiveAnimals = useCallback(
    (animalIds: string[], archived: boolean) => archiveAnimalsAction(deps, animalIds, archived),
    [deps.enqueueStoreMutation, deps.deviceId, deps.nextEntityRev, deps.recordOutboxOps, deps.reloadFromAdapter, deps.notify, deps.reportPersistenceFailure, deps.adapter, deps.getOffloadAnimals, deps.isOpfsSupported]
  );

  const deleteAnimalsBatch = useCallback(
    (animalIds: string[]) => deleteAnimalsBatchAction(deps, animalIds),
    [deps.enqueueStoreMutation, deps.saveSafetyRollingBackup, deps.selectedAnimalId, deps.pedigreeAnimalId, deps.deviceId, deps.nextEntityRev, deps.recordOutboxOps, deps.reloadFromAdapter, deps.notify, deps.reportPersistenceFailure, deps.adapter, deps.forgetPhoto]
  );

  const deleteAnimal = useCallback(
    (animal: Animal) => deleteAnimalAction(deps, animal),
    [deleteAnimalsBatch, deps]
  );

  return { saveAnimal, archiveAnimals, deleteAnimalsBatch, deleteAnimal };
}
