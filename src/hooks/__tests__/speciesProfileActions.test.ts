/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Species profile save, now that it lives in its own slice: an ordinary save touches one row, a
 * rename has to carry every species-addressed record with it, and a persistence failure is reported
 * without throwing into the caller.
 */
import { describe, expect, it, vi } from 'vitest';
import type { BarnDatabaseSnapshot, SpeciesProfile } from '../../domain/models';
import {
  saveSpeciesProfileAction,
  type SpeciesProfileDeps,
} from '../barnStore/useSpeciesProfileActions';

const profile = (over: Partial<SpeciesProfile> = {}): SpeciesProfile =>
  ({
    id: 'species-rabbit',
    name: 'Rabbit',
    defaultAnimalPrefix: 'R',
    sortOrder: 0,
    breedOverrides: [],
    targetWeightCurve: [],
    memoText: '',
    memoUpdatedAt: '',
    _rev: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }) as SpeciesProfile;

const snapshotOf = (profiles: SpeciesProfile[]) =>
  ({
    speciesProfiles: profiles,
    animals: [
      { id: 'a1', species: 'Rabbit', name: 'Doe', _rev: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
    ],
    animalPhotos: [],
    cages: [],
    breedings: [],
    tasks: [],
    careLogs: [],
    shows: [],
    settings: {
      defaultSpecies: 'Rabbit',
      pinnedLandingSpecies: 'Rabbit',
      dismissedTaskGroupKeys: { rabbit: 'dismissed' },
      dismissedMemoAlertSignatures: {},
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  }) as unknown as BarnDatabaseSnapshot;

function makeDeps(over: Partial<SpeciesProfileDeps> = {}) {
  const calls: string[] = [];
  const deps: SpeciesProfileDeps = {
    enqueueStoreMutation: vi.fn(async (task: () => Promise<unknown>) => task()) as unknown as <
      T,
    >(
      task: () => Promise<T>
    ) => Promise<T>,
    snapshotRef: { current: snapshotOf([profile()]) },
    getAdapter: () => ({
      saveSpeciesProfile: vi.fn(async () => {
        calls.push('saveProfile');
      }),
      replaceSnapshot: vi.fn(async () => {
        calls.push('replaceSnapshot');
      }),
    }),
    deviceId: 'device-1',
    nextEntityRev: vi.fn(() => 2),
    allocateNextLogicalCounter: vi.fn(() => 7),
    nowIsoUtc: () => '2026-11-28T00:00:00.000Z',
    recordOutboxOps: vi.fn(async () => {
      calls.push('outbox');
    }),
    reloadFromAdapter: vi.fn(async () => {
      calls.push('reload');
    }),
    notify: vi.fn((message: string) => {
      calls.push(`notify:${message}`);
    }),
    reportPersistenceFailure: vi.fn(() => {
      calls.push('reportFailure');
    }),
    activeSpeciesName: 'Rabbit',
    setActiveSpeciesName: vi.fn(),
    ...over,
  };
  return { deps, calls };
}

describe('saveSpeciesProfileAction', () => {
  it('saves an existing profile row and queues its outbox diff', async () => {
    const { deps, calls } = makeDeps();

    await expect(saveSpeciesProfileAction(deps, profile({ name: '  Rabbit  ' }))).resolves.toBe(
      true
    );

    expect(calls).toEqual(['saveProfile', 'outbox', 'reload', 'notify:Rabbit schedule saved.']);
    expect(deps.notify).toHaveBeenCalledTimes(1);
  });

  it('carries every species-addressed record across a rename in one snapshot replace', async () => {
    const { deps } = makeDeps();
    const replaceSnapshot = vi.fn(async () => {});
    const setActiveSpeciesName = vi.fn();
    deps.getAdapter = () => ({ saveSpeciesProfile: vi.fn(), replaceSnapshot });
    deps.setActiveSpeciesName = setActiveSpeciesName;

    await saveSpeciesProfileAction(deps, profile({ name: 'Rabbits' }));

    const renamed = (replaceSnapshot.mock.calls[0] as unknown as [BarnDatabaseSnapshot])[0];
    expect(renamed.animals[0].species).toBe('Rabbits');
    expect(renamed.settings.defaultSpecies).toBe('Rabbits');
    expect(renamed.settings.pinnedLandingSpecies).toBe('Rabbits');
    expect(renamed.settings.dismissedTaskGroupKeys).toEqual({ rabbits: 'dismissed' });
    expect(setActiveSpeciesName).toHaveBeenCalledWith('Rabbits');
  });

  it('adds a new profile at the end of the list with a generated id', async () => {
    const { deps } = makeDeps();
    const saveSpeciesProfile = vi.fn(async () => {});
    deps.getAdapter = () => ({ saveSpeciesProfile, replaceSnapshot: vi.fn() });

    await saveSpeciesProfileAction(deps, profile({ id: '', name: 'Goat' }));

    const saved = (saveSpeciesProfile.mock.calls[0] as unknown as [SpeciesProfile])[0];
    expect(saved.id).toMatch(/^species-/);
    expect(saved.sortOrder).toBe(1);
    expect(deps.notify).toHaveBeenCalledWith('Goat added to your barn.');
  });

  it('reports a persistence failure instead of throwing', async () => {
    const { deps, calls } = makeDeps();
    deps.getAdapter = () => ({
      saveSpeciesProfile: vi.fn(async () => {
        throw new Error('quota');
      }),
      replaceSnapshot: vi.fn(),
    });

    await expect(saveSpeciesProfileAction(deps, profile({ name: 'Rabbit' }))).resolves.toBe(false);
    expect(calls).toContain('reportFailure');
  });
});
