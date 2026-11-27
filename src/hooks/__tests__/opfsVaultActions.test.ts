import { describe, expect, it, vi } from 'vitest';
import type { VaultBackupMetadata } from '../../domain/backupVault';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import {
  deleteOpfsVaultBackupAction,
  describeOpfsVaultBackup,
  downloadOpfsVaultBackupAction,
  formatRestoreMigrationNote,
  restoreOpfsVaultBackupAction,
  saveManualOpfsVaultBackupAction,
  stripRestoredBackupBookkeeping,
  type OpfsVaultDeps,
  type OpfsVaultStoragePort,
} from '../barnStore/useOpfsVaultActions';

const snapshotOf = (animalCount: number, settings: Record<string, unknown> = {}) =>
  ({
    animals: Array.from({ length: animalCount }, (_, i) => ({ id: `a${i}` })),
    animalPhotos: [{ id: 'p1' }],
    settings: { defaultSpecies: 'Rabbit', lastBackupMeta: { at: 'x' }, ...settings },
  } as unknown as BarnDatabaseSnapshot);

const backupMeta = (over: Partial<VaultBackupMetadata> = {}): VaultBackupMetadata =>
  ({
    key: 'vault-key-1',
    fileName: 'pedigree-vault-2026-01-01.json',
    kind: 'manual',
    schemaVersion: 3,
    createdAtIso: '2026-01-01T00:00:00.000Z',
    createdByAppVersion: '1.0.0',
    barnName: 'Test Barn',
    animalCount: 4,
    photoCount: 2,
    speciesCount: 1,
    byteSize: 2048,
    checksumSha256: 'abc',
    source: 'opfs',
    ...over,
  }) as VaultBackupMetadata;

function makePort(over: Partial<OpfsVaultStoragePort> = {}) {
  const port: OpfsVaultStoragePort = {
    isOpfsSupported: vi.fn(() => true),
    saveRollingSnapshotBackup: vi.fn(async () => undefined),
    saveOpfsVaultBackup: vi.fn(async () => backupMeta()),
    loadOpfsVaultBackup: vi.fn(async () => ({
      migrated: { snapshot: snapshotOf(3) },
    })),
    readOpfsVaultBackupBlob: vi.fn(async () => ({
      fileName: 'blob-name.json',
      blob: { size: 10 } as unknown as Blob,
    })),
    deleteOpfsVaultBackup: vi.fn(async () => true),
    downloadBlobDirect: vi.fn(async () => undefined),
    ...over,
  } as OpfsVaultStoragePort;
  return port;
}

function makeDeps(over: Partial<OpfsVaultDeps> = {}) {
  const port = makePort();
  const calls: string[] = [];
  const notify = vi.fn((message: string) => {
    calls.push(`notify:${message}`);
  });
  const deps: OpfsVaultDeps = {
    notify,
    reportPersistenceFailure: vi.fn(),
    snapshot: snapshotOf(2),
    snapshotRef: { current: snapshotOf(2) },
    wipedRecoveryDetected: false,
    opfsVaultBackups: [],
    hydrateSnapshotForExport: vi.fn(async (s: BarnDatabaseSnapshot) => s),
    saveSafetyRollingBackup: vi.fn(async () => {
      calls.push('safety');
    }),
    mirrorToNativeVault: vi.fn(async () => false),
    replaceSnapshot: vi.fn(async () => {
      calls.push('replace');
    }),
    clearPhotoCache: vi.fn(() => calls.push('cache')),
    clearLocalSyncAndBackupReminderState: vi.fn(async () => {
      calls.push('syncState');
    }),
    clearWipedRecoveryContext: vi.fn(),
    setActiveSpeciesName: vi.fn(),
    reloadFromAdapter: vi.fn(async () => {
      calls.push('reload');
    }),
    refreshVaultAndArchives: vi.fn(async () => undefined),
    refreshStorageStatus: vi.fn(),
    recordBackupExport: vi.fn(async () => undefined),
    enqueueStoreMutation: vi.fn(async (task: () => Promise<unknown>) => {
      calls.push('enqueue');
      return task();
    }) as unknown as <T>(task: () => Promise<T>) => Promise<T>,
    storage: port,
    ...over,
  };
  return { deps, port, notify, calls };
}

describe('describeOpfsVaultBackup', () => {
  const backups = [backupMeta(), backupMeta({ key: 'other', fileName: 'other.json' })];

  it('finds a backup by key', () => {
    expect(describeOpfsVaultBackup(backups, 'vault-key-1')?.fileName).toBe(
      'pedigree-vault-2026-01-01.json'
    );
  });

  it('finds a backup by file name, which is what a restore list may hand back', () => {
    expect(describeOpfsVaultBackup(backups, 'other.json')?.key).toBe('other');
  });

  it('returns null for an unknown key', () => {
    expect(describeOpfsVaultBackup(backups, 'nope')).toBeNull();
  });
});

