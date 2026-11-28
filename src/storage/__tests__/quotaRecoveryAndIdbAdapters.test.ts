/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Failure-path tests for the storage adapters: QuotaExceededError purge-and-retry,
 * VersionError recovery, and the OPFS write retry. These are the arms a happy-path
 * suite never reaches, and the ones an offline-first app hits at the worst moment.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IndexedDbStorageAdapter,
  MemoryStorageAdapter,
  OpfsStorageAdapter,
} from '@engine/storage/browserStorageAdapters';
import { executeIdbWriteWithQuotaRecovery } from '../sqliteIdbPersistence';
import { createInMemoryOpfsMock } from './support/inMemoryOpfs';

function makeQuotaError(message = 'quota exceeded'): Error {
  const err = new Error(message);
  err.name = 'QuotaExceededError';
  return err;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('executeIdbWriteWithQuotaRecovery', () => {
  it('returns immediately and never purges when the first write succeeds', async () => {
    const writeOnce = vi.fn(async () => undefined);
    const purge = vi.fn(async () => undefined);

    await expect(executeIdbWriteWithQuotaRecovery(writeOnce, purge)).resolves.toEqual({
      retriedAfterQuotaPurge: false,
    });
    expect(writeOnce).toHaveBeenCalledTimes(1);
    expect(purge).not.toHaveBeenCalled();
  });

  it('rethrows a non-quota error untouched, without purging caches', async () => {
    const failure = new Error('SQLITE_CORRUPT');
    const writeOnce = vi.fn(async () => {
      throw failure;
    });
    const purge = vi.fn(async () => undefined);

    await expect(executeIdbWriteWithQuotaRecovery(writeOnce, purge)).rejects.toBe(failure);
    expect(purge).not.toHaveBeenCalled();
    expect(writeOnce).toHaveBeenCalledTimes(1);
  });

  it('purges caches once and retries after QuotaExceededError', async () => {
    let attempt = 0;
    const writeOnce = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw makeQuotaError();
    });
    const purge = vi.fn(async () => undefined);

    await expect(executeIdbWriteWithQuotaRecovery(writeOnce, purge)).resolves.toEqual({
      retriedAfterQuotaPurge: true,
    });
    expect(purge).toHaveBeenCalledTimes(1);
    expect(writeOnce).toHaveBeenCalledTimes(2);
  });

  it('surfaces an actionable quota message when the retry also hits the quota', async () => {
    const writeOnce = vi.fn(async () => {
      throw makeQuotaError();
    });
    const purge = vi.fn(async () => undefined);

    await expect(executeIdbWriteWithQuotaRecovery(writeOnce, purge)).rejects.toThrow(
      /quota reached/i
    );
    expect(purge).toHaveBeenCalledTimes(1);
    expect(writeOnce).toHaveBeenCalledTimes(2);
  });

  it('rethrows the retry failure when it is not a quota error', async () => {
    let attempt = 0;
    const retryFailure = new Error('disk read-only');
    const writeOnce = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw makeQuotaError();
      throw retryFailure;
    });
    const purge = vi.fn(async () => undefined);

    await expect(executeIdbWriteWithQuotaRecovery(writeOnce, purge)).rejects.toBe(retryFailure);
  });

  it('still retries when the best-effort purge itself throws', async () => {
    let attempt = 0;
    const writeOnce = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw makeQuotaError();
    });
    const purge = vi.fn(async () => {
      throw new Error('OPFS /tmp purge failed');
    });

    await expect(executeIdbWriteWithQuotaRecovery(writeOnce, purge)).resolves.toEqual({
      retriedAfterQuotaPurge: true,
    });
  });
});

