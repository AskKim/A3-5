/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Bounded photo cache and its loaders, extracted from `useBarnStore`.
 *
 * The cache is a transient LRU of photo data URLs, sized from the device capability tier. The four
 * loaders share one lookup order: cache, then the live snapshot, then the storage adapter, then the
 * snapshot's thumbnail. The plain `*With` functions hold that order so it can be tested without a
 * React renderer; the sub-hook only creates the cache once and supplies callback identity.
 */
import { useCallback, useRef, useState, type MutableRefObject } from 'react';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import { detectCurrentDeviceCapability } from '../../storage/deviceCapabilityDetector';
import { BoundedPhotoDataCache } from '../../storage/photoHydration';
import type { StorageAdapter } from '../../storage/storageAdapter';
import { getPhotoCacheBudgetForTier } from './photoCacheBudget';

/** Creates the cache once per mount, sized for this device. */
export function createBudgetedPhotoCache(): BoundedPhotoDataCache {
  const cap = detectCurrentDeviceCapability();
  const budget = getPhotoCacheBudgetForTier(cap.tier);
  return new BoundedPhotoDataCache(budget.maxEntries, budget.maxBytes);
}

/**
 * Imperative cache mutations for store actions outside this slice (uploads, deletions, resets).
 * They take the ref rather than the instance so callers never touch `.current` directly.
 */
export function rememberPhoto(
  photoCacheRef: MutableRefObject<BoundedPhotoDataCache>,
  id: string,
  dataUrl: string
): void {
  photoCacheRef.current.set(id, dataUrl);
}

export function forgetPhoto(
  photoCacheRef: MutableRefObject<BoundedPhotoDataCache>,
  id: string
): void {
  photoCacheRef.current.delete(id);
}

export function clearPhotoCache(photoCacheRef: MutableRefObject<BoundedPhotoDataCache>): void {
  photoCacheRef.current.clear();
}

export interface PhotoCacheDeps {
  adapterRef: MutableRefObject<StorageAdapter | null>;
  snapshotRef: MutableRefObject<BarnDatabaseSnapshot | null>;
  /** Live snapshot state; the single-photo loader closes over it exactly as the hook did. */
  snapshot: BarnDatabaseSnapshot | null;
}

export async function loadAnimalPhotoDataUrlWith(
  cache: BoundedPhotoDataCache,
  adapterRef: MutableRefObject<StorageAdapter | null>,
  snapshot: BarnDatabaseSnapshot | null,
  photoId: string
): Promise<string | null> {
  if (!photoId) return null;
  const cached = cache.get(photoId);
  if (cached) return cached;
  const inState = (snapshot?.animalPhotos ?? []).find((p) => p.id === photoId);
  if (inState?.dataUrl) {
    cache.set(photoId, inState.dataUrl);
    return inState.dataUrl;
  }
  const fetched = await adapterRef.current?.loadAnimalPhotoDataUrl?.(photoId);
  if (fetched) {
    cache.set(photoId, fetched);
    return fetched;
  }
  return inState?.thumbnailDataUrl || null;
}

export async function loadAnimalPhotoDataUrlsBatchWith(
  cache: BoundedPhotoDataCache | null,
  adapterRef: MutableRefObject<StorageAdapter | null>,
  snapshotRef: MutableRefObject<BarnDatabaseSnapshot | null>,
  photoIds: string[]
): Promise<Record<string, string>> {
  const uniqueIds = Array.from(new Set(photoIds.filter((id) => Boolean(id)))).slice(0, 60);
  if (uniqueIds.length === 0) return {};

  const result: Record<string, string> = {};
  const missing: string[] = [];
  const photoById = new Map((snapshotRef.current?.animalPhotos ?? []).map((p) => [p.id, p]));

  for (const id of uniqueIds) {
    const cached = cache?.get(id);
    if (cached) {
      result[id] = cached;
      continue;
    }
    const inState = photoById.get(id);
    if (inState?.dataUrl) {
      cache?.set(id, inState.dataUrl);
      result[id] = inState.dataUrl;
      continue;
    }
    missing.push(id);
  }

  if (missing.length > 0 && adapterRef.current?.loadAnimalPhotoDataUrlsBatch) {
    try {
      const fetched = await adapterRef.current.loadAnimalPhotoDataUrlsBatch(missing);
      for (const id of missing) {
        const url = fetched[id];
        if (url) {
          cache?.set(id, url);
          result[id] = url;
        }
      }
    } catch {
      // Fall back to thumbnails below without disrupting print preview
    }
  }

  for (const id of uniqueIds) {
    if (!result[id]) {
      const thumb = photoById.get(id)?.thumbnailDataUrl;
      if (thumb) result[id] = thumb;
    }
  }

  return result;
}

