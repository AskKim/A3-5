/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The breeding writes, which only succeed when the breeding record and its links agree.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Breeding lifecycle mutations, extracted from `useBarnStore` as a sub-hook.
 *
 * Five writes that all hinge on the same rule: a breeding record and its linked post-birth chores
 * must agree about dates. Logging a pairing cascades chores from the gestation profile; a palpation,
 * miss or birth updates the record and then shifts (or clears) those chores so the barn never shows
 * chores for a litter that already arrived — or chores that are still pending for one that did not.
 *
 * Ownership split: the store owns the snapshot ref, adapter, calendar queue and toast channel; this
 * slice owns the sequencing.
 */
import { useCallback } from 'react';
import type {
  Animal,
  BarnDatabaseSnapshot,
  BarnTask,
  BreedingRecord,
  LitterWeightMilestone,
  ServiceFeeDirection,
  UltrasoundResult,
} from '../../domain/models';
import type { LitterOffspringDraft } from '../../domain/animalConflicts';
import {
  addDaysIso,
  applyAnimalNamePrefix,
  generateUuid,
  normalizeCalendarSyncSettings,
  normalizeLitterWeightMilestones,
  normalizeServiceFeeDirection,
  normalizeUltrasoundResult,
  resolveSpeciesProfile,
} from '../../domain/models';
import {
  generateCascadedTasksForBreeding,
  getPendingBreedingCleanupTasks,
  recalculatePostBirthTasksForBreeding,
  resolveEffectiveSpeciesProfileForBreeding,
} from '../../domain/taskMaster';
import { buildSpeciesHerdMap, calculatePairingCoi } from '../../domain/pedigreeCalculator';
import { buildIcsCalendarForTasks } from '../../domain/calendarExport';
import {
  createOutboxOperation,
  diffEntityFieldsToOperations,
  type SyncOperation,
} from '../../domain/syncOutbox';
import { downloadTextFile } from '../../utils/webFileActions';

export type BreedingTaskCheckoffAction =
  | { kind: 'palpated_positive' }
  | { kind: 'missed'; notes?: string }
  | {
      kind: 'birth_recorded';
      actualBirthDateIso: string;
      liveCount: number;
      stillbornCount: number;
      fosteredCount?: number;
      shiftPostBirthTasks?: boolean;
      notes?: string;
    };

export interface BreedingAdapter {
  saveAnimalsBatch(animals: Animal[]): Promise<void>;
  saveBreeding(breeding: BreedingRecord): Promise<void>;
  saveTasksBatch(tasks: BarnTask[]): Promise<void>;
  saveTask(task: BarnTask): Promise<void>;
  deleteTasksBatch(taskIds: string[]): Promise<void>;
  deleteBreeding(breedingId: string): Promise<void>;
}

export interface BreedingDeps {
  snapshot: BarnDatabaseSnapshot | null;
  snapshotRef: { current: BarnDatabaseSnapshot | null };
  activeSpeciesName: string;
  enqueueStoreMutation: <T>(task: () => Promise<T>) => Promise<T>;
  adapter: BreedingAdapter;
  deviceId: string;
  nextEntityRev: (entityUuid: string, currentRev?: number) => number;
  allocateNextLogicalCounter: () => number;
  nowIsoUtc: () => string;
  recordOutboxOps: (operations: SyncOperation[]) => Promise<void>;
  reloadFromAdapter: () => Promise<void>;
  notify: (message: string) => void;
  reportPersistenceFailure: (action: string, error: unknown) => void;
  isOnline: () => boolean;
  setPendingCalendarSync: (payload: { tasks: BarnTask[]; filenameHint: string }) => void;
}

export interface LogBreedingParams {
  sire?: Animal;
  quickSireName?: string;
  dam?: Animal;
  quickDamName?: string;
  bredDateIso: string;
  status: BreedingRecord['status'];
  serviceFeeCents?: number;
  serviceFeeDirection?: ServiceFeeDirection;
  notes: string;
  autoScheduleChores: boolean;
}

export interface BreedingOutcomePatch {
  status: BreedingRecord['status'];
  actualBirthDateIso: string;
  liveCount: number;
  stillbornCount: number;
  fosteredCount: number;
  weanedCount: number;
  serviceFeeCents?: number;
  serviceFeeDirection?: ServiceFeeDirection;
  ultrasoundDateIso?: string;
  ultrasoundResult?: UltrasoundResult;
  ultrasoundFetalCount?: number;
  ultrasoundProjectedDueIso?: string;
  litterWeightMilestones?: LitterWeightMilestone[];
  notes: string;
  registerJuniorCount: number;
  offspringDrafts?: Array<Pick<LitterOffspringDraft, 'name' | 'tattoo' | 'sex'>>;
  shiftPostBirthTasksToActualDate?: boolean;
}

