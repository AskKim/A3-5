/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Rev-keyed species selectors — milestone 5 item 12.
 *
 * `baseSpeciesData` used to re-filter and re-sort every collection whenever the snapshot object
 * changed identity, which any settings or outbox write does. Each selector here is a pure function
 * of one collection plus the active species, so the store can memoise it on a cheap signature of
 * the rows' `id`/`_rev` pairs instead of on the snapshot object: an untouched collection keeps
 * both its result and the array identity downstream memos compare against.
 *
 * The signature is FNV-1a over `id:rev` in row order, so any write (revision bump, insert, delete)
 * changes it, and the bounded cache cannot grow with the session. Because a restore or import can
 * put the same ids back at the same revisions with different content, every key is also scoped to
 * a dataset epoch that those operations bump via `invalidateSpeciesSelectorCache()`.
 */
import type {
  Animal,
  AnimalPhoto,
  AnimalReservation,
  BarnJournalEntry,
  BarnTask,
  BreedingRecord,
  CageLocation,
  CareLog,
  ClientContact,
  FeedAllocation,
  FeedBatch,
  JudgeAssignment,
  JudgeClubContact,
  JudgeExpense,
  LedgerEntry,
  MileageLog,
  ProcessingLog,
  ShowEvent,
  WaitlistEntry,
  WoolHarvest,
  YouthProjectBook,
} from '../../domain/models';
import { isSameSpecies } from '../../domain/models';

type RevRow = { id: string; _rev?: number };

/** Small cache: kinds × species × a few revisions each, never unbounded. */
const MAX_CACHE_ENTRIES = 64;
const cache = new Map<string, unknown>();

/**
 * Bumped on every wholesale dataset replacement. Revision signatures alone cannot tell a restore
 * apart from the dataset it replaced: a backup can hold the same row ids at the same revisions
 * with different field values, so the signature must be scoped to the dataset generation too.
 */
let datasetEpoch = 0;

/**
 * Drops every memoised list and starts a new dataset generation. Call this after any operation
 * that replaces the whole snapshot — backup/archive/SQLite restores, JSON and platform imports —
 * before the replacement becomes visible. Restores and imports must never serve rows computed
 * from the dataset they replaced.
 */
export function invalidateSpeciesSelectorCache(): void {
  datasetEpoch += 1;
  cache.clear();
}

/** Clears the memo cache; tests use it so cases cannot leak into each other. */
export function resetSpeciesSelectorCache(): void {
  invalidateSpeciesSelectorCache();
}

/**
 * Cheap signature of a collection: its length plus an FNV-1a hash of `id:rev` in row order.
 * Unchanged rows keep the same signature even when the snapshot object around them is new.
 */
export function collectionRevKey(rows: readonly RevRow[] | undefined): string {
  const list = rows ?? [];
  let hash = 0x811c9dc5;
  for (const row of list) {
    const token = `${row.id}:${row._rev ?? 0}`;
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return `${list.length}:${(hash >>> 0).toString(36)}`;
}

/**
 * Runs `compute` once per (kind, species, rev signature, extra key) and reuses the result while
 * that signature is unchanged. The returned value is shared: callers must not mutate it.
 */
export function memoizeByCollectionRev<T extends RevRow, R>(
  kind: string,
  speciesName: string,
  rows: readonly T[] | undefined,
  compute: (rows: readonly T[]) => R,
  extraKey = ''
): R {
  const list = rows ?? [];
  const key = `${datasetEpoch}|${kind}|${speciesName}|${collectionRevKey(list)}|${extraKey}`;
  if (cache.has(key)) return cache.get(key) as R;
  const value = compute(list);
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, value);
  return value;
}

/** Active-species animals, sorted by name. */
export function selectSpeciesAnimals(
  rows: readonly Animal[] | undefined,
  speciesName: string
): Animal[] {
  return memoizeByCollectionRev('animals', speciesName, rows, (list) =>
    list.filter((a) => isSameSpecies(a.species, speciesName)).sort((a, b) => a.name.localeCompare(b.name))
  );
}

