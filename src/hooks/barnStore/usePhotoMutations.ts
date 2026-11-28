/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The photo writes: add, choose the profile picture, reorder, and remove.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Animal photo mutations, extracted from `useBarnStore` as a sub-hook.
 *
 * Four writes over `animalPhotos`: add optimized payloads, change which photo is primary, retitle
 * one, delete one. They share the photo-specific rules that are easy to get wrong in isolation:
 * exactly one primary per animal, `sortOrder` appends after the existing rows, binary payloads never
 * enter the sync log (`ignoreFields` / `stripPhotoBlobsForSync`), and deleting the primary promotes
 * the next sibling in sort order.
 *
 * Ownership split: the store keeps the snapshot ref, the adapter and the photo cache; this slice
 * receives them as narrow functions.
 */
import { useCallback } from 'react';
import type { OptimizedImagePayload } from '../../domain/imageOptimizationSpec';
import type { Animal, AnimalPhoto, BarnDatabaseSnapshot } from '../../domain/models';
import { generateUuid } from '../../domain/models';
import {
  createOutboxOperation,
  diffEntityFieldsToOperations,
  stripPhotoBlobsForSync,
  type SyncOperation,
} from '../../domain/syncOutbox';
import { calculateSavingsPercent, formatByteSizePure } from '../../domain/imageOptimizationSpec';

const NO_BLOB_FIELDS = ['dataUrl', 'thumbnailDataUrl'] as const;

export interface PhotoMutationAdapter {
  saveAnimalPhotosBatch(photos: AnimalPhoto[]): Promise<void>;
  saveAnimalPhoto(photo: AnimalPhoto): Promise<void>;
  deleteAnimalPhoto(photoId: string): Promise<void>;
}

export interface PhotoMutationDeps {
  enqueueStoreMutation: <T>(task: () => Promise<T>) => Promise<T>;
  snapshotRef: { current: BarnDatabaseSnapshot | null };
  adapter: PhotoMutationAdapter;
  deviceId: string;
  nextEntityRev: (entityUuid: string, currentRev?: number) => number;
  allocateNextLogicalCounter: () => number;
  nowIsoUtc: () => string;
  recordOutboxOps: (operations: SyncOperation[]) => Promise<void>;
  reloadFromAdapter: () => Promise<void>;
  notify: (message: string) => void;
  reportPersistenceFailure: (action: string, error: unknown) => void;
  rememberPhoto: (photoId: string, dataUrl: string) => void;
  forgetPhoto: (photoId: string) => void;
}

/** Add optimized payloads to one animal; returns the animal's photo count afterwards. */
export async function addOptimizedAnimalPhotosAction(
  deps: PhotoMutationDeps,
  animal: Animal,
  payloads: Array<OptimizedImagePayload & { caption?: string }>
): Promise<number> {
  if (payloads.length === 0) return 0;
  return deps.enqueueStoreMutation(async () => {
    const currentSnapshot = deps.snapshotRef.current;
    const ts = deps.nowIsoUtc();
    const existingPhotos = (currentSnapshot?.animalPhotos ?? []).filter(
      (p) => p.animalId === animal.id
    );
    const hasPrimary = existingPhotos.some((p) => p.isPrimary);

    let origSum = 0;
    let storedSum = 0;

    const records: AnimalPhoto[] = payloads.map((pay, idx) => {
      origSum += pay.originalBytes;
      storedSum += pay.storedBytes;
      return {
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
        _rev: 1,
        createdAt: ts,
        updatedAt: ts,
      };
    });

    try {
      await deps.adapter.saveAnimalPhotosBatch(records);
      for (const rec of records) {
        deps.rememberPhoto(rec.id, rec.dataUrl);
      }
      // Metadata-only delta sync (binary blobs travel via .ZIP backups)
      await deps.recordOutboxOps(
        records.map((rec) =>
          createOutboxOperation({
            entityType: 'photo',
            entityUuid: rec.id,
            deviceId: deps.deviceId,
            logicalCounter: deps.allocateNextLogicalCounter(),
            fieldName: '__create__',
            newValue: stripPhotoBlobsForSync(rec),
            timestamp: ts,
            recordRev: rec._rev ?? 1,
          })
        )
      );
      await deps.reloadFromAdapter();

      const totalAfter = existingPhotos.length + records.length;
      const pct = calculateSavingsPercent(origSum, storedSum);
      deps.notify(
        pct > 0
          ? `Added ${records.length} photo${records.length === 1 ? '' : 's'} to ${
              animal.name
            } (${formatByteSizePure(origSum)} → ${formatByteSizePure(storedSum)} · saved ${pct}%).`
          : `Added ${records.length} photo${records.length === 1 ? '' : 's'} to ${animal.name}.`
      );
      return totalAfter;
    } catch (err) {
      deps.reportPersistenceFailure(`save photo(s) for ${animal.name}`, err);
      throw err;
    }
  });
}

