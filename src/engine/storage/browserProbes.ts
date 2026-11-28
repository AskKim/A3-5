/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Tests what storage a browser really offers, because private mode and older browsers claim a feature and then fail.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Content-Agnostic Restricted-Browser Storage Probes & Resource Registry
 * (`@engine/storage/browserProbes.ts`).
 *
 * Safely guards property accesses on `localStorage`, `sessionStorage`, `indexedDB`,
 * `navigator.storage`, `navigator.locks`, and `BroadcastChannel` (for Safari Lockdown Mode
 * and private browsing contexts), tracks active handles/connections/channels for bfcache
 * lifecycle release, and provides canonical quota / blocked error classifiers.
 */

export interface SafeWebLocksApi {
  request<R>(
    name: string,
    options: { mode?: 'exclusive' | 'shared'; signal?: AbortSignal },
    callback: () => Promise<R>
  ): Promise<R>;
}

export interface SafeStorageManager {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
  estimate?: () => Promise<StorageEstimate>;
  getDirectory?: () => Promise<unknown>;
}

export function getSafeLocalStorage(probeKey = '__core_probe__'): Storage | null {
  try {
    const g = globalThis as unknown as { localStorage?: Storage; window?: { localStorage?: Storage } };
    const ls = g.localStorage ?? g.window?.localStorage;
    if (!ls || typeof ls.getItem !== 'function') {
      return null;
    }
    ls.getItem(probeKey);
    return ls;
  } catch {
    return null;
  }
}

export function probeLocalStorageSupport(
  probeKey = '__core_write_probe__',
  readProbeKey = '__core_probe__'
): { available: boolean; writable: boolean } {
  const ls = getSafeLocalStorage(readProbeKey);
  if (!ls) return { available: false, writable: false };
  try {
    if (typeof ls.setItem !== 'function' || typeof ls.removeItem !== 'function') {
      return { available: true, writable: false };
    }
    ls.setItem(probeKey, '1');
    ls.removeItem(probeKey);
    return { available: true, writable: true };
  } catch {
    return { available: true, writable: false };
  }
}

export function getSafeSessionStorage(probeKey = '__core_probe__'): Storage | null {
  try {
    const g = globalThis as unknown as { sessionStorage?: Storage; window?: { sessionStorage?: Storage } };
    const ss = g.sessionStorage ?? g.window?.sessionStorage;
    if (!ss || typeof ss.getItem !== 'function') {
      return null;
    }
    ss.getItem(probeKey);
    return ss;
  } catch {
    return null;
  }
}

export function getSafeIndexedDb(): IDBFactory | null {
  try {
    const g = globalThis as unknown as { indexedDB?: IDBFactory; window?: { indexedDB?: IDBFactory } };
    const idb = g.indexedDB ?? g.window?.indexedDB;
    if (!idb || typeof idb.open !== 'function') {
      return null;
    }
    return idb;
  } catch {
    return null;
  }
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number; message?: string };
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    (typeof e.message === 'string' && /quota/i.test(e.message))
  );
}

export function isIndexedDbBlockedError(err: unknown): boolean {
  if (!err) return false;
  const e = typeof err === 'object' ? (err as { name?: string; message?: string }) : undefined;
  const name = String(e?.name || '');
  const message = String(e?.message || (typeof err === 'string' ? err : ''));
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || name === 'VersionError') {
    return false;
  }
  if (
    name === 'SecurityError' ||
    name === 'InvalidStateError' ||
    name === 'UnknownError' ||
    name === 'NotAllowedError' ||
    name === 'NS_ERROR_FILE_ACCESS_DENIED'
  ) {
    return true;
  }
  return /indexeddb\s+is\s+unavailable|indexeddb\s+unavailable|private\s+browsing|lockdown|securityerror|not\s+allowed|backing\s+store|internal\s+error\s+opening\s+backing\s+store|mutation\s+operation\s+was\s+attempted\s+on\s+a\s+database\s+that\s+did\s+not\s+allow\s+mutations/i.test(
    `${name} ${message}`
  );
}

