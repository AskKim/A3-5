/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SQLite Snapshot Row Readers (`src/storage/sqliteSnapshotReaders.ts`).
 *
 * Reads every barn table out of an in-memory `sql.js` database and rebuilds the
 * domain snapshot. Kept out of `WebSqliteAdapter` so the adapter owns only
 * connection lifecycle, persistence and write routing.
 */

import type { Database } from 'sql.js';
import {
  Animal,
  AnimalPhoto,
  AnimalReservation,
  BarnDatabaseSnapshot,
  BarnJournalEntry,
  BarnSettings,
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
  SpeciesProfile,
  WaitlistEntry,
  WoolHarvest,
  YouthProjectBook,
} from '../domain/models';
import { logDiagnosticEvent } from './crashLogger';
import {
  createSqliteRowMapperContext,
  mapAnimalPhotoRow,
  mapAnimalReservationRow,
  mapBreedingRow,
  mapCageRow,
  mapCareLogRow,
  mapClientContactRow,
  mapFeedAllocationRow,
  mapFeedBatchRow,
  mapJournalEntryRow,
  mapJudgeAssignmentRow,
  mapJudgeClubRow,
  mapJudgeExpenseRow,
  mapLedgerEntryRow,
  mapMileageLogRow,
  mapProcessingLogRow,
  mapSettingsRow,
  mapShowRow,
  mapSpeciesProfileRow,
  mapSqliteAnimalRow,
  mapTaskRow,
  mapWaitlistEntryRow,
  mapWoolHarvestRow,
  mapYouthProjectBookRow,
  type SafeParseSqliteJsonFn,
} from './sqliteRowMappers';
import type { SnapshotLoadOptions } from './storageAdapter';

export interface SnapshotReaderDeps {
  safeParseJson: SafeParseSqliteJsonFn;
}

export function queryObjectsFromDb(
  db: Database,
  sql: string
): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  const rows: Record<string, unknown>[] = [];
  try {
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    return rows;
  } finally {
    stmt.free();
  }
}

export function mapAnimalRow(
  r: Record<string, unknown>,
  safeParseJson: SafeParseSqliteJsonFn,
  finiteNonNeg?: (raw: unknown, fallback?: number) => number,
  safeArray?: <T>(val: unknown) => T[]
): Animal {
  return mapSqliteAnimalRow(r, safeParseJson, finiteNonNeg, safeArray);
}