export async function loadFeedBatchTagPhotoDataUrlWith(
  cache: BoundedPhotoDataCache | null,
  adapterRef: MutableRefObject<StorageAdapter | null>,
  snapshotRef: MutableRefObject<BarnDatabaseSnapshot | null>,
  batchId: string
): Promise<string | null> {
  if (!batchId) return null;
  const cacheKey = `feed-tag:${batchId}`;
  const cached = cache?.get(cacheKey);
  if (cached) return cached;
  const inState = (snapshotRef.current?.feedBatches ?? []).find((b) => b.id === batchId);
  if (inState?.tagPhotoDataUrl) {
    cache?.set(cacheKey, inState.tagPhotoDataUrl);
    return inState.tagPhotoDataUrl;
  }
  const fetched = await adapterRef.current?.loadFeedBatchTagPhotoDataUrl?.(batchId);
  if (fetched) {
    cache?.set(cacheKey, fetched);
    return fetched;
  }
  return inState?.tagPhotoThumbnailDataUrl || null;
}

export async function loadLedgerEntryReceiptPhotoDataUrlWith(
  cache: BoundedPhotoDataCache | null,
  adapterRef: MutableRefObject<StorageAdapter | null>,
  snapshotRef: MutableRefObject<BarnDatabaseSnapshot | null>,
  entryId: string
): Promise<string | null> {
  if (!entryId) return null;
  const cacheKey = `ledger-receipt:${entryId}`;
  const cached = cache?.get(cacheKey);
  if (cached) return cached;
  const inState = (snapshotRef.current?.ledgerEntries ?? []).find((le) => le.id === entryId);
  if (inState?.receiptPhotoDataUrl) {
    cache?.set(cacheKey, inState.receiptPhotoDataUrl);
    return inState.receiptPhotoDataUrl;
  }
  const fetched = await adapterRef.current?.loadLedgerEntryReceiptPhotoDataUrl?.(entryId);
  if (fetched) {
    cache?.set(cacheKey, fetched);
    return fetched;
  }
  return inState?.receiptPhotoThumbnailDataUrl || null;
}

export interface PhotoCache {
  photoCacheRef: MutableRefObject<BoundedPhotoDataCache>;
  loadAnimalPhotoDataUrl: (photoId: string) => Promise<string | null>;
  loadAnimalPhotoDataUrlsBatch: (photoIds: string[]) => Promise<Record<string, string>>;
  loadFeedBatchTagPhotoDataUrl: (batchId: string) => Promise<string | null>;
  loadLedgerEntryReceiptPhotoDataUrl: (entryId: string) => Promise<string | null>;
}

export function usePhotoCache({ adapterRef, snapshotRef, snapshot }: PhotoCacheDeps): PhotoCache {
  const [initialCache] = useState<BoundedPhotoDataCache>(createBudgetedPhotoCache);
  const photoCacheRef = useRef<BoundedPhotoDataCache>(initialCache);

  const loadAnimalPhotoDataUrl = useCallback(
    (photoId: string) =>
      loadAnimalPhotoDataUrlWith(photoCacheRef.current, adapterRef, snapshot, photoId),
    [adapterRef, snapshot]
  );

  const loadAnimalPhotoDataUrlsBatch = useCallback(
    (photoIds: string[]) =>
      loadAnimalPhotoDataUrlsBatchWith(photoCacheRef.current, adapterRef, snapshotRef, photoIds),
    [adapterRef, snapshotRef]
  );

  const loadFeedBatchTagPhotoDataUrl = useCallback(
    (batchId: string) =>
      loadFeedBatchTagPhotoDataUrlWith(photoCacheRef.current, adapterRef, snapshotRef, batchId),
    [adapterRef, snapshotRef]
  );

  const loadLedgerEntryReceiptPhotoDataUrl = useCallback(
    (entryId: string) =>
      loadLedgerEntryReceiptPhotoDataUrlWith(photoCacheRef.current, adapterRef, snapshotRef, entryId),
    [adapterRef, snapshotRef]
  );

  return {
    photoCacheRef,
    loadAnimalPhotoDataUrl,
    loadAnimalPhotoDataUrlsBatch,
    loadFeedBatchTagPhotoDataUrl,
    loadLedgerEntryReceiptPhotoDataUrl,
  };
}
