/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * One write path for the flat barn collections.
 *
 * Every entity the store keeps as a snapshot collection (cages, ledger entries, processing logs,
 * judge contacts, ...) repeated the same six steps by hand: serialise through the write queue, find
 * the previous row, allocate a fresh `_rev`, persist, record the field-level outbox diff, reload and
 * toast. Only the row builder, the adapter method and the copy actually differed, so the order lives
 * here once — and a new collection gets the same queueing, revision and sync guarantees for free.
 *
 * Callers keep the entity-specific pieces: the builder (normalisation/trimming), the adapter method,
 * the toast copy and the failure label. Anything with cross-entity effects (show legs, feed-batch
 * allocations, reservation occupancy) stays in the store until it gets its own controller.
 */
import type { BarnDatabaseSnapshot } from '../../domain/models';
import type { SyncEntityType, SyncOperation } from '../../domain/syncOutbox';
import { createOutboxOperation, diffEntityFieldsToOperations } from '../../domain/syncOutbox';

/** Minimum shape every synced collection row shares. */
export interface SyncableRow {
  id: string;
  _rev?: number;
  createdAt: string;
  updatedAt: string;
}

/** Timestamps and identity the controller allocates before the builder runs. */
export interface EntityRowBase extends SyncableRow {
  /** Always allocated; the builder never has to invent a revision. */
  _rev: number;
}

/** Store capabilities the controller needs; built once per store render. */
export interface EntityCrudPorts {
  snapshotRef: { current: BarnDatabaseSnapshot | null };
  /** Reactive snapshot, used only while the ref has not been filled yet. */
  fallbackSnapshot: () => BarnDatabaseSnapshot | null;
  enqueueStoreMutation: <T>(task: () => Promise<T>) => Promise<T>;
  nextEntityRev: (entityUuid: string, currentRev?: number) => number;
  recordOutboxOps: (ops: SyncOperation[]) => Promise<unknown>;
  reloadFromAdapter: () => Promise<void>;
  notify: (message: string) => void;
  reportPersistenceFailure: (action: string, error: unknown) => void;
  deviceId: string;
  allocateNextLogicalCounter: () => number;
  nowIsoUtc: () => string;
  generateId: () => string;
}

/** Everything a cascade needs to write related rows in the same queue slot. */
export interface EntitySaveCascadeContext<TRow extends SyncableRow> {
  row: TRow;
  prev: TRow | undefined;
  snapshot: BarnDatabaseSnapshot | null;
  /** Timestamp the primary row was stamped with; related rows must share it. */
  timestamp: string;
  /** Collects the operations for the related rows the cascade wrote. */
  ops: SyncOperation[];
}

/** Everything a delete cascade needs; the row may already be gone from the snapshot. */
export interface EntityDeleteCascadeContext<TRow extends SyncableRow> {
  target: TRow | undefined;
  snapshot: BarnDatabaseSnapshot | null;
  timestamp: string;
  ops: SyncOperation[];
}

/** How to persist one collection's rows. */
export interface EntitySaveSpec<TRow extends SyncableRow, TDraft> {
  entityType: SyncEntityType;
  /** Reads the collection out of a snapshot; `snapshot` may be null while booting. */
  readRows: (snapshot: BarnDatabaseSnapshot | null) => TRow[] | undefined;
  /**
   * Builds the row to persist from the caller's draft plus the identity/revisions allocated for it.
   * Return `null` to abort the save (e.g. failed validation), which leaves the store untouched.
   */
  build: (
    draft: TDraft,
    base: EntityRowBase,
    snapshot: BarnDatabaseSnapshot | null,
    prev: TRow | undefined
  ) => TRow | null | Promise<TRow | null>;
  persist: (row: TRow) => Promise<void>;
  /**
   * Related rows written after this one but before the outbox flush (leg counters, stock levels,
   * linked records). Push their operations into `ops` so they ship in the same batch.
   */
  cascade?: (context: EntitySaveCascadeContext<TRow>) => Promise<void>;
  /** Runs after the reload and before the toast; its text is appended to the toast. */
  afterSave?: (context: EntitySaveCascadeContext<TRow>) => Promise<string | undefined>;
  /** Called when `build` returns null, so the caller can explain why nothing was saved. */
  onAborted?: (snapshot: BarnDatabaseSnapshot | null) => void;
  /** Toast copy for a successful save. */
  describe: (row: TRow) => string;
  /** Action label reported when the write throws. */
  failureLabel: (row: TRow) => string;
  /** Fields excluded from the outbox diff (large binary payloads). */
  ignoreFields?: string[];
  /** Replacement row for the outbox diff when a create must not publish a heavy payload. */
  outboxRow?: (row: TRow) => TRow;
}