/** Active-species cages, in stored order. */
export function selectSpeciesCages(
  rows: readonly CageLocation[] | undefined,
  speciesName: string
): CageLocation[] {
  return memoizeByCollectionRev('cages', speciesName, rows, (list) =>
    list.filter((c) => isSameSpecies(c.species, speciesName))
  );
}

/** Active-species breedings, newest bred date first. */
export function selectSpeciesBreedings(
  rows: readonly BreedingRecord[] | undefined,
  speciesName: string
): BreedingRecord[] {
  return memoizeByCollectionRev('breedings', speciesName, rows, (list) =>
    list
      .filter((b) => isSameSpecies(b.species, speciesName))
      .sort((a, b) => b.bredDateIso.localeCompare(a.bredDateIso))
  );
}

/**
 * Active-species tasks, incomplete before completed, then priority, then due date.
 * Tasks linked to an archived animal are hidden unless already completed.
 */
export function selectSpeciesTasks(
  rows: readonly BarnTask[] | undefined,
  speciesName: string,
  archivedAnimals: readonly Animal[]
): BarnTask[] {
  const archivedIds = new Set(archivedAnimals.map((a) => a.id));
  const extraKey = collectionRevKey(archivedAnimals);
  return memoizeByCollectionRev(
    'tasks',
    speciesName,
    rows,
    (list) =>
      list
        .filter(
          (t) =>
            isSameSpecies(t.species, speciesName) &&
            // Archived animals stay in storage for pedigrees but do not generate active incomplete tasks
            (!t.linkedAnimalId || !archivedIds.has(t.linkedAnimalId) || t.completed)
        )
        .sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          const pDiff = taskPriorityRank(a.priority) - taskPriorityRank(b.priority);
          if (pDiff !== 0) return pDiff;
          return (a.dueDateIso || '9999-99-99').localeCompare(b.dueDateIso || '9999-99-99');
        }),
    extraKey
  );
}

function taskPriorityRank(priority: string): number {
  return priority === 'High' ? 0 : priority === 'Normal' ? 1 : 2;
}

/** Active-species care logs, newest date first. */
export function selectSpeciesCareLogs(
  rows: readonly CareLog[] | undefined,
  speciesName: string
): CareLog[] {
  return memoizeByCollectionRev('careLogs', speciesName, rows, (list) =>
    list
      .filter((l) => isSameSpecies(l.species, speciesName))
      .sort((a, b) => b.dateIso.localeCompare(a.dateIso))
  );
}

/** Active-species shows, earliest event date first. */
export function selectSpeciesShows(
  rows: readonly ShowEvent[] | undefined,
  speciesName: string
): ShowEvent[] {
  return memoizeByCollectionRev('shows', speciesName, rows, (list) =>
    list
      .filter((s) => isSameSpecies(s.species, speciesName))
      .sort((a, b) => a.eventDateIso.localeCompare(b.eventDateIso))
  );
}

/** Active-species feed batches, newest purchase date first. */
export function selectSpeciesFeedBatches(
  rows: readonly FeedBatch[] | undefined,
  speciesName: string
): FeedBatch[] {
  return memoizeByCollectionRev('feedBatches', speciesName, rows, (list) =>
    list
      .filter((b) => isSameSpecies(b.species, speciesName))
      .sort(
        (a, b) =>
          (b.purchaseDateIso || '').localeCompare(a.purchaseDateIso || '') ||
          b.createdAt.localeCompare(a.createdAt)
      )
  );
}

/** Active-species feed allocations, newest date first. */
export function selectSpeciesFeedAllocations(
  rows: readonly FeedAllocation[] | undefined,
  speciesName: string
): FeedAllocation[] {
  return memoizeByCollectionRev('feedAllocations', speciesName, rows, (list) =>
    list
      .filter((al) => isSameSpecies(al.species, speciesName))
      .sort(
        (a, b) =>
          (b.dateIso || '').localeCompare(a.dateIso || '') || b.createdAt.localeCompare(a.createdAt)
      )
  );
}

