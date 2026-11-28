/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The main hook: connects the screens to the stored data and keeps everything in step.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Portable React State & Offline Database Controller Hook (`useBarnStore`).
 *
 * Connects React components to the `StorageAdapter` while enforcing:
 * 1. Strict per-species filtering across Herd, Breeding, Pedigree, Tasks, Cages, and Shows.
 * 2. Startup Landing Pinning (`pinnedLandingSpecies` opens directly inside a pinned species hub
 *    when configured, or on the All-Species Home page when empty).
 * 3. Automatic Master Task List chore cascading whenever a breeding record is logged.
 * 4. Persistent browser storage lock (`navigator.storage.persist()`), rolling backups,
 *    and append-only field-level multi-worker delta sync (`sync_outbox` + `sync_conflicts`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeBarnAnimalConflicts,
  AnimalConflictSummary,
  AnimalSaveDraft,
  applyImportConflictAttentionFlags,
  ConcurrentEditConflictError,
  LitterOffspringDraft,
  mergeConcurrentAnimalEdit,
} from '../domain/animalConflicts';
import type { PreRestoreArchiveInspection } from '../domain/archiveInspector';
import type { BarnBenchBatchEntryDraft } from '../domain/barnBench';
import type { P2pReconciliationSummary } from '../domain/p2pSyncProtocol';
import type { PhotoStorageFootprintReport } from '../domain/photoMaintenance';
import {
  calculateSavingsPercent,
  formatByteSizePure,
  ImageOptimizationPresetId,
  OptimizedImagePayload,
} from '../domain/imageOptimizationSpec';
import {
  addDaysIso,
  Animal,
  AnimalConflictKind,
  AnimalPhoto,
  AnimalReservation,
  applyAnimalNamePrefix,
  BarnDatabaseSnapshot,
  BarnJournalEntry,
  BarnSettings,
  BarnTask,
  BreedingRecord,
  CageLocation,
  CareLog,
  ClientContact,
  countAllSpeciesRecords,
  countSpeciesNonTestingRecords,
  countSpeciesTestingRecords,
  FeedAllocation,
  FeedBatch,
  FeedPurgeWindowDays,
  generateUuid,
  isAnimalArchived,
  isSameSpecies,
  isSampleTestingId,
  JudgeAssignment,
  JudgeClubContact,
  JudgeExpense,
  LedgerEntry,
  LitterWeightMilestone,
  MileageLog,
  normalizeBreedScheduleOverrides,
  normalizeCalendarSyncSettings,
  normalizeDefaultPedigreeGenerations,
  normalizeFeedPurgeWindowDays,
  normalizeIgnoredConflicts,
  normalizeLedgerCategory,
  normalizeClientKind,
  normalizeLedgerEntryType,
  normalizeLitterWeightMilestones,
  normalizePeltGrade,
  normalizePreferredContactMethod,
  normalizeProcessingStatus,
  normalizeReservationStatus,
  normalizeRufusLevel,
  normalizeServiceFeeDirection,
  normalizeSpeciesHubBlockOrder,
  normalizeTargetWeightCurve,
  normalizeUltrasoundResult,
  normalizeWaitlistIntent,
  normalizeWaitlistStatus,
  normalizeYouthOrgType,
  normalizeYouthProjectFeedLogs,
  PedigreeGenerationDepth,
  PREDEFINED_SPECIES_PRESETS,
  ProcessingLog,
  reconcileCarrierTraitLists,
  resolveSpeciesProfile,
  ServiceFeeDirection,
  ShowEvent,
  SpeciesHubBlockId,
  SpeciesProfile,
  TargetWeightPoint,
  todayDateIso,
  UltrasoundResult,
  WaitlistEntry,
  WoolHarvest,
  YouthProjectBook,
} from '../domain/models';
import {
  invalidateSpeciesSelectorCache,
  selectSpeciesAnimalReservations,
  selectSpeciesAnimals,
  selectSpeciesBreedings,
  selectSpeciesCages,
  selectSpeciesCareLogs,
  selectSpeciesClientContacts,
  selectSpeciesFeedAllocations,
  selectSpeciesFeedBatches,
  selectSpeciesJudgeAssignments,
  selectSpeciesJudgeClubs,
  selectSpeciesJudgeExpenses,
  selectSpeciesJournalEntries,
  selectSpeciesLedgerEntries,
  selectSpeciesMileageLogs,
  selectSpeciesPhotoIndex,
  selectSpeciesProcessingLogs,
  selectSpeciesShows,
  selectSpeciesTasks,
  selectSpeciesWaitlistEntries,
  selectSpeciesWoolHarvests,
  selectSpeciesYouthProjectBooks,
} from './barnStore/speciesSelectors';

import { normalizeBarnJournalEntry } from '../domain/barnJournal';
import { PEDIGREE_APP_CONFIG } from '../app/pedigreeAppConfig';
import {
  normalizeJudgeAssignment,
  normalizeJudgeClubContact,
  normalizeJudgeExpense,
} from '../domain/judgeNotebook';
import { normalizeMileageLog } from '../domain/mileageTaxLog';
import { normalizeWoolHarvest } from '../domain/woolFiber';
import type { CrmFollowUpReminder } from '../domain/clientCrm';
import {
  buildIcsCalendarForTasks,
  buildTaskAppDeepLink,
  formatSystemTaskTitle,
} from '../domain/calendarExport';
import {
  BackupStatusEvaluation,
  evaluateBackupStatus,
  hasNonTestingBarnData,
  LastBackupMeta,
} from '../domain/backupStatus';
import type {
  ArchivedHerdIndexEntry,
  VaultBackupMetadata,
} from '../domain/backupVault';
import { CURRENT_APP_VERSION } from '../domain/upgradeGate';
import {
  buildSpeciesHerdMap,
  calculatePairingCoi,
  CoiAnalysis,
  createSpeciesCoiEvaluator,
} from '../domain/pedigreeCalculator';
import { parseAppDeepLinkParams } from '../domain/qrCode';
import {
  computeShowLegDeltas,
  mergeEnteredAnimalIdsWithResults,
  normalizeShowResults,
} from '../domain/showResults';
import type { ConflictSelectionMap } from '../domain/importers/conflictResolver';
import { PlatformImportPreview } from '../domain/importers/importerTypes';
import type { SpeciesBackupReason } from '../domain/syncAndExports';
import type {
  SpeciesMigrationOptions,
  SpeciesMigrationResult,
} from '../domain/speciesMigration';
import {
  bumpRecordRevision,
  createOutboxOperation,
  diffEntityFieldsToOperations,
  diffSnapshotsToSyncOperations,
  mergeDeltaOperations,
  stripPhotoBlobsForSync,
  SyncConflictEntry,
  SyncEntityType,
  SyncOperation,
} from '../domain/syncOutbox';
import {
  generateCascadedTasksForBreeding,
  getPendingBreedingCleanupTasks,
  recalculatePostBirthTasksForBreeding,
  resolveEffectiveSpeciesProfileForBreeding,
} from '../domain/taskMaster';
import { sanitizeSpeciesMemo } from '../domain/speciesMemo';
import { resolveThemeCssVariables } from '../domain/themePalette';
import {
  allocateNextLogicalCounter,
  appendSyncConflictsToIdb,
  appendSyncOperationsToIdb,
  BackupSyncStatus,
  buildDeltaFilePayload,
  clearAllSyncStateInIdb,
  configureBackupSyncFolder,
  disconnectBackupSyncFolder,
  getOrCreateLocalDeviceId,
  getPersistedBackupSyncStatus,
  deleteSyncConflictsFromIdb,
  loadAllSyncConflictsFromIdb,
  loadAllSyncOperationsFromIdb,
  reauthorizeBackupSyncFolder,
  replaceSyncOperationsInIdb,
  saveSyncConflictInIdb,
  subscribeCrossTabDbCommits,
} from '../storage/localSyncChannels';
import {
  acknowledgeCloudCircuitBreakerWarning,
  clearAllCloudSyncState,
  CloudSyncClientState,
  consumeCloudOAuthPkceCallback,
  getCloudSyncClientState,
  resetPersistedCloudCircuitBreaker,
  runCloudAppFolderSync,
  RunCloudAppFolderSyncResult,
} from '../storage/cloudAppFolderSync';
import {
  assertForegroundOrPause,
  BackgroundPausedError,
  clearPausedBackgroundJob,
  registerFreezeLifecycleListener,
} from '../storage/backgroundFreezeCoordinator';
import {
  emitAsyncErrorToast,
  isMemoryLikeError,
  logDiagnosticEvent,
  setCurrentDiagnosticRoute,
} from '../storage/crashLogger';
import {
  hydrateSnapshotWithPhotoDataUrls,
  stripPhotoDataUrlsFromSnapshot,
} from '../storage/photoHydration';
import { StorageAdapter } from '../storage/storageAdapter';
import {
  analyzeBarnDataHealth,
  BarnHealthRepairResult,
  BarnHealthReport,
  repairBarnDataHealth,
} from '../domain/dataHealthCheck';
import {
  checkStorageStatus,
  deleteRollingSnapshotBackup,
  getAdjustedNowIsoUtc,
  getAdjustedNowMs,
  getEffectiveOnlineStatus,
  isQuotaExceededError,
  listRollingSnapshotBackups,
  loadRollingSnapshotBackup,
  requestPersistentStorage,
  RollingBackupMeta,
  saveRollingSnapshotBackup,
  StorageProtectionStatus,
  useConnectivityStatus,
} from '../storage/storageProtection';
import { markPreUpgradeBackupVerified } from '../storage/pwaUpdateManager';
import {
  clearOpfsPruneSyncWarning,
  clearPriorUseSentinel,
  deleteOpfsHerdArchive,
  deleteOpfsVaultBackup,
  flushOpfsBackupsToSyncFolder,
  isOpfsSupported,
  listOpfsHerdArchives,
  listOpfsVaultBackups,
  loadOpfsHerdArchive,
  loadOpfsVaultBackup,
  markPriorUseSentinelFromSnapshot,
  OpfsPruneSyncWarning,
  readOpfsHerdArchiveBlob,
  readOpfsPruneSyncWarning,
  readOpfsVaultBackupBlob,
  runOpfsExportCanary,
  saveOpfsHerdArchive,
  saveOpfsVaultBackup,
  shouldCreateMonthlyOpfsBackup,
  shouldRunExportCanary,
  sweepOrphanedOpfsTmpOnBoot,
  WipedStorageRecoveryContext,
} from '../storage/opfsStorage';
import { purgeOpfsTmp } from '../storage/opfsTempStream';
import { purgeStaleBrowserCaches } from '../storage/webSqliteAdapter';
import type { GoogleCalendarOption } from '../app/pedigreeCalendarClient';
import {
  copyTextWithFallback,
  downloadBlobDirect,
  downloadTempOpfsExport,
  downloadTextFile,
  shareTextFileOrDownload,
} from '../utils/webFileActions';
import {
  createPedigreeDomainStorageAdapter,
  getDefaultPedigreeBridge,
} from '../app/pedigreeAppWiring';
import type { IPlatformBridge } from '@engine/bridge';
import type { PendingGoogleCalendarSync } from '../domain/calendarExport';
import {
  clearPhotoCache,
  forgetPhoto,
  rememberPhoto,
  usePhotoCache,
} from './barnStore/usePhotoCache';
import {
  clearStoredBackupReminderState,
  readStoredLastBackupMeta,
  readStoredSnoozedUntilMs,
  resolveEffectiveSnoozedUntilMs,
} from './barnStore/backupReminder';
import { useAlertDismissals } from './barnStore/useAlertDismissals';
import { useCloudSyncActions } from './barnStore/useCloudSyncActions';
import { useOpfsVaultActions } from './barnStore/useOpfsVaultActions';
import { useSyncConflictDismissal } from './barnStore/useSyncConflictDismissal';
import { useSyncConflictResolution } from './barnStore/useSyncConflictResolution';
import { useRollingBackupActions } from './barnStore/useRollingBackupActions';
import { useOpfsArchiveOffload } from './barnStore/useOpfsArchiveOffload';
import { useAnimalsCrud, type AnimalsCrudAdapter } from './barnStore/useAnimalsCrud';
import { usePhotoMutations, type PhotoMutationAdapter } from './barnStore/usePhotoMutations';
import { useBreeding, type BreedingAdapter } from './barnStore/useBreeding';
import { planSyncConflictRetention } from '../domain/syncConflictExpiry';
import { planSyncOperationRetention } from '../domain/syncRetention';
import { useBackupReminderActions } from './barnStore/useBackupReminderActions';
import {
  deleteEntityRecord,
  saveEntityRecord,
  type EntityCrudPorts,
} from './barnStore/entityCrudController';
import {
  installImportedSnapshot,
  type BackupImportPorts,
} from './barnStore/backupImportController';
import { createSliceCorePorts, type SliceCorePorts } from './barnStore/slicePorts';

export type WorkspaceRoute =
  | 'home'
  | 'dashboard'
  | 'herd'
  | 'bench'
  | 'breeding'
  | 'pedigree'
  | 'feed'
  | 'economics'
  | 'crm'
  | 'reports'
  | 'memo'
  | 'journal'
  | 'judge'
  | 'importExport'
  | 'settings'
  | 'development'
  | 'prompts'
  | 'suggestions';

export type { BreedingTaskCheckoffAction } from './barnStore/useBreeding';

export interface ActiveSpeciesData {
  speciesProfile: SpeciesProfile;
  animals: Animal[];
  activeAnimals: Animal[];
  archivedAnimals: Animal[];
  animalPhotos: AnimalPhoto[];
  photosByAnimalId: Map<string, AnimalPhoto[]>;
  primaryPhotoByAnimalId: Map<string, AnimalPhoto>;
  herdById: Map<string, Animal>;
  conflictsByAnimalId: Map<string, AnimalConflictSummary>;
  conflictedAnimalCount: number;
  activeConflictAnimalCount: number;
  coiByAnimalId: Map<string, CoiAnalysis>;
  cages: CageLocation[];
  breedings: BreedingRecord[];
  tasks: BarnTask[];
  careLogs: CareLog[];
  shows: ShowEvent[];
  feedBatches: FeedBatch[];
  feedAllocations: FeedAllocation[];
  ledgerEntries: LedgerEntry[];
  processingLogs: ProcessingLog[];
  youthProjectBooks: YouthProjectBook[];
  clientContacts: ClientContact[];
  waitlistEntries: WaitlistEntry[];
  animalReservations: AnimalReservation[];
  woolHarvests: WoolHarvest[];
  mileageLogs: MileageLog[];
  journalEntries: BarnJournalEntry[];
  judgeClubs: JudgeClubContact[];
  judgeAssignments: JudgeAssignment[];
  judgeExpenses: JudgeExpense[];
  testingRecordCount: number;
  nonTestingRecordCount: number;
  totalRecordCount: number;
}

const NON_SPECIES_ROUTES = new Set<WorkspaceRoute>([
  'home',
  'settings',
  'importExport',
  'development',
  'prompts',
  'suggestions',
]);

export interface UseBarnStoreOptions {
  storageAdapter?: StorageAdapter;
  bridge?: IPlatformBridge;
}

