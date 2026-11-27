import { describe, expect, it, vi } from 'vitest';
import type { AnimalSaveDraft } from '../../domain/animalConflicts';
import type { Animal, BarnDatabaseSnapshot } from '../../domain/models';
import {
  archiveAnimalsAction,
  deleteAnimalAction,
  deleteAnimalsBatchAction,
  saveAnimalAction,
  type AnimalsCrudDeps,
} from '../barnStore/useAnimalsCrud';

const animal = (over: Partial<Animal> = {}): Animal =>
  ({
    id: 'a1',
    species: 'Rabbit',
    name: 'Doe',
    tattoo: 'T1',
    sex: 'Female',
    status: 'Active',
    archived: false,
    sireId: '',
    damId: '',
    _rev: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }) as Animal;

const snapshotOf = (animals: Animal[], settings: Record<string, unknown> = {}) =>
  ({
    animals,
    animalPhotos: [{ id: 'p1', animalId: 'a1' }],
    settings: { autoOffloadRetiredToOpfs: false, ...settings },
  } as unknown as BarnDatabaseSnapshot);

function makeDeps(over: Partial<AnimalsCrudDeps> = {}) {
  const calls: string[] = [];
  const deps: AnimalsCrudDeps = {
    enqueueStoreMutation: vi.fn(async (task: () => Promise<unknown>) => {
      calls.push('enqueue');
      return task();
    }) as unknown as <T>(task: () => Promise<T>) => Promise<T>,
    snapshotRef: { current: snapshotOf([animal()]) },
    fallbackSnapshot: null,
    adapter: {
      saveAnimal: vi.fn(async () => {
        calls.push('saveAnimal');
      }),
      saveAnimalPhotosBatch: vi.fn(async () => {
        calls.push('savePhotos');
      }),
      saveAnimalsBatch: vi.fn(async () => {
        calls.push('saveBatch');
      }),
      deleteAnimalsBatch: vi.fn(async () => {
        calls.push('deleteBatch');
      }),
    },
    deviceId: 'dev-1',
    nextEntityRev: vi.fn((_id: string, rev?: number) => (rev ?? 0) + 1),
    allocateNextLogicalCounter: vi.fn(() => 9),
    nowIsoUtc: vi.fn(() => '2026-02-01T00:00:00.000Z'),
    recordOutboxOps: vi.fn(async (ops) => {
      calls.push(`outbox:${ops.length}`);
    }),
    reloadFromAdapter: vi.fn(async () => {
      calls.push('reload');
    }),
    reloadFromAdapterSilently: vi.fn(async () => undefined),
    notify: vi.fn((m: string) => calls.push(`notify:${m}`)),
    reportPersistenceFailure: vi.fn((a: string) => calls.push(`fail:${a}`)),
    rememberPhoto: vi.fn(),
    forgetPhoto: vi.fn((id: string) => calls.push(`forget:${id}`)),
    saveSafetyRollingBackup: vi.fn(async () => {
      calls.push('safety');
    }),
    selectedAnimalId: 'a1',
    pedigreeAnimalId: null,
    clearSelectedAnimal: vi.fn(() => calls.push('clearSelected')),
    clearPedigreeAnimal: vi.fn(),
    isOpfsSupported: vi.fn(() => false),
    getOffloadAnimals: vi.fn(() => null),
    ...over,
  };
  return { deps, calls };
}

