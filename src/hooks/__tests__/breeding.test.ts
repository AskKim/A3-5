import { describe, expect, it, vi } from 'vitest';
import type { Animal, BarnDatabaseSnapshot, BarnTask, BreedingRecord } from '../../domain/models';
import type { BreedingDeps } from '../barnStore/useBreeding';
import {
  completeBreedingTaskWithOutcomeAction,
  deleteBreedingAction,
  logBreedingAction,
  recalculateBreedingPostBirthTasksAction,
  updateBreedingOutcomeAction,
} from '../barnStore/useBreeding';

const sire = { id: 's1', name: 'Buck', species: 'Rabbit', sex: 'Male', tattoo: 'B1' } as Animal;
const dam = { id: 'd1', name: 'Doe', species: 'Rabbit', sex: 'Female', tattoo: 'D1' } as Animal;

const breeding = (over: Partial<BreedingRecord> = {}): BreedingRecord =>
  ({
    id: 'b1',
    species: 'Rabbit',
    sireId: 's1',
    damId: 'd1',
    sireName: 'Buck',
    damName: 'Doe',
    bredDateIso: '2026-01-01',
    expectedDueDateIso: '2026-01-31',
    actualBirthDateIso: '',
    status: 'Bred',
    notes: '',
    liveCount: 0,
    stillbornCount: 0,
    fosteredCount: 0,
    weanedCount: 0,
    offspringCreated: false,
    _rev: 1,
    ...over,
  }) as BreedingRecord;

const task = (over: Partial<BarnTask> = {}): BarnTask =>
  ({
    id: 't1',
    title: 'Palpate Doe',
    completed: false,
    dueDateIso: '2026-01-15',
    linkedBreedingId: 'b1',
    linkedAnimalIds: [],
    _rev: 1,
    ...over,
  }) as BarnTask;

const snapshotOf = (over: Partial<BarnDatabaseSnapshot> = {}) =>
  ({
    animals: [sire, dam],
    breedings: [breeding()],
    tasks: [],
    speciesProfiles: [],
    settings: { barnName: 'Barn', breederName: 'Kim' },
    ...over,
  }) as unknown as BarnDatabaseSnapshot;

function makeDeps(over: Partial<BarnDatabaseSnapshot> = {}) {
  const snapshot = snapshotOf(over);
  const deps: BreedingDeps = {
    snapshot,
    snapshotRef: { current: snapshot },
    activeSpeciesName: 'Rabbit',
    enqueueStoreMutation: vi.fn(async (fn: () => Promise<unknown>) => fn()) as unknown as <
      T,
    >(
      fn: () => Promise<T>
    ) => Promise<T>,
    adapter: {
      saveAnimalsBatch: vi.fn(async () => undefined),
      saveBreeding: vi.fn(async () => undefined),
      saveTasksBatch: vi.fn(async () => undefined),
      saveTask: vi.fn(async () => undefined),
      deleteTasksBatch: vi.fn(async () => undefined),
      deleteBreeding: vi.fn(async () => undefined),
    },
    deviceId: 'dev-1',
    nextEntityRev: vi.fn((_id: string, rev?: number) => (rev ?? 0) + 1),
    allocateNextLogicalCounter: vi.fn(() => 1),
    nowIsoUtc: vi.fn(() => '2026-01-20T10:00:00.000Z'),
    recordOutboxOps: vi.fn(async () => undefined),
    reloadFromAdapter: vi.fn(async () => undefined),
    notify: vi.fn(),
    reportPersistenceFailure: vi.fn(),
    isOnline: vi.fn(() => false),
    setPendingCalendarSync: vi.fn(),
  };
  return deps;
}

