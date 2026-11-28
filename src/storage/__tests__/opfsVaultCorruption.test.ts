/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Corrupt-backup and wiped-storage paths for the OPFS vault: a damaged envelope must
 * fail loudly instead of importing half a herd, and a returning user whose IndexedDB
 * was evicted must still be recognised from the sentinel or surviving OPFS backups.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFullPredefinedSampleSnapshot } from '../../domain/sampleData';
import {
  clearPriorUseSentinel,
  detectReturningUserWipedStorage,
  dumpIndexedDbDatabaseToOpfs,
  listOpfsVaultBackups,
  loadOpfsVaultBackup,
  markPriorUseSentinelFromSnapshot,
  saveOpfsVaultBackup,
  setOpfsRootResolverForTest,
} from '../opfsStorage';
import { createInMemoryOpfsMock } from './support/inMemoryOpfs';

function installLocalStorageShim() {
  const store = new Map<string, string>();
  const shim = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: shim,
    configurable: true,
    writable: true,
  });
  return store;
}

async function seedOpfsFile(
  root: Awaited<ReturnType<typeof createInMemoryOpfsMock>>['rootHandle'],
  dirName: string,
  fileName: string,
  contents: string
): Promise<void> {
  const dir = await root.getDirectoryHandle(dirName, { create: true });
  const handle = await dir.getFileHandle(fileName, { create: true });
  if (!handle.createWritable) throw new Error('Mock file handle cannot create a writable');
  const writable = await handle.createWritable();
  await writable.write(contents);
  await writable.close();
}

afterEach(() => {
  setOpfsRootResolverForTest(null);
  clearPriorUseSentinel();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('OPFS vault corrupt-backup handling', () => {
  it('throws instead of returning a partial import when the envelope is structurally invalid', async () => {
    installLocalStorageShim();
    const opfs = createInMemoryOpfsMock();
    setOpfsRootResolverForTest(async () => opfs.rootHandle);
    await seedOpfsFile(opfs.rootHandle, 'backups', 'broken-manual.json', '{ not a vault }');

    await expect(loadOpfsVaultBackup('broken-manual.json')).rejects.toThrow();
  });

  it('returns null for an empty backup file rather than fabricating a snapshot', async () => {
    installLocalStorageShim();
    const opfs = createInMemoryOpfsMock();
    setOpfsRootResolverForTest(async () => opfs.rootHandle);
    await seedOpfsFile(opfs.rootHandle, 'backups', 'empty.json', '');

    await expect(loadOpfsVaultBackup('empty.json')).resolves.toBeNull();
  });

  it('returns null when the /backups namespace does not exist', async () => {
    installLocalStorageShim();
    const opfs = createInMemoryOpfsMock();
    setOpfsRootResolverForTest(async () => opfs.rootHandle);

    await expect(loadOpfsVaultBackup('anything.json')).resolves.toBeNull();
    await expect(listOpfsVaultBackups()).resolves.toEqual([]);
  });

  it('keeps a valid backup loadable after a corrupt vault index forces a rebuild', async () => {
    installLocalStorageShim();
    const opfs = createInMemoryOpfsMock();
    setOpfsRootResolverForTest(async () => opfs.rootHandle);

    const saved = await saveOpfsVaultBackup(buildFullPredefinedSampleSnapshot(), {
      kind: 'manual',
      policyOverride: { compressVaultBackups: false },
    });
    expect(saved).not.toBeNull();

    await seedOpfsFile(opfs.rootHandle, 'backups', 'vault-index.json', '{{{corrupt');

    const rebuilt = await listOpfsVaultBackups();
    expect(rebuilt.some((item) => item.fileName === saved?.fileName)).toBe(true);
    await expect(loadOpfsVaultBackup(saved!.key)).resolves.toMatchObject({
      meta: { fileName: saved!.fileName },
    });
  });
});

describe('wiped-storage detection after eviction', () => {
  it('recognises a returning user from the sentinel alone', async () => {
    installLocalStorageShim();
    const opfs = createInMemoryOpfsMock();
    setOpfsRootResolverForTest(async () => opfs.rootHandle);
    // Sample rows use testing IDs, so onboarding is what makes the barn count as real use.
    const snapshot = buildFullPredefinedSampleSnapshot();
    snapshot.settings.barnNameOnboarded = true;
    markPriorUseSentinelFromSnapshot(snapshot);

    const context = await detectReturningUserWipedStorage();
    expect(context.detected).toBe(true);
    expect(context.reason).toBe('sentinel');
    expect(context.opfsBackupsCount).toBe(0);
  });

  it('prefers surviving OPFS backups over the sentinel and reports their count', async () => {
    installLocalStorageShim();
    const opfs = createInMemoryOpfsMock();
    setOpfsRootResolverForTest(async () => opfs.rootHandle);
    markPriorUseSentinelFromSnapshot(buildFullPredefinedSampleSnapshot());
    const saved = await saveOpfsVaultBackup(buildFullPredefinedSampleSnapshot(), {
      kind: 'manual',
      policyOverride: { compressVaultBackups: false },
    });

    const context = await detectReturningUserWipedStorage();
    expect(context.detected).toBe(true);
    expect(context.reason).toBe('opfs_backups');
    expect(context.opfsBackupsCount).toBe(1);
    expect(context.latestOpfsBackup?.fileName).toBe(saved?.fileName);
  });

  it('reports no eviction when nothing survived', async () => {
    installLocalStorageShim();
    const opfs = createInMemoryOpfsMock();
    setOpfsRootResolverForTest(async () => opfs.rootHandle);

    const context = await detectReturningUserWipedStorage();
    expect(context).toMatchObject({ detected: false, reason: 'none', sentinel: null });
  });
});

describe('IndexedDB rescue dump before a destructive reset', () => {
  it('salvages surviving object-store rows into an OPFS recovery dump', async () => {
    installLocalStorageShim();
    const opfs = createInMemoryOpfsMock();
    setOpfsRootResolverForTest(async () => opfs.rootHandle);

    const rows = [{ id: 'animal-1', name: 'Biscuit' }];
    const store = {
      getAll: () => {
        const req: Record<string, unknown> = {};
        setTimeout(() => {
          req.result = rows;
          (req.onsuccess as (() => void) | undefined)?.();
        }, 0);
        return req;
      },
    };
    const db = {
      objectStoreNames: ['sqlite_files'],
      close: () => undefined,
      transaction: () => {
        const tx: Record<string, unknown> = { objectStore: () => store };
        setTimeout(() => (tx.oncomplete as (() => void) | undefined)?.(), 5);
        return tx;
      },
    };
    const factory = {
      open: () => {
        const req: Record<string, unknown> = {};
        setTimeout(() => {
          req.result = db;
          (req.onsuccess as (() => void) | undefined)?.();
        }, 0);
        return req;
      },
    };
    vi.stubGlobal('indexedDB', factory);

    const dumped = await dumpIndexedDbDatabaseToOpfs('community_pedigree_local_db', 'test reset');
    expect(dumped).not.toBeNull();
    expect(dumped?.kind).toBe('recovery_dump');
    expect(dumped?.fileName.startsWith('recovery-pre-reset-')).toBe(true);
  });

  it('returns null when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(dumpIndexedDbDatabaseToOpfs('missing_db', 'test reset')).resolves.toBeNull();
  });
});