/** Log a pairing, optionally creating quick parents and cascading mating/gestation chores. */
export async function logBreedingAction(
  deps: BreedingDeps,
  params: LogBreedingParams
): Promise<boolean> {
  return deps.enqueueStoreMutation(async () => {
    const currentSnapshot = deps.snapshotRef.current ?? deps.snapshot;
    if (!currentSnapshot) return false;
    const targetSpeciesName = params.dam?.species || params.sire?.species || deps.activeSpeciesName;
    const sp = resolveSpeciesProfile(targetSpeciesName, currentSnapshot.speciesProfiles);
    const ts = deps.nowIsoUtc();

    const buildQuickParent = (rawName: string, sex: 'Male' | 'Female'): Animal => ({
      id: generateUuid(),
      tattoo: '',
      name: rawName.trim(),
      species: sp.name,
      breed: '',
      variety: '',
      sex,
      status: 'Active',
      archived: false,
      needsAttention: true,
      birthDateIso: '',
      weightGrams: 0,
      genotype: [],
      genotypeRaw: '',
      registrationNumber: '',
      grandChampionNumber: '',
      legsCount: 0,
      cageLocation: '',
      breederName: '',
      ownerName: '',
      sireId: '',
      damId: '',
      notes: 'Quick-added during breeding entry — review and complete record details.',
      _rev: 1,
      createdAt: ts,
      updatedAt: ts,
    });

    const newlyCreatedParents: Animal[] = [];
    let resolvedSire = params.sire;
    if (!resolvedSire && params.quickSireName?.trim()) {
      resolvedSire = buildQuickParent(params.quickSireName, 'Male');
      newlyCreatedParents.push(resolvedSire);
    }
    let resolvedDam = params.dam;
    if (!resolvedDam && params.quickDamName?.trim()) {
      resolvedDam = buildQuickParent(params.quickDamName, 'Female');
      newlyCreatedParents.push(resolvedDam);
    }

    if (!resolvedSire || !resolvedDam) return false;

    const herdMap = buildSpeciesHerdMap(
      [...currentSnapshot.animals, ...newlyCreatedParents],
      sp.name
    );
    const coi = calculatePairingCoi(resolvedSire.id, resolvedDam.id, herdMap).coiPercent;
    const { profile: effectiveSp } = resolveEffectiveSpeciesProfileForBreeding(
      sp,
      resolvedDam,
      resolvedSire
    );

    const breeding: BreedingRecord = {
      id: generateUuid(),
      species: sp.name,
      sireId: resolvedSire.id,
      damId: resolvedDam.id,
      sireName: resolvedSire.name,
      damName: resolvedDam.name,
      bredDateIso: params.bredDateIso,
      expectedDueDateIso: addDaysIso(params.bredDateIso, effectiveSp.gestationDays),
      actualBirthDateIso: '',
      projectedCoiPercent: Math.round(coi * 100) / 100,
      liveCount: 0,
      stillbornCount: 0,
      fosteredCount: 0,
      weanedCount: 0,
      offspringCreated: false,
      status: params.status,
      serviceFeeCents: Math.max(0, Math.round(Number(params.serviceFeeCents) || 0)),
      serviceFeeDirection: normalizeServiceFeeDirection(params.serviceFeeDirection),
      notes: params.notes.trim(),
      _rev: 1,
      createdAt: ts,
      updatedAt: ts,
    };

    try {
      const ops: SyncOperation[] = [];
      if (newlyCreatedParents.length > 0) {
        await deps.adapter.saveAnimalsBatch(newlyCreatedParents);
        for (const created of newlyCreatedParents) {
          ops.push(
            ...diffEntityFieldsToOperations({
              entityType: 'animal',
              previous: undefined,
              next: created,
              deviceId: deps.deviceId,
              nextCounter: deps.allocateNextLogicalCounter,
              timestamp: ts,
              recordRev: 1,
            })
          );
        }
      }

      await deps.adapter.saveBreeding(breeding);
      ops.push(
        ...diffEntityFieldsToOperations({
          entityType: 'breeding',
          previous: undefined,
          next: breeding,
          deviceId: deps.deviceId,
          nextCounter: deps.allocateNextLogicalCounter,
          timestamp: ts,
          recordRev: 1,
        })
      );

      let cascaded: BarnTask[] = [];
      let taskCount = 0;
      if (params.autoScheduleChores) {
        cascaded = generateCascadedTasksForBreeding(breeding, effectiveSp).map((t) => ({
          ...t,
          _rev: 1,
        }));
        taskCount = cascaded.length;
        await deps.adapter.saveTasksBatch(cascaded);
        for (const t of cascaded) {
          ops.push(
            ...diffEntityFieldsToOperations({
              entityType: 'task',
              previous: undefined,
              next: t,
              deviceId: deps.deviceId,
              nextCounter: deps.allocateNextLogicalCounter,
              timestamp: ts,
              recordRev: 1,
            })
          );
        }
      }

      await deps.recordOutboxOps(ops);
      await deps.reloadFromAdapter();

      let calendarResultMsg = '';
      const calConfig = normalizeCalendarSyncSettings(currentSnapshot.settings.calendarSync);
      if (calConfig.autoAddNewTasks && calConfig.includeBreedingTasks && cascaded.length > 0) {
        const dated = cascaded.filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.dueDateIso || ''));
        if (dated.length > 0) {
          const isOnline = deps.isOnline();
          if (calConfig.deliveryMode === 'google_calendar' && isOnline) {
            deps.setPendingCalendarSync({
              tasks: dated,
              filenameHint: `${resolvedDam.name}-breeding-chores`,
            });
            calendarResultMsg = ` & queued ${dated.length} event(s) for Google Calendar.`;
          } else {
            const appBaseUrl =
              typeof window !== 'undefined'
                ? `${window.location.origin}${window.location.pathname}`
                : '';
            const ics = buildIcsCalendarForTasks(
              dated,
              calConfig,
              currentSnapshot.settings.barnName,
              `${resolvedDam.name}-breeding-chores`,
              {
                animals: [...currentSnapshot.animals, ...newlyCreatedParents],
                breedings: [...currentSnapshot.breedings, breeding],
                speciesProfiles: currentSnapshot.speciesProfiles,
                appBaseUrl,
              }
            );
            if (ics) {
              await downloadTextFile(ics.filename, ics.icsContent, 'text/calendar');
              calendarResultMsg =
                calConfig.deliveryMode === 'google_calendar' && !isOnline
                  ? ` & downloaded offline .ICS fallback (${ics.eventCount} event(s)).`
                  : ` & exported ${ics.eventCount} calendar event(s) (.ICS).`;
            }
          }
        }
      }

      const quickAddNote =
        newlyCreatedParents.length > 0
          ? ` Added ${newlyCreatedParents.map((p) => p.name).join(' & ')} (Needs Attention).`
          : '';

      deps.notify(
        (taskCount > 0
          ? calendarResultMsg
            ? `Logged ${resolvedSire.name} × ${resolvedDam.name}, cascaded ${taskCount} chores${calendarResultMsg}`
            : `Logged ${resolvedSire.name} × ${resolvedDam.name} and cascaded ${taskCount} barn chores.`
          : `Logged pairing ${resolvedSire.name} × ${resolvedDam.name}.`) + quickAddNote
      );
      return true;
    } catch (err) {
      deps.reportPersistenceFailure('save breeding record', err);
      return false;
    }
  });
}