/** Active-species ledger entries, newest date first. */
export function selectSpeciesLedgerEntries(
  rows: readonly LedgerEntry[] | undefined,
  speciesName: string
): LedgerEntry[] {
  return memoizeByCollectionRev('ledgerEntries', speciesName, rows, (list) =>
    list
      .filter((le) => isSameSpecies(le.species, speciesName))
      .sort(
        (a, b) =>
          (b.dateIso || '').localeCompare(a.dateIso || '') || b.createdAt.localeCompare(a.createdAt)
      )
  );
}

/** Active-species processing logs, newest harvest or scheduled date first. */
export function selectSpeciesProcessingLogs(
  rows: readonly ProcessingLog[] | undefined,
  speciesName: string
): ProcessingLog[] {
  return memoizeByCollectionRev('processingLogs', speciesName, rows, (list) =>
    list
      .filter((pl) => isSameSpecies(pl.species, speciesName))
      .sort(
        (a, b) =>
          (b.harvestDateIso || b.scheduledDateIso || '').localeCompare(
            a.harvestDateIso || a.scheduledDateIso || ''
          ) || b.createdAt.localeCompare(a.createdAt)
      )
  );
}

/** Active-species youth project books, newest project year first. */
export function selectSpeciesYouthProjectBooks(
  rows: readonly YouthProjectBook[] | undefined,
  speciesName: string
): YouthProjectBook[] {
  return memoizeByCollectionRev('youthProjectBooks', speciesName, rows, (list) =>
    list
      .filter((yp) => isSameSpecies(yp.species, speciesName))
      .sort(
        (a, b) =>
          (b.projectYear || '').localeCompare(a.projectYear || '') ||
          (b.startDateIso || '').localeCompare(a.startDateIso || '') ||
          b.createdAt.localeCompare(a.createdAt)
      )
  );
}

/** Active-species client contacts, sorted by name. */
export function selectSpeciesClientContacts(
  rows: readonly ClientContact[] | undefined,
  speciesName: string
): ClientContact[] {
  return memoizeByCollectionRev('clientContacts', speciesName, rows, (list) =>
    list
      .filter((c) => isSameSpecies(c.species, speciesName))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  );
}

/** Active-species waitlist entries, priority rank first, then newest. */
export function selectSpeciesWaitlistEntries(
  rows: readonly WaitlistEntry[] | undefined,
  speciesName: string
): WaitlistEntry[] {
  return memoizeByCollectionRev('waitlistEntries', speciesName, rows, (list) =>
    list
      .filter((w) => isSameSpecies(w.species, speciesName))
      .sort((a, b) => a.priorityRank - b.priorityRank || b.createdAt.localeCompare(a.createdAt))
  );
}

/** Active-species reservations, newest reserved date first. */
export function selectSpeciesAnimalReservations(
  rows: readonly AnimalReservation[] | undefined,
  speciesName: string
): AnimalReservation[] {
  return memoizeByCollectionRev('animalReservations', speciesName, rows, (list) =>
    list
      .filter((r) => isSameSpecies(r.species, speciesName))
      .sort(
        (a, b) =>
          (b.reservedDateIso || '').localeCompare(a.reservedDateIso || '') ||
          b.createdAt.localeCompare(a.createdAt)
      )
  );
}

/** Active-species wool harvests, newest harvest date first. */
export function selectSpeciesWoolHarvests(
  rows: readonly WoolHarvest[] | undefined,
  speciesName: string
): WoolHarvest[] {
  return memoizeByCollectionRev('woolHarvests', speciesName, rows, (list) =>
    list
      .filter((w) => isSameSpecies(w.species, speciesName))
      .sort(
        (a, b) =>
          (b.harvestDateIso || '').localeCompare(a.harvestDateIso || '') ||
          b.createdAt.localeCompare(a.createdAt)
      )
  );
}

