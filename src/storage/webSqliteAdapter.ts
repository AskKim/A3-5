/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Runs the local database inside the browser, using the same tables as the phone versions.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Unencrypted Local SQLite Browser Adapter (`sql.js` WebAssembly + IndexedDB Persistence).
 *
 * Uses standard relational SQLite tables identical to what `expo-sqlite` executes on
 * native Android and iOS, and saves the unencrypted `.sqlite` binary file inside the
 * browser's local IndexedDB so users have 100% offline persistence AND 1-click access
 * to download or import the raw `.sqlite` file for Google Drive / OneDrive / SyncThing.
 */

import type { Database, SqlJsStatic } from 'sql.js';
import {
  sanitizeSafeRasterImageDataUrl,
  validateSqliteFileHeader,
} from '../domain/inputSanitization';
import {
  Animal,
  AnimalPhoto,
  AnimalReservation,
  BarnDatabaseSnapshot,
  BarnJournalEntry,
  BarnSettings,
  BarnTask,
  BreedingRecord,
  buildEmptyShellSnapshot,
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
import { getTierStoragePolicy } from '../domain/deviceCapability';
import { normalizeShowResults } from '../domain/showResults';
import { isMemoryLikeError, logDiagnosticEvent } from './crashLogger';
import { detectCurrentDeviceCapability } from './deviceCapabilityDetector';
import {
  getCurrentTabId,
  publishCrossTabDbCommit,
  withCrossTabLock,
} from './localSyncChannels';
import {
  detectReturningUserWipedStorage,
  dumpIndexedDbDatabaseToOpfs,
  dumpRawRecordsToOpfsRecoveryBackup,
  isVersionError,
  markPriorUseSentinelFromSnapshot,
  readPriorUseSentinel,
  saveOpfsVaultBackup,
  WipedStorageRecoveryContext,
} from './opfsStorage';
import { purgeOpfsTmp } from './opfsTempStream';
import { stripPhotoDataUrlsFromSnapshot } from './photoHydration';
import type { IStorageAdapter } from '@engine/storage';
import { SnapshotLoadOptions, StorageAdapter } from './storageAdapter';
import {
  DB_WRITE_LOCK_NAME,
  executeIdbWriteWithQuotaRecovery,
  IDB_DB_NAME,
  IDB_FALLBACK_SNAPSHOT_KEY,
  IDB_PRIMARY_KEY,
  IDB_WRITE_EPOCH_KEY,
  idbDelete,
  idbGet,
  idbSet,
  idbSetAtomic,
  type PersistedWriteEpochMeta,
  purgeStaleBrowserCaches,
} from './sqliteIdbPersistence';
import {
  upsertAnimalPhotoRow,
  upsertAnimalReservationRow,
  upsertAnimalRow,
  upsertBreedingRow,
  upsertCageRow,
  upsertCareLogRow,
  upsertClientContactRow,
  upsertFeedAllocationRow,
  upsertFeedBatchRow,
  upsertJournalEntryRow,
  upsertJudgeAssignmentRow,
  upsertJudgeClubRow,
  upsertJudgeExpenseRow,
  upsertLedgerEntryRow,
  upsertMileageLogRow,
  upsertProcessingLogRow,
  upsertSettingsRow,
  upsertShowRow,
  upsertSpeciesRow,
  upsertTaskRow,
  upsertWaitlistEntryRow,
  upsertWoolHarvestRow,
  upsertYouthProjectBookRow,
} from './sqliteRowWriters';
import {
  mapAnimalRow,
  queryObjectsFromDb,
  readSnapshotFromDatabase,
  type SnapshotReaderDeps,
} from './sqliteSnapshotReaders';
import { PEDIGREE_SQLITE_SCHEMA } from './sqliteSchema';
import {
  deleteRowsForIds,
  runSqliteTransaction,
  writeRowsInTransaction,
} from './sqliteMutationHelpers';
import {
  getSafeIndexedDb,
  isIndexedDbBlockedError,
} from './storageProbes';
import {
  getAdjustedNowIsoUtc,
  isQuotaExceededError,
  listRollingSnapshotBackups,
  loadRollingSnapshotBackup,
  saveRollingSnapshotBackup,
} from './storageProtection';

export {
  DB_WRITE_LOCK_NAME,
  executeIdbWriteWithQuotaRecovery,
  IDB_WRITE_EPOCH_KEY,
  PEDIGREE_SQLITE_SCHEMA,
  purgeStaleBrowserCaches,
  type PersistedWriteEpochMeta,
};

const purgePrimaryQuotaCaches = async (): Promise<void> => {
  await purgeOpfsTmp().catch(() => null);
};

const SQLITE_SCHEMA_VERSION = 9;

type InitSqlJs = (typeof import('sql.js'))['default'];

type SqlJsInitConfig = NonNullable<Parameters<InitSqlJs>[0]> & {
  useOldExtensionFunctions: boolean;
};

// The SQLite WASM build (~670 KB) is loaded lazily on the first storage call instead of at
// module import, so it stays out of the first-paint graph and only downloads when the app
// actually opens its local database. Both promises are memoized and reset on failure so a
// transient chunk/WASM fetch error can be retried by the next storage call.
let sqlJsRuntimePromise: Promise<InitSqlJs> | null = null;
let sqlWasmUrlPromise: Promise<string> | null = null;

function loadSqlJsRuntime(): Promise<InitSqlJs> {
  if (!sqlJsRuntimePromise) {
    sqlJsRuntimePromise = import('sql.js')
      .then((module) => module.default)
      .catch((error: unknown) => {
        sqlJsRuntimePromise = null;
        throw error;
      });
  }
  const pending = sqlJsRuntimePromise;
  return pending;
}

function loadSqlWasmUrl(): Promise<string> {
  if (!sqlWasmUrlPromise) {
    sqlWasmUrlPromise = import('sql.js/dist/sql-wasm.wasm?url')
      .then((mod) => mod.default)
      .catch((error: unknown) => {
        sqlWasmUrlPromise = null;
        throw error;
      });
  }
  const pending = sqlWasmUrlPromise;
  return pending;
}

async function createSqlJsStatic(): Promise<SqlJsStatic> {
  const [initSqlJs, wasmUrl] = await Promise.all([loadSqlJsRuntime(), loadSqlWasmUrl()]);
  const config: SqlJsInitConfig = {
    locateFile: () => wasmUrl,
    useOldExtensionFunctions: false,
  };
  return initSqlJs(config);
}

// DDL schema and IndexedDB quota-safe persistence are imported from ./sqliteSchema and ./sqliteIdbPersistence.

export function applySchemaMigrations(
  db: Database,
  options?: { force?: boolean }
): boolean {
  const currentVersion = readSqliteUserVersion(db);
  if (!options?.force && currentVersion >= SQLITE_SCHEMA_VERSION) {
    return false;
  }

  const alterStatements = [
    "ALTER TABLE barn_settings ADD COLUMN custom_colors_json TEXT NOT NULL DEFAULT '{}';",
    "ALTER TABLE barn_settings ADD COLUMN image_optimization_preset TEXT NOT NULL DEFAULT 'balanced';",
    "ALTER TABLE barn_settings ADD COLUMN extra_settings_json TEXT NOT NULL DEFAULT '{}';",
    "ALTER TABLE barn_settings ADD COLUMN currency_code TEXT NOT NULL DEFAULT 'USD';",
    'ALTER TABLE species_profiles ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;',
    "ALTER TABLE species_profiles ADD COLUMN default_animal_prefix TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE species_profiles ADD COLUMN preferred_unit TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE species_profiles ADD COLUMN memo_text TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE species_profiles ADD COLUMN memo_updated_at TEXT NOT NULL DEFAULT '';",
    'ALTER TABLE species_profiles ADD COLUMN maturity_days INTEGER NOT NULL DEFAULT 0;',
    "ALTER TABLE species_profiles ADD COLUMN breed_overrides_json TEXT NOT NULL DEFAULT '[]';",
    "ALTER TABLE species_profiles ADD COLUMN target_weight_curve_json TEXT NOT NULL DEFAULT '[]';",
    'ALTER TABLE animals ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;',
    'ALTER TABLE animals ADD COLUMN needs_attention INTEGER NOT NULL DEFAULT 0;',
    "ALTER TABLE animals ADD COLUMN ignored_conflicts_json TEXT NOT NULL DEFAULT '[]';",
    "ALTER TABLE animals ADD COLUMN suspected_carrier_of_json TEXT NOT NULL DEFAULT '[]';",
    "ALTER TABLE animals ADD COLUMN confirmed_carrier_of_json TEXT NOT NULL DEFAULT '[]';",
    "ALTER TABLE animals ADD COLUMN cleared_carrier_of_json TEXT NOT NULL DEFAULT '[]';",
    "ALTER TABLE animals ADD COLUMN rufus_level TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE animals ADD COLUMN ownership_type TEXT NOT NULL DEFAULT 'Owned';",
    'ALTER TABLE animals ADD COLUMN culled INTEGER NOT NULL DEFAULT 0;',
    "ALTER TABLE animals ADD COLUMN cull_date_iso TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE animals ADD COLUMN cull_reason TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE animals ADD COLUMN deceased_date_iso TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE animals ADD COLUMN death_cause TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE animals ADD COLUMN sold_date_iso TEXT NOT NULL DEFAULT '';",
    'ALTER TABLE animals ADD COLUMN sale_price_cents INTEGER NOT NULL DEFAULT 0;',
    'ALTER TABLE animals ADD COLUMN purchase_cost_cents INTEGER NOT NULL DEFAULT 0;',
    "ALTER TABLE animals ADD COLUMN buyer_name TEXT NOT NULL DEFAULT '';",
    'ALTER TABLE animals ADD COLUMN for_sale INTEGER NOT NULL DEFAULT 0;',
    'ALTER TABLE animals ADD COLUMN asking_price_cents INTEGER NOT NULL DEFAULT 0;',
    "ALTER TABLE animals ADD COLUMN sale_notes TEXT NOT NULL DEFAULT '';",
    'ALTER TABLE breedings ADD COLUMN service_fee_cents INTEGER NOT NULL DEFAULT 0;',
    "ALTER TABLE breedings ADD COLUMN service_fee_direction TEXT NOT NULL DEFAULT 'none';",
    "ALTER TABLE breedings ADD COLUMN ultrasound_date_iso TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE breedings ADD COLUMN ultrasound_result TEXT NOT NULL DEFAULT '';",
    'ALTER TABLE breedings ADD COLUMN ultrasound_fetal_count INTEGER NOT NULL DEFAULT 0;',
    "ALTER TABLE breedings ADD COLUMN ultrasound_projected_due_iso TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE breedings ADD COLUMN litter_weight_milestones_json TEXT NOT NULL DEFAULT '[]';",
    "ALTER TABLE care_logs ADD COLUMN medication_name TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE care_logs ADD COLUMN dosage TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE care_logs ADD COLUMN administration_route TEXT NOT NULL DEFAULT '';",
    'ALTER TABLE care_logs ADD COLUMN withdrawal_days INTEGER NOT NULL DEFAULT 0;',
    "ALTER TABLE care_logs ADD COLUMN withdrawal_clear_date_iso TEXT NOT NULL DEFAULT '';",
    'ALTER TABLE care_logs ADD COLUMN body_condition_score REAL NOT NULL DEFAULT 0;',
    'ALTER TABLE care_logs ADD COLUMN famacha_score INTEGER NOT NULL DEFAULT 0;',
    'ALTER TABLE care_logs ADD COLUMN fecal_egg_count INTEGER NOT NULL DEFAULT 0;',
    "ALTER TABLE care_logs ADD COLUMN ultrasound_result TEXT NOT NULL DEFAULT '';",
    'ALTER TABLE care_logs ADD COLUMN ultrasound_fetal_count INTEGER NOT NULL DEFAULT 0;',
    "ALTER TABLE animals ADD COLUMN offloaded_archive_key TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE animals ADD COLUMN offloaded_at_iso TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE cages ADD COLUMN unit_type TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE cages ADD COLUMN feed_lot_name TEXT NOT NULL DEFAULT '';",
    'ALTER TABLE cages ADD COLUMN feed_stock_remaining REAL NOT NULL DEFAULT 0;',
    "ALTER TABLE cages ADD COLUMN feed_stock_unit TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE cages ADD COLUMN daily_ration_note TEXT NOT NULL DEFAULT '';",
    'ALTER TABLE cages ADD COLUMN feed_low_threshold REAL NOT NULL DEFAULT 0;',
    'ALTER TABLE cages ADD COLUMN maintenance_interval_days INTEGER NOT NULL DEFAULT 0;',
    "ALTER TABLE cages ADD COLUMN maintenance_task_label TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE cages ADD COLUMN last_maintenance_date_iso TEXT NOT NULL DEFAULT '';",
    "ALTER TABLE shows ADD COLUMN results_json TEXT NOT NULL DEFAULT '[]';",
    "ALTER TABLE barn_tasks ADD COLUMN start_date_iso TEXT NOT NULL DEFAULT '';",
  ];

  const tableColumnsCache = new Map<string, Set<string>>();
  const getTableColumns = (tableName: string): Set<string> => {
    let cols = tableColumnsCache.get(tableName);
    if (!cols) {
      cols = new Set<string>();
      const pragmaStmt = db.prepare(`PRAGMA table_info(${tableName});`);
      try {
        while (pragmaStmt.step()) {
          const row = pragmaStmt.getAsObject() as { name?: unknown };
          if (typeof row.name === 'string' && row.name) {
            cols.add(row.name.toLowerCase());
          }
        }
      } finally {
        pragmaStmt.free();
      }
      tableColumnsCache.set(tableName, cols);
    }
    return cols;
  };

  let inTransaction = false;
  try {
    db.run('BEGIN TRANSACTION;');
    inTransaction = true;
    db.run(PEDIGREE_SQLITE_SCHEMA);

    for (const stmt of alterStatements) {
      const match =
        /^ALTER TABLE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+ADD COLUMN\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/i.exec(
          stmt.trim()
        );
      if (match) {
        const tableName = match[1];
        const colName = match[2].toLowerCase();
        const existingCols = getTableColumns(tableName);
        if (existingCols.has(colName)) continue;
        db.run(stmt);
        existingCols.add(colName);
      } else {
        db.run(stmt);
      }
    }

    db.run(`PRAGMA user_version = ${SQLITE_SCHEMA_VERSION};`);
    db.run('COMMIT;');
    inTransaction = false;
    return true;
  } catch (err) {
    if (inTransaction) {
      try {
        db.run('ROLLBACK;');
      } catch {
        // Ignore rollback failure if SQLite already rolled back
      }
    }
    throw err;
  }
}

export function readSqliteUserVersion(db: Database): number {
  try {
    const stmt = db.prepare('PRAGMA user_version;');
    try {
      if (stmt.step()) {
        const row = stmt.getAsObject() as { user_version?: unknown };
        const val = Number(row.user_version);
        return Number.isFinite(val) ? val : 0;
      }
    } finally {
      stmt.free();
    }
  } catch {
    // Ignore PRAGMA query failure
  }
  return 0;
}

export class WebSqliteAdapter implements StorageAdapter {
  private SQL: SqlJsStatic | null = null;
  private db: Database | null = null;
  private fallbackSnapshot: BarnDatabaseSnapshot | null = null;
  private lastRollingSaveMs = 0;
  private wipedRecoveryContext: WipedStorageRecoveryContext | null = null;
  private corruptionRecoveryNotice: string | null = null;
  private loadedEpoch = 0;
  private ephemeralMode = false;

  constructor(
    private readonly tabId: string = getCurrentTabId(),
    private readonly backingStore?: IStorageAdapter
  ) {}

  get engineName(): string {
    if (this.backingStore) {
      return this.db
        ? `Local SQLite (WASM + ${this.backingStore.name})`
        : `Local Store (${this.backingStore.name})`;
    }
    if (this.ephemeralMode) {
      return this.db
        ? 'Local SQLite (Ephemeral Session)'
        : 'Ephemeral In-Memory Store (Private/Restricted Mode)';
    }
    return this.db ? 'Local SQLite (WASM + IndexedDB)' : 'Local IndexedDB Store';
  }

  isEphemeralMode(): boolean {
    return this.ephemeralMode;
  }

  getWipedRecoveryContext(): WipedStorageRecoveryContext | null {
    return this.wipedRecoveryContext;
  }

  getCorruptionRecoveryNotice(): string | null {
    return this.corruptionRecoveryNotice;
  }

  getLoadedEpoch(): number {
    return this.loadedEpoch;
  }

  private async readPersistedWriteEpoch(): Promise<PersistedWriteEpochMeta> {
    if (this.backingStore) {
      try {
        const raw = await this.backingStore.getItem(IDB_WRITE_EPOCH_KEY);
        if (typeof raw === 'string' && raw.trim()) {
          const meta = JSON.parse(raw) as Partial<PersistedWriteEpochMeta>;
          const epoch = Number(meta?.epoch);
          if (meta && Number.isFinite(epoch) && epoch > 0) {
            return {
              epoch,
              writerTabId: typeof meta.writerTabId === 'string' ? meta.writerTabId : '',
              updatedAtIso: typeof meta.updatedAtIso === 'string' ? meta.updatedAtIso : '',
            };
          }
        }
      } catch {
        // Ignore read failure; treat as epoch 0
      }
      return { epoch: 0, writerTabId: '', updatedAtIso: '' };
    }
    if (this.ephemeralMode || !getSafeIndexedDb()) {
      return { epoch: 0, writerTabId: '', updatedAtIso: '' };
    }
    try {
      const meta = await idbGet<Partial<PersistedWriteEpochMeta>>(IDB_WRITE_EPOCH_KEY);
      const epoch = Number(meta?.epoch);
      if (meta && Number.isFinite(epoch) && epoch > 0) {
        return {
          epoch,
          writerTabId: typeof meta.writerTabId === 'string' ? meta.writerTabId : '',
          updatedAtIso: typeof meta.updatedAtIso === 'string' ? meta.updatedAtIso : '',
        };
      }
    } catch {
      // Ignore read failure; treat as epoch 0
    }
    return { epoch: 0, writerTabId: '', updatedAtIso: '' };
  }

  /**
   * Reloads `this.db` or `this.fallbackSnapshot` from IndexedDB if another tab has committed
   * a higher write epoch. MUST only be called while holding `DB_WRITE_LOCK_NAME` (or during
   * initialization under lock).
   */
  private async syncFromPersistedStorageIfStaleLocked(): Promise<boolean> {
    if (this.backingStore) {
      return false;
    }
    if (this.ephemeralMode || !getSafeIndexedDb()) {
      return false;
    }
    const persisted = await this.readPersistedWriteEpoch();
    if (persisted.epoch <= this.loadedEpoch) {
      return false;
    }

    if (this.SQL) {
      const savedBytes = await idbGet<Uint8Array>(IDB_PRIMARY_KEY).catch(() => undefined);
      if (savedBytes && savedBytes.byteLength > 0) {
        const headerCheck = validateSqliteFileHeader(savedBytes, IDB_PRIMARY_KEY);
        if (headerCheck.ok) {
          const reloadedDb = new this.SQL.Database(savedBytes);
          if (readSqliteUserVersion(reloadedDb) < SQLITE_SCHEMA_VERSION) {
            applySchemaMigrations(reloadedDb);
          }
          if (this.db) {
            try {
              this.db.close();
            } catch {
              // Ignore close error on superseded DB
            }
          }
          this.db = reloadedDb;
          this.fallbackSnapshot = null;
          this.loadedEpoch = persisted.epoch;
          return true;
        }
      }
    }

    const savedFallback = await idbGet<BarnDatabaseSnapshot>(IDB_FALLBACK_SNAPSHOT_KEY).catch(
      () => undefined
    );
    if (
      savedFallback &&
      typeof savedFallback === 'object' &&
      Array.isArray(savedFallback.animals) &&
      Array.isArray(savedFallback.speciesProfiles)
    ) {
      if (this.db) {
        try {
          this.db.close();
        } catch {
          // Ignore close error
        }
        this.db = null;
      }
      this.fallbackSnapshot = savedFallback;
      this.loadedEpoch = persisted.epoch;
      return true;
    }

    this.loadedEpoch = persisted.epoch;
    return false;
  }

  async syncFromPersistedStorageIfStale(): Promise<boolean> {
    if (this.backingStore || this.ephemeralMode || !getSafeIndexedDb()) {
      return false;
    }
    const persisted = await this.readPersistedWriteEpoch();
    if (persisted.epoch <= this.loadedEpoch) {
      return false;
    }
    return withCrossTabLock(DB_WRITE_LOCK_NAME, () => this.syncFromPersistedStorageIfStaleLocked());
  }

  private async findRecoveredBackupSnapshot(): Promise<{
    snapshot: BarnDatabaseSnapshot;
    source: string;
  } | null> {
    if (this.ephemeralMode || (!this.backingStore && !getSafeIndexedDb())) {
      return null;
    }
    let saved: BarnDatabaseSnapshot | undefined;
    if (this.backingStore) {
      const raw = await this.backingStore.getItem(IDB_FALLBACK_SNAPSHOT_KEY).catch(() => null);
      if (typeof raw === 'string' && raw.trim()) {
        try {
          saved = JSON.parse(raw) as BarnDatabaseSnapshot;
        } catch {
          saved = undefined;
        }
      }
    } else {
      saved = await idbGet<BarnDatabaseSnapshot>(IDB_FALLBACK_SNAPSHOT_KEY).catch(() => undefined);
    }
    if (
      saved &&
      typeof saved === 'object' &&
      Array.isArray(saved.animals) &&
      Array.isArray(saved.speciesProfiles) &&
      (saved.animals.length > 0 || saved.speciesProfiles.length > 0)
    ) {
      return {
        snapshot: saved,
        source: this.backingStore
          ? `${this.backingStore.name} JSON fallback mirror`
          : 'IndexedDB JSON fallback mirror',
      };
    }

    try {
      const rollingList = await listRollingSnapshotBackups();
      for (const item of rollingList) {
        const recovered = await loadRollingSnapshotBackup(item.key);
        if (
          recovered &&
          (recovered.animals.length > 0 || recovered.speciesProfiles.length > 0)
        ) {
          return {
            snapshot: recovered,
            source: `rolling backup "${item.key}" (${item.savedAtIso})`,
          };
        }
      }
    } catch (rollingErr) {
      logDiagnosticEvent({
        level: 'warn',
        category: 'storage',
        message: 'Rolling backup scan failed while attempting non-destructive DB recovery',
        error: rollingErr,
      });
    }
    return null;
  }

  private async tryRestoreIntoFreshSqliteDbLocked(snapshot: BarnDatabaseSnapshot): Promise<boolean> {
    if (!this.SQL) return false;
    try {
      const freshDb = new this.SQL.Database();
      applySchemaMigrations(freshDb);
      if (this.db) {
        try {
          this.db.close();
        } catch {
          // Ignore close failure on previous handle
        }
      }
      this.db = freshDb;
      this.fallbackSnapshot = null;
      await this.replaceSnapshotLocked(snapshot, 'restoreFreshSqliteDb');
      return true;
    } catch (rebuildErr) {
      this.db = null;
      this.fallbackSnapshot = snapshot;
      logDiagnosticEvent({
        level: 'warn',
        category: 'storage',
        message:
          'Corrective action: Fresh SQLite rebuild failed during recovery — continuing safely in IndexedDB JSON mode',
        error: rebuildErr,
      });
      return false;
    }
  }

  async initialize(options?: SnapshotLoadOptions): Promise<BarnDatabaseSnapshot> {
    return withCrossTabLock(DB_WRITE_LOCK_NAME, () => this.initializeLocked(options));
  }

  private async initializeLocked(options?: SnapshotLoadOptions): Promise<BarnDatabaseSnapshot> {
    this.wipedRecoveryContext = null;
    this.corruptionRecoveryNotice = null;
    this.ephemeralMode = false;
    let hadPrimarySqliteBytes = false;
    let primarySqliteCorruptedError: string | null = null;
    const finalizeSnapshot = (snap: BarnDatabaseSnapshot): BarnDatabaseSnapshot =>
      options?.lightweightPhotos ? stripPhotoDataUrlsFromSnapshot(snap) : snap;

    const tryDetectWipedStorage = async (): Promise<BarnDatabaseSnapshot | null> => {
      if (this.ephemeralMode || !getSafeIndexedDb() || options?.allowSeedFresh) return null;
      const wiped = await detectReturningUserWipedStorage().catch(() => null);
      if (wiped && wiped.detected) {
        this.wipedRecoveryContext = wiped;
        logDiagnosticEvent({
          level: 'warn',
          category: 'storage',
          message: `Paused auto-seed: detected prior-use evidence (${wiped.reason}) while primary IndexedDB appeared empty`,
        });
        return finalizeSnapshot(buildEmptyShellSnapshot());
      }
      return null;
    };

    try {
      if (!this.backingStore && !getSafeIndexedDb()) {
        this.SQL = await createSqlJsStatic();
        this.ephemeralMode = true;
        this.db = new this.SQL.Database();
        applySchemaMigrations(this.db);
        const { buildFullPredefinedSampleSnapshot } = await import('../domain/sampleData');
        const seeded = buildFullPredefinedSampleSnapshot();
        await this.replaceSnapshotLocked(seeded, 'initializeEphemeralSeed');
        logDiagnosticEvent({
          level: 'warn',
          category: 'storage',
          message:
            'IndexedDB unavailable (Private Browsing or Lockdown Mode) — running in ephemeral SQLite session mode',
        });
        return finalizeSnapshot(seeded);
      }

      // Parallelize SQLite WASM download/compile with IndexedDB / native backing-store reads
      const sqlPromise = createSqlJsStatic();
      const storeReadPromise = (async () => {
        if (this.backingStore) {
          await this.backingStore.initialize();
          const [bytesVal, epochVal] = await Promise.all([
            this.backingStore
              .getItem(IDB_PRIMARY_KEY)
              .then((val) => (val instanceof Uint8Array ? val : undefined)),
            this.readPersistedWriteEpoch(),
          ]);
          return { savedBytes: bytesVal, epochMeta: epochVal };
        }
        const [bytesVal, epochVal] = await Promise.all([
          idbGet<Uint8Array>(IDB_PRIMARY_KEY),
          this.readPersistedWriteEpoch(),
        ]);
        return { savedBytes: bytesVal, epochMeta: epochVal };
      })();

      const [sqlRuntime, { savedBytes, epochMeta }] = await Promise.all([
        sqlPromise,
        storeReadPromise,
      ]);
      this.SQL = sqlRuntime;
      if (savedBytes && savedBytes.byteLength > 0) {
        hadPrimarySqliteBytes = true;
        const headerCheck = validateSqliteFileHeader(savedBytes, IDB_PRIMARY_KEY);
        if (!headerCheck.ok) {
          primarySqliteCorruptedError = headerCheck.error;
          logDiagnosticEvent({
            level: 'warn',
            category: 'storage',
            message: `Corrective action: Rejected corrupted primary SQLite header (${headerCheck.error}) — triggering non-destructive recovery`,
          });
          throw new Error(headerCheck.error);
        }
        this.db = new this.SQL.Database(savedBytes);
        this.loadedEpoch = epochMeta.epoch;

        // Automated pre-upgrade OPFS snapshot before migrating older schema versions
        const prevSchemaVer = readSqliteUserVersion(this.db);
        if (prevSchemaVer < SQLITE_SCHEMA_VERSION) {
          try {
            const preSnap = this.loadSnapshotUnlocked({ lightweightPhotos: true });
            if (preSnap.animals.length > 0) {
              await saveOpfsVaultBackup(preSnap, {
                kind: 'pre_upgrade',
                note: `Automatic pre-upgrade snapshot (SQLite schema v${prevSchemaVer} → v${SQLITE_SCHEMA_VERSION})`,
              });
            }
          } catch {
            // Non-blocking pre-upgrade snapshot
          }
        }

        try {
          applySchemaMigrations(this.db);
        } catch (migErr) {
          let salvagedSnapshot: BarnDatabaseSnapshot | null = null;
          const rawStores: Record<string, unknown[]> = {};
          try {
            salvagedSnapshot = this.loadSnapshotUnlocked({ lightweightPhotos: true });
          } catch {
            try {
              rawStores.animals = this.queryObjects('SELECT * FROM animals');
              rawStores.species_profiles = this.queryObjects('SELECT * FROM species_profiles');
            } catch {
              // Ignore raw salvage query errors
            }
          }
          await dumpRawRecordsToOpfsRecoveryBackup({
            sourceDbName: IDB_DB_NAME,
            reason: migErr instanceof Error ? migErr.message : 'SQLite schema migration failure',
            stores: rawStores,
            salvagedSnapshot,
          }).catch(() => {});
          throw migErr;
        }

        const snap = this.loadSnapshotUnlocked(options);
        if (snap.speciesProfiles.length === 0 && snap.animals.length === 0) {
          const recovered = await this.findRecoveredBackupSnapshot();
          if (recovered) {
            await this.replaceSnapshotLocked(recovered.snapshot, 'initializeRecoverEmptySqlite');
            logDiagnosticEvent({
              level: 'warn',
              category: 'storage',
              message: `Corrective action: Recovered ${recovered.snapshot.animals.length} animals from ${recovered.source} after empty SQLite database`,
            });
            return finalizeSnapshot(recovered.snapshot);
          }
          const wipedShell = await tryDetectWipedStorage();
          if (wipedShell) {
            return wipedShell;
          }
          const { buildFullPredefinedSampleSnapshot } = await import('../domain/sampleData');
          const seeded = buildFullPredefinedSampleSnapshot();
          await this.replaceSnapshotLocked(seeded, 'initializeSeedEmptySqlite');
          logDiagnosticEvent({
            level: 'info',
            category: 'storage',
            message: `Corrective action: Empty SQLite store with no backups initialized with starter sample data (${seeded.animals.length} animals)`,
          });
          return finalizeSnapshot(seeded);
        }
        return snap;
      } else {
        const recovered = await this.findRecoveredBackupSnapshot();
        this.db = new this.SQL.Database();
        applySchemaMigrations(this.db);
        if (recovered) {
          await this.replaceSnapshotLocked(recovered.snapshot, 'initializeRecoverMissingSqlite');
          logDiagnosticEvent({
            level: 'warn',
            category: 'storage',
            message: `Corrective action: Restored ${recovered.snapshot.animals.length} animals from ${recovered.source} when primary SQLite blob was missing`,
          });
          return finalizeSnapshot(recovered.snapshot);
        }
        const wipedShell = await tryDetectWipedStorage();
        if (wipedShell) {
          this.loadedEpoch = epochMeta.epoch;
          return wipedShell;
        }
        const { buildFullPredefinedSampleSnapshot } = await import('../domain/sampleData');
        const seeded = buildFullPredefinedSampleSnapshot();
        await this.replaceSnapshotLocked(seeded, 'initializeFreshSeed');
        return finalizeSnapshot(seeded);
      }
    } catch (err) {
      if (!this.backingStore && (!getSafeIndexedDb() || isIndexedDbBlockedError(err))) {
        this.ephemeralMode = true;
      }
      if (hadPrimarySqliteBytes && !this.ephemeralMode && !primarySqliteCorruptedError) {
        primarySqliteCorruptedError = err instanceof Error ? err.message : String(err);
      }

      console.warn('WASM SQLite fallback to IndexedDB JSON / Ephemeral Session:', err);
      logDiagnosticEvent({
        level: this.ephemeralMode ? 'warn' : 'error',
        category: isMemoryLikeError(err) ? 'memory' : 'storage',
        message: this.ephemeralMode
          ? 'Browser storage restricted (Private Browsing or Lockdown Mode) — running safely in ephemeral session mode'
          : 'Primary SQLite load failed — attempting non-destructive recovery from fallback/rolling backup',
        error: err,
      });

      if (isVersionError(err)) {
        await dumpIndexedDbDatabaseToOpfs(IDB_DB_NAME, 'Primary SQLite IndexedDB VersionError').catch(
          () => {}
        );
      }

      if (this.ephemeralMode) {
        const { buildFullPredefinedSampleSnapshot } = await import('../domain/sampleData');
        const seeded = buildFullPredefinedSampleSnapshot();
        if (this.SQL) {
          const rebuilt = await this.tryRestoreIntoFreshSqliteDbLocked(seeded);
          if (rebuilt) {
            return finalizeSnapshot(seeded);
          }
        }
        this.fallbackSnapshot = seeded;
        this.loadedEpoch = Math.max(this.loadedEpoch, 1);
        return finalizeSnapshot(seeded);
      }

      const recovered = await this.findRecoveredBackupSnapshot();
      if (recovered) {
        const rebuiltSqlite = await this.tryRestoreIntoFreshSqliteDbLocked(recovered.snapshot);
        if (!rebuiltSqlite) {
          this.fallbackSnapshot = recovered.snapshot;
          this.loadedEpoch = (await this.readPersistedWriteEpoch()).epoch;
        }
        if (primarySqliteCorruptedError) {
          this.corruptionRecoveryNotice = `Primary SQLite database could not be read (${primarySqliteCorruptedError}) and was recovered from ${recovered.source} (${recovered.snapshot.animals.length} animals). Please review recent edits and download a backup.`;
        }
        logDiagnosticEvent({
          level: 'warn',
          category: 'storage',
          message: `Corrective action: Auto-recovered ${recovered.snapshot.animals.length} animals from ${recovered.source}${rebuiltSqlite ? ' and rebuilt clean SQLite DB' : ''}`,
        });
        return finalizeSnapshot(recovered.snapshot);
      }

      const wipedShell = await tryDetectWipedStorage();
      if (wipedShell) {
        const currentWiped = this.getWipedRecoveryContext();
        if (primarySqliteCorruptedError && currentWiped) {
          this.wipedRecoveryContext = {
            ...currentWiped,
            corruptionError: primarySqliteCorruptedError,
          };
        }
        this.loadedEpoch = (await this.readPersistedWriteEpoch()).epoch;
        return wipedShell;
      }

      if (primarySqliteCorruptedError && !options?.allowSeedFresh) {
        this.wipedRecoveryContext = {
          detected: true,
          reason: 'corrupted_sqlite',
          sentinel: readPriorUseSentinel(),
          latestOpfsBackup: null,
          opfsBackupsCount: 0,
          opfsArchivesCount: 0,
          rollingBackupsCount: 0,
          corruptionError: primarySqliteCorruptedError,
        };
        this.loadedEpoch = (await this.readPersistedWriteEpoch()).epoch;
        logDiagnosticEvent({
          level: 'error',
          category: 'storage',
          message: `Paused auto-seed after primary SQLite corruption (${primarySqliteCorruptedError}) with no mirror available — awaiting explicit user recovery or reset`,
        });
        return finalizeSnapshot(buildEmptyShellSnapshot());
      }

      const { buildFullPredefinedSampleSnapshot } = await import('../domain/sampleData');
      const seeded = buildFullPredefinedSampleSnapshot();
      this.fallbackSnapshot = seeded;
      logDiagnosticEvent({
        level: 'warn',
        category: 'storage',
        message: `Corrective action: Primary & fallback stores unavailable — initialized clean starter snapshot (${seeded.animals.length} sample animals)`,
      });
      try {
        await this.persistToDiskLocked(seeded, 'initializeFallbackSeed');
      } catch {
        // Keep in-memory fallback even if quota is full
      }
      return finalizeSnapshot(seeded);
    }
  }

  private async persistToDiskLocked(
    preloadedSnapshot?: BarnDatabaseSnapshot,
    reason?: string
  ): Promise<void> {
    if (this.ephemeralMode || (!this.backingStore && !getSafeIndexedDb())) {
      this.ephemeralMode = true;
      this.loadedEpoch = this.loadedEpoch + 1;
      publishCrossTabDbCommit({
        epoch: this.loadedEpoch,
        writerTabId: this.tabId,
        reason,
      });
      return;
    }

    const persisted = await this.readPersistedWriteEpoch();
    const nextEpoch = Math.max(persisted.epoch, this.loadedEpoch) + 1;
    const epochMeta: PersistedWriteEpochMeta = {
      epoch: nextEpoch,
      writerTabId: this.tabId,
      updatedAtIso: getAdjustedNowIsoUtc(),
    };

    try {
      if (this.backingStore) {
        if (this.db) {
          const bytes = this.db.export();
          await this.backingStore.setItem(IDB_PRIMARY_KEY, bytes);
          await this.backingStore.setItem(IDB_WRITE_EPOCH_KEY, JSON.stringify(epochMeta));
        } else if (this.fallbackSnapshot) {
          await this.backingStore.setItem(
            IDB_FALLBACK_SNAPSHOT_KEY,
            JSON.stringify(this.fallbackSnapshot)
          );
          await this.backingStore.setItem(IDB_WRITE_EPOCH_KEY, JSON.stringify(epochMeta));
        }
        if (this.backingStore.flush) {
          await this.backingStore.flush();
        }
      } else if (this.db) {
        const bytes = this.db.export();
        await idbSetAtomic(
          [
            { key: IDB_PRIMARY_KEY, value: bytes },
            { key: IDB_WRITE_EPOCH_KEY, value: epochMeta },
          ],
          purgePrimaryQuotaCaches
        );
      } else if (this.fallbackSnapshot) {
        await idbSetAtomic(
          [
            { key: IDB_FALLBACK_SNAPSHOT_KEY, value: this.fallbackSnapshot },
            { key: IDB_WRITE_EPOCH_KEY, value: epochMeta },
          ],
          purgePrimaryQuotaCaches
        );
      }
      this.loadedEpoch = nextEpoch;
      publishCrossTabDbCommit({
        epoch: nextEpoch,
        writerTabId: this.tabId,
        reason,
      });
    } catch (err) {
      if (!this.backingStore && !isQuotaExceededError(err) && isIndexedDbBlockedError(err)) {
        this.ephemeralMode = true;
        this.loadedEpoch = nextEpoch;
        logDiagnosticEvent({
          level: 'warn',
          category: 'storage',
          message:
            'IndexedDB write blocked by browser privacy/lockdown policy — degrading cleanly to ephemeral in-memory session mode',
          error: err,
        });
        publishCrossTabDbCommit({
          epoch: nextEpoch,
          writerTabId: this.tabId,
          reason,
        });
        return;
      }
      logDiagnosticEvent({
        level: 'error',
        category: isMemoryLikeError(err) ? 'memory' : 'storage',
        message: isQuotaExceededError(err)
          ? 'IndexedDB storage quota exceeded while saving database'
          : 'Failed writing local database to IndexedDB',
        error: err,
      });
      throw err;
    }

    // Periodically capture rolling snapshot backup + JSON fallback mirror (at most every 15s)
    // Skip empty snapshots so 0-animal shells never overwrite valid rolling recovery points.
    const nowMs = Date.now();
    if (nowMs - this.lastRollingSaveMs > 15_000) {
      try {
        const policy = getTierStoragePolicy(detectCurrentDeviceCapability().tier);
        const snap = preloadedSnapshot
          ? policy.dehydrateMirrorPhotos
            ? stripPhotoDataUrlsFromSnapshot(preloadedSnapshot)
            : preloadedSnapshot
          : this.loadSnapshotUnlocked({ lightweightPhotos: policy.dehydrateMirrorPhotos });
        if (snap.animals.length > 0) {
          this.lastRollingSaveMs = nowMs;
          markPriorUseSentinelFromSnapshot(snap);
          void saveRollingSnapshotBackup(snap, {
            maxRollingBackups: policy.rollingIdbCap,
            dehydratePhotos: policy.dehydrateMirrorPhotos,
          }).catch(() => {});
          if (this.db) {
            if (this.backingStore) {
              void this.backingStore
                .setItem(IDB_FALLBACK_SNAPSHOT_KEY, JSON.stringify(snap))
                .catch(() => {});
            } else {
              void idbSet(IDB_FALLBACK_SNAPSHOT_KEY, snap, purgePrimaryQuotaCaches).catch(() => {});
            }
          }
        }
      } catch {
        // Non-fatal background mirror error
      }
    }
  }

  private queryObjects(sql: string): Record<string, unknown>[] {
    if (!this.db) return [];
    return queryObjectsFromDb(this.db, sql);
  }

  private safeParseJson<T>(raw: unknown, fallback: T, contextLabel: string): T {
    if (raw === null || raw === undefined || raw === '') return fallback;
    try {
      const parsed = JSON.parse(String(raw));
      return parsed === null || parsed === undefined ? fallback : (parsed as T);
    } catch (err) {
      logDiagnosticEvent({
        level: 'warn',
        category: 'storage',
        message: `Corrective action: Auto-recovered malformed JSON in ${contextLabel} using safe default`,
        error: err,
      });
      return fallback;
    }
  }

  private loadSnapshotUnlocked(options?: SnapshotLoadOptions): BarnDatabaseSnapshot {
    if (!this.db) {
      const base = this.fallbackSnapshot ?? buildEmptyShellSnapshot();
      return options?.lightweightPhotos ? stripPhotoDataUrlsFromSnapshot(base) : base;
    }
    return readSnapshotFromDatabase(this.db, options, this.snapshotReaderDeps());
  }

  async loadSnapshot(options?: SnapshotLoadOptions): Promise<BarnDatabaseSnapshot> {
    if (!this.db && !this.fallbackSnapshot) {
      const { buildFullPredefinedSampleSnapshot } = await import('../domain/sampleData');
      this.fallbackSnapshot = buildFullPredefinedSampleSnapshot();
    }
    const persisted = await this.readPersistedWriteEpoch();
    if (persisted.epoch > this.loadedEpoch) {
      return withCrossTabLock(DB_WRITE_LOCK_NAME, async () => {
        await this.syncFromPersistedStorageIfStaleLocked();
        return this.loadSnapshotUnlocked(options);
      });
    }
    return this.loadSnapshotUnlocked(options);
  }

  async loadAnimalPhotoDataUrl(photoId: string): Promise<string | null> {
    if (!photoId) return null;
    await this.syncFromPersistedStorageIfStale();
    if (!this.db) {
      const found = (this.fallbackSnapshot?.animalPhotos ?? []).find((p) => p.id === photoId);
      return found?.dataUrl || found?.thumbnailDataUrl || null;
    }
    const stmt = this.db.prepare('SELECT data_url, thumbnail_data_url FROM animal_photos WHERE id = ? LIMIT 1');
    try {
      stmt.bind([photoId]);
      if (!stmt.step()) return null;
      const row = stmt.getAsObject() as { data_url?: unknown; thumbnail_data_url?: unknown };
      const resolved = String(row.data_url || row.thumbnail_data_url || '');
      return resolved || null;
    } finally {
      stmt.free();
    }
  }

  async loadAnimalPhotoDataUrlsBatch(photoIds?: string[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    if (photoIds && photoIds.length === 0) return out;
    await this.syncFromPersistedStorageIfStale();

    if (!this.db) {
      const wanted = photoIds ? new Set(photoIds) : null;
      for (const p of this.fallbackSnapshot?.animalPhotos ?? []) {
        if (wanted && !wanted.has(p.id)) continue;
        const val = p.dataUrl || p.thumbnailDataUrl || '';
        if (val) out[p.id] = val;
      }
      return out;
    }

    if (!photoIds) {
      const rows = this.queryObjects('SELECT id, data_url, thumbnail_data_url FROM animal_photos');
      for (const r of rows) {
        const id = String(r.id || '');
        const val = String(r.data_url || r.thumbnail_data_url || '');
        if (id && val) out[id] = val;
      }
      return out;
    }

    // Query in chunks of 200 to stay comfortably within SQLite parameter limits
    for (let i = 0; i < photoIds.length; i += 200) {
      const chunk = photoIds.slice(i, i + 200);
      const placeholders = chunk.map(() => '?').join(', ');
      const stmt = this.db.prepare(
        `SELECT id, data_url, thumbnail_data_url FROM animal_photos WHERE id IN (${placeholders})`
      );
      try {
        stmt.bind(chunk);
        while (stmt.step()) {
          const r = stmt.getAsObject() as { id?: unknown; data_url?: unknown; thumbnail_data_url?: unknown };
          const id = String(r.id || '');
          const val = String(r.data_url || r.thumbnail_data_url || '');
          if (id && val) out[id] = val;
        }
      } finally {
        stmt.free();
      }
    }
    return out;
  }

  async loadFeedBatchTagPhotoDataUrl(batchId: string): Promise<string | null> {
    if (!batchId) return null;
    await this.syncFromPersistedStorageIfStale();
    if (!this.db) {
      const found = (this.fallbackSnapshot?.feedBatches ?? []).find((b) => b.id === batchId);
      return found?.tagPhotoDataUrl || found?.tagPhotoThumbnailDataUrl || null;
    }
    const stmt = this.db.prepare(
      'SELECT tag_photo_data_url, tag_photo_thumbnail_data_url FROM feed_batches WHERE id = ? LIMIT 1'
    );
    try {
      stmt.bind([batchId]);
      if (!stmt.step()) return null;
      const row = stmt.getAsObject() as {
        tag_photo_data_url?: unknown;
        tag_photo_thumbnail_data_url?: unknown;
      };
      const resolved = String(row.tag_photo_data_url || row.tag_photo_thumbnail_data_url || '');
      return resolved ? sanitizeSafeRasterImageDataUrl(resolved) || null : null;
    } finally {
      stmt.free();
    }
  }

  async loadFeedBatchTagPhotoDataUrlsBatch(batchIds?: string[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    if (batchIds && batchIds.length === 0) return out;
    await this.syncFromPersistedStorageIfStale();

    if (!this.db) {
      const wanted = batchIds ? new Set(batchIds) : null;
      for (const b of this.fallbackSnapshot?.feedBatches ?? []) {
        if (wanted && !wanted.has(b.id)) continue;
        const val = b.tagPhotoDataUrl || b.tagPhotoThumbnailDataUrl || '';
        const safe = val ? sanitizeSafeRasterImageDataUrl(val) : '';
        if (safe) out[b.id] = safe;
      }
      return out;
    }

    if (!batchIds) {
      const rows = this.queryObjects(
        'SELECT id, tag_photo_data_url, tag_photo_thumbnail_data_url FROM feed_batches'
      );
      for (const r of rows) {
        const id = String(r.id || '');
        const val = String(r.tag_photo_data_url || r.tag_photo_thumbnail_data_url || '');
        const safe = val ? sanitizeSafeRasterImageDataUrl(val) : '';
        if (id && safe) out[id] = safe;
      }
      return out;
    }

    for (let i = 0; i < batchIds.length; i += 200) {
      const chunk = batchIds.slice(i, i + 200);
      const placeholders = chunk.map(() => '?').join(', ');
      const stmt = this.db.prepare(
        `SELECT id, tag_photo_data_url, tag_photo_thumbnail_data_url FROM feed_batches WHERE id IN (${placeholders})`
      );
      try {
        stmt.bind(chunk);
        while (stmt.step()) {
          const r = stmt.getAsObject() as {
            id?: unknown;
            tag_photo_data_url?: unknown;
            tag_photo_thumbnail_data_url?: unknown;
          };
          const id = String(r.id || '');
          const val = String(r.tag_photo_data_url || r.tag_photo_thumbnail_data_url || '');
          const safe = val ? sanitizeSafeRasterImageDataUrl(val) : '';
          if (id && safe) out[id] = safe;
        }
      } finally {
        stmt.free();
      }
    }
    return out;
  }

  async loadLedgerEntryReceiptPhotoDataUrl(entryId: string): Promise<string | null> {
    if (!entryId) return null;
    await this.syncFromPersistedStorageIfStale();
    if (!this.db) {
      const found = (this.fallbackSnapshot?.ledgerEntries ?? []).find((le) => le.id === entryId);
      return found?.receiptPhotoDataUrl || found?.receiptPhotoThumbnailDataUrl || null;
    }
    const stmt = this.db.prepare(
      'SELECT receipt_photo_data_url, receipt_photo_thumbnail_data_url FROM ledger_entries WHERE id = ? LIMIT 1'
    );
    try {
      stmt.bind([entryId]);
      if (!stmt.step()) return null;
      const row = stmt.getAsObject() as {
        receipt_photo_data_url?: unknown;
        receipt_photo_thumbnail_data_url?: unknown;
      };
      const resolved = String(
        row.receipt_photo_data_url || row.receipt_photo_thumbnail_data_url || ''
      );
      return resolved ? sanitizeSafeRasterImageDataUrl(resolved) || null : null;
    } finally {
      stmt.free();
    }
  }

  async loadLedgerEntryReceiptPhotoDataUrlsBatch(
    entryIds?: string[]
  ): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    if (entryIds && entryIds.length === 0) return out;
    await this.syncFromPersistedStorageIfStale();

    if (!this.db) {
      const wanted = entryIds ? new Set(entryIds) : null;
      for (const le of this.fallbackSnapshot?.ledgerEntries ?? []) {
        if (wanted && !wanted.has(le.id)) continue;
        const val = le.receiptPhotoDataUrl || le.receiptPhotoThumbnailDataUrl || '';
        const safe = val ? sanitizeSafeRasterImageDataUrl(val) : '';
        if (safe) out[le.id] = safe;
      }
      return out;
    }

    if (!entryIds) {
      const rows = this.queryObjects(
        'SELECT id, receipt_photo_data_url, receipt_photo_thumbnail_data_url FROM ledger_entries'
      );
      for (const r of rows) {
        const id = String(r.id || '');
        const val = String(r.receipt_photo_data_url || r.receipt_photo_thumbnail_data_url || '');
        const safe = val ? sanitizeSafeRasterImageDataUrl(val) : '';
        if (id && safe) out[id] = safe;
      }
      return out;
    }

    for (let i = 0; i < entryIds.length; i += 200) {
      const chunk = entryIds.slice(i, i + 200);
      const placeholders = chunk.map(() => '?').join(', ');
      const stmt = this.db.prepare(
        `SELECT id, receipt_photo_data_url, receipt_photo_thumbnail_data_url FROM ledger_entries WHERE id IN (${placeholders})`
      );
      try {
        stmt.bind(chunk);
        while (stmt.step()) {
          const r = stmt.getAsObject() as {
            id?: unknown;
            receipt_photo_data_url?: unknown;
            receipt_photo_thumbnail_data_url?: unknown;
          };
          const id = String(r.id || '');
          const val = String(r.receipt_photo_data_url || r.receipt_photo_thumbnail_data_url || '');
          const safe = val ? sanitizeSafeRasterImageDataUrl(val) : '';
          if (id && safe) out[id] = safe;
        }
      } finally {
        stmt.free();
      }
    }
    return out;
  }

  async queryPedigreeNeighborhood(rootIds: string[], maxDepth: number): Promise<Animal[]> {
    const cleanRoots = Array.from(new Set(rootIds.filter((id) => typeof id === 'string' && id.trim().length > 0)));
    if (cleanRoots.length === 0) return [];
    const boundedDepth = Math.min(8, Math.max(0, Math.floor(maxDepth)));
    await this.syncFromPersistedStorageIfStale();

    const MAX_RECORDS = 512;
    const collected: Animal[] = [];
    const visited = new Set<string>();
    let frontier = cleanRoots;

    if (!this.db) {
      const byId = new Map<string, Animal>();
      for (const a of this.fallbackSnapshot?.animals ?? []) {
        byId.set(a.id, a);
      }
      for (let depth = 0; depth <= boundedDepth && frontier.length > 0 && collected.length < MAX_RECORDS; depth++) {
        const nextFrontier: string[] = [];
        for (const id of frontier) {
          if (visited.has(id) || collected.length >= MAX_RECORDS) continue;
          visited.add(id);
          const found = byId.get(id);
          if (!found) continue;
          collected.push(found);
          if (depth < boundedDepth) {
            if (found.sireId && !visited.has(found.sireId)) nextFrontier.push(found.sireId);
            if (found.damId && !visited.has(found.damId)) nextFrontier.push(found.damId);
          }
        }
        frontier = nextFrontier;
      }
      return collected;
    }

    for (let depth = 0; depth <= boundedDepth && frontier.length > 0 && collected.length < MAX_RECORDS; depth++) {
      const batchToFetch: string[] = [];
      for (const id of frontier) {
        if (!visited.has(id)) {
          visited.add(id);
          batchToFetch.push(id);
        }
      }
      if (batchToFetch.length === 0) break;

      const nextFrontier: string[] = [];
      for (let i = 0; i < batchToFetch.length; i += 64) {
        if (collected.length >= MAX_RECORDS) break;
        const chunk = batchToFetch.slice(i, i + 64);
        const placeholders = chunk.map(() => '?').join(', ');
        const stmt = this.db.prepare(
          `SELECT * FROM animals WHERE id IN (${placeholders})`
        );
        try {
          stmt.bind(chunk);
          while (stmt.step()) {
            if (collected.length >= MAX_RECORDS) break;
            const animal = mapAnimalRow(stmt.getAsObject(), (raw, fallback, label) =>
              this.safeParseJson(raw, fallback, label)
            );
            collected.push(animal);
            if (depth < boundedDepth) {
              if (animal.sireId && !visited.has(animal.sireId)) nextFrontier.push(animal.sireId);
              if (animal.damId && !visited.has(animal.damId)) nextFrontier.push(animal.damId);
            }
          }
        } finally {
          stmt.free();
        }
      }
      frontier = nextFrontier;
    }

    return collected;
  }

  async queryPedigreeBranchAncestorsExist(
    animalIds: string[]
  ): Promise<Record<string, boolean>> {
    const out: Record<string, boolean> = {};
    const cleanIds = Array.from(new Set(animalIds.filter((id) => typeof id === 'string' && id.trim().length > 0)));
    if (cleanIds.length === 0) return out;
    await this.syncFromPersistedStorageIfStale();

    if (!this.db) {
      const byId = new Map<string, Animal>();
      for (const a of this.fallbackSnapshot?.animals ?? []) {
        byId.set(a.id, a);
      }
      for (const id of cleanIds) {
        const a = byId.get(id);
        if (!a) {
          out[id] = false;
          continue;
        }
        out[id] = Boolean(
          (a.sireId && byId.has(a.sireId)) ||
            (a.damId && byId.has(a.damId)) ||
            a.offloadedArchiveKey
        );
      }
      return out;
    }

    const parentRefs: Array<{ id: string; sireId: string; damId: string; archivedKey: string }> = [];
    const candidateParentIds = new Set<string>();

    for (let i = 0; i < cleanIds.length; i += 64) {
      const chunk = cleanIds.slice(i, i + 64);
      const placeholders = chunk.map(() => '?').join(', ');
      const stmt = this.db.prepare(
        `SELECT id, sire_id, dam_id, offloaded_archive_key FROM animals WHERE id IN (${placeholders})`
      );
      try {
        stmt.bind(chunk);
        while (stmt.step()) {
          const r = stmt.getAsObject() as {
            id?: unknown;
            sire_id?: unknown;
            dam_id?: unknown;
            offloaded_archive_key?: unknown;
          };
          const id = String(r.id || '');
          const sireId = String(r.sire_id || '');
          const damId = String(r.dam_id || '');
          const archivedKey = String(r.offloaded_archive_key || '');
          if (id) {
            parentRefs.push({ id, sireId, damId, archivedKey });
            if (sireId) candidateParentIds.add(sireId);
            if (damId) candidateParentIds.add(damId);
          }
        }
      } finally {
        stmt.free();
      }
    }

    const existingParents = new Set<string>();
    const parentIdArr = Array.from(candidateParentIds);
    for (let i = 0; i < parentIdArr.length; i += 64) {
      const chunk = parentIdArr.slice(i, i + 64);
      const placeholders = chunk.map(() => '?').join(', ');
      const stmt = this.db.prepare(
        `SELECT id FROM animals WHERE id IN (${placeholders})`
      );
      try {
        stmt.bind(chunk);
        while (stmt.step()) {
          const r = stmt.getAsObject() as { id?: unknown };
          const pid = String(r.id || '');
          if (pid) existingParents.add(pid);
        }
      } finally {
        stmt.free();
      }
    }

    for (const ref of parentRefs) {
      out[ref.id] = Boolean(
        (ref.sireId && existingParents.has(ref.sireId)) ||
          (ref.damId && existingParents.has(ref.damId)) ||
          ref.archivedKey
      );
    }
    return out;
  }

  async replaceSnapshot(snapshot: BarnDatabaseSnapshot): Promise<void> {
    return withCrossTabLock(DB_WRITE_LOCK_NAME, () =>
      this.replaceSnapshotLocked(snapshot, 'replaceSnapshot')
    );
  }

  private async replaceSnapshotLocked(
    snapshot: BarnDatabaseSnapshot,
    reason = 'replaceSnapshot'
  ): Promise<void> {
    if (!this.db) {
      const existingById = new Map<string, string>();
      for (const prev of this.fallbackSnapshot?.animalPhotos ?? []) {
        if (prev.dataUrl) existingById.set(prev.id, prev.dataUrl);
      }
      const nextPhotos = (snapshot.animalPhotos ?? []).map((p) =>
        p.dataUrl ? p : { ...p, dataUrl: existingById.get(p.id) || p.thumbnailDataUrl || '' }
      );
      const nextSnap: BarnDatabaseSnapshot = { ...snapshot, animalPhotos: nextPhotos };
      this.fallbackSnapshot = nextSnap;
      await this.persistToDiskLocked(nextSnap, reason);
      return;
    }

    const existingPhotoDataUrls = new Map<string, string>();
    const hasDehydratedPhoto = (snapshot.animalPhotos ?? []).some((p) => !p.dataUrl);
    if (hasDehydratedPhoto) {
      for (const row of this.queryObjects('SELECT id, data_url FROM animal_photos')) {
        const id = String(row.id || '');
        const dataUrl = String(row.data_url || '');
        if (id && dataUrl) existingPhotoDataUrls.set(id, dataUrl);
      }
    }

    const db = this.db;
    runSqliteTransaction(db, (txDb) => {
      txDb.run('DELETE FROM barn_settings;');
      txDb.run('DELETE FROM species_profiles;');
      txDb.run('DELETE FROM animals;');
      txDb.run('DELETE FROM animal_photos;');
      txDb.run('DELETE FROM cages;');
      txDb.run('DELETE FROM breedings;');
      txDb.run('DELETE FROM barn_tasks;');
      txDb.run('DELETE FROM care_logs;');
      txDb.run('DELETE FROM shows;');
      txDb.run('DELETE FROM feed_batches;');
      txDb.run('DELETE FROM feed_allocations;');
      txDb.run('DELETE FROM ledger_entries;');
      txDb.run('DELETE FROM processing_logs;');
      txDb.run('DELETE FROM youth_project_books;');
      txDb.run('DELETE FROM client_contacts;');
      txDb.run('DELETE FROM waitlist_entries;');
      txDb.run('DELETE FROM animal_reservations;');
      txDb.run('DELETE FROM wool_harvests;');
      txDb.run('DELETE FROM mileage_logs;');
      txDb.run('DELETE FROM journal_entries;');
      txDb.run('DELETE FROM judge_clubs;');
      txDb.run('DELETE FROM judge_assignments;');
      txDb.run('DELETE FROM judge_expenses;');

      upsertSettingsRow(txDb, snapshot.settings);
      for (const sp of snapshot.speciesProfiles) upsertSpeciesRow(txDb, sp);
      for (const a of snapshot.animals) upsertAnimalRow(txDb, a);
      for (const p of snapshot.animalPhotos ?? []) {
        const preservedDataUrl = p.dataUrl || existingPhotoDataUrls.get(p.id) || '';
        upsertAnimalPhotoRow(
          txDb,
          preservedDataUrl === p.dataUrl ? p : { ...p, dataUrl: preservedDataUrl }
        );
      }
      for (const c of snapshot.cages) upsertCageRow(txDb, c);
      for (const b of snapshot.breedings) upsertBreedingRow(txDb, b);
      for (const t of snapshot.tasks) upsertTaskRow(txDb, t);
      for (const l of snapshot.careLogs) upsertCareLogRow(txDb, l);
      for (const s of snapshot.shows) upsertShowRow(txDb, s);
      for (const fb of snapshot.feedBatches ?? []) upsertFeedBatchRow(txDb, fb);
      for (const fa of snapshot.feedAllocations ?? []) upsertFeedAllocationRow(txDb, fa);
      for (const le of snapshot.ledgerEntries ?? []) upsertLedgerEntryRow(txDb, le);
      for (const pl of snapshot.processingLogs ?? []) upsertProcessingLogRow(txDb, pl);
      for (const yp of snapshot.youthProjectBooks ?? []) upsertYouthProjectBookRow(txDb, yp);
      for (const cc of snapshot.clientContacts ?? []) upsertClientContactRow(txDb, cc);
      for (const wl of snapshot.waitlistEntries ?? []) upsertWaitlistEntryRow(txDb, wl);
      for (const ar of snapshot.animalReservations ?? []) upsertAnimalReservationRow(txDb, ar);
      for (const wh of snapshot.woolHarvests ?? []) upsertWoolHarvestRow(txDb, wh);
      for (const ml of snapshot.mileageLogs ?? []) upsertMileageLogRow(txDb, ml);
      for (const je of snapshot.journalEntries ?? []) upsertJournalEntryRow(txDb, je);
      for (const jc of snapshot.judgeClubs ?? []) upsertJudgeClubRow(txDb, jc);
      for (const ja of snapshot.judgeAssignments ?? []) upsertJudgeAssignmentRow(txDb, ja);
      for (const jx of snapshot.judgeExpenses ?? []) upsertJudgeExpenseRow(txDb, jx);
    });

    await this.persistToDiskLocked(hasDehydratedPhoto ? undefined : snapshot, reason);
  }

  private upsertFallbackList<T extends { id: string }>(
    list: T[] | undefined,
    items: readonly T[],
    mergeItem?: (incoming: T, existing?: T) => T,
    afterSort?: (next: T[]) => void
  ): T[] {
    const next = list ? [...list] : [];
    for (const item of items) {
      const idx = next.findIndex((x) => x.id === item.id);
      const resolved = mergeItem ? mergeItem(item, idx >= 0 ? next[idx] : undefined) : item;
      if (idx >= 0) next[idx] = resolved;
      else next.push(resolved);
    }
    if (afterSort) afterSort(next);
    return next;
  }

  private snapshotReaderDeps(): SnapshotReaderDeps {
    return {
      safeParseJson: (raw, fallback, label) => this.safeParseJson(raw, fallback, label),
    };
  }

  private async withLockedWrite(reason: string, mutate: () => void): Promise<void> {
    return withCrossTabLock(DB_WRITE_LOCK_NAME, async () => {
      await this.syncFromPersistedStorageIfStaleLocked();
      mutate();
      await this.persistToDiskLocked(undefined, reason);
    });
  }

  private async saveEntity<T extends { id: string }>(
    reason: string,
    item: T,
    sqliteWrite: (db: Database, value: T) => void,
    fallbackWrite: (snap: BarnDatabaseSnapshot, value: T) => void
  ): Promise<void> {
    await this.withLockedWrite(reason, () => {
      if (this.db) {
        sqliteWrite(this.db, item);
      } else if (this.fallbackSnapshot) {
        fallbackWrite(this.fallbackSnapshot, item);
      }
    });
  }

  private async saveEntityBatch<T extends { id: string }>(
    reason: string,
    items: T[],
    sqliteWrite: (db: Database, value: T) => void,
    fallbackWrite: (snap: BarnDatabaseSnapshot, values: T[]) => void
  ): Promise<void> {
    if (items.length === 0) return;
    await this.withLockedWrite(reason, () => {
      if (this.db) {
        writeRowsInTransaction(this.db, items, sqliteWrite);
      } else if (this.fallbackSnapshot) {
        fallbackWrite(this.fallbackSnapshot, items);
      }
    });
  }

  private async deleteEntity(
    reason: string,
    sqliteDelete: (db: Database) => void,
    fallbackDelete: (snap: BarnDatabaseSnapshot) => void
  ): Promise<void> {
    await this.withLockedWrite(reason, () => {
      if (this.db) {
        sqliteDelete(this.db);
      } else if (this.fallbackSnapshot) {
        fallbackDelete(this.fallbackSnapshot);
      }
    });
  }

  async saveSettings(settings: BarnSettings): Promise<void> {
    await this.withLockedWrite('saveSettings', () => {
      if (this.db) {
        upsertSettingsRow(this.db, settings);
      } else if (this.fallbackSnapshot) {
        this.fallbackSnapshot.settings = settings;
      }
    });
  }

  async saveSpeciesProfile(profile: SpeciesProfile): Promise<void> {
    await this.saveEntity(
      'saveSpeciesProfile',
      profile,
      upsertSpeciesRow,
      (snap, sp) => {
        snap.speciesProfiles = this.upsertFallbackList(
          snap.speciesProfiles,
          [sp],
          undefined,
          (list) =>
            list.sort(
              (a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999) || a.name.localeCompare(b.name)
            )
        );
      }
    );
  }

  async saveSpeciesProfilesBatch(profiles: SpeciesProfile[]): Promise<void> {
    await this.saveEntityBatch(
      'saveSpeciesProfilesBatch',
      profiles,
      upsertSpeciesRow,
      (snap, items) => {
        snap.speciesProfiles = this.upsertFallbackList(
          snap.speciesProfiles,
          items,
          undefined,
          (list) =>
            list.sort(
              (a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999) || a.name.localeCompare(b.name)
            )
        );
      }
    );
  }

  async deleteSpeciesProfile(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteSpeciesProfile',
      (db) => db.run('DELETE FROM species_profiles WHERE id = ?', [id]),
      (snap) => {
        snap.speciesProfiles = snap.speciesProfiles.filter((p) => p.id !== id);
      }
    );
  }

  async saveAnimal(animal: Animal): Promise<void> {
    await this.saveEntity('saveAnimal', animal, upsertAnimalRow, (snap, a) => {
      snap.animals = this.upsertFallbackList(snap.animals, [a]);
    });
  }

  async saveAnimalsBatch(animals: Animal[]): Promise<void> {
    await this.saveEntityBatch('saveAnimalsBatch', animals, upsertAnimalRow, (snap, items) => {
      snap.animals = this.upsertFallbackList(snap.animals, items);
    });
  }

  async deleteAnimal(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteAnimal',
      (db) => {
        db.run('DELETE FROM animals WHERE id = ?', [id]);
        db.run('DELETE FROM animal_photos WHERE animal_id = ?', [id]);
        db.run('DELETE FROM care_logs WHERE animal_id = ?', [id]);
        db.run('DELETE FROM wool_harvests WHERE animal_id = ?', [id]);
      },
      (snap) => {
        snap.animals = snap.animals.filter((a) => a.id !== id);
        snap.animalPhotos = (snap.animalPhotos || []).filter((p) => p.animalId !== id);
        snap.careLogs = snap.careLogs.filter((l) => l.animalId !== id);
        snap.woolHarvests = (snap.woolHarvests || []).filter((w) => w.animalId !== id);
      }
    );
  }

  async deleteAnimalsBatch(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    await this.withLockedWrite('deleteAnimalsBatch', () => {
      if (this.db) {
        deleteRowsForIds(this.db, ids, () => [
          'DELETE FROM animals WHERE id = ?',
          'DELETE FROM animal_photos WHERE animal_id = ?',
          'DELETE FROM care_logs WHERE animal_id = ?',
          'DELETE FROM wool_harvests WHERE animal_id = ?',
        ]);
      } else if (this.fallbackSnapshot) {
        this.fallbackSnapshot.animals = this.fallbackSnapshot.animals.filter((a) => !idSet.has(a.id));
        this.fallbackSnapshot.animalPhotos = (this.fallbackSnapshot.animalPhotos || []).filter(
          (p) => !idSet.has(p.animalId)
        );
        this.fallbackSnapshot.careLogs = this.fallbackSnapshot.careLogs.filter(
          (l) => !idSet.has(l.animalId)
        );
        this.fallbackSnapshot.woolHarvests = (this.fallbackSnapshot.woolHarvests || []).filter(
          (w) => !idSet.has(w.animalId)
        );
      }
    });
  }

  private mergeFallbackPhoto(photo: AnimalPhoto, existing?: AnimalPhoto): AnimalPhoto {
    return !photo.dataUrl && existing?.dataUrl ? { ...photo, dataUrl: existing.dataUrl } : photo;
  }

  async saveAnimalPhoto(photo: AnimalPhoto): Promise<void> {
    await this.saveEntity('saveAnimalPhoto', photo, upsertAnimalPhotoRow, (snap, p) => {
      snap.animalPhotos = this.upsertFallbackList(snap.animalPhotos, [p], (inc, prev) =>
        this.mergeFallbackPhoto(inc, prev)
      );
    });
  }

  async saveAnimalPhotosBatch(photos: AnimalPhoto[]): Promise<void> {
    await this.saveEntityBatch('saveAnimalPhotosBatch', photos, upsertAnimalPhotoRow, (snap, items) => {
      snap.animalPhotos = this.upsertFallbackList(snap.animalPhotos, items, (inc, prev) =>
        this.mergeFallbackPhoto(inc, prev)
      );
    });
  }

  async deleteAnimalPhoto(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteAnimalPhoto',
      (db) => db.run('DELETE FROM animal_photos WHERE id = ?', [id]),
      (snap) => {
        snap.animalPhotos = (snap.animalPhotos || []).filter((p) => p.id !== id);
      }
    );
  }

  async saveCage(cage: CageLocation): Promise<void> {
    await this.saveEntity('saveCage', cage, upsertCageRow, (snap, c) => {
      snap.cages = this.upsertFallbackList(snap.cages, [c]);
    });
  }

  async deleteCage(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteCage',
      (db) => db.run('DELETE FROM cages WHERE id = ?', [id]),
      (snap) => {
        snap.cages = snap.cages.filter((c) => c.id !== id);
      }
    );
  }

  async saveBreeding(breeding: BreedingRecord): Promise<void> {
    await this.saveEntity('saveBreeding', breeding, upsertBreedingRow, (snap, b) => {
      snap.breedings = this.upsertFallbackList(snap.breedings, [b]);
    });
  }

  async deleteBreeding(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteBreeding',
      (db) => {
        db.run('DELETE FROM breedings WHERE id = ?', [id]);
        db.run('DELETE FROM barn_tasks WHERE linked_breeding_id = ?', [id]);
      },
      (snap) => {
        snap.breedings = snap.breedings.filter((b) => b.id !== id);
        snap.tasks = snap.tasks.filter((t) => t.linkedBreedingId !== id);
      }
    );
  }

  async saveTask(task: BarnTask): Promise<void> {
    await this.saveEntity('saveTask', task, upsertTaskRow, (snap, t) => {
      snap.tasks = this.upsertFallbackList(snap.tasks, [t]);
    });
  }

  async saveTasksBatch(tasks: BarnTask[]): Promise<void> {
    await this.saveEntityBatch('saveTasksBatch', tasks, upsertTaskRow, (snap, items) => {
      snap.tasks = this.upsertFallbackList(snap.tasks, items);
    });
  }

  async deleteTask(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteTask',
      (db) => db.run('DELETE FROM barn_tasks WHERE id = ?', [id]),
      (snap) => {
        snap.tasks = snap.tasks.filter((t) => t.id !== id);
      }
    );
  }

  async deleteTasksBatch(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    await this.withLockedWrite('deleteTasksBatch', () => {
      if (this.db) {
        deleteRowsForIds(this.db, ids, () => ['DELETE FROM barn_tasks WHERE id = ?']);
      } else if (this.fallbackSnapshot) {
        this.fallbackSnapshot.tasks = this.fallbackSnapshot.tasks.filter((t) => !idSet.has(t.id));
      }
    });
  }

  async saveCareLog(log: CareLog): Promise<void> {
    await this.saveEntity('saveCareLog', log, upsertCareLogRow, (snap, l) => {
      snap.careLogs = this.upsertFallbackList(snap.careLogs, [l]);
    });
  }

  async saveCareLogsBatch(logs: CareLog[]): Promise<void> {
    await this.saveEntityBatch('saveCareLogsBatch', logs, upsertCareLogRow, (snap, items) => {
      snap.careLogs = this.upsertFallbackList(snap.careLogs, items);
    });
  }

  async deleteCareLog(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteCareLog',
      (db) => db.run('DELETE FROM care_logs WHERE id = ?', [id]),
      (snap) => {
        snap.careLogs = snap.careLogs.filter((l) => l.id !== id);
      }
    );
  }

  async saveShow(show: ShowEvent): Promise<void> {
    const cleanResults = normalizeShowResults(show.results ?? [], { dropEmpty: false });
    const normalizedShow: ShowEvent = {
      ...show,
      results: cleanResults.length > 0 ? cleanResults : undefined,
    };
    await this.saveEntity('saveShow', normalizedShow, upsertShowRow, (snap, s) => {
      snap.shows = this.upsertFallbackList(snap.shows, [s]);
    });
  }

  async deleteShow(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteShow',
      (db) => db.run('DELETE FROM shows WHERE id = ?', [id]),
      (snap) => {
        snap.shows = snap.shows.filter((s) => s.id !== id);
      }
    );
  }

  private mergeFallbackFeedBatch(batch: FeedBatch, existing?: FeedBatch): FeedBatch {
    return !batch.tagPhotoDataUrl &&
      batch.tagPhotoThumbnailDataUrl &&
      !batch.tagPhotoPurgedAtIso &&
      existing?.tagPhotoDataUrl
      ? { ...batch, tagPhotoDataUrl: existing.tagPhotoDataUrl }
      : batch;
  }

  async saveFeedBatch(batch: FeedBatch): Promise<void> {
    await this.saveEntity('saveFeedBatch', batch, upsertFeedBatchRow, (snap, fb) => {
      snap.feedBatches = this.upsertFallbackList(snap.feedBatches, [fb], (inc, prev) =>
        this.mergeFallbackFeedBatch(inc, prev)
      );
    });
  }

  async saveFeedBatchesBatch(batches: FeedBatch[]): Promise<void> {
    await this.saveEntityBatch('saveFeedBatchesBatch', batches, upsertFeedBatchRow, (snap, items) => {
      snap.feedBatches = this.upsertFallbackList(snap.feedBatches, items, (inc, prev) =>
        this.mergeFallbackFeedBatch(inc, prev)
      );
    });
  }

  async deleteFeedBatch(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteFeedBatch',
      (db) => {
        db.run('DELETE FROM feed_batches WHERE id = ?', [id]);
        db.run('DELETE FROM feed_allocations WHERE feed_batch_id = ?', [id]);
      },
      (snap) => {
        snap.feedBatches = (snap.feedBatches ?? []).filter((f) => f.id !== id);
        snap.feedAllocations = (snap.feedAllocations ?? []).filter((fa) => fa.feedBatchId !== id);
      }
    );
  }

  async saveFeedAllocation(allocation: FeedAllocation): Promise<void> {
    await this.saveEntity('saveFeedAllocation', allocation, upsertFeedAllocationRow, (snap, fa) => {
      snap.feedAllocations = this.upsertFallbackList(snap.feedAllocations, [fa]);
    });
  }

  async deleteFeedAllocation(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteFeedAllocation',
      (db) => db.run('DELETE FROM feed_allocations WHERE id = ?', [id]),
      (snap) => {
        snap.feedAllocations = (snap.feedAllocations ?? []).filter((fa) => fa.id !== id);
      }
    );
  }

  private mergeFallbackLedgerEntry(entry: LedgerEntry, existing?: LedgerEntry): LedgerEntry {
    return !entry.receiptPhotoDataUrl &&
      entry.receiptPhotoThumbnailDataUrl &&
      existing?.receiptPhotoDataUrl
      ? { ...entry, receiptPhotoDataUrl: existing.receiptPhotoDataUrl }
      : entry;
  }

  async saveLedgerEntry(entry: LedgerEntry): Promise<void> {
    await this.saveEntity('saveLedgerEntry', entry, upsertLedgerEntryRow, (snap, le) => {
      snap.ledgerEntries = this.upsertFallbackList(snap.ledgerEntries, [le], (inc, prev) =>
        this.mergeFallbackLedgerEntry(inc, prev)
      );
    });
  }

  async saveLedgerEntriesBatch(entries: LedgerEntry[]): Promise<void> {
    await this.saveEntityBatch(
      'saveLedgerEntriesBatch',
      entries,
      upsertLedgerEntryRow,
      (snap, items) => {
        snap.ledgerEntries = this.upsertFallbackList(snap.ledgerEntries, items, (inc, prev) =>
          this.mergeFallbackLedgerEntry(inc, prev)
        );
      }
    );
  }

  async deleteLedgerEntry(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteLedgerEntry',
      (db) => db.run('DELETE FROM ledger_entries WHERE id = ?', [id]),
      (snap) => {
        snap.ledgerEntries = (snap.ledgerEntries ?? []).filter((x) => x.id !== id);
      }
    );
  }

  async saveProcessingLog(log: ProcessingLog): Promise<void> {
    await this.saveEntity('saveProcessingLog', log, upsertProcessingLogRow, (snap, pl) => {
      snap.processingLogs = this.upsertFallbackList(snap.processingLogs, [pl]);
    });
  }

  async saveProcessingLogsBatch(logs: ProcessingLog[]): Promise<void> {
    await this.saveEntityBatch(
      'saveProcessingLogsBatch',
      logs,
      upsertProcessingLogRow,
      (snap, items) => {
        snap.processingLogs = this.upsertFallbackList(snap.processingLogs, items);
      }
    );
  }

  async deleteProcessingLog(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteProcessingLog',
      (db) => db.run('DELETE FROM processing_logs WHERE id = ?', [id]),
      (snap) => {
        snap.processingLogs = (snap.processingLogs ?? []).filter((x) => x.id !== id);
      }
    );
  }

  async saveYouthProjectBook(project: YouthProjectBook): Promise<void> {
    await this.saveEntity(
      'saveYouthProjectBook',
      project,
      upsertYouthProjectBookRow,
      (snap, yp) => {
        snap.youthProjectBooks = this.upsertFallbackList(snap.youthProjectBooks, [yp]);
      }
    );
  }

  async saveYouthProjectBooksBatch(projects: YouthProjectBook[]): Promise<void> {
    await this.saveEntityBatch(
      'saveYouthProjectBooksBatch',
      projects,
      upsertYouthProjectBookRow,
      (snap, items) => {
        snap.youthProjectBooks = this.upsertFallbackList(snap.youthProjectBooks, items);
      }
    );
  }

  async deleteYouthProjectBook(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteYouthProjectBook',
      (db) => db.run('DELETE FROM youth_project_books WHERE id = ?', [id]),
      (snap) => {
        snap.youthProjectBooks = (snap.youthProjectBooks ?? []).filter((x) => x.id !== id);
      }
    );
  }

  async saveClientContact(client: ClientContact): Promise<void> {
    await this.saveEntity('saveClientContact', client, upsertClientContactRow, (snap, cc) => {
      snap.clientContacts = this.upsertFallbackList(snap.clientContacts, [cc]);
    });
  }

  async saveClientContactsBatch(clients: ClientContact[]): Promise<void> {
    await this.saveEntityBatch(
      'saveClientContactsBatch',
      clients,
      upsertClientContactRow,
      (snap, items) => {
        snap.clientContacts = this.upsertFallbackList(snap.clientContacts, items);
      }
    );
  }

  async deleteClientContact(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteClientContact',
      (db) => db.run('DELETE FROM client_contacts WHERE id = ?', [id]),
      (snap) => {
        snap.clientContacts = (snap.clientContacts ?? []).filter((x) => x.id !== id);
      }
    );
  }

  async saveWaitlistEntry(entry: WaitlistEntry): Promise<void> {
    await this.saveEntity('saveWaitlistEntry', entry, upsertWaitlistEntryRow, (snap, wl) => {
      snap.waitlistEntries = this.upsertFallbackList(snap.waitlistEntries, [wl]);
    });
  }

  async saveWaitlistEntriesBatch(entries: WaitlistEntry[]): Promise<void> {
    await this.saveEntityBatch(
      'saveWaitlistEntriesBatch',
      entries,
      upsertWaitlistEntryRow,
      (snap, items) => {
        snap.waitlistEntries = this.upsertFallbackList(snap.waitlistEntries, items);
      }
    );
  }

  async deleteWaitlistEntry(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteWaitlistEntry',
      (db) => db.run('DELETE FROM waitlist_entries WHERE id = ?', [id]),
      (snap) => {
        snap.waitlistEntries = (snap.waitlistEntries ?? []).filter((x) => x.id !== id);
      }
    );
  }

  async saveAnimalReservation(reservation: AnimalReservation): Promise<void> {
    await this.saveEntity(
      'saveAnimalReservation',
      reservation,
      upsertAnimalReservationRow,
      (snap, ar) => {
        snap.animalReservations = this.upsertFallbackList(snap.animalReservations, [ar]);
      }
    );
  }

  async saveAnimalReservationsBatch(reservations: AnimalReservation[]): Promise<void> {
    await this.saveEntityBatch(
      'saveAnimalReservationsBatch',
      reservations,
      upsertAnimalReservationRow,
      (snap, items) => {
        snap.animalReservations = this.upsertFallbackList(snap.animalReservations, items);
      }
    );
  }

  async deleteAnimalReservation(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteAnimalReservation',
      (db) => db.run('DELETE FROM animal_reservations WHERE id = ?', [id]),
      (snap) => {
        snap.animalReservations = (snap.animalReservations ?? []).filter((x) => x.id !== id);
      }
    );
  }

  async saveWoolHarvest(harvest: WoolHarvest): Promise<void> {
    await this.saveEntity('saveWoolHarvest', harvest, upsertWoolHarvestRow, (snap, wh) => {
      snap.woolHarvests = this.upsertFallbackList(snap.woolHarvests, [wh]);
    });
  }

  async saveWoolHarvestsBatch(harvests: WoolHarvest[]): Promise<void> {
    await this.saveEntityBatch(
      'saveWoolHarvestsBatch',
      harvests,
      upsertWoolHarvestRow,
      (snap, items) => {
        snap.woolHarvests = this.upsertFallbackList(snap.woolHarvests, items);
      }
    );
  }

  async deleteWoolHarvest(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteWoolHarvest',
      (db) => db.run('DELETE FROM wool_harvests WHERE id = ?', [id]),
      (snap) => {
        snap.woolHarvests = (snap.woolHarvests ?? []).filter((x) => x.id !== id);
      }
    );
  }

  async saveMileageLog(log: MileageLog): Promise<void> {
    await this.saveEntity('saveMileageLog', log, upsertMileageLogRow, (snap, ml) => {
      snap.mileageLogs = this.upsertFallbackList(snap.mileageLogs, [ml]);
    });
  }

  async saveMileageLogsBatch(logs: MileageLog[]): Promise<void> {
    await this.saveEntityBatch('saveMileageLogsBatch', logs, upsertMileageLogRow, (snap, items) => {
      snap.mileageLogs = this.upsertFallbackList(snap.mileageLogs, items);
    });
  }

  async deleteMileageLog(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteMileageLog',
      (db) => db.run('DELETE FROM mileage_logs WHERE id = ?', [id]),
      (snap) => {
        snap.mileageLogs = (snap.mileageLogs ?? []).filter((x) => x.id !== id);
      }
    );
  }

  async saveJournalEntry(entry: BarnJournalEntry): Promise<void> {
    await this.saveEntity('saveJournalEntry', entry, upsertJournalEntryRow, (snap, je) => {
      snap.journalEntries = this.upsertFallbackList(snap.journalEntries, [je]);
    });
  }

  async saveJournalEntriesBatch(entries: BarnJournalEntry[]): Promise<void> {
    await this.saveEntityBatch(
      'saveJournalEntriesBatch',
      entries,
      upsertJournalEntryRow,
      (snap, items) => {
        snap.journalEntries = this.upsertFallbackList(snap.journalEntries, items);
      }
    );
  }

  async deleteJournalEntry(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteJournalEntry',
      (db) => db.run('DELETE FROM journal_entries WHERE id = ?', [id]),
      (snap) => {
        snap.journalEntries = (snap.journalEntries ?? []).filter((x) => x.id !== id);
      }
    );
  }

  async saveJudgeClub(club: JudgeClubContact): Promise<void> {
    await this.saveEntity('saveJudgeClub', club, upsertJudgeClubRow, (snap, jc) => {
      snap.judgeClubs = this.upsertFallbackList(snap.judgeClubs, [jc]);
    });
  }

  async saveJudgeClubsBatch(clubs: JudgeClubContact[]): Promise<void> {
    await this.saveEntityBatch('saveJudgeClubsBatch', clubs, upsertJudgeClubRow, (snap, items) => {
      snap.judgeClubs = this.upsertFallbackList(snap.judgeClubs, items);
    });
  }

  async deleteJudgeClub(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteJudgeClub',
      (db) => db.run('DELETE FROM judge_clubs WHERE id = ?', [id]),
      (snap) => {
        snap.judgeClubs = (snap.judgeClubs ?? []).filter((x) => x.id !== id);
      }
    );
  }

  async saveJudgeAssignment(assignment: JudgeAssignment): Promise<void> {
    await this.saveEntity(
      'saveJudgeAssignment',
      assignment,
      upsertJudgeAssignmentRow,
      (snap, ja) => {
        snap.judgeAssignments = this.upsertFallbackList(snap.judgeAssignments, [ja]);
      }
    );
  }

  async saveJudgeAssignmentsBatch(assignments: JudgeAssignment[]): Promise<void> {
    await this.saveEntityBatch(
      'saveJudgeAssignmentsBatch',
      assignments,
      upsertJudgeAssignmentRow,
      (snap, items) => {
        snap.judgeAssignments = this.upsertFallbackList(snap.judgeAssignments, items);
      }
    );
  }

  async deleteJudgeAssignment(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteJudgeAssignment',
      (db) => db.run('DELETE FROM judge_assignments WHERE id = ?', [id]),
      (snap) => {
        snap.judgeAssignments = (snap.judgeAssignments ?? []).filter((x) => x.id !== id);
      }
    );
  }

  async saveJudgeExpense(expense: JudgeExpense): Promise<void> {
    await this.saveEntity('saveJudgeExpense', expense, upsertJudgeExpenseRow, (snap, jx) => {
      snap.judgeExpenses = this.upsertFallbackList(snap.judgeExpenses, [jx]);
    });
  }

  async saveJudgeExpensesBatch(expenses: JudgeExpense[]): Promise<void> {
    await this.saveEntityBatch(
      'saveJudgeExpensesBatch',
      expenses,
      upsertJudgeExpenseRow,
      (snap, items) => {
        snap.judgeExpenses = this.upsertFallbackList(snap.judgeExpenses, items);
      }
    );
  }

  async deleteJudgeExpense(id: string): Promise<void> {
    await this.deleteEntity(
      'deleteJudgeExpense',
      (db) => db.run('DELETE FROM judge_expenses WHERE id = ?', [id]),
      (snap) => {
        snap.judgeExpenses = (snap.judgeExpenses ?? []).filter((x) => x.id !== id);
      }
    );
  }

  async exportRawSqliteBytes(): Promise<Uint8Array | null> {
    return withCrossTabLock(DB_WRITE_LOCK_NAME, async () => {
      await this.syncFromPersistedStorageIfStaleLocked();
      if (!this.db) return null;
      return this.db.export();
    });
  }

  async inspectRawSqliteBytes(
    bytes: Uint8Array,
    options?: SnapshotLoadOptions
  ): Promise<BarnDatabaseSnapshot> {
    const headerCheck = validateSqliteFileHeader(bytes);
    if (!headerCheck.ok) {
      throw new Error(headerCheck.error);
    }
    if (!this.SQL) {
      this.SQL = await createSqlJsStatic();
    }
    if (!this.SQL) {
      throw new Error('SQLite WebAssembly engine is not available in this browser.');
    }
    const tempDb = new this.SQL.Database(bytes);
    try {
      applySchemaMigrations(tempDb);
      return readSnapshotFromDatabase(tempDb, options, this.snapshotReaderDeps());
    } finally {
      try {
        tempDb.close();
      } catch {
        // Ignore close error on inspection database
      }
    }
  }

  async importRawSqliteBytes(
    bytes: Uint8Array,
    options?: SnapshotLoadOptions
  ): Promise<BarnDatabaseSnapshot> {
    return withCrossTabLock(DB_WRITE_LOCK_NAME, async () => {
      if (!this.SQL) {
        this.SQL = await createSqlJsStatic();
      }
      if (!this.SQL) {
        throw new Error('SQLite WebAssembly engine is not available in this browser.');
      }
      const headerCheck = validateSqliteFileHeader(bytes);
      if (!headerCheck.ok) {
        throw new Error(headerCheck.error);
      }
      const importedDb = new this.SQL.Database(bytes);
      applySchemaMigrations(importedDb);
      if (this.db) {
        try {
          this.db.close();
        } catch {
          // Ignore close error on superseded DB
        }
      }
      this.db = importedDb;
      this.fallbackSnapshot = null;
      await this.persistToDiskLocked(undefined, 'importRawSqliteBytes');
      return this.loadSnapshotUnlocked(options);
    });
  }

  async resetConnection(options?: SnapshotLoadOptions): Promise<BarnDatabaseSnapshot> {
    return withCrossTabLock(DB_WRITE_LOCK_NAME, async () => {
      if (this.db) {
        try {
          this.db.close();
        } catch {
          // Ignore close error on already-closed WASM DB
        }
        this.db = null;
      }
      this.SQL = null;
      this.fallbackSnapshot = null;
      this.loadedEpoch = 0;
      this.ephemeralMode = false;
      if (getSafeIndexedDb()) {
        try {
          await idbDelete(IDB_FALLBACK_SNAPSHOT_KEY);
        } catch {
          // Ignore fallback delete failure
        }
      }
      return this.initializeLocked(options);
    });
  }

  async rebuildCleanDatabase(options?: SnapshotLoadOptions): Promise<BarnDatabaseSnapshot> {
    return withCrossTabLock(DB_WRITE_LOCK_NAME, async () => {
      if (this.db) {
        try {
          this.db.close();
        } catch {
          // Ignore close error
        }
        this.db = null;
      }
      this.SQL = null;
      this.fallbackSnapshot = null;
      this.loadedEpoch = 0;
      this.ephemeralMode = false;
      if (getSafeIndexedDb()) {
        try {
          await idbDelete(IDB_PRIMARY_KEY);
          await idbDelete(IDB_FALLBACK_SNAPSHOT_KEY);
        } catch (err) {
          if (!isIndexedDbBlockedError(err)) {
            throw err;
          }
        }
      }
      return this.initializeLocked({ ...options, allowSeedFresh: options?.allowSeedFresh ?? true });
    });
  }
}