describe('saveAnimalAction', () => {
  const draft = {
    name: '  New Doe  ',
    tattoo: ' T9 ',
    species: 'Rabbit',
    sex: 'Female',
  } as unknown as AnimalSaveDraft;

  it('creates a revisioned animal, records outbox ops and toasts', async () => {
    const { deps, calls } = makeDeps();

    const id = await saveAnimalAction(deps, draft);

    expect(id).toBeTruthy();
    expect(calls[0]).toBe('enqueue');
    expect(deps.adapter.saveAnimal).toHaveBeenCalledTimes(1);
    const saved = (deps.adapter.saveAnimal as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as Animal;
    expect(saved.name).toBe('New Doe');
    expect(saved.tattoo).toBe('T9');
    expect(saved._rev).toBe(1);
    expect(saved.updatedAt).toBe('2026-02-01T00:00:00.000Z');
    expect(deps.recordOutboxOps).toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith('New Doe (T9) saved.');
  });

  it('attaches initial photos, remembering each payload', async () => {
    const { deps } = makeDeps();

    await saveAnimalAction(deps, draft, undefined, [
      { dataUrl: 'data:image/webp;base64,AA', caption: ' side ', isPrimary: true } as never,
    ]);

    expect(deps.adapter.saveAnimalPhotosBatch).toHaveBeenCalledTimes(1);
    expect(deps.rememberPhoto).toHaveBeenCalledTimes(1);
    expect(deps.notify).toHaveBeenCalledWith(expect.stringContaining('saved with 1 optimized photo(s).'));
  });

  it('bumps the timestamp forward when the previous row is not older', async () => {
    const previous = animal({ id: 'a1', updatedAt: '2026-03-01T00:00:00.000Z' });
    const { deps } = makeDeps({ snapshotRef: { current: snapshotOf([previous]) } });

    await saveAnimalAction(deps, { ...draft, id: 'a1' } as AnimalSaveDraft);

    const saved = (deps.adapter.saveAnimal as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as Animal;
    expect(saved.updatedAt > previous.updatedAt).toBe(true);
    expect(saved._rev).toBe(2);
  });

  it('reports and returns null when the adapter write fails', async () => {
    const { deps } = makeDeps();
    (deps.adapter.saveAnimal as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('disk full')
    );

    await expect(saveAnimalAction(deps, draft)).resolves.toBeNull();
    expect(deps.reportPersistenceFailure).toHaveBeenCalledWith('save New Doe', expect.any(Error));
  });
});

describe('archiveAnimalsAction', () => {
  it('archives and toasts the retained-for-pedigree wording', async () => {
    const { deps } = makeDeps();

    await archiveAnimalsAction(deps, ['a1'], true);

    const batch = (deps.adapter.saveAnimalsBatch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as Animal[];
    expect(batch[0].archived).toBe(true);
    expect(batch[0].status).toBe('Archived');
    expect(deps.notify).toHaveBeenCalledWith(
      'Moved 1 animal to Archived (retained for pedigrees).'
    );
  });

  it('restores a retired animal to Active', async () => {
    const retired = animal({ id: 'a1', archived: true, status: 'Sold' });
    const { deps } = makeDeps({ snapshotRef: { current: snapshotOf([retired]) } });

    await archiveAnimalsAction(deps, ['a1'], false);

    const batch = (deps.adapter.saveAnimalsBatch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as Animal[];
    expect(batch[0].status).toBe('Active');
    expect(batch[0].archived).toBe(false);
  });

  it('hands retired stock to the offloader and stops when it succeeds', async () => {
    const sold = animal({ id: 'a1', status: 'Sold' });
    const offload = vi.fn(async () => ({ archivedCount: 1 }));
    const { deps } = makeDeps({
      snapshotRef: {
        current: snapshotOf([sold], { autoOffloadRetiredToOpfs: true }),
      },
      isOpfsSupported: vi.fn(() => true),
      getOffloadAnimals: vi.fn(() => offload as never),
    });

    await archiveAnimalsAction(deps, ['a1'], true);

    expect(offload).toHaveBeenCalledWith(['a1']);
    expect(deps.reloadFromAdapter).not.toHaveBeenCalled();
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it('ignores an empty selection', async () => {
    const { deps } = makeDeps();
    await archiveAnimalsAction(deps, [], true);
    expect(deps.enqueueStoreMutation).not.toHaveBeenCalled();
  });
});

describe('deleteAnimalsBatchAction', () => {
  it('takes a safety snapshot, unlinks offspring and forgets photos', async () => {
    const child = animal({ id: 'a2', sireId: 'a1', damId: '' });
    const { deps, calls } = makeDeps({
      snapshotRef: { current: snapshotOf([animal(), child]) },
    });

    await deleteAnimalsBatchAction(deps, ['a1']);

    expect(calls[0]).toBe('enqueue');
    expect(calls[1]).toBe('safety');
    const unlinked = (deps.adapter.saveAnimalsBatch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Animal[];
    expect(unlinked[0].sireId).toBe('');
    expect(deps.adapter.deleteAnimalsBatch).toHaveBeenCalledWith(['a1']);
    expect(deps.forgetPhoto).toHaveBeenCalledWith('p1');
    expect(deps.clearSelectedAnimal).toHaveBeenCalledTimes(1);
    expect(deps.notify).toHaveBeenCalledWith('Deleted 1 selected animal.');
  });

  it('writes a delete operation for each removed animal', async () => {
    const { deps } = makeDeps();
    await deleteAnimalsBatchAction(deps, ['a1']);
    const ops = (deps.recordOutboxOps as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<
      Record<string, unknown>
    >;
    expect(ops.some((op) => Object.values(op).includes('__delete__'))).toBe(true);
  });

  it('reports a failure without pretending the delete succeeded', async () => {
    const { deps } = makeDeps();
    (deps.adapter.deleteAnimalsBatch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('locked')
    );

    await deleteAnimalsBatchAction(deps, ['a1']);

    expect(deps.reportPersistenceFailure).toHaveBeenCalledWith(
      'delete selected animal(s)',
      expect.any(Error)
    );
    expect(deps.notify).not.toHaveBeenCalled();
  });
});

describe('deleteAnimalAction', () => {
  it('delegates to the batch delete using the animal id', async () => {
    const { deps } = makeDeps();
    await deleteAnimalAction(deps, animal({ id: 'a1' }));
    expect(deps.adapter.deleteAnimalsBatch).toHaveBeenCalledWith(['a1']);
  });
});
