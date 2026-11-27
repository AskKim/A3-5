/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * IndexedDB Persistence, Quota Recovery & Browser Cache Cleanup for WebSqliteAdapter
 * (`src/storage/sqliteIdbPersistence.ts`).
 */

import { isQuotaExceededError } from '@engine/storage/browserProbes';
import { logDiagnosticEvent } from './crashLogger';
import { dumpIndexedDbDatabaseToOpfs, isVersionError } from './opfsStorage';
import {
  getSafeIndexedDb,
  trackActiveIdbConnection,
  trackActiveIdbTransaction,
} from './storageProbes';

export const IDB_DB_NAME = 'community_pedigree_local_db';
export const IDB_STORE_NAME = 'sqlite_files';
export const IDB_PRIMARY_KEY = 'pedigree_master.sqlite';
export const IDB_FALLBACK_SNAPSHOT_KEY = 'pedigree_fallback_json';
export const IDB_WRITE_EPOCH_KEY = 'pedigree_write_epoch';
export const DB_WRITE_LOCK_NAME = 'community_pedigree_db_write_v1';

export interface PersistedWriteEpochMeta {
  epoch: number;
  writerTabId: string;
  updatedAtIso: string;
}

const IDB_OPEN_TIMEOUT_MS = 8000;

export function openSqliteIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const idb = getSafeIndexedDb();
    if (!idb) {
      reject(new Error('IndexedDB is unavailable in this browser context.'));
      return;
    }
    let settled = false;
    const finish = (cb: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cb();
    };
    const timer = setTimeout(() => {
      finish(() => {
        logDiagnosticEvent({
          level: 'warn',
          category: 'storage',
          message:
            'Corrective action: Primary IndexedDB open timed out after 8s — falling back to non-destructive recovery',
        });
        reject(new Error('Timed out opening local IndexedDB storage.'));
      });
    }, IDB_OPEN_TIMEOUT_MS);

    try {
      const req = idb.open(IDB_DB_NAME, 1);
      req.onupgradeneeded = () => {
        try {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
            db.createObjectStore(IDB_STORE_NAME);
          }
        } catch (upgradeErr) {
          void dumpIndexedDbDatabaseToOpfs(
            IDB_DB_NAME,
            'Primary IndexedDB schema upgrade failed'
          ).catch(() => {});
          finish(() => reject(upgradeErr));
        }
      };
      req.onblocked = () => {
        logDiagnosticEvent({
          level: 'warn',
          category: 'storage',
          message:
            'Corrective action: Primary IndexedDB connection blocked by another tab or worker',
        });
      };
      req.onsuccess = () => finish(() => resolve(req.result));
      req.onerror = () => {
        const err = req.error || new Error('IndexedDB open failed.');
        if (isVersionError(err)) {
          void dumpIndexedDbDatabaseToOpfs(
            IDB_DB_NAME,
            'Primary IndexedDB VersionError on open'
          ).catch(() => {});
        }
        finish(() => reject(err));
      };
    } catch (err) {
      finish(() => reject(err));
    }
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openSqliteIdb();
  const untrackDb = trackActiveIdbConnection(db);
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const untrackTx = trackActiveIdbTransaction(tx);
      const req = tx.objectStore(IDB_STORE_NAME).get(key);
      req.onsuccess = () => {
        untrackTx();
        resolve(req.result as T | undefined);
      };
      req.onerror = () => {
        untrackTx();
        reject(req.error);
      };
      tx.onabort = () => {
        untrackTx();
        reject(tx.error || new Error('IndexedDB read transaction aborted.'));
      };
    });
  } finally {
    untrackDb();
    try {
      db.close();
    } catch {
      // Ignore close error
    }
  }
}

export async function idbSet<T>(
  key: string,
  value: T,
  onPurgeTemp?: () => Promise<void>
): Promise<void> {
  return idbSetAtomic([{ key, value }], onPurgeTemp);
}

export async function executeIdbWriteWithQuotaRecovery(
  writeOnce: () => Promise<void>,
  purgeCaches: () => Promise<void>
): Promise<{ retriedAfterQuotaPurge: boolean }> {
  try {
    await writeOnce();
    return { retriedAfterQuotaPurge: false };
  } catch (err) {
    if (!isQuotaExceededError(err)) {
      throw err;
    }
    try {
      await purgeCaches();
    } catch {
      // Best-effort cleanup before single retry
    }
    try {
      await writeOnce();
      return { retriedAfterQuotaPurge: true };
    } catch (retryErr) {
      if (isQuotaExceededError(retryErr)) {
        throw new Error(
          'Browser storage quota reached (QuotaExceededError). Export a backup and clear older photos or install to Home Screen to elevate storage.'
        );
      }
      throw retryErr;
    }
  }
}