export function getSafeStorageManager(): SafeStorageManager | null {
  try {
    const g = globalThis as unknown as {
      navigator?: { storage?: SafeStorageManager };
    };
    const storage = g.navigator?.storage;
    if (!storage || typeof storage !== 'object') {
      return null;
    }
    return storage;
  } catch {
    return null;
  }
}

export function getSafeWebLocks(): SafeWebLocksApi | null {
  try {
    const g = globalThis as unknown as {
      navigator?: { locks?: SafeWebLocksApi };
    };
    const locks = g.navigator?.locks;
    if (!locks || typeof locks.request !== 'function') {
      return null;
    }
    return locks;
  } catch {
    return null;
  }
}

export function getSafeBroadcastChannelCtor(): (new (name: string) => BroadcastChannel) | null {
  try {
    const g = globalThis as unknown as {
      BroadcastChannel?: new (name: string) => BroadcastChannel;
    };
    const ctor = g.BroadcastChannel;
    if (typeof ctor !== 'function') {
      return null;
    }
    return ctor;
  } catch {
    return null;
  }
}

export function probeBroadcastChannelSupport(probeChannelName = '__core_bc_probe__'): boolean {
  const Ctor = getSafeBroadcastChannelCtor();
  if (!Ctor) return false;
  try {
    const ch = new Ctor(probeChannelName);
    try {
      ch.close();
    } catch {
      // Ignore probe close error
    }
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Active Resource Tracking (bfcache / pagehide / visibilitychange cleanup)
// ---------------------------------------------------------------------------

const activeIdbConnections = new Set<IDBDatabase>();
const activeIdbTransactions = new Set<IDBTransaction>();
const activeBroadcastChannels = new Map<BroadcastChannel, (() => void) | undefined>();
const pendingWebLockAborters = new Set<() => void>();

export function registerPendingWebLockAbort(abortFn: () => void): () => void {
  pendingWebLockAborters.add(abortFn);
  return () => {
    pendingWebLockAborters.delete(abortFn);
  };
}

export function abortPendingWebLocks(): number {
  let aborted = 0;
  for (const fn of Array.from(pendingWebLockAborters)) {
    pendingWebLockAborters.delete(fn);
    try {
      fn();
      aborted++;
    } catch {
      // Ignore abort error
    }
  }
  return aborted;
}

export function trackActiveIdbConnection(db: IDBDatabase | null | undefined): () => void {
  if (!db) return () => {};
  activeIdbConnections.add(db);
  try {
    const prevHandler = db.onversionchange;
    db.onversionchange = (ev: IDBVersionChangeEvent) => {
      if (typeof prevHandler === 'function') {
        try {
          prevHandler.call(db, ev);
        } catch {
          // Ignore prior handler error
        }
      }
      activeIdbConnections.delete(db);
      try {
        db.close();
      } catch {
        // Ignore versionchange close error
      }
    };
  } catch {
    // Lightweight test mocks may not permit setting onversionchange
  }
  return () => {
    activeIdbConnections.delete(db);
  };
}

export function trackActiveIdbTransaction(tx: IDBTransaction | null | undefined): () => void {
  if (!tx) return () => {};
  activeIdbTransactions.add(tx);
  const cleanup = () => {
    activeIdbTransactions.delete(tx);
  };
  if (typeof tx.addEventListener === 'function') {
    try {
      tx.addEventListener('complete', cleanup, { once: true });
      tx.addEventListener('abort', cleanup, { once: true });
      tx.addEventListener('error', cleanup, { once: true });
    } catch {
      // Ignore event listener attachment failures on lightweight mocks
    }
  }
  return cleanup;
}

export function releaseOpenIdbResources(): {
  transactionsAborted: number;
  connectionsClosed: number;
} {
  let transactionsAborted = 0;
  let connectionsClosed = 0;

  for (const tx of Array.from(activeIdbTransactions)) {
    activeIdbTransactions.delete(tx);
    try {
      if (typeof tx.abort === 'function') {
        tx.abort();
        transactionsAborted++;
      }
    } catch {
      // Transaction may already be finished/inactive
    }
  }

  for (const db of Array.from(activeIdbConnections)) {
    activeIdbConnections.delete(db);
    try {
      if (typeof db.close === 'function') {
        db.close();
        connectionsClosed++;
      }
    } catch {
      // Ignore close errors
    }
  }

  return { transactionsAborted, connectionsClosed };
}

export function trackBroadcastChannel(
  channel: BroadcastChannel | null | undefined,
  onForceClose?: () => void
): () => void {
  if (!channel) return () => {};
  activeBroadcastChannels.set(channel, onForceClose);
  return () => {
    activeBroadcastChannels.delete(channel);
  };
}

export function releaseOpenBroadcastChannels(): number {
  let closed = 0;
  for (const [ch, onForceClose] of Array.from(activeBroadcastChannels.entries())) {
    activeBroadcastChannels.delete(ch);
    try {
      if (typeof onForceClose === 'function') {
        onForceClose();
      }
    } catch {
      // Ignore cleanup callback errors
    }
    try {
      if (typeof ch.close === 'function') {
        ch.close();
      }
      closed++;
    } catch {
      // Ignore close error
    }
  }
  return closed;
}

let activeForegroundTransferLeases = 0;

export function acquireForegroundTransferLease(): () => void {
  activeForegroundTransferLeases++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeForegroundTransferLeases = Math.max(0, activeForegroundTransferLeases - 1);
  };
}

export function hasActiveForegroundTransferLease(): boolean {
  return activeForegroundTransferLeases > 0;
}

export function resetForegroundTransferLeasesForTests(): void {
  activeForegroundTransferLeases = 0;
}

export function getTrackedActiveResourceCounts(): {
  idbConnections: number;
  idbTransactions: number;
  broadcastChannels: number;
  pendingWebLocks: number;
  activeForegroundTransferLeases: number;
} {
  return {
    idbConnections: activeIdbConnections.size,
    idbTransactions: activeIdbTransactions.size,
    broadcastChannels: activeBroadcastChannels.size,
    pendingWebLocks: pendingWebLockAborters.size,
    activeForegroundTransferLeases,
  };
}

export function getTrackedActiveResourceCountsForTests(): {
  idbConnections: number;
  idbTransactions: number;
  broadcastChannels: number;
} {
  return {
    idbConnections: activeIdbConnections.size,
    idbTransactions: activeIdbTransactions.size,
    broadcastChannels: activeBroadcastChannels.size,
  };
}

// ---------------------------------------------------------------------------
// Cycle-Free Hook for Dumping Failing IndexedDB Stores to OPFS Recovery Vault
// ---------------------------------------------------------------------------

export type IndexedDbOpfsDumperFn = (dbName: string, reason: string) => Promise<unknown>;
let registeredIndexedDbOpfsDumper: IndexedDbOpfsDumperFn | null = null;

export function registerIndexedDbOpfsDumper(fn: IndexedDbOpfsDumperFn | null): void {
  registeredIndexedDbOpfsDumper = fn;
}

export function triggerIndexedDbOpfsDump(dbName: string, reason: string): void {
  if (!registeredIndexedDbOpfsDumper) return;
  try {
    void registeredIndexedDbOpfsDumper(dbName, reason).catch(() => {});
  } catch {
    // Ignore synchronous dump dispatch error
  }
}

export function resetTrackedProbeResourcesForTests(): void {
  activeIdbConnections.clear();
  activeIdbTransactions.clear();
  activeBroadcastChannels.clear();
  pendingWebLockAborters.clear();
  activeForegroundTransferLeases = 0;
  registeredIndexedDbOpfsDumper = null;
}
