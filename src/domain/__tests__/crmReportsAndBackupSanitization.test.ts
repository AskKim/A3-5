import { describe, expect, it } from 'vitest';
import type { BarnDatabaseSnapshot } from '../models';
import {
  buildSpeciesZipBackupFileName,
  exportBarnBackupJson,
  generateBlankPedigreeHtml,
  parseBarnBackupJson,
} from '../syncAndExports';
import { generateSpeciesReport } from '../reportGenerators';
import { makeAnimal, makeSettings, makeSpeciesProfile } from './testFixtures';

const TS = '2026-11-01T12:00:00.000Z';
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One messy backup that touches every record family the JSON sanitizer normalizes in a single
 * parse: ledger, processing, youth projects, CRM clients/waitlist/reservations. It is deliberately
 * full of invalid dates, negative numbers, unsafe ids and keyword spellings, because the defaults
 * and clamps are the branches that a clean round-trip never reaches.
 */
function messyBackupJson(): string {
  return JSON.stringify({
    schemaVersion: 5,
    exportedAt: TS,
    settings: makeSettings(),
    speciesProfiles: [makeSpeciesProfile('Rabbit'), makeSpeciesProfile('Goat')],
    animals: [makeAnimal('a1', { species: 'Rabbit', name: 'Willow', sex: 'Female' })],
    ledgerEntries: [
      {
        id: 'le1',
        species: 'Rabbit',
        dateIso: 'not-a-date',
        entryType: 'Revenue',
        category: 'Vet Bill',
        amountCents: -500,
        title: '',
        vendorOrParty: '',
        linkedAnimalId: '__proto__',
        notes: 'note',
      },
    ],
    processingLogs: [
      {
        id: 'pl1',
        species: 'Rabbit',
        title: '',
        status: 'planned',
        animalCount: 0,
        liveWeightGrams: 1000,
        dressedWeightGrams: 550,
        scheduledDateIso: '2026-1-4',
        harvestDateIso: '',
        peltGrade: '1',
        peltCount: -2,
        notes: '',
      },
    ],
    youthProjectBooks: [
      {
        id: 'yp1',
        species: 'Rabbit',
        organization: 'ffa',
        status: 'Completed',
        projectTitle: 'Market Pen',
        startDateIso: '2026-01-01',
        feedLogs: [
          { id: 'f1', dateIso: '2026-01-01', feedType: 'Hay', quantity: 1, costCents: 100 },
          { id: 'f1', dateIso: '2026-02-01', feedType: 'Pellets', quantity: 2, costCents: 200 },
        ],
      },
    ],
    clientContacts: [
      {
        id: 'cc1',
        species: 'Rabbit',
        fullName: 'Ada Lovelace',
        preferredContact: 'text',
        clientKind: 'FFA family',
        phone: '555-0100',
        tags: [' wholesaler ', '', 7],
      },
      { id: 'cc2', species: 'Rabbit', fullName: 'No Contact Info', tags: [] },
    ],
    waitlistEntries: [
      {
        id: 'w1',
        species: 'Rabbit',
        clientId: 'cc1',
        clientName: '',
        priorityRank: 2,
        status: 'waiting',
        intent: 'pet',
        preferredSex: 'Female',
        desiredBreed: 'Rex',
        desiredVariety: 'Castor',
        inquiryDateIso: '2026-05-01',
        followUpDateIso: '2026-01-01',
        requestedByDateIso: 'bad',
        lastContactedDateIso: 'bad',
        maxBudgetCents: 15000,
      },
      {
        id: 'w2',
        species: 'Rabbit',
        clientId: 'missing-client',
        priorityRank: 0,
        status: 'deposited',
        intent: 'meat',
        preferredSex: 'buck',
        inquiryDateIso: '2026-05-02',
        followUpDateIso: '',
        maxBudgetCents: 0,
      },
      {
        id: 'w3',
        species: 'Rabbit',
        status: 'sold',
        inquiryDateIso: '2025-12-31',
      },
      { id: 'w4', species: 'Goat', status: 'waiting', inquiryDateIso: '2026-05-03' },
    ],
    animalReservations: [
      {
        id: 'r1',
        species: 'Rabbit',
        clientName: 'Ada',
        agreementNumber: 'A-1',
        status: 'deposit paid',
        pickOrder: 2,
        reservedDateIso: 'bad',
        holdExpiresDateIso: 'bad',
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
        status: 'cancelled',
        reservedDateIso: '2026-05-12',
        totalPriceCents: 999,
      },
      {
        id: 'r4',
        species: 'Rabbit',
        animalId: 'a1',
        status: 'hold',
        reservedDateIso: '2026-05-13',
        totalPriceCents: 5000,
      },
    ],
  });
}

