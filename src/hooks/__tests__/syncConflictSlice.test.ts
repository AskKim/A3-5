import { describe, expect, it } from 'vitest';
import type { SyncConflictEntry } from '../../domain/syncOutbox';
import { selectOpenConflicts } from '../barnStore/syncConflictSlice';

const conflict = (id: string, resolved: boolean): SyncConflictEntry =>
  ({ conflict_id: id, resolved }) as SyncConflictEntry;

describe('selectOpenConflicts', () => {
  it('keeps only undecided conflicts', () => {
    const open = selectOpenConflicts([
      conflict('a', false),
      conflict('b', true),
      conflict('c', false),
    ]);
    expect(open.map((c) => c.conflict_id)).toEqual(['a', 'c']);
  });

  it('preserves the log order rather than sorting on its own', () => {
    const log = [conflict('newest', false), conflict('oldest', false)];
    expect(selectOpenConflicts(log).map((c) => c.conflict_id)).toEqual(['newest', 'oldest']);
  });

  it('returns a new array, so callers can filter again without mutating the log', () => {
    const log = [conflict('a', false)];
    const open = selectOpenConflicts(log);
    expect(open).not.toBe(log);
    expect(log[0].resolved).toBe(false);
  });

  it('is empty for an empty log or an all-resolved log', () => {
    expect(selectOpenConflicts([])).toEqual([]);
    expect(selectOpenConflicts([conflict('a', true)])).toEqual([]);
  });
});
