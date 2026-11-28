// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Tier A render coverage for the species switch: a real React commit must swap the derived
 * species slice and drop any selection from the previous species, or records leak across hubs.
 */

import 'fake-indexeddb/auto';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { buildFullPredefinedSampleSnapshot } from '../../domain/sampleData';
import { setOpfsRootResolverForTest } from '../../storage/opfsStorage';
import { useBarnStore } from '../useBarnStore';
import { createMemoryStorageAdapter } from './support/memoryStorageAdapter';

afterEach(() => {
  setOpfsRootResolverForTest(null);
});

async function bootStore() {
  const snapshot = buildFullPredefinedSampleSnapshot();
  const adapter = createMemoryStorageAdapter(snapshot);
  const view = renderHook(() => useBarnStore({ storageAdapter: adapter }));
  await waitFor(() => expect(view.result.current.isLoading).toBe(false), { timeout: 10_000 });
  await waitFor(() => expect(view.result.current.snapshot).not.toBeNull(), { timeout: 10_000 });
  return { view, snapshot };
}

describe('species switch', () => {
  it('swaps the active slice and clears the previous selection', async () => {
    const { view, snapshot } = await bootStore();
    const speciesNames = snapshot.speciesProfiles.map((profile) => profile.name);
    expect(speciesNames.length).toBeGreaterThan(1);
    const [first, second] = speciesNames;

    await act(async () => {
      view.result.current.selectSpeciesWorkspace(first);
    });
    await waitFor(() => expect(view.result.current.activeSpeciesName).toBe(first));
    const firstAnimalId = view.result.current.activeSpeciesData?.animals[0]?.id;
    expect(firstAnimalId).toBeTruthy();

    await act(async () => {
      view.result.current.setSelectedAnimalId(firstAnimalId ?? null);
    });
    await waitFor(() => expect(view.result.current.selectedAnimalId).toBe(firstAnimalId));

    await act(async () => {
      view.result.current.selectSpeciesWorkspace(second);
    });

    await waitFor(() => expect(view.result.current.activeSpeciesName).toBe(second));
    expect(view.result.current.selectedAnimalId).toBeNull();
    const animals = view.result.current.activeSpeciesData?.animals ?? [];
    expect(animals.length).toBeGreaterThan(0);
    expect(animals.every((animal) => animal.species === second)).toBe(true);
    expect(animals.some((animal) => animal.id === firstAnimalId)).toBe(false);
  });

  it('returns the original rows when switching back', async () => {
    const { view, snapshot } = await bootStore();
    const [first, second] = snapshot.speciesProfiles.map((profile) => profile.name);

    await act(async () => {
      view.result.current.selectSpeciesWorkspace(second);
    });
    await waitFor(() => expect(view.result.current.activeSpeciesName).toBe(second));

    await act(async () => {
      view.result.current.selectSpeciesWorkspace(first);
    });

    await waitFor(() => expect(view.result.current.activeSpeciesName).toBe(first));
    const animals = view.result.current.activeSpeciesData?.animals ?? [];
    expect(animals.length).toBeGreaterThan(0);
    expect(animals.every((animal) => animal.species === first)).toBe(true);
  });
});