function parsedMessySnapshot(): BarnDatabaseSnapshot {
  return parseBarnBackupJson(messyBackupJson(), makeSettings());
}

function first<T>(items: readonly T[] | undefined): T {
  const [item] = items ?? [];
  if (!item) throw new Error('missing fixture record');
  return item;
}

describe('parseBarnBackupJson sanitization', () => {
  it('normalizes ledger entries with clamps and safe-id guards', () => {
    const entry = first(parsedMessySnapshot().ledgerEntries);
    expect(entry.entryType).toBe('income');
    expect(entry.category).toBe('vet');
    expect(entry.amountCents).toBe(0);
    expect(entry.title).toBe('Barn Transaction');
    expect(entry.dateIso).toMatch(ISO_DAY);
    expect(entry.linkedAnimalId).toBeUndefined();
  });

  it('derives processing yield percent and repairs impossible counts', () => {
    const log = first(parsedMessySnapshot().processingLogs);
    expect(log.status).toBe('Scheduled');
    expect(log.animalCount).toBe(1);
    expect(log.dressOutPercent).toBe(55);
    expect(log.peltGrade).toBe('No. 1');
    expect(log.peltCount).toBe(0);
    expect(log.scheduledDateIso).toBe('');
  });

  it('normalizes youth books and their feed logs', () => {
    const book = first(parsedMessySnapshot().youthProjectBooks);
    expect(book.organization).toBe('FFA');
    expect(book.status).toBe('Completed');
    expect(book.feedLogs.map((feedLog) => feedLog.id)).toEqual(['f1-2', 'f1']);
    expect(book.feedLogs[0]?.dateIso).toBe('2026-02-01');
  });

  it('normalizes client contacts and drops unsafe tags', () => {
    const client = first(parsedMessySnapshot().clientContacts);
    expect(client.preferredContact).toBe('sms');
    expect(client.clientKind).toBe('youth_4h_ffa');
    expect(client.tags).toEqual(['wholesaler']);
  });

  it('normalizes waitlist defaults and rejects unknown sexes', () => {
    const entries = parsedMessySnapshot().waitlistEntries ?? [];
    const second = first(entries.slice(1));
    expect(second.priorityRank).toBe(1);
    expect(second.preferredSex).toBe('Any');
    expect(second.intent).toBe('Meat / Commercial');
    expect(second.maxBudgetCents).toBeUndefined();
    expect(second.requestedByDateIso).toBe('');

    const firstEntry = first(entries);
    expect(firstEntry.clientName).toBe('Buyer');
    expect(firstEntry.intent).toBe('Pet / Companion');
  });

  it('normalizes reservation status, pick order and date fallbacks', () => {
    const reservation = first(parsedMessySnapshot().animalReservations);
    expect(reservation.status).toBe('Deposit Paid');
    expect(reservation.pickOrder).toBe(2);
    expect(reservation.reservedDateIso).toMatch(ISO_DAY);
    expect(reservation.holdExpiresDateIso).toBe('');
  });

  it('round-trips its own export without losing records', () => {
    const once = parsedMessySnapshot();
    const twice = parseBarnBackupJson(exportBarnBackupJson(once), makeSettings());
    for (const key of [
      'ledgerEntries',
      'processingLogs',
      'youthProjectBooks',
      'clientContacts',
      'waitlistEntries',
      'animalReservations',
    ] as const) {
      expect(twice[key] ?? []).toHaveLength((once[key] ?? []).length);
      expect((twice[key] ?? []).map((record) => record.id)).toEqual(
        (once[key] ?? []).map((record) => record.id)
      );
    }
  });

  it('rejects non-object and unknown roots', () => {
    expect(() => parseBarnBackupJson('[]', makeSettings())).toThrow(/not a valid JSON object/i);
    expect(() => parseBarnBackupJson('{"unrelated":true}', makeSettings())).toThrow(/backup/i);
  });
});

