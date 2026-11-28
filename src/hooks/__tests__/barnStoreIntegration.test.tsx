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
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Animal } from '../../domain/models';
import { buildFullPredefinedSampleSnapshot } from '../../domain/sampleData';
import { exportBarnBackupJson } from '../../domain/syncAndExports';
import { useBarnStore } from '../useBarnStore';
import { createMemoryStorageAdapter } from './support/memoryStorageAdapter';

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
});
