import { describe, expect, it, vi } from 'vitest';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import type { SyncOperation } from '../../domain/syncOutbox';
import {
  deleteEntityRecord,
  saveEntityRecord,
  type EntityCrudPorts,
  type EntityDeleteSpec,
  type EntitySaveSpec,
} from '../barnStore/entityCrudController';

interface Widget {
  id: string;
  _rev?: number;
  createdAt: string;
  updatedAt: string;
  label: string;
  notes?: string;
}

interface WidgetDraft {
  id?: string;
  label: string;
  notes?: string;
}

const TS = '2026-02-01T00:00:00.000Z';

const widgetsOf = (snapshot: BarnDatabaseSnapshot | null): Widget[] | undefined =>
  (snapshot as unknown as { widgets?: Widget[] } | null)?.widgets;

const snapshotWith = (widgets: Widget[]): BarnDatabaseSnapshot =>
  ({ widgets } as unknown as BarnDatabaseSnapshot);

const existingWidget: Widget = {
  id: 'w1',
  _rev: 4,
  createdAt: '2020-01-01T00:00:00.000Z',
  updatedAt: '2020-01-01T00:00:00.000Z',
  label: 'Old',
};

function makePorts(over: Partial<EntityCrudPorts> = {}) {
  const calls: string[] = [];
  const batches: SyncOperation[][] = [];
  const ports: EntityCrudPorts = {
    snapshotRef: { current: null },
    fallbackSnapshot: () => null,
    enqueueStoreMutation: (task) => task(),
    nextEntityRev: (_entityUuid, currentRev) => (currentRev ?? 0) + 1,
    recordOutboxOps: async (ops) => {
      batches.push(ops);
      calls.push(`outbox:${ops.length}`);
    },
    reloadFromAdapter: async () => {
      calls.push('reload');
    },
    notify: (message) => calls.push(`notify:${message}`),
    reportPersistenceFailure: (action) => calls.push(`fail:${action}`),
    deviceId: 'device-1',
    allocateNextLogicalCounter: () => 11,
    nowIsoUtc: () => TS,
    generateId: () => 'generated-id',
    ...over,
  };
  return { ports, calls, batches };
}

const saveSpec = (
  persist: (row: Widget) => Promise<void>,
  over: Partial<EntitySaveSpec<Widget, WidgetDraft>> = {}
): EntitySaveSpec<Widget, WidgetDraft> => ({
  entityType: 'cage',
  readRows: widgetsOf,
  build: (draft, base) => ({ ...base, label: draft.label.trim(), notes: draft.notes }),
  persist,
  describe: (row) => `Saved ${row.label}.`,
  failureLabel: (row) => `save ${row.label}`,
  ...over,
});

const deleteSpec = (
  remove: (id: string) => Promise<void>
): EntityDeleteSpec<Widget> => ({
  entityType: 'cage',
  readRows: widgetsOf,
  remove,
  message: 'Widget removed.',
  failureLabel: 'delete widget',
});

