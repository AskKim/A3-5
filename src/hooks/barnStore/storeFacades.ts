/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Typed facades over the barn-store return object.
 *
 * The store still returns one flat object with its full public surface — that shape is a contract
 * pinned by `barnStoreContract.keys.json` and must not change. What was missing was a way to talk
 * about *parts* of it: components destructured whatever they happened to need, and nothing stopped a
 * screen from reaching across domains (a photo dialog calling a sync action).
 *
 * These types are `Pick`s of `BarnStore`, so they cannot invent or rename a key: a typo fails to
 * compile and a removed store key breaks every facade that claims it. `assertStoreFacadesCoverAllKeys`
 * additionally proves the groups jointly cover the whole surface, so adding a store key forces a
 * decision about which facade owns it.
 *
 * Runtime cost is zero: everything here is erased except the identity selectors, which return the
 * store unchanged.
 */
import type { BarnStore } from '../useBarnStore';

/** App shell: identity, loaded snapshot, routing, status and backup banner state. */
export type BarnStoreShellFacade = Pick<
  BarnStore,
  | 'appConfig'
  | 'deviceId'
  | 'isLoading'
  | 'engineName'
  | 'snapshot'
  | 'activeSpeciesName'
  | 'activeSpeciesData'
  | 'route'
  | 'setRoute'
  | 'statusMessage'
  | 'clearStatusMessage'
  | 'errorMessage'
  | 'clearErrorMessage'
  | 'backupStatus'
  | 'recordBackupExport'
  | 'snoozeBackupReminder'
>;

/** Animal records: selection, pedigree reads, saves and the archive/delete paths. */
export type BarnStoreAnimalFacade = Pick<
  BarnStore,
  | 'selectedAnimalId'
  | 'setSelectedAnimalId'
  | 'pedigreeAnimalId'
  | 'setPedigreeAnimalId'
  | 'pedigreeGenerations'
  | 'setPedigreeGenerations'
  | 'saveAnimal'
  | 'deleteAnimal'
  | 'archiveAnimals'
  | 'deleteAnimalsBatch'
  | 'migrateAnimalsSpecies'
  | 'ignoreAnimalConflicts'
  | 'restoreAnimalConflictAlert'
  | 'loadPedigreeNeighborhood'
  | 'checkPedigreeBranchesHaveAncestors'
>;

/** Photo payloads: optimized uploads, lazy data-url loads and storage maintenance. */
export type BarnStorePhotoFacade = Pick<
  BarnStore,
  | 'addOptimizedAnimalPhotos'
  | 'loadAnimalPhotoDataUrl'
  | 'loadAnimalPhotoDataUrlsBatch'
  | 'loadFeedBatchTagPhotoDataUrl'
  | 'loadLedgerEntryReceiptPhotoDataUrl'
  | 'setPrimaryAnimalPhoto'
  | 'updateAnimalPhotoCaption'
  | 'deleteAnimalPhoto'
  | 'analyzePhotoStorageFootprint'
  | 'pruneOrphanAnimalPhotos'
  | 'reoptimizeOversizedAnimalPhotos'
  | 'pruneFullResPhotoPayloadsKeepingThumbnails'
  | 'hydrateSnapshotForExport'
>;

/** Backup, vault and recovery: every path that can overwrite or trim the live barn. */
export type BarnStoreBackupFacade = Pick<
  BarnStore,
  | 'storageStatus'
  | 'refreshStorageStatus'
  | 'triggerPersistentStorageRequest'
  | 'opfsSupported'
  | 'opfsVaultBackups'
  | 'rollingBackups'
  | 'archivedHerdBundles'
  | 'refreshVaultAndArchives'
  | 'saveManualOpfsVaultBackup'
  | 'createAndVerifyPreUpgradeBackup'
  | 'restoreOpfsVaultBackup'
  | 'downloadOpfsVaultBackupByKey'
  | 'deleteOpfsVaultBackupByKey'
  | 'deleteRollingIdbBackupByKey'
  | 'restoreRollingBackupByKey'
  | 'offloadAnimalsToOpfsArchive'
  | 'restoreArchivedHerdBundle'
  | 'downloadArchivedHerdBundle'
  | 'deleteArchivedHerdBundle'
  | 'wipedRecoveryContext'
  | 'restoreLatestOpfsOnWipedRecovery'
  | 'startFreshAfterWipedRecovery'
  | 'exportCanaryWarning'
  | 'dismissExportCanaryWarning'
  | 'backupSyncStatus'
  | 'pruneSyncWarning'
  | 'connectBackupSyncFolder'
  | 'reauthorizeBackupSyncFolder'
  | 'disconnectBackupSyncFolder'
  | 'syncVaultBackupsToSyncNow'
  | 'dismissPruneSyncWarning'
  | 'clearLocalSyncAndBackupReminderState'
