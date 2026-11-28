import { describe, expect, it } from 'vitest';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import type { AlertDismissalDeps } from '../barnStore/useAlertDismissals';
import type { AnimalsCrudDeps } from '../barnStore/useAnimalsCrud';
import type { BackupReminderActionDeps } from '../barnStore/useBackupReminderActions';
import type { BreedingDeps } from '../barnStore/useBreeding';
import type { OpfsArchiveOffloadDeps } from '../barnStore/useOpfsArchiveOffload';
import type { OpfsVaultDeps } from '../barnStore/useOpfsVaultActions';
import type { PhotoMutationDeps } from '../barnStore/usePhotoMutations';
import type { RollingBackupDeps } from '../barnStore/useRollingBackupActions';
import type { SyncConflictResolutionDeps } from '../barnStore/useSyncConflictResolution';
import {
  createSliceCorePorts,
  SLICE_CORE_PORT_KEYS,
  type SliceCorePorts,
} from '../barnStore/slicePorts';

type Expect<T extends true> = T;
type CoreKeysOf<D> = Extract<keyof D, keyof SliceCorePorts>;
/** Every capability of the shared bundle that a slice declares must be satisfied by that bundle. */
type CoreCovers<D> = Pick<SliceCorePorts, CoreKeysOf<D>> extends Pick<D, CoreKeysOf<D>> ? true : false;

/**
 * Compile-time proof that spreading `sliceCorePorts` into each slice is type-safe. A slice that
 * changes the shape of a shared capability breaks this tuple instead of failing at runtime the first
 * time that capability is used.
 */
export type SliceWiringCoverage = [
  Expect<CoreCovers<AlertDismissalDeps>>,
  Expect<CoreCovers<AnimalsCrudDeps>>,
  Expect<CoreCovers<BackupReminderActionDeps>>,
  Expect<CoreCovers<BreedingDeps>>,
  Expect<CoreCovers<OpfsArchiveOffloadDeps>>,
  Expect<CoreCovers<OpfsVaultDeps>>,
  Expect<CoreCovers<PhotoMutationDeps>>,
  Expect<CoreCovers<RollingBackupDeps>>,
  Expect<CoreCovers<SyncConflictResolutionDeps>>
];

function buildPorts(): SliceCorePorts {
  return {
    enqueueStoreMutation: <T>(task: () => Promise<T>) => task(),
    snapshotRef: { current: null as BarnDatabaseSnapshot | null },
    deviceId: 'device-1',
    nextEntityRev: (_entityUuid, currentRev) => (currentRev ?? 0) + 1,
    allocateNextLogicalCounter: () => 1,
    nowIsoUtc: () => '2026-01-01T00:00:00.000Z',
    recordOutboxOps: async () => {},
    reloadFromAdapter: async () => {},
    notify: () => {},
    reportPersistenceFailure: () => {},
  };
}

describe('slice port bundle', () => {
  it('lists exactly the keys the bundle carries', () => {
    const ports = createSliceCorePorts(buildPorts());
    expect(Object.keys(ports).sort()).toEqual([...SLICE_CORE_PORT_KEYS].sort());
  });

  it('returns the bundle unchanged so the store can memoize one instance', () => {
    const ports = buildPorts();
    expect(createSliceCorePorts(ports)).toBe(ports);
  });

  it('serialises a slice write through the shared queue', async () => {
    const order: string[] = [];
    const ports = createSliceCorePorts({
      ...buildPorts(),
      enqueueStoreMutation: async (task) => {
        order.push('queue');
        const result = await task();
        order.push('done');
        return result;
      },
    });

    await ports.enqueueStoreMutation(async () => {
      order.push('write');
    });

    expect(order).toEqual(['queue', 'write', 'done']);
  });
});
