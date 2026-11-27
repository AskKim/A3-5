import { describe, expect, it, vi } from 'vitest';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import { BoundedPhotoDataCache } from '../../storage/photoHydration';
import type { StorageAdapter } from '../../storage/storageAdapter';
import {
  loadAnimalPhotoDataUrlWith,
  loadAnimalPhotoDataUrlsBatchWith,
  loadFeedBatchTagPhotoDataUrlWith,
  loadLedgerEntryReceiptPhotoDataUrlWith,
} from '../barnStore/usePhotoCache';

function mapCache(): BoundedPhotoDataCache {
  return new BoundedPhotoDataCache(16, 1 << 20);
}

const snapshotWithPhotos = {
  animalPhotos: [
    { id: 'p1', dataUrl: 'data:inline-1' },
    { id: 'p2', thumbnailDataUrl: 'data:thumb-2' },
  ],
  feedBatches: [
    { id: 'b1', tagPhotoDataUrl: 'data:tag-1' },
    { id: 'b2', tagPhotoThumbnailDataUrl: 'data:tag-thumb-2' },
  ],
  ledgerEntries: [
    { id: 'l1', receiptPhotoDataUrl: 'data:receipt-1' },
    { id: 'l2', receiptPhotoThumbnailDataUrl: 'data:receipt-thumb-2' },
  ],
} as unknown as BarnDatabaseSnapshot;

describe('loadAnimalPhotoDataUrlWith', () => {
  it('returns null for an empty id', async () => {
    const cache = mapCache();
    expect(await loadAnimalPhotoDataUrlWith(cache, { current: null }, null, '')).toBeNull();
  });

  it('serves from the cache first, then the snapshot, then the adapter, then the thumbnail', async () => {
    const cache = mapCache();
    const adapterRef = {
      current: {
        loadAnimalPhotoDataUrl: vi.fn(async (id: string) => (id === 'p3' ? 'data:from-adapter' : null)),
      } as unknown as StorageAdapter,
    };

    cache.set('p1', 'data:cached');
    expect(await loadAnimalPhotoDataUrlWith(cache, adapterRef, snapshotWithPhotos, 'p1')).toBe('data:cached');

    expect(await loadAnimalPhotoDataUrlWith(cache, adapterRef, snapshotWithPhotos, 'p3')).toBe('data:from-adapter');
    expect(cache.get('p3')).toBe('data:from-adapter');

    expect(await loadAnimalPhotoDataUrlWith(cache, adapterRef, snapshotWithPhotos, 'p2')).toBe('data:thumb-2');
  });

  it('caches a snapshot photo on first read', async () => {
    const cache = mapCache();
    const adapterRef = { current: null };
    expect(await loadAnimalPhotoDataUrlWith(cache, adapterRef, snapshotWithPhotos, 'p1')).toBe('data:inline-1');
    expect(cache.get('p1')).toBe('data:inline-1');
  });

  it('returns null when nothing can supply the photo', async () => {
    const cache = mapCache();
    const adapterRef = { current: { loadAnimalPhotoDataUrl: vi.fn(async () => null) } as unknown as StorageAdapter };
    expect(await loadAnimalPhotoDataUrlWith(cache, adapterRef, null, 'missing')).toBeNull();
  });
});

