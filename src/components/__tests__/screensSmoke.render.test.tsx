// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Tier A mount coverage for the five largest workspace screens. These are the files that had zero
 * executable coverage while they carried the bulk of the app's statements: each mount renders the
 * real screen against the full predefined sample barn, so the tables, summaries and empty-state
 * branches actually run instead of being skipped as unimported modules.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HerdScreen } from '../HerdScreen';
import { SpeciesDashboardScreen } from '../SpeciesDashboardScreen';
import { EconomicsLedgerScreen } from '../EconomicsLedgerScreen';
import { BreedingScreen } from '../BreedingScreen';
import { PedigreeScreen } from '../PedigreeScreen';
import type { ActiveSpeciesData } from '../../hooks/useBarnStore';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import { buildFullPredefinedSampleSnapshot } from '../../domain/sampleData';

function activeDataFrom(snapshot: BarnDatabaseSnapshot, speciesName: string): ActiveSpeciesData {
  const speciesProfile =
    snapshot.speciesProfiles.find((profile) => profile.name === speciesName) ??
    snapshot.speciesProfiles[0];
  const animals = snapshot.animals.filter((animal) => animal.species === speciesProfile.name);
  const activeAnimals = animals.filter((animal) => animal.status !== 'Archived');
  return {
    speciesProfile,
    animals,
    activeAnimals,
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
const settings = snapshot.settings;
const allAnimals = snapshot.animals;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('HerdScreen', () => {
  it('renders the herd against the sample barn and opens an animal editor', async () => {
    render(
      <HerdScreen
        snapshot={snapshot}
        activeData={activeData}
        allAnimals={allAnimals}
        speciesProfiles={snapshot.speciesProfiles}
        settings={settings}
        selectedAnimalId={null}
        onSelectAnimal={vi.fn()}
        onOpenPedigreeForAnimal={vi.fn()}
        onSaveAnimal={vi.fn()}
        onAddAnimalPhotos={vi.fn()}
        onSetPrimaryAnimalPhoto={vi.fn()}
        onUpdateAnimalPhotoCaption={vi.fn()}
        onDeleteAnimalPhoto={vi.fn()}
        onDeleteAnimal={vi.fn()}
        onArchiveAnimals={vi.fn()}
        onDeleteAnimalsBatch={vi.fn()}
        onMigrateAnimalsSpecies={vi.fn()}
        onToggleIncludePhotoOnPedigree={vi.fn()}
        onAddCareLog={vi.fn()}
        onDeleteCareLog={vi.fn()}
        onIgnoreConflicts={vi.fn()}
        onRestoreConflictAlert={vi.fn()}
        onConsumeWithdrawalFocus={vi.fn()}
        onLoadFullPhoto={vi.fn(async () => null)}
        onLoadFullPhotosBatch={vi.fn(async () => ({}))}
        onOffloadAnimalsToOpfsArchive={vi.fn(async () => undefined)}
        onRestoreArchivedHerdBundle={vi.fn(async () => undefined)}
        onDownloadArchivedHerdBundle={vi.fn(async () => undefined)}
        onDeleteArchivedHerdBundle={vi.fn(async () => undefined)}
        onOpenBarnBench={vi.fn()}
        onCompareGrowthForAnimals={vi.fn()}
        onUpdateSettings={vi.fn()}
        onSaveWoolHarvest={vi.fn()}
        onDeleteWoolHarvest={vi.fn()}
        onOpenHealthReference={vi.fn()}
      />
    );
    expect(screen.getAllByRole('button').length).toBeGreaterThan(5);
    expect(activeData.animals.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: `Add ${speciesName}` }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
  });
});

describe('SpeciesDashboardScreen', () => {
  it('renders the species hub with real cages, tasks and summaries', () => {
    render(
      <SpeciesDashboardScreen
        snapshot={snapshot}
        activeData={activeData}
        settings={settings}
        isPinned={false}
        existingSpeciesNames={snapshot.speciesProfiles.map((profile) => profile.name)}
        deviceId="test-device"
        onNavigate={vi.fn()}
        onOpenAnimal={vi.fn()}
        onToggleTask={vi.fn()}
        onCompleteBreedingTask={vi.fn()}
        onRecalculatePostBirthTasks={vi.fn(async () => undefined)}
        onSaveTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onSaveCage={vi.fn()}
        onDeleteCage={vi.fn()}
        onAssignAnimalToCage={vi.fn()}
        onSaveShow={vi.fn()}
        onDeleteShow={vi.fn()}
        onSeedSpeciesSample={vi.fn(async () => undefined)}
        onTogglePinSpecies={vi.fn()}
        onSaveSpecies={vi.fn()}
        onDeleteSpecies={vi.fn()}
        onDeleteSpeciesTestingData={vi.fn(async () => undefined)}
        onDeleteSpeciesNonTestingData={vi.fn(async () => undefined)}
        onDeleteAllSpeciesRecords={vi.fn(async () => undefined)}
        onDownloadTimestampedSpeciesBackup={vi.fn(async () => undefined)}
        onMigrateAnimalsSpecies={vi.fn()}
        onMoveHubBlock={vi.fn()}
        onReorderHubBlocks={vi.fn()}
        onExportTaskToCalendar={vi.fn()}
        onCopyTaskAppLink={vi.fn()}
        onClearHighlightedTask={vi.fn()}
        onClearHighlightedCage={vi.fn()}
        onHideSummaryGrid={vi.fn()}
        onLocateConflicts={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenImportExportHub={vi.fn()}
        onHydrateSnapshotForExport={vi.fn(async () => snapshot)}
        onRescheduleTask={vi.fn()}
        onApplySmartEscalations={vi.fn()}
        onReconcileOutboxOps={vi.fn()}
        onResolveSyncConflict={vi.fn()}
        onDismissSyncConflict={vi.fn()}
        onBuildLocalDeltaJson={vi.fn(() => ({ filename: 'delta.json', content: '{}' }))}
        onOpenHealthReference={vi.fn()}
      />
    );
    expect(screen.getByText(new RegExp(`${speciesName} Barn Hub|${speciesName} Hub`))).toBeTruthy();
  });
});

describe('EconomicsLedgerScreen', () => {
  it('renders the economics workspace with ledger and processing sections', () => {
    render(
      <EconomicsLedgerScreen
        activeData={activeData}
        settings={settings}
        onBackToHub={vi.fn()}
        onOpenAnimal={vi.fn()}
        onSaveLedgerEntry={vi.fn()}
        onDeleteLedgerEntry={vi.fn()}
        onSaveProcessingLog={vi.fn()}
        onDeleteProcessingLog={vi.fn()}
        onSaveYouthProjectBook={vi.fn()}
        onDeleteYouthProjectBook={vi.fn()}
        onSaveMileageLog={vi.fn()}
        onDeleteMileageLog={vi.fn()}
        onLoadFullReceiptPhoto={vi.fn(async () => null)}
      />
    );
    expect(screen.getByText(/Economics, Yields/)).toBeTruthy();
    expect(screen.getByText(/Expense Breakdown by Category/)).toBeTruthy();
  });
});

describe('BreedingScreen', () => {
  it('renders the breeding ledger and its analysis panels', () => {
    render(
      <BreedingScreen
        activeData={activeData}
        settings={settings}
        onLogBreeding={vi.fn()}
        onUpdateOutcome={vi.fn()}
        onRecalculatePostBirthTasks={vi.fn(async () => undefined)}
        onDeleteBreeding={vi.fn()}
        onConsumePreselectedGrowthAnimalIds={vi.fn()}
        onSaveTargetWeightCurve={vi.fn()}
        onUpdateSettings={vi.fn()}
      />
    );
    expect(screen.getByText(/Pairing & Cage-Side Logger/)).toBeTruthy();
    expect(screen.getByText(/Projected Kinship/)).toBeTruthy();
  });
});

describe('PedigreeScreen', () => {
  it('renders the pedigree chart for a real subject', () => {
    const subject = activeData.animals[0];
    render(
      <PedigreeScreen
        activeData={activeData}
        allAnimals={allAnimals}
        speciesProfiles={snapshot.speciesProfiles}
        settings={settings}
        selectedSubjectId={subject.id}
        generations={3}
        onSelectSubject={vi.fn()}
        onChangeGenerations={vi.fn()}
        onOpenAnimalInHerd={vi.fn()}
        onToggleIncludePhotoOnPedigree={vi.fn()}
        onSaveAnimal={vi.fn()}
        onIgnoreConflicts={vi.fn()}
        onRestoreConflictAlert={vi.fn()}
        onLoadFullPhoto={vi.fn(async () => null)}
        onLoadFullPhotosBatch={vi.fn(async () => ({}))}
        onLoadPedigreeNeighborhood={vi.fn(async () => [])}
        onCheckPedigreeBranchesHaveAncestors={vi.fn(async () => ({}))}
        onUpdateBreederLogo={vi.fn()}
      />
    );
    expect(screen.getAllByRole('button').length).toBeGreaterThan(2);
    expect(document.body.textContent).toContain(subject.name);
  });
});