>;

/** LAN/P2P and cloud sync: operation log, conflicts, cloud app-folder state. */
export type BarnStoreSyncFacade = Pick<
  BarnStore,
  | 'syncOperations'
  | 'syncConflicts'
  | 'buildLocalDeltaJsonPayload'
  | 'importDeltaOperations'
  | 'reconcileP2pOutboxOps'
  | 'resolveSyncConflict'
  | 'dismissSyncConflict'
  | 'importConflictAlert'
  | 'dismissImportConflictAlert'
  | 'requestedHerdConflictNonce'
  | 'locateConflictsInHerd'
  | 'cloudSyncState'
  | 'cloudSyncBusy'
  | 'updateCloudSyncSettings'
  | 'connectCloudSyncAccessToken'
  | 'disconnectCloudSync'
  | 'startCloudSyncPkce'
  | 'runManualCloudSyncNow'
  | 'resetAndRetryCloudSync'
  | 'dismissCloudCircuitBreakerWarning'
>;

/** Species workspaces and their settings, ordering and destructive resets. */
export type BarnStoreSpeciesFacade = Pick<
  BarnStore,
  | 'selectSpeciesWorkspace'
  | 'openAddSpeciesInSettings'
  | 'setOpenAddSpeciesInSettings'
  | 'updateSettings'
  | 'ignoreTaskAlertsPermanently'
  | 'clearTaskAlertGroup'
  | 'dismissSpeciesMemoAlert'
  | 'togglePinSpeciesLanding'
  | 'saveSpeciesProfile'
  | 'updateSpeciesTargetWeightCurve'
  | 'saveSpeciesMemo'
  | 'preselectedGrowthAnimalIds'
  | 'setPreselectedGrowthAnimalIds'
  | 'openGrowthCompareForAnimals'
  | 'reorderSpeciesCards'
  | 'moveSpeciesCard'
  | 'reorderSpeciesHubBlocks'
  | 'moveSpeciesHubBlock'
  | 'deleteSpeciesProfile'
  | 'exportTimestampedSpeciesBackup'
  | 'seedSpeciesSampleData'
  | 'seedAllPredefinedSpecies'
  | 'deleteSpeciesTestingData'
  | 'deleteSpeciesNonTestingData'
  | 'deleteAllSpeciesRecords'
  | 'clearAllRecordsKeepSpecies'
  | 'restoreFactoryDefaults'
>;

/** Calendar connection plus task scheduling. */
export type BarnStoreCalendarFacade = Pick<
  BarnStore,
  | 'googleUserEmail'
  | 'googleAuthConnected'
  | 'googleCalendars'
  | 'googleSyncBusy'
  | 'pendingCalendarSync'
  | 'connectGoogleCalendar'
  | 'disconnectGoogleCalendar'
  | 'refreshGoogleCalendars'
  | 'confirmGoogleCalendarSync'
  | 'fallbackPendingCalendarSyncToIcs'
  | 'cancelPendingCalendarSync'
  | 'exportTasksToCalendar'
  | 'copyTaskAppLink'
  | 'highlightedTaskId'
  | 'setHighlightedTaskId'
  | 'highlightedCageId'
  | 'setHighlightedCageId'
  | 'saveTask'
  | 'deleteTask'
  | 'toggleTaskCompleted'
  | 'rescheduleTask'
  | 'applySmartTaskEscalations'
>;