describe('loadAnimalPhotoDataUrlsBatchWith', () => {
  it('returns nothing for an empty or fully filtered request', async () => {
    const cache = mapCache();
    expect(await loadAnimalPhotoDataUrlsBatchWith(cache, { current: null }, { current: null }, [])).toEqual({});
    expect(await loadAnimalPhotoDataUrlsBatchWith(cache, { current: null }, { current: null }, [''])).toEqual({});
  });

  it('dedupes ids and caps the request at 60 photos', async () => {
    const cache = mapCache();
    const loadAnimalPhotoDataUrlsBatch = vi.fn(async (ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, `data:${id}`]))
    );
    const adapterRef = { current: { loadAnimalPhotoDataUrlsBatch } as unknown as StorageAdapter };
    const ids = ['a', 'a', 'b'];

    await loadAnimalPhotoDataUrlsBatchWith(cache, adapterRef, { current: null }, ids);

    expect(loadAnimalPhotoDataUrlsBatch).toHaveBeenCalledWith(['a', 'b']);
  });

  it('merges cache, snapshot and adapter results and falls back to thumbnails', async () => {
    const cache = mapCache();
    cache.set('p1', 'data:cached-p1');
    const adapterRef = {
      current: { loadAnimalPhotoDataUrlsBatch: vi.fn(async () => ({ p3: 'data:from-adapter' })) } as unknown as StorageAdapter,
    };

    const result = await loadAnimalPhotoDataUrlsBatchWith(cache, adapterRef, { current: snapshotWithPhotos }, [
      'p1',
      'p2',
      'p3',
      'p9',
    ]);

    expect(result).toEqual({ p1: 'data:cached-p1', p2: 'data:thumb-2', p3: 'data:from-adapter' });
  });

  it('survives a failing adapter batch and still returns thumbnails', async () => {
    const cache = mapCache();
    const adapterRef = {
      current: {
        loadAnimalPhotoDataUrlsBatch: vi.fn(async () => {
          throw new Error('adapter offline');
        }),
      } as unknown as StorageAdapter,
    };

    const result = await loadAnimalPhotoDataUrlsBatchWith(cache, adapterRef, { current: snapshotWithPhotos }, ['p2']);

    expect(result).toEqual({ p2: 'data:thumb-2' });
  });
});

describe('loadFeedBatchTagPhotoDataUrlWith', () => {
  it('uses a namespaced cache key so it cannot collide with animal photos', async () => {
    const cache = mapCache();
    cache.set('feed-tag:b1', 'data:cached-tag');
    expect(await loadFeedBatchTagPhotoDataUrlWith(cache, { current: null }, { current: null }, 'b1')).toBe(
      'data:cached-tag'
    );
  });

  it('reads from the snapshot, then the adapter, then the thumbnail', async () => {
    const cache = mapCache();
    const adapterRef = {
      current: {
        loadFeedBatchTagPhotoDataUrl: vi.fn(async (id: string) =>
          id === 'b3' ? 'data:adapter-tag' : null
        ),
      } as unknown as StorageAdapter,
    };
    const snapshotRef = { current: snapshotWithPhotos };

    expect(await loadFeedBatchTagPhotoDataUrlWith(cache, adapterRef, snapshotRef, 'b1')).toBe('data:tag-1');
    expect(await loadFeedBatchTagPhotoDataUrlWith(cache, adapterRef, snapshotRef, 'b3')).toBe('data:adapter-tag');
    expect(await loadFeedBatchTagPhotoDataUrlWith(cache, adapterRef, snapshotRef, 'b2')).toBe('data:tag-thumb-2');
    expect(cache.get('feed-tag:b3')).toBe('data:adapter-tag');
  });
});

describe('loadLedgerEntryReceiptPhotoDataUrlWith', () => {
  it('uses a namespaced cache key and keeps its own fallback chain', async () => {
    const cache = mapCache();
    cache.set('ledger-receipt:l1', 'data:cached-receipt');
    const adapterRef = {
      current: {
        loadLedgerEntryReceiptPhotoDataUrl: vi.fn(async (id: string) =>
          id === 'l3' ? 'data:adapter-receipt' : null
        ),
      } as unknown as StorageAdapter,
    };

    expect(await loadLedgerEntryReceiptPhotoDataUrlWith(cache, adapterRef, { current: null }, 'l1')).toBe(
      'data:cached-receipt'
    );
    expect(await loadLedgerEntryReceiptPhotoDataUrlWith(cache, adapterRef, { current: null }, 'l3')).toBe(
      'data:adapter-receipt'
    );
    expect(await loadLedgerEntryReceiptPhotoDataUrlWith(cache, adapterRef, { current: null }, 'l2')).toBeNull();
  });

  it('falls back to the receipt thumbnail from the snapshot', async () => {
    const cache = mapCache();
    expect(
      await loadLedgerEntryReceiptPhotoDataUrlWith(cache, { current: null }, { current: snapshotWithPhotos }, 'l2')
    ).toBe('data:receipt-thumb-2');
  });
});