describe('logBreedingAction', () => {
  it('saves the pairing and cascades chores when asked', async () => {
    const deps = makeDeps();

    const ok = await logBreedingAction(deps, {
      sire,
      dam,
      bredDateIso: '2026-02-01',
      status: 'Bred',
      notes: '',
      autoScheduleChores: true,
    });

    expect(ok).toBe(true);
    const saved = (deps.adapter.saveBreeding as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as BreedingRecord;
    expect(saved.expectedDueDateIso > '2026-02-01').toBe(true);
    expect(deps.adapter.saveTasksBatch).toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith(expect.stringContaining('barn chores'));
  });

  it('refuses when neither a sire nor a sire name is supplied', async () => {
    const deps = makeDeps();
    const ok = await logBreedingAction(deps, {
      dam,
      bredDateIso: '2026-02-01',
      status: 'Bred',
      notes: '',
      autoScheduleChores: false,
    });
    expect(ok).toBe(false);
    expect(deps.adapter.saveBreeding).not.toHaveBeenCalled();
  });

  it('quick-adds a missing parent and flags it for attention', async () => {
    const deps = makeDeps();
    const ok = await logBreedingAction(deps, {
      dam,
      quickSireName: '  New Buck  ',
      bredDateIso: '2026-02-01',
      status: 'Bred',
      notes: '',
      autoScheduleChores: false,
    });
    expect(ok).toBe(true);
    const parents = (deps.adapter.saveAnimalsBatch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Animal[];
    expect(parents[0].name).toBe('New Buck');
    expect(parents[0].needsAttention).toBe(true);
    expect(deps.notify).toHaveBeenCalledWith(expect.stringContaining('New Buck'));
  });
});

describe('updateBreedingOutcomeAction', () => {
  it('registers juniors and reports the created count', async () => {
    const deps = makeDeps();
    const ok = await updateBreedingOutcomeAction(deps, breeding(), {
      status: 'Born',
      actualBirthDateIso: '2026-01-30',
      liveCount: 5,
      stillbornCount: 1,
      fosteredCount: 0,
      weanedCount: 0,
      notes: '',
      registerJuniorCount: 2,
    });
    expect(ok).toBe(true);
    const juniors = (deps.adapter.saveAnimalsBatch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Animal[];
    expect(juniors).toHaveLength(2);
    expect(juniors.every((j) => j.status === 'Junior')).toBe(true);
    const saved = (deps.adapter.saveBreeding as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as BreedingRecord;
    expect(saved.offspringCreated).toBe(true);
    expect(saved._rev).toBe(2);
  });

  it('clears pending chores when the breeding is marked missed', async () => {
    const deps = makeDeps({
      tasks: [
        task({ id: 't1', title: 'Palpate Doe', category: 'Palpation' }),
        task({ id: 't2', title: 'Check nestbox', category: 'Nestbox' }),
      ],
    });
    await updateBreedingOutcomeAction(deps, breeding(), {
      status: 'Missed',
      actualBirthDateIso: '',
      liveCount: 0,
      stillbornCount: 0,
      fosteredCount: 0,
      weanedCount: 0,
      notes: '',
      registerJuniorCount: 0,
    });
    expect(deps.adapter.deleteTasksBatch).toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith(expect.stringContaining('cleared'));
  });

  it('reports failure instead of claiming the litter was saved', async () => {
    const deps = makeDeps();
    (deps.adapter.saveBreeding as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('quota')
    );
    const ok = await updateBreedingOutcomeAction(deps, breeding(), {
      status: 'Born',
      actualBirthDateIso: '2026-01-30',
      liveCount: 1,
      stillbornCount: 0,
      fosteredCount: 0,
      weanedCount: 0,
      notes: '',
      registerJuniorCount: 0,
    });
    expect(ok).toBe(false);
    expect(deps.reportPersistenceFailure).toHaveBeenCalledWith('save litter outcome', expect.any(Error));
    expect(deps.notify).not.toHaveBeenCalled();
  });
});

describe('recalculateBreedingPostBirthTasksAction', () => {
  it('refuses to run before a birth date is recorded', async () => {
    const deps = makeDeps({ breedings: [breeding()] });
    const ok = await recalculateBreedingPostBirthTasksAction(deps, 'b1');
    expect(ok).toBe(false);
    expect(deps.notify).toHaveBeenCalledWith(
      'Record an actual birth date before recalculating post-birth chores.'
    );
    expect(deps.adapter.saveTasksBatch).not.toHaveBeenCalled();
  });

  it('says so when chores already match the birth date', async () => {
    const deps = makeDeps({ breedings: [breeding({ actualBirthDateIso: '2026-01-30' })], tasks: [] });
    const ok = await recalculateBreedingPostBirthTasksAction(deps, 'b1');
    expect(ok).toBe(true);
    expect(deps.notify).toHaveBeenCalledWith('Post-birth chores already match the actual birth date.');
  });
});

describe('completeBreedingTaskWithOutcomeAction', () => {
  it('completes an unlinked chore without touching a breeding', async () => {
    const deps = makeDeps();
    const ok = await completeBreedingTaskWithOutcomeAction(
      deps,
      task({ linkedBreedingId: undefined }),
      { kind: 'palpated_positive' }
    );
    expect(ok).toBe(true);
    expect(deps.adapter.saveBreeding).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith('Chore marked complete.');
  });

  it('promotes a positive palpation to Palpated Positive', async () => {
    const deps = makeDeps();
    const ok = await completeBreedingTaskWithOutcomeAction(deps, task(), {
      kind: 'palpated_positive',
    });
    expect(ok).toBe(true);
    const saved = (deps.adapter.saveBreeding as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as BreedingRecord;
    expect(saved.status).toBe('Palpated Positive');
    expect(saved._rev).toBe(2);
  });

  it('records a birth, keeps the completed chore out of the shift set and reports counts', async () => {
    const deps = makeDeps({ tasks: [task()] });
    const ok = await completeBreedingTaskWithOutcomeAction(deps, task(), {
      kind: 'birth_recorded',
      actualBirthDateIso: '2026-01-30',
      liveCount: 4,
      stillbornCount: 0,
    });
    expect(ok).toBe(true);
    const saved = (deps.adapter.saveBreeding as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as BreedingRecord;
    expect(saved.status).toBe('Born');
    expect(saved.actualBirthDateIso).toBe('2026-01-30');
    expect(saved.liveCount).toBe(4);
    expect(deps.notify).toHaveBeenCalledWith(expect.stringContaining('4 live / 0 stillborn for Doe'));
  });
});

describe('deleteBreedingAction', () => {
  it('deletes the record and every chore linked to it', async () => {
    const deps = makeDeps({ tasks: [task({ id: 't1' }), task({ id: 't2' }), task({ id: 't9', linkedBreedingId: undefined })] });
    await deleteBreedingAction(deps, 'b1');
    expect(deps.adapter.deleteBreeding).toHaveBeenCalledWith('b1');
    const ops = (deps.recordOutboxOps as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<{
      entity_type: string;
      entity_uuid: string;
      field_name: string;
    }>;
    const deleted = ops.filter((o) => o.field_name === '__delete__').map((o) => o.entity_uuid);
    expect(deleted.sort()).toEqual(['b1', 't1', 't2']);
    expect(deps.notify).toHaveBeenCalledWith('Breeding & linked chores removed.');
  });

  it('reports a failure instead of toasting success', async () => {
    const deps = makeDeps();
    (deps.adapter.deleteBreeding as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('locked')
    );
    await deleteBreedingAction(deps, 'b1');
    expect(deps.reportPersistenceFailure).toHaveBeenCalledWith(
      'delete breeding record',
      expect.any(Error)
    );
    expect(deps.notify).not.toHaveBeenCalled();
  });
});