/** Save a litter outcome, optionally registering junior records and shifting post-birth chores. */
export async function updateBreedingOutcomeAction(
  deps: BreedingDeps,
  existing: BreedingRecord,
  patch: BreedingOutcomePatch
): Promise<boolean> {
  return deps.enqueueStoreMutation(async () => {
    const currentSnapshot = deps.snapshotRef.current ?? deps.snapshot;
    if (!currentSnapshot) return false;
    const ts = deps.nowIsoUtc();
    const sp = resolveSpeciesProfile(existing.species, currentSnapshot.speciesProfiles);
    const sire = currentSnapshot.animals.find((a) => a.id === existing.sireId);
    const dam = currentSnapshot.animals.find((a) => a.id === existing.damId);
    const { profile: effectiveSp } = resolveEffectiveSpeciesProfileForBreeding(sp, dam, sire);
    const ops: SyncOperation[] = [];

    try {
      let createdAny = existing.offspringCreated;
      const requestedDrafts = patch.offspringDrafts;
      const effectiveCount = requestedDrafts
        ? Math.min(16, requestedDrafts.length)
        : Math.min(16, Math.max(0, patch.registerJuniorCount));
      if (effectiveCount > 0) {
        const createdJuniors: Animal[] = [];
        for (let i = 1; i <= effectiveCount; i++) {
          const draftItem = requestedDrafts?.[i - 1];
          const fallbackTattoo = `${(dam?.tattoo || sp.name.slice(0, 3).toUpperCase()).slice(0, 6)}-K${i}`;
          const fallbackName = applyAnimalNamePrefix(
            `${existing.damName} ${sp.offspringLabel} #${i}`,
            sp.defaultAnimalPrefix
          );
          const resolvedName = draftItem?.name?.trim() || fallbackName;
          const resolvedTattoo = draftItem !== undefined ? draftItem.tattoo.trim() : fallbackTattoo;
          const resolvedSex = draftItem?.sex || (i % 2 === 0 ? 'Male' : 'Female');

          const jr: Animal = {
            id: generateUuid(),
            tattoo: resolvedTattoo,
            name: resolvedName,
            species: sp.name,
            breed: dam?.breed || sire?.breed || '',
            variety: dam?.variety || sire?.variety || '',
            sex: resolvedSex,
            status: 'Junior',
            archived: false,
            birthDateIso: patch.actualBirthDateIso || existing.expectedDueDateIso,
            weightGrams: 0,
            genotype: [],
            genotypeRaw: '',
            registrationNumber: '',
            grandChampionNumber: '',
            legsCount: 0,
            cageLocation: dam?.cageLocation || '',
            breederName: currentSnapshot.settings.breederName || dam?.breederName || '',
            ownerName: currentSnapshot.settings.barnName || '',
            ownershipType: 'Owned',
            sireId: existing.sireId,
            damId: existing.damId,
            notes: `Auto-registered from ${existing.sireName} × ${existing.damName} litter.`,
            _rev: 1,
            createdAt: ts,
            updatedAt: ts,
          };
          createdJuniors.push(jr);
          ops.push(
            ...diffEntityFieldsToOperations({
              entityType: 'animal',
              previous: undefined,
              next: jr,
              deviceId: deps.deviceId,
              nextCounter: deps.allocateNextLogicalCounter,
              timestamp: ts,
              recordRev: 1,
            })
          );
        }
        await deps.adapter.saveAnimalsBatch(createdJuniors);
        createdAny = true;
      }

      const breedingRev = deps.nextEntityRev(existing.id, existing._rev);
      const updated: BreedingRecord = {
        ...existing,
        status: patch.status,
        actualBirthDateIso: patch.actualBirthDateIso,
        liveCount: patch.liveCount,
        stillbornCount: patch.stillbornCount,
        fosteredCount: patch.fosteredCount,
        weanedCount: patch.weanedCount,
        offspringCreated: createdAny,
        serviceFeeCents:
          patch.serviceFeeCents !== undefined
            ? Math.max(0, Math.round(Number(patch.serviceFeeCents) || 0))
            : existing.serviceFeeCents ?? 0,
        serviceFeeDirection:
          patch.serviceFeeDirection !== undefined
            ? normalizeServiceFeeDirection(patch.serviceFeeDirection)
            : normalizeServiceFeeDirection(existing.serviceFeeDirection),
        ultrasoundDateIso:
          patch.ultrasoundDateIso !== undefined
            ? patch.ultrasoundDateIso
            : existing.ultrasoundDateIso || '',
        ultrasoundResult:
          patch.ultrasoundResult !== undefined
            ? normalizeUltrasoundResult(patch.ultrasoundResult)
            : normalizeUltrasoundResult(existing.ultrasoundResult),
        ultrasoundFetalCount:
          patch.ultrasoundFetalCount !== undefined
            ? Math.max(0, Math.round(Number(patch.ultrasoundFetalCount) || 0))
            : existing.ultrasoundFetalCount ?? 0,
        ultrasoundProjectedDueIso:
          patch.ultrasoundProjectedDueIso !== undefined
            ? patch.ultrasoundProjectedDueIso
            : existing.ultrasoundProjectedDueIso || '',
        litterWeightMilestones:
          patch.litterWeightMilestones !== undefined
            ? normalizeLitterWeightMilestones(patch.litterWeightMilestones)
            : normalizeLitterWeightMilestones(existing.litterWeightMilestones),
        notes: patch.notes,
        _rev: breedingRev,
        updatedAt: ts,
      };

      await deps.adapter.saveBreeding(updated);
      ops.push(
        ...diffEntityFieldsToOperations({
          entityType: 'breeding',
          previous: existing,
          next: updated,
          deviceId: deps.deviceId,
          nextCounter: deps.allocateNextLogicalCounter,
          timestamp: ts,
          recordRev: breedingRev,
        })
      );

      let clearedTaskCount = 0;
      let shiftedTaskCount = 0;

      if (patch.status === 'Missed') {
        const pendingCleanup = getPendingBreedingCleanupTasks(
          currentSnapshot.tasks,
          existing.id,
          effectiveSp
        );
        if (pendingCleanup.length > 0) {
          await deps.adapter.deleteTasksBatch(pendingCleanup.map((t) => t.id));
          clearedTaskCount = pendingCleanup.length;
          for (const ct of pendingCleanup) {
            ops.push(
              createOutboxOperation({
                entityType: 'task',
                entityUuid: ct.id,
                deviceId: deps.deviceId,
                logicalCounter: deps.allocateNextLogicalCounter(),
                fieldName: '__delete__',
                newValue: true,
                timestamp: ts,
                recordRev: deps.nextEntityRev(ct.id, ct._rev),
              })
            );
          }
        }
      } else if (
        patch.shiftPostBirthTasksToActualDate &&
        (patch.status === 'Born' || patch.status === 'Weaned') &&
        patch.actualBirthDateIso
      ) {
        const prevTaskById = new Map(currentSnapshot.tasks.map((t) => [t.id, t]));
        const { updatedTasks } = recalculatePostBirthTasksForBreeding(
          currentSnapshot.tasks,
          updated,
          effectiveSp,
          ts,
          patch.actualBirthDateIso
        );
        if (updatedTasks.length > 0) {
          const revAligned = updatedTasks.map((nextTask) => {
            const prevTask = prevTaskById.get(nextTask.id);
            const rev = deps.nextEntityRev(nextTask.id, prevTask?._rev);
            return { ...nextTask, _rev: rev };
          });
          await deps.adapter.saveTasksBatch(revAligned);
          shiftedTaskCount = revAligned.length;
          for (const nextTask of revAligned) {
            const prevTask = prevTaskById.get(nextTask.id);
            ops.push(
              ...diffEntityFieldsToOperations({
                entityType: 'task',
                previous: prevTask,
                next: nextTask,
                deviceId: deps.deviceId,
                nextCounter: deps.allocateNextLogicalCounter,
                timestamp: ts,
                recordRev: nextTask._rev,
              })
            );
          }
        }
      }

      await deps.recordOutboxOps(ops);
      await deps.reloadFromAdapter();
      const extraNotes: string[] = [];
      if (clearedTaskCount > 0) {
        extraNotes.push(
          `cleared ${clearedTaskCount} pending barn chore${clearedTaskCount === 1 ? '' : 's'}`
        );
      }
      if (shiftedTaskCount > 0) {
        extraNotes.push(
          `shifted ${shiftedTaskCount} post-birth chore${shiftedTaskCount === 1 ? '' : 's'} to ${patch.actualBirthDateIso}`
        );
      }
      const baseMsg =
        effectiveCount > 0
          ? `Litter updated & ${effectiveCount} ${sp.offspringLabel.toLowerCase()} records created`
          : 'Litter outcome saved';
      deps.notify(extraNotes.length > 0 ? `${baseMsg} (${extraNotes.join('; ')}).` : `${baseMsg}.`);
      return true;
    } catch (err) {
      deps.reportPersistenceFailure('save litter outcome', err);
      return false;
    }
  });
}