/** Active-species mileage logs, newest date first. */
export function selectSpeciesMileageLogs(
  rows: readonly MileageLog[] | undefined,
  speciesName: string
): MileageLog[] {
  return memoizeByCollectionRev('mileageLogs', speciesName, rows, (list) =>
    list
      .filter((m) => isSameSpecies(m.species, speciesName))
      .sort(
        (a, b) =>
          (b.dateIso || '').localeCompare(a.dateIso || '') || b.createdAt.localeCompare(a.createdAt)
      )
  );
}

/** Active-species journal entries, newest date first with pinned entries above unpinned. */
export function selectSpeciesJournalEntries(
  rows: readonly BarnJournalEntry[] | undefined,
  speciesName: string
): BarnJournalEntry[] {
  return memoizeByCollectionRev('journalEntries', speciesName, rows, (list) =>
    list
      .filter((j) => isSameSpecies(j.species, speciesName))
      .sort(
        (a, b) =>
          (b.entryDateIso || '').localeCompare(a.entryDateIso || '') ||
          (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
          b.createdAt.localeCompare(a.createdAt)
      )
  );
}

/** Active-species judge/club contacts, sorted by club name. */
export function selectSpeciesJudgeClubs(
  rows: readonly JudgeClubContact[] | undefined,
  speciesName: string
): JudgeClubContact[] {
  return memoizeByCollectionRev('judgeClubs', speciesName, rows, (list) =>
    list
      .filter((c) => isSameSpecies(c.species, speciesName))
      .sort((a, b) => a.clubName.localeCompare(b.clubName) || b.createdAt.localeCompare(a.createdAt))
  );
}

/** Active-species judge assignments, earliest show date first. */
export function selectSpeciesJudgeAssignments(
  rows: readonly JudgeAssignment[] | undefined,
  speciesName: string
): JudgeAssignment[] {
  return memoizeByCollectionRev('judgeAssignments', speciesName, rows, (list) =>
    list
      .filter((a) => isSameSpecies(a.species, speciesName))
      .sort(
        (a, b) =>
          (a.showDateIso || '').localeCompare(b.showDateIso || '') ||
          b.createdAt.localeCompare(a.createdAt)
      )
  );
}

/** Active-species judge expenses, newest date first. */
export function selectSpeciesJudgeExpenses(
  rows: readonly JudgeExpense[] | undefined,
  speciesName: string
): JudgeExpense[] {
  return memoizeByCollectionRev('judgeExpenses', speciesName, rows, (list) =>
    list
      .filter((e) => isSameSpecies(e.species, speciesName))
      .sort(
        (a, b) =>
          (b.dateIso || '').localeCompare(a.dateIso || '') || b.createdAt.localeCompare(a.createdAt)
      )
  );
}

/** Pre-grouped photo views so galleries and pedigree prints do not re-scan every photo. */
export interface SpeciesPhotoIndex {
  animalPhotos: AnimalPhoto[];
  photosByAnimalId: Map<string, AnimalPhoto[]>;
  primaryPhotoByAnimalId: Map<string, AnimalPhoto>;
}

/** Active-species photos grouped by animal, each bucket primary-first, with a primary lookup. */
export function selectSpeciesPhotoIndex(
  rows: readonly AnimalPhoto[] | undefined,
  speciesName: string
): SpeciesPhotoIndex {
  return memoizeByCollectionRev('animalPhotos', speciesName, rows, (list) => {
    const animalPhotos = list.filter((p) => isSameSpecies(p.species, speciesName));
    const photosByAnimalId = new Map<string, AnimalPhoto[]>();
    const primaryPhotoByAnimalId = new Map<string, AnimalPhoto>();
    for (const photo of animalPhotos) {
      const bucket = photosByAnimalId.get(photo.animalId) || [];
      bucket.push(photo);
      photosByAnimalId.set(photo.animalId, bucket);
    }
    for (const [aid, bucket] of photosByAnimalId.entries()) {
      bucket.sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.createdAt.localeCompare(b.createdAt);
      });
      if (bucket.length > 0) {
        primaryPhotoByAnimalId.set(aid, bucket[0]);
      }
    }
    return { animalPhotos, photosByAnimalId, primaryPhotoByAnimalId };
  });
}