describe('CRM reports over normalized client data', () => {
  const snapshot = parsedMessySnapshot();
  const range = { referenceDateIso: '2026-06-01', dateFromIso: '2026-01-01', dateToIso: '2026-12-31' };
  const metric = (report: ReturnType<typeof generateSpeciesReport>, label: string) =>
    report.summaryMetrics.find((m) => m.label === label)?.value;

  it('builds the waitlist queue for the requested date window only', () => {
    const report = generateSpeciesReport(snapshot, 'Rabbit', 'crm-waitlist-report', range);
    expect(report.rows).toHaveLength(2);
    const ranked = report.rows.find((row) => row.cells.buyer === 'Ada Lovelace');
    const later = report.rows.find((row) => row.cells.buyer === 'Buyer');
    expect(ranked).toBeDefined();
    expect(ranked?.cells.preferences).toContain('Female');
    expect(ranked?.cells.budget).toBe('$150.00');
    expect(ranked?.cells.contact).toContain('555-0100');
    expect(ranked?.highlightTone).toBe('warning');
    expect(later?.cells.contact).toBe('—');
    expect(metric(report, 'Waitlist Entries')).toBe('2');
    expect(metric(report, 'Active / Matched')).toBe('1');
    expect(metric(report, 'Overdue Follow-Ups')).toBe('1');
  });

  it('totals reservations while ignoring cancelled and completed balances', () => {
    const report = generateSpeciesReport(
      snapshot,
      'Rabbit',
      'crm-reservations-deposits-report',
      range
    );
    expect(report.rows).toHaveLength(4);
    expect(metric(report, 'Reservations')).toBe('4');
    expect(metric(report, 'Total Price Value')).toBe('$350.00');
    expect(metric(report, 'Deposits / Payments Collected')).toBe('$120.00');
    expect(metric(report, 'Open Balance Due')).toBe('$230.00');
    expect(metric(report, 'Overdue Deposits')).toBe('1');
  });

  it('applies the audience filter only to animal-linked reservations', () => {
    const female = generateSpeciesReport(snapshot, 'Rabbit', 'crm-reservations-deposits-report', {
      ...range,
      filter: 'Female',
    });
    expect(female.rows).toHaveLength(4);

    const male = generateSpeciesReport(snapshot, 'Rabbit', 'crm-reservations-deposits-report', {
      ...range,
      filter: 'Male',
    });
    expect(male.rows).toHaveLength(3);
    expect(male.rows.every((row) => row.animalId !== 'a1')).toBe(true);
  });
});

describe('species ZIP backup file names', () => {
  it('swaps the JSON extension for a ZIP while keeping the species slug', () => {
    const name = buildSpeciesZipBackupFileName('Meadowbrook', 'Rabbit', 'manual', '2026-11-01');
    expect(name).toMatch(/\.zip$/i);
    expect(name).toContain('rabbit');
    expect(name).not.toMatch(/\.json$/i);
  });
});

describe('generateBlankPedigreeHtml', () => {
  const settings = makeSettings();
  const profile = makeSpeciesProfile('Rabbit');

  it('renders a printable template with the farm header by default', () => {
    const html = generateBlankPedigreeHtml(settings, { generations: 4 }, profile);
    expect(html).toContain('Meadowbrook Rabbitry');
    expect(html.length).toBeGreaterThan(1000);
  });

  it('honours portrait, header suppression and the generation depth', () => {
    const plain = generateBlankPedigreeHtml(
      settings,
      { generations: 3, includeFarmHeader: false, orientation: 'portrait' },
      profile
    );
    expect(plain).not.toContain('Meadowbrook Rabbitry');
    expect(plain).toContain('Doe');
    expect(plain).toContain('Buck');
    const deeper = generateBlankPedigreeHtml(settings, { generations: 6 }, profile);
    expect(deeper.length).toBeGreaterThan(plain.length);
  });
});
