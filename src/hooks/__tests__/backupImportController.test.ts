import { describe, expect, it } from 'vitest';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import { makeAnimal, makeEmptySnapshot } from '../../domain/__tests__/testFixtures';
import {
  installImportedSnapshot,
  type BackupImportPorts,
} from '../barnStore/backupImportController';

const snapshotWith = (animals = makeEmptySnapshot().animals): BarnDatabaseSnapshot => ({
  ...makeEmptySnapshot(),
  animals,
});

function makePorts(
  over: Partial<BackupImportPorts> = {},
  current: BarnDatabaseSnapshot | null = snapshotWith([makeAnimal('a1')])
) {
  const calls: string[] = [];
  const replaced: BarnDatabaseSnapshot[] = [];
  const ports: BackupImportPorts = {
    snapshotRef: { current },
    saveSafetyRollingBackup: async (_snapshot, note) => {
      calls.push(`safety:${note ?? ''}`);
    },
    clearPhotoCache: () => calls.push('cache'),
    replaceSnapshot: async (snapshot) => {
      replaced.push(snapshot);
      calls.push(`replace:${snapshot.animals.length}`);
    },
    clearLocalSyncAndBackupReminderState: async () => {
      calls.push('syncState');
    },
    clearWipedRecoveryContext: () => calls.push('clearWiped'),
    reloadFromAdapter: async () => {
      calls.push('reload');
    },
    setImportConflictAlert: (alert) => calls.push(`alert:${alert.conflictedCount}`),
    logDiagnosticEvent: () => calls.push('diagnostic'),
    ...over,
  };
  return { ports, calls, replaced };
}

describe('installImportedSnapshot', () => {
  it('takes the safety snapshot before replacing and resets sync state', async () => {
    const { ports, calls } = makePorts();

    const result = await installImportedSnapshot(ports, {
      mode: 'replace',
      incoming: snapshotWith([makeAnimal('b1'), makeAnimal('b2')]),
      safetyNote: 'Pre-test safety snapshot',
    });

    expect(calls).toEqual([
      'safety:Pre-test safety snapshot',
      'cache',
      'replace:2',
      'syncState',
      'clearWiped',
      'reload',
    ]);
    expect(result?.snapshot.animals).toHaveLength(2);
    expect(result?.alertMessage).toBeNull();
  });

  it('strips backup bookkeeping from the installed settings', async () => {
    const incoming = snapshotWith([makeAnimal('b1')]);
    incoming.settings.lastBackupMeta = { exportedAt: 'x' } as never;
    incoming.settings.backupReminderSnoozedUntilMs = 123;
    const { ports, replaced } = makePorts();

    await installImportedSnapshot(ports, { mode: 'replace', incoming, safetyNote: 'note' });

    expect(replaced[0].settings.lastBackupMeta).toBeUndefined();
    expect(replaced[0].settings.backupReminderSnoozedUntilMs).toBeUndefined();
    expect(replaced[0].settings.barnName).toBe(incoming.settings.barnName);
  });

  it('skips the safety snapshot when the live barn is empty', async () => {
    const { ports, calls } = makePorts({}, snapshotWith([]));

    await installImportedSnapshot(ports, {
      mode: 'replace',
      incoming: snapshotWith([makeAnimal('b1')]),
      safetyNote: 'note',
    });

    expect(calls.some((call) => call.startsWith('safety'))).toBe(false);
    expect(calls).toContain('replace:1');
  });

  it('merges into the live barn without taking a safety snapshot or resetting sync state', async () => {
    const { ports, calls } = makePorts();

    const result = await installImportedSnapshot(ports, {
      mode: 'merge',
      incoming: snapshotWith([makeAnimal('a1'), makeAnimal('a2')]),
      safetyNote: 'note',
    });

    expect(calls).toEqual(['replace:2', 'reload']);
    expect(result?.merged).toEqual({ animalsAdded: 1, animalsUpdated: 0, photosMerged: 0 });
  });

  it('surfaces duplicate-tattoo conflicts for the imported rows', async () => {
    const { ports, calls } = makePorts();
    const duplicates = [
      makeAnimal('c1', { tattoo: 'DUP-1', sex: 'Male' }),
      makeAnimal('c2', { tattoo: 'DUP-1', sex: 'Male' }),
    ];

    const result = await installImportedSnapshot(ports, {
      mode: 'replace',
      incoming: snapshotWith(duplicates),
      safetyNote: 'note',
    });

    expect(calls).toContain('alert:2');
    expect(calls).toContain('diagnostic');
    expect(result?.alertMessage).toContain('needing review');
    expect(result?.snapshot.animals.every((animal) => animal.needsAttention)).toBe(true);
  });

  it('returns null and touches nothing when the store has no snapshot loaded', async () => {
    const { ports, calls } = makePorts({}, null);

    const result = await installImportedSnapshot(ports, {
      mode: 'replace',
      incoming: snapshotWith([makeAnimal('b1')]),
      safetyNote: 'note',
    });

    expect(result).toBeNull();
    expect(calls).toEqual([]);
  });
});
