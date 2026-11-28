/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Saves a species profile, moving every record that carries the species name along with it.
 * PART 2 — FOR AI / DEVELOPERS:
 * Species profile save, extracted from `useBarnStore` as a sub-hook.
 *
 * One write carries more than one row: renaming a species has to move its animals, photos, cages,
 * breedings, tasks, care logs, shows, feed, ledger, processing, youth, client, waitlist,
 * reservation, wool, mileage, journal and judge records onto the new name, and re-key the
 * dismissed-task / dismissed-memo settings that are addressed by lower-cased species name. Doing
 * that in one transaction (one full snapshot replace) is the invariant this slice protects; an
 * ordinary save only bumps the profile row and writes its outbox diff.
 *
 * Ownership split: the store owns the adapter, snapshot ref, mutation queue and toast channel; this
 * slice receives them as narrow functions and decides only the write order.
 */
import { useCallback } from 'react';
import type { BarnDatabaseSnapshot, SpeciesProfile } from '../../domain/models';
import {
  generateUuid,
  isSameSpecies,
  normalizeBreedScheduleOverrides,
  normalizeTargetWeightCurve,
} from '../../domain/models';
import { sanitizeSpeciesMemo } from '../../domain/speciesMemo';
import { diffEntityFieldsToOperations, type SyncOperation } from '../../domain/syncOutbox';

/** The adapter methods a species save uses. */
export interface SpeciesProfileAdapter {
  saveSpeciesProfile(profile: SpeciesProfile): Promise<void>;
  replaceSnapshot(snapshot: BarnDatabaseSnapshot): Promise<void>;
}

export interface SpeciesProfileDeps {
  enqueueStoreMutation: <T>(task: () => Promise<T>) => Promise<T>;
  snapshotRef: { current: BarnDatabaseSnapshot | null };
  /** Resolved lazily: the adapter ref is still empty while the store boots. */
  getAdapter: () => SpeciesProfileAdapter;
  deviceId: string;
  nextEntityRev: (entityUuid: string, currentRev?: number) => number;
  allocateNextLogicalCounter: () => number;
  nowIsoUtc: () => string;
  recordOutboxOps: (operations: SyncOperation[]) => Promise<void>;
  reloadFromAdapter: () => Promise<void>;
  notify: (message: string) => void;
  reportPersistenceFailure: (actionLabel: string, error: unknown) => void;
  activeSpeciesName: string;
  setActiveSpeciesName: (name: string) => void;
}