/** How to delete one collection's rows by id. */
export interface EntityDeleteSpec<TRow extends SyncableRow> {
  entityType: SyncEntityType;
  readRows: (snapshot: BarnDatabaseSnapshot | null) => TRow[] | undefined;
  remove: (id: string) => Promise<void>;
  /** Toast copy for a successful delete; omit when the action stays silent (sync-style writes). */
  message?: string;
  failureLabel: string;
  /** Related rows to remove or rewrite after the tombstone (linked allocations, show legs). */
  cascade?: (context: EntityDeleteCascadeContext<TRow>) => Promise<void>;
}

/**
 * Saves (inserts or updates) one row through the store's serial write queue.
 * Returns the persisted row, or `null` when validation rejected it or the write failed.
 */
export async function saveEntityRecord<TRow extends SyncableRow, TDraft>(
  ports: EntityCrudPorts,
  spec: EntitySaveSpec<TRow, TDraft>,
  draft: TDraft & { id?: string }
): Promise<TRow | null> {
  return ports.enqueueStoreMutation(async () => {
    const latestSnapshot = ports.snapshotRef.current ?? ports.fallbackSnapshot();
    const ts = ports.nowIsoUtc();
    const prev = draft.id
      ? spec.readRows(latestSnapshot)?.find((row) => row.id === draft.id)
      : undefined;
    const id = draft.id || ports.generateId();
    const rev = ports.nextEntityRev(id, prev?._rev);
    const row = await spec.build(
      draft,
      { id, _rev: rev, createdAt: prev?.createdAt || ts, updatedAt: ts },
      latestSnapshot,
      prev
    );
    if (!row) {
      spec.onAborted?.(latestSnapshot);
      return null;
    }
    try {
      await spec.persist(row);
      const context = { row, prev, snapshot: latestSnapshot, timestamp: ts, ops: [] as SyncOperation[] };
      context.ops.push(
        ...diffEntityFieldsToOperations({
          entityType: spec.entityType,
          previous: prev,
          next: prev || !spec.outboxRow ? row : spec.outboxRow(row),
          deviceId: ports.deviceId,
          nextCounter: ports.allocateNextLogicalCounter,
          ignoreFields: spec.ignoreFields,
          timestamp: ts,
          recordRev: rev,
        })
      );
      await spec.cascade?.(context);
      await ports.recordOutboxOps(context.ops);
      await ports.reloadFromAdapter();
      const suffix = await spec.afterSave?.(context);
      ports.notify(suffix ? `${spec.describe(row)} ${suffix}` : spec.describe(row));
      return row;
    } catch (err) {
      ports.reportPersistenceFailure(spec.failureLabel(row), err);
      return null;
    }
  });
}

/** Deletes one row by id and records the tombstone the other devices replay. */
export async function deleteEntityRecord<TRow extends SyncableRow>(
  ports: EntityCrudPorts,
  spec: EntityDeleteSpec<TRow>,
  id: string
): Promise<void> {
  return ports.enqueueStoreMutation(async () => {
    const target = spec.readRows(ports.snapshotRef.current)?.find((row) => row.id === id);
    const ts = ports.nowIsoUtc();
    try {
      await spec.remove(id);
      const context = {
        target,
        snapshot: ports.snapshotRef.current,
        timestamp: ts,
        ops: [
          createOutboxOperation({
            entityType: spec.entityType,
            entityUuid: id,
            deviceId: ports.deviceId,
            logicalCounter: ports.allocateNextLogicalCounter(),
            fieldName: '__delete__',
            newValue: true,
            timestamp: ts,
            recordRev: ports.nextEntityRev(id, target?._rev),
          }),
        ],
      };
      await spec.cascade?.(context);
      await ports.recordOutboxOps(context.ops);
      await ports.reloadFromAdapter();
      if (spec.message) ports.notify(spec.message);
    } catch (err) {
      ports.reportPersistenceFailure(spec.failureLabel, err);
    }
  });
}