/** Shift post-birth chores to the recorded birth date. */
export async function recalculateBreedingPostBirthTasksAction(
  deps: BreedingDeps,
  breedingId: string
): Promise<boolean> {
  return deps.enqueueStoreMutation(async () => {
    const currentSnapshot = deps.snapshotRef.current ?? deps.snapshot;
    if (!currentSnapshot) return false;
    const breeding = currentSnapshot.breedings.find((b) => b.id === breedingId);
    if (!breeding || !breeding.actualBirthDateIso || breeding.status === 'Missed') {
      deps.notify('Record an actual birth date before recalculating post-birth chores.');
      return false;
    }
    const ts = deps.nowIsoUtc();
    const sp = resolveSpeciesProfile(breeding.species, currentSnapshot.speciesProfiles);
    const sire = currentSnapshot.animals.find((a) => a.id === breeding.sireId);
    const dam = currentSnapshot.animals.find((a) => a.id === breeding.damId);
    const { profile: effectiveSp } = resolveEffectiveSpeciesProfileForBreeding(sp, dam, sire);

    const prevTaskById = new Map(currentSnapshot.tasks.map((t) => [t.id, t]));
    const { updatedTasks } = recalculatePostBirthTasksForBreeding(
      currentSnapshot.tasks,
      breeding,
      effectiveSp,
      ts
    );
    if (updatedTasks.length === 0) {
      deps.notify('Post-birth chores already match the actual birth date.');
      return true;
    }

    try {
      const revAligned = updatedTasks.map((nextTask) => {
        const prevTask = prevTaskById.get(nextTask.id);
        const rev = deps.nextEntityRev(nextTask.id, prevTask?._rev);
        return { ...nextTask, _rev: rev };
      });
      await deps.adapter.saveTasksBatch(revAligned);
      const ops: SyncOperation[] = [];
      for (const nextTask of revAligned) {
        const prevTask = prevTaskById.get(nextTask.id);
        ops.push(
          ...diffEntityFieldsToOperations({
            entityType: 'task',
            previous: prevTask,
            next: nextTask,
            deviceId: deps.deviceId,
            nextCounter: deps.allocateNextLogicalCounter,
            timestamp: ts,
            recordRev: nextTask._rev,
          })
        );
      }
      await deps.recordOutboxOps(ops);
      await deps.reloadFromAdapter();
      deps.notify(
        `Shifted ${revAligned.length} post-birth chore${
          revAligned.length === 1 ? '' : 's'
        } to ${breeding.actualBirthDateIso}.`
      );
      return true;
    } catch (err) {
      deps.reportPersistenceFailure('recalculate post-birth chores', err);
      return false;
    }
  });
}

