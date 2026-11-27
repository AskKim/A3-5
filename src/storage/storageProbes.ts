/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Restricted-Browser Storage Probes & Lifecycle Resource Registry (`src/storage/storageProbes.ts`).
 *
 * Thin domain facade over `@engine/storage/browserProbes` supplying Community Pedigree
 * probe keys while preserving 100% of existing exports for Dedicated Web Workers
 * (`opfsTempStream.ts`) and main-thread adapters alike.
 */

import {
  getSafeLocalStorage as getSafeLocalStorageCore,
  getSafeSessionStorage as getSafeSessionStorageCore,
  getTrackedActiveResourceCounts as getTrackedActiveResourceCountsCore,
  probeBroadcastChannelSupport as probeBroadcastChannelSupportCore,
  probeLocalStorageSupport as probeLocalStorageSupportCore,
  registerIndexedDbOpfsDumper as registerIndexedDbOpfsDumperCore,
  triggerIndexedDbOpfsDump as triggerIndexedDbOpfsDumpCore,
  type IndexedDbOpfsDumperFn,
} from '@engine/storage/browserProbes';

export {
  abortPendingWebLocks,
  acquireForegroundTransferLease,
  getSafeBroadcastChannelCtor,
  getSafeIndexedDb,
  getSafeStorageManager,
  getSafeWebLocks,
  getTrackedActiveResourceCountsForTests,
  hasActiveForegroundTransferLease,
  isIndexedDbBlockedError,
  isQuotaExceededError,
  registerPendingWebLockAbort,
  releaseOpenBroadcastChannels,
  releaseOpenIdbResources,
  resetForegroundTransferLeasesForTests,
  trackActiveIdbConnection,
  trackActiveIdbTransaction,
  trackBroadcastChannel,
  type IndexedDbOpfsDumperFn,
  type SafeStorageManager,
  type SafeWebLocksApi,
} from '@engine/storage/browserProbes';

const PEDIGREE_PROBE_KEY = '__pedigree_probe__';
const PEDIGREE_WRITE_PROBE_KEY = '__pedigree_write_probe__';
const PEDIGREE_BC_PROBE_NAME = '__pedigree_bc_probe__';

export function getSafeLocalStorage(): Storage | null {
  return getSafeLocalStorageCore(PEDIGREE_PROBE_KEY);
}

export function probeLocalStorageSupport(): { available: boolean; writable: boolean } {
  return probeLocalStorageSupportCore(PEDIGREE_WRITE_PROBE_KEY, PEDIGREE_PROBE_KEY);
}

export function getSafeSessionStorage(): Storage | null {
  return getSafeSessionStorageCore(PEDIGREE_PROBE_KEY);
}

export function probeBroadcastChannelSupport(): boolean {
  return probeBroadcastChannelSupportCore(PEDIGREE_BC_PROBE_NAME);
}

export function getTrackedActiveResourceCounts(): {
  idbConnections: number;
  idbTransactions: number;
  broadcastChannels: number;
  pendingWebLocks: number;
  activeForegroundTransferLeases: number;
} {
  return getTrackedActiveResourceCountsCore();
}

export function registerIndexedDbOpfsDumper(fn: IndexedDbOpfsDumperFn | null): void {
  registerIndexedDbOpfsDumperCore(fn);
}

export function triggerIndexedDbOpfsDump(dbName: string, reason: string): void {
  triggerIndexedDbOpfsDumpCore(dbName, reason);
}
