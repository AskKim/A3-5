import { describe, expect, it, vi } from 'vitest';
import type { Animal, AnimalPhoto, BarnDatabaseSnapshot } from '../../domain/models';
import {
  addOptimizedAnimalPhotosAction,
  deleteAnimalPhotoAction,
  setPrimaryAnimalPhotoAction,
  updateAnimalPhotoCaptionAction,
  type PhotoMutationDeps,
} from '../barnStore/usePhotoMutations';

const animal = { id: 'a1', name: 'Doe', species: 'Rabbit' } as Animal;

const photo = (over: Partial<AnimalPhoto> = {}): AnimalPhoto =>
  ({
    id: 'p1',
    animalId: 'a1',
    species: 'Rabbit',
    isPrimary: false,
    sortOrder: 0,
    caption: '',
    dataUrl: 'data:image/webp;base64,AA',
    thumbnailDataUrl: 'data:image/webp;base64,TT',
    _rev: 1,
    ...over,
  }) as AnimalPhoto;

const payload = (over: Record<string, unknown> = {}) =>
  ({
    originalFileName: 'one.webp',
    mimeType: 'image/webp',
    width: 100,
    height: 100,
    originalBytes: 1000,
    storedBytes: 400,
    thumbnailDataUrl: 'data:image/webp;base64,TT',
    dataUrl: 'data:image/webp;base64,AA',
    ...over,
  }) as never;

const snapshotOf = (photos: AnimalPhoto[]) =>
  ({ animals: [animal], animalPhotos: photos, settings: {} } as unknown as BarnDatabaseSnapshot);

function makeDeps(photos: AnimalPhoto[] = []) {
  const calls: string[] = [];
  const deps: PhotoMutationDeps = {
    enqueueStoreMutation: vi.fn(async (task: () => Promise<unknown>) => {
      calls.push('enqueue');
      return task();
    }) as unknown as <T>(task: () => Promise<T>) => Promise<T>,
    snapshotRef: { current: snapshotOf(photos) },
    adapter: {
      saveAnimalPhotosBatch: vi.fn(async () => {
        calls.push('saveBatch');
      }),
      saveAnimalPhoto: vi.fn(async () => {
        calls.push('saveOne');
      }),
      deleteAnimalPhoto: vi.fn(async () => {
        calls.push('delete');
      }),
    },
    deviceId: 'dev-1',
    nextEntityRev: vi.fn((_id: string, rev?: number) => (rev ?? 0) + 1),
    allocateNextLogicalCounter: vi.fn(() => 3),
    nowIsoUtc: vi.fn(() => '2026-02-01T00:00:00.000Z'),
    recordOutboxOps: vi.fn(async (ops) => {
      calls.push(`outbox:${ops.length}`);
    }),
    reloadFromAdapter: vi.fn(async () => {
      calls.push('reload');
    }),
    notify: vi.fn((m: string) => calls.push(`notify:${m}`)),
    reportPersistenceFailure: vi.fn((a: string) => calls.push(`fail:${a}`)),
    rememberPhoto: vi.fn(() => calls.push('remember')),
    forgetPhoto: vi.fn(() => calls.push('forget')),
  };
  return { deps, calls };
}