describe('saveEntityRecord', () => {
  it('inserts a new row with allocated identity, revision and timestamps', async () => {
    const persist = vi.fn(async () => {});
    const { ports, calls, batches } = makePorts();

    const row = await saveEntityRecord(ports, saveSpec(persist), { label: '  Barn A  ' });

    expect(row).toEqual({
      id: 'generated-id',
      _rev: 1,
      createdAt: TS,
      updatedAt: TS,
      label: 'Barn A',
      notes: undefined,
    });
    expect(persist).toHaveBeenCalledWith(row);
    expect(calls).toEqual(['outbox:1', 'reload', 'notify:Saved Barn A.']);
    expect(batches[0][0].field_name).toBe('__create__');
    expect(batches[0][0].record_rev).toBe(1);
    expect(batches[0][0].logical_counter).toBe(11);
  });

  it('updates in place: keeps createdAt and bumps the revision above the stored one', async () => {
    const { ports } = makePorts({ snapshotRef: { current: snapshotWith([existingWidget]) } });

    const row = await saveEntityRecord(ports, saveSpec(async () => {}), { id: 'w1', label: 'New' });

    expect(row?._rev).toBe(5);
    expect(row?.createdAt).toBe(existingWidget.createdAt);
    expect(row?.updatedAt).toBe(TS);
    expect(row?.id).toBe('w1');
  });

  it('aborts without writing when the builder rejects the draft', async () => {
    const persist = vi.fn(async () => {});
    const { ports, calls } = makePorts();

    const row = await saveEntityRecord(
      ports,
      saveSpec(persist, { build: () => null }),
      { label: 'nope' }
    );

    expect(row).toBeNull();
    expect(persist).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it('reports the action label and returns null when the write throws', async () => {
    const { ports, calls } = makePorts();

    const row = await saveEntityRecord(
      ports,
      saveSpec(async () => {
        throw new Error('quota exceeded');
      }),
      { label: 'Barn B' }
    );

    expect(row).toBeNull();
    expect(calls).toEqual(['fail:save Barn B']);
  });

  it('runs the whole write inside the serial queue', async () => {
    let inQueue = false;
    const { ports } = makePorts({
      enqueueStoreMutation: async (task) => {
        inQueue = true;
        try {
          return await task();
        } finally {
          inQueue = false;
        }
      },
    });
    const seen: boolean[] = [];

    await saveEntityRecord(
      ports,
      saveSpec(async () => {
        seen.push(inQueue);
      }),
      { label: 'Barn C' }
    );

    expect(seen).toEqual([true]);
  });

  it('drops heavy fields from the create payload and still diffs ordinary edits', async () => {
    const { ports, batches } = makePorts();
    const spec = saveSpec(async () => {}, {
      ignoreFields: ['notes'],
      outboxRow: (row) => ({ ...row, notes: '' }),
    });

    await saveEntityRecord(ports, spec, { label: 'Barn D', notes: 'base64 payload' });

    expect(batches[0][0].new_value).toMatchObject({ label: 'Barn D', notes: '' });
  });

  it('keeps the real row in the diff when the outbox replacement only applies to creates', async () => {
    const { ports, batches } = makePorts({ snapshotRef: { current: snapshotWith([existingWidget]) } });
    const spec = saveSpec(async () => {}, { outboxRow: (row) => ({ ...row, notes: '' }) });

    await saveEntityRecord(ports, spec, { id: 'w1', label: 'Old', notes: 'kept' });

    expect(batches[0].some((op) => op.field_name === 'notes' && op.new_value === 'kept')).toBe(true);
  });
});

describe('deleteEntityRecord', () => {
  it('removes the row and records the tombstone the other devices replay', async () => {
    const remove = vi.fn(async () => {});
    const { ports, calls, batches } = makePorts({
      snapshotRef: { current: snapshotWith([existingWidget]) },
    });

    await deleteEntityRecord(ports, deleteSpec(remove), 'w1');

    expect(remove).toHaveBeenCalledWith('w1');
    expect(calls).toEqual(['outbox:1', 'reload', 'notify:Widget removed.']);
    expect(batches[0][0]).toMatchObject({
      entity_type: 'cage',
      entity_uuid: 'w1',
      field_name: '__delete__',
      record_rev: 5,
      device_id: 'device-1',
    });
  });

  it('records the tombstone even when the row is already gone from the snapshot', async () => {
    const { ports, batches } = makePorts();

    await deleteEntityRecord(ports, deleteSpec(async () => {}), 'ghost');

    expect(batches[0][0].record_rev).toBe(1);
    expect(batches[0][0].entity_uuid).toBe('ghost');
  });

  it('reports the failure and does not reload when the delete throws', async () => {
    const { ports, calls } = makePorts();

    await deleteEntityRecord(
      ports,
      deleteSpec(async () => {
        throw new Error('locked');
      }),
      'w1'
    );

    expect(calls).toEqual(['fail:delete widget']);
  });
});
