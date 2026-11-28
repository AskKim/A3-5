/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Transaction & Batch Mutation Helper Tests (`src/storage/sqliteMutationHelpers.ts`, IMP-133).
 */

import path from 'node:path';
import initSqlJs, { type Database } from 'sql.js';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteRowsForIds,
  runSqliteTransaction,
  writeRowsInTransaction,
} from '../sqliteMutationHelpers';

let db: Database;

function ids(): string[] {
  const rows: string[] = [];
  const stmt = db.prepare('SELECT id FROM parent ORDER BY id ASC');
  try {
    while (stmt.step()) rows.push(String(stmt.getAsObject().id));
  } finally {
    stmt.free();
  }
  return rows;
}

describe('sqliteMutationHelpers', () => {
  beforeAll(async () => {
    const SQL = await initSqlJs({
      locateFile: () => path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
    });
    db = new SQL.Database();
    db.run(`
      CREATE TABLE parent (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL);
      CREATE TABLE child (id TEXT PRIMARY KEY NOT NULL, parent_id TEXT NOT NULL);
    `);
  });

  beforeEach(() => {
    db.run('DELETE FROM parent; DELETE FROM child;');
  });

  it('commits the work it wraps', () => {
    runSqliteTransaction(db, (tx) => {
      tx.run('INSERT INTO parent (id, name) VALUES (?, ?)', ['p1', 'One']);
    });
    expect(ids()).toEqual(['p1']);
  });

  it('rolls back and rethrows when the work throws', () => {
    expect(() =>
      runSqliteTransaction(db, (tx) => {
        tx.run('INSERT INTO parent (id, name) VALUES (?, ?)', ['p1', 'One']);
        throw new Error('boom');
      })
    ).toThrow('boom');
    expect(ids()).toEqual([]);
  });

  it('writes a whole batch in one transaction and skips an empty one', () => {
    writeRowsInTransaction(db, ['b1', 'b2', 'b3'], (tx, id) => {
      tx.run('INSERT INTO parent (id, name) VALUES (?, ?)', [id, id]);
    });
    expect(ids()).toEqual(['b1', 'b2', 'b3']);

    const statements: string[] = [];
    writeRowsInTransaction<{ id: string }>(db, [], (_tx, item) => {
      statements.push(item.id);
    });
    expect(statements).toEqual([]);
  });

  it('deletes every statement for every id in one transaction', () => {
    db.run("INSERT INTO parent (id, name) VALUES ('p1', 'One'), ('p2', 'Two');");
    db.run("INSERT INTO child (id, parent_id) VALUES ('c1', 'p1'), ('c2', 'p2');");

    deleteRowsForIds(db, ['p1', 'p2'], () => [
      'DELETE FROM parent WHERE id = ?',
      'DELETE FROM child WHERE parent_id = ?',
    ]);

    expect(ids()).toEqual([]);
    const stmt = db.prepare('SELECT COUNT(*) AS n FROM child');
    try {
      stmt.step();
      expect(Number(stmt.getAsObject().n)).toBe(0);
    } finally {
      stmt.free();
    }
  });

  it('leaves the table untouched when the id list is empty', () => {
    db.run("INSERT INTO parent (id, name) VALUES ('p1', 'One');");
    deleteRowsForIds(db, [], () => ['DELETE FROM parent WHERE id = ?']);
    expect(ids()).toEqual(['p1']);
  });
});
