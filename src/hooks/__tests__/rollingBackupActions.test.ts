import { describe, expect, it, vi } from 'vitest';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import {
  deleteRollingBackupAction,
  restoreRollingBackupAction,
  type RollingBackupDeps,
  type RollingBackupStoragePort,
} from '../barnStore/useRollingBackupActions';

const snapshotOf = (animalCount: number, settings: Record<string, unknown> = {}) =>
  ({
    animals: Array.from({ length: animalCount }, (_, i) => ({ id: `a${i}` })),
    settings: { defaultSpecies: 'Rabbit', lastBackupMeta: { at: 'x' }, ...settings },
  } as unknown as BarnDatabaseSnapshot);

function makePort(over: Partial<RollingBackupStoragePort> = {}) {
  const port: RollingBackupStoragePort = {
    loadRollingSnapshotBackup: vi.fn(async () => snapshotOf(5)),
    deleteRollingSnapshotBackup: vi.fn(async () => true),
    ...over,
  } as RollingBackupStoragePort;
  return port;
}

function makeDeps(over: Partial<RollingBackupDeps> = {}) {
  const calls: string[] = [];
  const port = makePort();
  const deps: RollingBackupDeps = {
    notify: vi.fn((m: string) => calls.push(`notify:${m}`)),
    reportPersistenceFailure: vi.fn(),
    snapshotRef: { current: snapshotOf(2) },
    wipedRecoveryDetected: false,
    saveSafetyRollingBackup: vi.fn(async () => {
      calls.push('safety');
    }),
    clearPhotoCache: vi.fn(() => calls.push('cache')),
    replaceSnapshot: vi.fn(async () => {
      calls.push('replace');
    }),
    clearLocalSyncAndBackupReminderState: vi.fn(async () => {
      calls.push('syncState');
    }),
    clearWipedRecoveryContext: vi.fn(() => calls.push('clearWiped')),
    reloadFromAdapter: vi.fn(async () => {
      calls.push('reload');
    }),
    refreshVaultAndArchives: vi.fn(async () => undefined),
    enqueueStoreMutation: (async (task: () => Promise<unknown>) => {
      calls.push('enqueue');
      return task();
    }) as unknown as <T>(task: () => Promise<T>) => Promise<T>,
    storage: port,
    ...over,
  };
  return { deps, port, calls };
}

describe('restoreRollingBackupAction', () => {
  it('restores in safety order inside the mutation queue', async () => {
    const { deps, port, calls } = makeDeps();

    await restoreRollingBackupAction(deps, 'rolling-1');

    expect(port.loadRollingSnapshotBackup).toHaveBeenCalledWith('rolling-1');
    expect(calls.slice(0, 6)).toEqual([
      'enqueue',
      'safety',
      'cache',
      'replace',
      'syncState',
      'clearWiped',
    ]);
    expect(deps.notify).toHaveBeenCalledWith('Restored rolling snapshot (5 animals).');
  });

  it('strips backup bookkeeping but keeps the selected species', async () => {
    const { deps } = makeDeps();
    await restoreRollingBackupAction(deps, 'k');

    const replaced = (deps.replaceSnapshot as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as BarnDatabaseSnapshot;
    expect(replaced.settings.lastBackupMeta).toBeUndefined();
    expect(replaced.settings.defaultSpecies).toBe('Rabbit');
  });

  it('skips the safety snapshot after a wiped-storage recovery', async () => {
    const { deps } = makeDeps({ wipedRecoveryDetected: true });
    await restoreRollingBackupAction(deps, 'k');
    expect(deps.saveSafetyRollingBackup).not.toHaveBeenCalled();
  });

  it('skips the safety snapshot when the barn is empty', async () => {
    const { deps } = makeDeps({ snapshotRef: { current: snapshotOf(0) } });
    await restoreRollingBackupAction(deps, 'k');
    expect(deps.saveSafetyRollingBackup).not.toHaveBeenCalled();
  });

  it('stops with a toast when the snapshot is gone', async () => {
    const port = makePort({ loadRollingSnapshotBackup: vi.fn(async () => null) });
    const { deps } = makeDeps({ storage: port });

    await restoreRollingBackupAction(deps, 'k');

    expect(deps.notify).toHaveBeenCalledWith('Could not load that rolling backup snapshot.');
    expect(deps.replaceSnapshot).not.toHaveBeenCalled();
  });

  it('reports and rethrows a restore failure', async () => {
    const err = new Error('idb read');
    const port = makePort({ loadRollingSnapshotBackup: vi.fn(async () => Promise.reject(err)) });
    const { deps } = makeDeps({ storage: port });

    await expect(restoreRollingBackupAction(deps, 'k')).rejects.toThrow('idb read');
    expect(deps.reportPersistenceFailure).toHaveBeenCalledWith('restore rolling snapshot', err);
  });
});

describe('deleteRollingBackupAction', () => {
  it('deletes, refreshes the vault listing and toasts', async () => {
    const { deps, port } = makeDeps();

    await deleteRollingBackupAction(deps, 'rolling-1');

    expect(port.deleteRollingSnapshotBackup).toHaveBeenCalledWith('rolling-1');
    expect(deps.refreshVaultAndArchives).toHaveBeenCalledTimes(1);
    expect(deps.notify).toHaveBeenCalledWith('Removed local IndexedDB rolling snapshot.');
  });
});
