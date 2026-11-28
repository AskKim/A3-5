import { describe, expect, it, vi } from 'vitest';
import type { SyncConflictEntry } from '../../domain/syncOutbox';
import {
  buildResolvedSyncConflict,
  dismissSyncConflictAction,
  markSyncConflictResolved,
} from '../barnStore/useSyncConflictDismissal';

const conflict = (over: Partial<SyncConflictEntry> = {}): SyncConflictEntry =>
  ({
    conflict_id: 'c1',
    entity_type: 'animal',
    entity_uuid: 'u1',
    entity_label: 'Doe #12',
    field_name: 'weight',
    winning_value: '4.2',
    losing_value: '3.9',
    resolved: false,
    ...over,
  }) as SyncConflictEntry;

function makeDeps(conflicts: SyncConflictEntry[] = [conflict()]) {
  const calls: string[] = [];
  const setSyncConflicts = vi.fn((update: unknown) => {
    calls.push('setState');
    if (typeof update === 'function') {
      (update as (prev: SyncConflictEntry[]) => SyncConflictEntry[])(conflicts);
    }
  });
  const saveConflict = vi.fn(async () => {
    calls.push('save');
  });
  return { deps: { syncConflicts: conflicts, setSyncConflicts, saveConflict }, calls };
}

describe('buildResolvedSyncConflict', () => {
  it('marks resolved and keeps every other field untouched', () => {
    const original = conflict({ note: 'field clash' } as Partial<SyncConflictEntry>);
    const resolved = buildResolvedSyncConflict(original);

    expect(resolved).toEqual({ ...original, resolved: true, resolved_at: expect.any(String) });
    expect(original.resolved).toBe(false);
  });
});

describe('markSyncConflictResolved', () => {
  it('replaces only the matching conflict', () => {
    const other = conflict({ conflict_id: 'c2', resolved: false });
    const resolved = { ...conflict(), resolved: true };

    const next = markSyncConflictResolved([conflict(), other], resolved);

    expect(next[0].resolved).toBe(true);
    expect(next[1]).toBe(other);
    expect(next).toHaveLength(2);
  });

  it('is a no-op list when the conflict is absent', () => {
    const list = [conflict({ conflict_id: 'c9' })];
    const next = markSyncConflictResolved(list, { ...conflict(), resolved: true });
    expect(next.map((c) => c.conflict_id)).toEqual(['c9']);
    expect(next[0].resolved).toBe(false);
  });
});

describe('dismissSyncConflictAction', () => {
  it('persists the resolved copy before updating the list', async () => {
    const { deps, calls } = makeDeps();

    await expect(dismissSyncConflictAction(deps, 'c1')).resolves.toBeUndefined();

    expect(deps.saveConflict).toHaveBeenCalledWith(expect.objectContaining({ conflict_id: 'c1', resolved: true }));
    expect(deps.setSyncConflicts).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['save', 'setState']);
  });

  it('leaves the barn-data fields alone — dismissal applies no value', async () => {
    const { deps } = makeDeps();
    await dismissSyncConflictAction(deps, 'c1');
    const saved = (deps.saveConflict as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as SyncConflictEntry;
    expect(saved.winning_value).toBe('4.2');
    expect(saved.losing_value).toBe('3.9');
    expect(saved.field_name).toBe('weight');
  });

  it('does nothing for an unknown conflict id', async () => {
    const { deps } = makeDeps();

    await expect(dismissSyncConflictAction(deps, 'missing')).resolves.toBeUndefined();

    expect(deps.saveConflict).not.toHaveBeenCalled();
    expect(deps.setSyncConflicts).not.toHaveBeenCalled();
  });

  it('propagates a write failure to the caller', async () => {
    const { deps } = makeDeps();
    deps.saveConflict = vi.fn(async () => Promise.reject(new Error('idb locked')));

    await expect(dismissSyncConflictAction(deps, 'c1')).rejects.toThrow('idb locked');
    expect(deps.setSyncConflicts).not.toHaveBeenCalled();
  });
});
