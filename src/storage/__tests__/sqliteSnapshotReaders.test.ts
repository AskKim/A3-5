/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Snapshot Reader Tests (`src/storage/sqliteSnapshotReaders.ts`, IMP-133).
 */

import path from 'node:path';
import initSqlJs, { type Database } from 'sql.js';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SafeParseSqliteJsonFn } from '../sqliteRowMappers';
import {
  mapAnimalRow,
  queryObjectsFromDb,
  readSnapshotFromDatabase,
} from '../sqliteSnapshotReaders';
import { PEDIGREE_SQLITE_SCHEMA } from '../sqliteSchema';

const safeParseJson: SafeParseSqliteJsonFn = <T>(raw: unknown, fallback: T): T => {
  if (raw === null || raw === undefined || raw === '') return fallback;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed === null || parsed === undefined ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
};

const deps = { safeParseJson };

function insertAnimal(db: Database, id: string, name: string, genotypeJson: string): void {
  db.run(
    `INSERT INTO animals
     (id, tattoo, name, species, breed, variety, sex, status, birth_date_iso, weight_grams,
      genotype_json, genotype_raw, registration_number, grand_champion_number, legs_count,
      cage_location, breeder_name, owner_name, sire_id, dam_id, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      'T-1',
      name,
      'Rabbit',
      'Rex',
      'Standard',
      'Female',
      'Active',
      '2025-04-01',
      1200,
      genotypeJson,
      '',
      '',
      '',
      0,
      '',
      '',
      '',
      '',
      '',
      '',
      '2025-04-01T00:00:00.000Z',
      '2025-04-01T00:00:00.000Z',
    ]
  );
}

describe('sqliteSnapshotReaders', () => {
  let db: Database;

  beforeAll(async () => {
    const SQL = await initSqlJs({
      locateFile: () => path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
    });
    db = new SQL.Database();
    db.run(PEDIGREE_SQLITE_SCHEMA);

    insertAnimal(
      db,
      'a1',
      'Daisy',
      JSON.stringify([{ locus: 'B', allele1: 'B', allele2: 'b' }])
    );
    insertAnimal(db, 'a2', 'Clover', 'not-json');
    db.run(
      `INSERT INTO animal_photos
       (id, species, animal_id, caption, original_file_name, mime_type, width, height,
        original_bytes, stored_bytes, thumbnail_data_url, data_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'p1',
        'Rabbit',
        'a1',
        '',
        'daisy.jpg',
        'image/jpeg',
        64,
        64,
        10,
        10,
        'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==',
        '2025-04-01T00:00:00.000Z',
        '2025-04-01T00:00:00.000Z',
      ]
    );
  });

  it('rebuilds the snapshot from the tables and sorts by name', () => {
    const snapshot = readSnapshotFromDatabase(db, undefined, deps);

    expect(snapshot.animals.map((a) => a.name)).toEqual(['Clover', 'Daisy']);
    const daisy = snapshot.animals.find((a) => a.id === 'a1');
    expect(daisy?.genotype).toEqual([{ locus: 'B', allele1: 'B', allele2: 'b' }]);
    expect(daisy?.birthDateIso).toBe('2025-04-01');
    expect(snapshot.animalPhotos[0].dataUrl).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==');
  });

  it('drops photo payloads but keeps thumbnails when reading lightweight', () => {
    const snapshot = readSnapshotFromDatabase(db, { lightweightPhotos: true }, deps);

    expect(snapshot.animalPhotos[0].dataUrl).toBe('');
    expect(snapshot.animalPhotos[0].thumbnailDataUrl).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
  });

  it('keeps a row whose JSON column is malformed instead of failing the whole read', () => {
    const snapshot = readSnapshotFromDatabase(db, undefined, deps);
    const clover = snapshot.animals.find((a) => a.id === 'a2');

    expect(clover?.name).toBe('Clover');
    expect(clover?.genotype).toEqual([]);
  });

  it('treats a missing optional table as empty instead of throwing', () => {
    db.run('DROP TABLE feed_allocations');
    try {
      const snapshot = readSnapshotFromDatabase(db, undefined, deps);
      expect(snapshot.feedAllocations).toEqual([]);
    } finally {
      db.run(PEDIGREE_SQLITE_SCHEMA);
    }
  });

  it('exposes the row query helper and the animal mapper', () => {
    const rows = queryObjectsFromDb(db, 'SELECT id FROM animals ORDER BY id ASC');
    expect(rows.map((r) => String(r.id))).toEqual(['a1', 'a2']);

    const mapped = mapAnimalRow(rows[0], safeParseJson);
    expect(mapped.id).toBe('a1');
  });
});