export async function saveSpeciesProfileAction(
  deps: SpeciesProfileDeps,
  profile: SpeciesProfile
): Promise<boolean> {
  return deps.enqueueStoreMutation(async () => {
    const currentSnapshot = deps.snapshotRef.current;
    const ts = deps.nowIsoUtc();
    const existing = currentSnapshot?.speciesProfiles.find((sp) => sp.id === profile.id);
    try {
      if (existing) {
        const rev = deps.nextEntityRev(existing.id, existing._rev);
        const clean: SpeciesProfile = {
          ...profile,
          sortOrder: profile.sortOrder ?? existing.sortOrder ?? 0,
          name: profile.name.trim(),
          defaultAnimalPrefix: (profile.defaultAnimalPrefix || '').trim(),
          memoText: sanitizeSpeciesMemo(profile.memoText ?? existing.memoText ?? ''),
          memoUpdatedAt: profile.memoUpdatedAt ?? existing.memoUpdatedAt ?? '',
          breedOverrides: normalizeBreedScheduleOverrides(profile.breedOverrides),
          targetWeightCurve: normalizeTargetWeightCurve(
            profile.targetWeightCurve ?? existing.targetWeightCurve
          ),
          _rev: rev,
          createdAt: profile.createdAt || existing.createdAt || ts,
          updatedAt: ts,
        };

        const renamed =
          currentSnapshot && !isSameSpecies(existing.name, clean.name);
        if (renamed && currentSnapshot) {
          const oldName = existing.name;
          const newName = clean.name;
          const oldKey = oldName.trim().toLowerCase();
          const newKey = newName.trim().toLowerCase();

          const nextDismissedTaskGroups = {
            ...(currentSnapshot.settings.dismissedTaskGroupKeys || {}),
          };
          if (oldKey in nextDismissedTaskGroups) {
            nextDismissedTaskGroups[newKey] = nextDismissedTaskGroups[oldKey];
            delete nextDismissedTaskGroups[oldKey];
          }
          const nextDismissedMemos = {
            ...(currentSnapshot.settings.dismissedMemoAlertSignatures || {}),
          };
          if (oldKey in nextDismissedMemos) {
            nextDismissedMemos[newKey] = nextDismissedMemos[oldKey];
            delete nextDismissedMemos[oldKey];
          }

          const renamedSnapshot: BarnDatabaseSnapshot = {
            ...currentSnapshot,
            settings: {
              ...currentSnapshot.settings,
              defaultSpecies: isSameSpecies(currentSnapshot.settings.defaultSpecies, oldName)
                ? newName
                : currentSnapshot.settings.defaultSpecies,
              pinnedLandingSpecies: isSameSpecies(
                currentSnapshot.settings.pinnedLandingSpecies,
                oldName
              )
                ? newName
                : currentSnapshot.settings.pinnedLandingSpecies,
              dismissedTaskGroupKeys: nextDismissedTaskGroups,
              dismissedMemoAlertSignatures: nextDismissedMemos,
              updatedAt: ts,
            },
            speciesProfiles: currentSnapshot.speciesProfiles.map((sp) =>
              sp.id === clean.id ? clean : sp
            ),
            animals: currentSnapshot.animals.map((a) =>
              isSameSpecies(a.species, oldName) ? { ...a, species: newName, updatedAt: ts } : a
            ),
            animalPhotos: (currentSnapshot.animalPhotos ?? []).map((p) =>
              isSameSpecies(p.species, oldName) ? { ...p, species: newName, updatedAt: ts } : p
            ),
            cages: currentSnapshot.cages.map((c) =>
              isSameSpecies(c.species, oldName) ? { ...c, species: newName, updatedAt: ts } : c
            ),
            breedings: currentSnapshot.breedings.map((b) =>
              isSameSpecies(b.species, oldName) ? { ...b, species: newName, updatedAt: ts } : b
            ),
            tasks: currentSnapshot.tasks.map((t) =>
              isSameSpecies(t.species, oldName) ? { ...t, species: newName, updatedAt: ts } : t
            ),
            careLogs: currentSnapshot.careLogs.map((l) =>
              isSameSpecies(l.species, oldName) ? { ...l, species: newName, updatedAt: ts } : l
            ),
            shows: currentSnapshot.shows.map((s) =>
              isSameSpecies(s.species, oldName) ? { ...s, species: newName, updatedAt: ts } : s
            ),
            feedBatches: (currentSnapshot.feedBatches ?? []).map((fb) =>
              isSameSpecies(fb.species, oldName) ? { ...fb, species: newName, updatedAt: ts } : fb
            ),
            feedAllocations: (currentSnapshot.feedAllocations ?? []).map((fa) =>
              isSameSpecies(fa.species, oldName) ? { ...fa, species: newName, updatedAt: ts } : fa
            ),
            ledgerEntries: (currentSnapshot.ledgerEntries ?? []).map((le) =>
              isSameSpecies(le.species, oldName) ? { ...le, species: newName, updatedAt: ts } : le
            ),
            processingLogs: (currentSnapshot.processingLogs ?? []).map((pl) =>
              isSameSpecies(pl.species, oldName) ? { ...pl, species: newName, updatedAt: ts } : pl
            ),
            youthProjectBooks: (currentSnapshot.youthProjectBooks ?? []).map((yp) =>
              isSameSpecies(yp.species, oldName) ? { ...yp, species: newName, updatedAt: ts } : yp
            ),
            clientContacts: (currentSnapshot.clientContacts ?? []).map((c) =>
              isSameSpecies(c.species, oldName) ? { ...c, species: newName, updatedAt: ts } : c
            ),
            waitlistEntries: (currentSnapshot.waitlistEntries ?? []).map((w) =>
              isSameSpecies(w.species, oldName) ? { ...w, species: newName, updatedAt: ts } : w
            ),
            animalReservations: (currentSnapshot.animalReservations ?? []).map((r) =>
              isSameSpecies(r.species, oldName) ? { ...r, species: newName, updatedAt: ts } : r
            ),
            woolHarvests: (currentSnapshot.woolHarvests ?? []).map((w) =>
              isSameSpecies(w.species, oldName) ? { ...w, species: newName, updatedAt: ts } : w
            ),
            mileageLogs: (currentSnapshot.mileageLogs ?? []).map((m) =>
              isSameSpecies(m.species, oldName) ? { ...m, species: newName, updatedAt: ts } : m
            ),
            journalEntries: (currentSnapshot.journalEntries ?? []).map((j) =>
              isSameSpecies(j.species, oldName) ? { ...j, species: newName, updatedAt: ts } : j
            ),
            judgeClubs: (currentSnapshot.judgeClubs ?? []).map((c) =>
              isSameSpecies(c.species, oldName) ? { ...c, species: newName, updatedAt: ts } : c
            ),
            judgeAssignments: (currentSnapshot.judgeAssignments ?? []).map((a) =>
              isSameSpecies(a.species, oldName) ? { ...a, species: newName, updatedAt: ts } : a
            ),
            judgeExpenses: (currentSnapshot.judgeExpenses ?? []).map((e) =>
              isSameSpecies(e.species, oldName) ? { ...e, species: newName, updatedAt: ts } : e
            ),
          };
          await deps.getAdapter().replaceSnapshot(renamedSnapshot);
          if (isSameSpecies(deps.activeSpeciesName, oldName)) {
            deps.setActiveSpeciesName(newName);
          }
        } else {
          await deps.getAdapter().saveSpeciesProfile(clean);
        }

        await deps.recordOutboxOps(
          diffEntityFieldsToOperations({
            entityType: 'species',
            previous: existing,
            next: clean,
            deviceId: deps.deviceId,
            nextCounter: deps.allocateNextLogicalCounter,
            timestamp: ts,
            recordRev: rev,
          })
        );
        await deps.reloadFromAdapter();
        deps.notify(
          renamed
            ? `Renamed ${existing.name} to ${clean.name} across all barn records.`
            : `${clean.name} schedule saved.`
        );
      } else {
        const currentList = currentSnapshot?.speciesProfiles ?? [];
        const newId = profile.id || `species-${generateUuid()}`;
        const rev = deps.nextEntityRev(newId, profile._rev);
        const cleanNew: SpeciesProfile = {
          ...profile,
          id: newId,
          sortOrder: currentList.length,
          name: profile.name.trim(),
          defaultAnimalPrefix: (profile.defaultAnimalPrefix || '').trim(),
          memoText: sanitizeSpeciesMemo(profile.memoText ?? ''),
          memoUpdatedAt: profile.memoUpdatedAt ?? '',
          breedOverrides: normalizeBreedScheduleOverrides(profile.breedOverrides),
          targetWeightCurve: normalizeTargetWeightCurve(profile.targetWeightCurve),
          _rev: rev,
          createdAt: profile.createdAt || ts,
          updatedAt: ts,
        };
        await deps.getAdapter().saveSpeciesProfile(cleanNew);
        await deps.recordOutboxOps(
          diffEntityFieldsToOperations({
            entityType: 'species',
            previous: undefined,
            next: cleanNew,
            deviceId: deps.deviceId,
            nextCounter: deps.allocateNextLogicalCounter,
            timestamp: ts,
            recordRev: rev,
          })
        );
        await deps.reloadFromAdapter();
        deps.notify(`${cleanNew.name} added to your barn.`);
      }
      return true;
    } catch (err) {
      deps.reportPersistenceFailure(`save ${profile.name} species schedule`, err);
      return false;
    }
  });
}

export function useSpeciesProfileActions(deps: SpeciesProfileDeps) {
  const saveSpeciesProfile = useCallback(
    (profile: SpeciesProfile) => saveSpeciesProfileAction(deps, profile),
    [
      deps.enqueueStoreMutation,
      deps.snapshotRef,
      deps.getAdapter,
      deps.deviceId,
      deps.nextEntityRev,
      deps.allocateNextLogicalCounter,
      deps.nowIsoUtc,
      deps.recordOutboxOps,
      deps.reloadFromAdapter,
      deps.notify,
      deps.reportPersistenceFailure,
      deps.activeSpeciesName,
      deps.setActiveSpeciesName,
    ]
  );

  return { saveSpeciesProfile };
}