export function readSnapshotFromDatabase(
  db: Database,
  options: SnapshotLoadOptions | undefined,
  deps: SnapshotReaderDeps
): BarnDatabaseSnapshot {
  const runQuery = (sql: string) => queryObjectsFromDb(db, sql);
  const ctx = createSqliteRowMapperContext(deps.safeParseJson);

  const safeTableQuery = (tableName: string, sql: string): Record<string, unknown>[] => {
    try {
      const existsStmt = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1"
      );
      let exists = false;
      try {
        existsStmt.bind([tableName]);
        exists = existsStmt.step();
      } finally {
        existsStmt.free();
      }
      return exists ? runQuery(sql) : [];
    } catch {
      return [];
    }
  };

  const mappedSettings = mapSettingsRow(runQuery('SELECT * FROM barn_settings LIMIT 1')[0], ctx);
  const settings: BarnSettings = {
    ...mappedSettings,
    enableJudgeNotebook: Boolean(mappedSettings.enableJudgeNotebook),
  };

  const speciesProfiles: SpeciesProfile[] = runQuery(
    'SELECT * FROM species_profiles ORDER BY sort_order ASC, name ASC'
  ).map((r, idx) => mapSpeciesProfileRow(r, idx, ctx));

  const animals: Animal[] = runQuery('SELECT * FROM animals ORDER BY name ASC').map((r) =>
    mapAnimalRow(r, deps.safeParseJson, ctx.finiteNonNeg, ctx.safeArray)
  );

  const photoQuerySql = options?.lightweightPhotos
    ? `SELECT id, species, animal_id, is_primary, sort_order, caption, original_file_name, mime_type,
                width, height, original_bytes, stored_bytes,
                CASE WHEN length(thumbnail_data_url) > 0 THEN thumbnail_data_url ELSE data_url END AS thumbnail_data_url,
                '' AS data_url, created_at, updated_at
         FROM animal_photos ORDER BY is_primary DESC, sort_order ASC, created_at ASC`
    : 'SELECT * FROM animal_photos ORDER BY is_primary DESC, sort_order ASC, created_at ASC';

  const animalPhotos: AnimalPhoto[] = runQuery(photoQuerySql).map((r) =>
    mapAnimalPhotoRow(r, ctx, options?.lightweightPhotos)
  );

  const cages: CageLocation[] = runQuery('SELECT * FROM cages ORDER BY label ASC').map((r) =>
    mapCageRow(r, ctx)
  );

  const breedings: BreedingRecord[] = runQuery(
    'SELECT * FROM breedings ORDER BY bred_date_iso DESC'
  ).map((r) => mapBreedingRow(r, ctx));

  const tasks: BarnTask[] = runQuery(
    'SELECT * FROM barn_tasks ORDER BY completed ASC, due_date_iso ASC'
  ).map((r) => mapTaskRow(r));

  const careLogs: CareLog[] = runQuery('SELECT * FROM care_logs ORDER BY date_iso DESC').map((r) =>
    mapCareLogRow(r, ctx)
  );

  const shows: ShowEvent[] = runQuery('SELECT * FROM shows ORDER BY event_date_iso ASC').map((r) =>
    mapShowRow(r, ctx)
  );

  const feedBatchQuerySql = options?.lightweightPhotos
    ? `SELECT id, species, brand, product_name, lot_number, mill_code, manufacture_date_iso,
                purchase_date_iso, bag_count, bag_weight_value, bag_weight_unit, total_quantity,
                remaining_quantity, low_stock_threshold, total_cost_cents, supplier_name,
                protein_percent, notes, '' AS tag_photo_data_url,
                CASE WHEN length(tag_photo_thumbnail_data_url) > 0 THEN tag_photo_thumbnail_data_url ELSE tag_photo_data_url END AS tag_photo_thumbnail_data_url,
                tag_photo_mime_type, tag_photo_bytes, tag_photo_captured_date_iso,
                tag_photo_purged_at_iso, tag_photo_bytes_reclaimed, ocr_raw_text, ocr_confidence,
                ocr_manual_override, recall_flagged, recall_note, created_at, updated_at
         FROM feed_batches ORDER BY purchase_date_iso DESC, created_at DESC`
    : 'SELECT * FROM feed_batches ORDER BY purchase_date_iso DESC, created_at DESC';

  const feedBatches: FeedBatch[] = safeTableQuery('feed_batches', feedBatchQuerySql).map((r) =>
    mapFeedBatchRow(r, ctx, options?.lightweightPhotos)
  );

  const feedAllocations: FeedAllocation[] = safeTableQuery(
    'feed_allocations',
    'SELECT * FROM feed_allocations ORDER BY date_iso DESC, created_at DESC'
  ).map((r) => mapFeedAllocationRow(r, ctx));

  const ledgerEntryQuerySql = options?.lightweightPhotos
    ? `SELECT id, species, date_iso, entry_type, category, amount_cents, title, vendor_or_party,
                linked_animal_id, linked_breeding_id, linked_feed_batch_id, linked_project_id,
                '' AS receipt_photo_data_url,
                CASE WHEN length(receipt_photo_thumbnail_data_url) > 0 THEN receipt_photo_thumbnail_data_url ELSE receipt_photo_data_url END AS receipt_photo_thumbnail_data_url,
                receipt_photo_mime_type, receipt_photo_bytes, notes, created_at, updated_at
         FROM ledger_entries ORDER BY date_iso DESC, created_at DESC`
    : 'SELECT * FROM ledger_entries ORDER BY date_iso DESC, created_at DESC';

  const ledgerEntries: LedgerEntry[] = safeTableQuery('ledger_entries', ledgerEntryQuerySql).map(
    (r) => mapLedgerEntryRow(r, ctx, options?.lightweightPhotos)
  );

  const processingLogs: ProcessingLog[] = safeTableQuery(
    'processing_logs',
    'SELECT * FROM processing_logs ORDER BY harvest_date_iso DESC, scheduled_date_iso DESC, created_at DESC'
  ).map((r) => mapProcessingLogRow(r, ctx));

  const youthProjectBooks: YouthProjectBook[] = safeTableQuery(
    'youth_project_books',
    'SELECT * FROM youth_project_books ORDER BY project_year DESC, start_date_iso DESC, created_at DESC'
  ).map((r) => mapYouthProjectBookRow(r, ctx));

  const clientContacts: ClientContact[] = safeTableQuery(
    'client_contacts',
    'SELECT * FROM client_contacts ORDER BY full_name ASC, created_at DESC'
  ).map((r) => mapClientContactRow(r, ctx));

  const waitlistEntries: WaitlistEntry[] = safeTableQuery(
    'waitlist_entries',
    'SELECT * FROM waitlist_entries ORDER BY priority_rank ASC, inquiry_date_iso ASC, created_at ASC'
  ).map((r) => mapWaitlistEntryRow(r, ctx));

  const animalReservations: AnimalReservation[] = safeTableQuery(
    'animal_reservations',
    'SELECT * FROM animal_reservations ORDER BY reserved_date_iso DESC, created_at DESC'
  ).map((r) => mapAnimalReservationRow(r, ctx));

  const woolHarvests: WoolHarvest[] = safeTableQuery(
    'wool_harvests',
    'SELECT * FROM wool_harvests ORDER BY harvest_date_iso DESC, created_at DESC'
  ).map((r) => mapWoolHarvestRow(r, ctx));

  const mileageLogs: MileageLog[] = safeTableQuery(
    'mileage_logs',
    'SELECT * FROM mileage_logs ORDER BY date_iso DESC, created_at DESC'
  ).map((r) => mapMileageLogRow(r, ctx));

  const journalEntries: BarnJournalEntry[] = safeTableQuery(
    'journal_entries',
    'SELECT * FROM journal_entries ORDER BY entry_date_iso DESC, pinned DESC, created_at DESC'
  ).map((r) => mapJournalEntryRow(r, ctx));

  const judgeClubs: JudgeClubContact[] = safeTableQuery(
    'judge_clubs',
    'SELECT * FROM judge_clubs ORDER BY club_name ASC, created_at DESC'
  )
    .map((r) => mapJudgeClubRow(r))
    .filter((c): c is JudgeClubContact => Boolean(c));

  const judgeAssignments: JudgeAssignment[] = safeTableQuery(
    'judge_assignments',
    'SELECT * FROM judge_assignments ORDER BY show_date_iso ASC, created_at DESC'
  )
    .map((r) => mapJudgeAssignmentRow(r, ctx))
    .filter((a): a is JudgeAssignment => Boolean(a));

  const judgeExpenses: JudgeExpense[] = safeTableQuery(
    'judge_expenses',
    'SELECT * FROM judge_expenses ORDER BY date_iso DESC, created_at DESC'
  )
    .map((r) => mapJudgeExpenseRow(r, ctx))
    .filter((e): e is JudgeExpense => Boolean(e));

  const sanitizedNumericCount = ctx.getSanitizedNumericCount();
  if (sanitizedNumericCount > 0) {
    logDiagnosticEvent({
      level: 'warn',
      category: 'storage',
      message: `Corrective action: Sanitized ${sanitizedNumericCount} non-finite or negative SQLite numeric field(s) during loadSnapshot`,
    });
  }

  return {
    settings,
    speciesProfiles,
    animals,
    animalPhotos,
    cages,
    breedings,
    tasks,
    careLogs,
    shows,
    feedBatches,
    feedAllocations,
    ledgerEntries,
    processingLogs,
    youthProjectBooks,
    clientContacts,
    waitlistEntries,
    animalReservations,
    woolHarvests,
    mileageLogs,
    journalEntries,
    judgeClubs,
    judgeAssignments,
    judgeExpenses,
  };
}