describe('MemoryStorageAdapter rollback on a failing batch', () => {
  it('restores the pre-batch values when a later operation throws', async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.setItem('kept', 'original');
    const boom = new Error('write failed');

    await expect(
      adapter.batch([
        { type: 'put', key: 'kept', value: 'overwritten' },
        {
          type: 'put',
          key: 'new-key',
          get value(): never {
            throw boom;
          },
        },
      ])
    ).rejects.toBe(boom);

    await expect(adapter.getItem('kept')).resolves.toBe('original');
    await expect(adapter.getItem('new-key')).resolves.toBeNull();
  });
});

interface FakeOpfsOptions {
  failWritesWith?: () => Error | null;
}

function installFakeOpfs(options: FakeOpfsOptions = {}) {
  const files = new Map<string, Uint8Array>();
  let writeAttempts = 0;
  let purgeCalls = 0;

  const kvDir = {
    async getFileHandle(name: string) {
      return {
        async getFile() {
          const bytes = files.get(name);
          return {
            size: bytes?.byteLength ?? 0,
            async arrayBuffer() {
              return bytes ? bytes.slice().buffer : new ArrayBuffer(0);
            },
          };
        },
        async createWritable() {
          return {
            async write(data: Uint8Array | string) {
              writeAttempts += 1;
              const failure = options.failWritesWith?.();
              if (failure) throw failure;
              const bytes =
                typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
              files.set(name, bytes);
            },
            async close() {
              // Flush is simulated synchronously in write above.
            },
          };
        },
      };
    },
    async removeEntry() {
      // Not exercised by the write path.
    },
  };

  const root = {
    async getDirectoryHandle() {
      return kvDir;
    },
    async removeEntry() {
      purgeCalls += 1;
    },
  };

  vi.stubGlobal('navigator', { storage: { getDirectory: async () => root } });
  return {
    files,
    getWriteAttempts: () => writeAttempts,
    getPurgeCalls: () => purgeCalls,
  };
}

describe('OpfsStorageAdapter quota and capability paths', () => {
  it('purges the /tmp namespace and rewrites once after QuotaExceededError', async () => {
    let first = true;
    const fake = installFakeOpfs({
      failWritesWith: () => {
        if (first) {
          first = false;
          return makeQuotaError();
        }
        return null;
      },
    });
    const adapter = new OpfsStorageAdapter({ namespace: 'quota test' });

    await adapter.setItem('animal:1', 'payload');

    expect(fake.getWriteAttempts()).toBe(2);
    expect(fake.getPurgeCalls()).toBe(1);
    await expect(adapter.getItem('animal:1')).resolves.toBe('payload');
    expect(adapter.name).toBe('opfs:quota_test');
  });

  it('propagates a non-quota write failure without purging', async () => {
    const failure = new Error('OPFS handle revoked');
    const fake = installFakeOpfs({ failWritesWith: () => failure });
    const adapter = new OpfsStorageAdapter();

    await expect(adapter.setItem('animal:2', 'payload')).rejects.toBe(failure);
    expect(fake.getPurgeCalls()).toBe(0);
    expect(fake.getWriteAttempts()).toBe(1);
  });

  it('reports OPFS as unsupported when navigator.storage.getDirectory is absent', async () => {
    vi.stubGlobal('navigator', { storage: {} });
    const adapter = new OpfsStorageAdapter();

    await expect(adapter.isSupported()).resolves.toBe(false);
    await expect(adapter.initialize()).rejects.toThrow(/not supported/i);
  });
});

function makeFakeIdbForVersionError() {
  const fakeDb = {
    objectStoreNames: { contains: () => true },
    transaction: () => {
      throw new Error('transaction not expected during initialize');
    },
    close: () => undefined,
  };
  let openCount = 0;
  let deleteCount = 0;

  const fakeFactory = {
    open: () => {
      const req: Record<string, unknown> = {};
      openCount += 1;
      setTimeout(() => {
        if (openCount === 1) {
          req.error = Object.assign(new Error('Version mismatch'), { name: 'VersionError' });
          (req.onerror as (() => void) | undefined)?.();
        } else {
          req.result = fakeDb;
          (req.onsuccess as (() => void) | undefined)?.();
        }
      }, 0);
      return req;
    },
    deleteDatabase: () => {
      deleteCount += 1;
      const req: Record<string, unknown> = {};
      setTimeout(() => (req.onsuccess as (() => void) | undefined)?.(), 0);
      return req;
    },
  };
  vi.stubGlobal('indexedDB', fakeFactory);

  return {
    getOpenCount: () => openCount,
    getDeleteCount: () => deleteCount,
  };
}