describe('addOptimizedAnimalPhotosAction', () => {
  it('adds records, caches them, syncs metadata-only ops and reports the count', async () => {
    const { deps, calls } = makeDeps();

    const total = await addOptimizedAnimalPhotosAction(deps, animal, [payload(), payload()]);

    expect(total).toBe(2);
    expect(deps.adapter.saveAnimalPhotosBatch).toHaveBeenCalledTimes(1);
    const records = (deps.adapter.saveAnimalPhotosBatch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as AnimalPhoto[];
    expect(records[0].isPrimary).toBe(true);
    expect(records[1].isPrimary).toBe(false);
    expect(records.map((r) => r.sortOrder)).toEqual([0, 1]);
    expect(deps.rememberPhoto).toHaveBeenCalledTimes(2);
    const ops = (deps.recordOutboxOps as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<
      Record<string, unknown>
    >;
    const serializedOps = JSON.stringify(ops);
    expect(serializedOps).not.toContain('data:image/webp');
    expect(serializedOps).toContain('"dataUrl":""');
    expect(deps.notify).toHaveBeenCalledWith(expect.stringContaining('saved 60%'));
    expect(calls).toEqual(['enqueue', 'saveBatch', 'remember', 'remember', 'outbox:2', 'reload', expect.stringContaining('notify:Added 2 photos to Doe')]);
  });

  it('never creates a second primary', async () => {
    const { deps } = makeDeps([photo({ id: 'p0', isPrimary: true })]);
    await addOptimizedAnimalPhotosAction(deps, animal, [payload()]);
    const records = (deps.adapter.saveAnimalPhotosBatch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as AnimalPhoto[];
    expect(records[0].isPrimary).toBe(false);
    expect(records[0].sortOrder).toBe(1);
  });

  it('is a no-op for an empty payload list', async () => {
    const { deps } = makeDeps();
    await expect(addOptimizedAnimalPhotosAction(deps, animal, [])).resolves.toBe(0);
    expect(deps.enqueueStoreMutation).not.toHaveBeenCalled();
  });

  it('reports and rethrows a failed photo write', async () => {
    const { deps } = makeDeps();
    (deps.adapter.saveAnimalPhotosBatch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('quota')
    );
    await expect(addOptimizedAnimalPhotosAction(deps, animal, [payload()])).rejects.toThrow('quota');
    expect(deps.reportPersistenceFailure).toHaveBeenCalledWith('save photo(s) for Doe', expect.any(Error));
  });
});

describe('setPrimaryAnimalPhotoAction', () => {
  it('makes exactly one photo primary and bumps every sibling revision', async () => {
    const { deps } = makeDeps([photo({ id: 'p1', isPrimary: true }), photo({ id: 'p2', sortOrder: 1 })]);

    await setPrimaryAnimalPhotoAction(deps, 'a1', 'p2');

    const updated = (deps.adapter.saveAnimalPhotosBatch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as AnimalPhoto[];
    expect(updated.filter((p) => p.isPrimary).map((p) => p.id)).toEqual(['p2']);
    expect(updated.every((p) => p._rev === 2)).toBe(true);
    expect(deps.notify).toHaveBeenCalledWith('Primary cover photo updated (available for pedigrees).');
  });

  it('does nothing when the animal has no photos', async () => {
    const { deps } = makeDeps([]);
    await setPrimaryAnimalPhotoAction(deps, 'a1', 'p2');
    expect(deps.adapter.saveAnimalPhotosBatch).not.toHaveBeenCalled();
  });
});

describe('updateAnimalPhotoCaptionAction', () => {
  it('trims the caption and writes a metadata-only op', async () => {
    const { deps } = makeDeps([photo()]);

    await updateAnimalPhotoCaptionAction(deps, 'p1', '  Best doe  ');

    const saved = (deps.adapter.saveAnimalPhoto as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as AnimalPhoto;
    expect(saved.caption).toBe('Best doe');
    expect(saved._rev).toBe(2);
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it('ignores an unknown photo id', async () => {
    const { deps } = makeDeps([photo()]);
    await updateAnimalPhotoCaptionAction(deps, 'missing', 'x');
    expect(deps.adapter.saveAnimalPhoto).not.toHaveBeenCalled();
  });
});

describe('deleteAnimalPhotoAction', () => {
  it('promotes the next sibling when the primary is deleted', async () => {
    const { deps } = makeDeps([
      photo({ id: 'p1', isPrimary: true, sortOrder: 0 }),
      photo({ id: 'p2', sortOrder: 1 }),
      photo({ id: 'p3', sortOrder: 2 }),
    ]);

    await deleteAnimalPhotoAction(deps, 'p1');

    expect(deps.adapter.deleteAnimalPhoto).toHaveBeenCalledWith('p1');
    expect(deps.forgetPhoto).toHaveBeenCalledWith('p1');
    const promoted = (deps.adapter.saveAnimalPhoto as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as AnimalPhoto;
    expect(promoted.id).toBe('p2');
    expect(promoted.isPrimary).toBe(true);
    expect(deps.notify).toHaveBeenCalledWith('Photo removed.');
  });

  it('leaves other photos alone when a non-primary is deleted', async () => {
    const { deps } = makeDeps([photo({ id: 'p1' }), photo({ id: 'p2' })]);
    await deleteAnimalPhotoAction(deps, 'p2');
    expect(deps.adapter.saveAnimalPhoto).not.toHaveBeenCalled();
    expect(deps.forgetPhoto).toHaveBeenCalledWith('p2');
  });

  it('reports a failure without claiming the photo was removed', async () => {
    const { deps } = makeDeps([photo()]);
    (deps.adapter.deleteAnimalPhoto as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('locked')
    );
    await deleteAnimalPhotoAction(deps, 'p1');
    expect(deps.reportPersistenceFailure).toHaveBeenCalledWith('delete photo', expect.any(Error));
    expect(deps.notify).not.toHaveBeenCalled();
  });
});