/** Make one photo the primary cover and demote every sibling of the same animal. */
export async function setPrimaryAnimalPhotoAction(
  deps: PhotoMutationDeps,
  animalId: string,
  photoId: string
): Promise<void> {
  return deps.enqueueStoreMutation(async () => {
    const currentSnapshot = deps.snapshotRef.current;
    if (!currentSnapshot) return;
    const ts = deps.nowIsoUtc();
    const targetPhotos = (currentSnapshot.animalPhotos ?? []).filter((p) => p.animalId === animalId);
    if (targetPhotos.length === 0) return;

    const prevById = new Map(targetPhotos.map((p) => [p.id, p]));
    const updated = targetPhotos.map((p) => ({
      ...p,
      isPrimary: p.id === photoId,
      _rev: deps.nextEntityRev(p.id, p._rev),
      updatedAt: ts,
    }));
    try {
      await deps.adapter.saveAnimalPhotosBatch(updated);
      const photoOps = updated.flatMap((nextPhoto) =>
        diffEntityFieldsToOperations({
          entityType: 'photo',
          previous: prevById.get(nextPhoto.id),
          next: nextPhoto,
          deviceId: deps.deviceId,
          nextCounter: deps.allocateNextLogicalCounter,
          ignoreFields: [...NO_BLOB_FIELDS],
          timestamp: ts,
          recordRev: nextPhoto._rev,
        })
      );
      await deps.recordOutboxOps(photoOps);
      await deps.reloadFromAdapter();
      deps.notify('Primary cover photo updated (available for pedigrees).');
    } catch (err) {
      deps.reportPersistenceFailure('update primary cover photo', err);
    }
  });
}

/** Retitle one photo. Deliberately silent on success. */
export async function updateAnimalPhotoCaptionAction(
  deps: PhotoMutationDeps,
  photoId: string,
  caption: string
): Promise<void> {
  return deps.enqueueStoreMutation(async () => {
    const currentSnapshot = deps.snapshotRef.current;
    if (!currentSnapshot) return;
    const found = (currentSnapshot.animalPhotos ?? []).find((p) => p.id === photoId);
    if (!found) return;
    const ts = deps.nowIsoUtc();
    const nextPhoto: AnimalPhoto = {
      ...found,
      caption: caption.trim(),
      _rev: deps.nextEntityRev(found.id, found._rev),
      updatedAt: ts,
    };
    try {
      await deps.adapter.saveAnimalPhoto(nextPhoto);
      await deps.recordOutboxOps(
        diffEntityFieldsToOperations({
          entityType: 'photo',
          previous: found,
          next: nextPhoto,
          deviceId: deps.deviceId,
          nextCounter: deps.allocateNextLogicalCounter,
          ignoreFields: [...NO_BLOB_FIELDS],
          timestamp: ts,
          recordRev: nextPhoto._rev,
        })
      );
      await deps.reloadFromAdapter();
    } catch (err) {
      deps.reportPersistenceFailure('update photo caption', err);
    }
  });
}