describe('stripRestoredBackupBookkeeping', () => {
  it('drops last-backup and reminder bookkeeping without touching other settings', () => {
    const cleaned = stripRestoredBackupBookkeeping(
      snapshotOf(1, { backupReminderSnoozedUntilMs: 123, barnName: 'Keep me' })
    );
    expect(cleaned.settings.lastBackupMeta).toBeUndefined();
    expect(cleaned.settings.backupReminderSnoozedUntilMs).toBeUndefined();
    expect(cleaned.settings.barnName).toBe('Keep me');
  });
});

describe('formatRestoreMigrationNote', () => {
  it('is silent when the file already matches the schema', () => {
    expect(formatRestoreMigrationNote(3, 3)).toBe('');
  });
  it('names the migration when the file was upgraded', () => {
    expect(formatRestoreMigrationNote(1, 3)).toBe(' (migrated v1 → v3)');
  });
});

describe('saveManualOpfsVaultBackupAction', () => {
  it('writes to OPFS, records the export and reports size and counts', async () => {
    const { deps, port, notify } = makeDeps();

    const meta = await saveManualOpfsVaultBackupAction(deps);

    expect(meta?.key).toBe('vault-key-1');
    expect(port.saveOpfsVaultBackup).toHaveBeenCalledWith(deps.snapshot, {
      kind: 'manual',
      note: 'Manual snapshot saved to Vault',
    });
    expect(port.saveRollingSnapshotBackup).toHaveBeenCalledTimes(1);
    expect(deps.recordBackupExport).toHaveBeenCalledWith('json', 'pedigree-vault-2026-01-01.json');
    expect(deps.refreshVaultAndArchives).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toContain('Saved snapshot to OPFS Backup Vault (4 animals, 2 photos');
  });

  it('trims a user note and keeps it verbatim otherwise', async () => {
    const { deps, port } = makeDeps();
    await saveManualOpfsVaultBackupAction(deps, '  before breeding season  ');
    expect(port.saveOpfsVaultBackup).toHaveBeenCalledWith(deps.snapshot, {
      kind: 'manual',
      note: 'before breeding season',
    });
  });

  it('falls back to the rolling vault when OPFS is unavailable', async () => {
    const port = makePort({ isOpfsSupported: vi.fn(() => false) });
    const { deps, notify } = makeDeps({ storage: port });

    const meta = await saveManualOpfsVaultBackupAction(deps);

    expect(meta).toBeNull();
    expect(port.saveOpfsVaultBackup).not.toHaveBeenCalled();
    expect(deps.recordBackupExport).toHaveBeenCalledWith('json', 'rolling-local-snapshot');
    expect(notify.mock.calls[0][0]).toContain('OPFS directory access is unavailable');
  });

  it('mentions the native vault too when the mirror succeeded', async () => {
    const port = makePort({ isOpfsSupported: vi.fn(() => false) });
    const { deps, notify } = makeDeps({
      storage: port,
      mirrorToNativeVault: vi.fn(async () => true),
    });

    await saveManualOpfsVaultBackupAction(deps);

    expect(notify.mock.calls[0][0]).toBe(
      'Saved snapshot to IndexedDB Rolling Vault and Native Android Backup Vault.'
    );
    expect(deps.refreshStorageStatus).toHaveBeenCalledTimes(1);
  });

  it('does nothing at all without a snapshot', async () => {
    const { deps, port } = makeDeps({ snapshot: null });
    await expect(saveManualOpfsVaultBackupAction(deps)).resolves.toBeNull();
    expect(port.saveRollingSnapshotBackup).not.toHaveBeenCalled();
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it('reports and rethrows a hydration failure', async () => {
    const err = new Error('hydrate failed');
    const { deps } = makeDeps({ hydrateSnapshotForExport: vi.fn(async () => Promise.reject(err)) });

    await expect(saveManualOpfsVaultBackupAction(deps)).rejects.toThrow('hydrate failed');
    expect(deps.reportPersistenceFailure).toHaveBeenCalledWith('save snapshot to backup vault', err);
  });
});

describe('restoreOpfsVaultBackupAction', () => {
  it('runs inside the mutation queue in safety order', async () => {
    const { deps, port, calls, notify } = makeDeps();

    await restoreOpfsVaultBackupAction(deps, 'vault-key-1');

    expect(deps.enqueueStoreMutation).toHaveBeenCalledTimes(1);
    expect(port.loadOpfsVaultBackup).toHaveBeenCalledWith('vault-key-1', deps.snapshotRef.current!.settings);
    expect(calls.slice(0, 6)).toEqual(['enqueue', 'safety', 'cache', 'replace', 'syncState', 'reload']);
    expect(notify.mock.calls[0][0]).toBe('Restored 3 animals & 1 photos from OPFS Vault.');
  });

  it('replaces with cleaned settings and points the app at the restored species', async () => {
    const port = makePort();
    port.loadOpfsVaultBackup = vi.fn(async () => ({
      migrated: { snapshot: snapshotOf(3, { defaultSpecies: 'Guinea Pig' }) },
    })) as unknown as OpfsVaultStoragePort['loadOpfsVaultBackup'];
    const { deps } = makeDeps({ storage: port });

    await restoreOpfsVaultBackupAction(deps, 'k');

    const replaced = (deps.replaceSnapshot as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as BarnDatabaseSnapshot;
    expect(replaced.settings.lastBackupMeta).toBeUndefined();
    expect(deps.setActiveSpeciesName).toHaveBeenCalledWith('Guinea Pig');
    expect(deps.clearWipedRecoveryContext).toHaveBeenCalledTimes(1);
  });

  it('notes a schema migration in the toast', async () => {
    const port = makePort();
    port.loadOpfsVaultBackup = vi.fn(async () => ({
      migrated: { snapshot: snapshotOf(1), migratedFromVersion: 1, schemaVersion: 4 },
    })) as unknown as OpfsVaultStoragePort['loadOpfsVaultBackup'];
    const { deps, notify } = makeDeps({ storage: port });

    await restoreOpfsVaultBackupAction(deps, 'k');

    expect(notify.mock.calls[0][0]).toBe(
      'Restored 1 animals & 1 photos from OPFS Vault (migrated v1 → v4).'
    );
  });

  it('skips the safety snapshot after a wiped-storage recovery', async () => {
    const { deps } = makeDeps({ wipedRecoveryDetected: true });
    await restoreOpfsVaultBackupAction(deps, 'k');
    expect(deps.saveSafetyRollingBackup).not.toHaveBeenCalled();
  });

  it('skips the safety snapshot when there is nothing to lose', async () => {
    const { deps } = makeDeps({ snapshotRef: { current: snapshotOf(0) } });
    await restoreOpfsVaultBackupAction(deps, 'k');
    expect(deps.saveSafetyRollingBackup).not.toHaveBeenCalled();
  });

  it('stops at a toast when the file cannot be verified', async () => {
    const port = makePort({ loadOpfsVaultBackup: vi.fn(async () => null) });
    const { deps, notify } = makeDeps({ storage: port });

    await restoreOpfsVaultBackupAction(deps, 'k');

    expect(notify.mock.calls[0][0]).toBe('Could not read or verify that OPFS backup file.');
    expect(deps.replaceSnapshot).not.toHaveBeenCalled();
    expect(deps.reloadFromAdapter).not.toHaveBeenCalled();
  });

  it('reports and rethrows a restore failure', async () => {
    const err = new Error('opfs io');
    const port = makePort({ loadOpfsVaultBackup: vi.fn(async () => Promise.reject(err)) });
    const { deps } = makeDeps({ storage: port });

    await expect(restoreOpfsVaultBackupAction(deps, 'k')).rejects.toThrow('opfs io');
    expect(deps.reportPersistenceFailure).toHaveBeenCalledWith('restore OPFS vault backup', err);
  });
});

describe('downloadOpfsVaultBackupAction', () => {
  it('prefers the listed file name and toasts it', async () => {
    const { deps, port, notify } = makeDeps({
      opfsVaultBackups: [backupMeta({ fileName: 'listed.json' })],
    });

    await downloadOpfsVaultBackupAction(deps, 'vault-key-1');

    expect(port.downloadBlobDirect).toHaveBeenCalledWith('listed.json', expect.anything());
    expect(notify.mock.calls[0][0]).toBe('Downloaded listed.json.');
  });

  it("falls back to the blob's own file name", async () => {
    const { deps, port } = makeDeps();
    await downloadOpfsVaultBackupAction(deps, 'unknown-key');
    expect(port.downloadBlobDirect).toHaveBeenCalledWith('blob-name.json', expect.anything());
  });

  it('toasts instead of downloading when the blob is gone', async () => {
    const port = makePort({ readOpfsVaultBackupBlob: vi.fn(async () => null) });
    const { deps, notify } = makeDeps({ storage: port });

    await downloadOpfsVaultBackupAction(deps, 'k');

    expect(port.downloadBlobDirect).not.toHaveBeenCalled();
    expect(notify.mock.calls[0][0]).toBe('Could not read OPFS vault backup file for download.');
  });
});

describe('deleteOpfsVaultBackupAction', () => {
  it('deletes, refreshes the listing and toasts', async () => {
    const { deps, port, notify } = makeDeps();

    await deleteOpfsVaultBackupAction(deps, 'vault-key-1');

    expect(port.deleteOpfsVaultBackup).toHaveBeenCalledWith('vault-key-1');
    expect(deps.refreshVaultAndArchives).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toBe('Removed backup from OPFS Vault.');
  });
});
