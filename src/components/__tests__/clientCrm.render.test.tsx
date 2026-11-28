// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Tier A render coverage for the CRM workspace: reservations, waitlist and client directory render
 * from the real normalized records, and the status filter, search and edit modal actually respond.
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientCrmScreen } from '../ClientCrmScreen';
import type { ActiveSpeciesData } from '../../hooks/useBarnStore';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import { parseBarnBackupJson } from '../../domain/syncAndExports';
import { makeAnimal, makeSettings, makeSpeciesProfile } from '../../domain/__tests__/testFixtures';

const TS = '2026-11-01T12:00:00.000Z';

function crmSnapshot(): BarnDatabaseSnapshot {
  const raw = {
    settings: makeSettings(),
    speciesProfiles: [makeSpeciesProfile('Rabbit')],
    animals: [
      makeAnimal('a1', { species: 'Rabbit', name: 'Willow', sex: 'Female', tattoo: 'W-1' }),
    ],
    clientContacts: [
      {
        id: 'cc1',
        species: 'Rabbit',
        fullName: 'Ada Lovelace',
        preferredContact: 'text',
        clientKind: 'FFA family',
        phone: '555-0100',
        tags: [],
      },
      { id: 'cc2', species: 'Rabbit', fullName: 'No Contact Info', tags: [] },
    ],
    waitlistEntries: [
      {
        id: 'w1',
        species: 'Rabbit',
        clientId: 'cc1',
        priorityRank: 1,
        status: 'waiting',
        intent: 'pet',
        preferredSex: 'Female',
        inquiryDateIso: '2026-05-01',
        followUpDateIso: '2026-01-01',
        maxBudgetCents: 15000,
      },
      {
        id: 'w2',
        species: 'Rabbit',
        clientId: 'cc2',
        priorityRank: 2,
        status: 'deposited',
        intent: 'meat',
        inquiryDateIso: '2026-05-02',
      },
    ],
    animalReservations: [
      {
        id: 'r1',
        species: 'Rabbit',
        clientName: 'Ada',
        agreementNumber: 'A-1',
        status: 'deposit paid',
        reservedDateIso: '2026-05-10',
        totalPriceCents: 20000,
        depositRequiredCents: 5000,
        depositPaidCents: 2000,
        depositDueDateIso: '2026-01-01',
      },
      {
        id: 'r2',
        species: 'Rabbit',
        status: 'completed',
        reservedDateIso: '2026-05-11',
        totalPriceCents: 10000,
        depositPaidCents: 10000,
      },
      {
        id: 'r3',
        species: 'Rabbit',
        clientName: 'Cancelled Buyer',
        status: 'cancelled',
        reservedDateIso: '2026-05-12',
        totalPriceCents: 999,
      },
    ],
  };
  return parseBarnBackupJson(JSON.stringify(raw), makeSettings());
}

function activeDataFrom(snapshot: BarnDatabaseSnapshot): ActiveSpeciesData {
  const animals = snapshot.animals;
  return {
    speciesProfile: snapshot.speciesProfiles[0],
    animals,
    activeAnimals: animals,
    archivedAnimals: [],
    animalPhotos: [],
    photosByAnimalId: new Map(),
    primaryPhotoByAnimalId: new Map(),
    herdById: new Map(animals.map((animal) => [animal.id, animal])),
    conflictsByAnimalId: new Map(),
    conflictedAnimalCount: 0,
    activeConflictAnimalCount: 0,
    coiByAnimalId: new Map(),
    cages: snapshot.cages,
    breedings: snapshot.breedings,
    tasks: snapshot.tasks,
    careLogs: snapshot.careLogs,
    shows: snapshot.shows,
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

function renderCrm(overrides: Partial<ActiveSpeciesData> = {}) {
  const snapshot = crmSnapshot();
  const activeData = { ...activeDataFrom(snapshot), ...overrides };
  const handlers = {
    onBackToHub: vi.fn(),
    onOpenAnimal: vi.fn(),
    onOpenReports: vi.fn(),
    onSaveClient: vi.fn(),
    onDeleteClient: vi.fn(),
    onSaveWaitlistEntry: vi.fn(),
    onDeleteWaitlistEntry: vi.fn(),
    onSaveReservation: vi.fn(),
    onDeleteReservation: vi.fn(),
    onCompleteReservationSale: vi.fn(async () => true),
    onCreateReminderTask: vi.fn(async () => true),
  };
  render(<ClientCrmScreen activeData={activeData} settings={snapshot.settings} {...handlers} />);
  return { activeData, handlers, snapshot };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ClientCrmScreen', () => {
  it('summarises clients, waitlist, reservations and money', () => {
    renderCrm();
    const kpi = within(screen.getByLabelText('CRM KPI summary'));
    expect(kpi.getByText('Clients')).toBeTruthy();
    expect(kpi.getByText('$120.00')).toBeTruthy();
    expect(kpi.getByText('$180.00')).toBeTruthy();
    expect(kpi.getByText('$30.00 deposits pending')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Reservations & Deposits \(3\)/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Buyer Waitlist \(2\)/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Client Directory \(2\)/ })).toBeTruthy();
  });

  it('renders reservation rows and narrows them with the status filter', () => {
    renderCrm();
    expect(screen.getByText('A-1')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Filter reservations by status'), {
      target: { value: 'cancelled' },
    });
    expect(screen.getByText('Cancelled Buyer')).toBeTruthy();
    expect(screen.queryByText('A-1')).toBeNull();
  });

  it('switches to the waitlist and shows the queue', () => {
    renderCrm();
    fireEvent.click(screen.getByRole('tab', { name: /Buyer Waitlist/ }));
    expect(screen.getByRole('tab', { name: /Buyer Waitlist/ }).getAttribute('aria-selected')).toBe(
      'true'
    );
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
  });

  it('filters the client directory by search and opens the edit modal', () => {
    renderCrm();
    fireEvent.click(screen.getByRole('tab', { name: /Client Directory/ }));
    const search = screen.getByLabelText('Search CRM records');
    fireEvent.change(search, { target: { value: 'No Contact' } });
    expect(screen.queryByText('Ada Lovelace')).toBeNull();
    fireEvent.change(search, { target: { value: '' } });

    fireEvent.click(screen.getByLabelText('Edit Ada Lovelace'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Ranch / Herd Name')).toBeTruthy();
    expect(screen.getByLabelText('Close client modal')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Close client modal'));
    expect(screen.queryByLabelText('Close client modal')).toBeNull();
  });

  it('renders an honest empty state when the CRM has no records', () => {
    renderCrm({ clientContacts: [], waitlistEntries: [], animalReservations: [] });
    expect(screen.getByRole('tab', { name: /Reservations & Deposits \(0\)/ })).toBeTruthy();
    expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
  });
});
