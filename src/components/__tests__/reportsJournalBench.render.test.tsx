// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Mount coverage for three workspace screens that carried zero executable statements: the reports
 * catalog, the personal barn journal and the fast sequential entry bench. Each mounts the real
 * screen against the predefined sample barn so the catalog filters, the journal editor and the
 * bench auto-advance queue actually run.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReportsScreen } from '../ReportsScreen';
import { BarnJournalScreen } from '../BarnJournalScreen';
import { BarnBenchScreen } from '../BarnBenchScreen';
import type { ActiveSpeciesData } from '../../hooks/useBarnStore';
import type { BarnDatabaseSnapshot } from '../../domain/models';
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

/** The catalog and journal filters are `<select>`s without labels, so pick them by their options. */
function selectWithOption(optionText: string): HTMLSelectElement {
  const found = screen
    .getAllByRole('combobox')
    .find((el) =>
      Array.from(el.querySelectorAll('option')).some((opt) => opt.textContent === optionText)
    );
  if (!found) throw new Error(`No select exposes the option ${optionText}`);
  return found as HTMLSelectElement;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ReportsScreen', () => {
  it('lists the report catalog and switches species', () => {
    render(
      <ReportsScreen
        snapshot={snapshot}
        activeSpeciesName={speciesName}
        speciesProfiles={snapshot.speciesProfiles}
      />
    );

    expect(document.body.textContent).toMatch(/28 reports · Unit:/);
    expect(screen.getAllByText('Rabbit Roster Report').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Goat' }));
    expect(document.body.textContent).toMatch(/Goat Only/);
  });

  it('narrows the catalog by category and search text', () => {
    render(
      <ReportsScreen
        snapshot={snapshot}
        activeSpeciesName={speciesName}
        speciesProfiles={snapshot.speciesProfiles}
      />
    );

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Financial' } });
    expect(screen.getByText('Male Income Report')).toBeTruthy();
    expect(screen.queryByText('Kindling Calendar (By ID)')).toBeNull();
  });

  it('opens a report into its printable preview', () => {
    render(
      <ReportsScreen
        snapshot={snapshot}
        activeSpeciesName={speciesName}
        speciesProfiles={snapshot.speciesProfiles}
        onOpenAnimal={vi.fn()}
      />
    );

    fireEvent.click(screen.getAllByText('Rabbit Roster Report')[0]);
    expect(screen.getAllByText(/Roster/).length).toBeGreaterThan(1);
  });
});

describe('BarnJournalScreen', () => {
  it('shows the empty journal state and opens the entry editor', () => {
    render(
      <BarnJournalScreen
        activeData={activeData}
        settings={snapshot.settings}
        onBackToHub={vi.fn()}
        onOpenAnimal={vi.fn()}
        onSaveJournalEntry={vi.fn()}
        onDeleteJournalEntry={vi.fn()}
      />
    );

    expect(screen.getByText(`${speciesName} Personal Barn Journal`)).toBeTruthy();
    expect(screen.getByText(new RegExp(`No ${speciesName.toLowerCase()} personal journal entries yet`))).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'New Journal Entry' }));
    expect(screen.queryByText(new RegExp(`No ${speciesName.toLowerCase()} personal journal entries yet`))).toBeTruthy();
  });

  it('filters the empty journal by rating and category', () => {
    render(
      <BarnJournalScreen
        activeData={activeData}
        settings={snapshot.settings}
        onBackToHub={vi.fn()}
        onOpenAnimal={vi.fn()}
        onSaveJournalEntry={vi.fn()}
        onDeleteJournalEntry={vi.fn()}
      />
    );

    fireEvent.change(selectWithOption('5★ Only'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Breeding & Litters/ }));
    expect(screen.getByText(/0 active months/)).toBeTruthy();
  });
});

describe('BarnBenchScreen', () => {
  it('renders the cage walk queue and advances it through a commit', async () => {
    const onCommitEntry = vi.fn(async () => ({ ok: true, animalId: activeData.animals[0].id, summary: ['Weight 4.8 lb'] }));
    render(
      <BarnBenchScreen
        activeData={activeData}
        settings={snapshot.settings}
        onCommitEntry={onCommitEntry}
        onOpenAnimal={vi.fn()}
        onBackToHub={vi.fn()}
      />
    );

    expect(screen.getByText('Fast Sequential Entry')).toBeTruthy();
    expect(document.body.textContent).toMatch(/0 \/ 5 logged this session/);

    fireEvent.change(screen.getByLabelText(/Weight Check/), { target: { value: '4.8' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & Next Cage/ }));
    expect(onCommitEntry).toHaveBeenCalled();
  });

  it('switches the bench focus mode', () => {
    render(
      <BarnBenchScreen
        activeData={activeData}
        settings={snapshot.settings}
        onCommitEntry={vi.fn()}
        onOpenAnimal={vi.fn()}
        onBackToHub={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'BCS' }));
    expect(screen.getByText(/Body Condition Score/)).toBeTruthy();
  });
});
