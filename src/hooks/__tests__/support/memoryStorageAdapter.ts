/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * In-memory `StorageAdapter` for the milestone 7 render-level harness.
 *
 * The render-level tests need a real React commit against a storage engine that behaves like the
 * SQLite one — replace, upsert, delete, cascade — without IndexedDB, OPFS or WASM. Every write lands
 * in a plain object; `loadSnapshot` hands back a fresh deep copy so the hook sees the same
 * new-object-per-reload shape it gets in the browser, which is exactly what the selector memo has to
 * survive.
 */
import type { Animal, AnimalPhoto, BarnDatabaseSnapshot, CareLog } from '../../../domain/models';
import type { SnapshotLoadOptions, StorageAdapter } from '../../../storage/storageAdapter';

/** Method suffix → snapshot collection it upserts into. */
const COLLECTIONS: Record<string, keyof BarnDatabaseSnapshot> = {
  animal: 'animals',
  animalPhoto: 'animalPhotos',
  speciesProfile: 'speciesProfiles',
  cage: 'cages',
  breeding: 'breedings',
  task: 'tasks',
  careLog: 'careLogs',
  show: 'shows',
  feedBatch: 'feedBatches',
  feedAllocation: 'feedAllocations',
  ledgerEntry: 'ledgerEntries',
  processingLog: 'processingLogs',
  youthProjectBook: 'youthProjectBooks',
  clientContact: 'clientContacts',
  waitlistEntry: 'waitlistEntries',
  animalReservation: 'animalReservations',
  woolHarvest: 'woolHarvests',
  mileageLog: 'mileageLogs',
  journalEntry: 'journalEntries',
  judgeClub: 'judgeClubs',
  judgeAssignment: 'judgeAssignments',
  judgeExpense: 'judgeExpenses',
};

type Row = { id: string };

export interface MemoryStorageAdapter extends StorageAdapter {
  /** Replaces the stored dataset, as a restore or import would. */
  seed(snapshot: BarnDatabaseSnapshot): void;
  /** The dataset currently stored, without the deep copy `loadSnapshot` returns. */
  read(): BarnDatabaseSnapshot;
  /** Writes the adapter has accepted, in order. */
  readonly writes: string[];
}

export function createMemoryStorageAdapter(
  initial: BarnDatabaseSnapshot
): MemoryStorageAdapter {
  let current: BarnDatabaseSnapshot = structuredClone(initial);
  const writes: string[] = [];

  const collectionFor = (noun: string): keyof BarnDatabaseSnapshot | undefined =>
    COLLECTIONS[noun] ?? COLLECTIONS[noun.replace(/s$/, '')];

  const upsert = (noun: string, row: Row): void => {
    const key = collectionFor(noun);
    if (!key) throw new Error(`memory adapter: no collection for "save${noun}"`);
    const list = (current[key] ?? []) as Row[];
    const index = list.findIndex((r) => r.id === row.id);
    if (index >= 0) list[index] = structuredClone(row);
    else list.push(structuredClone(row));
    writes.push(`save:${noun}:${row.id}`);
  };

  const remove = (noun: string, id: string): void => {
    const key = collectionFor(noun);
    if (!key) throw new Error(`memory adapter: no collection for "delete${noun}"`);
    const list = (current[key] ?? []) as Row[];
    const remaining = list.filter((r) => r.id !== id);
    (current[key] as Row[]) = remaining;
    writes.push(`delete:${noun}:${id}`);
  };

  const base: Partial<StorageAdapter> = {
    engineName: 'In-memory test adapter',
    initialize: async (): Promise<BarnDatabaseSnapshot> => structuredClone(current),
    loadSnapshot: async (_options?: SnapshotLoadOptions): Promise<BarnDatabaseSnapshot> =>
      structuredClone(current),
    replaceSnapshot: async (snapshot: BarnDatabaseSnapshot): Promise<void> => {
      current = structuredClone(snapshot);
      writes.push('replace');
    },
    saveSettings: async (settings): Promise<void> => {
      current.settings = structuredClone(settings);
      writes.push('save:settings');
    },
    exportRawSqliteBytes: async (): Promise<Uint8Array | null> => null,
    importRawSqliteBytes: async (): Promise<BarnDatabaseSnapshot> => structuredClone(current),
    loadAnimalPhotoDataUrl: async (photoId: string): Promise<string | null> =>
      (current.animalPhotos ?? []).find((p) => p.id === photoId)?.dataUrl ?? null,
    syncFromPersistedStorageIfStale: async (): Promise<boolean> => false,
    getWipedRecoveryContext: () => null,
    getCorruptionRecoveryNotice: () => null,
    isEphemeralMode: () => false,
  };

  return new Proxy(base as StorageAdapter, {
    get(target, prop) {
      if (typeof prop !== 'string') return undefined;
      if (prop in target) return Reflect.get(target, prop);
      const save = /^save(\w+?)(sBatch)?$/.exec(prop);
      if (save) {
        const noun = save[1][0].toLowerCase() + save[1].slice(1);
        return save[2]
          ? async (rows: Row[]) => rows.forEach((row) => upsert(noun, row))
          : async (row: Row) => upsert(noun, row);
      }
      const del = /^delete(\w+?)(sBatch)?$/.exec(prop);
      if (del) {
        const noun = del[1][0].toLowerCase() + del[1].slice(1);
        return del[2]
          ? async (ids: string[]) => ids.forEach((id) => remove(noun, id))
          : async (id: string) => {
              if (noun === 'animal') {
                // The real adapter cascades animal deletes to photos and care logs.
                (current.animalPhotos ?? [])
                  .filter((p: AnimalPhoto) => p.animalId === id)
                  .forEach((p) => remove('animalPhoto', p.id));
                (current.careLogs ?? [])
                  .filter((l: CareLog) => l.animalId === id)
                  .forEach((l) => remove('careLog', l.id));
              }
              remove(noun, id);
            };
      }
      return undefined;
    },
  }) as unknown as MemoryStorageAdapter;
}