/** Complete a breeding-linked chore and apply its palpation / miss / birth outcome. */
export async function completeBreedingTaskWithOutcomeAction(
  deps: BreedingDeps,
  task: BarnTask,
  outcome: BreedingTaskCheckoffAction
): Promise<boolean> {
  return deps.enqueueStoreMutation(async () => {
    const currentSnapshot = deps.snapshotRef.current ?? deps.snapshot;
    if (!currentSnapshot) return false;
    const ts = deps.nowIsoUtc();
    const ops: SyncOperation[] = [];

    try {
      const taskRev = deps.nextEntityRev(task.id, task._rev);
      const completedTask: BarnTask = {
        ...task,
        completed: true,
        _rev: taskRev,
        updatedAt: ts,
      };
      await deps.adapter.saveTask(completedTask);
      ops.push(
        ...diffEntityFieldsToOperations({
          entityType: 'task',
          previous: task,
          next: completedTask,
          deviceId: deps.deviceId,
          nextCounter: deps.allocateNextLogicalCounter,
          timestamp: ts,
          recordRev: taskRev,
        })
      );

      const breeding = task.linkedBreedingId
        ? currentSnapshot.breedings.find((b) => b.id === task.linkedBreedingId)
        : undefined;

      if (!breeding) {
        await deps.recordOutboxOps(ops);
        await deps.reloadFromAdapter();
        deps.notify('Chore marked complete.');
        return true;
      }

      const sp = resolveSpeciesProfile(breeding.species, currentSnapshot.speciesProfiles);
      const sire = currentSnapshot.animals.find((a) => a.id === breeding.sireId);
      const dam = currentSnapshot.animals.find((a) => a.id === breeding.damId);
      const { profile: effectiveSp } = resolveEffectiveSpeciesProfileForBreeding(sp, dam, sire);

      if (outcome.kind === 'palpated_positive') {
        const nextStatus: BreedingRecord['status'] =
          breeding.status === 'Planned' || breeding.status === 'Bred'
            ? 'Palpated Positive'
            : breeding.status;
        const breedingRev = deps.nextEntityRev(breeding.id, breeding._rev);
        const updatedBreeding: BreedingRecord = {
          ...breeding,
          status: nextStatus,
          _rev: breedingRev,
          updatedAt: ts,
        };
        await deps.adapter.saveBreeding(updatedBreeding);
        ops.push(
          ...diffEntityFieldsToOperations({
            entityType: 'breeding',
            previous: breeding,
            next: updatedBreeding,
            deviceId: deps.deviceId,
            nextCounter: deps.allocateNextLogicalCounter,
            timestamp: ts,
            recordRev: breedingRev,
          })
        );
        await deps.recordOutboxOps(ops);
        await deps.reloadFromAdapter();
        deps.notify(`Palpation confirmed positive for ${breeding.damName} × ${breeding.sireName}.`);
        return true;
      }

      if (outcome.kind === 'missed') {
        const breedingRev = deps.nextEntityRev(breeding.id, breeding._rev);
        const nextNotes = outcome.notes?.trim()
          ? [breeding.notes, outcome.notes.trim()].filter(Boolean).join(' · ')
          : breeding.notes;
        const updatedBreeding: BreedingRecord = {
          ...breeding,
          status: 'Missed',
          notes: nextNotes,
          _rev: breedingRev,
          updatedAt: ts,
        };
        await deps.adapter.saveBreeding(updatedBreeding);
        ops.push(
          ...diffEntityFieldsToOperations({
            entityType: 'breeding',
            previous: breeding,
            next: updatedBreeding,
            deviceId: deps.deviceId,
            nextCounter: deps.allocateNextLogicalCounter,
            timestamp: ts,
            recordRev: breedingRev,
          })
        );

        const pendingCleanup = getPendingBreedingCleanupTasks(
          currentSnapshot.tasks,
          breeding.id,
          effectiveSp,
          [task.id]
        );
        if (pendingCleanup.length > 0) {
          await deps.adapter.deleteTasksBatch(pendingCleanup.map((t) => t.id));
          for (const ct of pendingCleanup) {
            ops.push(
              createOutboxOperation({
                entityType: 'task',
                entityUuid: ct.id,
                deviceId: deps.deviceId,
                logicalCounter: deps.allocateNextLogicalCounter(),
                fieldName: '__delete__',
                newValue: true,
                timestamp: ts,
                recordRev: deps.nextEntityRev(ct.id, ct._rev),
              })
            );
          }
        }
        await deps.recordOutboxOps(ops);
        await deps.reloadFromAdapter();
        deps.notify(
          pendingCleanup.length > 0
            ? `Marked ${breeding.damName} × ${breeding.sireName} Missed and cleared ${pendingCleanup.length} pending chore${pendingCleanup.length === 1 ? '' : 's'}.`
            : `Marked ${breeding.damName} × ${breeding.sireName} Missed.`
        );
        return true;
      }

      // outcome.kind === 'birth_recorded'
      const breedingRev = deps.nextEntityRev(breeding.id, breeding._rev);
      const nextNotes = outcome.notes?.trim()
        ? [breeding.notes, outcome.notes.trim()].filter(Boolean).join(' · ')
        : breeding.notes;
      const updatedBreeding: BreedingRecord = {
        ...breeding,
        status: breeding.status === 'Weaned' ? 'Weaned' : 'Born',
        actualBirthDateIso:
          outcome.actualBirthDateIso || breeding.actualBirthDateIso || breeding.expectedDueDateIso,
        liveCount: Math.max(0, Math.round(outcome.liveCount)),
        stillbornCount: Math.max(0, Math.round(outcome.stillbornCount)),
        fosteredCount:
          outcome.fosteredCount !== undefined
            ? Math.round(outcome.fosteredCount)
            : breeding.fosteredCount,
        notes: nextNotes,
        _rev: breedingRev,
        updatedAt: ts,
      };
      await deps.adapter.saveBreeding(updatedBreeding);
      ops.push(
        ...diffEntityFieldsToOperations({
          entityType: 'breeding',
          previous: breeding,
          next: updatedBreeding,
          deviceId: deps.deviceId,
          nextCounter: deps.allocateNextLogicalCounter,
          timestamp: ts,
          recordRev: breedingRev,
        })
      );

      let shiftedCount = 0;
      if (outcome.shiftPostBirthTasks !== false && updatedBreeding.actualBirthDateIso) {
        const prevTaskById = new Map(currentSnapshot.tasks.map((t) => [t.id, t]));
        const tasksWithoutCompleted = currentSnapshot.tasks.filter((t) => t.id !== task.id);
        const { updatedTasks } = recalculatePostBirthTasksForBreeding(
          tasksWithoutCompleted,
          updatedBreeding,
          effectiveSp,
          ts,
          updatedBreeding.actualBirthDateIso
        );
        if (updatedTasks.length > 0) {
          const revAligned = updatedTasks.map((nextTask) => {
            const prevTask = prevTaskById.get(nextTask.id);
            const rev = deps.nextEntityRev(nextTask.id, prevTask?._rev);
            return { ...nextTask, _rev: rev };
          });
          await deps.adapter.saveTasksBatch(revAligned);
          shiftedCount = revAligned.length;
          for (const nextTask of revAligned) {
            const prevTask = prevTaskById.get(nextTask.id);
            ops.push(
              ...diffEntityFieldsToOperations({
                entityType: 'task',
                previous: prevTask,
                next: nextTask,
                deviceId: deps.deviceId,
                nextCounter: deps.allocateNextLogicalCounter,
                timestamp: ts,
                recordRev: nextTask._rev,
              })
            );
          }
        }
      }

      await deps.recordOutboxOps(ops);
      await deps.reloadFromAdapter();
      deps.notify(
        `Logged ${updatedBreeding.liveCount} live / ${updatedBreeding.stillbornCount} stillborn for ${breeding.damName}` +
          (shiftedCount > 0
            ? ` & shifted ${shiftedCount} post-birth chore${shiftedCount === 1 ? '' : 's'}.`
            : '.')
      );
      return true;
    } catch (err) {
      deps.reportPersistenceFailure('complete breeding outcome chore', err);
      return false;
    }
  });
}