/** Day-to-day husbandry records: housing, breeding, care, shows, feed and ledgers. */
export type BarnStoreHusbandryFacade = Pick<
  BarnStore,
  | 'saveCage'
  | 'deleteCage'
  | 'assignAnimalToCage'
  | 'logBreedingWithCascade'
  | 'updateBreedingOutcome'
  | 'recalculateBreedingPostBirthTasks'
  | 'completeBreedingTaskWithOutcome'
  | 'deleteBreeding'
  | 'addCareLog'
  | 'commitBarnBenchEntry'
  | 'deleteCareLog'
  | 'saveShow'
  | 'deleteShow'
  | 'saveFeedBatch'
  | 'deleteFeedBatch'
  | 'logFeedAllocation'
  | 'deleteFeedAllocation'
  | 'runFeedTagBiosecurityAutoPurge'
  | 'saveLedgerEntry'
  | 'deleteLedgerEntry'
  | 'saveProcessingLog'
  | 'deleteProcessingLog'
  | 'saveYouthProjectBook'
  | 'deleteYouthProjectBook'
  | 'saveClientContact'
  | 'deleteClientContact'
  | 'saveWaitlistEntry'
  | 'deleteWaitlistEntry'
  | 'saveAnimalReservation'
  | 'deleteAnimalReservation'
  | 'completeReservationSale'
  | 'createCrmReminderTask'
  | 'saveWoolHarvest'
  | 'deleteWoolHarvest'
  | 'saveMileageLog'
  | 'deleteMileageLog'
  | 'saveJournalEntry'
  | 'deleteJournalEntry'
  | 'saveJudgeClub'
  | 'deleteJudgeClub'
  | 'saveJudgeAssignment'
  | 'deleteJudgeAssignment'
  | 'saveJudgeExpense'
  | 'deleteJudgeExpense'
>;

/** Import/export and database health: the escape hatches and repair tools. */
export type BarnStoreDataFacade = Pick<
  BarnStore,
  | 'importJsonBackup'
  | 'importBackupArchiveBytes'
  | 'applyPlatformImportPreview'
  | 'exportSqliteBytes'
  | 'inspectSqliteRestoreBytes'
  | 'importSqliteBytes'
  | 'scanDatabaseHealth'
  | 'runHealthCheckAndRepair'
  | 'resetDatabaseConnection'
  | 'purgeCorruptedCachesAndRecover'
  | 'purgeOpfsTempWorkspace'
>;

/** Every key any facade claims. */
export type BarnStoreFacadeKeys =
  | keyof BarnStoreShellFacade
  | keyof BarnStoreAnimalFacade
  | keyof BarnStorePhotoFacade
  | keyof BarnStoreBackupFacade
  | keyof BarnStoreSyncFacade
  | keyof BarnStoreSpeciesFacade
  | keyof BarnStoreCalendarFacade
  | keyof BarnStoreHusbandryFacade
  | keyof BarnStoreDataFacade;

/**
 * Compile-time proof that the facades cover the whole surface. If the store gains a key and no
 * facade claims it, this resolves to that key instead of `never` and the build fails here.
 */
export type BarnStoreUnfacetedKeys = Exclude<keyof BarnStore, BarnStoreFacadeKeys>;
type AssertNever<T extends never> = T;
export type BarnStoreFacadeCoverage = AssertNever<BarnStoreUnfacetedKeys>;

/** Identity selectors. They add no behaviour; they name a part of the store for a consumer. */
export const selectShellFacade = (store: BarnStore): BarnStoreShellFacade => store;
export const selectAnimalFacade = (store: BarnStore): BarnStoreAnimalFacade => store;
export const selectPhotoFacade = (store: BarnStore): BarnStorePhotoFacade => store;
export const selectBackupFacade = (store: BarnStore): BarnStoreBackupFacade => store;
export const selectSyncFacade = (store: BarnStore): BarnStoreSyncFacade => store;
export const selectSpeciesFacade = (store: BarnStore): BarnStoreSpeciesFacade => store;
export const selectCalendarFacade = (store: BarnStore): BarnStoreCalendarFacade => store;
export const selectHusbandryFacade = (store: BarnStore): BarnStoreHusbandryFacade => store;
export const selectDataFacade = (store: BarnStore): BarnStoreDataFacade => store;