async function idbWriteEntriesOnce(
  entries: Array<{ key: string; value: unknown }>
): Promise<void> {
  let db: IDBDatabase | null = null;
  let untrackDb: (() => void) | null = null;
  try {
    db = await openSqliteIdb();
    untrackDb = trackActiveIdbConnection(db);
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(IDB_STORE_NAME, 'readwrite');
      const untrackTx = trackActiveIdbTransaction(tx);
      const store = tx.objectStore(IDB_STORE_NAME);
      for (const entry of entries) {
        store.put(entry.value, entry.key);
      }
      tx.oncomplete = () => {
        untrackTx();
        resolve();
      };
      tx.onerror = () => {
        untrackTx();
        reject(tx.error);
      };
      tx.onabort = () => {
        untrackTx();
        reject(tx.error || new Error('IndexedDB write transaction aborted.'));
      };
    });
  } finally {
    untrackDb?.();
    try {
      db?.close();
    } catch {
      // Ignore close error
    }
  }
}

export async function idbSetAtomic(
  entries: Array<{ key: string; value: unknown }>,
  onPurgeTemp?: () => Promise<void>
): Promise<void> {
  if (entries.length === 0) return;
  const isPrimaryWrite = entries.some((e) => e.key === IDB_PRIMARY_KEY);
  const includesFallbackWrite = entries.some((e) => e.key === IDB_FALLBACK_SNAPSHOT_KEY);

  const result = await executeIdbWriteWithQuotaRecovery(
    () => idbWriteEntriesOnce(entries),
    async () => {
      if (onPurgeTemp) {
        await onPurgeTemp().catch(() => undefined);
      }
      if (isPrimaryWrite && !includesFallbackWrite) {
        await idbDelete(IDB_FALLBACK_SNAPSHOT_KEY).catch(() => {});
      }
      logDiagnosticEvent({
        level: 'warn',
        category: 'storage',
        message:
          'Corrective action: QuotaExceededError on IndexedDB write — purged OPFS /tmp and non-essential fallback cache before retrying once.',
      });
    }
  );

  if (result.retriedAfterQuotaPurge) {
    logDiagnosticEvent({
      level: 'info',
      category: 'storage',
      message: 'Corrective action: IndexedDB write succeeded after QuotaExceededError cache purge.',
    });
  }
}

export async function idbDelete(key: string): Promise<void> {
  if (!getSafeIndexedDb()) return;
  const db = await openSqliteIdb();
  const untrackDb = trackActiveIdbConnection(db);
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const untrackTx = trackActiveIdbTransaction(tx);
      tx.objectStore(IDB_STORE_NAME).delete(key);
      tx.oncomplete = () => {
        untrackTx();
        resolve();
      };
      tx.onerror = () => {
        untrackTx();
        resolve();
      };
      tx.onabort = () => {
        untrackTx();
        resolve();
      };
    });
  } finally {
    untrackDb();
    try {
      db.close();
    } catch {
      // Ignore close error
    }
  }
}

/**
 * Purges stale PWA CacheStorage assets, Service Worker registrations, and fallback snapshot caches
 * without deleting the user's primary IndexedDB herd database or diagnostic logs.
 */
export async function purgeStaleBrowserCaches(): Promise<{
  cachesCleared: number;
  serviceWorkersUnregistered: number;
}> {
  let cachesCleared = 0;
  let serviceWorkersUnregistered = 0;

  try {
    await idbDelete(IDB_FALLBACK_SNAPSHOT_KEY);
  } catch {
    // Ignore IDB fallback delete failure
  }

  if (typeof caches !== 'undefined') {
    try {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        const deleted = await caches.delete(name);
        if (deleted) cachesCleared++;
      }
    } catch {
      // Ignore CacheStorage error
    }
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        const unregistered = await reg.unregister();
        if (unregistered) serviceWorkersUnregistered++;
      }
    } catch {
      // Ignore ServiceWorker unregister failure
    }
  }

  return { cachesCleared, serviceWorkersUnregistered };
}