/** Delete a breeding record together with every chore that points at it. */
export async function deleteBreedingAction(deps: BreedingDeps, id: string): Promise<void> {
  return deps.enqueueStoreMutation(async () => {
    const currentSnapshot = deps.snapshotRef.current;
    const target = currentSnapshot?.breedings.find((b) => b.id === id);
    const linkedTasks = (currentSnapshot?.tasks ?? []).filter((t) => t.linkedBreedingId === id);
    const ts = deps.nowIsoUtc();
    try {
      await deps.adapter.deleteBreeding(id);
      const ops: SyncOperation[] = [
        createOutboxOperation({
          entityType: 'breeding',
          entityUuid: id,
          deviceId: deps.deviceId,
          logicalCounter: deps.allocateNextLogicalCounter(),
          fieldName: '__delete__',
          newValue: true,
          timestamp: ts,
          recordRev: deps.nextEntityRev(id, target?._rev),
        }),
        ...linkedTasks.map((t) =>
          createOutboxOperation({
            entityType: 'task',
            entityUuid: t.id,
            deviceId: deps.deviceId,
            logicalCounter: deps.allocateNextLogicalCounter(),
            fieldName: '__delete__',
            newValue: true,
            timestamp: ts,
            recordRev: deps.nextEntityRev(t.id, t._rev),
          })
        ),
      ];
      await deps.recordOutboxOps(ops);
      await deps.reloadFromAdapter();
      deps.notify('Breeding & linked chores removed.');
    } catch (err) {
      deps.reportPersistenceFailure('delete breeding record', err);
    }
  });
}

