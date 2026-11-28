import { describe, expect, it, vi } from 'vitest';
import type { Animal, BarnDatabaseSnapshot } from '../../domain/models';
import {
  resetSpeciesSelectorCache,
  selectSpeciesAnimals,
} from '../barnStore/speciesSelectors';
import {
  runDestructiveRestore,
  type DestructiveRestoreDeps,
} from '../barnStore/restoreOrchestrator';

const snapshotOf = (animalCount: number, photoCount = 1, settings: Record<string, unknown> = {}) =>
  ({
    animals: Array.from({ length: animalCount }, (_, i) => ({ id: `a${i}` })),
    animalPhotos: Array.from({ length: photoCount }, (_, i) => ({ id: `p${i}` })),
    settings: { defaultSpecies: 'Rabbit', lastBackupMeta: { at: 'x' }, ...settings },
  } as unknown as BarnDatabaseSnapshot);

function makeDeps(over: Partial<DestructiveRestoreDeps> = {}) {
  const calls: string[] = [];
  let committed: BarnDatabaseSnapshot | null = snapshotOf(3);
  const deps: DestructiveRestoreDeps = {
    snapshotRef: { current: snapshotOf(2) },
    wipedRecoveryDetected: false,
    saveSafetyRollingBackup: vi.fn(async () => {
      calls.push('safety');
    }),
    clearPhotoCache: vi.fn(() => calls.push('cache')),
    replaceSnapshot: vi.fn(async (snap: BarnDatabaseSnapshot) => {
      calls.push(`replace:${snap.animals.length}`);
      committed = snap;
    }),
    clearLocalSyncAndBackupReminderState: vi.fn(async () => {
      calls.push('syncState');
    }),
    clearWipedRecoveryContext: vi.fn(() => calls.push('clearWiped')),
    reloadFromAdapter: vi.fn(async () => {
      calls.push('reload');
    }),
    readCommittedSnapshot: vi.fn(async () => committed),
    notify: vi.fn((m: string) => calls.push(`notify:${m}`)),
    reportPersistenceFailure: vi.fn((a: string) => calls.push(`fail:${a}`)),
    ...over,
  };
  return { deps, calls };
}

const plan = {
  action: 'restore test backup',
  missingMessage: 'nothing to restore',
  safetyNote: 'Pre-test safety snapshot',
  successMessage: (p: { snapshot: BarnDatabaseSnapshot }) =>
    `Restored ${p.snapshot.animals.length} animals.`,
};

describe('runDestructiveRestore', () => {
  it('runs the whole safety order and toasts the source message', async () => {
    const { deps, calls } = makeDeps();

    const result = await runDestructiveRestore(deps, plan, async () => ({
      snapshot: snapshotOf(3),
    }));

    expect(result?.snapshot.animals).toHaveLength(3);
    expect(calls).toEqual([
      'safety',
      'cache',
      'replace:3',
      'syncState',
      'clearWiped',
      'reload',
      'notify:Restored 3 animals.',
    ]);
    expect(deps.saveSafetyRollingBackup).toHaveBeenCalledWith(
      expect.anything(),
      'Pre-test safety snapshot'
    );
  });

  it('strips backup bookkeeping from the restored settings', async () => {
    const { deps } = makeDeps();

    await runDestructiveRestore(deps, plan, async () => ({ snapshot: snapshotOf(3) }));

    const replaced = (deps.replaceSnapshot as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as BarnDatabaseSnapshot;
    expect(replaced.settings.lastBackupMeta).toBeUndefined();
    expect(replaced.settings.defaultSpecies).toBe('Rabbit');
  });

  it('returns null and touches nothing when the source has no snapshot', async () => {
    const { deps, calls } = makeDeps();

    const result = await runDestructiveRestore(deps, plan, async () => null);

    expect(result).toBeNull();
    expect(calls).toEqual(['notify:nothing to restore']);
  });

  it('skips the safety snapshot after a wiped-storage recovery', async () => {
    const { deps } = makeDeps({ wipedRecoveryDetected: true });
    await runDestructiveRestore(deps, plan, async () => ({ snapshot: snapshotOf(3) }));
    expect(deps.saveSafetyRollingBackup).not.toHaveBeenCalled();
  });

  it('skips the safety snapshot when the current barn is empty', async () => {
    const { deps } = makeDeps({ snapshotRef: { current: snapshotOf(0) } });
    await runDestructiveRestore(deps, plan, async () => ({ snapshot: snapshotOf(3) }));
    expect(deps.saveSafetyRollingBackup).not.toHaveBeenCalled();
  });

  it('does not verify when the plan does not ask for it', async () => {
    const { deps } = makeDeps();
    await runDestructiveRestore(deps, { ...plan, verifyRowCounts: false }, async () => ({
      snapshot: snapshotOf(3),
    }));
    expect(deps.readCommittedSnapshot).not.toHaveBeenCalled();
  });

  it('records a match and continues when the committed rows equal the file', async () => {
    const { deps } = makeDeps();
    await runDestructiveRestore(deps, { ...plan, verifyRowCounts: true }, async () => ({
      snapshot: snapshotOf(3),
    }));
    expect(deps.readCommittedSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.notify).toHaveBeenCalledWith('Restored 3 animals.');
  });

  it('rolls the previous barn back and fails loudly on a count mismatch', async () => {
    const previous = snapshotOf(2);
    const { deps, calls } = makeDeps({
      snapshotRef: { current: previous },
      readCommittedSnapshot: vi.fn(async () => snapshotOf(1)),
    });

    await expect(
      runDestructiveRestore(deps, { ...plan, verifyRowCounts: true }, async () => ({
        snapshot: snapshotOf(3),
      }))
    ).rejects.toThrow('Restore verification failed');

    const replacedValues = (deps.replaceSnapshot as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (c[0] as BarnDatabaseSnapshot).animals.length
    );
    expect(replacedValues).toEqual([3, 2]);
    expect(deps.notify).toHaveBeenCalledWith(expect.stringContaining('Your previous barn was put back.'));
    expect(deps.reportPersistenceFailure).toHaveBeenCalledWith('restore test backup', expect.any(Error));
    expect(calls).toContain('reload');
  });

  it('flushes the species selector cache so a restore cannot serve the replaced rows', async () => {
    resetSpeciesSelectorCache();
    const row = (name: string) => ({ id: 'a1', name, species: 'Rabbit', _rev: 1 }) as Animal;

    const before = selectSpeciesAnimals([row('Ada')], 'Rabbit');
    expect(before[0].name).toBe('Ada');

    const { deps } = makeDeps();
    await runDestructiveRestore(deps, plan, async () => ({ snapshot: snapshotOf(3) }));

    // Same id and revision as the dataset the restore replaced: only the flush can tell them apart.
    const after = selectSpeciesAnimals([row('Zed')], 'Rabbit');
    expect(after[0].name).toBe('Zed');
    expect(after).not.toBe(before);
  });

  it('reports a thrown write and rethrows it', async () => {
    const err = new Error('quota exceeded');
    const { deps } = makeDeps({
      replaceSnapshot: vi.fn(async () => Promise.reject(err)),
    });

    await expect(runDestructiveRestore(deps, plan, async () => ({ snapshot: snapshotOf(3) }))).rejects.toThrow(
      'quota exceeded'
    );
    expect(deps.reportPersistenceFailure).toHaveBeenCalledWith('restore test backup', err);
    expect(deps.notify).not.toHaveBeenCalled();
  });
});
