// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Mount coverage for four species workspaces that carried zero executable statements: the memo pad,
 * the wool harvest panel, the mileage/tax panel and the founder & heritability panel. Each mount
 * renders the real component against the predefined sample barn, so the summary maths, empty-state
 * branches and form-open transitions run instead of being skipped as unimported modules.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpeciesMemoScreen } from '../SpeciesMemoScreen';
import { WoolHarvestPanel } from '../WoolHarvestPanel';
import { MileageTaxPanel } from '../MileageTaxPanel';
import { FounderAndHeritabilityPanel } from '../FounderAndHeritabilityPanel';
import type { ActiveSpeciesData } from '../../hooks/useBarnStore';
import type { BarnDatabaseSnapshot, WoolHarvest } from '../../domain/models';
import { buildFullPredefinedSampleSnapshot } from '../../domain/sampleData';

function activeDataFrom(snapshot: BarnDatabaseSnapshot, speciesName: string): ActiveSpeciesData {
  const speciesProfile =
    snapshot.speciesProfiles.find((profile) => profile.name === speciesName) ??
    snapshot.speciesProfiles[0];
  const animals = snapshot.animals.filter((animal) => animal.species === speciesProfile.name);
  return {
    speciesProfile,
    animals,
    activeAnimals: animals.filter((animal) => animal.status !== 'Archived'),
    archivedAnimals: animals.filter((animal) => animal.status === 'Archived'),
    animalPhotos: snapshot.animalPhotos,
    photosByAnimalId: new Map(),
    primaryPhotoByAnimalId: new Map(),
    herdById: new Map(animals.map((animal) => [animal.id, animal])),
    conflictsByAnimalId: new Map(),
    conflictedAnimalCount: 0,
    activeConflictAnimalCount: 0,
    coiByAnimalId: new Map(),
    cages: snapshot.cages.filter((cage) => cage.species === speciesProfile.name),
    breedings: snapshot.breedings.filter((breeding) => breeding.species === speciesProfile.name),
    tasks: snapshot.tasks.filter((task) => task.species === speciesProfile.name),
    careLogs: snapshot.careLogs.filter((log) => log.species === speciesProfile.name),
    shows: snapshot.shows.filter((show) => show.species === speciesProfile.name),
    feedBatches: snapshot.feedBatches,
    feedAllocations: snapshot.feedAllocations,
    ledgerEntries: snapshot.ledgerEntries ?? [],
    processingLogs: snapshot.processingLogs ?? [],
    youthProjectBooks: snapshot.youthProjectBooks ?? [],
    clientContacts: snapshot.clientContacts ?? [],
    waitlistEntries: snapshot.waitlistEntries ?? [],
    animalReservations: snapshot.animalReservations ?? [],
    woolHarvests: snapshot.woolHarvests ?? [],
    mileageLogs: snapshot.mileageLogs ?? [],
    journalEntries: snapshot.journalEntries ?? [],
    judgeClubs: snapshot.judgeClubs ?? [],
    judgeAssignments: snapshot.judgeAssignments ?? [],
    judgeExpenses: snapshot.judgeExpenses ?? [],
    testingRecordCount: 0,
    nonTestingRecordCount: animals.length,
    totalRecordCount: animals.length,
  };
}