export interface Breeding {
  logBreedingWithCascade: (params: LogBreedingParams) => Promise<boolean>;
  updateBreedingOutcome: (
    existing: BreedingRecord,
    patch: BreedingOutcomePatch
  ) => Promise<boolean>;
  recalculateBreedingPostBirthTasks: (breedingId: string) => Promise<boolean>;
  completeBreedingTaskWithOutcome: (
    task: BarnTask,
    outcome: BreedingTaskCheckoffAction
  ) => Promise<boolean>;
  deleteBreeding: (id: string) => Promise<void>;
}

export function useBreeding(deps: BreedingDeps): Breeding {
  const logBreedingWithCascade = useCallback(
    (params: LogBreedingParams) => logBreedingAction(deps, params),
    [deps.enqueueStoreMutation, deps.snapshot, deps.snapshotRef, deps.activeSpeciesName, deps.adapter, deps.deviceId, deps.recordOutboxOps, deps.reloadFromAdapter, deps.notify, deps.reportPersistenceFailure, deps.isOnline, deps.setPendingCalendarSync, deps.nowIsoUtc, deps.allocateNextLogicalCounter]
  );

  const updateBreedingOutcome = useCallback(
    (existing: BreedingRecord, patch: BreedingOutcomePatch) =>
      updateBreedingOutcomeAction(deps, existing, patch),
    [deps.enqueueStoreMutation, deps.snapshot, deps.snapshotRef, deps.adapter, deps.deviceId, deps.nextEntityRev, deps.recordOutboxOps, deps.reloadFromAdapter, deps.notify, deps.reportPersistenceFailure, deps.nowIsoUtc, deps.allocateNextLogicalCounter]
  );

  const recalculateBreedingPostBirthTasks = useCallback(
    (breedingId: string) => recalculateBreedingPostBirthTasksAction(deps, breedingId),
    [deps.enqueueStoreMutation, deps.snapshot, deps.snapshotRef, deps.adapter, deps.deviceId, deps.nextEntityRev, deps.recordOutboxOps, deps.reloadFromAdapter, deps.notify, deps.reportPersistenceFailure, deps.nowIsoUtc, deps.allocateNextLogicalCounter]
  );

  const completeBreedingTaskWithOutcome = useCallback(
    (task: BarnTask, outcome: BreedingTaskCheckoffAction) =>
      completeBreedingTaskWithOutcomeAction(deps, task, outcome),
    [deps.enqueueStoreMutation, deps.snapshot, deps.snapshotRef, deps.adapter, deps.deviceId, deps.nextEntityRev, deps.recordOutboxOps, deps.reloadFromAdapter, deps.notify, deps.reportPersistenceFailure, deps.nowIsoUtc, deps.allocateNextLogicalCounter]
  );

  const deleteBreeding = useCallback((id: string) => deleteBreedingAction(deps, id), [
    deps.enqueueStoreMutation,
    deps.snapshotRef,
    deps.adapter,
    deps.deviceId,
    deps.nextEntityRev,
    deps.recordOutboxOps,
    deps.reloadFromAdapter,
    deps.notify,
    deps.reportPersistenceFailure,
    deps.nowIsoUtc,
    deps.allocateNextLogicalCounter,
  ]);

  return {
    logBreedingWithCascade,
    updateBreedingOutcome,
    recalculateBreedingPostBirthTasks,
    completeBreedingTaskWithOutcome,
    deleteBreeding,
  };
}
