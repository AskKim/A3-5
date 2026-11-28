/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Shared helpers for writing to the database in safe batches.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * SQLite Transaction & Mutation Helpers (`src/storage/sqliteMutationHelpers.ts`).
 *
 * The transaction envelope plus the generic batch write and multi-row delete
 * shapes shared by every `WebSqliteAdapter` write path. Keeping them here means
 * a new entity only describes its statements, not the transaction handling.
 */

import type { Database } from 'sql.js';

/** Runs `work` inside one transaction, rolling back before rethrowing on failure. */
export function runSqliteTransaction(db: Database, work: (txDb: Database) => void): void {
  db.run('BEGIN TRANSACTION;');
  try {
    work(db);
    db.run('COMMIT;');
  } catch (e) {
    try {
      db.run('ROLLBACK;');
    } catch {
      // Ignore rollback error so root exception surfaces cleanly
    }
    throw e;
  }
}

/** Writes every item of a batch inside a single transaction. */
export function writeRowsInTransaction<T>(
  db: Database,
  items: readonly T[],
  write: (txDb: Database, item: T) => void
): void {
  if (items.length === 0) return;
  runSqliteTransaction(db, (txDb) => {
    for (const item of items) write(txDb, item);
  });
}

/**
 * Deletes many ids in one transaction. `statementsForId` returns the SQL for each
 * statement that should run for one id; every statement binds that id as its only
 * parameter, which covers both the row itself and its cascade rows.
 */
export function deleteRowsForIds(
  db: Database,
  ids: readonly string[],
  statementsForId: (id: string) => readonly string[]
): void {
  if (ids.length === 0) return;
  runSqliteTransaction(db, (txDb) => {
    for (const id of ids) {
      for (const sql of statementsForId(id)) txDb.run(sql, [id]);
    }
  });
}
