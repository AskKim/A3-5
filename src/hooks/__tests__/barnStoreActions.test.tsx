// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Behavioural coverage for the store's mutation seams. Every action goes through the real hook with
 * the in-memory adapter, so persistence, derived slices and revision stamping run instead of being
 * skipped as untested branches inside the 5,000-line hook.
 */

import 'fake-indexeddb/auto';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { buildFullPredefinedSampleSnapshot } from '../../domain/sampleData';
import { parseBarnBackupJson } from '../../domain/syncAndExports';
import { setOpfsRootResolverForTest } from '../../storage/opfsStorage';
import { useBarnStore } from '../useBarnStore';
import { createMemoryStorageAdapter } from './support/memoryStorageAdapter';
import { makeSettings } from '../../domain/__tests__/testFixtures';
import type { BarnDatabaseSnapshot } from '../../domain/models';

type Timestamped = { id: string; createdAt: string; updatedAt: string };

function first<T>(items: readonly T[] | undefined): T {
  const [item] = items ?? [];
  if (!item) throw new Error('missing fixture seed');
  return item;
}

function draftOf<T extends Timestamped>(seed: T): Omit<T, 'id' | 'createdAt' | 'updatedAt'> {
  const clone = structuredClone(seed) as Partial<T>;
  delete clone.id;
  delete clone.createdAt;
  delete clone.updatedAt;
  return clone as Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
}

function crmSeed(): BarnDatabaseSnapshot {
  const raw = {
    settings: makeSettings(),
    speciesProfiles: [],
    ledgerEntries: [
      {
        id: 'ledger-seed',
        species: 'Rabbit',
        dateIso: '2026-05-01',
        entryType: 'expense',
        category: 'feed',
        amountCents: 1200,
        title: 'Pellets',
      },
    ],
    clientContacts: [{ id: 'client-seed', species: 'Rabbit', fullName: 'Ada Lovelace' }],
    waitlistEntries: [{ id: 'waitlist-seed', species: 'Rabbit', clientName: 'Ada Lovelace' }],
    animalReservations: [{ id: 'reservation-seed', species: 'Rabbit', status: 'hold' }],
  };
  return parseBarnBackupJson(JSON.stringify(raw), makeSettings());
}

async function bootStore() {
  const sample = buildFullPredefinedSampleSnapshot();
  const crm = crmSeed();
  const snapshot: BarnDatabaseSnapshot = {
    ...sample,
    ledgerEntries: crm.ledgerEntries,
    clientContacts: crm.clientContacts,
    waitlistEntries: crm.waitlistEntries,
    animalReservations: crm.animalReservations,
  };
  const adapter = createMemoryStorageAdapter(snapshot);
  const view = renderHook(() => useBarnStore({ storageAdapter: adapter }));
  await waitFor(() => expect(view.result.current.isLoading).toBe(false), { timeout: 10_000 });
  await waitFor(() => expect(view.result.current.snapshot).not.toBeNull(), { timeout: 10_000 });
  return { view, snapshot };
}

afterEach(() => {
  // Unmount before jsdom teardown so deferred React work cannot run without a window.
  cleanup();
  setOpfsRootResolverForTest(null);
});

