import { describe, expect, it, vi } from 'vitest';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import {
  buildDismissedMemoAlertSignatures,
  buildDismissedTaskGroupKeys,
  clearTaskAlertGroupAction,
  dismissSpeciesMemoAlertAction,
  ignoreTaskAlertsPermanentlyAction,
  isEmptyGroupSignature,
  mergeIgnoredTaskIds,
  normalizeAlertSpeciesKey,
  type AlertDismissalDeps,
} from '../barnStore/useAlertDismissals';

function makeDeps(options: { withSnapshot?: boolean; settings?: Record<string, unknown> } = {}) {
  const notify = vi.fn();
  const updateSettingsInternal = vi.fn(async () => {});
  const enqueued: Array<() => Promise<unknown>> = [];
  const snapshot =
    options.withSnapshot === false
      ? null
      : ({
          id: 'snap-1',
          settings: {
            ignoredTaskIds: [],
            dismissedTaskGroupKeys: {},
            dismissedMemoAlertSignatures: {},
            ...(options.settings || {}),
          },
        } as unknown as BarnDatabaseSnapshot);
  const deps: AlertDismissalDeps = {
    enqueueStoreMutation: async (task) => {
      enqueued.push(task);
      return task();
    },
    updateSettingsInternal,
    snapshotRef: { current: snapshot },
    notify,
  };
  return { deps, notify, updateSettingsInternal, enqueued };
}

describe('alert-dismissal merge helpers', () => {
  it('normalises the species key the same way for every map', () => {
    expect(normalizeAlertSpeciesKey('  Rabbit ')).toBe('rabbit');
    expect(buildDismissedTaskGroupKeys({}, ' Rabbit ', 'sig') ).toEqual({ rabbit: 'sig' });
    expect(buildDismissedMemoAlertSignatures({}, ' Rabbit ', 'memo')).toEqual({
      rabbit: 'memo',
    });
  });

  it('dedupes permanently ignored task ids while keeping earlier entries', () => {
    expect(mergeIgnoredTaskIds(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(mergeIgnoredTaskIds(undefined, ['x'])).toEqual(['x']);
  });

  it('treats a blank or empty-array group signature as nothing to record', () => {
    expect(isEmptyGroupSignature('')).toBe(true);
    expect(isEmptyGroupSignature([])).toBe(true);
    expect(isEmptyGroupSignature(['task-1'])).toBe(false);
    expect(buildDismissedTaskGroupKeys({}, 'Rabbit', '')).toBeNull();
    expect(buildDismissedTaskGroupKeys({}, 'Rabbit', [])).toBeNull();
  });

  it('preserves other species when a map is rewritten', () => {
    expect(
      buildDismissedTaskGroupKeys({ goat: 'old' }, 'Rabbit', ['t1', 't2'])
    ).toEqual({ goat: 'old', rabbit: ['t1', 't2'] });
    expect(buildDismissedMemoAlertSignatures({ goat: 'g' }, 'Rabbit', 'r')).toEqual({
      goat: 'g',
      rabbit: 'r',
    });
    expect(buildDismissedMemoAlertSignatures({}, 'Rabbit', '')).toBeNull();
  });
});

describe('ignoreTaskAlertsPermanentlyAction', () => {
  it('merges into settings silently and reports the count', async () => {
    const { deps, notify, updateSettingsInternal } = makeDeps({
      settings: { ignoredTaskIds: ['existing'] },
    });

    await ignoreTaskAlertsPermanentlyAction(deps, ['t1', 't2']);

    expect(updateSettingsInternal).toHaveBeenCalledWith(
      { ignoredTaskIds: ['existing', 't1', 't2'] },
      { silent: true }
    );
    expect(notify).toHaveBeenCalledWith('Dismissed 2 task alert(s) permanently.');
  });

  it('does nothing for an empty id list and never touches the queue', async () => {
    const { deps, notify, enqueued } = makeDeps();

    await ignoreTaskAlertsPermanentlyAction(deps, []);

    expect(enqueued).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('skips persistence before a snapshot exists', async () => {
    const { deps, updateSettingsInternal, notify } = makeDeps({ withSnapshot: false });

    await ignoreTaskAlertsPermanentlyAction(deps, ['t1']);

    expect(updateSettingsInternal).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('clearTaskAlertGroupAction', () => {
  it('stores the signature under the normalised species key', async () => {
    const { deps, notify, updateSettingsInternal } = makeDeps();

    await clearTaskAlertGroupAction(deps, ' Rabbit ', ['sig-1']);

    expect(updateSettingsInternal).toHaveBeenCalledWith(
      { dismissedTaskGroupKeys: { rabbit: ['sig-1'] } },
      { silent: true }
    );
    expect(notify).toHaveBeenCalledWith('Cleared alert for current  Rabbit  overdue tasks.');
  });

  it('returns early for an empty signature', async () => {
    const { deps, notify, enqueued } = makeDeps();

    await clearTaskAlertGroupAction(deps, 'Rabbit', '');
    await clearTaskAlertGroupAction(deps, 'Rabbit', []);

    expect(enqueued).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('dismissSpeciesMemoAlertAction', () => {
  it('stores the memo signature silently without a toast', async () => {
    const { deps, notify, updateSettingsInternal } = makeDeps({
      settings: { dismissedMemoAlertSignatures: { goat: 'older' } },
    });

    await dismissSpeciesMemoAlertAction(deps, 'Rabbit', 'memo-1');

    expect(updateSettingsInternal).toHaveBeenCalledWith(
      { dismissedMemoAlertSignatures: { goat: 'older', rabbit: 'memo-1' } },
      { silent: true }
    );
    expect(notify).not.toHaveBeenCalled();
  });

  it('ignores a blank signature', async () => {
    const { deps, enqueued } = makeDeps();

    await dismissSpeciesMemoAlertAction(deps, 'Rabbit', '');

    expect(enqueued).toHaveLength(0);
  });
});