/** Non-standard Chromium heap metrics exposed at runtime by `performance.memory`. */
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export function useBarnStore(options?: UseBarnStoreOptions) {
  const activeBridge = useMemo<IPlatformBridge>(
    () => options?.bridge ?? getDefaultPedigreeBridge(),
    [options?.bridge]
  );
  const adapterRef = useRef<StorageAdapter | null>(options?.storageAdapter ?? null);
  if (!adapterRef.current) {
    adapterRef.current = createPedigreeDomainStorageAdapter({ bridge: activeBridge });
  }
  // Ancestor cache for pedigree lookup (originally removed)
  const pedigreeAncestorCacheRef = useRef<Map<string, Animal>>(new Map());

  const loadedPedigreeArchiveKeysRef = useRef<Set<string>>(new Set());
  const snapshotRef = useRef<BarnDatabaseSnapshot | null>(null);
  const writeQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const backgroundMaintenanceInFlightRef = useRef<boolean>(false);
  const offloadAnimalsRef = useRef<
    ((animalIds: string[]) => Promise<{
      archivedCount: number;
      stubCount: number;
      removedCount: number;
      fileName: string;
    } | null>) | null
  >(null);

  const { clockSkewMs } = useConnectivityStatus();
  const [deviceId] = useState<string>(() => getOrCreateLocalDeviceId());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [snapshot, setSnapshot] = useState<BarnDatabaseSnapshot | null>(null);
  snapshotRef.current = snapshot;
  const {
    photoCacheRef,
    loadAnimalPhotoDataUrl,
    loadAnimalPhotoDataUrlsBatch,
    loadFeedBatchTagPhotoDataUrl,
    loadLedgerEntryReceiptPhotoDataUrl,
  } = usePhotoCache({ adapterRef, snapshotRef, snapshot });
  // Monitor memory pressure and clear cache if needed
  useEffect(() => {
    // Only run in browsers exposing the non-standard Chromium `performance.memory` API
    if (typeof performance === 'undefined') return;
    const memoryPerformance = performance as Performance & { memory?: PerformanceMemory };
    if (memoryPerformance.memory) {
      const interval = setInterval(() => {
        const used = memoryPerformance.memory?.usedJSHeapSize ?? 0;
        const limit = memoryPerformance.memory?.jsHeapSizeLimit ?? Number.MAX_SAFE_INTEGER;
        // If usage exceeds 80% of limit, clear photo cache to free memory
        if (limit > 0 && used / limit > 0.8) {
          console.warn('High memory usage detected, clearing photo cache');
          clearPhotoCache(photoCacheRef);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, []);
  const [route, setRoute] = useState<WorkspaceRoute>('home');
  const routeHistoryRef = useRef<WorkspaceRoute[]>([]);
  const isApplyingHistoryStepRef = useRef<boolean>(false);
  const [activeSpeciesName, setActiveSpeciesName] = useState<string>('Rabbit');
  const activeSpeciesNameRef = useRef<string>(activeSpeciesName);
  activeSpeciesNameRef.current = activeSpeciesName;
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
  const [pedigreeAnimalId, setPedigreeAnimalId] = useState<string | null>(null);
  const [pedigreeGenerations, setPedigreeGenerations] = useState<PedigreeGenerationDepth>(3);
  const [preselectedGrowthAnimalIds, setPreselectedGrowthAnimalIds] = useState<string[] | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [highlightedCageId, setHighlightedCageId] = useState<string | null>(null);
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [googleAuthConnected, setGoogleAuthConnected] = useState<boolean>(false);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendarOption[]>([]);
  const [googleSyncBusy, setGoogleSyncBusy] = useState<boolean>(false);
  const [pendingCalendarSync, setPendingCalendarSync] =
    useState<PendingGoogleCalendarSync | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importConflictAlert, setImportConflictAlert] = useState<{
    message: string;
    speciesNames: string[];
    conflictedCount: number;
  } | null>(null);
  const [requestedHerdConflictNonce, setRequestedHerdConflictNonce] = useState<number>(0);
  const [storageStatus, setStorageStatus] = useState<StorageProtectionStatus | null>(null);
  const [syncOperations, setSyncOperations] = useState<SyncOperation[]>([]);
  const syncOperationsRef = useRef<SyncOperation[]>([]);
  syncOperationsRef.current = syncOperations;
  const [syncConflicts, setSyncConflicts] = useState<SyncConflictEntry[]>([]);
  const syncConflictsRef = useRef<SyncConflictEntry[]>([]);
  syncConflictsRef.current = syncConflicts;
  const [openAddSpeciesInSettings, setOpenAddSpeciesInSettings] = useState<boolean>(false);
  const [localLastBackupMeta, setLocalLastBackupMeta] = useState<LastBackupMeta | null>(
    readStoredLastBackupMeta
  );
  const [localSnoozedUntilMs, setLocalSnoozedUntilMs] = useState<number>(readStoredSnoozedUntilMs);
  const [opfsSupported] = useState<boolean>(() => isOpfsSupported());
  const [opfsVaultBackups, setOpfsVaultBackups] = useState<VaultBackupMetadata[]>([]);
  const [rollingBackups, setRollingBackups] = useState<RollingBackupMeta[]>([]);
  const [archivedHerdBundles, setArchivedHerdBundles] = useState<ArchivedHerdIndexEntry[]>([]);
  const [wipedRecoveryContext, setWipedRecoveryContext] =
    useState<WipedStorageRecoveryContext | null>(null);
  const [exportCanaryWarning, setExportCanaryWarning] = useState<string | null>(null);
  const [backupSyncStatus, setBackupSyncStatus] = useState<BackupSyncStatus | null>(null);
  const [pruneSyncWarning, setPruneSyncWarning] = useState<OpfsPruneSyncWarning | null>(() =>
    readOpfsPruneSyncWarning()
  );
  const [cloudSyncState, setCloudSyncState] = useState<CloudSyncClientState>(() =>
    getCloudSyncClientState()
  );
  const [cloudSyncBusy, setCloudSyncBusy] = useState<boolean>(false);
  const cloudBackgroundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleBackgroundCloudSyncRef = useRef<() => void>(() => {});

  const maxRevByEntityRef = useRef<Map<string, number>>(new Map());
  const maxRevIndexReadyRef = useRef<boolean>(false);
  const maxRevIndexPromiseRef = useRef<Promise<void> | null>(null);
  const syncOperationsHydratedRef = useRef<boolean>(false);

  // Bound the sync outbox on every full rewrite; the storage layer stays policy-free.
  const replaceSyncOperationsWithRetention = useCallback(async (operations: SyncOperation[]) => {
    const { retained, dropped } = planSyncOperationRetention(operations);
    if (dropped.length > 0) {
      logDiagnosticEvent({
        level: 'info',
        category: 'storage',
        message: `Sync outbox retention pruned ${dropped.length} expired operation(s), ${retained.length} retained.`,
      });
    }
    await replaceSyncOperationsInIdb(retained);
  }, []);

  const rebuildMaxRevIndex = useCallback((ops: SyncOperation[]) => {
    const map = new Map<string, number>();
    for (const op of ops) {
      if (typeof op.record_rev === 'number' && Number.isFinite(op.record_rev)) {
        const prev = map.get(op.entity_uuid) ?? 0;
        if (op.record_rev > prev) {
          map.set(op.entity_uuid, op.record_rev);
        }
      }
    }
    maxRevByEntityRef.current = map;
    maxRevIndexReadyRef.current = true;
  }, []);

  const mergeMaxRevIndex = useCallback((ops: SyncOperation[]) => {
    const map = maxRevByEntityRef.current;
    for (const op of ops) {
      if (typeof op.record_rev === 'number' && Number.isFinite(op.record_rev)) {
        const prev = map.get(op.entity_uuid) ?? 0;
        if (op.record_rev > prev) {
          map.set(op.entity_uuid, op.record_rev);
        }
      }
    }
    maxRevIndexReadyRef.current = true;
  }, []);

  const loadSyncOperationsFromIdbAndIndex = useCallback(async (): Promise<SyncOperation[]> => {
    const ops = await loadAllSyncOperationsFromIdb();
    mergeMaxRevIndex(ops);
    return ops;
  }, [mergeMaxRevIndex]);

  const ensureMaxRevIndexInitialized = useCallback((): Promise<void> => {
    if (maxRevIndexReadyRef.current) return Promise.resolve();
    if (!maxRevIndexPromiseRef.current) {
      maxRevIndexPromiseRef.current = loadAllSyncOperationsFromIdb()
        .then((ops) => {
          mergeMaxRevIndex(ops);
          if (syncOperationsHydratedRef.current) {
            syncOperationsRef.current = ops;
            setSyncOperations(ops);
          }
        })
        .catch((err) => {
          logDiagnosticEvent({
            level: 'warn',
            category: 'storage',
            message:
              'Corrective action: Failed loading local sync outbox on startup — initialized empty outbox queue',
            error: err,
          });
          maxRevIndexReadyRef.current = true;
        })
        .finally(() => {
          maxRevIndexPromiseRef.current = null;
        });
    }
    return maxRevIndexPromiseRef.current;
  }, [mergeMaxRevIndex]);

  const nextEntityRev = useCallback((entityUuid: string, currentRev?: number): number => {
    const revArg = typeof currentRev === 'number' && Number.isFinite(currentRev) ? currentRev : 0;
    const revIndexed = maxRevByEntityRef.current.get(entityUuid) ?? 0;
    const maxSeen = revArg > revIndexed ? revArg : revIndexed;
    return bumpRecordRevision({ _rev: maxSeen });
  }, []);

  const enqueueStoreMutation = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const next = writeQueueRef.current.then(task, task);
    // Keep queue chain alive even if an individual write rejects
    writeQueueRef.current = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }, []);

  const notify = useCallback((msg: string) => {
    setErrorMessage(null);
    setStatusMessage(msg);
  }, []);

  const reportPersistenceFailure = useCallback((actionLabel: string, err: unknown) => {
    if (err instanceof BackgroundPausedError || (err as { name?: string })?.name === 'BackgroundPausedError') {
      const paused = err as BackgroundPausedError;
      const isSeverity = Boolean(paused.severityIssue);
      logDiagnosticEvent({
        level: isSeverity ? 'warn' : 'info',
        category: 'lifecycle',
        message: paused.message,
      });
      emitAsyncErrorToast({
        title: isSeverity ? `${paused.taskName} Needs Attention` : `${paused.taskName} Paused`,
        detail: isSeverity
          ? `${paused.severityIssue} Tap Resume when ready.`
          : 'Progress was safely saved before switching apps and will auto-resume.',
        severity: isSeverity ? 'error' : 'warning',
        sticky: isSeverity,
        category: 'lifecycle',
        canOpenDiagnostics: isSeverity,
      });
      return;
    }
    const quotaHit = isQuotaExceededError(err);
    const memoryHit = isMemoryLikeError(err);
    logDiagnosticEvent({
      level: 'error',
      category: memoryHit ? 'memory' : 'storage',
      message: `${actionLabel} failed`,
      error: err,
    });
    setStatusMessage(null);
    if (quotaHit) {
      const msg = `Device storage is full while trying to ${actionLabel}. Open Recovery & Backups to download a backup, switch photos to Compact (960px), or free device space.`;
      setErrorMessage(msg);
    } else if (memoryHit) {
      const msg = `Low device memory while trying to ${actionLabel}. Close other browser tabs or use Compact photos in Import & Settings.`;
      setErrorMessage(msg);
    } else {
      const detail = err instanceof Error ? err.message : 'Local storage write failed.';
      const msg = `Could not ${actionLabel}: ${detail}`;
      setErrorMessage(msg);
    }
  }, []);

  const recordOutboxOps = useCallback(async (ops: SyncOperation[]) => {
    if (ops.length === 0) return;
    const writtenOps = await appendSyncOperationsToIdb(ops);
    const revMap = maxRevByEntityRef.current;
    for (const op of writtenOps) {
      if (typeof op.record_rev === 'number' && Number.isFinite(op.record_rev)) {
        const prev = revMap.get(op.entity_uuid) ?? 0;
        if (op.record_rev > prev) {
          revMap.set(op.entity_uuid, op.record_rev);
        }
      }
    }
    if (syncOperationsHydratedRef.current) {
      const nextOps = [...syncOperationsRef.current, ...writtenOps];
      syncOperationsRef.current = nextOps;
      setSyncOperations(nextOps);
    }
    // Schedule non-blocking background cloud delta sync after local IDB outbox commit succeeds.
    // Cloud sync errors (including 403/507 quota) never block or roll back IndexedDB writes.
    try {
      scheduleBackgroundCloudSyncRef.current();
    } catch {
      // Non-blocking safeguard
    }
  }, []);

  const clearLocalSyncAndBackupReminderState = useCallback(async () => {
    if (cloudBackgroundTimerRef.current !== null) {
      clearTimeout(cloudBackgroundTimerRef.current);
      cloudBackgroundTimerRef.current = null;
    }
    await clearAllSyncStateInIdb();
    const { clearAllVetDocsFolderState } = await import('../storage/vetDocsFolder');
    await clearAllVetDocsFolderState();
    clearPausedBackgroundJob('directory_sync');
    clearAllCloudSyncState();
    setCloudSyncState(getCloudSyncClientState());
    maxRevByEntityRef.current.clear();
    maxRevIndexReadyRef.current = true;
    syncOperationsRef.current = [];
    setSyncOperations([]);
    syncConflictsRef.current = [];
    setSyncConflicts([]);
    setLocalLastBackupMeta(null);
    setLocalSnoozedUntilMs(0);
    clearStoredBackupReminderState();
    const { clearWeatherForecastCache } = await import('../storage/weatherForecast');
    clearWeatherForecastCache();
  }, []);

  const refreshStorageStatus = useCallback(async () => {
    const status = await checkStorageStatus();
    setStorageStatus(status);
    return status;
  }, []);

  const purgeOpfsTempWorkspace = useCallback(async (): Promise<{
    filesRemoved: number;
    bytesFreed: number;
  }> => {
    const result = await purgeOpfsTmp();
    await refreshStorageStatus();
    return result;
  }, [refreshStorageStatus]);

  const refreshVaultAndArchives = useCallback(async () => {
    const [opfsRes, rollingRes, archivesRes, syncRes] = await Promise.allSettled([
      listOpfsVaultBackups(),
      listRollingSnapshotBackups(),
      listOpfsHerdArchives(),
      getPersistedBackupSyncStatus(),
    ]);
    if (opfsRes.status === 'fulfilled') setOpfsVaultBackups(opfsRes.value);
    if (rollingRes.status === 'fulfilled') setRollingBackups(rollingRes.value);
    if (archivesRes.status === 'fulfilled') setArchivedHerdBundles(archivesRes.value);
    if (syncRes.status === 'fulfilled') setBackupSyncStatus(syncRes.value);
    setPruneSyncWarning(readOpfsPruneSyncWarning());
  }, []);

  const triggerPersistentStorageRequest = useCallback(async () => {
    const status = await requestPersistentStorage();
    setStorageStatus(status);
    notify(
      status.persisted
        ? 'Persistent local storage lock granted by browser.'
        : 'Browser kept standard storage mode. Install to Home Screen to elevate storage protection.'
    );
    return status;
  }, [notify]);

  // Sync active route into diagnostic logger
  useEffect(() => {
    setCurrentDiagnosticRoute(route);
  }, [route]);

  // Sync WorkspaceRoute steps with browser history (without interfering with ?emergency_reset=true)
  useEffect(() => {
    if (isLoading || typeof window === 'undefined') return;
    const stack = routeHistoryRef.current;
    const isWrapped = activeBridge.getCapabilities().hasNativeBridge;

    if (isApplyingHistoryStepRef.current) {
      isApplyingHistoryStepRef.current = false;
      return;
    }

    if (stack.length === 0) {
      stack.push(route);
      if (!isWrapped) {
        try {
          const currentState =
            window.history.state && typeof window.history.state === 'object'
              ? window.history.state
              : {};
          window.history.replaceState(
            { ...currentState, pedigreeRoute: route },
            '',
            window.location.href
          );
        } catch {
          // Ignore history restriction
        }
      }
      return;
    }

    if (route === 'home') {
      const alreadyAtHome = stack[stack.length - 1] === 'home';
      routeHistoryRef.current = ['home'];
      if (!alreadyAtHome && !isWrapped) {
        try {
          window.history.pushState({ pedigreeRoute: 'home' }, '', window.location.href);
        } catch {
          // Ignore history restriction
        }
      }
      return;
    }

    if (stack[stack.length - 1] !== route) {
      stack.push(route);
      if (stack.length > 50) {
        stack.splice(1, stack.length - 50);
      }
      if (!isWrapped) {
        try {
          window.history.pushState({ pedigreeRoute: route }, '', window.location.href);
        } catch {
          // Ignore history restriction
        }
      }
    }
  }, [activeBridge, route, isLoading]);

  useEffect(() => {
    if (typeof window === 'undefined' || activeBridge.getCapabilities().hasNativeBridge) return;
    const onPopState = (event: PopStateEvent) => {
      if (isLoading) return;
      const state = event.state as { pedigreeRoute?: WorkspaceRoute; pedigreeModal?: boolean } | null;
      if (state && state.pedigreeModal) {
        return;
      }
      const stack = routeHistoryRef.current;
      // If a modal history entry popped back to the already-active route, keep route stack intact
      if (state && state.pedigreeRoute && state.pedigreeRoute === stack[stack.length - 1]) {
        return;
      }
      if (stack.length > 1) {
        stack.pop();
      }
      const nextRoute =
        (state && state.pedigreeRoute) ||
        stack[stack.length - 1] ||
        'home';
      isApplyingHistoryStepRef.current = true;
      setRoute(nextRoute);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [activeBridge, isLoading]);

  // Priority 0 LIFO route step-back handler (modals register at priority >= 5 so they unwind first)
  useEffect(() => {
    return activeBridge.registerBackHandler(() => {
      if (route === 'home') {
        routeHistoryRef.current = ['home'];
        return false;
      }
      const stack = routeHistoryRef.current;
      if (stack.length > 1) {
        stack.pop();
        const prevRoute = stack[stack.length - 1] || 'home';
        isApplyingHistoryStepRef.current = true;
        setRoute(prevRoute);
        try {
          window.history.replaceState({ pedigreeRoute: prevRoute }, '', window.location.href);
        } catch {
          // Ignore history restriction
        }
        return true;
      }
      routeHistoryRef.current = ['home'];
      isApplyingHistoryStepRef.current = true;
      setRoute('home');
      try {
        window.history.replaceState({ pedigreeRoute: 'home' }, '', window.location.href);
      } catch {
        // Ignore history restriction
      }
      return true;
    }, 0);
  }, [activeBridge, route]);

  // Monitor Google Calendar auth state only when direct Google Calendar mode is enabled
  const calendarDeliveryMode = snapshot?.settings.calendarSync?.deliveryMode;
  useEffect(() => {
    if (calendarDeliveryMode !== 'google_calendar') {
      setGoogleAuthConnected(false);
      setGoogleUserEmail(null);
      return;
    }
    let cancelled = false;
    let teardown: (() => void) | undefined;
    void import('../app/pedigreeCalendarClient').then(({ initGoogleCalendarAuth }) => {
      if (cancelled) return;
      teardown = initGoogleCalendarAuth(
        (user) => {
          setGoogleAuthConnected(true);
          setGoogleUserEmail(user.email || user.displayName || 'Google Account');
        },
        (user) => {
          setGoogleAuthConnected(false);
          setGoogleUserEmail(user?.email || null);
        }
      );
    });
    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [calendarDeliveryMode]);

  // Initialize local SQLite / IndexedDB store for fast first paint; defer non-critical probes & auto-repair
  useEffect(() => {
    let mounted = true;
    let deferredTimerId: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      try {
        const adapter = adapterRef.current!;
        const initial = await adapter.initialize({ lightweightPhotos: true });
        const detectedWiped = adapter.getWipedRecoveryContext?.() ?? null;
        const corruptionNotice = adapter.getCorruptionRecoveryNotice?.() ?? null;
        if (!detectedWiped?.detected) {
          void sweepOrphanedOpfsTmpOnBoot();
          markPriorUseSentinelFromSnapshot(initial);
        } else {
          void refreshVaultAndArchives();
        }

        if (!mounted) return;
        snapshotRef.current = initial;
        setSnapshot(initial);
        setWipedRecoveryContext(detectedWiped && detectedWiped.detected ? detectedWiped : null);
        if (corruptionNotice) {
          setErrorMessage(corruptionNotice);
        }
        setPedigreeGenerations(initial.settings.defaultGenerations);

        const deepTarget = parseAppDeepLinkParams(
          typeof window !== 'undefined' ? window.location.search : ''
        );
        const deepTask = deepTarget.taskId
          ? initial.tasks.find((t) => t.id === deepTarget.taskId)
          : undefined;
        const deepAnimal = deepTarget.animalId
          ? initial.animals.find((a) => a.id === deepTarget.animalId)
          : undefined;
        const deepCage = deepTarget.cageId
          ? initial.cages.find((c) => c.id === deepTarget.cageId)
          : undefined;

        if (deepAnimal) {
          setActiveSpeciesName(deepAnimal.species);
          setSelectedAnimalId(deepAnimal.id);
          setRoute('herd');
        } else if (deepCage) {
          setActiveSpeciesName(deepCage.species);
          setHighlightedCageId(deepCage.id);
          setRoute('dashboard');
        } else if (deepTask) {
          setActiveSpeciesName(deepTask.species);
          setRoute('dashboard');
          setHighlightedTaskId(deepTask.id);
        } else if (deepTarget.species) {
          const matchedDeepSpecies = initial.speciesProfiles.find((sp) =>
            isSameSpecies(sp.name, deepTarget.species)
          );
          if (matchedDeepSpecies) {
            setActiveSpeciesName(matchedDeepSpecies.name);
            setRoute(deepTarget.route === 'herd' ? 'herd' : 'dashboard');
          } else {
            setActiveSpeciesName(initial.settings.defaultSpecies || 'Rabbit');
            setRoute('home');
          }
          if (deepTarget.animalId) {
            setStatusMessage(
              'Scanned animal profile was not found in local records on this device (it may have been deleted or live on another device).'
            );
          } else if (deepTarget.cageId) {
            setStatusMessage(
              'Linked cage or pen was not found in local records (it may have been deleted).'
            );
          } else if (deepTarget.taskId) {
            setStatusMessage(
              'Linked calendar chore was not found in local records (it may have been deleted).'
            );
          }
        } else if (deepTarget.animalId || deepTarget.cageId || deepTarget.taskId) {
          setActiveSpeciesName(initial.settings.defaultSpecies || 'Rabbit');
          setRoute('home');
          setStatusMessage(
            deepTarget.animalId
              ? 'Scanned animal profile was not found in local records on this device.'
              : deepTarget.cageId
                ? 'Linked cage or pen was not found in local records on this device.'
                : 'Linked calendar chore was not found in local records on this device.'
          );
        } else {
          const pinned = (initial.settings.pinnedLandingSpecies || '').trim();
          const matchedPinned = pinned
            ? initial.speciesProfiles.find((sp) => isSameSpecies(sp.name, pinned))
            : undefined;

          if (matchedPinned) {
            setActiveSpeciesName(matchedPinned.name);
            setRoute('dashboard');
          } else {
            setActiveSpeciesName(initial.settings.defaultSpecies || 'Rabbit');
            setRoute('home');
          }
        }

        if (
          typeof window !== 'undefined' &&
          !deepTarget.emergencyReset &&
          deepTarget.hasDeepLink
        ) {
          try {
            window.history.replaceState({}, '', window.location.pathname);
          } catch (historyErr) {
            logDiagnosticEvent({
              level: 'warn',
              category: 'runtime',
              message:
                'Corrective action: Could not clean deep-link URL query parameters via history.replaceState — continuing normally',
              error: historyErr,
            });
          }
        }
        logDiagnosticEvent({
          level: 'info',
          category: 'storage',
          message: `Database initialized (${adapter.engineName}: ${initial.animals.length} animals, ${(initial.animalPhotos ?? []).length} photos)`,
        });
        setIsLoading(false);

        // Defer non-critical startup probes, outbox revision index warming, and health auto-repair off first paint
        deferredTimerId = setTimeout(() => {
          if (!mounted) return;
          void refreshVaultAndArchives();

          void requestPersistentStorage()
            .then((persistedStatus) => {
              if (mounted) setStorageStatus(persistedStatus);
            })
            .catch((err) => {
              logDiagnosticEvent({
                level: 'warn',
                category: 'storage',
                message:
                  'Corrective action: Persistent storage status check failed on startup — continuing with standard storage probe',
                error: err,
              });
            });

          void loadAllSyncConflictsFromIdb()
            .then((conflicts) => {
              if (!mounted) return;
              // Only already-resolved rows expire; an open conflict is a decision nobody has made.
              const { kept, expired } = planSyncConflictRetention(conflicts);
              if (expired.length > 0) {
                void deleteSyncConflictsFromIdb(expired.map((c) => c.conflict_id));
                logDiagnosticEvent({
                  level: 'info',
                  category: 'storage',
                  message: `Pruned ${expired.length} resolved sync conflict(s) past the retention window; ${kept.length} kept.`,
                });
              }
              syncConflictsRef.current = kept;
              setSyncConflicts(kept);
            })
            .catch((err) => {
              logDiagnosticEvent({
                level: 'warn',
                category: 'storage',
                message:
                  'Corrective action: Failed loading sync conflicts on startup — initialized empty conflict list',
                error: err,
              });
            });

          void ensureMaxRevIndexInitialized();

          // Non-destructive deferred startup health check & auto-repair serialized through write queue
          try {
            const healthCandidate = snapshotRef.current ?? initial;
            const healthReport = analyzeBarnDataHealth(healthCandidate);
            if (healthReport.autoRepairableCount > 0) {
              void enqueueStoreMutation(async () => {
                const latestSnap = snapshotRef.current;
                if (!mounted || !latestSnap) return;
                const repaired = repairBarnDataHealth(latestSnap);
                if (repaired.repairsApplied.length === 0) return;
                try {
                  await adapter.replaceSnapshot(repaired.nextSnapshot);
                } catch (persistRepairErr) {
                  logDiagnosticEvent({
                    level: 'warn',
                    category: 'storage',
                    message:
                      'Corrective action: Startup auto-repair applied in memory (disk re-save deferred)',
                    error: persistRepairErr,
                    details: repaired.repairsApplied,
                  });
                }
                if (mounted) {
                  snapshotRef.current = repaired.nextSnapshot;
                  setSnapshot(repaired.nextSnapshot);
                }
                logDiagnosticEvent({
                  level: 'warn',
                  category: 'storage',
                  message: `Corrective action: Startup health auto-repair fixed ${repaired.repairsApplied.length} database issue(s): ${repaired.repairsApplied.join(' | ')}`,
                  details: repaired.repairsApplied,
                });
              });
            }
          } catch (healthErr) {
            logDiagnosticEvent({
              level: 'warn',
              category: 'storage',
              message:
                'Corrective action: Startup health scan skipped due to unexpected error — kept loaded snapshot intact',
              error: healthErr,
            });
          }
        }, 0);
      } catch (err) {
        logDiagnosticEvent({
          level: 'fatal',
          category: isMemoryLikeError(err) ? 'memory' : 'storage',
          message: 'Database initialization failed during app startup — attempting emergency recovery',
          error: err,
        });

        let emergencySnapshot: BarnDatabaseSnapshot | null = null;
        let recoverySource = 'starter snapshot';
        try {
          const rollingList = await listRollingSnapshotBackups();
          for (const item of rollingList) {
            const recovered = await loadRollingSnapshotBackup(item.key);
            if (recovered) {
              emergencySnapshot = recovered;
              recoverySource = `rolling backup (${item.savedAtIso})`;
              break;
            }
          }
        } catch (rollingErr) {
          logDiagnosticEvent({
            level: 'warn',
            category: 'storage',
            message: 'Emergency startup rolling backup scan failed — using clean starter snapshot',
            error: rollingErr,
          });
        }

        if (!emergencySnapshot) {
          const { buildFullPredefinedSampleSnapshot } = await import('../domain/sampleData');
          emergencySnapshot = buildFullPredefinedSampleSnapshot();
        }

        logDiagnosticEvent({
          level: 'warn',
          category: 'storage',
          message: `Corrective action: Startup crash auto-recovered using ${recoverySource} (${emergencySnapshot.animals.length} animals)`,
          error: err,
        });

        if (mounted) {
          setSnapshot(stripPhotoDataUrlsFromSnapshot(emergencySnapshot));
          setPedigreeGenerations(emergencySnapshot.settings.defaultGenerations || 3);
          setActiveSpeciesName(emergencySnapshot.settings.defaultSpecies || 'Rabbit');
          setRoute('home');
          setErrorMessage(
            `Local database hit a startup error and automatically recovered using ${recoverySource}. Open Import & Settings -> Diagnostics & Support to inspect logs.`
          );
          setIsLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
      if (deferredTimerId !== null) {
        clearTimeout(deferredTimerId);
      }
    };
  }, []);

  // Hydrate full syncOperations array only on routes that render sync/outbox UI; release on other routes
  const isSyncOperationsRoute = route === 'importExport' || route === 'dashboard';
  useEffect(() => {
    if (isLoading) return;
    if (!isSyncOperationsRoute) {
      syncOperationsHydratedRef.current = false;
      syncOperationsRef.current = [];
      setSyncOperations((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    let active = true;
    syncOperationsHydratedRef.current = true;
    void loadSyncOperationsFromIdbAndIndex()
      .then((ops) => {
        if (!active || !syncOperationsHydratedRef.current) return;
        syncOperationsRef.current = ops;
        setSyncOperations(ops);
      })
      .catch(() => {
        // Non-fatal; outbox remains safely in IndexedDB
      });
    return () => {
      active = false;
    };
  }, [isLoading, isSyncOperationsRoute, loadSyncOperationsFromIdbAndIndex]);

  // Sync light/dark class and resolved warm/custom CSS variables on <html>
  useEffect(() => {
    if (!snapshot) return;
    const root = document.documentElement;
    if (snapshot.settings.themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const vars = resolveThemeCssVariables(
      snapshot.settings.themeMode,
      snapshot.settings.customColors
    );
    for (const [prop, val] of Object.entries(vars)) {
      root.style.setProperty(prop, val);
    }
  }, [snapshot]);

  // Auto-clear transient status banner after 5s
  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  /**
   * Switches the active livestock species and clears any cross-species animal selection
   * so records from another species can NEVER bleed into the new species workspace.
   */
  const selectSpeciesWorkspace = useCallback(
    (speciesName: string, targetRoute: WorkspaceRoute = 'dashboard') => {
      if (!isSameSpecies(activeSpeciesNameRef.current, speciesName)) {
        pedigreeAncestorCacheRef.current.clear();
        loadedPedigreeArchiveKeysRef.current.clear();
      }
      setActiveSpeciesName(speciesName);
      setSelectedAnimalId(null);
      setPedigreeAnimalId(null);
      setHighlightedTaskId(null);
      setRoute(targetRoute);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    },
    []
  );

  const isNonSpeciesRoute = NON_SPECIES_ROUTES.has(route);

  /**
   * Strictly species-isolated slice of all records for `activeSpeciesName`.
   * Skips heavy filtering/sorting when viewing global non-species routes (`home`, `settings`, etc.).
   */
  const baseSpeciesData = useMemo(() => {
    if (!snapshot) return null;
    const speciesProfile = resolveSpeciesProfile(activeSpeciesName, snapshot.speciesProfiles);
    if (isNonSpeciesRoute) {
      return {
        speciesProfile,
        animals: [],
        activeAnimals: [],
        archivedAnimals: [],
        animalPhotos: [],
        photosByAnimalId: new Map<string, AnimalPhoto[]>(),
        primaryPhotoByAnimalId: new Map<string, AnimalPhoto>(),
        herdById: new Map<string, Animal>(),
        cages: [],
        breedings: [],
        tasks: [],
        careLogs: [],
        shows: [],
        feedBatches: [],
        feedAllocations: [],
        ledgerEntries: [],
        processingLogs: [],
        youthProjectBooks: [],
        clientContacts: [],
        waitlistEntries: [],
        animalReservations: [],
        woolHarvests: [],
        mileageLogs: [],
        journalEntries: [],
        judgeClubs: [],
        judgeAssignments: [],
        judgeExpenses: [],
        testingRecordCount: 0,
        nonTestingRecordCount: 0,
        totalRecordCount: 0,
      };
    }
    const animals = selectSpeciesAnimals(snapshot.animals, speciesProfile.name);

    const activeAnimals = animals.filter((a) => !isAnimalArchived(a));
    const archivedAnimals = animals.filter((a) => isAnimalArchived(a));
    const archivedIds = new Set(archivedAnimals.map((a) => a.id));

    const herdById = buildSpeciesHerdMap(animals, speciesProfile.name);
    const cages = selectSpeciesCages(snapshot.cages, speciesProfile.name);
    const breedings = selectSpeciesBreedings(snapshot.breedings, speciesProfile.name);
    // Archived animals stay in storage for pedigrees but do not generate active incomplete tasks
    const tasks = selectSpeciesTasks(snapshot.tasks, speciesProfile.name, archivedAnimals);
    const careLogs = selectSpeciesCareLogs(snapshot.careLogs, speciesProfile.name);
    const { animalPhotos, photosByAnimalId, primaryPhotoByAnimalId } = selectSpeciesPhotoIndex(
      snapshot.animalPhotos ?? [],
      speciesProfile.name
    );
    const shows = selectSpeciesShows(snapshot.shows, speciesProfile.name);
    const feedBatches = selectSpeciesFeedBatches(snapshot.feedBatches, speciesProfile.name);
    const feedAllocations = selectSpeciesFeedAllocations(
      snapshot.feedAllocations,
      speciesProfile.name
    );
    const ledgerEntries = selectSpeciesLedgerEntries(snapshot.ledgerEntries, speciesProfile.name);
    const processingLogs = selectSpeciesProcessingLogs(
      snapshot.processingLogs,
      speciesProfile.name
    );
    const youthProjectBooks = selectSpeciesYouthProjectBooks(
      snapshot.youthProjectBooks,
      speciesProfile.name
    );
    const clientContacts = selectSpeciesClientContacts(
      snapshot.clientContacts,
      speciesProfile.name
    );
    const waitlistEntries = selectSpeciesWaitlistEntries(
      snapshot.waitlistEntries,
      speciesProfile.name
    );
    const animalReservations = selectSpeciesAnimalReservations(
      snapshot.animalReservations,
      speciesProfile.name
    );
    const woolHarvests = selectSpeciesWoolHarvests(snapshot.woolHarvests, speciesProfile.name);
    const mileageLogs = selectSpeciesMileageLogs(snapshot.mileageLogs, speciesProfile.name);
    const journalEntries = selectSpeciesJournalEntries(
      snapshot.journalEntries,
      speciesProfile.name
    );
    const judgeClubs = selectSpeciesJudgeClubs(snapshot.judgeClubs, speciesProfile.name);
    const judgeAssignments = selectSpeciesJudgeAssignments(
      snapshot.judgeAssignments,
      speciesProfile.name
    );
    const judgeExpenses = selectSpeciesJudgeExpenses(snapshot.judgeExpenses, speciesProfile.name);

    const testingRecordCount = countSpeciesTestingRecords(snapshot, speciesProfile.name);
    const nonTestingRecordCount = countSpeciesNonTestingRecords(snapshot, speciesProfile.name);
    const totalRecordCount = countAllSpeciesRecords(snapshot, speciesProfile.name);

    return {
      speciesProfile,
      animals,
      activeAnimals,
      archivedAnimals,
      animalPhotos,
      photosByAnimalId,
      primaryPhotoByAnimalId,
      herdById,
      cages,
      breedings,
      tasks,
      careLogs,
      shows,
      feedBatches,
      feedAllocations,
      ledgerEntries,
      processingLogs,
      youthProjectBooks,
      clientContacts,
      waitlistEntries,
      animalReservations,
      woolHarvests,
      mileageLogs,
      journalEntries,
      judgeClubs,
      judgeAssignments,
      judgeExpenses,
      testingRecordCount,
      nonTestingRecordCount,
      totalRecordCount,
    };
  }, [snapshot, activeSpeciesName, isNonSpeciesRoute]);

  const conflictsBySpeciesAnimalId = useMemo(() => {
    if (!baseSpeciesData || isNonSpeciesRoute || baseSpeciesData.animals.length === 0) {
      return {
        map: new Map<string, AnimalConflictSummary>(),
        conflictedAnimalCount: 0,
        activeConflictAnimalCount: 0,
      };
    }
    const map = analyzeBarnAnimalConflicts(baseSpeciesData.animals);
    let conflictedAnimalCount = 0;
    let activeConflictAnimalCount = 0;
    for (const summary of map.values()) {
      if (summary.hasAnyConflict) conflictedAnimalCount++;
      if (summary.hasActiveConflict) activeConflictAnimalCount++;
    }
    return { map, conflictedAnimalCount, activeConflictAnimalCount };
  }, [baseSpeciesData, isNonSpeciesRoute]);

  const coiByAnimalId = useMemo(() => {
    const map = new Map<string, CoiAnalysis>();
    if (!baseSpeciesData || isNonSpeciesRoute || baseSpeciesData.animals.length === 0) return map;
    if (route === 'pedigree') {
      const targetSubject =
        (pedigreeAnimalId && baseSpeciesData.herdById.get(pedigreeAnimalId)) ||
        baseSpeciesData.animals[0] ||
        null;
      if (targetSubject) {
        const evaluator = createSpeciesCoiEvaluator(baseSpeciesData.herdById);
        map.set(targetSubject.id, evaluator.calculateAnimalCoi(targetSubject));
      }
    } else if (route === 'herd' && selectedAnimalId) {
      const selected = baseSpeciesData.herdById.get(selectedAnimalId);
      if (selected) {
        const evaluator = createSpeciesCoiEvaluator(baseSpeciesData.herdById);
        map.set(selected.id, evaluator.calculateAnimalCoi(selected));
      }
    }
    return map;
  }, [baseSpeciesData, isNonSpeciesRoute, route, pedigreeAnimalId, selectedAnimalId]);

  const activeSpeciesData: ActiveSpeciesData | null = useMemo(() => {
    if (!baseSpeciesData) return null;
    return {
      ...baseSpeciesData,
      conflictsByAnimalId: conflictsBySpeciesAnimalId.map,
      conflictedAnimalCount: conflictsBySpeciesAnimalId.conflictedAnimalCount,
      activeConflictAnimalCount: conflictsBySpeciesAnimalId.activeConflictAnimalCount,
      coiByAnimalId,
    };
  }, [baseSpeciesData, conflictsBySpeciesAnimalId, coiByAnimalId]);

  const effectiveLastBackupMeta: LastBackupMeta | null =
    snapshot?.settings.lastBackupMeta ?? localLastBackupMeta;

  const effectiveBackupSnoozedUntilMs: number = resolveEffectiveSnoozedUntilMs(
    snapshot?.settings.backupReminderSnoozedUntilMs,
    localSnoozedUntilMs
  );

  const backupStatus: BackupStatusEvaluation | null = useMemo(() => {
    if (!snapshot) return null;
    void clockSkewMs;
    return evaluateBackupStatus(
      snapshot,
      effectiveLastBackupMeta,
      getAdjustedNowMs(),
      effectiveBackupSnoozedUntilMs
    );
  }, [snapshot, effectiveLastBackupMeta, effectiveBackupSnoozedUntilMs, clockSkewMs]);

  const hydrateSnapshotForExport = useCallback(
    async (
      targetSnapshot?: BarnDatabaseSnapshot,
      filterSpecies?: string
    ): Promise<BarnDatabaseSnapshot> => {
      if (!targetSnapshot) {
        await writeQueueRef.current.catch(() => undefined);
      }
      const liveSnap = snapshotRef.current;
      const base =
        targetSnapshot &&
        !(targetSnapshot.animals.length === 0 && liveSnap && liveSnap.animals.length > 0)
          ? targetSnapshot
          : liveSnap;
      if (!base) {
        throw new Error('Local database is not loaded yet.');
      }
      return hydrateSnapshotWithPhotoDataUrls(
        base,
        async (ids) =>
          (await adapterRef.current?.loadAnimalPhotoDataUrlsBatch?.(ids)) ?? {},
        filterSpecies,
        photoCacheRef.current ?? undefined,
        {
          fetchFeedTagBatch: async (ids) =>
            (await adapterRef.current?.loadFeedBatchTagPhotoDataUrlsBatch?.(ids)) ?? {},
          fetchLedgerReceiptBatch: async (ids) =>
            (await adapterRef.current?.loadLedgerEntryReceiptPhotoDataUrlsBatch?.(ids)) ?? {},
        }
      );
    },
    []
  );

  const mirrorSnapshotToNativeVaultIfWrapped = useCallback(
    async (
      hydratedSnapshot: BarnDatabaseSnapshot,
      kind: 'manual' | 'monthly' | 'pre_reset' | 'pre_upgrade'
    ): Promise<boolean> => {
      if (
        !activeBridge.getCapabilities().hasNativeBridge ||
        !activeBridge.invokeStorageBridge ||
        typeof TextEncoder === 'undefined'
      ) {
        return false;
      }
      try {
        const encoder = new TextEncoder();
        const MAX_NATIVE_MIRROR_BYTES = 14 * 1024 * 1024;
        const estimatedPhotoPayloadBytes = (hydratedSnapshot.animalPhotos ?? []).reduce(
          (sum, photo) => sum + (photo.dataUrl?.length ?? 0),
          0
        );
        let photosDehydrated = estimatedPhotoPayloadBytes > 10 * 1024 * 1024;
        let payloadSnapshot = photosDehydrated
          ? stripPhotoDataUrlsFromSnapshot(hydratedSnapshot)
          : hydratedSnapshot;
        let encoded = encoder.encode(JSON.stringify(payloadSnapshot));
        if (!photosDehydrated && encoded.byteLength > MAX_NATIVE_MIRROR_BYTES) {
          payloadSnapshot = stripPhotoDataUrlsFromSnapshot(hydratedSnapshot);
          encoded = encoder.encode(JSON.stringify(payloadSnapshot));
          photosDehydrated = true;
        }
        if (encoded.byteLength > 15.5 * 1024 * 1024) {
          return false;
        }
        const snapshotId = `${kind}_${Date.now()}`;
        const result = await activeBridge.invokeStorageBridge({
          action: 'vaultSnapshot',
          key: snapshotId,
          data: encoded,
          options: {
            snapshotId,
            createdAt: getAdjustedNowIsoUtc(),
            format: 'json',
            metadata: {
              kind,
              animalCount: payloadSnapshot.animals.length,
              photosDehydrated,
            },
          },
        });
        return result.ok;
      } catch {
        return false;
      }
    },
    [activeBridge]
  );

  const saveSafetyRollingBackup = useCallback(
    async (targetSnapshot: BarnDatabaseSnapshot, note?: string): Promise<void> => {
      const hydrated = await hydrateSnapshotForExport(targetSnapshot);
      await Promise.allSettled([
        saveRollingSnapshotBackup(hydrated),
        isOpfsSupported()
          ? saveOpfsVaultBackup(hydrated, {
              kind: 'pre_reset',
              note: note || 'Automatic pre-destructive safety snapshot',
            })
          : Promise.resolve(null),
        mirrorSnapshotToNativeVaultIfWrapped(hydrated, 'pre_reset'),
      ]);
      void refreshVaultAndArchives();
    },
    [hydrateSnapshotForExport, mirrorSnapshotToNativeVaultIfWrapped, refreshVaultAndArchives]
  );

  const loadPedigreeNeighborhood = useCallback(
    async (rootIds: string[], maxDepth: number): Promise<Animal[]> => {
      const cleanRoots = Array.from(
        new Set(rootIds.filter((id) => typeof id === 'string' && id.trim().length > 0))
      );
      if (cleanRoots.length === 0) return [];
      const boundedDepth = Math.min(8, Math.max(0, Math.floor(maxDepth)));
      const adapter = adapterRef.current;

      const resolvedMap = new Map<string, Animal>();
      if (adapter?.queryPedigreeNeighborhood) {
        const rows = await adapter.queryPedigreeNeighborhood(cleanRoots, boundedDepth);
        for (const a of rows) {
          resolvedMap.set(a.id, a);
        }
      } else {
        const all = snapshotRef.current?.animals ?? [];
        const byId = new Map<string, Animal>(all.map((a) => [a.id, a]));
        const visited = new Set<string>();
        let frontier = cleanRoots;
        for (let depth = 0; depth <= boundedDepth && frontier.length > 0; depth++) {
          const nextFrontier: string[] = [];
          for (const id of frontier) {
            if (visited.has(id)) continue;
            visited.add(id);
            const found = byId.get(id);
            if (!found) continue;
            resolvedMap.set(found.id, found);
            if (depth < boundedDepth) {
              if (found.sireId && !visited.has(found.sireId)) nextFrontier.push(found.sireId);
              if (found.damId && !visited.has(found.damId)) nextFrontier.push(found.damId);
            }
          }
          frontier = nextFrontier;
        }
      }

      // Hydrate any offloaded OPFS /archives ancestor stubs lazily from cache or OPFS
      const cache = pedigreeAncestorCacheRef.current;
      const walkCacheParents = () => {
        let extraFrontier: string[] = [];
        for (const a of resolvedMap.values()) {
          if (a.sireId && !resolvedMap.has(a.sireId)) extraFrontier.push(a.sireId);
          if (a.damId && !resolvedMap.has(a.damId)) extraFrontier.push(a.damId);
        }
        for (let step = 0; step < boundedDepth && extraFrontier.length > 0; step++) {
          const nextExtra: string[] = [];
          for (const pid of extraFrontier) {
            if (resolvedMap.has(pid)) continue;
            const cachedParent = cache.get(pid);
            if (cachedParent) {
              // Refresh LRU position
              cache.delete(pid);
              cache.set(pid, cachedParent);
              resolvedMap.set(cachedParent.id, cachedParent);
              if (cachedParent.sireId && !resolvedMap.has(cachedParent.sireId)) {
                nextExtra.push(cachedParent.sireId);
              }
              if (cachedParent.damId && !resolvedMap.has(cachedParent.damId)) {
                nextExtra.push(cachedParent.damId);
              }
            }
          }
          extraFrontier = nextExtra;
        }
      };

      walkCacheParents();

      const candidateArchiveKeys = new Set<string>();
      for (const a of resolvedMap.values()) {
        if (!a.offloadedArchiveKey) continue;
        const missingParent =
          (a.sireId && !resolvedMap.has(a.sireId)) ||
          (a.damId && !resolvedMap.has(a.damId));
        if (
          missingParent ||
          !loadedPedigreeArchiveKeysRef.current.has(a.offloadedArchiveKey)
        ) {
          candidateArchiveKeys.add(a.offloadedArchiveKey);
        }
      }
      if (candidateArchiveKeys.size > 0 && isOpfsSupported()) {
        for (const archiveKey of candidateArchiveKeys) {
          loadedPedigreeArchiveKeysRef.current.add(archiveKey);
          try {
            const loaded = await loadOpfsHerdArchive(
              archiveKey,
              snapshotRef.current?.settings
            );
            if (loaded?.unpacked?.animals) {
              for (const archAnimal of loaded.unpacked.animals) {
                if (cache.has(archAnimal.id)) cache.delete(archAnimal.id);
                cache.set(archAnimal.id, archAnimal);
                while (cache.size > 256) {
                  const oldest = cache.keys().next().value;
                  if (oldest !== undefined) cache.delete(oldest);
                  else break;
                }
              }
            }
          } catch {
            // Best-effort archive hydration; stub remains safely usable
          }
        }
        walkCacheParents();
      }

      // Keep bounded LRU cache synced with fresh records
      for (const a of resolvedMap.values()) {
        if (cache.has(a.id)) cache.delete(a.id);
        cache.set(a.id, a);
        while (cache.size > 256) {
          const oldest = cache.keys().next().value;
          if (oldest !== undefined) cache.delete(oldest);
          else break;
        }
      }

      return Array.from(resolvedMap.values());
    },
    []
  );

  const checkPedigreeBranchesHaveAncestors = useCallback(
    async (animalIds: string[]): Promise<Record<string, boolean>> => {
      const cleanIds = Array.from(
        new Set(animalIds.filter((id) => typeof id === 'string' && id.trim().length > 0))
      );
      if (cleanIds.length === 0) return {};
      const adapter = adapterRef.current;
      if (adapter?.queryPedigreeBranchAncestorsExist) {
        return adapter.queryPedigreeBranchAncestorsExist(cleanIds);
      }
      const byId = new Map<string, Animal>(
        (snapshotRef.current?.animals ?? []).map((a) => [a.id, a])
      );
      const out: Record<string, boolean> = {};
      for (const id of cleanIds) {
        const a = byId.get(id);
        out[id] = Boolean(
          a &&
            ((a.sireId && byId.has(a.sireId)) ||
              (a.damId && byId.has(a.damId)) ||
              a.offloadedArchiveKey)
        );
      }
      return out;
    },
    []
  );

  const reloadFromAdapter = useCallback(async () => {
    const fresh = await adapterRef.current!.loadSnapshot({ lightweightPhotos: true });
    pedigreeAncestorCacheRef.current.clear();
    loadedPedigreeArchiveKeysRef.current.clear();
    snapshotRef.current = fresh;
    setSnapshot(fresh);
    void refreshStorageStatus();
    void refreshVaultAndArchives();
  }, [refreshStorageStatus, refreshVaultAndArchives]);

  /**
   * Shared slice wiring: every `use*` slice takes these ten capabilities from one bundle, so a
   * capability cannot be wired into one call site and silently missed at another.
   */
  const sliceCorePorts = useMemo<SliceCorePorts>(
    () =>
      createSliceCorePorts({
        enqueueStoreMutation,
        snapshotRef,
        deviceId,
        nextEntityRev,
        allocateNextLogicalCounter,
        nowIsoUtc: getAdjustedNowIsoUtc,
        recordOutboxOps,
        reloadFromAdapter,
        notify,
        reportPersistenceFailure,
      }),
    [
      deviceId,
      nextEntityRev,
      enqueueStoreMutation,
      recordOutboxOps,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
    ]
  );

  const reloadFromAdapterSilently = useCallback(async () => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    const [fresh, freshOps, freshConflicts] = await Promise.all([
      adapter.loadSnapshot({ lightweightPhotos: true }),
      loadAllSyncOperationsFromIdb().catch(() => syncOperationsRef.current),
      loadAllSyncConflictsFromIdb().catch(() => syncConflictsRef.current),
    ]);
    clearPhotoCache(photoCacheRef);
    pedigreeAncestorCacheRef.current.clear();
    loadedPedigreeArchiveKeysRef.current.clear();
    snapshotRef.current = fresh;
    setSnapshot(fresh);
    setPedigreeGenerations(fresh.settings.defaultGenerations);
    rebuildMaxRevIndex(freshOps);
    if (syncOperationsHydratedRef.current) {
      syncOperationsRef.current = freshOps;
      setSyncOperations(freshOps);
    }
    syncConflictsRef.current = freshConflicts;
    setSyncConflicts(freshConflicts);

    const animalIds = new Set(fresh.animals.map((a) => a.id));
    setSelectedAnimalId((prev) => (prev && !animalIds.has(prev) ? null : prev));
    setPedigreeAnimalId((prev) => (prev && !animalIds.has(prev) ? null : prev));

    const taskIds = new Set(fresh.tasks.map((t) => t.id));
    setHighlightedTaskId((prev) => (prev && !taskIds.has(prev) ? null : prev));

    setActiveSpeciesName((prev) => {
      if (fresh.speciesProfiles.some((sp) => isSameSpecies(sp.name, prev))) {
        return prev;
      }
      return fresh.speciesProfiles[0]?.name || fresh.settings.defaultSpecies || prev;
    });

    void refreshStorageStatus();
    void refreshVaultAndArchives();
  }, [rebuildMaxRevIndex, refreshStorageStatus, refreshVaultAndArchives]);

  // Silently reload Tab B whenever another tab commits a new IndexedDB epoch
  useEffect(() => {
    if (isLoading) return;
    return subscribeCrossTabDbCommits(() => {
      void enqueueStoreMutation(() => reloadFromAdapterSilently());
    });
  }, [isLoading, enqueueStoreMutation, reloadFromAdapterSilently]);

  // Keep prior-use sentinel synced with active non-wiped barn data
  useEffect(() => {
    if (!snapshot || isLoading || wipedRecoveryContext?.detected) return;
    markPriorUseSentinelFromSnapshot(snapshot);
  }, [snapshot, isLoading, wipedRecoveryContext]);

  // Trim cached full-res photos & ancestor caches on hide, and catch remote-tab writes when returning visible
  useEffect(() => {
    return registerFreezeLifecycleListener({
      id: 'barn-store-photo-cache-trim',
      onHidden: () => {
        clearPhotoCache(photoCacheRef);
        pedigreeAncestorCacheRef.current.clear();
        loadedPedigreeArchiveKeysRef.current.clear();
      },
      onVisible: () => {
        if (isLoading) return;
        const adapter = adapterRef.current;
        if (!adapter?.syncFromPersistedStorageIfStale) return;
        void enqueueStoreMutation(async () => {
          const updated = await adapter.syncFromPersistedStorageIfStale!();
          if (updated) {
            await reloadFromAdapterSilently();
          }
        });
      },
    });
  }, [isLoading, enqueueStoreMutation, reloadFromAdapterSilently]);

  const hasSnapshotReady = Boolean(snapshot);
  const wipedRecoveryDetected = Boolean(wipedRecoveryContext?.detected);

  // Idle Monthly OPFS Auto-Backup & Export Canary (visibilityState-guarded, zero foreground contention)
  useEffect(() => {
    if (isLoading || !hasSnapshotReady || wipedRecoveryDetected || !isOpfsSupported()) {
      return;
    }

    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const runBackgroundMaintenance = async () => {
      if (cancelled || backgroundMaintenanceInFlightRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const currentSnapshot = snapshotRef.current;
      if (!currentSnapshot) return;

      backgroundMaintenanceInFlightRef.current = true;
      try {
        try {
          if (currentSnapshot.animals.length > 0 && hasNonTestingBarnData(currentSnapshot)) {
            if (await shouldCreateMonthlyOpfsBackup()) {
              assertForegroundOrPause('Monthly OPFS Backup');
              const hydrated = await hydrateSnapshotForExport(currentSnapshot);
              assertForegroundOrPause('Monthly OPFS Backup');
              const saved = await saveOpfsVaultBackup(hydrated, {
                kind: 'monthly',
                note: 'Scheduled 30-day automatic backup',
              });
              void mirrorSnapshotToNativeVaultIfWrapped(hydrated, 'monthly');
              if (saved && !cancelled) {
                void refreshVaultAndArchives();
              }
            }
          }
        } catch (bgErr) {
          if (bgErr instanceof BackgroundPausedError) {
            return;
          }
          // Non-fatal background monthly backup check
        }

        if (cancelled) return;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

        try {
          if (shouldRunExportCanary()) {
            assertForegroundOrPause('Export Canary');
            const latestSnap = snapshotRef.current ?? currentSnapshot;
            const res = await runOpfsExportCanary(latestSnap);
            if (!res.ok && !cancelled) {
              setExportCanaryWarning(
                res.reason || 'Background export canary verification could not read back probe.'
              );
            }
          }
        } catch (canaryErr) {
          if (canaryErr instanceof BackgroundPausedError) {
            return;
          }
          // Non-fatal canary probe check
        }
      } finally {
        backgroundMaintenanceInFlightRef.current = false;
      }
    };

    const scheduleIdleRun = () => {
      if (cancelled) return;
      const win = typeof window !== 'undefined' ? (window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      }) : null;
      if (win && typeof win.requestIdleCallback === 'function') {
        if (idleHandle !== null && typeof win.cancelIdleCallback === 'function') {
          win.cancelIdleCallback(idleHandle);
        }
        idleHandle = win.requestIdleCallback(
          () => {
            idleHandle = null;
            void runBackgroundMaintenance();
          },
          { timeout: 6000 }
        );
      } else {
        if (timeoutHandle !== null) clearTimeout(timeoutHandle);
        timeoutHandle = setTimeout(() => {
          timeoutHandle = null;
          void runBackgroundMaintenance();
        }, 3500);
      }
    };

    scheduleIdleRun();

    const unregisterFreeze = registerFreezeLifecycleListener({
      id: 'barn-store-idle-maintenance',
      onVisible: () => {
        scheduleIdleRun();
      },
    });

    return () => {
      cancelled = true;
      unregisterFreeze();
      const win = typeof window !== 'undefined' ? (window as unknown as {
        cancelIdleCallback?: (id: number) => void;
      }) : null;
      if (idleHandle !== null && win && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    };
  }, [
    isLoading,
    hasSnapshotReady,
    wipedRecoveryDetected,
    hydrateSnapshotForExport,
    refreshVaultAndArchives,
  ]);

  const updateSettingsInternal = useCallback(
    async (patch: Partial<BarnSettings>, options?: { silent?: boolean }) => {
      const currentSnapshot = snapshotRef.current;
      if (!currentSnapshot) return;
      try {
        const ts = getAdjustedNowIsoUtc();
        const rev = nextEntityRev(currentSnapshot.settings.id, currentSnapshot.settings._rev);
        const updated: BarnSettings = {
          ...currentSnapshot.settings,
          ...patch,
          _rev: rev,
          updatedAt: ts,
        };
        await adapterRef.current!.saveSettings(updated);
        const ops = diffEntityFieldsToOperations({
          entityType: 'settings',
          previous: currentSnapshot.settings,
          next: updated,
          deviceId,
          nextCounter: allocateNextLogicalCounter,
          timestamp: ts,
          recordRev: rev,
        });
        await recordOutboxOps(ops);
        if (patch.defaultGenerations) {
          setPedigreeGenerations(patch.defaultGenerations);
        }
        snapshotRef.current = { ...currentSnapshot, settings: updated };
        setSnapshot((prev) => (prev ? { ...prev, settings: updated } : prev));
        if (!options?.silent) {
          notify('Barn preferences saved locally.');
        }
      } catch (err) {
        reportPersistenceFailure('save barn preferences', err);
      }
    },
    [deviceId, nextEntityRev, recordOutboxOps, notify, reportPersistenceFailure]
  );

  const updateSettings = useCallback(
    async (patch: Partial<BarnSettings>, options?: { silent?: boolean }) => {
      return enqueueStoreMutation(() => updateSettingsInternal(patch, options));
    },
    [enqueueStoreMutation, updateSettingsInternal]
  );

  const { ignoreTaskAlertsPermanently, clearTaskAlertGroup, dismissSpeciesMemoAlert } =
    useAlertDismissals({
      ...sliceCorePorts,
      updateSettingsInternal,
    });

  const { recordBackupExport, snoozeBackupReminder } = useBackupReminderActions({
    ...sliceCorePorts,
    updateSettingsInternal,
    setLocalLastBackupMeta,
    setLocalSnoozedUntilMs,
  });

  const togglePinSpeciesLanding = useCallback(
    async (speciesName: string) => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot) return;
        const currentlyPinned = isSameSpecies(
          currentSnapshot.settings.pinnedLandingSpecies,
          speciesName
        );
        const nextPinned = currentlyPinned ? '' : speciesName;
        await updateSettingsInternal({ pinnedLandingSpecies: nextPinned }, { silent: true });
        notify(
          nextPinned
            ? `Pinned ${speciesName} hub as your startup landing page.`
            : 'Unpinned startup species — app will open on All-Species Home.'
        );
      });
    },
    [enqueueStoreMutation, updateSettingsInternal, notify]
  );

  const saveSpeciesProfile = useCallback(
    async (profile: SpeciesProfile): Promise<boolean> => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        const ts = getAdjustedNowIsoUtc();
        const existing = currentSnapshot?.speciesProfiles.find((sp) => sp.id === profile.id);
        try {
          if (existing) {
            const rev = nextEntityRev(existing.id, existing._rev);
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
              await adapterRef.current!.replaceSnapshot(renamedSnapshot);
              if (isSameSpecies(activeSpeciesName, oldName)) {
                setActiveSpeciesName(newName);
              }
            } else {
              await adapterRef.current!.saveSpeciesProfile(clean);
            }

            await recordOutboxOps(
              diffEntityFieldsToOperations({
                entityType: 'species',
                previous: existing,
                next: clean,
                deviceId,
                nextCounter: allocateNextLogicalCounter,
                timestamp: ts,
                recordRev: rev,
              })
            );
            await reloadFromAdapter();
            notify(
              renamed
                ? `Renamed ${existing.name} to ${clean.name} across all barn records.`
                : `${clean.name} schedule saved.`
            );
          } else {
            const currentList = currentSnapshot?.speciesProfiles ?? [];
            const newId = profile.id || `species-${generateUuid()}`;
            const rev = nextEntityRev(newId, profile._rev);
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
            await adapterRef.current!.saveSpeciesProfile(cleanNew);
            await recordOutboxOps(
              diffEntityFieldsToOperations({
                entityType: 'species',
                previous: undefined,
                next: cleanNew,
                deviceId,
                nextCounter: allocateNextLogicalCounter,
                timestamp: ts,
                recordRev: rev,
              })
            );
            await reloadFromAdapter();
            notify(`${cleanNew.name} added to your barn.`);
          }
          return true;
        } catch (err) {
          reportPersistenceFailure(`save ${profile.name} species schedule`, err);
          return false;
        }
      });
    },
    [
      activeSpeciesName,
      deviceId,
      enqueueStoreMutation,
      nextEntityRev,
      recordOutboxOps,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
    ]
  );

  const updateSpeciesTargetWeightCurve = useCallback(
    async (speciesId: string, curve: TargetWeightPoint[]): Promise<boolean> => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        const existing = currentSnapshot?.speciesProfiles.find((sp) => sp.id === speciesId);
        if (!existing) return false;
        const ts = getAdjustedNowIsoUtc();
        const rev = nextEntityRev(existing.id, existing._rev);
        const cleanCurve = normalizeTargetWeightCurve(curve);
        const updated: SpeciesProfile = {
          ...existing,
          targetWeightCurve: cleanCurve,
          _rev: rev,
          updatedAt: ts,
        };
        try {
          await adapterRef.current!.saveSpeciesProfile(updated);
          await recordOutboxOps(
            diffEntityFieldsToOperations({
              entityType: 'species',
              previous: existing,
              next: updated,
              deviceId,
              nextCounter: allocateNextLogicalCounter,
              timestamp: ts,
              recordRev: rev,
            })
          );
          await reloadFromAdapter();
          notify(
            cleanCurve.length > 0
              ? `Saved ${cleanCurve.length} target weight goal point${cleanCurve.length === 1 ? '' : 's'} for ${existing.name}.`
              : `Cleared target weight curve for ${existing.name}.`
          );
          return true;
        } catch (err) {
          reportPersistenceFailure(`update ${existing.name} target weight curve`, err);
          return false;
        }
      });
    },
    [
      deviceId,
      enqueueStoreMutation,
      nextEntityRev,
      recordOutboxOps,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
    ]
  );

  const saveSpeciesMemo = useCallback(
    async (speciesId: string, rawMemoText: unknown, options?: { silent?: boolean }) => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot) return;
        const existing = currentSnapshot.speciesProfiles.find((sp) => sp.id === speciesId);
        if (!existing) return;
        const cleanMemo = sanitizeSpeciesMemo(rawMemoText);
        if ((existing.memoText ?? '') === cleanMemo) return;
        const ts = getAdjustedNowIsoUtc();
        const rev = nextEntityRev(existing.id, existing._rev);
        const updated: SpeciesProfile = {
          ...existing,
          memoText: cleanMemo,
          memoUpdatedAt: ts,
          _rev: rev,
          updatedAt: ts,
        };
        try {
          await adapterRef.current!.saveSpeciesProfile(updated);
          await recordOutboxOps(
            diffEntityFieldsToOperations({
              entityType: 'species',
              previous: existing,
              next: updated,
              deviceId,
              nextCounter: allocateNextLogicalCounter,
              timestamp: ts,
              recordRev: rev,
            })
          );
          await reloadFromAdapter();
          if (!options?.silent) {
            notify(`${existing.name} memo pad saved.`);
          }
        } catch (err) {
          reportPersistenceFailure(`save ${existing.name} memo pad`, err);
        }
      });
    },
    [enqueueStoreMutation, deviceId, nextEntityRev, recordOutboxOps, reloadFromAdapter, notify, reportPersistenceFailure]
  );

  const reorderSpeciesCardsInternal = useCallback(
    async (orderedIds: string[]) => {
      const currentSnapshot = snapshotRef.current;
      if (!currentSnapshot) return;
      try {
        const byId = new Map(currentSnapshot.speciesProfiles.map((sp) => [sp.id, sp]));
        const ordered: SpeciesProfile[] = [];
        const seen = new Set<string>();
        const ts = getAdjustedNowIsoUtc();

        for (const id of orderedIds) {
          const sp = byId.get(id);
          if (sp && !seen.has(id)) {
            seen.add(id);
            ordered.push({ ...sp, sortOrder: ordered.length, updatedAt: ts });
          }
        }
        for (const sp of currentSnapshot.speciesProfiles) {
          if (!seen.has(sp.id)) {
            ordered.push({ ...sp, sortOrder: ordered.length, updatedAt: ts });
          }
        }

        await adapterRef.current!.saveSpeciesProfilesBatch(ordered);
        await reloadFromAdapter();
      } catch (err) {
        reportPersistenceFailure('reorder species cards', err);
      }
    },
    [reloadFromAdapter, reportPersistenceFailure]
  );

  const reorderSpeciesCards = useCallback(
    async (orderedIds: string[]) => {
      return enqueueStoreMutation(() => reorderSpeciesCardsInternal(orderedIds));
    },
    [enqueueStoreMutation, reorderSpeciesCardsInternal]
  );

  const moveSpeciesCard = useCallback(
    async (speciesId: string, direction: 'up' | 'down' | 'top') => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot) return;
        const ids = currentSnapshot.speciesProfiles.map((sp) => sp.id);
        const fromIdx = ids.indexOf(speciesId);
        if (fromIdx === -1) return;

        let toIdx = fromIdx;
        if (direction === 'top') toIdx = 0;
        else if (direction === 'up') toIdx = Math.max(0, fromIdx - 1);
        else if (direction === 'down') toIdx = Math.min(ids.length - 1, fromIdx + 1);

        if (toIdx === fromIdx) return;

        const nextIds = [...ids];
        const [moved] = nextIds.splice(fromIdx, 1);
        nextIds.splice(toIdx, 0, moved);
        await reorderSpeciesCardsInternal(nextIds);
      });
    },
    [enqueueStoreMutation, reorderSpeciesCardsInternal]
  );

  const reorderSpeciesHubBlocks = useCallback(
    async (speciesName: string, orderedBlockIds: SpeciesHubBlockId[]) => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot) return;
        const key = speciesName.trim().toLowerCase();
        const normalized = normalizeSpeciesHubBlockOrder(orderedBlockIds);
        const prevMap = currentSnapshot.settings.speciesHubBlockOrder || {};
        await updateSettingsInternal(
          {
            speciesHubBlockOrder: {
              ...prevMap,
              [key]: normalized,
            },
          },
          { silent: true }
        );
      });
    },
    [enqueueStoreMutation, updateSettingsInternal]
  );

  const moveSpeciesHubBlock = useCallback(
    async (
      speciesName: string,
      blockId: SpeciesHubBlockId,
      direction: 'up' | 'down' | 'top'
    ) => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot) return;
        const key = speciesName.trim().toLowerCase();
        const ids = normalizeSpeciesHubBlockOrder(
          currentSnapshot.settings.speciesHubBlockOrder?.[key]
        );
        const fromIdx = ids.indexOf(blockId);
        if (fromIdx === -1) return;

        let toIdx = fromIdx;
        if (direction === 'top') toIdx = 0;
        else if (direction === 'up') toIdx = Math.max(0, fromIdx - 1);
        else if (direction === 'down') toIdx = Math.min(ids.length - 1, fromIdx + 1);

        if (toIdx === fromIdx) return;

        const nextIds = [...ids];
        const [moved] = nextIds.splice(fromIdx, 1);
        nextIds.splice(toIdx, 0, moved);
        const prevMap = currentSnapshot.settings.speciesHubBlockOrder || {};
        await updateSettingsInternal(
          {
            speciesHubBlockOrder: {
              ...prevMap,
              [key]: normalizeSpeciesHubBlockOrder(nextIds),
            },
          },
          { silent: true }
        );
      });
    },
    [enqueueStoreMutation, updateSettingsInternal]
  );

  const deleteSpeciesProfile = useCallback(
    async (profile: SpeciesProfile) => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        try {
          if (currentSnapshot) {
            const remainingRecords = countAllSpeciesRecords(currentSnapshot, profile.name);
            if (remainingRecords > 0) {
              notify(
                `Only empty species can be fully removed (${profile.name} still has ${remainingRecords} record${remainingRecords === 1 ? '' : 's'}).`
              );
              return;
            }
            if (currentSnapshot.speciesProfiles.length <= 1) {
              notify('At least one species must remain in your barn.');
              return;
            }
            await saveSafetyRollingBackup(currentSnapshot);
          }
          const ts = getAdjustedNowIsoUtc();
          await adapterRef.current!.deleteSpeciesProfile(profile.id);
          await recordOutboxOps([
            createOutboxOperation({
              entityType: 'species',
              entityUuid: profile.id,
              deviceId,
              logicalCounter: allocateNextLogicalCounter(),
              fieldName: '__delete__',
              newValue: true,
              timestamp: ts,
              recordRev: nextEntityRev(profile.id, profile._rev),
            }),
          ]);
          if (currentSnapshot && isSameSpecies(currentSnapshot.settings.pinnedLandingSpecies, profile.name)) {
            await updateSettingsInternal({ pinnedLandingSpecies: '' }, { silent: true });
          }
          await reloadFromAdapter();
          if (isSameSpecies(activeSpeciesName, profile.name)) {
            const fallbackName =
              currentSnapshot?.speciesProfiles.find((p) => p.id !== profile.id)?.name || 'Rabbit';
            setActiveSpeciesName(fallbackName);
            setRoute('home');
          }
          notify(`${profile.name} removed from configured species.`);
        } catch (err) {
          reportPersistenceFailure(`remove ${profile.name} species`, err);
        }
      });
    },
    [
      enqueueStoreMutation,
      activeSpeciesName,
      deviceId,
      nextEntityRev,
      recordOutboxOps,
      saveSafetyRollingBackup,
      updateSettingsInternal,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
    ]
  );

  const exportTimestampedSpeciesBackup = useCallback(
    async (speciesName: string, reason: SpeciesBackupReason = 'manual') => {
      if (!snapshot) return;
      const { buildSpeciesZipBackupFileName } = await import('../domain/syncAndExports');
      const filename = buildSpeciesZipBackupFileName(
        snapshot.settings.barnName,
        speciesName,
        reason
      );
      const hydrated = await hydrateSnapshotForExport(snapshot, speciesName);
      const { buildCompleteBackupZipToOpfsTmpOffThread } = await import(
        '../storage/offThreadWorkerClient'
      );
      const archive = await buildCompleteBackupZipToOpfsTmpOffThread(hydrated, speciesName, {
        backupScope: 'species',
        backupReason: reason,
        targetSpecies: speciesName,
      });
      await downloadTempOpfsExport(filename, archive, 'application/zip');
      void recordBackupExport('zip', filename);
      notify(
        `Saved ${speciesName} backup archive: ${filename} (${archive.animalCount} animals, ${archive.photoCount} photos, Printable Barn Binder included)`
      );
    },
    [snapshot, hydrateSnapshotForExport, recordBackupExport, notify]
  );

  // Stable adapter facade so the CRUD callbacks keep their identity across renders.
  const animalsCrudAdapter = useMemo<AnimalsCrudAdapter>(
    () => ({
      saveAnimal: (animal) => adapterRef.current!.saveAnimal(animal),
      saveAnimalPhotosBatch: (photos) => adapterRef.current!.saveAnimalPhotosBatch(photos),
      saveAnimalsBatch: (animals) => adapterRef.current!.saveAnimalsBatch(animals),
      deleteAnimalsBatch: (ids) => adapterRef.current!.deleteAnimalsBatch(ids),
      syncFromPersistedStorageIfStale: () =>
        adapterRef.current?.syncFromPersistedStorageIfStale?.() ?? Promise.resolve(false),
    }),
    []
  );

  const { saveAnimal, archiveAnimals, deleteAnimalsBatch, deleteAnimal } = useAnimalsCrud({
    ...sliceCorePorts,
    fallbackSnapshot: snapshot,
    adapter: animalsCrudAdapter,
    reloadFromAdapterSilently,
    rememberPhoto: (photoId, dataUrl) => rememberPhoto(photoCacheRef, photoId, dataUrl),
    forgetPhoto: (photoId) => forgetPhoto(photoCacheRef, photoId),
    saveSafetyRollingBackup,
    selectedAnimalId,
    pedigreeAnimalId,
    clearSelectedAnimal: () => setSelectedAnimalId(null),
    clearPedigreeAnimal: () => setPedigreeAnimalId(null),
    isOpfsSupported: () => isOpfsSupported(),
    getOffloadAnimals: () => offloadAnimalsRef.current,
  });
  const ignoreAnimalConflicts = useCallback(
    async (animalId: string, kinds: AnimalConflictKind[]) => {
      if (kinds.length === 0) return;
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot) return;
        const target = currentSnapshot.animals.find((a) => a.id === animalId);
        if (!target) return;
        const ts = getAdjustedNowIsoUtc();
        const rev = nextEntityRev(target.id, target._rev);
        const nextIgnored = normalizeIgnoredConflicts([
          ...(target.ignoredConflicts || []),
          ...kinds,
        ]);
        const summariesAfter = analyzeBarnAnimalConflicts(
          currentSnapshot.animals.map((a) =>
            a.id === animalId ? { ...a, ignoredConflicts: nextIgnored } : a
          )
        );
        const stillHasActive = Boolean(summariesAfter.get(animalId)?.hasActiveConflict);
        const updated: Animal = {
          ...target,
          ignoredConflicts: nextIgnored,
          needsAttention: stillHasActive ? target.needsAttention : false,
          _rev: rev,
          updatedAt: ts,
        };
        try {
          await adapterRef.current!.saveAnimal(updated);
          await recordOutboxOps(
            diffEntityFieldsToOperations({
              entityType: 'animal',
              previous: target,
              next: updated,
              deviceId,
              nextCounter: allocateNextLogicalCounter,
              timestamp: ts,
              recordRev: rev,
            })
          );
          await reloadFromAdapter();
          notify(
            `Conflict alert ignored for ${target.name}. A soft warning remains visible until the underlying issue is resolved.`
          );
        } catch (err) {
          reportPersistenceFailure(`ignore conflict for ${target.name}`, err);
        }
      });
    },
    [enqueueStoreMutation, deviceId, nextEntityRev, recordOutboxOps, reloadFromAdapter, notify, reportPersistenceFailure]
  );

  const restoreAnimalConflictAlert = useCallback(
    async (animalId: string, kinds?: AnimalConflictKind[]) => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot) return;
        const target = currentSnapshot.animals.find((a) => a.id === animalId);
        if (!target) return;
        const ts = getAdjustedNowIsoUtc();
        const rev = nextEntityRev(target.id, target._rev);
        const currentIgnored = normalizeIgnoredConflicts(target.ignoredConflicts);
        const nextIgnored =
          kinds && kinds.length > 0
            ? currentIgnored.filter((k) => !kinds.includes(k))
            : [];
        const summariesAfter = analyzeBarnAnimalConflicts(
          currentSnapshot.animals.map((a) =>
            a.id === animalId ? { ...a, ignoredConflicts: nextIgnored } : a
          )
        );
        const hasActive = Boolean(summariesAfter.get(animalId)?.hasActiveConflict);
        const updated: Animal = {
          ...target,
          ignoredConflicts: nextIgnored,
          needsAttention: hasActive ? true : target.needsAttention,
          _rev: rev,
          updatedAt: ts,
        };
        try {
          await adapterRef.current!.saveAnimal(updated);
          await recordOutboxOps(
            diffEntityFieldsToOperations({
              entityType: 'animal',
              previous: target,
              next: updated,
              deviceId,
              nextCounter: allocateNextLogicalCounter,
              timestamp: ts,
              recordRev: rev,
            })
          );
          await reloadFromAdapter();
          notify(`Conflict alert re-enabled for ${target.name}.`);
        } catch (err) {
          reportPersistenceFailure(`restore conflict alert for ${target.name}`, err);
        }
      });
    },
    [enqueueStoreMutation, deviceId, nextEntityRev, recordOutboxOps, reloadFromAdapter, notify, reportPersistenceFailure]
  );

  /**
   * Migrates one or more selected animals (or an entire species) via the pure `migrateAnimalsToSpecies`
   * engine, preserving linked family lines, photos, care logs, breedings, tasks, cages, and shows.
   */
  const migrateAnimalsSpecies = useCallback(
    async (
      animalIds: string[],
      targetSpeciesName: string,
      options?: SpeciesMigrationOptions
    ): Promise<SpeciesMigrationResult | null> => {
      if (!options?.migrateEntireSpecies && animalIds.length === 0) return null;
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot) return null;

        try {
          await saveSafetyRollingBackup(currentSnapshot);
          const { migrateAnimalsToSpecies } = await import('../domain/speciesMigration');
          const result = migrateAnimalsToSpecies(
            currentSnapshot,
            animalIds,
            targetSpeciesName,
            options
          );
          await adapterRef.current!.replaceSnapshot(result.snapshot);
          const migrationOps = diffSnapshotsToSyncOperations({
            previous: currentSnapshot,
            next: result.snapshot,
            deviceId,
            nextCounter: allocateNextLogicalCounter,
            timestamp: getAdjustedNowIsoUtc(),
          });
          await recordOutboxOps(migrationOps);

          const prevSpeciesById = new Map(currentSnapshot.animals.map((a) => [a.id, a.species]));
          const movedSet = new Set(
            result.snapshot.animals
              .filter((a) => {
                const prevSpecies = prevSpeciesById.get(a.id);
                return prevSpecies !== undefined && !isSameSpecies(prevSpecies, a.species);
              })
              .map((a) => a.id)
          );
          if (selectedAnimalId && movedSet.has(selectedAnimalId)) setSelectedAnimalId(null);
          if (pedigreeAnimalId && movedSet.has(pedigreeAnimalId)) setPedigreeAnimalId(null);

          await reloadFromAdapter();
          notify(
            `Moved ${result.animalsMigrated} animal${result.animalsMigrated === 1 ? '' : 's'} to ${result.targetSpecies}.`
          );
          return result;
        } catch (err) {
          reportPersistenceFailure(`migrate stock to ${targetSpeciesName}`, err);
          return null;
        }
      });
    },
    [
      enqueueStoreMutation,
      saveSafetyRollingBackup,
      deviceId,
      recordOutboxOps,
      selectedAnimalId,
      pedigreeAnimalId,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
    ]
  );

  // Stable adapter facade so the photo callbacks keep their identity across renders.
  const photoMutationAdapter = useMemo<PhotoMutationAdapter>(
    () => ({
      saveAnimalPhotosBatch: (photos) => adapterRef.current!.saveAnimalPhotosBatch(photos),
      saveAnimalPhoto: (photo) => adapterRef.current!.saveAnimalPhoto(photo),
      deleteAnimalPhoto: (photoId) => adapterRef.current!.deleteAnimalPhoto(photoId),
    }),
    []
  );

  const {
    addOptimizedAnimalPhotos,
    setPrimaryAnimalPhoto,
    updateAnimalPhotoCaption,
    deleteAnimalPhoto,
  } = usePhotoMutations({
    ...sliceCorePorts,
    adapter: photoMutationAdapter,
    rememberPhoto: (photoId, dataUrl) => rememberPhoto(photoCacheRef, photoId, dataUrl),
    forgetPhoto: (photoId) => forgetPhoto(photoCacheRef, photoId),
  });
  /**
   * Shared entity write path: the collections below differ only in their builder, adapter method
   * and copy, so the queue/revision/outbox/reload order lives in `entityCrudController`.
   */
  const entityCrudPorts = useMemo<EntityCrudPorts>(
    () => ({ ...sliceCorePorts, fallbackSnapshot: () => snapshot, generateId: generateUuid }),
    [sliceCorePorts, snapshot]
  );

  const saveCage = useCallback(
    async (
      cageDraft: Omit<CageLocation, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<boolean> => {
      const saved = await saveEntityRecord(
        entityCrudPorts,
        {
          entityType: 'cage',
          readRows: (snap) => snap?.cages,
          build: (draft, base) => ({ ...draft, ...base, label: draft.label.trim() }),
          persist: (cage) => adapterRef.current!.saveCage(cage),
          describe: (cage) => `Location ${cage.label} saved.`,
          failureLabel: (cage) => `save location ${cage.label}`,
        },
        cageDraft
      );
      return saved !== null;
    },
    [entityCrudPorts]
  );

  const deleteCage = useCallback(
    async (id: string) =>
      deleteEntityRecord(
        entityCrudPorts,
        {
          entityType: 'cage',
          readRows: (snap) => snap?.cages,
          remove: (cageId) => adapterRef.current!.deleteCage(cageId),
          message: 'Cage/location removed.',
          failureLabel: 'delete cage location',
        },
        id
      ),
    [entityCrudPorts]
  );

  const assignAnimalToCage = useCallback(
    async (animalId: string, nextCageLabel: string): Promise<boolean> => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current ?? snapshot;
        const target = currentSnapshot?.animals.find((a) => a.id === animalId);
        if (!target || target.offloadedArchiveKey) return false;
        const cleanLabel = nextCageLabel.trim();
        if (target.cageLocation.trim() === cleanLabel) return true;
        const ts = getAdjustedNowIsoUtc();
        const rev = nextEntityRev(target.id, target._rev);
        const updated: Animal = {
          ...target,
          cageLocation: cleanLabel,
          _rev: rev,
          updatedAt: ts,
        };
        try {
          await adapterRef.current!.saveAnimal(updated);
          await recordOutboxOps(
            diffEntityFieldsToOperations({
              entityType: 'animal',
              previous: target,
              next: updated,
              deviceId,
              nextCounter: allocateNextLogicalCounter,
              timestamp: ts,
              recordRev: rev,
            })
          );
          await reloadFromAdapter();
          notify(
            cleanLabel
              ? `Assigned ${target.name} to ${cleanLabel}.`
              : `Removed ${target.name} from cage assignment.`
          );
          return true;
        } catch (err) {
          reportPersistenceFailure(`assign ${target.name} to cage`, err);
          return false;
        }
      });
    },
    [
      snapshot,
      enqueueStoreMutation,
      deviceId,
      nextEntityRev,
      recordOutboxOps,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
    ]
  );

  /**
   * Logs a new breeding or updates an existing breeding, and automatically runs the
   * Master Task List engine to cascade species-appropriate barn tasks on creation.
   */
  const breedingAdapter = useMemo<BreedingAdapter>(
    () => ({
      saveAnimalsBatch: (animals) => adapterRef.current!.saveAnimalsBatch(animals),
      saveBreeding: (breeding) => adapterRef.current!.saveBreeding(breeding),
      saveTasksBatch: (tasks) => adapterRef.current!.saveTasksBatch(tasks),
      saveTask: (task) => adapterRef.current!.saveTask(task),
      deleteTasksBatch: (taskIds) => adapterRef.current!.deleteTasksBatch(taskIds),
      deleteBreeding: (breedingId) => adapterRef.current!.deleteBreeding(breedingId),
    }),
    []
  );

  const {
    logBreedingWithCascade,
    updateBreedingOutcome,
    recalculateBreedingPostBirthTasks,
    completeBreedingTaskWithOutcome,
    deleteBreeding,
  } = useBreeding({
    ...sliceCorePorts,
    snapshot,
    activeSpeciesName,
    adapter: breedingAdapter,
    isOnline: getEffectiveOnlineStatus,
    setPendingCalendarSync: (payload) => setPendingCalendarSync(payload),
  });

  const saveTask = useCallback(
    async (
      taskDraft: Omit<BarnTask, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<boolean> => {
      const saved = await saveEntityRecord(
        entityCrudPorts,
        {
          entityType: 'task',
          readRows: (snap) => snap?.tasks,
          build: (task, base) => ({ ...task, ...base, title: task.title.trim() }),
          persist: (task) => adapterRef.current!.saveTask(task),
          describe: () => 'Barn chore saved.',
          failureLabel: () => 'save barn chore',
          afterSave: async ({ row: task, prev, snapshot: currentSnapshot }) => {
            if (prev || !task.dueDateIso) return undefined;
            const calConfig = normalizeCalendarSyncSettings(currentSnapshot?.settings.calendarSync);
            if (!calConfig.autoAddNewTasks || !calConfig.includeManualTasks) return undefined;
            const isOnline = getEffectiveOnlineStatus();
            if (calConfig.deliveryMode === 'google_calendar' && isOnline) {
              setPendingCalendarSync({
                tasks: [task],
                filenameHint: formatSystemTaskTitle(task, calConfig, currentSnapshot ?? undefined),
              });
              return 'Ready to add to Google Calendar.';
            }
            const appBaseUrl =
              typeof window !== 'undefined'
                ? `${window.location.origin}${window.location.pathname}`
                : '';
            const ics = buildIcsCalendarForTasks(
              [task],
              calConfig,
              currentSnapshot?.settings.barnName,
              undefined,
              {
                animals: currentSnapshot?.animals,
                breedings: currentSnapshot?.breedings,
                speciesProfiles: currentSnapshot?.speciesProfiles,
                appBaseUrl,
              }
            );
            if (!ics) return undefined;
            await downloadTextFile(ics.filename, ics.icsContent, 'text/calendar');
            return calConfig.deliveryMode === 'google_calendar' && !isOnline
              ? 'Offline — downloaded .ICS fallback.'
              : 'Exported to calendar (.ICS).';
          },
        },
        taskDraft
      );
      return saved !== null;
    },
    [entityCrudPorts]
  );

  const downloadOfflineIcsForTasks = useCallback(
    (
      tasksToExport: BarnTask[],
      filenameHint?: string,
      options?: { useExternalShare?: boolean; fallbackPrefix?: string }
    ) => {
      if (!snapshot) return 0;
      const calConfig = normalizeCalendarSyncSettings(snapshot.settings.calendarSync);
      const appBaseUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname}`
          : '';
      const ics = buildIcsCalendarForTasks(
        tasksToExport,
        calConfig,
        snapshot.settings.barnName,
        filenameHint,
        {
          animals: snapshot.animals,
          breedings: snapshot.breedings,
          speciesProfiles: snapshot.speciesProfiles,
          appBaseUrl,
        }
      );
      if (!ics) {
        notify('Selected chore(s) have no due date to add to calendar.');
        return 0;
      }

      if (options?.useExternalShare) {
        void shareTextFileOrDownload({
          filename: ics.filename,
          content: ics.icsContent,
          mimeType: 'text/calendar',
          title: filenameHint || `${snapshot.settings.barnName} Barn Chores`,
          text: 'Import barn chore into your calendar app',
        })
          .then((outcome) => {
            if (outcome === 'cancelled') {
              notify('Calendar share cancelled.');
              return;
            }
            notify(
              outcome === 'shared'
                ? `Opened external calendar handoff for ${ics.eventCount} event${
                    ics.eventCount === 1 ? '' : 's'
                  }.`
                : `Saved ${ics.eventCount} event${
                    ics.eventCount === 1 ? '' : 's'
                  } (.ICS) — open file to add to Outlook, Apple, or system calendar.`
            );
          })
          .catch((err) => {
            reportPersistenceFailure('share .ICS calendar file', err);
          });
        return ics.eventCount;
      }

      void downloadTextFile(ics.filename, ics.icsContent, 'text/calendar').catch((err) => {
        reportPersistenceFailure('download .ICS calendar file', err);
      });
      const prefix = options?.fallbackPrefix ? `${options.fallbackPrefix} ` : '';
      notify(
        `${prefix}Downloaded ${ics.eventCount} calendar event${
          ics.eventCount === 1 ? '' : 's'
        } (.ICS)${calConfig.alarmEnabled ? ' with alarm' : ''}.`
      );
      return ics.eventCount;
    },
    [snapshot, notify, reportPersistenceFailure]
  );

  const exportTasksToCalendar = useCallback(
    (tasksToExport: BarnTask[], filenameHint?: string) => {
      if (!snapshot) return 0;
      const dated = tasksToExport.filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.dueDateIso || ''));
      if (dated.length === 0) {
        notify('Selected chore(s) have no due date to add to calendar.');
        return 0;
      }

      const calConfig = normalizeCalendarSyncSettings(snapshot.settings.calendarSync);
      const isOnline = getEffectiveOnlineStatus();

      if (calConfig.deliveryMode === 'google_calendar') {
        if (!isOnline) {
          return downloadOfflineIcsForTasks(dated, filenameHint, {
            fallbackPrefix: 'Device is offline —',
          });
        }
        setPendingCalendarSync({ tasks: dated, filenameHint });
        return dated.length;
      }

      if (calConfig.deliveryMode === 'external_app_or_ics') {
        return downloadOfflineIcsForTasks(dated, filenameHint, {
          useExternalShare: true,
        });
      }

      return downloadOfflineIcsForTasks(dated, filenameHint);
    },
    [snapshot, downloadOfflineIcsForTasks, notify]
  );

  const connectGoogleCalendar = useCallback(async (): Promise<boolean> => {
    setGoogleSyncBusy(true);
    try {
      const { listWritableGoogleCalendars, signInGoogleCalendar } = await import(
        '../app/pedigreeCalendarClient'
      );
      const { user, accessToken } = await signInGoogleCalendar();
      setGoogleAuthConnected(true);
      setGoogleUserEmail(user.email || user.displayName || 'Google Account');
      const cals = await listWritableGoogleCalendars(accessToken);
      setGoogleCalendars(cals);
      notify(`Connected Google Calendar${user.email ? ` (${user.email})` : ''}.`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Calendar sign-in cancelled.';
      setErrorMessage(`Could not connect Google Calendar: ${msg}`);
      return false;
    } finally {
      setGoogleSyncBusy(false);
    }
  }, [notify]);

  const disconnectGoogleCalendar = useCallback(async () => {
    const { signOutGoogleCalendar } = await import('../app/pedigreeCalendarClient');
    await signOutGoogleCalendar();
    setGoogleAuthConnected(false);
    setGoogleUserEmail(null);
    setGoogleCalendars([]);
    notify('Signed out of Google Calendar.');
  }, [notify]);

  const refreshGoogleCalendars = useCallback(async () => {
    const { getGoogleCalendarAccessToken, listWritableGoogleCalendars } = await import(
      '../app/pedigreeCalendarClient'
    );
    const token = getGoogleCalendarAccessToken();
    if (!token) {
      setGoogleAuthConnected(false);
      return;
    }
    setGoogleSyncBusy(true);
    try {
      const cals = await listWritableGoogleCalendars(token);
      setGoogleCalendars(cals);
    } catch {
      setGoogleAuthConnected(false);
    } finally {
      setGoogleSyncBusy(false);
    }
  }, []);

  const confirmGoogleCalendarSync = useCallback(async () => {
    if (!snapshot || !pendingCalendarSync) return;
    const { tasks: queuedTasks, filenameHint } = pendingCalendarSync;
    const calConfig = normalizeCalendarSyncSettings(snapshot.settings.calendarSync);
    const { getGoogleCalendarAccessToken, pushTasksToGoogleCalendar } = await import(
      '../app/pedigreeCalendarClient'
    );
    const token = getGoogleCalendarAccessToken();
    const isOnline = getEffectiveOnlineStatus();

    if (!isOnline || !token) {
      setPendingCalendarSync(null);
      downloadOfflineIcsForTasks(queuedTasks, filenameHint, {
        fallbackPrefix: !isOnline
          ? 'Device is offline —'
          : 'Google session unavailable —',
      });
      return;
    }

    setGoogleSyncBusy(true);
    try {
      const appBaseUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname}`
          : '';
      const result = await pushTasksToGoogleCalendar({
        accessToken: token,
        calendarId: calConfig.googleCalendarId || 'primary',
        tasks: queuedTasks,
        config: calConfig,
        barnName: snapshot.settings.barnName,
        context: {
          animals: snapshot.animals,
          breedings: snapshot.breedings,
          speciesProfiles: snapshot.speciesProfiles,
          appBaseUrl,
        },
      });

      if (result.authExpired) {
        setGoogleAuthConnected(false);
      }

      if (result.createdCount > 0 && result.failedCount === 0) {
        setPendingCalendarSync(null);
        notify(
          `Added ${result.createdCount} event${
            result.createdCount === 1 ? '' : 's'
          } to ${calConfig.googleCalendarName || 'Google Calendar'}.`
        );
        return;
      }

      // Automatic fallback to offline .ICS if Google Calendar couldn't save all events
      setPendingCalendarSync(null);
      downloadOfflineIcsForTasks(queuedTasks, filenameHint, {
        fallbackPrefix:
          result.createdCount > 0
            ? `Added ${result.createdCount} to Google Calendar; saved offline .ICS fallback for remaining`
            : 'Could not reach Google Calendar —',
      });
    } catch {
      setPendingCalendarSync(null);
      downloadOfflineIcsForTasks(queuedTasks, filenameHint, {
        fallbackPrefix: 'Could not reach Google Calendar —',
      });
    } finally {
      setGoogleSyncBusy(false);
    }
  }, [snapshot, pendingCalendarSync, downloadOfflineIcsForTasks, notify]);

  const fallbackPendingCalendarSyncToIcs = useCallback(() => {
    if (!pendingCalendarSync) return;
    const { tasks: queuedTasks, filenameHint } = pendingCalendarSync;
    setPendingCalendarSync(null);
    downloadOfflineIcsForTasks(queuedTasks, filenameHint, {
      useExternalShare: true,
    });
  }, [pendingCalendarSync, downloadOfflineIcsForTasks]);

  const cancelPendingCalendarSync = useCallback(() => {
    setPendingCalendarSync(null);
  }, []);

  const copyTaskAppLink = useCallback(
    async (task: BarnTask) => {
      const appBaseUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname}`
          : '';
      const link = buildTaskAppDeepLink(appBaseUrl, task);
      if (!link) return;
      const mode = await copyTextWithFallback(link);
      if (mode !== 'unsupported') {
        notify('Copied direct app task link to clipboard.');
        return;
      }
      notify(`App task link: ${link}`);
    },
    [notify]
  );

  const toggleTaskCompleted = useCallback(
    async (task: BarnTask): Promise<boolean> => {
      return enqueueStoreMutation(async () => {
        const ts = getAdjustedNowIsoUtc();
        const rev = nextEntityRev(task.id, task._rev);
        const updated: BarnTask = {
          ...task,
          completed: !task.completed,
          _rev: rev,
          updatedAt: ts,
        };
        try {
          await adapterRef.current!.saveTask(updated);
          await recordOutboxOps(
            diffEntityFieldsToOperations({
              entityType: 'task',
              previous: task,
              next: updated,
              deviceId,
              nextCounter: allocateNextLogicalCounter,
              timestamp: ts,
              recordRev: rev,
            })
          );
          await reloadFromAdapter();
          return true;
        } catch (err) {
          reportPersistenceFailure('update task completion', err);
          return false;
        }
      });
    },
    [
      deviceId,
      nextEntityRev,
      enqueueStoreMutation,
      recordOutboxOps,
      reloadFromAdapter,
      reportPersistenceFailure,
    ]
  );

  const rescheduleTask = useCallback(
    async (
      task: BarnTask,
      nextDates: { startDateIso?: string; dueDateIso: string }
    ): Promise<boolean> => {
      return enqueueStoreMutation(async () => {
        const ts = getAdjustedNowIsoUtc();
        const rev = nextEntityRev(task.id, task._rev);
        const cleanStart = nextDates.startDateIso?.trim() || '';
        const updated: BarnTask = {
          ...task,
          ...(cleanStart ? { startDateIso: cleanStart } : { startDateIso: '' }),
          dueDateIso: nextDates.dueDateIso.trim() || task.dueDateIso,
          _rev: rev,
          updatedAt: ts,
        };
        try {
          await adapterRef.current!.saveTask(updated);
          await recordOutboxOps(
            diffEntityFieldsToOperations({
              entityType: 'task',
              previous: task,
              next: updated,
              deviceId,
              nextCounter: allocateNextLogicalCounter,
              timestamp: ts,
              recordRev: rev,
            })
          );
          await reloadFromAdapter();
          return true;
        } catch (err) {
          reportPersistenceFailure('reschedule barn chore', err);
          return false;
        }
      });
    },
    [
      deviceId,
      nextEntityRev,
      enqueueStoreMutation,
      recordOutboxOps,
      reloadFromAdapter,
      reportPersistenceFailure,
    ]
  );

  const applySmartTaskEscalations = useCallback(
    async (tasksToEscalate?: BarnTask[]): Promise<number> => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current ?? snapshot;
        if (!currentSnapshot) return 0;
        const sourceTasks = tasksToEscalate ?? currentSnapshot.tasks;
        const ts = getAdjustedNowIsoUtc();
        const { buildPriorityEscalationUpdates } = await import('../domain/barnScheduler');
        const rawUpdates = buildPriorityEscalationUpdates(sourceTasks, todayDateIso(), ts);
        if (rawUpdates.length === 0) return 0;

        const prevById = new Map(currentSnapshot.tasks.map((t) => [t.id, t]));
        const revAligned: BarnTask[] = [];
        const ops: SyncOperation[] = [];
        for (const u of rawUpdates) {
          const prev = prevById.get(u.id);
          const rev = nextEntityRev(u.id, prev?._rev ?? u._rev);
          const nextTask: BarnTask = { ...u, _rev: rev, updatedAt: ts };
          revAligned.push(nextTask);
          ops.push(
            ...diffEntityFieldsToOperations({
              entityType: 'task',
              previous: prev,
              next: nextTask,
              deviceId,
              nextCounter: allocateNextLogicalCounter,
              timestamp: ts,
              recordRev: rev,
            })
          );
        }

        try {
          await adapterRef.current!.saveTasksBatch(revAligned);
          await recordOutboxOps(ops);
          await reloadFromAdapter();
          notify(
            `Escalated ${revAligned.length} time-critical chore${revAligned.length === 1 ? '' : 's'}.`
          );
          return revAligned.length;
        } catch (err) {
          reportPersistenceFailure('escalate barn chores', err);
          return 0;
        }
      });
    },
    [
      snapshot,
      deviceId,
      nextEntityRev,
      enqueueStoreMutation,
      recordOutboxOps,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
    ]
  );

  const deleteTask = useCallback(
    async (id: string) =>
      deleteEntityRecord(
        entityCrudPorts,
        {
          entityType: 'task',
          readRows: (snap) => snap?.tasks,
          remove: (taskId) => adapterRef.current!.deleteTask(taskId),
          failureLabel: 'delete task',
        },
        id
      ),
    [entityCrudPorts]
  );

  const addCareLog = useCallback(
    async (draft: Omit<CareLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<boolean> => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current ?? snapshot;
        if (!currentSnapshot) return false;
        const ts = getAdjustedNowIsoUtc();
        const log: CareLog = {
          ...draft,
          id: generateUuid(),
          _rev: 1,
          createdAt: ts,
          updatedAt: ts,
        };
        try {
          await adapterRef.current!.saveCareLog(log);
          const ops: SyncOperation[] = diffEntityFieldsToOperations({
            entityType: 'careLog',
            previous: undefined,
            next: log,
            deviceId,
            nextCounter: allocateNextLogicalCounter,
            timestamp: ts,
            recordRev: 1,
          });

          const animal = currentSnapshot.animals.find((a) => a.id === draft.animalId);
          if (animal && (draft.weightGrams > 0 || draft.showLegEarned)) {
            const animalRev = nextEntityRev(animal.id, animal._rev);
            const nextAnimal: Animal = {
              ...animal,
              weightGrams: draft.weightGrams > 0 ? draft.weightGrams : animal.weightGrams,
              legsCount: draft.showLegEarned ? animal.legsCount + 1 : animal.legsCount,
              _rev: animalRev,
              updatedAt: ts,
            };
            await adapterRef.current!.saveAnimal(nextAnimal);
            ops.push(
              ...diffEntityFieldsToOperations({
                entityType: 'animal',
                previous: animal,
                next: nextAnimal,
                deviceId,
                nextCounter: allocateNextLogicalCounter,
                timestamp: ts,
                recordRev: animalRev,
              })
            );
          }

          await recordOutboxOps(ops);
          await reloadFromAdapter();
          notify(`${draft.type} logged.`);
          return true;
        } catch (err) {
          reportPersistenceFailure(`save ${draft.type} entry`, err);
          return false;
        }
      });
    },
    [
      snapshot,
      deviceId,
      nextEntityRev,
      enqueueStoreMutation,
      recordOutboxOps,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
    ]
  );

  const commitBarnBenchEntry = useCallback(
    async (
      draft: BarnBenchBatchEntryDraft
    ): Promise<{ ok: boolean; animalId: string; summary: string[] }> => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current ?? snapshot;
        if (!currentSnapshot) {
          return { ok: false, animalId: draft.animalId, summary: [] };
        }
        const animal = currentSnapshot.animals.find((a) => a.id === draft.animalId);
        if (!animal || animal.offloadedArchiveKey) {
          return { ok: false, animalId: draft.animalId, summary: [] };
        }

        const ts = getAdjustedNowIsoUtc();
        const { buildBarnBenchCommitPlan } = await import('../domain/barnBench');
        const plan = buildBarnBenchCommitPlan(animal, draft, ts);
        if (!plan.hasChanges) {
          return { ok: false, animalId: animal.id, summary: [] };
        }

        try {
          const ops: SyncOperation[] = [];
          const adapter = adapterRef.current!;

          if (plan.careLogs.length > 0) {
            if (adapter.saveCareLogsBatch) {
              await adapter.saveCareLogsBatch(plan.careLogs);
            } else {
              for (const log of plan.careLogs) {
                await adapter.saveCareLog(log);
              }
            }
            for (const log of plan.careLogs) {
              ops.push(
                ...diffEntityFieldsToOperations({
                  entityType: 'careLog',
                  previous: undefined,
                  next: log,
                  deviceId,
                  nextCounter: allocateNextLogicalCounter,
                  timestamp: ts,
                  recordRev: log._rev ?? 1,
                })
              );
            }
          }

          if (plan.updatedAnimal) {
            const animalRev = nextEntityRev(animal.id, animal._rev);
            const nextAnimal: Animal = {
              ...plan.updatedAnimal,
              _rev: animalRev,
            };
            await adapter.saveAnimal(nextAnimal);
            ops.push(
              ...diffEntityFieldsToOperations({
                entityType: 'animal',
                previous: animal,
                next: nextAnimal,
                deviceId,
                nextCounter: allocateNextLogicalCounter,
                timestamp: ts,
                recordRev: animalRev,
              })
            );
          }

          await recordOutboxOps(ops);
          await reloadFromAdapter();
          notify(`${animal.name}: ${plan.summaryParts.join(' · ')} saved.`);
          return { ok: true, animalId: animal.id, summary: plan.summaryParts };
        } catch (err) {
          reportPersistenceFailure(`save Barn Bench entry for ${animal.name}`, err);
          return { ok: false, animalId: animal.id, summary: [] };
        }
      });
    },
    [
      snapshot,
      deviceId,
      nextEntityRev,
      enqueueStoreMutation,
      recordOutboxOps,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
    ]
  );

  const deleteCareLog = useCallback(
    async (id: string) => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        const target = currentSnapshot?.careLogs.find((l) => l.id === id);
        const ts = getAdjustedNowIsoUtc();
        try {
          await adapterRef.current!.deleteCareLog(id);
          await recordOutboxOps([
            createOutboxOperation({
              entityType: 'careLog',
              entityUuid: id,
              deviceId,
              logicalCounter: allocateNextLogicalCounter(),
              fieldName: '__delete__',
              newValue: true,
              timestamp: ts,
              recordRev: nextEntityRev(id, target?._rev),
            }),
          ]);
          await reloadFromAdapter();
        } catch (err) {
          reportPersistenceFailure('delete care log entry', err);
        }
      });
    },
    [enqueueStoreMutation, deviceId, nextEntityRev, recordOutboxOps, reloadFromAdapter, reportPersistenceFailure]
  );

  /** Show results drive each entered animal's leg counter; save and delete share this cascade. */
  const applyShowLegDeltas = useCallback(
    async (
      previousResults: ShowEvent['results'],
      nextResults: ShowEvent['results'],
      snapshotForLegs: BarnDatabaseSnapshot | null,
      timestamp: string,
      ops: SyncOperation[]
    ) => {
      const legDeltas = computeShowLegDeltas(previousResults, nextResults);
      if (legDeltas.size === 0 || !snapshotForLegs) return;
      for (const [animalId, delta] of legDeltas.entries()) {
        const animal = snapshotForLegs.animals.find((a) => a.id === animalId);
        if (!animal) continue;
        const nextLegs = Math.max(0, (animal.legsCount || 0) + delta);
        if (nextLegs === animal.legsCount) continue;
        const animalRev = nextEntityRev(animal.id, animal._rev);
        const nextAnimal: Animal = {
          ...animal,
          legsCount: nextLegs,
          _rev: animalRev,
          updatedAt: timestamp,
        };
        await adapterRef.current!.saveAnimal(nextAnimal);
        ops.push(
          ...diffEntityFieldsToOperations({
            entityType: 'animal',
            previous: animal,
            next: nextAnimal,
            deviceId,
            nextCounter: allocateNextLogicalCounter,
            timestamp,
            recordRev: animalRev,
          })
        );
      }
    },
    [deviceId, nextEntityRev]
  );

  const saveShow = useCallback(
    async (
      draft: Omit<ShowEvent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<boolean> => {
      const saved = await saveEntityRecord(
        entityCrudPorts,
        {
          entityType: 'show',
          readRows: (snap) => snap?.shows,
          build: (show, base): ShowEvent => {
            const cleanResults = normalizeShowResults(show.results ?? [], { dropEmpty: true });
            return {
              ...show,
              ...base,
              name: show.name.trim(),
              enteredAnimalIds: mergeEnteredAnimalIdsWithResults(
                show.enteredAnimalIds ?? [],
                cleanResults
              ),
              results: cleanResults.length > 0 ? cleanResults : undefined,
            };
          },
          persist: (show) => adapterRef.current!.saveShow(show),
          describe: (show) => `Show "${show.name}" saved.`,
          failureLabel: (show) => `save show "${show.name}"`,
          cascade: ({ row: show, prev, snapshot: currentSnapshot, timestamp, ops }) =>
            applyShowLegDeltas(prev?.results, show.results, currentSnapshot, timestamp, ops),
        },
        draft
      );
      return saved !== null;
    },
    [entityCrudPorts, applyShowLegDeltas]
  );

  const deleteShow = useCallback(
    async (id: string) =>
      deleteEntityRecord(
        entityCrudPorts,
        {
          entityType: 'show',
          readRows: (snap) => snap?.shows,
          remove: (showId) => adapterRef.current!.deleteShow(showId),
          message: 'Show removed.',
          failureLabel: 'delete show',
          cascade: ({ target, snapshot: currentSnapshot, timestamp, ops }) =>
            applyShowLegDeltas(target?.results, undefined, currentSnapshot, timestamp, ops),
        },
        id
      ),
    [entityCrudPorts, applyShowLegDeltas]
  );

  const saveFeedBatch = useCallback(
    async (
      batchDraft: Omit<FeedBatch, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<boolean> => {
      const saved = await saveEntityRecord(
        entityCrudPorts,
        {
          entityType: 'feedBatch',
          readRows: (snap) => snap?.feedBatches,
          build: (batch, base) => ({
            ...batch,
            ...base,
            brand: batch.brand.trim(),
            productName: batch.productName.trim(),
            lotNumber: batch.lotNumber.trim(),
            millCode: (batch.millCode || '').trim(),
            manufactureDateIso: (batch.manufactureDateIso || '').trim(),
            purchaseDateIso: batch.purchaseDateIso || todayDateIso(),
            bagCount: Math.max(0, Number(batch.bagCount) || 0),
            bagWeightValue: Math.max(0, Number(batch.bagWeightValue) || 0),
            bagWeightUnit: (batch.bagWeightUnit || '').trim() || 'lbs',
            totalQuantity: Math.max(0, Number(batch.totalQuantity) || 0),
            remainingQuantity: Math.max(0, Number(batch.remainingQuantity) || 0),
            lowStockThreshold: Math.max(0, Number(batch.lowStockThreshold) || 0),
            supplierName: (batch.supplierName || '').trim(),
            notes: (batch.notes || '').trim(),
          }),
          persist: (batch) => adapterRef.current!.saveFeedBatch(batch),
          describe: (batch) =>
            batch.lotNumber
              ? `Saved feed batch ${batch.brand || batch.productName} (Lot ${batch.lotNumber}).`
              : `Saved feed batch ${batch.brand || batch.productName}.`,
          failureLabel: (batch) => `save feed batch ${batch.brand || batch.productName}`,
        },
        batchDraft
      );
      return saved !== null;
    },
    [entityCrudPorts]
  );

  const deleteFeedBatch = useCallback(
    async (id: string) =>
      deleteEntityRecord(
        entityCrudPorts,
        {
          entityType: 'feedBatch',
          readRows: (snap) => snap?.feedBatches,
          remove: (batchId) => adapterRef.current!.deleteFeedBatch(batchId),
          message: 'Feed batch and linked allocations removed.',
          failureLabel: 'delete feed batch',
          cascade: async ({ snapshot: currentSnapshot, timestamp, ops }) => {
            const linkedAllocations = (currentSnapshot?.feedAllocations ?? []).filter(
              (allocation) => allocation.feedBatchId === id
            );
            for (const allocation of linkedAllocations) {
              await adapterRef.current!.deleteFeedAllocation(allocation.id);
              ops.push(
                createOutboxOperation({
                  entityType: 'feedAllocation',
                  entityUuid: allocation.id,
                  deviceId,
                  logicalCounter: allocateNextLogicalCounter(),
                  fieldName: '__delete__',
                  newValue: true,
                  timestamp,
                  recordRev: nextEntityRev(allocation.id, allocation._rev),
                })
              );
            }
          },
        },
        id
      ),
    [entityCrudPorts, deviceId, nextEntityRev]
  );

  const logFeedAllocation = useCallback(
    async (
      allocationDraft: Omit<FeedAllocation, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
      options?: { syncLinkedCageFeed?: boolean }
    ): Promise<boolean> => {
      const saved = await saveEntityRecord(
        entityCrudPorts,
        {
          entityType: 'feedAllocation',
          readRows: (snap) => snap?.feedAllocations,
          build: (allocation, base, snap): FeedAllocation | null => {
            const batch = (snap?.feedBatches ?? []).find((b) => b.id === allocation.feedBatchId);
            if (!batch) return null;
            return {
              ...allocation,
              ...base,
              quantity: Math.max(0, Number(allocation.quantity) || 0),
              unit: (allocation.unit || '').trim() || batch.bagWeightUnit || 'lbs',
              dateIso: allocation.dateIso || todayDateIso(),
              targetLabel: (allocation.targetLabel || '').trim() || 'General Barn',
              notes: (allocation.notes || '').trim(),
            };
          },
          onAborted: () => notify('Selected feed batch no longer exists.'),
          persist: (allocation) => adapterRef.current!.saveFeedAllocation(allocation),
          describe: (allocation) =>
            `Logged ${allocation.quantity} ${allocation.unit} feed allocation to ${allocation.targetLabel}.`,
          failureLabel: () => 'log feed allocation',
          cascade: async ({ row: allocation, prev, snapshot: currentSnapshot, timestamp, ops }) => {
            const batch = (currentSnapshot?.feedBatches ?? []).find(
              (b) => b.id === allocation.feedBatchId
            );
            if (!batch) return;
            if (!prev && allocation.quantity > 0) {
              const { applyFeedAllocationToBatch } = await import('../domain/feedInventory');
              const batchRev = nextEntityRev(batch.id, batch._rev);
              const updatedBatch: FeedBatch = {
                ...applyFeedAllocationToBatch(batch, allocation.quantity, timestamp),
                _rev: batchRev,
              };
              await adapterRef.current!.saveFeedBatch(updatedBatch);
              ops.push(
                ...diffEntityFieldsToOperations({
                  entityType: 'feedBatch',
                  previous: batch,
                  next: updatedBatch,
                  deviceId,
                  nextCounter: allocateNextLogicalCounter,
                  timestamp,
                  recordRev: batchRev,
                })
              );
            }

            if (
              options?.syncLinkedCageFeed &&
              allocation.targetType === 'cage' &&
              allocation.targetId
            ) {
              const targetCage = currentSnapshot?.cages.find((c) => c.id === allocation.targetId);
              if (targetCage) {
                const cageRev = nextEntityRev(targetCage.id, targetCage._rev);
                const lotSummary = batch.lotNumber
                  ? `${batch.brand || batch.productName} (Lot ${batch.lotNumber})`
                  : `${batch.brand} ${batch.productName}`.trim();
                const nextCageStock =
                  Math.round(
                    ((Number(targetCage.feedStockRemaining) || 0) + allocation.quantity) * 100
                  ) / 100;
                const updatedCage: CageLocation = {
                  ...targetCage,
                  feedLotName: lotSummary,
                  feedStockRemaining: nextCageStock,
                  feedStockUnit: allocation.unit,
                  _rev: cageRev,
                  updatedAt: timestamp,
                };
                await adapterRef.current!.saveCage(updatedCage);
                ops.push(
                  ...diffEntityFieldsToOperations({
                    entityType: 'cage',
                    previous: targetCage,
                    next: updatedCage,
                    deviceId,
                    nextCounter: allocateNextLogicalCounter,
                    timestamp,
                    recordRev: cageRev,
                  })
                );
              }
            }
          },
        },
        allocationDraft
      );
      return saved !== null;
    },
    [entityCrudPorts, deviceId, nextEntityRev]
  );

  const deleteFeedAllocation = useCallback(
    async (id: string) => {
      const target = snapshotRef.current?.feedAllocations?.find((allocation) => allocation.id === id);
      if (!target) return;
      await deleteEntityRecord(
        entityCrudPorts,
        {
          entityType: 'feedAllocation',
          readRows: (snap) => snap?.feedAllocations,
          remove: (allocationId) => adapterRef.current!.deleteFeedAllocation(allocationId),
          message: 'Feed allocation removed and batch stock restored.',
          failureLabel: 'delete feed allocation',
          cascade: async ({ target: allocation, snapshot: currentSnapshot, timestamp, ops }) => {
            if (!allocation || allocation.quantity <= 0) return;
            const batch = (currentSnapshot?.feedBatches ?? []).find(
              (b) => b.id === allocation.feedBatchId
            );
            if (!batch) return;
            const { reverseFeedAllocationFromBatch } = await import('../domain/feedInventory');
            const batchRev = nextEntityRev(batch.id, batch._rev);
            const restoredBatch: FeedBatch = {
              ...reverseFeedAllocationFromBatch(batch, allocation.quantity, timestamp),
              _rev: batchRev,
            };
            await adapterRef.current!.saveFeedBatch(restoredBatch);
            ops.push(
              ...diffEntityFieldsToOperations({
                entityType: 'feedBatch',
                previous: batch,
                next: restoredBatch,
                deviceId,
                nextCounter: allocateNextLogicalCounter,
                timestamp,
                recordRev: batchRev,
              })
            );
          },
        },
        id
      );
    },
    [entityCrudPorts, deviceId, nextEntityRev]
  );

  const runFeedTagBiosecurityAutoPurge = useCallback(
    async (options?: {
      windowDays?: FeedPurgeWindowDays;
      silent?: boolean;
      todayIso?: string;
    }): Promise<{ purgedCount: number; reclaimedBytes: number }> => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot) return { purgedCount: 0, reclaimedBytes: 0 };
        const effectiveWindow = normalizeFeedPurgeWindowDays(
          options?.windowDays ?? currentSnapshot.settings.feedTagPurgeWindowDays
        );
        if (effectiveWindow === 0) {
          if (!options?.silent) {
            notify('Biosecurity auto-purge is set to Manual Only (0 days).');
          }
          return { purgedCount: 0, reclaimedBytes: 0 };
        }
        const ts = getAdjustedNowIsoUtc();
        const { purgeExpiredFeedTagPhotosPure } = await import('../domain/feedInventory');
        const result = purgeExpiredFeedTagPhotosPure(
          currentSnapshot.feedBatches ?? [],
          effectiveWindow,
          {
            todayIso: options?.todayIso ?? todayDateIso(),
            nowIso: ts,
          }
        );
        if (result.purgedCount === 0) {
          if (!options?.silent) {
            notify(
              `No indexed feed tag photos older than ${effectiveWindow} days needed purging.`
            );
          }
          return { purgedCount: 0, reclaimedBytes: 0 };
        }
        try {
          const prevById = new Map((currentSnapshot.feedBatches ?? []).map((b) => [b.id, b]));
          const changedBatches: FeedBatch[] = [];
          const ops: SyncOperation[] = [];
          for (const nextBatch of result.nextBatches) {
            const prev = prevById.get(nextBatch.id);
            if (!prev || prev.tagPhotoPurgedAtIso === nextBatch.tagPhotoPurgedAtIso) continue;
            const rev = nextEntityRev(nextBatch.id, prev._rev);
            const bumped: FeedBatch = {
              ...nextBatch,
              _rev: rev,
            };
            changedBatches.push(bumped);
            ops.push(
              ...diffEntityFieldsToOperations({
                entityType: 'feedBatch',
                previous: prev,
                next: bumped,
                deviceId,
                nextCounter: allocateNextLogicalCounter,
                timestamp: ts,
                recordRev: rev,
              })
            );
          }
          if (changedBatches.length > 0) {
            await adapterRef.current!.saveFeedBatchesBatch(changedBatches);
            await recordOutboxOps(ops);
            await reloadFromAdapter();
          }
          if (!options?.silent) {
            notify(
              `Biosecurity purge reclaimed ${formatByteSizePure(result.reclaimedBytes)} across ${result.purgedCount} indexed feed tag photo${result.purgedCount === 1 ? '' : 's'} (lot numbers kept intact).`
            );
          }
          return { purgedCount: result.purgedCount, reclaimedBytes: result.reclaimedBytes };
        } catch (err) {
          reportPersistenceFailure('purge expired feed tag photos', err);
          return { purgedCount: 0, reclaimedBytes: 0 };
        }
      });
    },
    [
      enqueueStoreMutation,
      deviceId,
      nextEntityRev,
      recordOutboxOps,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
    ]
  );

  const feedAutoPurgeRanRef = useRef<boolean>(false);
  useEffect(() => {
    if (isLoading || !hasSnapshotReady || wipedRecoveryDetected || feedAutoPurgeRanRef.current) {
      return;
    }
    const currentSnapshot = snapshotRef.current;
    if (!currentSnapshot) return;
    const windowDays = normalizeFeedPurgeWindowDays(currentSnapshot.settings.feedTagPurgeWindowDays);
    if (windowDays <= 0) {
      feedAutoPurgeRanRef.current = true;
      return;
    }
    const hasUnpurgedTagPhoto = (currentSnapshot.feedBatches ?? []).some(
      (b) => !b.tagPhotoPurgedAtIso && Boolean(b.tagPhotoThumbnailDataUrl || b.tagPhotoDataUrl)
    );
    if (!hasUnpurgedTagPhoto) {
      feedAutoPurgeRanRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      if (feedAutoPurgeRanRef.current) return;
      feedAutoPurgeRanRef.current = true;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void runFeedTagBiosecurityAutoPurge({ silent: true, windowDays });
    }, 2500);
    return () => clearTimeout(timer);
  }, [isLoading, hasSnapshotReady, wipedRecoveryDetected, runFeedTagBiosecurityAutoPurge]);

  const saveLedgerEntry = useCallback(
    async (
      draft: Omit<LedgerEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<boolean> => {
      const saved = await saveEntityRecord(
        entityCrudPorts,
        {
          entityType: 'ledgerEntry',
          readRows: (snap) => snap?.ledgerEntries,
          build: (entry, base) => ({
            ...entry,
            ...base,
            dateIso: (entry.dateIso || '').trim() || todayDateIso(),
            entryType: normalizeLedgerEntryType(entry.entryType, 'expense'),
            category: normalizeLedgerCategory(entry.category, 'other'),
            amountCents: Math.max(0, Math.round(Number(entry.amountCents) || 0)),
            title: (entry.title || '').trim() || 'Ledger Entry',
            vendorOrParty: (entry.vendorOrParty || '').trim(),
            notes: (entry.notes || '').trim(),
          }),
          persist: (entry) => adapterRef.current!.saveLedgerEntry(entry),
          describe: (entry) =>
            `Saved ${entry.entryType === 'income' ? 'income' : 'expense'}: ${entry.title}.`,
          failureLabel: (entry) => `save ledger entry ${entry.title}`,
          ignoreFields: ['receiptPhotoDataUrl', 'receiptPhotoThumbnailDataUrl'],
          outboxRow: (entry) => ({
            ...entry,
            receiptPhotoDataUrl: '',
            receiptPhotoThumbnailDataUrl: '',
          }),
        },
        draft
      );
      return saved !== null;
    },
    [entityCrudPorts]
  );

  const deleteLedgerEntry = useCallback(
    async (id: string) =>
      deleteEntityRecord(
        entityCrudPorts,
        {
          entityType: 'ledgerEntry',
          readRows: (snap) => snap?.ledgerEntries,
          remove: (entryId) => adapterRef.current!.deleteLedgerEntry(entryId),
          message: 'Ledger entry deleted.',
          failureLabel: 'delete ledger entry',
        },
        id
      ),
    [entityCrudPorts]
  );

  const saveProcessingLog = useCallback(
    async (
      draft: Omit<ProcessingLog, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<boolean> => {
      const saved = await saveEntityRecord(
        entityCrudPorts,
        {
          entityType: 'processingLog',
          readRows: (snap) => snap?.processingLogs,
          build: async (log, base) => {
            const liveGrams = Math.max(0, Math.round(Number(log.liveWeightGrams) || 0));
            const dressedGrams = Math.max(0, Math.round(Number(log.dressedWeightGrams) || 0));
            const { calculateDressOutPercent } = await import('../domain/economicsLedger');
            const computedDressPct = calculateDressOutPercent(liveGrams, dressedGrams);
            return {
              ...log,
              ...base,
              title: (log.title || '').trim() || 'Processing Batch',
              scheduledDateIso: (log.scheduledDateIso || '').trim(),
              harvestDateIso: (log.harvestDateIso || '').trim(),
              status: normalizeProcessingStatus(log.status, 'Processed'),
              animalCount: Math.max(1, Math.round(Number(log.animalCount) || 1)),
              liveWeightGrams: liveGrams,
              dressedWeightGrams: dressedGrams,
              ...(computedDressPct !== undefined
                ? { dressOutPercent: computedDressPct }
                : typeof log.dressOutPercent === 'number' && log.dressOutPercent > 0
                ? { dressOutPercent: log.dressOutPercent }
                : {}),
              peltCount: Math.max(0, Math.round(Number(log.peltCount) || 0)),
              peltGrade: normalizePeltGrade(log.peltGrade),
              peltColorNotes: (log.peltColorNotes || '').trim(),
              notes: (log.notes || '').trim(),
            };
          },
          persist: (log) => adapterRef.current!.saveProcessingLog(log),
          describe: (log) => `Saved processing log: ${log.title} (${log.status}).`,
          failureLabel: (log) => `save processing log ${log.title}`,
        },
        draft
      );
      return saved !== null;
    },
    [entityCrudPorts]
  );

  const deleteProcessingLog = useCallback(
    async (id: string) =>
      deleteEntityRecord(
        entityCrudPorts,
        {
          entityType: 'processingLog',
          readRows: (snap) => snap?.processingLogs,
          remove: (logId) => adapterRef.current!.deleteProcessingLog(logId),
          message: 'Processing log deleted.',
          failureLabel: 'delete processing log',
        },
        id
      ),
    [entityCrudPorts]
  );

  const saveYouthProjectBook = useCallback(
    async (
      draft: Omit<YouthProjectBook, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<boolean> => {
      const saved = await saveEntityRecord(
        entityCrudPorts,
        {
          entityType: 'youthProjectBook',
          readRows: (snap) => snap?.youthProjectBooks,
          build: (project, base): YouthProjectBook => ({
            ...project,
            ...base,
            organization: normalizeYouthOrgType(project.organization, '4-H'),
            projectTitle: (project.projectTitle || '').trim() || 'Youth Livestock Project',
            memberName: (project.memberName || '').trim(),
            clubOrChapter: (project.clubOrChapter || '').trim(),
            leaderOrAdvisor: (project.leaderOrAdvisor || '').trim(),
            projectYear: (project.projectYear || '').trim() || todayDateIso().slice(0, 4),
            startDateIso: (project.startDateIso || '').trim() || todayDateIso(),
            endDateIso: (project.endDateIso || '').trim(),
            status: project.status === 'Completed' ? 'Completed' : 'Active',
            linkedAnimalIds: Array.isArray(project.linkedAnimalIds) ? project.linkedAnimalIds : [],
            linkedBreedingIds: Array.isArray(project.linkedBreedingIds)
              ? project.linkedBreedingIds
              : [],
            startingInventoryValueCents: Math.max(
              0,
              Math.round(Number(project.startingInventoryValueCents) || 0)
            ),
            endingInventoryValueCents: Math.max(
              0,
              Math.round(Number(project.endingInventoryValueCents) || 0)
            ),
            feedLogs: normalizeYouthProjectFeedLogs(project.feedLogs),
            goalsAndReflection: (project.goalsAndReflection || '').trim(),
            showAndCommunityNotes: (project.showAndCommunityNotes || '').trim(),
            notes: (project.notes || '').trim(),
          }),
          persist: (project) => adapterRef.current!.saveYouthProjectBook(project),
          describe: (project) =>
            `Saved ${project.organization} project book: ${project.projectTitle}.`,
          failureLabel: (project) => `save youth project book ${project.projectTitle}`,
        },
        draft
      );
      return saved !== null;
    },
    [entityCrudPorts]
  );

  const deleteYouthProjectBook = useCallback(
    async (id: string) =>
      deleteEntityRecord(
        entityCrudPorts,
        {
          entityType: 'youthProjectBook',
          readRows: (snap) => snap?.youthProjectBooks,
          remove: (projectId) => adapterRef.current!.deleteYouthProjectBook(projectId),
          message: 'Youth project record book deleted.',
          failureLabel: 'delete youth project book',
        },
        id
      ),
    [entityCrudPorts]
  );

  const saveClientContact = useCallback(
    async (
      draft: Omit<ClientContact, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<string | null> => {
      const saved = await saveEntityRecord(
        entityCrudPorts,
        {
          entityType: 'clientContact',
          readRows: (snap) => snap?.clientContacts,
          build: (contact, base) => ({
            ...contact,
            ...base,
            fullName: (contact.fullName || '').trim() || 'Buyer',
            ranchOrHerdName: (contact.ranchOrHerdName || '').trim(),
            email: (contact.email || '').trim(),
            phone: (contact.phone || '').trim(),
            preferredContact: normalizePreferredContactMethod(contact.preferredContact, 'sms'),
            clientKind: normalizeClientKind(contact.clientKind, 'pet_buyer'),
            cityState: (contact.cityState || '').trim(),
            shippingAddress: (contact.shippingAddress || '').trim(),
            tags: Array.isArray(contact.tags)
              ? Array.from(new Set(contact.tags.map((t) => t.trim()).filter(Boolean)))
              : [],
            notes: (contact.notes || '').trim(),
          }),
          persist: (contact) => adapterRef.current!.saveClientContact(contact),
          describe: (contact) => `Saved client contact: ${contact.fullName}.`,
          failureLabel: (contact) => `save client contact ${contact.fullName}`,
        },
        draft
      );
      return saved ? saved.id : null;
    },
    [entityCrudPorts]
  );

  const deleteClientContact = useCallback(
    async (id: string) =>
      deleteEntityRecord(
        entityCrudPorts,
        {
          entityType: 'clientContact',
          readRows: (snap) => snap?.clientContacts,
          remove: (contactId) => adapterRef.current!.deleteClientContact(contactId),
          message: 'Client contact deleted.',
          failureLabel: 'delete client contact',
        },
        id
      ),
    [entityCrudPorts]
  );

  const saveWaitlistEntry = useCallback(
    async (
      draft: Omit<WaitlistEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<string | null> => {
      const saved = await saveEntityRecord(
        entityCrudPorts,
        {
          entityType: 'waitlistEntry',
          readRows: (snap) => snap?.waitlistEntries,
          build: (entry, base, snap): WaitlistEntry => {
            const linkedClient = entry.clientId
              ? (snap?.clientContacts ?? []).find((c) => c.id === entry.clientId)
              : undefined;
            const maxBudgetNum =
              entry.maxBudgetCents !== undefined && Number.isFinite(Number(entry.maxBudgetCents))
                ? Math.max(0, Math.round(Number(entry.maxBudgetCents)))
                : undefined;
            return {
              ...entry,
              ...base,
              clientName: linkedClient?.fullName || (entry.clientName || '').trim() || 'Buyer',
              priorityRank: Math.max(1, Math.round(Number(entry.priorityRank) || 1)),
              status: normalizeWaitlistStatus(entry.status, 'Active'),
              intent: normalizeWaitlistIntent(entry.intent, 'Show / Breeding'),
              desiredBreed: (entry.desiredBreed || '').trim(),
              desiredVariety: (entry.desiredVariety || '').trim(),
              preferredSex:
                entry.preferredSex === 'Male' || entry.preferredSex === 'Female'
                  ? entry.preferredSex
                  : 'Any',
              preferredBreedingId: entry.preferredBreedingId || undefined,
              requestedByDateIso: (entry.requestedByDateIso || '').trim(),
              inquiryDateIso: (entry.inquiryDateIso || '').trim() || todayDateIso(),
              followUpDateIso: (entry.followUpDateIso || '').trim(),
              lastContactedDateIso: (entry.lastContactedDateIso || '').trim(),
              maxBudgetCents: maxBudgetNum && maxBudgetNum > 0 ? maxBudgetNum : undefined,
              notes: (entry.notes || '').trim(),
            };
          },
          persist: (entry) => adapterRef.current!.saveWaitlistEntry(entry),
          describe: (entry) =>
            `Saved waitlist entry #${entry.priorityRank} for ${entry.clientName}.`,
          failureLabel: (entry) => `save waitlist entry for ${entry.clientName}`,
        },
        draft
      );
      return saved ? saved.id : null;
    },
    [entityCrudPorts]
  );

  const deleteWaitlistEntry = useCallback(
    async (id: string) =>
      deleteEntityRecord(
        entityCrudPorts,
        {
          entityType: 'waitlistEntry',
          readRows: (snap) => snap?.waitlistEntries,
          remove: (entryId) => adapterRef.current!.deleteWaitlistEntry(entryId),
          message: 'Waitlist entry deleted.',
          failureLabel: 'delete waitlist entry',
        },
        id
      ),
    [entityCrudPorts]
  );

  const saveAnimalReservation = useCallback(
    async (
      draft: Omit<AnimalReservation, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<string | null> => {
      const isEdit = Boolean(draft.id);
      const saved = await saveEntityRecord(
        entityCrudPorts,
        {
          entityType: 'animalReservation',
          readRows: (snap) => snap?.animalReservations,
          build: async (reservation, base, snap, prev): Promise<AnimalReservation> => {
            const linkedClient = reservation.clientId
              ? (snap?.clientContacts ?? []).find((c) => c.id === reservation.clientId)
              : undefined;
            const speciesReservations = (snap?.animalReservations ?? []).filter((r) =>
              isSameSpecies(r.species, reservation.species)
            );
            const { buildSuggestedAgreementNumber, evaluateReservationFinancials } =
              await import('../domain/clientCrm');
            const agreementNumber =
              (reservation.agreementNumber || '').trim() ||
              prev?.agreementNumber ||
              buildSuggestedAgreementNumber(speciesReservations);
            const status = normalizeReservationStatus(reservation.status, 'Pending Deposit');
            const totalPriceCents = Math.max(
              0,
              Math.round(Number(reservation.totalPriceCents) || 0)
            );
            const depositRequiredCents = Math.max(
              0,
              Math.round(Number(reservation.depositRequiredCents) || 0)
            );
            const depositPaidCents = Math.max(
              0,
              Math.round(Number(reservation.depositPaidCents) || 0)
            );
            const fin = evaluateReservationFinancials({
              status,
              totalPriceCents,
              depositRequiredCents,
              depositPaidCents,
            });
            return {
              ...reservation,
              ...base,
              agreementNumber,
              clientName:
                linkedClient?.fullName || (reservation.clientName || '').trim() || 'Buyer',
              waitlistEntryId: reservation.waitlistEntryId || undefined,
              animalId: reservation.animalId || undefined,
              breedingId: reservation.breedingId || undefined,
              pickOrder:
                reservation.pickOrder !== undefined && Number(reservation.pickOrder) > 0
                  ? Math.round(Number(reservation.pickOrder))
                  : undefined,
              itemLabel: (reservation.itemLabel || '').trim() || 'Reserved Animal / Pick',
              status: isEdit ? status : fin.suggestedStatus,
              reservedDateIso: (reservation.reservedDateIso || '').trim() || todayDateIso(),
              holdExpiresDateIso: (reservation.holdExpiresDateIso || '').trim(),
              totalPriceCents,
              depositRequiredCents,
              depositPaidCents,
              depositDueDateIso: (reservation.depositDueDateIso || '').trim(),
              depositPaidDateIso: (reservation.depositPaidDateIso || '').trim(),
              pickupScheduledDateIso: (reservation.pickupScheduledDateIso || '').trim(),
              completedDateIso: (reservation.completedDateIso || '').trim(),
              balanceReminderDateIso: (reservation.balanceReminderDateIso || '').trim(),
              paymentMethod: (reservation.paymentMethod || '').trim(),
              ledgerEntryId: reservation.ledgerEntryId || undefined,
              termsSummary: (reservation.termsSummary || '').trim(),
              healthGuaranteeNotes: (reservation.healthGuaranteeNotes || '').trim(),
              notes: (reservation.notes || '').trim(),
            };
          },
          persist: (reservation) => adapterRef.current!.saveAnimalReservation(reservation),
          describe: (reservation) =>
            `Saved reservation ${reservation.agreementNumber} (${reservation.clientName}).`,
          failureLabel: (reservation) => `save reservation ${reservation.agreementNumber}`,
          cascade: async ({ row: reservation, snapshot: currentSnapshot, timestamp, ops }) => {
            if (
              !reservation.waitlistEntryId ||
              reservation.status === 'Cancelled' ||
              reservation.status === 'Inquiry Hold'
            ) {
              return;
            }
            const linkedWait = (currentSnapshot?.waitlistEntries ?? []).find(
              (entry) => entry.id === reservation.waitlistEntryId
            );
            if (!linkedWait || (linkedWait.status !== 'Active' && linkedWait.status !== 'Matched')) {
              return;
            }
            const nextWaitStatus: WaitlistEntry['status'] =
              reservation.status === 'Picked Up / Completed' ? 'Fulfilled' : 'Deposited';
            const waitRev = nextEntityRev(linkedWait.id, linkedWait._rev);
            const updatedWait: WaitlistEntry = {
              ...linkedWait,
              status: nextWaitStatus,
              _rev: waitRev,
              updatedAt: timestamp,
            };
            await adapterRef.current!.saveWaitlistEntry(updatedWait);
            ops.push(
              ...diffEntityFieldsToOperations({
                entityType: 'waitlistEntry',
                previous: linkedWait,
                next: updatedWait,
                deviceId,
                nextCounter: allocateNextLogicalCounter,
                timestamp,
                recordRev: waitRev,
              })
            );
          },
        },
        draft
      );
      return saved ? saved.id : null;
    },
    [entityCrudPorts, deviceId, nextEntityRev]
  );

  const deleteAnimalReservation = useCallback(
    async (id: string) => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        const target = (currentSnapshot?.animalReservations ?? []).find((x) => x.id === id);
        const ts = getAdjustedNowIsoUtc();
        try {
          await adapterRef.current!.deleteAnimalReservation(id);
          await recordOutboxOps([
            createOutboxOperation({
              entityType: 'animalReservation',
              entityUuid: id,
              deviceId,
              logicalCounter: allocateNextLogicalCounter(),
              fieldName: '__delete__',
              newValue: true,
              timestamp: ts,
              recordRev: nextEntityRev(id, target?._rev),
            }),
          ]);
          await reloadFromAdapter();
          notify('Reservation deleted.');
        } catch (err) {
          reportPersistenceFailure('delete reservation', err);
        }
      });
    },
    [
      enqueueStoreMutation,
      deviceId,
      nextEntityRev,
      recordOutboxOps,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
    ]
  );

  const saveWoolHarvest = useCallback(
    async (
      draft: Omit<WoolHarvest, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<string | null> => {
      const saved = await saveEntityRecord(
        entityCrudPorts,
        {
          entityType: 'woolHarvest',
          readRows: (snap) => snap?.woolHarvests,
          build: (harvest, base) =>
            normalizeWoolHarvest(
              {
                ...harvest,
                ...base,
              },
              harvest.species || activeSpeciesNameRef.current || 'Rabbit'
            ),
          persist: (harvest) => adapterRef.current!.saveWoolHarvest(harvest),
          describe: (harvest) =>
            `Saved wool harvest (${
              harvest.primeWeightGrams + harvest.gradeWeightGrams
            } g on ${harvest.harvestDateIso}).`,
          failureLabel: () => 'save wool harvest',
        },
        draft
      );
      return saved ? saved.id : null;
    },
    [entityCrudPorts]
  );

  const deleteWoolHarvest = useCallback(
    async (id: string) =>
      deleteEntityRecord(
        entityCrudPorts,
        {
          entityType: 'woolHarvest',
          readRows: (snap) => snap?.woolHarvests,
          remove: (harvestId) => adapterRef.current!.deleteWoolHarvest(harvestId),
          message: 'Wool harvest record deleted.',
          failureLabel: 'delete wool harvest',
        },
        id
      ),
    [entityCrudPorts]
  );

  const saveMileageLog = useCallback(
    async (
      draft: Omit<MileageLog, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<string | null> => {
      const saved = await saveEntityRecord(
        entityCrudPorts,
        {
          entityType: 'mileageLog',
          readRows: (snap) => snap?.mileageLogs,
          build: (trip, base) =>
            normalizeMileageLog({
              ...trip,
              ...base,
              species: trip.species || activeSpeciesNameRef.current || 'Rabbit',
            }),
          persist: (trip) => adapterRef.current!.saveMileageLog(trip),
          describe: (trip) => `Saved mileage trip (${trip.miles.toFixed(1)} mi on ${trip.dateIso}).`,
          failureLabel: () => 'save mileage trip',
        },
        draft
      );
      return saved ? saved.id : null;
    },
    [entityCrudPorts]
  );

  const deleteMileageLog = useCallback(
    async (id: string) =>
      deleteEntityRecord(
        entityCrudPorts,
        {
          entityType: 'mileageLog',
          readRows: (snap) => snap?.mileageLogs,
          remove: (tripId) => adapterRef.current!.deleteMileageLog(tripId),
          message: 'Mileage trip deleted.',
          failureLabel: 'delete mileage trip',
        },
        id
      ),
    [entityCrudPorts]
  );

  const saveJournalEntry = useCallback(
    async (
      draft: Omit<BarnJournalEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<string | null> => {
      const saved = await saveEntityRecord(
        entityCrudPorts,
        {
          entityType: 'journalEntry',
          readRows: (snap) => snap?.journalEntries,
          build: (entry, base) =>
            normalizeBarnJournalEntry({
              ...entry,
              ...base,
              species: entry.species || activeSpeciesNameRef.current || 'Rabbit',
            }),
          persist: (entry) => adapterRef.current!.saveJournalEntry(entry),
          describe: (entry) => `Saved journal entry "${entry.title}".`,
          failureLabel: () => 'save journal entry',
        },
        draft
      );
      return saved ? saved.id : null;
    },
    [entityCrudPorts]
  );

  const deleteJournalEntry = useCallback(
    async (id: string) =>
      deleteEntityRecord(
        entityCrudPorts,
        {
          entityType: 'journalEntry',
          readRows: (snap) => snap?.journalEntries,
          remove: (entryId) => adapterRef.current!.deleteJournalEntry(entryId),
          message: 'Journal entry deleted.',
          failureLabel: 'delete journal entry',
        },
        id
      ),
    [entityCrudPorts]
  );

  const saveJudgeClub = useCallback(
    async (
      draft: Omit<JudgeClubContact, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<string | null> => {
      const saved = await saveEntityRecord(
        entityCrudPorts,
        {
          entityType: 'judgeClub',
          readRows: (snap) => snap?.judgeClubs,
          build: (club, base) =>
            normalizeJudgeClubContact({
              ...club,
              ...base,
              species: club.species || activeSpeciesNameRef.current || 'Rabbit',
            }),
          persist: (club) => adapterRef.current!.saveJudgeClub(club),
          describe: (club) => `Saved club contact "${club.clubName}".`,
          failureLabel: () => 'save club contact',
        },
        draft
      );
      return saved ? saved.id : null;
    },
    [entityCrudPorts]
  );

  const deleteJudgeClub = useCallback(
    async (id: string) =>
      deleteEntityRecord(
        entityCrudPorts,
        {
          entityType: 'judgeClub',
          readRows: (snap) => snap?.judgeClubs,
          remove: (clubId) => adapterRef.current!.deleteJudgeClub(clubId),
          message: 'Club contact deleted.',
          failureLabel: 'delete club contact',
        },
        id
      ),
    [entityCrudPorts]
  );

  const saveJudgeAssignment = useCallback(
    async (
      draft: Omit<JudgeAssignment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<string | null> => {
      const saved = await saveEntityRecord(
        entityCrudPorts,
        {
          entityType: 'judgeAssignment',
          readRows: (snap) => snap?.judgeAssignments,
          build: (assignment, base) =>
            normalizeJudgeAssignment({
              ...assignment,
              ...base,
              species: assignment.species || activeSpeciesNameRef.current || 'Rabbit',
            }),
          persist: (assignment) => adapterRef.current!.saveJudgeAssignment(assignment),
          describe: (assignment) => `Saved show assignment "${assignment.showName}".`,
          failureLabel: () => 'save show assignment',
        },
        draft
      );
      return saved ? saved.id : null;
    },
    [entityCrudPorts]
  );

  const deleteJudgeAssignment = useCallback(
    async (id: string) =>
      deleteEntityRecord(
        entityCrudPorts,
        {
          entityType: 'judgeAssignment',
          readRows: (snap) => snap?.judgeAssignments,
          remove: (assignmentId) => adapterRef.current!.deleteJudgeAssignment(assignmentId),
          message: 'Show assignment deleted.',
          failureLabel: 'delete show assignment',
        },
        id
      ),
    [entityCrudPorts]
  );

  const saveJudgeExpense = useCallback(
    async (
      draft: Omit<JudgeExpense, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<string | null> => {
      const saved = await saveEntityRecord(
        entityCrudPorts,
        {
          entityType: 'judgeExpense',
          readRows: (snap) => snap?.judgeExpenses,
          build: (expense, base) =>
            normalizeJudgeExpense({
              ...expense,
              ...base,
              species: expense.species || activeSpeciesNameRef.current || 'Rabbit',
            }),
          persist: (expense) => adapterRef.current!.saveJudgeExpense(expense),
          describe: (expense) => `Saved judging expense "${expense.description}".`,
          failureLabel: () => 'save judging expense',
        },
        draft
      );
      return saved ? saved.id : null;
    },
    [entityCrudPorts]
  );

  const deleteJudgeExpense = useCallback(
    async (id: string) =>
      deleteEntityRecord(
        entityCrudPorts,
        {
          entityType: 'judgeExpense',
          readRows: (snap) => snap?.judgeExpenses,
          remove: (expenseId) => adapterRef.current!.deleteJudgeExpense(expenseId),
          message: 'Judging expense deleted.',
          failureLabel: 'delete judging expense',
        },
        id
      ),
    [entityCrudPorts]
  );

  const completeReservationSale = useCallback(
    async (params: {
      reservationId: string;
      completedDateIso?: string;
      markAnimalSold?: boolean;
      recordLedgerIncome?: boolean;
    }): Promise<boolean> => {
      return enqueueStoreMutation(async () => {
        const latestSnapshot = snapshotRef.current ?? snapshot;
        if (!latestSnapshot) return false;
        const target = (latestSnapshot.animalReservations ?? []).find(
          (r) => r.id === params.reservationId
        );
        if (!target) return false;

        const ts = getAdjustedNowIsoUtc();
        const completedDateIso = (params.completedDateIso || '').trim() || todayDateIso();
        const finalPaidCents = Math.max(target.totalPriceCents, target.depositPaidCents);
        let ledgerEntryId = target.ledgerEntryId;
        const outboxOps: SyncOperation[] = [];

        try {
          if (params.recordLedgerIncome && finalPaidCents > 0 && !ledgerEntryId) {
            const newLedgerId = generateUuid();
            const ledgerRev = nextEntityRev(newLedgerId);
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
            await adapterRef.current!.saveLedgerEntry(ledgerEntry);
            outboxOps.push(
              ...diffEntityFieldsToOperations({
                entityType: 'ledgerEntry',
                previous: undefined,
                next: ledgerEntry,
                deviceId,
                nextCounter: allocateNextLogicalCounter,
                timestamp: ts,
                recordRev: ledgerRev,
              })
            );
            ledgerEntryId = newLedgerId;
          }

          if (params.markAnimalSold !== false && target.animalId) {
            const animalPrev = latestSnapshot.animals.find((a) => a.id === target.animalId);
            if (animalPrev) {
              const animalRev = nextEntityRev(animalPrev.id, animalPrev._rev);
              const updatedAnimal: Animal = {
                ...animalPrev,
                status: 'Sold',
                soldDateIso: animalPrev.soldDateIso || completedDateIso,
                salePriceCents: finalPaidCents > 0 ? finalPaidCents : animalPrev.salePriceCents,
                buyerName: target.clientName || animalPrev.buyerName,
                _rev: animalRev,
                updatedAt: ts,
              };
              await adapterRef.current!.saveAnimal(updatedAnimal);
              outboxOps.push(
                ...diffEntityFieldsToOperations({
                  entityType: 'animal',
                  previous: animalPrev,
                  next: updatedAnimal,
                  deviceId,
                  nextCounter: allocateNextLogicalCounter,
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
              const waitRev = nextEntityRev(waitPrev.id, waitPrev._rev);
              const updatedWait: WaitlistEntry = {
                ...waitPrev,
                status: 'Fulfilled',
                _rev: waitRev,
                updatedAt: ts,
              };
              await adapterRef.current!.saveWaitlistEntry(updatedWait);
              outboxOps.push(
                ...diffEntityFieldsToOperations({
                  entityType: 'waitlistEntry',
                  previous: waitPrev,
                  next: updatedWait,
                  deviceId,
                  nextCounter: allocateNextLogicalCounter,
                  timestamp: ts,
                  recordRev: waitRev,
                })
              );
            }
          }

          const resRev = nextEntityRev(target.id, target._rev);
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
          await adapterRef.current!.saveAnimalReservation(updatedRes);
          outboxOps.push(
            ...diffEntityFieldsToOperations({
              entityType: 'animalReservation',
              previous: target,
              next: updatedRes,
              deviceId,
              nextCounter: allocateNextLogicalCounter,
              timestamp: ts,
              recordRev: resRev,
            })
          );

          await recordOutboxOps(outboxOps);
          await reloadFromAdapter();
          notify(`Completed sale for ${target.agreementNumber} (${target.clientName}).`);
          return true;
        } catch (err) {
          reportPersistenceFailure(`complete sale ${target.agreementNumber}`, err);
          return false;
        }
      });
    },
    [
      snapshot,
      deviceId,
      nextEntityRev,
      enqueueStoreMutation,
      recordOutboxOps,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
    ]
  );

  const createCrmReminderTask = useCallback(
    async (speciesName: string, reminder: CrmFollowUpReminder): Promise<boolean> => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        const ts = getAdjustedNowIsoUtc();
        const taskId = generateUuid();
        const taskRev = nextEntityRev(taskId);
        const linkedAnimal = reminder.linkedAnimalId
          ? currentSnapshot?.animals.find((a) => a.id === reminder.linkedAnimalId)
          : undefined;
        const task: BarnTask = {
          id: taskId,
          species: speciesName,
          title: reminder.suggestedTaskTitle,
          category: reminder.suggestedTaskCategory,
          priority: reminder.suggestedTaskPriority,
          dueDateIso: reminder.targetDateIso || todayDateIso(),
          completed: false,
          linkedBreedingId: reminder.linkedBreedingId || '',
          linkedAnimalId: reminder.linkedAnimalId || '',
          linkedAnimalName: linkedAnimal?.name || reminder.clientName || '',
          _rev: taskRev,
          createdAt: ts,
          updatedAt: ts,
        };
        try {
          await adapterRef.current!.saveTask(task);
          await recordOutboxOps(
            diffEntityFieldsToOperations({
              entityType: 'task',
              previous: undefined,
              next: task,
              deviceId,
              nextCounter: allocateNextLogicalCounter,
              timestamp: ts,
              recordRev: taskRev,
            })
          );
          await reloadFromAdapter();
          notify(`Added Master Task: ${task.title}`);
          return true;
        } catch (err) {
          reportPersistenceFailure(`create CRM task ${task.title}`, err);
          return false;
        }
      });
    },
    [
      deviceId,
      nextEntityRev,
      enqueueStoreMutation,
      recordOutboxOps,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
    ]
  );

  const seedSpeciesSampleData = useCallback(
    async (speciesName: string) => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot) return;
        const existingProfile = currentSnapshot.speciesProfiles.find((sp) =>
          isSameSpecies(sp.name, speciesName)
        );
        const { buildSampleDataForSpecies } = await import('../domain/sampleData');
        const bundle = buildSampleDataForSpecies(speciesName, existingProfile);
        if (!bundle) {
          notify(`No predefined testing dataset found for ${speciesName}.`);
          return;
        }
        try {
          const spKey = speciesName.trim().toLowerCase();
          const seedTaskIds = new Set(bundle.tasks.map((t) => t.id));
          const nextIgnored = (currentSnapshot.settings.ignoredTaskIds || []).filter(
            (id) => !seedTaskIds.has(id)
          );
          const nextDismissed = { ...(currentSnapshot.settings.dismissedTaskGroupKeys || {}) };
          delete nextDismissed[spKey];
          const refreshedSettings: BarnSettings = {
            ...currentSnapshot.settings,
            ignoredTaskIds: nextIgnored,
            dismissedTaskGroupKeys: nextDismissed,
            updatedAt: getAdjustedNowIsoUtc(),
          };
          const { mergeBarnSnapshots } = await import('../domain/syncAndExports');
          const report = mergeBarnSnapshots(
            { ...currentSnapshot, settings: refreshedSettings },
            {
              settings: refreshedSettings,
              speciesProfiles: [bundle.speciesProfile],
              animals: bundle.animals,
              animalPhotos: [],
              cages: bundle.cages,
              breedings: bundle.breedings,
              tasks: bundle.tasks,
              careLogs: bundle.careLogs,
              shows: bundle.shows,
              feedBatches: [],
              feedAllocations: [],
              ledgerEntries: [],
              processingLogs: [],
              youthProjectBooks: [],
              clientContacts: [],
              waitlistEntries: [],
              animalReservations: [],
              woolHarvests: [],
              mileageLogs: [],
              journalEntries: [],
              judgeClubs: [],
              judgeAssignments: [],
              judgeExpenses: [],
            }
          );
          await adapterRef.current!.replaceSnapshot(report.snapshot);
          await reloadFromAdapter();
          notify(`Loaded 6-generation testing dataset for ${speciesName}.`);
        } catch (err) {
          reportPersistenceFailure(`load ${speciesName} testing dataset`, err);
        }
      });
    },
    [enqueueStoreMutation, reloadFromAdapter, notify, reportPersistenceFailure]
  );

  const seedAllPredefinedSpecies = useCallback(async () => {
    return enqueueStoreMutation(async () => {
      const currentSnapshot = snapshotRef.current;
      try {
        const cleanedSettings: Partial<BarnSettings> | undefined = currentSnapshot?.settings
          ? {
              ...currentSnapshot.settings,
              ignoredTaskIds: (currentSnapshot.settings.ignoredTaskIds || []).filter(
                (id) => !isSampleTestingId(id)
              ),
              dismissedTaskGroupKeys: {},
            }
          : undefined;
        const { buildFullPredefinedSampleSnapshot } = await import('../domain/sampleData');
        const full = buildFullPredefinedSampleSnapshot(cleanedSettings);
        const memoBySpeciesKey = new Map(
          (currentSnapshot?.speciesProfiles || []).map((sp) => [
            sp.name.trim().toLowerCase(),
            {
              memoText: sanitizeSpeciesMemo(sp.memoText ?? ''),
              memoUpdatedAt: sp.memoUpdatedAt || '',
            },
          ])
        );
        full.speciesProfiles = full.speciesProfiles.map((sp) => {
          const prevMemo = memoBySpeciesKey.get(sp.name.trim().toLowerCase());
          return prevMemo && prevMemo.memoText
            ? { ...sp, memoText: prevMemo.memoText, memoUpdatedAt: prevMemo.memoUpdatedAt }
            : sp;
        });
        await adapterRef.current!.replaceSnapshot(full);
        await reloadFromAdapter();
        notify(
          `Loaded 6-generation testing herds across all ${PREDEFINED_SPECIES_PRESETS.length} predefined species.`
        );
      } catch (err) {
        reportPersistenceFailure('load predefined testing herds', err);
      }
    });
  }, [enqueueStoreMutation, reloadFromAdapter, notify, reportPersistenceFailure]);

  const deleteSpeciesTestingData = useCallback(
    async (speciesName: string) => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot) return;
        const { purgeSpeciesTestingDataPure } = await import('../domain/sampleData');
        const { nextSnapshot, removedAnimals, removedTotalRecords, removedAnimalIds } =
          purgeSpeciesTestingDataPure(currentSnapshot, speciesName);
        if (removedTotalRecords === 0) {
          notify(`No testing records found in ${speciesName}.`);
          return;
        }
        try {
          await saveSafetyRollingBackup(currentSnapshot);
          await adapterRef.current!.replaceSnapshot(nextSnapshot);
          const keptPhotoIds = new Set((nextSnapshot.animalPhotos ?? []).map((p) => p.id));
          for (const photo of currentSnapshot.animalPhotos ?? []) {
            if (!keptPhotoIds.has(photo.id)) {
              forgetPhoto(photoCacheRef, photo.id);
            }
          }
          if (selectedAnimalId && removedAnimalIds.has(selectedAnimalId)) {
            setSelectedAnimalId(null);
          }
          if (pedigreeAnimalId && removedAnimalIds.has(pedigreeAnimalId)) {
            setPedigreeAnimalId(null);
          }
          await reloadFromAdapter();
          notify(
            `Deleted ${speciesName} testing data (${removedAnimals} sample animals, ${removedTotalRecords} total testing records).`
          );
        } catch (err) {
          reportPersistenceFailure(`delete ${speciesName} testing data`, err);
        }
      });
    },
    [enqueueStoreMutation, selectedAnimalId, pedigreeAnimalId, saveSafetyRollingBackup, reloadFromAdapter, notify, reportPersistenceFailure]
  );

  const deleteSpeciesNonTestingData = useCallback(
    async (speciesName: string) => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot) return;
        const { purgeSpeciesNonTestingDataPure } = await import('../domain/sampleData');
        const { nextSnapshot, removedAnimals, removedTotalRecords, removedAnimalIds } =
          purgeSpeciesNonTestingDataPure(currentSnapshot, speciesName);
        if (removedTotalRecords === 0) {
          notify(`No non-testing records found in ${speciesName}.`);
          return;
        }
        try {
          await saveSafetyRollingBackup(currentSnapshot);
          await adapterRef.current!.replaceSnapshot(nextSnapshot);
          const keptPhotoIds = new Set((nextSnapshot.animalPhotos ?? []).map((p) => p.id));
          for (const photo of currentSnapshot.animalPhotos ?? []) {
            if (!keptPhotoIds.has(photo.id)) {
              forgetPhoto(photoCacheRef, photo.id);
            }
          }
          if (selectedAnimalId && removedAnimalIds.has(selectedAnimalId)) {
            setSelectedAnimalId(null);
          }
          if (pedigreeAnimalId && removedAnimalIds.has(pedigreeAnimalId)) {
            setPedigreeAnimalId(null);
          }
          await reloadFromAdapter();
          notify(
            `Removed ${speciesName} non-testing data (${removedAnimals} animals, ${removedTotalRecords} total records).`
          );
        } catch (err) {
          reportPersistenceFailure(`remove ${speciesName} non-testing data`, err);
        }
      });
    },
    [enqueueStoreMutation, selectedAnimalId, pedigreeAnimalId, saveSafetyRollingBackup, reloadFromAdapter, notify, reportPersistenceFailure]
  );

  const deleteAllSpeciesRecords = useCallback(
    async (speciesName: string) => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot) return;
        const { purgeAllSpeciesRecordsPure } = await import('../domain/sampleData');
        const { nextSnapshot, removedAnimals, removedTotalRecords, removedAnimalIds } =
          purgeAllSpeciesRecordsPure(currentSnapshot, speciesName);
        if (removedTotalRecords === 0) {
          notify(`${speciesName} already has zero records.`);
          return;
        }
        try {
          await saveSafetyRollingBackup(currentSnapshot);
          await adapterRef.current!.replaceSnapshot(nextSnapshot);
          const keptPhotoIds = new Set((nextSnapshot.animalPhotos ?? []).map((p) => p.id));
          for (const photo of currentSnapshot.animalPhotos ?? []) {
            if (!keptPhotoIds.has(photo.id)) {
              forgetPhoto(photoCacheRef, photo.id);
            }
          }
          if (selectedAnimalId && removedAnimalIds.has(selectedAnimalId)) {
            setSelectedAnimalId(null);
          }
          if (pedigreeAnimalId && removedAnimalIds.has(pedigreeAnimalId)) {
            setPedigreeAnimalId(null);
          }
          await reloadFromAdapter();
          notify(
            `Deleted all ${speciesName} records (${removedAnimals} animals, ${removedTotalRecords} total records) while keeping ${speciesName} configured.`
          );
        } catch (err) {
          reportPersistenceFailure(`delete all ${speciesName} records`, err);
        }
      });
    },
    [enqueueStoreMutation, selectedAnimalId, pedigreeAnimalId, saveSafetyRollingBackup, reloadFromAdapter, notify, reportPersistenceFailure]
  );

  const clearAllRecordsKeepSpecies = useCallback(async () => {
    return enqueueStoreMutation(async () => {
      const currentSnapshot = snapshotRef.current;
      if (!currentSnapshot) return;
      try {
        await saveSafetyRollingBackup(currentSnapshot);
        const empty: BarnDatabaseSnapshot = {
          settings: {
            ...currentSnapshot.settings,
            lastBackupMeta: undefined,
            backupReminderSnoozedUntilMs: undefined,
            updatedAt: getAdjustedNowIsoUtc(),
          },
          speciesProfiles: currentSnapshot.speciesProfiles,
          animals: [],
          animalPhotos: [],
          cages: [],
          breedings: [],
          tasks: [],
          careLogs: [],
          shows: [],
          feedBatches: [],
          feedAllocations: [],
          ledgerEntries: [],
          processingLogs: [],
          youthProjectBooks: [],
          clientContacts: [],
          waitlistEntries: [],
          animalReservations: [],
          woolHarvests: [],
          mileageLogs: [],
          journalEntries: [],
          judgeClubs: [],
          judgeAssignments: [],
          judgeExpenses: [],
        };
        await adapterRef.current!.replaceSnapshot(empty);
        clearPhotoCache(photoCacheRef);
        await clearLocalSyncAndBackupReminderState();
        setSelectedAnimalId(null);
        setPedigreeAnimalId(null);
        await reloadFromAdapter();
        notify('Deleted all animal, photo, breeding, and chore data across all species.');
      } catch (err) {
        reportPersistenceFailure('clear all animal data', err);
      }
    });
  }, [
    enqueueStoreMutation,
    saveSafetyRollingBackup,
    clearLocalSyncAndBackupReminderState,
    reloadFromAdapter,
    notify,
    reportPersistenceFailure,
  ]);

  const restoreFactoryDefaults = useCallback(async () => {
    return enqueueStoreMutation(async () => {
      const currentSnapshot = snapshotRef.current;
      try {
        if (currentSnapshot) {
          await saveSafetyRollingBackup(currentSnapshot);
        }
        const { buildFullPredefinedSampleSnapshot } = await import('../domain/sampleData');
        const factorySnapshot = buildFullPredefinedSampleSnapshot();
        await adapterRef.current!.replaceSnapshot(factorySnapshot);
        clearPhotoCache(photoCacheRef);
        await clearLocalSyncAndBackupReminderState();
        setSelectedAnimalId(null);
        setPedigreeAnimalId(null);
        setPedigreeGenerations(factorySnapshot.settings.defaultGenerations);
        setActiveSpeciesName(factorySnapshot.settings.defaultSpecies || 'Rabbit');
        setRoute('home');
        await reloadFromAdapter();
        notify('Restored app to factory settings, theme palette, and 9 starter species herds.');
      } catch (err) {
        reportPersistenceFailure('restore factory defaults', err);
      }
    });
  }, [
    enqueueStoreMutation,
    saveSafetyRollingBackup,
    clearLocalSyncAndBackupReminderState,
    reloadFromAdapter,
    notify,
    reportPersistenceFailure,
  ]);

  const backupImportPorts = useMemo<BackupImportPorts>(
    () => ({
      snapshotRef,
      saveSafetyRollingBackup,
      clearPhotoCache: () => clearPhotoCache(photoCacheRef),
      replaceSnapshot: (next) => adapterRef.current!.replaceSnapshot(next),
      clearLocalSyncAndBackupReminderState,
      clearWipedRecoveryContext: () => setWipedRecoveryContext(null),
      reloadFromAdapter,
      setImportConflictAlert,
      logDiagnosticEvent,
    }),
    [saveSafetyRollingBackup, clearLocalSyncAndBackupReminderState, reloadFromAdapter]
  );

  const importJsonBackup = useCallback(
    async (jsonText: string, mode: 'merge' | 'replace') => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot) return;
        try {
          invalidateSpeciesSelectorCache();
          const { parseBarnBackupJson } = await import('../domain/syncAndExports');
          const incoming = parseBarnBackupJson(jsonText, currentSnapshot.settings);
          const installed = await installImportedSnapshot(backupImportPorts, {
            mode,
            incoming,
            safetyNote: 'Pre-JSON-replace safety snapshot',
          });
          if (!installed) return;
          const alertSuffix = installed.alertMessage ? ` ${installed.alertMessage}` : '';
          if (mode === 'replace') {
            notify(
              `Restored ${incoming.animals.length} animals & ${incoming.animalPhotos.length} photos from JSON backup.${alertSuffix}`
            );
          } else {
            notify(
              `UUID/Timestamp sync complete: +${installed.merged?.animalsAdded ?? 0} added, ${
                installed.merged?.animalsUpdated ?? 0
              } updated, ${installed.merged?.photosMerged ?? 0} photos merged.${alertSuffix}`
            );
          }
        } catch (err) {
          reportPersistenceFailure('import JSON backup', err);
          throw err;
        }
      });
    },
    [enqueueStoreMutation, backupImportPorts, notify, reportPersistenceFailure]
  );

  const importBackupArchiveBytes = useCallback(
    async (bytes: Uint8Array, fileName: string, mode: 'merge' | 'replace') => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot) return;
        try {
          invalidateSpeciesSelectorCache();
          const { parseBackupArchiveOffThread } = await import('../storage/offThreadWorkerClient');
          const parsed = await parseBackupArchiveOffThread(
            bytes,
            fileName,
            currentSnapshot.settings
          );

          if (parsed.kind === 'photos_only') {
            if (mode === 'replace') {
              throw new Error(
                'This ZIP contains only animal photos (photos/manifest.json without herd tables). Use "Merge (.JSON / .ZIP)" to restore photos without wiping your records.'
              );
            }
            const { mergePhotosOnlyIntoSnapshot } = await import('../domain/backupArchive');
            const photoMerge = mergePhotosOnlyIntoSnapshot(
              currentSnapshot,
              parsed.photos,
              parsed.manifestEntries
            );
            await adapterRef.current!.replaceSnapshot(photoMerge.nextSnapshot);
            await reloadFromAdapter();
            const skippedMsg =
              photoMerge.unmatchedSkipped > 0
                ? ` (${photoMerge.unmatchedSkipped} unmatched skipped)`
                : '';
            logDiagnosticEvent({
              level: 'info',
              category: 'storage',
              message: `Merged photos-only archive "${fileName}" (+${photoMerge.photosAdded} added, ${photoMerge.photosUpdated} updated)`,
            });
            notify(
              `Photos archive merged: +${photoMerge.photosAdded} added, ${photoMerge.photosUpdated} updated${skippedMsg}.`
            );
            return;
          }

          const installed = await installImportedSnapshot(backupImportPorts, {
            mode,
            incoming: parsed.snapshot,
            safetyNote: 'Pre-archive-replace safety snapshot',
          });
          if (!installed) return;
          const alertSuffix = installed.alertMessage ? ` ${installed.alertMessage}` : '';

          if (mode === 'replace') {
            logDiagnosticEvent({
              level: 'info',
              category: 'storage',
              message: `Restored full archive "${fileName}" (${parsed.snapshot.animals.length} animals, ${parsed.photosReconstructed} photos)`,
            });
            notify(
              `Restored ${parsed.snapshot.animals.length} animals & ${parsed.photosReconstructed} photos from ${parsed.sourceFormat.toUpperCase()} backup.${alertSuffix}`
            );
          } else {
            logDiagnosticEvent({
              level: 'info',
              category: 'storage',
              message: `Merged archive "${fileName}" (+${
                installed.merged?.animalsAdded ?? 0
              } added, ${installed.merged?.photosMerged ?? 0} photos merged)`,
            });
            notify(
              `Merge complete: +${installed.merged?.animalsAdded ?? 0} added, ${
                installed.merged?.animalsUpdated ?? 0
              } updated, ${installed.merged?.photosMerged ?? 0} photos merged.${alertSuffix}`
            );
          }

        } catch (err) {
          logDiagnosticEvent({
            level: 'error',
            category: isMemoryLikeError(err) ? 'memory' : 'storage',
            message: `Archive import failed for "${fileName}" (${bytes.byteLength} bytes, mode=${mode})`,
            error: err,
          });
          throw err;
        }
      });
    },
    [enqueueStoreMutation, backupImportPorts, notify]
  );

  const importDeltaOperations = useCallback(
    async (incomingOps: SyncOperation[]) => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current ?? snapshot;
        if (!currentSnapshot) return;
        try {
          invalidateSpeciesSelectorCache();
          const baseOps = syncOperationsHydratedRef.current
            ? syncOperationsRef.current
            : await loadSyncOperationsFromIdbAndIndex();
          const result = mergeDeltaOperations(
            currentSnapshot,
            baseOps,
            incomingOps,
            deviceId
          );
          if (result.appliedOpCount === 0) {
            notify('Delta sync checked — no new remote operations needed applying.');
            return;
          }
          await adapterRef.current!.replaceSnapshot(result.nextSnapshot);
          await replaceSyncOperationsWithRetention(result.mergedOperations);
          rebuildMaxRevIndex(result.mergedOperations);
          if (syncOperationsHydratedRef.current) {
            syncOperationsRef.current = result.mergedOperations;
            setSyncOperations(result.mergedOperations);
          }
          if (result.newConflicts.length > 0) {
            await appendSyncConflictsToIdb(result.newConflicts);
            setSyncConflicts((prev) => [...result.newConflicts, ...prev]);
          }
          await reloadFromAdapter();
          notify(
            result.newConflicts.length > 0
              ? `Merged ${result.appliedOpCount} field operation(s); ${result.newConflicts.length} field collision(s) logged for review.`
              : `Merged ${result.appliedOpCount} field operation(s) cleanly with zero collisions.`
          );
        } catch (err) {
          reportPersistenceFailure('apply delta sync operations', err);
          throw err;
        }
      });
    },
    [
      snapshot,
      deviceId,
      enqueueStoreMutation,
      loadSyncOperationsFromIdbAndIndex,
      rebuildMaxRevIndex,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
    ]
  );

  const reconcileP2pOutboxOps = useCallback(
    async (
      incomingOps: SyncOperation[],
      peerDeviceId?: string
    ): Promise<P2pReconciliationSummary> => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current ?? snapshot;
        const { summarizeTaskReconciliation } = await import('../domain/p2pSyncProtocol');
        if (!currentSnapshot) {
          return summarizeTaskReconciliation({
            peerDeviceId: peerDeviceId || 'peer',
            receivedOps: incomingOps,
            appliedOpCount: 0,
            newConflicts: [],
            reconciledAtIso: getAdjustedNowIsoUtc(),
          });
        }
        try {
          const baseOps = syncOperationsHydratedRef.current
            ? syncOperationsRef.current
            : await loadSyncOperationsFromIdbAndIndex();
          const result = mergeDeltaOperations(
            currentSnapshot,
            baseOps,
            incomingOps,
            deviceId
          );
          if (result.appliedOpCount > 0 || result.newConflicts.length > 0) {
            if (result.appliedOpCount > 0) {
              await adapterRef.current!.replaceSnapshot(result.nextSnapshot);
            }
            await replaceSyncOperationsWithRetention(result.mergedOperations);
            rebuildMaxRevIndex(result.mergedOperations);
            if (syncOperationsHydratedRef.current) {
              syncOperationsRef.current = result.mergedOperations;
              setSyncOperations(result.mergedOperations);
            }
            if (result.newConflicts.length > 0) {
              await appendSyncConflictsToIdb(result.newConflicts);
              setSyncConflicts((prev) => [...result.newConflicts, ...prev]);
            }
            if (result.appliedOpCount > 0) {
              await reloadFromAdapter();
            }
            notify(
              result.newConflicts.length > 0
                ? `LAN P2P merged ${result.appliedOpCount} op(s); ${result.newConflicts.length} conflict(s) logged.`
                : `LAN P2P merged ${result.appliedOpCount} op(s) cleanly.`
            );
          }
          return summarizeTaskReconciliation({
            peerDeviceId: peerDeviceId || 'peer',
            receivedOps: incomingOps,
            appliedOpCount: result.appliedOpCount,
            newConflicts: result.newConflicts,
            reconciledAtIso: getAdjustedNowIsoUtc(),
          });
        } catch (err) {
          reportPersistenceFailure('reconcile LAN P2P outbox', err);
          throw err;
        }
      });
    },
    [
      snapshot,
      deviceId,
      enqueueStoreMutation,
      loadSyncOperationsFromIdbAndIndex,
      rebuildMaxRevIndex,
      reloadFromAdapter,
      notify,
      reportPersistenceFailure,
    ]
  );

  const { resolveSyncConflict } = useSyncConflictResolution({
    ...sliceCorePorts,
    syncConflicts,
    setSyncConflicts,
    syncOperationsRef,
    syncOperationsHydratedRef,
    setSyncOperations,
    nextEntityRev: (entityUuid) => nextEntityRev(entityUuid),
    loadSyncOperations: loadSyncOperationsFromIdbAndIndex,
    replaceSnapshot: (snap) => adapterRef.current!.replaceSnapshot(snap),
    replaceSyncOperations: replaceSyncOperationsWithRetention,
    rebuildMaxRevIndex,
    saveConflict: saveSyncConflictInIdb,
  });

  const { dismissSyncConflict } = useSyncConflictDismissal({
    syncConflicts,
    setSyncConflicts,
    saveConflict: saveSyncConflictInIdb,
    nowIsoUtc: getAdjustedNowIsoUtc,
  });

  const buildLocalDeltaJsonPayload = useCallback(() => {
    return {
      filename: `delta_${deviceId}.json`,
      content: JSON.stringify(buildDeltaFilePayload(deviceId, syncOperations), null, 2),
    };
  }, [deviceId, syncOperations]);

  const executeCloudAppFolderSync = useCallback(
    async (trigger: 'auto_background' | 'manual'): Promise<RunCloudAppFolderSyncResult> => {
      if (trigger === 'manual') {
        setCloudSyncBusy(true);
      }
      try {
        const result = await runCloudAppFolderSync({
          trigger,
          deviceId,
          loadLocalSyncOperations: loadSyncOperationsFromIdbAndIndex,
          getSnapshotForRollingBackup: async () => snapshotRef.current,
          onMergeRemoteOperations: async (ops) => {
            if (ops.length > 0) {
              await importDeltaOperations(ops);
            }
          },
          uploadRollingBackup: trigger === 'manual',
        });
        setCloudSyncState(result.state);
        if (trigger === 'manual') {
          if (result.ok) {
            notify(
              `Cloud App-Folder Sync complete (${result.uploadedOpsCount} ops uploaded across ${result.uploadedChunksCount} ${
                result.chunkStrategy === 'tight_storage_incremental'
                  ? 'tight-storage incremental '
                  : ''
              }chunk(s), ${result.pulledOpsCount} pulled).`
            );
          } else if (result.circuitBreakerTripped) {
            setErrorMessage(
              result.error ||
                'Cloud storage/quota limit hit (HTTP 403/507). Automated cloud sync paused; local IndexedDB saves are unaffected.'
            );
          } else if (result.skipReason || result.error) {
            setErrorMessage(result.skipReason || result.error || 'Cloud sync paused.');
          }
        }
        return result;
      } finally {
        if (trigger === 'manual') {
          setCloudSyncBusy(false);
        }
      }
    },
    [deviceId, loadSyncOperationsFromIdbAndIndex, importDeltaOperations, notify]
  );

  const scheduleBackgroundCloudSync = useCallback(() => {
    const latest = getCloudSyncClientState();
    if (
      !latest.settings.enabled ||
      !latest.settings.autoBackgroundSync ||
      latest.circuitBreaker.tripped ||
      latest.circuitBreaker.pausedAutomatedSync ||
      !latest.hasMemoryTokenByProvider[latest.settings.provider]
    ) {
      return;
    }
    if (cloudBackgroundTimerRef.current !== null) {
      clearTimeout(cloudBackgroundTimerRef.current);
    }
    cloudBackgroundTimerRef.current = setTimeout(() => {
      cloudBackgroundTimerRef.current = null;
      void executeCloudAppFolderSync('auto_background').catch(() => {
        // Cloud failures must never surface unhandled rejections or affect local IndexedDB writes
      });
    }, 1800);
  }, [executeCloudAppFolderSync]);

  useEffect(() => {
    scheduleBackgroundCloudSyncRef.current = scheduleBackgroundCloudSync;
  }, [scheduleBackgroundCloudSync]);

  useEffect(() => {
    void consumeCloudOAuthPkceCallback()
      .then((res) => {
        if (!res.handled) return;
        setCloudSyncState(getCloudSyncClientState());
        if (res.error) {
          setErrorMessage(res.error);
        } else if (res.provider) {
          notify(
            `Connected ${
              res.provider === 'onedrive' ? 'OneDrive AppRoot' : 'Google Drive AppFolder'
            } (memory-only OAuth token).`
          );
        }
      })
      .catch(() => {
        // Non-fatal
      });
    return () => {
      if (cloudBackgroundTimerRef.current !== null) {
        clearTimeout(cloudBackgroundTimerRef.current);
        cloudBackgroundTimerRef.current = null;
      }
    };
  }, [notify]);

  const {
    updateCloudSyncSettings,
    connectCloudSyncAccessToken,
    disconnectCloudSync,
    startCloudSyncPkce,
  } = useCloudSyncActions({ setCloudSyncState, notify });

  const runManualCloudSyncNow = useCallback(async () => {
    return executeCloudAppFolderSync('manual');
  }, [executeCloudAppFolderSync]);

  const resetAndRetryCloudSync = useCallback(async () => {
    const next = resetPersistedCloudCircuitBreaker();
    setCloudSyncState(next);
    return executeCloudAppFolderSync('manual');
  }, [executeCloudAppFolderSync]);

  const dismissCloudCircuitBreakerWarning = useCallback(() => {
    const next = acknowledgeCloudCircuitBreakerWarning();
    setCloudSyncState(next);
  }, []);

  const { restoreRollingBackupByKey, deleteRollingIdbBackupByKey } = useRollingBackupActions({
    ...sliceCorePorts,
    wipedRecoveryDetected: Boolean(wipedRecoveryContext?.detected),
    saveSafetyRollingBackup,
    clearPhotoCache: () => clearPhotoCache(photoCacheRef),
    replaceSnapshot: (snap) => adapterRef.current!.replaceSnapshot(snap),
    clearLocalSyncAndBackupReminderState,
    clearWipedRecoveryContext: () => setWipedRecoveryContext(null),
    refreshVaultAndArchives,
    readCommittedSnapshot: () =>
      adapterRef.current!.loadSnapshot({ lightweightPhotos: true }),
  });

  const {
    saveManualOpfsVaultBackup,
    downloadOpfsVaultBackupByKey,
    deleteOpfsVaultBackupByKey,
    restoreOpfsVaultBackup,
    restoreOpfsVaultBackupUnqueued,
  } = useOpfsVaultActions({
    ...sliceCorePorts,
    snapshot,
    wipedRecoveryDetected: Boolean(wipedRecoveryContext?.detected),
    opfsVaultBackups,
    hydrateSnapshotForExport,
    saveSafetyRollingBackup,
    mirrorToNativeVault: (snap) => mirrorSnapshotToNativeVaultIfWrapped(snap, 'manual'),
    replaceSnapshot: (snap) => adapterRef.current!.replaceSnapshot(snap),
    clearPhotoCache: () => clearPhotoCache(photoCacheRef),
    clearLocalSyncAndBackupReminderState,
    clearWipedRecoveryContext: () => setWipedRecoveryContext(null),
    setActiveSpeciesName,
    refreshVaultAndArchives,
    refreshStorageStatus,
    recordBackupExport,
    readCommittedSnapshot: () =>
      adapterRef.current!.loadSnapshot({ lightweightPhotos: true }),
  });

  const createAndVerifyPreUpgradeBackup = useCallback(async (): Promise<{
    verified: boolean;
    checksumSha256: string;
    fileName: string;
  } | null> => {
    if (!snapshot) return null;
    try {
      const hydrated = await hydrateSnapshotForExport(snapshot);
      const [{ buildVerifiedPreUpgradeJsonBackup }, { formatTimestampedBackupSlug }] =
        await Promise.all([
          import('../domain/backupVault'),
          import('../domain/syncAndExports'),
        ]);
      const { jsonText, verification } = buildVerifiedPreUpgradeJsonBackup(
        hydrated,
        CURRENT_APP_VERSION
      );
      const stampSlug = formatTimestampedBackupSlug();
      const fileName = `pedigree-pre-upgrade-backup-${stampSlug}.json`;
      await downloadTextFile(fileName, jsonText, 'application/json');
      const mirroredNative = await mirrorSnapshotToNativeVaultIfWrapped(hydrated, 'pre_upgrade');
      if (isOpfsSupported()) {
        await saveOpfsVaultBackup(hydrated, {
          kind: 'pre_upgrade',
          appVersion: CURRENT_APP_VERSION,
          note: `Pre-upgrade verified (${verification.checksumSha256.slice(0, 12)})`,
        }).catch(() => null);
        await refreshVaultAndArchives();
      }
      if (mirroredNative) {
        void refreshStorageStatus();
      }
      await recordBackupExport('json', fileName);
      markPreUpgradeBackupVerified(verification.ok);
      notify(
        `Verified Pre-Upgrade Safety Backup saved (${verification.animalCount} animals · SHA-256 ${verification.checksumSha256.slice(0, 12)}…).`
      );
      return {
        verified: verification.ok,
        checksumSha256: verification.checksumSha256,
        fileName,
      };
    } catch (err) {
      reportPersistenceFailure('create verified pre-upgrade safety backup', err);
      return null;
    }
  }, [
    snapshot,
    hydrateSnapshotForExport,
    mirrorSnapshotToNativeVaultIfWrapped,
    refreshVaultAndArchives,
    refreshStorageStatus,
    recordBackupExport,
    notify,
    reportPersistenceFailure,
  ]);

  const {
    offloadAnimalsToOpfsArchive,
    offloadAnimalsToOpfsArchiveInternal,
  } = useOpfsArchiveOffload({
    ...sliceCorePorts,
    loadFreshSnapshot: () =>
      adapterRef.current
        ? adapterRef.current.loadSnapshot({ lightweightPhotos: true })
        : Promise.resolve(snapshotRef.current),
    hydrateSnapshotForExport,
    replaceSnapshot: (snap) => adapterRef.current!.replaceSnapshot(snap),
    clearPhotoCache: () => clearPhotoCache(photoCacheRef),
    selectedAnimalId,
    pedigreeAnimalId,
    clearSelectedAnimal: () => setSelectedAnimalId(null),
    clearPedigreeAnimal: () => setPedigreeAnimalId(null),
  });
  offloadAnimalsRef.current = offloadAnimalsToOpfsArchiveInternal;


  const connectBackupSyncFolder = useCallback(async () => {
    try {
      const nextStatus = await configureBackupSyncFolder();
      const flushRes = await flushOpfsBackupsToSyncFolder();
      await refreshVaultAndArchives();
      const syncNote =
        flushRes.pushed > 0
          ? ` Synced ${flushRes.pushed} current vault backup(s) into "${nextStatus.folderName}/pedigree-vault-archive".`
          : '';
      notify(
        `Connected Backup Sync folder "${nextStatus.folderName}". Expiring local backups will copy there automatically before pruning.${syncNote}`
      );
      return nextStatus;
    } catch (err) {
      reportPersistenceFailure('connect Backup Sync folder', err);
      return null;
    }
  }, [refreshVaultAndArchives, notify, reportPersistenceFailure]);

  const reauthorizeBackupSyncFolderAction = useCallback(async () => {
    try {
      const nextStatus = await reauthorizeBackupSyncFolder();
      if (nextStatus.permissionState === 'granted') {
        const flushRes = await flushOpfsBackupsToSyncFolder();
        await refreshVaultAndArchives();
        notify(
          flushRes.pushed > 0
            ? `Re-authorized "${nextStatus.folderName}" and synced ${flushRes.pushed} vault backup(s).`
            : `Re-authorized "${nextStatus.folderName}" for pre-prune vault offload.`
        );
      } else {
        await refreshVaultAndArchives();
        notify('Folder permission was not granted.');
      }
      return nextStatus;
    } catch (err) {
      reportPersistenceFailure('re-authorize Backup Sync folder', err);
      return null;
    }
  }, [refreshVaultAndArchives, notify, reportPersistenceFailure]);

  const disconnectBackupSyncFolderAction = useCallback(async () => {
    try {
      const nextStatus = await disconnectBackupSyncFolder();
      setBackupSyncStatus(nextStatus);
      notify('Disconnected Backup Sync folder.');
    } catch (err) {
      reportPersistenceFailure('disconnect Backup Sync folder', err);
    }
  }, [notify, reportPersistenceFailure]);

  const syncVaultBackupsToSyncNow = useCallback(async () => {
    try {
      const res = await flushOpfsBackupsToSyncFolder();
      await refreshVaultAndArchives();
      if (res.pushed > 0) {
        notify(`Synced ${res.pushed} vault backup(s) to connected Backup Sync folder.`);
      } else if (res.skippedReason === 'permission_required') {
        notify('Backup Sync folder needs re-authorization before syncing.');
      } else if (res.skippedReason === 'not_configured') {
        notify('Connect a Backup Sync folder first.');
      } else {
        notify('Vault backups are already empty or up to date.');
      }
      return res;
    } catch (err) {
      reportPersistenceFailure('sync vault backups to folder', err);
      return { pushed: 0, failed: 0 };
    }
  }, [refreshVaultAndArchives, notify, reportPersistenceFailure]);

  const dismissPruneSyncWarning = useCallback(() => {
    clearOpfsPruneSyncWarning();
    setPruneSyncWarning(null);
  }, []);

  const restoreArchivedHerdBundle = useCallback(
    async (
      archiveKey: string,
      options?: { restoreToActiveStatus?: boolean; deleteArchiveAfterRestore?: boolean }
    ) => {
      return enqueueStoreMutation(async () => {
        const freshBase = adapterRef.current
          ? await adapterRef.current.loadSnapshot({ lightweightPhotos: true })
          : snapshotRef.current;
        if (!freshBase) return;
        try {
          invalidateSpeciesSelectorCache();
          const [loaded, { mergeRestoredArchiveIntoSnapshot }] = await Promise.all([
            loadOpfsHerdArchive(archiveKey, freshBase.settings),
            import('../domain/backupVault'),
          ]);
          if (!loaded) {
            notify('Archived herd bundle could not be loaded or verified.');
            return;
          }
          const merged = mergeRestoredArchiveIntoSnapshot(freshBase, loaded.unpacked, options);
          await adapterRef.current!.replaceSnapshot(merged.nextSnapshot);
          if (options?.deleteArchiveAfterRestore !== false) {
            await deleteOpfsHerdArchive(archiveKey);
          }
          clearPhotoCache(photoCacheRef);
          setWipedRecoveryContext(null);
          await reloadFromAdapter();
          notify(
            `Restored ${merged.restoredAnimalCount} animal(s), ${merged.restoredPhotoCount} photo(s), and ${merged.restoredCareLogCount} care log(s) from OPFS /archives.`
          );
        } catch (err) {
          reportPersistenceFailure('restore archived herd bundle', err);
          throw err;
        }
      });
    },
    [enqueueStoreMutation, reloadFromAdapter, notify, reportPersistenceFailure]
  );

  const downloadArchivedHerdBundle = useCallback(
    async (archiveKey: string) => {
      const res = await readOpfsHerdArchiveBlob(archiveKey);
      if (!res) {
        notify('Archived bundle file not found in OPFS /archives.');
        return;
      }
      await downloadBlobDirect(res.fileName, res.blob);
      notify(`Downloaded ${res.fileName}.`);
    },
    [notify]
  );

  const deleteArchivedHerdBundle = useCallback(
    async (archiveKey: string) => {
      return enqueueStoreMutation(async () => {
        try {
          await deleteOpfsHerdArchive(archiveKey);
          const currentSnap = snapshotRef.current;
          if (currentSnap) {
            const ts = getAdjustedNowIsoUtc();
            const staleStubs = currentSnap.animals
              .filter((a) => a.offloadedArchiveKey === archiveKey)
              .map((a) => ({
                ...a,
                offloadedArchiveKey: '',
                offloadedAtIso: '',
                _rev: nextEntityRev(a.id, a._rev),
                updatedAt: ts,
              }));
            if (staleStubs.length > 0) {
              await adapterRef.current!.saveAnimalsBatch(staleStubs);
            }
          }
          await reloadFromAdapter();
          notify('Deleted archive bundle from OPFS /archives.');
        } catch (err) {
          reportPersistenceFailure('delete archived herd bundle', err);
        }
      });
    },
    [enqueueStoreMutation, nextEntityRev, reloadFromAdapter, notify, reportPersistenceFailure]
  );

  const restoreLatestOpfsOnWipedRecovery = useCallback(async () => {
    return enqueueStoreMutation(async () => {
      let targetKey = wipedRecoveryContext?.latestOpfsBackup?.key;
      if (!targetKey) {
        const list = await listOpfsVaultBackups();
        targetKey = list[0]?.key;
      }
      if (!targetKey) {
        notify('No OPFS vault backup found to restore.');
        return;
      }
      await restoreOpfsVaultBackupUnqueued(targetKey);
    });
  }, [enqueueStoreMutation, wipedRecoveryContext, restoreOpfsVaultBackupUnqueued, notify]);

  const startFreshAfterWipedRecovery = useCallback(async () => {
    return enqueueStoreMutation(async () => {
      try {
        clearPriorUseSentinel();
        clearPhotoCache(photoCacheRef);
        const adapter = adapterRef.current!;
        const fresh = adapter.rebuildCleanDatabase
          ? await adapter.rebuildCleanDatabase({ lightweightPhotos: true, allowSeedFresh: true })
          : await adapter.initialize({ lightweightPhotos: true, allowSeedFresh: true });
        await clearLocalSyncAndBackupReminderState();
        snapshotRef.current = fresh;
        setSnapshot(fresh);
        setWipedRecoveryContext(null);
        setSelectedAnimalId(null);
        setPedigreeAnimalId(null);
        setActiveSpeciesName(fresh.settings.defaultSpecies || 'Rabbit');
        setRoute('home');
        await refreshVaultAndArchives();
        notify(`Initialized fresh starter herds (${fresh.animals.length} sample animals).`);
      } catch (err) {
        reportPersistenceFailure('start fresh starter herds', err);
      }
    });
  }, [
    enqueueStoreMutation,
    clearLocalSyncAndBackupReminderState,
    refreshVaultAndArchives,
    notify,
    reportPersistenceFailure,
  ]);

  const applyPlatformImportPreview = useCallback(
    async (
      preview: PlatformImportPreview,
      optimizedPhotos: AnimalPhoto[] = [],
      conflictSelections: ConflictSelectionMap = {}
    ) => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        if (!currentSnapshot) return;

        try {
          invalidateSpeciesSelectorCache();
          const { resolveAnimalsWithConflictChoices } =
            await import('../domain/importers/conflictResolver');
          const resolvedAnimals = resolveAnimalsWithConflictChoices(
            preview.animals,
            currentSnapshot,
            conflictSelections
          );

          let localAdjustedSnapshot = currentSnapshot;
          let incomingSpeciesProfiles = preview.newSpeciesProfiles;
          if (preview.newSpeciesProfiles.length > 0) {
            const ts = getAdjustedNowIsoUtc();
            const offset = preview.newSpeciesProfiles.length;
            incomingSpeciesProfiles = preview.newSpeciesProfiles.map((sp, idx) => ({
              ...sp,
              sortOrder: idx,
              updatedAt: ts,
            }));
            localAdjustedSnapshot = {
              ...currentSnapshot,
              speciesProfiles: currentSnapshot.speciesProfiles.map((sp, idx) => ({
                ...sp,
                sortOrder: idx + offset,
              })),
            };
          }

          const incoming: BarnDatabaseSnapshot = {
            settings: localAdjustedSnapshot.settings,
            speciesProfiles: incomingSpeciesProfiles,
            animals: resolvedAnimals,
            animalPhotos: optimizedPhotos,
            cages: preview.cages,
            breedings: preview.breedings,
            tasks: preview.tasks,
            careLogs: preview.careLogs,
            shows: preview.shows,
            feedBatches: [],
            feedAllocations: [],
            ledgerEntries: [],
            processingLogs: [],
            youthProjectBooks: [],
            clientContacts: [],
            waitlistEntries: [],
            animalReservations: [],
            woolHarvests: [],
            mileageLogs: [],
            journalEntries: [],
            judgeClubs: [],
            judgeAssignments: [],
            judgeExpenses: [],
          };
          const { mergeBarnSnapshots } = await import('../domain/syncAndExports');
          const merged = mergeBarnSnapshots(localAdjustedSnapshot, incoming);
          const importedIds = new Set(resolvedAnimals.map((a) => a.id));
          const flagRes = applyImportConflictAttentionFlags(merged.snapshot.animals, importedIds);
          const finalSnapshot: BarnDatabaseSnapshot = {
            ...merged.snapshot,
            animals: flagRes.animals,
          };
          await adapterRef.current!.replaceSnapshot(finalSnapshot);
          await reloadFromAdapter();
          if (flagRes.alertMessage) {
            const spNames = Array.from(
              new Set(
                flagRes.animals
                  .filter((a) => flagRes.conflictedAnimalIds.includes(a.id))
                  .map((a) => a.species)
              )
            );
            setImportConflictAlert({
              message: flagRes.alertMessage,
              speciesNames: spNames,
              conflictedCount: flagRes.conflictedAnimalIds.length,
            });
            logDiagnosticEvent({
              level: 'warn',
              category: 'storage',
              message: `${preview.platformName} import conflict alert: ${flagRes.alertMessage}`,
            });
          }
          if (preview.speciesDetected.length === 1) {
            setActiveSpeciesName(preview.speciesDetected[0]);
          } else if (preview.newSpeciesProfiles.length > 0) {
            setActiveSpeciesName(preview.newSpeciesProfiles[0].name);
          }
          const origPhotoBytes = optimizedPhotos.reduce((acc, p) => acc + p.originalBytes, 0);
          const storedPhotoBytes = optimizedPhotos.reduce((acc, p) => acc + p.storedBytes, 0);
          const photoSummary =
            optimizedPhotos.length > 0
              ? `, ${optimizedPhotos.length} optimized photos (${formatByteSizePure(
                  origPhotoBytes
                )} → ${formatByteSizePure(storedPhotoBytes)})`
              : '';
          const newSpSummary =
            preview.newSpeciesProfiles.length > 0
              ? `, +${preview.newSpeciesProfiles.length} custom species (${preview.newSpeciesProfiles
                  .map((s) => s.name)
                  .join(', ')})`
              : '';
          notify(
            `${preview.platformName} import complete: ${resolvedAnimals.length} animals (${preview.parentLinksResolved} parent links), ${preview.breedings.length} breedings, ${preview.careLogs.length} logs${photoSummary}${newSpSummary}.${
              flagRes.alertMessage ? ` ${flagRes.alertMessage}` : ''
            }`
          );
        } catch (err) {
          reportPersistenceFailure(`import ${preview.platformName} data`, err);
          throw err;
        }
      });
    },
    [enqueueStoreMutation, reloadFromAdapter, notify, reportPersistenceFailure]
  );

  const exportSqliteBytes = useCallback(async () => {
    await writeQueueRef.current.catch(() => undefined);
    const adapter = adapterRef.current!;
    const bytes = await adapter.exportRawSqliteBytes();
    const liveAnimalCount = snapshotRef.current?.animals.length ?? 0;
    if (bytes && liveAnimalCount > 0 && adapter.inspectRawSqliteBytes) {
      const inspected = await adapter.inspectRawSqliteBytes(bytes, { lightweightPhotos: true });
      if (inspected.animals.length === 0) {
        throw new Error(
          `Blocked empty SQLite export: serialized database has 0 animals while ${liveAnimalCount} animal(s) are loaded in memory. Please wait for pending saves or export a JSON backup.`
        );
      }
    }
    return bytes;
  }, []);

  const inspectSqliteRestoreBytes = useCallback(
    async (bytes: Uint8Array, fileName = 'backup.sqlite'): Promise<PreRestoreArchiveInspection> => {
      const adapter = adapterRef.current!;
      if (!adapter.inspectRawSqliteBytes) {
        throw new Error('SQLite inspection is unavailable in this browser.');
      }
      const incomingSnap = await adapter.inspectRawSqliteBytes(bytes, { lightweightPhotos: true });
      const baseSnap = snapshotRef.current ?? snapshot ?? incomingSnap;
      const { inspectSnapshotBeforeRestorePure } = await import('../domain/archiveInspector');
      return inspectSnapshotBeforeRestorePure(incomingSnap, baseSnap, {
        fileName,
        sourceFormat: 'sqlite',
      });
    },
    [snapshot]
  );

  const importSqliteBytes = useCallback(
    async (bytes: Uint8Array) => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        try {
          invalidateSpeciesSelectorCache();
          if (currentSnapshot && currentSnapshot.animals.length > 0) {
            await saveSafetyRollingBackup(currentSnapshot, 'Pre-SQLite-import safety snapshot');
          }
          clearPhotoCache(photoCacheRef);
          const snap = await adapterRef.current!.importRawSqliteBytes(bytes, {
            lightweightPhotos: true,
          });
          if (snap.settings.lastBackupMeta || snap.settings.backupReminderSnoozedUntilMs) {
            const cleanedSettings = {
              ...snap.settings,
              lastBackupMeta: undefined,
              backupReminderSnoozedUntilMs: undefined,
            };
            await adapterRef.current!.saveSettings(cleanedSettings);
            snap.settings = cleanedSettings;
          }
          await clearLocalSyncAndBackupReminderState();
          snapshotRef.current = snap;
          setSnapshot(snap);
          setWipedRecoveryContext(null);
          void refreshStorageStatus();
          void refreshVaultAndArchives();
          notify(
            `Loaded SQLite database (${snap.animals.length} animals, ${(snap.animalPhotos ?? []).length} photos).`
          );
        } catch (err) {
          reportPersistenceFailure('load SQLite database file', err);
          throw err;
        }
      });
    },
    [
      enqueueStoreMutation,
      saveSafetyRollingBackup,
      clearLocalSyncAndBackupReminderState,
      refreshStorageStatus,
      refreshVaultAndArchives,
      notify,
      reportPersistenceFailure,
    ]
  );

  const analyzePhotoStorageFootprint = useCallback(
    async (presetId?: ImageOptimizationPresetId): Promise<PhotoStorageFootprintReport | null> => {
      const base = snapshotRef.current ?? snapshot;
      if (!base) return null;
      const missingIds = (base.animalPhotos ?? [])
        .filter((p) => !p.dataUrl && (!p.storedBytes || p.storedBytes <= 0))
        .map((p) => p.id);
      let scanSnapshot = base;
      if (missingIds.length > 0 && adapterRef.current?.loadAnimalPhotoDataUrlsBatch) {
        const fetched = await adapterRef.current.loadAnimalPhotoDataUrlsBatch(missingIds);
        scanSnapshot = {
          ...base,
          animalPhotos: (base.animalPhotos ?? []).map((p) =>
            !p.dataUrl && fetched[p.id] ? { ...p, dataUrl: fetched[p.id] } : p
          ),
        };
      }
      const { analyzePhotoStorageFootprintPure } = await import('../domain/photoMaintenance');
      return analyzePhotoStorageFootprintPure(
        scanSnapshot,
        presetId ?? scanSnapshot.settings.imageOptimizationPreset
      );
    },
    [snapshot]
  );

  const pruneOrphanAnimalPhotos = useCallback(async (): Promise<{
    removedCount: number;
    reclaimedBytes: number;
  }> => {
    return enqueueStoreMutation(async () => {
      const base = snapshotRef.current ?? snapshot;
      if (!base) return { removedCount: 0, reclaimedBytes: 0 };
      const { removeOrphanPhotosFromSnapshotPure } = await import('../domain/photoMaintenance');
      const preCheck = removeOrphanPhotosFromSnapshotPure(base);
      if (preCheck.removedCount === 0) {
        notify('Photo check finished — zero orphan attachments found.');
        return { removedCount: 0, reclaimedBytes: 0 };
      }
      const hydrated = await hydrateSnapshotForExport(base);
      const res = removeOrphanPhotosFromSnapshotPure(hydrated);
      if (res.removedCount === 0) {
        notify('Photo check finished — zero orphan attachments found.');
        return { removedCount: 0, reclaimedBytes: 0 };
      }
      await saveSafetyRollingBackup(hydrated, 'Pre-orphan-photo-prune safety snapshot');
      await adapterRef.current!.replaceSnapshot(res.nextSnapshot);
      for (const id of res.removedPhotoIds) {
        forgetPhoto(photoCacheRef, id);
      }
      await reloadFromAdapter();
      void refreshStorageStatus();
      notify(
        `Removed ${res.removedCount} orphan photo(s), reclaiming ${formatByteSizePure(res.reclaimedBytes)}.`
      );
      return { removedCount: res.removedCount, reclaimedBytes: res.reclaimedBytes };
    });
  }, [snapshot, enqueueStoreMutation, hydrateSnapshotForExport, saveSafetyRollingBackup, reloadFromAdapter, refreshStorageStatus, notify]);

  const reoptimizeOversizedAnimalPhotos = useCallback(
    async (
      presetId?: ImageOptimizationPresetId
    ): Promise<{ updatedCount: number; oversizedFound: number; reclaimedBytes: number }> => {
      return enqueueStoreMutation(async () => {
        const base = snapshotRef.current ?? snapshot;
        if (!base) return { updatedCount: 0, oversizedFound: 0, reclaimedBytes: 0 };
        const targetPreset = presetId ?? base.settings.imageOptimizationPreset ?? 'balanced';
        const [{ analyzePhotoStorageFootprintPure }, { reoptimizeAnimalPhotoRecord }] =
          await Promise.all([
            import('../domain/photoMaintenance'),
            import('../storage/webImageOptimizer'),
          ]);
        const preReport = analyzePhotoStorageFootprintPure(base, targetPreset);
        if (preReport.oversizedPhotoIds.length === 0) {
          notify('All animal photos already fit cleanly inside the active optimization preset.');
          return { updatedCount: 0, oversizedFound: 0, reclaimedBytes: 0 };
        }
        const hydrated = await hydrateSnapshotForExport(base);
        const report = analyzePhotoStorageFootprintPure(hydrated, targetPreset);
        if (report.oversizedPhotoIds.length === 0) {
          notify('All animal photos already fit cleanly inside the active optimization preset.');
          return { updatedCount: 0, oversizedFound: 0, reclaimedBytes: 0 };
        }
        const oversizedSet = new Set(report.oversizedPhotoIds);
        const updatedPhotos: AnimalPhoto[] = [];
        let reclaimedBytes = 0;

        for (const photo of hydrated.animalPhotos ?? []) {
          if (!oversizedSet.has(photo.id)) continue;
          const res = await reoptimizeAnimalPhotoRecord(photo, targetPreset);
          if (res.updated && res.reclaimedBytes > 0) {
            const rev = nextEntityRev(photo.id, photo._rev);
            const nextRec: AnimalPhoto = {
              ...res.photo,
              _rev: rev,
              updatedAt: getAdjustedNowIsoUtc(),
            };
            updatedPhotos.push(nextRec);
            reclaimedBytes += res.reclaimedBytes;
          }
        }

        if (updatedPhotos.length === 0) {
          notify('Checked oversized photos — existing encodings are already smaller than re-encoding.');
          return {
            updatedCount: 0,
            oversizedFound: report.oversizedPhotoIds.length,
            reclaimedBytes: 0,
          };
        }

        await saveSafetyRollingBackup(hydrated, 'Pre-photo-reoptimization safety snapshot');
        await adapterRef.current!.saveAnimalPhotosBatch(updatedPhotos);
        for (const p of updatedPhotos) {
          rememberPhoto(photoCacheRef, p.id, p.dataUrl);
        }
        await reloadFromAdapter();
        void refreshStorageStatus();
        notify(
          `Re-optimized ${updatedPhotos.length} oversized photo(s), reclaiming ${formatByteSizePure(reclaimedBytes)}.`
        );
        return {
          updatedCount: updatedPhotos.length,
          oversizedFound: report.oversizedPhotoIds.length,
          reclaimedBytes,
        };
      });
    },
    [snapshot, enqueueStoreMutation, hydrateSnapshotForExport, nextEntityRev, saveSafetyRollingBackup, reloadFromAdapter, refreshStorageStatus, notify]
  );

  const pruneFullResPhotoPayloadsKeepingThumbnails = useCallback(async (): Promise<{
    prunedCount: number;
    reclaimedBytes: number;
  }> => {
    return enqueueStoreMutation(async () => {
      const base = snapshotRef.current ?? snapshot;
      if (!base) return { prunedCount: 0, reclaimedBytes: 0 };
      const {
        analyzePhotoStorageFootprintPure,
        pruneFullResPayloadsFromSnapshotPure,
      } = await import('../domain/photoMaintenance');
      const preReport = analyzePhotoStorageFootprintPure(base);
      if (preReport.fullResPrunableIds.length === 0) {
        notify('No full-resolution photo payloads needed compacting.');
        return { prunedCount: 0, reclaimedBytes: 0 };
      }
      const hydrated = await hydrateSnapshotForExport(base);
      const res = pruneFullResPayloadsFromSnapshotPure(
        hydrated,
        undefined,
        getAdjustedNowIsoUtc()
      );
      if (res.prunedCount === 0) {
        notify('No full-resolution photo payloads needed compacting.');
        return { prunedCount: 0, reclaimedBytes: 0 };
      }
      await saveSafetyRollingBackup(hydrated, 'Pre-fullres-photo-prune safety snapshot');
      await adapterRef.current!.saveAnimalPhotosBatch(res.updatedPhotos);
      for (const p of res.updatedPhotos) {
        forgetPhoto(photoCacheRef, p.id);
      }
      await reloadFromAdapter();
      void refreshStorageStatus();
      notify(
        `Compacted ${res.prunedCount} photo(s) to lightweight thumbnails, reclaiming ${formatByteSizePure(res.reclaimedBytes)}.`
      );
      return { prunedCount: res.prunedCount, reclaimedBytes: res.reclaimedBytes };
    });
  }, [snapshot, enqueueStoreMutation, hydrateSnapshotForExport, saveSafetyRollingBackup, reloadFromAdapter, refreshStorageStatus, notify]);

  const scanDatabaseHealth = useCallback((): BarnHealthReport | null => {
    if (!snapshot) return null;
    return analyzeBarnDataHealth(snapshot);
  }, [snapshot]);

  const runHealthCheckAndRepair = useCallback(async (): Promise<BarnHealthRepairResult | null> => {
    return enqueueStoreMutation(async () => {
      const currentSnapshot = snapshotRef.current;
      if (!currentSnapshot) return null;
      try {
        await saveSafetyRollingBackup(currentSnapshot);
        const result = repairBarnDataHealth(currentSnapshot);
        if (result.repairsApplied.length > 0) {
          await adapterRef.current!.replaceSnapshot(result.nextSnapshot);
          await reloadFromAdapter();
          logDiagnosticEvent({
            level: 'info',
            category: 'storage',
            message: `Database self-repair completed (${result.repairsApplied.length} repair(s) applied, 0 records deleted)`,
            details: result.repairsApplied,
          });
          notify(
            `Database health repair complete (${result.repairsApplied.length} fix(es) applied safely with zero data loss).`
          );
        } else {
          notify('Database health scan finished — no structural issues needed repair.');
        }
        return result;
      } catch (err) {
        reportPersistenceFailure('repair database health', err);
        throw err;
      }
    });
  }, [enqueueStoreMutation, saveSafetyRollingBackup, reloadFromAdapter, notify, reportPersistenceFailure]);

  const resetDatabaseConnection = useCallback(async () => {
    return enqueueStoreMutation(async () => {
      try {
        const adapter = adapterRef.current!;
        clearPhotoCache(photoCacheRef);
        const fresh = adapter.resetConnection
          ? await adapter.resetConnection({ lightweightPhotos: true })
          : await adapter.initialize({ lightweightPhotos: true });
        snapshotRef.current = fresh;
        setSnapshot(fresh);
        void refreshStorageStatus();
        logDiagnosticEvent({
          level: 'info',
          category: 'storage',
          message: `Reset local database connection (${adapter.engineName}: ${fresh.animals.length} animals intact)`,
        });
        notify(
          `Local database connection reset (${fresh.animals.length} animals & ${
            (fresh.animalPhotos ?? []).length
          } photos intact).`
        );
      } catch (err) {
        reportPersistenceFailure('reset database connection', err);
      }
    });
  }, [enqueueStoreMutation, refreshStorageStatus, notify, reportPersistenceFailure]);

  const purgeCorruptedCachesAndRecover = useCallback(
    async (options: { downloadBackupFirst: boolean; rebuildLocalDb: boolean }) => {
      return enqueueStoreMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        const adapter = adapterRef.current!;
        let backupFilename: string | null = null;

        if (options.downloadBackupFirst && currentSnapshot) {
          try {
            const hydrated = await hydrateSnapshotForExport(currentSnapshot);
            const [{ buildCompleteBackupZipToOpfsTmpOffThread }, { formatTimestampedBackupSlug }] =
              await Promise.all([
                import('../storage/offThreadWorkerClient'),
                import('../domain/syncAndExports'),
              ]);
            const zip = await buildCompleteBackupZipToOpfsTmpOffThread(hydrated);
            backupFilename = `pedigree-recovery-backup-${formatTimestampedBackupSlug()}.zip`;
            await downloadTempOpfsExport(backupFilename, zip, 'application/zip');
          } catch (err) {
            logDiagnosticEvent({
              level: 'error',
              category: isMemoryLikeError(err) ? 'memory' : 'storage',
              message: 'Pre-recovery backup download failed before cache purge',
              error: err,
            });
          }
        }

        const { cachesCleared, serviceWorkersUnregistered } = await purgeStaleBrowserCaches();

        clearPhotoCache(photoCacheRef);
        const fresh =
          options.rebuildLocalDb && adapter.rebuildCleanDatabase
            ? await adapter.rebuildCleanDatabase({ lightweightPhotos: true })
            : adapter.resetConnection
            ? await adapter.resetConnection({ lightweightPhotos: true })
            : await adapter.initialize({ lightweightPhotos: true });

        snapshotRef.current = fresh;
        setSnapshot(fresh);
        if (options.rebuildLocalDb) {
          setSelectedAnimalId(null);
          setPedigreeAnimalId(null);
        }
        void refreshStorageStatus();

        logDiagnosticEvent({
          level: 'info',
          category: 'storage',
          message: `Cache recovery executed (cachesCleared=${cachesCleared}, swUnregistered=${serviceWorkersUnregistered}, rebuildDb=${options.rebuildLocalDb}, backup="${
            backupFilename || 'none'
          }")`,
        });

        const backupNote = backupFilename ? ` Retained backup: ${backupFilename}.` : '';
        notify(
          options.rebuildLocalDb
            ? `Purged caches (${cachesCleared}) and rebuilt local DB cleanly.${backupNote} You can re-import your backup anytime via Restore (.ZIP).`
            : `Purged ${cachesCleared} browser cache(s) & ${serviceWorkersUnregistered} service worker(s) and reset DB connection (${fresh.animals.length} animals intact).${backupNote}`
        );
        return { cachesCleared, serviceWorkersUnregistered, backupFilename };
      });
    },
    [enqueueStoreMutation, hydrateSnapshotForExport, refreshStorageStatus, notify]
  );

  const handleSetPedigreeGenerations = useCallback(
    (gen: PedigreeGenerationDepth) => {
      setPedigreeGenerations(gen);
      if (snapshot && gen <= 6) {
        const persistedDepth = normalizeDefaultPedigreeGenerations(gen);
        if (snapshot.settings.defaultGenerations !== persistedDepth) {
          void updateSettings({ defaultGenerations: persistedDepth }, { silent: true });
        }
      }
    },
    [snapshot, updateSettings]
  );

  return {
    appConfig: PEDIGREE_APP_CONFIG,
    deviceId,
    isLoading,
    engineName: adapterRef.current?.engineName ?? 'SQLite WASM + IndexedDB',
    snapshot,
    activeSpeciesName,
    activeSpeciesData,
    backupStatus,
    recordBackupExport,
    snoozeBackupReminder,
    route,
    setRoute,
    selectSpeciesWorkspace,
    selectedAnimalId,
    setSelectedAnimalId,
    pedigreeAnimalId,
    setPedigreeAnimalId,
    pedigreeGenerations,
    setPedigreeGenerations: handleSetPedigreeGenerations,
    statusMessage,
    clearStatusMessage: () => setStatusMessage(null),
    errorMessage,
    clearErrorMessage: () => setErrorMessage(null),
    importConflictAlert,
    dismissImportConflictAlert: () => setImportConflictAlert(null),
    requestedHerdConflictNonce,
    locateConflictsInHerd: (speciesName?: string) => {
      if (speciesName) {
        setActiveSpeciesName(speciesName);
      }
      setSelectedAnimalId(null);
      setRequestedHerdConflictNonce((n) => n + 1);
      setRoute('herd');
    },
    storageStatus,
    refreshStorageStatus,
    triggerPersistentStorageRequest,
    opfsSupported,
    opfsVaultBackups,
    rollingBackups,
    archivedHerdBundles,
    refreshVaultAndArchives,
    saveManualOpfsVaultBackup,
    createAndVerifyPreUpgradeBackup,
    restoreOpfsVaultBackup,
    downloadOpfsVaultBackupByKey,
    deleteOpfsVaultBackupByKey,
    deleteRollingIdbBackupByKey,
    offloadAnimalsToOpfsArchive,
    restoreArchivedHerdBundle,
    downloadArchivedHerdBundle,
    deleteArchivedHerdBundle,
    wipedRecoveryContext,
    restoreLatestOpfsOnWipedRecovery,
    startFreshAfterWipedRecovery,
    exportCanaryWarning,
    dismissExportCanaryWarning: () => setExportCanaryWarning(null),
    backupSyncStatus,
    pruneSyncWarning,
    connectBackupSyncFolder,
    reauthorizeBackupSyncFolder: reauthorizeBackupSyncFolderAction,
    disconnectBackupSyncFolder: disconnectBackupSyncFolderAction,
    syncVaultBackupsToSyncNow,
    dismissPruneSyncWarning,
    syncOperations,
    syncConflicts,
    buildLocalDeltaJsonPayload,
    importDeltaOperations,
    reconcileP2pOutboxOps,
    resolveSyncConflict,
    dismissSyncConflict,
    cloudSyncState,
    cloudSyncBusy,
    updateCloudSyncSettings,
    connectCloudSyncAccessToken,
    disconnectCloudSync,
    startCloudSyncPkce,
    runManualCloudSyncNow,
    resetAndRetryCloudSync,
    dismissCloudCircuitBreakerWarning,
    restoreRollingBackupByKey,
    openAddSpeciesInSettings,
    setOpenAddSpeciesInSettings,
    updateSettings,
    ignoreTaskAlertsPermanently,
    clearTaskAlertGroup,
    dismissSpeciesMemoAlert,
    togglePinSpeciesLanding,
    saveSpeciesProfile,
    updateSpeciesTargetWeightCurve,
    saveSpeciesMemo,
    preselectedGrowthAnimalIds,
    setPreselectedGrowthAnimalIds,
    openGrowthCompareForAnimals: (animalIds: string[]) => {
      setPreselectedGrowthAnimalIds(animalIds.length > 0 ? animalIds : null);
      setRoute('breeding');
    },
    reorderSpeciesCards,
    moveSpeciesCard,
    reorderSpeciesHubBlocks,
    moveSpeciesHubBlock,
    deleteSpeciesProfile,
    exportTimestampedSpeciesBackup,
    saveAnimal,
    ignoreAnimalConflicts,
    restoreAnimalConflictAlert,
    archiveAnimals,
    deleteAnimalsBatch,
    migrateAnimalsSpecies,
    addOptimizedAnimalPhotos,
    loadAnimalPhotoDataUrl,
    loadAnimalPhotoDataUrlsBatch,
    loadFeedBatchTagPhotoDataUrl,
    loadLedgerEntryReceiptPhotoDataUrl,
    hydrateSnapshotForExport,
    loadPedigreeNeighborhood,
    checkPedigreeBranchesHaveAncestors,
    setPrimaryAnimalPhoto,
    updateAnimalPhotoCaption,
    deleteAnimalPhoto,
    deleteAnimal,
    saveCage,
    deleteCage,
    assignAnimalToCage,
    logBreedingWithCascade,
    updateBreedingOutcome,
    recalculateBreedingPostBirthTasks,
    completeBreedingTaskWithOutcome,
    deleteBreeding,
    saveTask,
    exportTasksToCalendar,
    copyTaskAppLink,
    highlightedTaskId,
    setHighlightedTaskId,
    highlightedCageId,
    setHighlightedCageId,
    googleUserEmail,
    googleAuthConnected,
    googleCalendars,
    googleSyncBusy,
    pendingCalendarSync,
    connectGoogleCalendar,
    disconnectGoogleCalendar,
    refreshGoogleCalendars,
    confirmGoogleCalendarSync,
    fallbackPendingCalendarSyncToIcs,
    cancelPendingCalendarSync,
    toggleTaskCompleted,
    rescheduleTask,
    applySmartTaskEscalations,
    deleteTask,
    addCareLog,
    commitBarnBenchEntry,
    deleteCareLog,
    saveShow,
    deleteShow,
    saveFeedBatch,
    deleteFeedBatch,
    logFeedAllocation,
    deleteFeedAllocation,
    runFeedTagBiosecurityAutoPurge,
    saveLedgerEntry,
    deleteLedgerEntry,
    saveProcessingLog,
    deleteProcessingLog,
    saveYouthProjectBook,
    deleteYouthProjectBook,
    saveClientContact,
    deleteClientContact,
    saveWaitlistEntry,
    deleteWaitlistEntry,
    saveAnimalReservation,
    deleteAnimalReservation,
    completeReservationSale,
    createCrmReminderTask,
    saveWoolHarvest,
    deleteWoolHarvest,
    saveMileageLog,
    deleteMileageLog,
    saveJournalEntry,
    deleteJournalEntry,
    saveJudgeClub,
    deleteJudgeClub,
    saveJudgeAssignment,
    deleteJudgeAssignment,
    saveJudgeExpense,
    deleteJudgeExpense,
    seedSpeciesSampleData,
    seedAllPredefinedSpecies,
    deleteSpeciesTestingData,
    deleteSpeciesNonTestingData,
    deleteAllSpeciesRecords,
    clearAllRecordsKeepSpecies,
    restoreFactoryDefaults,
    importJsonBackup,
    importBackupArchiveBytes,
    applyPlatformImportPreview,
    exportSqliteBytes,
    inspectSqliteRestoreBytes,
    importSqliteBytes,
    analyzePhotoStorageFootprint,
    pruneOrphanAnimalPhotos,
    reoptimizeOversizedAnimalPhotos,
    pruneFullResPhotoPayloadsKeepingThumbnails,
    scanDatabaseHealth,
    runHealthCheckAndRepair,
    resetDatabaseConnection,
    purgeCorruptedCachesAndRecover,
    purgeOpfsTempWorkspace,
    clearLocalSyncAndBackupReminderState,
  };
}

/** Public shape of the store context value; keeps the decomposition honest at the type level. */
export type BarnStore = ReturnType<typeof useBarnStore>;
