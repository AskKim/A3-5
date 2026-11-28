/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Reservation sale completion: the four rows that make a sale must be written in one queue slot and
 * the outbox recorded once, or the ledger, animal, waitlist and reservation disagree.
 */
import { describe, expect, it, vi } from 'vitest';
import type { BarnDatabaseSnapshot } from '../../domain/models';
import {
  completeReservationSaleAction,
  type ReservationSaleDeps,
} from '../barnStore/useReservationSale';

const snapshotOf = (over: Record<string, unknown> = {}) =>
  ({
    animalReservations: [
      {
        id: 'res-1',
        _rev: 1,
        species: 'Rabbit',
        status: 'Deposit Paid',
        totalPriceCents: 12000,
        depositPaidCents: 4000,
        agreementNumber: 'AGR-7',
        itemLabel: 'Doe',
        clientName: 'Sam',
        animalId: 'a1',
        waitlistEntryId: 'w1',
        ledgerEntryId: '',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    animals: [{ id: 'a1', species: 'Rabbit', name: 'Doe', status: 'Active', _rev: 1 }],
    waitlistEntries: [{ id: 'w1', _rev: 1, status: 'Waiting', species: 'Rabbit' }],
    settings: {},
    ...over,
  }) as unknown as BarnDatabaseSnapshot;

function makeDeps(over: Partial<ReservationSaleDeps> = {}) {
  const calls: string[] = [];
  const adapter = {
    saveLedgerEntry: vi.fn(async () => void calls.push('ledger')),
    saveAnimal: vi.fn(async () => void calls.push('animal')),
    saveWaitlistEntry: vi.fn(async () => void calls.push('waitlist')),
    saveAnimalReservation: vi.fn(async () => void calls.push('reservation')),
  };
  const deps: ReservationSaleDeps = {
    enqueueStoreMutation: vi.fn(async (task: () => Promise<unknown>) => task()) as unknown as <
      T,
    >(
      task: () => Promise<T>
    ) => Promise<T>,
    snapshotRef: { current: snapshotOf() },
    fallbackSnapshot: null,
    getAdapter: () => adapter,
    deviceId: 'device-1',
    nextEntityRev: vi.fn(() => 2),
    allocateNextLogicalCounter: vi.fn(() => 5),
    nowIsoUtc: () => '2026-11-28T00:00:00.000Z',
    recordOutboxOps: vi.fn(async () => void calls.push('outbox')),
    reloadFromAdapter: vi.fn(async () => void calls.push('reload')),
    notify: vi.fn((message: string) => void calls.push(`notify:${message}`)),
    reportPersistenceFailure: vi.fn(() => void calls.push('failure')),
    ...over,
  };
  return { deps, adapter, calls };
}

describe('completeReservationSaleAction', () => {
  it('writes ledger, animal, waitlist and reservation, then records the outbox once', async () => {
    const { deps, calls } = makeDeps();

    await expect(
      completeReservationSaleAction(deps, { reservationId: 'res-1', recordLedgerIncome: true })
    ).resolves.toBe(true);

    expect(calls.slice(0, 4)).toEqual(['ledger', 'animal', 'waitlist', 'reservation']);
    expect(deps.recordOutboxOps).toHaveBeenCalledTimes(1);
    const recorded = (
      deps.recordOutboxOps as unknown as {
        mock: { calls: [{ entity_type: string }[]][] };
      }
    ).mock.calls[0][0];
    expect(new Set(recorded.map((op) => op.entity_type))).toEqual(
      new Set(['ledgerEntry', 'animal', 'waitlistEntry', 'animalReservation'])
    );
  });

  it('keeps the receipt when the caller opts out of the ledger and animal updates', async () => {
    const { deps, calls } = makeDeps();

    await completeReservationSaleAction(deps, {
      reservationId: 'res-1',
      recordLedgerIncome: false,
      markAnimalSold: false,
    });

    expect(calls.slice(0, 3)).toEqual(['waitlist', 'reservation', 'outbox']);
    expect(deps.notify).toHaveBeenCalledWith('Completed sale for AGR-7 (Sam).');
  });

  it('returns false for an unknown reservation without touching the adapter', async () => {
    const { deps, adapter } = makeDeps();

    await expect(completeReservationSaleAction(deps, { reservationId: 'nope' })).resolves.toBe(
      false
    );
    expect(adapter.saveAnimalReservation).not.toHaveBeenCalled();
    expect(deps.recordOutboxOps).not.toHaveBeenCalled();
  });
});