describe('barn store mutations', () => {
  it('saves, completes and deletes husbandry records', async () => {
    const { view, snapshot } = await bootStore();
    const api = () => view.result.current;

    await act(async () => {
      await api().saveCage({ ...draftOf(snapshot.cages[0]), id: 'cage-test', label: 'Test Cage' });
    });
    await waitFor(() => expect(api().snapshot!.cages.some((c) => c.id === 'cage-test')).toBe(true));

    const taskSeed = snapshot.tasks[0];
    await act(async () => {
      await api().saveTask({ ...draftOf(taskSeed), id: 'task-test', title: 'Test Task' });
    });
    await waitFor(() => expect(api().snapshot!.tasks.some((t) => t.id === 'task-test')).toBe(true));

    const savedTask = api().snapshot!.tasks.find((t) => t.id === 'task-test');
    expect(savedTask).toBeDefined();
    await act(async () => {
      await api().toggleTaskCompleted(savedTask!);
    });
    await waitFor(() =>
      expect(api().snapshot!.tasks.find((t) => t.id === 'task-test')?.completed).toBe(true)
    );

    await act(async () => {
      await api().addCareLog(draftOf(snapshot.careLogs[0]));
    });
    expect(api().snapshot!.careLogs.length).toBe(snapshot.careLogs.length + 1);

    await act(async () => {
      await api().deleteCage('cage-test');
    });
    await waitFor(() => expect(api().snapshot!.cages.some((c) => c.id === 'cage-test')).toBe(false));
  });

  it('saves and deletes CRM and ledger records', async () => {
    const { view, snapshot } = await bootStore();
    const api = () => view.result.current;

    await act(async () => {
      await api().saveLedgerEntry({
        ...draftOf(first(snapshot.ledgerEntries)),
        id: 'ledger-test',
        title: 'Feed Run',
      });
    });
    await waitFor(() =>
      expect(
        (api().snapshot!.ledgerEntries ?? []).some((entry) => entry.id === 'ledger-test')
      ).toBe(true)
    );

    await act(async () => {
      await api().saveClientContact({
        ...draftOf(first(snapshot.clientContacts)),
        id: 'client-test',
        fullName: 'Grace Hopper',
      });
    });
    await waitFor(() =>
      expect(        (api().snapshot!.clientContacts ?? []).some((client) => client.id === 'client-test')).toBe(true)
    );

    await act(async () => {
      await api().saveWaitlistEntry({
        ...draftOf(first(snapshot.waitlistEntries)),
        id: 'waitlist-test',
        clientName: 'Grace Hopper',
      });
    });
    await waitFor(() =>
      expect(
        (api().snapshot!.waitlistEntries ?? []).some((entry) => entry.id === 'waitlist-test')
      ).toBe(true)
    );

    await act(async () => {
      await api().saveAnimalReservation({
        ...draftOf(first(snapshot.animalReservations)),
        id: 'reservation-test',
        clientName: 'Grace Hopper',
      });
    });
    await waitFor(() =>
      expect(
        (api().snapshot!.animalReservations ?? []).some(
          (entry) => entry.id === 'reservation-test'
        )
      ).toBe(true)
    );

    await act(async () => {
      await api().deleteLedgerEntry('ledger-test');
      await api().deleteClientContact('client-test');
      await api().deleteWaitlistEntry('waitlist-test');
      await api().deleteAnimalReservation('reservation-test');
    });
    await waitFor(() =>
      expect((api().snapshot!.ledgerEntries ?? []).every((e) => e.id !== 'ledger-test')).toBe(
        true
      )
    );
    expect((api().snapshot!.clientContacts ?? []).every((c) => c.id !== 'client-test')).toBe(true);
    expect((api().snapshot!.waitlistEntries ?? []).every((w) => w.id !== 'waitlist-test')).toBe(
      true
    );
    expect(
      (api().snapshot!.animalReservations ?? []).every((r) => r.id !== 'reservation-test')
    ).toBe(true);
  });

  it('updates settings, pins a landing species and reorders hub blocks', async () => {
    const { view, snapshot } = await bootStore();
    const api = () => view.result.current;
    const species = snapshot.speciesProfiles[0].name;

    await act(async () => {
      await api().updateSettings({ barnName: 'Renamed Barn', includePhotoOnPedigree: true });
    });
    await waitFor(() => expect(api().snapshot!.settings.barnName).toBe('Renamed Barn'));
    expect(api().snapshot!.settings.includePhotoOnPedigree).toBe(true);

    await act(async () => {
      await api().togglePinSpeciesLanding(species);
    });
    await waitFor(() => expect(api().snapshot!.settings.pinnedLandingSpecies).toBe(species));

    await act(async () => {
      await api().moveSpeciesHubBlock(species, 'feed', 'top');
    });
    await waitFor(() => {
      const order = api().snapshot!.settings.speciesHubBlockOrder?.[species.toLowerCase()];
      expect(order?.[0]).toBe('feed');
      expect(order).toHaveLength(5);
    });
  });
});
