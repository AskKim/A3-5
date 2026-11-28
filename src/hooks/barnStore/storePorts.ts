/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * React-free store ports.
 *
 * The mutation slices (`useAnimalsCrud`, `usePhotoMutations`, `useBreeding`) export plain action
 * functions that take a deps object. Inside the app the hook supplies those deps; outside a component
 * (backup import, P2P reconciliation, tests) there was no way to build them without pulling in React.
 *
 * `createStorePorts` builds that shared bundle with the same guarantees the hook has:
 *  - a serial write queue that keeps its chain alive after a rejected mutation,
 *  - per-entity revision allocation that never goes backwards, even if the caller passes a stale rev,
 *  - the persisted logical sync counter,
 *  - a snapshot ref the caller owns, so actions always read the latest in-memory state.
 */
import type { BarnDatabaseSnapshot } from '../../domain/models';
import { bumpRecordRevision } from '../../domain/syncOutbox';
import { allocateNextLogicalCounter } from '../../storage/localSyncChannels';

/** Optional overrides for the ports bundle; every field has a safe default. */
export interface StorePortsConfig {
  deviceId: string;
  snapshotRef?: { current: BarnDatabaseSnapshot | null };
  nowIsoUtc?: () => string;
  isOnline?: () => boolean;
  notify?: (message: string) => void;
  reportPersistenceFailure?: (action: string, error: unknown) => void;
  setPendingCalendarSync?: (payload: { tasks: never[]; filenameHint: string }) => void;
}

/** The shared bundle the mutation slices and non-component callers run against. */
export interface StorePorts {
  snapshotRef: { current: BarnDatabaseSnapshot | null };
  deviceId: string;
  nowIsoUtc: () => string;
  isOnline: () => boolean;
  notify: (message: string) => void;
  reportPersistenceFailure: (action: string, error: unknown) => void;
  setPendingCalendarSync: (payload: { tasks: never[]; filenameHint: string }) => void;
  enqueueStoreMutation: <T>(task: () => Promise<T>) => Promise<T>;
  nextEntityRev: (entityUuid: string, currentRev?: number) => number;
  allocateNextLogicalCounter: () => number;
}

/** Builds the ports bundle described in this module's header. */
export function createStorePorts(config: StorePortsConfig): StorePorts {
  const snapshotRef = config.snapshotRef ?? { current: null };
  let queue: Promise<unknown> = Promise.resolve();
  const maxRevByEntity = new Map<string, number>();

  const enqueueStoreMutation = <T,>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    // Keep the chain alive even if an individual write rejects.
    queue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };

  const nextEntityRev = (entityUuid: string, currentRev?: number): number => {
    const revArg = typeof currentRev === 'number' && Number.isFinite(currentRev) ? currentRev : 0;
    const revIndexed = maxRevByEntity.get(entityUuid) ?? 0;
    const maxSeen = revArg > revIndexed ? revArg : revIndexed;
    const rev = bumpRecordRevision({ _rev: maxSeen });
    maxRevByEntity.set(entityUuid, rev);
    return rev;
  };

  return {
    snapshotRef,
    deviceId: config.deviceId,
    nowIsoUtc: config.nowIsoUtc ?? (() => new Date().toISOString()),
    isOnline: config.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine)),
    notify: config.notify ?? (() => undefined),
    reportPersistenceFailure: config.reportPersistenceFailure ?? (() => undefined),
    setPendingCalendarSync: config.setPendingCalendarSync ?? (() => undefined),
    enqueueStoreMutation,
    nextEntityRev,
    allocateNextLogicalCounter,
  };
}
