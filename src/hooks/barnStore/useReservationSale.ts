/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Completes a sale in one go, writing the payment, the animal, the waitlist and the reservation together.
 * PART 2 — FOR AI / DEVELOPERS:
 * Reservation sale completion, extracted from `useBarnStore` as a sub-hook.
 *
 * Completing a sale is one queue slot that may write four entities: the income ledger entry (unless
 * the reservation already has one), the animal's sold status and price, the waitlist entry it came
 * from, and the reservation itself. They must land together — a half-applied sale either books money
 * without an animal or sells an animal without a receipt — so every row is written, its outbox diff
 * collected, and the outbox recorded once at the end.
 *
 * Ownership split: the store owns the adapter, snapshot ref, mutation queue and toast channel; this
 * slice only decides the order and the amounts.
 */
import { useCallback } from 'react';
import type {
  Animal,
  AnimalReservation,
  BarnDatabaseSnapshot,
  LedgerEntry,
  WaitlistEntry,
} from '../../domain/models';
import { generateUuid, todayDateIso } from '../../domain/models';
import { diffEntityFieldsToOperations, type SyncOperation } from '../../domain/syncOutbox';

/** The adapter methods a sale completion uses. */
export interface ReservationSaleAdapter {
  saveLedgerEntry(entry: LedgerEntry): Promise<void>;
  saveAnimal(animal: Animal): Promise<void>;
  saveWaitlistEntry(entry: WaitlistEntry): Promise<void>;
  saveAnimalReservation(reservation: AnimalReservation): Promise<void>;
}

export interface ReservationSaleDeps {
  enqueueStoreMutation: <T>(task: () => Promise<T>) => Promise<T>;
  snapshotRef: { current: BarnDatabaseSnapshot | null };
  /** React-state snapshot; only a fallback for when `snapshotRef.current` is still empty. */
  fallbackSnapshot: BarnDatabaseSnapshot | null;
  getAdapter: () => ReservationSaleAdapter;
  deviceId: string;
  nextEntityRev: (entityUuid: string, currentRev?: number) => number;
  allocateNextLogicalCounter: () => number;
  nowIsoUtc: () => string;
  recordOutboxOps: (operations: SyncOperation[]) => Promise<void>;
  reloadFromAdapter: () => Promise<void>;
  notify: (message: string) => void;
  reportPersistenceFailure: (actionLabel: string, error: unknown) => void;
}

export interface CompleteReservationSaleParams {
  reservationId: string;
  completedDateIso?: string;
  markAnimalSold?: boolean;
  recordLedgerIncome?: boolean;
}

