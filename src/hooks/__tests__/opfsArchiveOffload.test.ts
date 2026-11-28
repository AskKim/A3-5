import { describe, expect, it, vi } from 'vitest';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import {
  offloadAnimalsToOpfsArchiveAction,
  offloadAnimalsToOpfsArchiveUnqueued,
  type OpfsArchiveOffloadDeps,
  type OpfsArchiveStoragePort,
} from '../barnStore/useOpfsArchiveOffload';

const snapshot = { animals: [{ id: 'a1' }] } as unknown as BarnDatabaseSnapshot;

const bundle = (over: Record<string, unknown> = {}) =>
  ({
    indexEntry: { animalCount: 2, archiveKey: 'arc-1' },
    zipBytes: new Uint8Array([1, 2]),
    nextActiveSnapshot: { animals: [] } as unknown as BarnDatabaseSnapshot,
    removedAnimalIds: ['a1'],
    stubAnimalIds: ['a2'],
    fileName: 'archive-1.zip',
    ...over,
  }) as never;

function makePort(over: Partial<OpfsArchiveStoragePort> = {}) {
  const port: OpfsArchiveStoragePort = {
    isOpfsSupported: vi.fn(() => true),
    saveOpfsHerdArchive: vi.fn(async () => undefined),
    ...over,
  } as OpfsArchiveStoragePort;
  return port;
}

function makeDeps(over: Partial<OpfsArchiveOffloadDeps> = {}) {
  const calls: string[] = [];
  const port = makePort();
  const deps: OpfsArchiveOffloadDeps = {
    notify: vi.fn((m: string) => calls.push(`notify:${m}`)),
    reportPersistenceFailure: vi.fn(),
    snapshotRef: { current: snapshot },
    loadFreshSnapshot: vi.fn(async () => snapshot),
    hydrateSnapshotForExport: vi.fn(async (s: BarnDatabaseSnapshot) => s),
    replaceSnapshot: vi.fn(async () => {
      calls.push('replace');
    }),
    clearPhotoCache: vi.fn(() => calls.push('cache')),
    selectedAnimalId: 'a1',
    pedigreeAnimalId: 'a2',
    clearSelectedAnimal: vi.fn(() => calls.push('clearSelected')),
    clearPedigreeAnimal: vi.fn(() => calls.push('clearPedigree')),
    reloadFromAdapter: vi.fn(async () => {
      calls.push('reload');
    }),
    enqueueStoreMutation: (async (task: () => Promise<unknown>) => {
      calls.push('enqueue');
      return task();
    }) as unknown as <T>(task: () => Promise<T>) => Promise<T>,
    buildArchivedBundle: vi.fn(() => bundle()),
    storage: port,
    ...over,
  };
  return { deps, port, calls };
}

describe('offloadAnimalsToOpfsArchiveUnqueued', () => {
  it('archives, replaces the snapshot, drops stale selections and returns counts', async () => {
    const { deps, port, calls } = makeDeps();

    const result = await offloadAnimalsToOpfsArchiveUnqueued(deps, ['a1', 'a2']);

    expect(deps.loadFreshSnapshot).toHaveBeenCalledTimes(1);
    expect(port.saveOpfsHerdArchive).toHaveBeenCalledWith(
      expect.objectContaining({ archiveKey: 'arc-1' }),
      expect.anything()
    );
    expect(deps.replaceSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ animals: [] })
    );
    expect(deps.clearSelectedAnimal).toHaveBeenCalledTimes(1);
    // The pedigree selection pointed at a stub animal, so it is kept.
    expect(deps.clearPedigreeAnimal).not.toHaveBeenCalled();
    expect(calls).toEqual([
      'replace',
      'cache',
      'clearSelected',
      'reload',
      'notify:Offloaded 2 animals to OPFS /archives (1 retained as Pedigree Reference stub).',
    ]);
    expect(result).toEqual({
      archivedCount: 2,
      stubCount: 1,
      removedCount: 1,
      fileName: 'archive-1.zip',
    });
  });

  it('uses singular wording for a one-animal offload', async () => {
    const { deps } = makeDeps({
      buildArchivedBundle: vi.fn(() =>
        bundle({ indexEntry: { animalCount: 1 }, removedAnimalIds: [], stubAnimalIds: [] })
      ),
    });

    await offloadAnimalsToOpfsArchiveUnqueued(deps, ['a1']);

    expect(deps.notify).toHaveBeenCalledWith(
      'Offloaded 1 animal to OPFS /archives (0 retained as Pedigree Reference stubs).'
    );
  });

  it('does nothing for an empty selection', async () => {
    const { deps, port } = makeDeps();
    await expect(offloadAnimalsToOpfsArchiveUnqueued(deps, [])).resolves.toBeNull();
    expect(port.isOpfsSupported).not.toHaveBeenCalled();
  });

  it('stays disabled with a toast when OPFS archives are unavailable', async () => {
    const port = makePort({ isOpfsSupported: vi.fn(() => false) });
    const { deps } = makeDeps({ storage: port });

    const result = await offloadAnimalsToOpfsArchiveUnqueued(deps, ['a1']);

    expect(result).toBeNull();
    expect(port.saveOpfsHerdArchive).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith(
      'OPFS /archives storage is not available in this browser. Animals remain in the local Archived tab.'
    );
  });

  it('warns instead of writing when nothing is eligible', async () => {
    const { deps, port } = makeDeps({
      buildArchivedBundle: vi.fn(() => bundle({ indexEntry: { animalCount: 0 } })),
    });

    const result = await offloadAnimalsToOpfsArchiveUnqueued(deps, ['a1']);

    expect(result).toBeNull();
    expect(port.saveOpfsHerdArchive).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith('No eligible active/archived animals selected to offload.');
  });

  it('stops when the authoritative snapshot cannot be read', async () => {
    const { deps, port } = makeDeps({ loadFreshSnapshot: vi.fn(async () => null) });
    await offloadAnimalsToOpfsArchiveUnqueued(deps, ['a1']);
    expect(port.saveOpfsHerdArchive).not.toHaveBeenCalled();
  });

  it('reports a quota failure from the archive write and leaves the barn intact', async () => {
    const quotaErr = Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
    const port = makePort({ saveOpfsHerdArchive: vi.fn(async () => Promise.reject(quotaErr)) });
    const { deps } = makeDeps({ storage: port });

    await expect(offloadAnimalsToOpfsArchiveUnqueued(deps, ['a1'])).resolves.toBeNull();

    expect(deps.replaceSnapshot).not.toHaveBeenCalled();
    expect(deps.notify).not.toHaveBeenCalled();
    expect(deps.reportPersistenceFailure).toHaveBeenCalledWith(
      'offload animals to OPFS /archives',
      quotaErr
    );
  });

  it('reports a failure and returns null instead of throwing', async () => {
    const err = new Error('zip failed');
    const { deps } = makeDeps({
      buildArchivedBundle: vi.fn(() => {
        throw err;
      }) as never,
    });

    await expect(offloadAnimalsToOpfsArchiveUnqueued(deps, ['a1'])).resolves.toBeNull();
    expect(deps.reportPersistenceFailure).toHaveBeenCalledWith(
      'offload animals to OPFS /archives',
      err
    );
  });
});

describe('offloadAnimalsToOpfsArchiveAction', () => {
  it('runs inside the mutation queue', async () => {
    const { deps, calls } = makeDeps();
    await offloadAnimalsToOpfsArchiveAction(deps, ['a1']);
    expect(calls[0]).toBe('enqueue');
  });
});