const snapshot = buildFullPredefinedSampleSnapshot();
const speciesName = snapshot.speciesProfiles[0].name;
const activeData = activeDataFrom(snapshot, speciesName);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SpeciesMemoScreen', () => {
  it('saves edited notes on blur and clears them through the confirmation gate', () => {
    const onSaveMemo = vi.fn();
    render(
      <SpeciesMemoScreen
        speciesProfile={activeData.speciesProfile}
        onSaveMemo={onSaveMemo}
        onBackToHub={vi.fn()}
      />
    );

    expect(screen.getByText(`${speciesName} Memo Pad`)).toBeTruthy();
    const notes = screen.getByLabelText(`${speciesName} Memo Pad Notes`);
    fireEvent.change(notes, { target: { value: '## Feed plan\n- pellets at dusk' } });
    fireEvent.blur(notes);
    expect(onSaveMemo).toHaveBeenCalledWith(
      activeData.speciesProfile.id,
      expect.stringContaining('Feed plan'),
      { silent: true }
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear Pad' }));
    expect(screen.getByText(new RegExp(`Clear all notes in the ${speciesName} Memo Pad`))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Clear' }));
    expect(onSaveMemo).toHaveBeenCalledWith(activeData.speciesProfile.id, '', { silent: false });
  });

  it('switches a readable note into the formatted preview', () => {
    render(
      <SpeciesMemoScreen
        speciesProfile={{ ...activeData.speciesProfile, memoText: '## Kindling prep\n**Breeder:** Kim' }}
        onSaveMemo={vi.fn()}
        onBackToHub={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Formatted View' }));
    expect(screen.queryByLabelText(`${speciesName} Memo Pad Notes`)).toBeNull();
    expect(screen.getByText('Kindling prep')).toBeTruthy();
    expect(screen.getByText('Breeder:')).toBeTruthy();
  });
});

describe('WoolHarvestPanel', () => {
  it('summarises the fibre record and opens the harvest form', () => {
    const animal = activeData.animals[0];
    const harvest: WoolHarvest = {
      id: 'wool-test-1',
      species: activeData.speciesProfile.name,
      animalId: animal.id,
      harvestDateIso: '2026-04-02',
      shearingIntervalDays: 90,
      primeWeightGrams: 410,
      gradeWeightGrams: 180,
      harvestMethod: 'Shear',
      stapleLengthMm: 92,
      notes: 'Spring clip',
      createdAt: '2026-04-02T09:00:00.000Z',
      updatedAt: '2026-04-02T09:00:00.000Z',
    };
    render(
      <WoolHarvestPanel
        speciesProfile={activeData.speciesProfile}
        animalId={animal.id}
        animalWoolHarvests={[harvest]}
        onSaveWoolHarvest={vi.fn()}
        onDeleteWoolHarvest={vi.fn()}
      />
    );

    expect(screen.getByText('Lifetime Total')).toBeTruthy();
    expect(screen.getByText(/590 g \(1 clip\)/)).toBeTruthy();
    expect(screen.getByText(/≥325g Pass/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Log Wool Harvest/ }));
    expect(screen.getByRole('button', { name: 'Save Harvest' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Save Harvest' })).toBeNull();
  });
});

describe('MileageTaxPanel', () => {
  it('renders the deduction summary and opens then closes the trip modal', () => {
    render(
      <MileageTaxPanel
        activeData={activeData}
        settings={snapshot.settings}
        onSaveMileageLog={vi.fn()}
        onDeleteMileageLog={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Log Business Trip/ }));
    const close = screen.getByRole('button', { name: 'Close mileage modal' });
    expect(close).toBeTruthy();
    fireEvent.click(close);
    expect(screen.queryByRole('button', { name: 'Close mileage modal' })).toBeNull();
  });
});

describe('FounderAndHeritabilityPanel', () => {
  it('renders the heritability trends and switches to the founder-loss ledger', () => {
    render(
      <FounderAndHeritabilityPanel
        mode="pedigree"
        speciesProfile={activeData.speciesProfile}
        animals={activeData.animals}
        herdById={activeData.herdById}
        breedings={activeData.breedings}
        careLogs={activeData.careLogs}
      />
    );

    expect(screen.getAllByText(/Heritability \(h²\) Trends/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Adult \/ Recorded Weight/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Founder-Loss Ledger/ }));
    expect(screen.getByRole('columnheader', { name: 'Pool Status' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Active Desc.' })).toBeTruthy();
  });

  it('renders the breeding view with a selected subject', () => {
    render(
      <FounderAndHeritabilityPanel
        mode="breeding"
        speciesProfile={activeData.speciesProfile}
        animals={activeData.animals}
        herdById={activeData.herdById}
        breedings={activeData.breedings}
        careLogs={activeData.careLogs}
        subject={activeData.animals[0]}
        selectedSire={activeData.animals[1] ?? null}
        selectedDam={activeData.animals[2] ?? null}
      />
    );

    expect(screen.getAllByRole('button', { pressed: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Founder-Loss Ledger/).length).toBeGreaterThan(0);
  });
});