export async function completeReservationSaleAction(
  deps: ReservationSaleDeps,
  params: CompleteReservationSaleParams
): Promise<boolean> {
  return deps.enqueueStoreMutation(async () => {
    const latestSnapshot = deps.snapshotRef.current ?? deps.fallbackSnapshot;
    if (!latestSnapshot) return false;
    const target = (latestSnapshot.animalReservations ?? []).find(
      (r) => r.id === params.reservationId
    );
    if (!target) return false;

    const ts = deps.nowIsoUtc();
    const completedDateIso = (params.completedDateIso || '').trim() || todayDateIso();
    const finalPaidCents = Math.max(target.totalPriceCents, target.depositPaidCents);
    let ledgerEntryId = target.ledgerEntryId;
    const outboxOps: SyncOperation[] = [];

    try {
      if (params.recordLedgerIncome && finalPaidCents > 0 && !ledgerEntryId) {
        const newLedgerId = generateUuid();
        const ledgerRev = deps.nextEntityRev(newLedgerId);
        const ledgerEntry: LedgerEntry = {
          id: newLedgerId,
          species: target.species,
          dateIso: completedDateIso,
          entryType: 'income',
          category: 'animal_sale',
          amountCents: finalPaidCents,
          title: `${target.agreementNumber || 'Sale'} — ${target.itemLabel}`,
          vendorOrParty: target.clientName,
          linkedAnimalId: target.animalId,
          linkedBreedingId: target.breedingId,
          notes: `Completed reservation ${target.agreementNumber || target.id}`,
          _rev: ledgerRev,
          createdAt: ts,
          updatedAt: ts,
        };
        await deps.getAdapter().saveLedgerEntry(ledgerEntry);
        outboxOps.push(
          ...diffEntityFieldsToOperations({
            entityType: 'ledgerEntry',
            previous: undefined,
            next: ledgerEntry,
            deviceId: deps.deviceId,
            nextCounter: deps.allocateNextLogicalCounter,
            timestamp: ts,
            recordRev: ledgerRev,
          })
        );
        ledgerEntryId = newLedgerId;
      }

      if (params.markAnimalSold !== false && target.animalId) {
        const animalPrev = latestSnapshot.animals.find((a) => a.id === target.animalId);
        if (animalPrev) {
          const animalRev = deps.nextEntityRev(animalPrev.id, animalPrev._rev);
          const updatedAnimal: Animal = {
            ...animalPrev,
            status: 'Sold',
            soldDateIso: animalPrev.soldDateIso || completedDateIso,
            salePriceCents: finalPaidCents > 0 ? finalPaidCents : animalPrev.salePriceCents,
            buyerName: target.clientName || animalPrev.buyerName,
            _rev: animalRev,
            updatedAt: ts,
          };
          await deps.getAdapter().saveAnimal(updatedAnimal);
          outboxOps.push(
            ...diffEntityFieldsToOperations({
              entityType: 'animal',
              previous: animalPrev,
              next: updatedAnimal,
              deviceId: deps.deviceId,
              nextCounter: deps.allocateNextLogicalCounter,
              timestamp: ts,
              recordRev: animalRev,
            })
          );
        }
      }

      if (target.waitlistEntryId) {
        const waitPrev = (latestSnapshot.waitlistEntries ?? []).find(
          (w) => w.id === target.waitlistEntryId
        );
        if (waitPrev && waitPrev.status !== 'Fulfilled') {
          const waitRev = deps.nextEntityRev(waitPrev.id, waitPrev._rev);
          const updatedWait: WaitlistEntry = {
            ...waitPrev,
            status: 'Fulfilled',
            _rev: waitRev,
            updatedAt: ts,
          };
          await deps.getAdapter().saveWaitlistEntry(updatedWait);
          outboxOps.push(
            ...diffEntityFieldsToOperations({
              entityType: 'waitlistEntry',
              previous: waitPrev,
              next: updatedWait,
              deviceId: deps.deviceId,
              nextCounter: deps.allocateNextLogicalCounter,
              timestamp: ts,
              recordRev: waitRev,
            })
          );
        }
      }

      const resRev = deps.nextEntityRev(target.id, target._rev);
      const updatedRes: AnimalReservation = {
        ...target,
        status: 'Picked Up / Completed',
        depositPaidCents: finalPaidCents,
        depositPaidDateIso: target.depositPaidDateIso || completedDateIso,
        completedDateIso,
        ledgerEntryId,
        _rev: resRev,
        updatedAt: ts,
      };
      await deps.getAdapter().saveAnimalReservation(updatedRes);
      outboxOps.push(
        ...diffEntityFieldsToOperations({
          entityType: 'animalReservation',
          previous: target,
          next: updatedRes,
          deviceId: deps.deviceId,
          nextCounter: deps.allocateNextLogicalCounter,
          timestamp: ts,
          recordRev: resRev,
        })
      );

      await deps.recordOutboxOps(outboxOps);
      await deps.reloadFromAdapter();
      deps.notify(`Completed sale for ${target.agreementNumber} (${target.clientName}).`);
      return true;
    } catch (err) {
      deps.reportPersistenceFailure(`complete sale ${target.agreementNumber}`, err);
      return false;
    }
  });
}

export function useReservationSale(deps: ReservationSaleDeps) {
  const completeReservationSale = useCallback(
    (params: CompleteReservationSaleParams) => completeReservationSaleAction(deps, params),
    [
      deps.enqueueStoreMutation,
      deps.snapshotRef,
      deps.fallbackSnapshot,
      deps.getAdapter,
      deps.deviceId,
      deps.nextEntityRev,
      deps.allocateNextLogicalCounter,
      deps.nowIsoUtc,
      deps.recordOutboxOps,
      deps.reloadFromAdapter,
      deps.notify,
      deps.reportPersistenceFailure,
    ]
  );

  return { completeReservationSale };
}