function makeFakeIdbForBatch(quotaOnFirstAttempt: boolean, hookProvided: boolean) {
  let attempts = 0;
  let hookCalls = 0;
  const db = {
    objectStoreNames: { contains: () => true },
    close: () => undefined,
    transaction: () => {
      const store = {
        put: () => undefined,
        delete: () => undefined,
      };
      const tx: Record<string, unknown> = { objectStore: () => store };
      setTimeout(() => {
        attempts += 1;
        if (quotaOnFirstAttempt && attempts === 1) {
          tx.error = makeQuotaError();
          (tx.onerror as (() => void) | undefined)?.();
        } else {
          (tx.oncomplete as (() => void) | undefined)?.();
        }
      }, 0);
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
    deleteDatabase: () => {
      const req: Record<string, unknown> = {};
      setTimeout(() => (req.onsuccess as (() => void) | undefined)?.(), 0);
      return req;
    },
  };
  vi.stubGlobal('indexedDB', factory);

  return {
    getAttempts: () => attempts,
    onQuotaExceeded: () => {
      hookCalls += 1;
    },
    getHookCalls: () => hookCalls,
    hookProvided,
  };
}

describe('IndexedDbStorageAdapter recovery paths', () => {
  it('invokes onVersionError and resets the database when resetOnVersionError is set', async () => {
    const fake = makeFakeIdbForVersionError();
    const onVersionError = vi.fn(async (_dbName: string, _err: unknown) => undefined);
    const adapter = new IndexedDbStorageAdapter({
      dbName: 'version_reset_db',
      onVersionError,
      resetOnVersionError: true,
    });

    await expect(adapter.initialize()).resolves.toBeUndefined();
    expect(onVersionError).toHaveBeenCalledTimes(1);
    expect(onVersionError).toHaveBeenCalledWith('version_reset_db', expect.anything());
    expect(fake.getDeleteCount()).toBe(1);
    expect(fake.getOpenCount()).toBe(2);
    await adapter.close();
  });

  it('rejects with the VersionError when resetting is not requested', async () => {
    makeFakeIdbForVersionError();
    const onVersionError = vi.fn(async () => undefined);
    const adapter = new IndexedDbStorageAdapter({
      dbName: 'version_no_reset_db',
      onVersionError,
    });

    await expect(adapter.initialize()).rejects.toMatchObject({ name: 'VersionError' });
    expect(onVersionError).toHaveBeenCalledTimes(1);
  });

  it('purges via onQuotaExceeded and retries the batch once', async () => {
    const harness = makeFakeIdbForBatch(true, true);
    const adapter = new IndexedDbStorageAdapter({
      dbName: 'quota_retry_db',
      onQuotaExceeded: harness.onQuotaExceeded,
    });

    await expect(adapter.setItem('animal:1', 'x')).resolves.toBeUndefined();
    expect(harness.getHookCalls()).toBe(1);
    expect(harness.getAttempts()).toBe(2);
    await adapter.close();
  });

  it('propagates QuotaExceededError when no cleanup hook is configured', async () => {
    const harness = makeFakeIdbForBatch(true, false);
    const adapter = new IndexedDbStorageAdapter({ dbName: 'quota_no_hook_db' });

    await expect(adapter.setItem('animal:1', 'x')).rejects.toMatchObject({
      name: 'QuotaExceededError',
    });
    expect(harness.getHookCalls()).toBe(0);
    expect(harness.getAttempts()).toBe(1);
  });
});