/** Delete a photo, promoting the next sibling when the primary was removed. */
export async function deleteAnimalPhotoAction(
  deps: PhotoMutationDeps,
  photoId: string
): Promise<void> {
  return deps.enqueueStoreMutation(async () => {
    const currentSnapshot = deps.snapshotRef.current;
    if (!currentSnapshot) return;
    const all = currentSnapshot.animalPhotos ?? [];
    const target = all.find((p) => p.id === photoId);
    const ts = deps.nowIsoUtc();
    try {
      await deps.adapter.deleteAnimalPhoto(photoId);
      deps.forgetPhoto(photoId);
      const ops: SyncOperation[] = [
        createOutboxOperation({
          entityType: 'photo',
          entityUuid: photoId,
          deviceId: deps.deviceId,
          logicalCounter: deps.allocateNextLogicalCounter(),
          fieldName: '__delete__',
          newValue: true,
          timestamp: ts,
          recordRev: deps.nextEntityRev(photoId, target?._rev),
        }),
      ];

      if (target && target.isPrimary) {
        const siblings = all
          .filter((p) => p.animalId === target.animalId && p.id !== photoId)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        if (siblings.length > 0) {
          const promoted: AnimalPhoto = {
            ...siblings[0],
            isPrimary: true,
            _rev: deps.nextEntityRev(siblings[0].id, siblings[0]._rev),
            updatedAt: ts,
          };
          await deps.adapter.saveAnimalPhoto(promoted);
          ops.push(
            ...diffEntityFieldsToOperations({
              entityType: 'photo',
              previous: siblings[0],
              next: promoted,
              deviceId: deps.deviceId,
              nextCounter: deps.allocateNextLogicalCounter,
              ignoreFields: [...NO_BLOB_FIELDS],
              timestamp: ts,
              recordRev: promoted._rev,
            })
          );
        }
      }
      await deps.recordOutboxOps(ops);
      await deps.reloadFromAdapter();
      deps.notify('Photo removed.');
    } catch (err) {
      deps.reportPersistenceFailure('delete photo', err);
    }
  });
}

export interface PhotoMutations {
  addOptimizedAnimalPhotos: (
    animal: Animal,
    payloads: Array<OptimizedImagePayload & { caption?: string }>
  ) => Promise<number>;
  setPrimaryAnimalPhoto: (animalId: string, photoId: string) => Promise<void>;
  updateAnimalPhotoCaption: (photoId: string, caption: string) => Promise<void>;
  deleteAnimalPhoto: (photoId: string) => Promise<void>;
}

export function usePhotoMutations(deps: PhotoMutationDeps): PhotoMutations {
  const addOptimizedAnimalPhotos = useCallback(
    (animal: Animal, payloads: Array<OptimizedImagePayload & { caption?: string }>) =>
      addOptimizedAnimalPhotosAction(deps, animal, payloads),
    [
      deps.enqueueStoreMutation,
      deps.deviceId,
      deps.recordOutboxOps,
      deps.reloadFromAdapter,
      deps.notify,
      deps.reportPersistenceFailure,
      deps.adapter,
      deps.rememberPhoto,
      deps.snapshotRef,
      deps.nowIsoUtc,
      deps.allocateNextLogicalCounter,
    ]
  );

  const setPrimaryAnimalPhoto = useCallback(
    (animalId: string, photoId: string) => setPrimaryAnimalPhotoAction(deps, animalId, photoId),
    [
      deps.enqueueStoreMutation,
      deps.deviceId,
      deps.nextEntityRev,
      deps.recordOutboxOps,
      deps.reloadFromAdapter,
      deps.notify,
      deps.reportPersistenceFailure,
      deps.adapter,
    ]
  );

  const updateAnimalPhotoCaption = useCallback(
    (photoId: string, caption: string) => updateAnimalPhotoCaptionAction(deps, photoId, caption),
    [
      deps.enqueueStoreMutation,
      deps.deviceId,
      deps.nextEntityRev,
      deps.recordOutboxOps,
      deps.reloadFromAdapter,
      deps.reportPersistenceFailure,
      deps.adapter,
    ]
  );

  const deleteAnimalPhoto = useCallback(
    (photoId: string) => deleteAnimalPhotoAction(deps, photoId),
    [
      deps.enqueueStoreMutation,
      deps.deviceId,
      deps.nextEntityRev,
      deps.recordOutboxOps,
      deps.reloadFromAdapter,
      deps.notify,
      deps.reportPersistenceFailure,
      deps.adapter,
      deps.forgetPhoto,
    ]
  );

  return { addOptimizedAnimalPhotos, setPrimaryAnimalPhoto, updateAnimalPhotoCaption, deleteAnimalPhoto };
}
