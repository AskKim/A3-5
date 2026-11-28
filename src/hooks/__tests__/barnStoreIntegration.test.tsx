// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Milestone 7: render-level integration coverage.
 *
 * Per-slice unit tests cannot see the loop that actually breaks — a real React commit runs the
 * store hook, a write lands through the adapter, the snapshot comes back as a new object, the
 * derived selectors and their memo re-run, and a restore replaces the dataset under all of them.
 * These tests drive that loop against the in-memory adapter.
 */
import 'fake-indexeddb/auto';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Animal } from '../../domain/models';
import { buildFullPredefinedSampleSnapshot } from '../../domain/sampleData';
import type { SyncOperation } from '../../domain/syncOutbox';
import { exportBarnBackupJson } from '../../domain/syncAndExports';
import { setOpfsRootResolverForTest } from '../../storage/opfsStorage';
import { createInMemoryOpfsMock } from '../../storage/__tests__/support/inMemoryOpfs';
import { useBarnStore } from '../useBarnStore';
import { createMemoryStorageAdapter } from './support/memoryStorageAdapter';

afterEach(() => {
  // Unmount before jsdom teardown so deferred React work cannot run without a window.
  cleanup();
  setOpfsRootResolverForTest(null);
});

function renderStore() {
  const adapter = createMemoryStorageAdapter(buildFullPredefinedSampleSnapshot());
  const view = renderHook(() => useBarnStore({ storageAdapter: adapter }));
  return { adapter, view };
}

type StoreView = ReturnType<typeof renderStore>['view'];

async function booted(view: StoreView): Promise<void> {
  await waitFor(() => expect(view.result.current.isLoading).toBe(false), { timeout: 10_000 });
  await waitFor(() => expect(view.result.current.snapshot).not.toBeNull(), { timeout: 10_000 });
  // Non-species routes intentionally return empty derived lists, so enter a species workspace.
  await act(async () => {
    view.result.current.setRoute('herd');
  });
}

describe('barn store render loop', () => {
  it('saves an animal through the store and shows it in the derived species list', async () => {
    const { view } = renderStore();
    await booted(view);

    const base = view.result.current.snapshot!.animals[0];
    const draft = { ...base, id: 'render-test-1', name: 'Render Test Ewe' } as Animal;

    await act(async () => {
      await view.result.current.saveAnimal(draft);
    });

    await waitFor(() =>
      expect(view.result.current.snapshot!.animals.some((a) => a.id === 'render-test-1')).toBe(true)
    );
    expect(
      view.result.current.activeSpeciesData?.animals.find((a) => a.id === 'render-test-1')?.name
    ).toBe('Render Test Ewe');
  });

  it('serves the restored rows after a JSON replace import, not the replaced dataset', async () => {
    const { view } = renderStore();
    await booted(view);

    const before = view.result.current.snapshot!;
    const target = before.animals[0];
    const restoredName = `${target.name} (restored)`;
    const restoredSnapshot = {
      ...before,
      animals: before.animals.map((a) => (a.id === target.id ? { ...a, name: restoredName } : a)),
    };

    await act(async () => {
      await view.result.current.importJsonBackup(exportBarnBackupJson(restoredSnapshot), 'replace');
    });

    await waitFor(() =>
      expect(view.result.current.snapshot!.animals.find((a) => a.id === target.id)?.name).toBe(
        restoredName
      )
    );
    // Same id and revision as before the restore: only the dataset-generation flush keeps this fresh.
    expect(
      view.result.current.activeSpeciesData?.animals.find((a) => a.id === target.id)?.name
    ).toBe(restoredName);
  });

  it('offloads an animal into the OPFS archive and reloads the stub-only barn', async () => {
    const mock = createInMemoryOpfsMock();
    setOpfsRootResolverForTest(async () => mock.rootHandle);

    const { view } = renderStore();
    await booted(view);

    const target = view.result.current.snapshot!.animals[0];
    const beforeCount = view.result.current.snapshot!.animals.length;
    let result: Awaited<ReturnType<typeof view.result.current.offloadAnimalsToOpfsArchive>> = null;

    await act(async () => {
      result = await view.result.current.offloadAnimalsToOpfsArchive([target.id]);
    });

    expect(result).not.toBeNull();
    expect(result!.fileName).toBeTruthy();
    expect(result!.archivedCount).toBeGreaterThan(0);
    // Every offloaded animal is either dropped or kept as a pedigree-reference stub.
    expect(result!.stubCount + result!.removedCount).toBe(result!.archivedCount);
    // The bundle landed in /archives.
    expect(mock.rootNode.dirs.get('archives')?.files.size ?? 0).toBeGreaterThan(0);

    await waitFor(() =>
      expect(view.result.current.snapshot!.animals.length).toBe(beforeCount - result!.removedCount)
    );
    const after = view.result.current.snapshot!.animals.find((a) => a.id === target.id);
    if (result!.stubCount > 0) {
      // A stub keeps the pedigree link but leaves the active barn.
      expect(after?.archived).toBe(true);
      expect(after?.status).not.toBe('Active');
    } else {
      expect(after).toBeUndefined();
    }
  });

  it('logs a peer field collision and resolves it through the store', async () => {
    const { view } = renderStore();
    await booted(view);

    const target = view.result.current.snapshot!.animals[0];
    const localName = `${target.name} (local edit)`;
    await act(async () => {
      await view.result.current.saveAnimal({ ...target, name: localName } as Animal);
    });
    await waitFor(() =>
      expect(view.result.current.snapshot!.animals.find((a) => a.id === target.id)?.name).toBe(
        localName
      )
    );

    const peerOp: SyncOperation = {
      op_id: 'peer-name-op',
      entity_type: 'animal',
      entity_uuid: target.id,
      device_id: 'peer-device',
      timestamp: new Date(Date.now() + 60_000).toISOString(),
      logical_counter: 500,
      record_rev: 500,
      field_name: 'name',
      new_value: 'Peer Rename',
    };

    await act(async () => {
      await view.result.current.importDeltaOperations([peerOp]);
    });

    await waitFor(() => expect(view.result.current.syncConflicts.length).toBeGreaterThan(0));
    const conflict = view.result.current.syncConflicts[0];
    expect(conflict.resolved).toBe(false);
    expect(conflict.field_name).toBe('name');

    await act(async () => {
      await view.result.current.resolveSyncConflict(conflict.conflict_id, 'losing');
    });

    await waitFor(() =>
      expect(
        view.result.current.syncConflicts.find((c) => c.conflict_id === conflict.conflict_id)
          ?.resolved
      ).toBe(true)
    );
    // Resolving through the store applies the chosen side and reloads from the adapter.
    expect(view.result.current.snapshot!.animals.find((a) => a.id === target.id)?.name).toBe(
      conflict.losing_value
    );
  });
});
