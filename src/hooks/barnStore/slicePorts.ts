/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The bundle every barn-store slice is wired with.
 *
 * Each `use*` slice under `src/hooks/barnStore/` declares its own deps interface, and the store was
 * passing the same ten capabilities to every one of them by hand at every call site: the serial write
 * queue, the snapshot ref, the device id, revision and counter allocation, the clock, the outbox,
 * reload, notify and failure reporting. A capability wired once but missed at another call site fails
 * only at the moment that slice needs it.
 *
 * The store builds this bundle once per render and spreads it into every slice; the slice adds only
 * its own capabilities (adapter facades, photo-cache helpers, selection state). `SLICE_CORE_PORT_KEYS`
 * and `slicePorts.test.ts` keep the interface, the key list and the slice deps in step.
 */
import type { BarnDatabaseSnapshot } from '../../domain/models';
import type { SyncOperation } from '../../domain/syncOutbox';

/** Capabilities every slice shares. */
export interface SliceCorePorts {
  enqueueStoreMutation: <T>(task: () => Promise<T>) => Promise<T>;
  snapshotRef: { current: BarnDatabaseSnapshot | null };
  deviceId: string;
  nextEntityRev: (entityUuid: string, currentRev?: number) => number;
  allocateNextLogicalCounter: () => number;
  nowIsoUtc: () => string;
  recordOutboxOps: (operations: SyncOperation[]) => Promise<void>;
  reloadFromAdapter: () => Promise<void>;
  notify: (message: string) => void;
  reportPersistenceFailure: (action: string, error: unknown) => void;
}

/** The keys `createSliceCorePorts` owns; a slice must not be asked to supply one itself. */
export const SLICE_CORE_PORT_KEYS: ReadonlyArray<keyof SliceCorePorts> = [
  'enqueueStoreMutation',
  'snapshotRef',
  'deviceId',
  'nextEntityRev',
  'allocateNextLogicalCounter',
  'nowIsoUtc',
  'recordOutboxOps',
  'reloadFromAdapter',
  'notify',
  'reportPersistenceFailure',
];

/** Builds the shared bundle. Identity-returning so callers can `useMemo` it without a wrapper. */
export function createSliceCorePorts(config: SliceCorePorts): SliceCorePorts {
  return config;
}
