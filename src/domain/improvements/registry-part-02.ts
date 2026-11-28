/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Another part of the list of fixes, kept in its own file so no single file grows too big to review.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Improvement registry entries IMP-018 … IMP-034 (17 entries).
 *
 * Split out of `improvementRegistry.ts` so the registry stays reviewable as it grows. The public
 * surface (`IMPROVEMENTS_REGISTRY`, invariant evaluation, markdown/JSON export) still lives in
 * `src/domain/improvementRegistry.ts` and is unchanged.
 */

import type { ImprovementEntry } from './types';

export const REGISTRY_PART_02: ImprovementEntry[] = [
  {
    id: 'IMP-018',
    title: 'Hybrid OPFS Storage Vault, Archived Herds, Wiped-Storage Recovery & IDB Migration Guard',
    category: 'backup-safety',
    source: 'session',
    userIntent:
      'Isolate temporary exports in OPFS /tmp, unify automated + manual backup vaults in OPFS /backups with IDB fallback, offload Sold/Deceased stock to OPFS /archives while preserving ancestor pedigree stubs, pause on wiped browser storage with restore recovery, and dump raw stores before resetting failed IndexedDB migrations.',
    summary:
      'Adds pure TS schema v6 envelopes, SHA-256 verification, legacy migration, and .archive.zip bundling in `backupVault.ts`; manages OPFS `/tmp`, `/backups` (retention 6 monthly / 3 pre-upgrade / 8 pre-reset), `/archives`, boot orphan sweeps, QuotaExceededError recovery, idle Export Canary, prior-use sentinel, and IndexedDB rescue dumps in `opfsStorage.ts`; and mounts UnifiedBackupVaultPanel, ArchivedHerdsModal, WipedStorageRecoveryModal, and 1-click Save to Vault banner.',
    files: [
      'src/domain/backupVault.ts',
      'src/storage/opfsStorage.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/UnifiedBackupVaultPanel.tsx',
      'src/components/ArchivedHerdsModal.tsx',
      'src/components/WipedStorageRecoveryModal.tsx',
      'src/App.tsx',
      'src/domain/__tests__/backupVault.test.ts',
      'src/storage/__tests__/opfsStorage.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/backupVault.ts',
        requiredSubstrings: [
          'CURRENT_BACKUP_SCHEMA_VERSION',
          'migrateAndValidateBackupEnvelope',
          'buildExportCanaryProbe',
          'buildArchivedAnimalsBundle',
        ],
      },
      {
        filePath: 'src/storage/opfsStorage.ts',
        requiredSubstrings: [
          'sweepOrphanedOpfsTmpOnBoot',
          'saveOpfsVaultBackup',
          'saveOpfsHerdArchive',
          'detectReturningUserWipedStorage',
          'dumpIndexedDbDatabaseToOpfs',
        ],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: [
          'allowSeedFresh',
          'detectReturningUserWipedStorage',
          'markPriorUseSentinelFromSnapshot',
          'pre_upgrade',
        ],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: [
          'wipedRecoveryContext',
          'opfsVaultBackups',
          'archivedHerdBundles',
          'offloadAnimalsToOpfsArchive',
          'runOpfsExportCanary',
        ],
      },
      {
        filePath: 'src/components/UnifiedBackupVaultPanel.tsx',
        requiredSubstrings: [
          'UnifiedBackupVaultPanel',
          'onRestoreOpfsBackup',
          'onRestoreRollingBackup',
        ],
      },
      {
        filePath: 'src/components/ArchivedHerdsModal.tsx',
        requiredSubstrings: [
          'ArchivedHerdsModal',
          'autoOffloadRetiredToOpfs',
          'onRestoreArchive',
        ],
      },
      {
        filePath: 'src/components/WipedStorageRecoveryModal.tsx',
        requiredSubstrings: [
          'WipedStorageRecoveryModal',
          'onRestoreLatestOpfs',
          'onStartFresh',
        ],
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: [
          '<WipedStorageRecoveryModal',
          'store.exportCanaryWarning',
          'Save to Vault',
        ],
      },
    ],
    restorePlaybook: [
      'Keep `src/domain/backupVault.ts` pure TypeScript with schema v6 migration, SHA-256 verification, and `computePedigreeReferencedIds` stub preservation.',
      'Keep `src/storage/opfsStorage.ts` managing `/tmp`, `/backups`, `/archives`, `try/finally` `.close()`, boot sweeps, canary checks, and IDB failure dumps.',
      'Keep `UnifiedBackupVaultPanel.tsx`, `ArchivedHerdsModal.tsx`, `WipedStorageRecoveryModal.tsx`, `useBarnStore.ts`, and `App.tsx` connected.',
    ],
  },
  {
    id: 'IMP-019',
    title: 'ES2018 Compatibility Build, Crash-Loop Circuit Breaker, Manual SW Update & Graceful Fallbacks',
    category: 'stability-pwa',
    source: 'session',
    summary:
      'Downlevels TS/Vite build to ES2018 (2018+ devices: Chrome 68+/Safari 12+/Firefox 63+/Edge 79+) with minimal zero-bloat shims, runs an ES5 pre-flight + 3-in-60s crash-loop circuit breaker & ?emergency_reset=true hatch in index.html, switches SW updates to a manual prompt gate with controllerchange handshake and open-modal deferral, offers lightweight Database-Only .JSON backups on Tier 1/2, windows large report/care-log lists, and keeps unsupported optional controls visible with clear disabled reasons.',
    userIntent:
      'Support 2018+ browsers gracefully without polyfill bloat, break reload/crash loops cleanly, defer PWA updates while editing, offer low-memory DB-only exports, and keep unavailable controls visible with explanation text.',
    files: [
      'tsconfig.json',
      'vite.config.ts',
      'index.html',
      'src/main.tsx',
      'src/utils/es2018Shims.ts',
      'src/storage/pwaUpdateManager.ts',
      'src/domain/deviceCapability.ts',
      'src/storage/deviceCapabilityDetector.ts',
      'src/utils/webFileActions.ts',
      'src/components/UnifiedBackupVaultPanel.tsx',
      'src/components/ImportExportHubScreen.tsx',
      'src/components/SettingsAndSyncScreen.tsx',
      'src/components/PrintPreviewModal.tsx',
      'src/App.tsx',
    ],
    invariants: [
      {
        filePath: 'vite.config.ts',
        requiredSubstrings: ['es2018', 'safari12', 'cssTarget', "registerType: 'prompt'"],
      },
      {
        filePath: 'index.html',
        requiredSubstrings: [
          '__PEDIGREE_PREFLIGHT__',
          'pedigree-preflight-guard',
          '__PEDIGREE_BOOT_OK__',
          'emergency_reset=true',
          '__PEDIGREE_RECORD_BOOT_CRASH__',
        ],
      },
      {
        filePath: 'src/utils/es2018Shims.ts',
        requiredSubstrings: ['ensureEs2018Globals', 'allSettled', 'fromEntries'],
      },
      {
        filePath: 'src/storage/pwaUpdateManager.ts',
        requiredSubstrings: ['usePwaUpdateStatus', 'controllerchange', 'applyPwaUpdateNow'],
      },
      {
        filePath: 'src/domain/deviceCapability.ts',
        requiredSubstrings: ['assessBrowserCompatibility', 'getHeavyZipExportGate'],
      },
      {
        filePath: 'src/utils/webFileActions.ts',
        requiredSubstrings: ['copyTextWithFallback'],
      },
      {
        filePath: 'src/components/ImportExportHubScreen.tsx',
        requiredSubstrings: ['pendingHeavyZipExport', 'heavyZipGate', 'handleDownloadDatabaseOnlyBackup'],
      },
    ],
    restorePlaybook: [
      'Keep ES2018 target in `tsconfig.json` and `vite.config.ts` (`safari12`, `registerType: "prompt"`) plus ES5 guard, circuit breaker, and `?emergency_reset=true` in `index.html`.',
      'Keep `src/utils/es2018Shims.ts` imported first in `src/main.tsx` alongside `src/storage/pwaUpdateManager.ts`.',
      'Keep `assessBrowserCompatibility` and `getHeavyZipExportGate` in `src/domain/deviceCapability.ts` and hook probes in `src/storage/deviceCapabilityDetector.ts`.',
      'Keep disabled-with-reason UI controls (`Share .HTM` in `PrintPreviewModal.tsx`, Storage Vault, Import/Export Hub, Settings), Database-Only `.JSON` export, table/care-log windowing, and open-dialog PWA update deferral in `App.tsx`.',
    ],
  },
  {
    id: 'IMP-020',
    title: 'Mobile Background Freeze Pause/Resume, Double-Submit Guards & Async Error Toast',
    category: 'stability-pwa',
    source: 'session',
    summary:
      'Cooperatively pauses & checkpoints active Folder Sync / idle vault tasks on mobile background freeze (`visibilityState === "hidden"`), auto-resumes clean pauses on foreground return while keeping severity/permission faults sticky, adds bounded `sessionStorage` emergency crash traces (`pedigree_emergency_trace_v1`) + deduplicated `AsyncErrorToastHost` notifications for uncaught rejections/persistence errors, serializes `useBarnStore` mutations via a FIFO write queue (`enqueueStoreMutation`), and enforces synchronous `ref` + React submit locks (`useAsyncSubmitLock`, `useAsyncKeyedLock`) across primary forms, sync actions, and inline toggles.',
    userIntent:
      'Prevent mid-batch IndexedDB corruption on iOS/Android background freeze, stop rapid-tap duplicate submits while holding unsaved form notes on write failures, and surface gentle non-blocking recovery toasts for uncaught async errors.',
    files: [
      'src/storage/backgroundFreezeCoordinator.ts',
      'src/storage/crashLogger.ts',
      'src/storage/localSyncChannels.ts',
      'src/utils/useAsyncSubmitLock.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/AsyncErrorToastHost.tsx',
      'src/components/AnimalEditorModal.tsx',
      'src/components/BreedingScreen.tsx',
      'src/components/HerdScreen.tsx',
      'src/components/SpeciesDashboardScreen.tsx',
      'src/components/SpeciesEditorModal.tsx',
      'src/components/SettingsAndSyncScreen.tsx',
      'src/components/DiagnosticsAndSupportPanel.tsx',
      'src/App.tsx',
      'src/utils/__tests__/asyncSubmitLock.test.ts',
      'src/storage/__tests__/backgroundFreezeAndToast.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/storage/backgroundFreezeCoordinator.ts',
        requiredSubstrings: [
          'BackgroundPausedError',
          'notifyBackgroundTransition',
          'registerPausedBackgroundJob',
          'registerFreezeLifecycleListener',
        ],
      },
      {
        filePath: 'src/storage/crashLogger.ts',
        requiredSubstrings: [
          'EMERGENCY_SESSION_TRACE_KEY',
          'emitAsyncErrorToast',
          'handleUnhandledRejectionReason',
          'notifyBackgroundTransition',
        ],
      },
      {
        filePath: 'src/storage/localSyncChannels.ts',
        requiredSubstrings: [
          'withSyncIdb',
          'sync_checkpoints',
          'BackgroundPausedError',
          'resumePersistedDirectorySyncIfGranted',
        ],
      },
      {
        filePath: 'src/utils/useAsyncSubmitLock.ts',
        requiredSubstrings: [
          'createAsyncLockController',
          'createAsyncKeyedLockController',
          'useAsyncSubmitLock',
          'useAsyncKeyedLock',
        ],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: [
          'enqueueStoreMutation',
          'registerFreezeLifecycleListener',
          'emitAsyncErrorToast',
        ],
      },
      {
        filePath: 'src/components/AsyncErrorToastHost.tsx',
        requiredSubstrings: ['subscribeAsyncErrorToasts', 'subscribePausedBackgroundJobs', 'Tap to Resume'],
      },
      {
        filePath: 'src/components/AnimalEditorModal.tsx',
        requiredSubstrings: ['useAsyncSubmitLock'],
      },
      {
        filePath: 'src/components/BreedingScreen.tsx',
        requiredSubstrings: ['breedingSubmitLock', 'outcomeSubmitLock'],
      },
      {
        filePath: 'src/components/HerdScreen.tsx',
        requiredSubstrings: ['careLogSubmitLock', 'inlineAnimalLock'],
      },
      {
        filePath: 'src/components/SpeciesDashboardScreen.tsx',
        requiredSubstrings: ['taskSubmitLock', 'taskToggleLock'],
      },
    ],
    restorePlaybook: [
      'Restore `src/storage/backgroundFreezeCoordinator.ts` and hook `notifyBackgroundTransition` inside `src/storage/crashLogger.ts`.',
      'Preserve `writeEmergencySessionTraceSync`, `emitAsyncErrorToast`, and `handleUnhandledRejectionReason` in `src/storage/crashLogger.ts` and mount `<AsyncErrorToastHost />` in `src/App.tsx`.',
      'Keep `withSyncIdb`, `sync_checkpoints` (IDB v3), `BackgroundPausedError`, and `resumePersistedDirectorySyncIfGranted` in `src/storage/localSyncChannels.ts` wired into `SettingsAndSyncScreen.tsx`.',
      'Keep `enqueueStoreMutation` + boolean/id Promise returns in `src/hooks/useBarnStore.ts` and `useAsyncSubmitLock` / `useAsyncKeyedLock` guards in `App.tsx`, `AnimalEditorModal.tsx`, `BreedingScreen.tsx`, `HerdScreen.tsx`, `SpeciesDashboardScreen.tsx`, `SpeciesEditorModal.tsx`, `SettingsAndSyncScreen.tsx`, and `DiagnosticsAndSupportPanel.tsx`.',
    ],
  },
  {
    id: 'IMP-021',
    title: 'ARIA Combobox Navigation, Reports/Settings Shortcuts, Focus Polish & rAF Observer Optimization',
    category: 'stability-pwa',
    source: 'session',
    summary:
      'Adds full WAI-ARIA keyboard navigation (`stepEnabledComboboxIndex`, `aria-activedescendant`, `ArrowDown`/`ArrowUp`/`Home`/`End`/`Enter`/`Escape`, `scrollIntoView`, and blur boundary closing) across `CarrierTraitCombobox`, `SearchableParentPicker`, and `ExternalImporterPanel`; adds `O` (Reports) and `S` (Import & Settings) global shortcuts with IME/widget guards and synchronized help panels; restores visible focus rings and pedigree focus scrolling; coalesces `App.tsx` modal `MutationObserver` via `requestAnimationFrame`; and aligns `buildPdfReadyBarnSnapshot` carrier disclosures.',
    userIntent:
      'Restore and strengthen keyboard shortcuts, tab stops, ARIA combobox navigation, and focus indicators while cleaning up minor export and DOM observer inefficiencies.',
    files: [
      'src/utils/comboboxNav.ts',
      'src/utils/__tests__/comboboxNav.test.ts',
      'src/components/CarrierTraitCombobox.tsx',
      'src/components/SearchableParentPicker.tsx',
      'src/components/ExternalImporterPanel.tsx',
      'src/App.tsx',
      'src/components/SettingsAndSyncScreen.tsx',
      'src/components/HomeSpeciesScreen.tsx',
      'src/components/AnimalPhotoGallery.tsx',
      'src/components/PedigreeScreen.tsx',
      'src/components/HerdScreen.tsx',
      'src/components/SpeciesMemoScreen.tsx',
      'src/domain/syncAndExports.ts',
    ],
    invariants: [
      {
        filePath: 'src/utils/comboboxNav.ts',
        requiredSubstrings: ['clampComboboxIndex', 'stepEnabledComboboxIndex'],
      },
      {
        filePath: 'src/components/CarrierTraitCombobox.tsx',
        requiredSubstrings: ['aria-activedescendant', 'stepEnabledComboboxIndex'],
      },
      {
        filePath: 'src/components/SearchableParentPicker.tsx',
        requiredSubstrings: ['aria-activedescendant', 'stepEnabledComboboxIndex'],
      },
      {
        filePath: 'src/components/ExternalImporterPanel.tsx',
        requiredSubstrings: ['aria-activedescendant', 'stepEnabledComboboxIndex', 'speciesOptionRefs'],
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: [
          'subscribeOpenDialogCount',
          "o: { route: 'reports', label: 'Reports' }",
          "i: { route: 'importExport', label: 'Import / Export Hub' }",
          "s: { route: 'settings', label: 'Settings' }",
          'e.isComposing',
        ],
      },
      {
        filePath: 'src/domain/syncAndExports.ts',
        requiredSubstrings: ['includeCleared: true,\n          includeLineage: true'],
      },
    ],
    restorePlaybook: [
      'Keep `src/utils/comboboxNav.ts` wired into `CarrierTraitCombobox.tsx`, `SearchableParentPicker.tsx`, and `ExternalImporterPanel.tsx` with `aria-activedescendant` and `onBlur`.',
      'Keep `subscribeOpenDialogCount` dialog tracking, IME/widget guards, and `O`/`S` shortcuts in `src/App.tsx` synced with `SettingsAndSyncScreen.tsx`.',
      'Preserve `focus-visible` outlines (`HomeSpeciesScreen.tsx`, `PedigreeScreen.tsx`, `AnimalPhotoGallery.tsx`), `WeightTrendSvg` ARIA labels (`HerdScreen.tsx`), `aria-pressed` (`SpeciesMemoScreen.tsx`), and `buildPdfReadyBarnSnapshot` carrier options (`syncAndExports.ts`).',
    ],
  },
  {
    id: 'IMP-022',
    title: 'Virtualized Pedigree Branch Loading, PWA Update Governor, Offline Probe & Upgrade Gate',
    category: 'stability-pwa',
    source: 'session',
    summary:
      'Bounds collapsed 4–6 generation pedigree chart DOM to Gen 0–3 (15 slots max) via lazy per-branch Gen 4+ expansion (`buildPedigreeBranchViewport`) while preserving full-depth `.HTM`/Barn Binder printouts; decouples PWA updates from raw `navigator.onLine` using `auto`/`notify`/`pinned` policy governance, a Manual App Offline toggle, and a timed `AbortController` captive-portal connectivity probe; and serves uncached `version.json`/`status.json` manifests with pre-upgrade SHA-256 backup verification and Safe-Harbor reset gates.',
    userIntent:
      'Keep pedigree SVG/DOM light on mobile devices, prevent unwanted or revoked app-shell reloads during active barn sessions, separate app offline holding from device Airplane Mode, and require verified backups on multi-version schema jumps.',
    files: [
      'src/domain/pedigreeCalculator.ts',
      'src/domain/upgradeGate.ts',
      'src/domain/backupVault.ts',
      'src/components/PedigreeScreen.tsx',
      'src/storage/pwaUpdateManager.ts',
      'src/storage/storageProtection.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/SettingsAndSyncScreen.tsx',
      'src/App.tsx',
      'public/version.json',
      'public/status.json',
      'vite.config.ts',
      'src/domain/__tests__/upgradeGate.test.ts',
      'src/domain/__tests__/pedigreeCalculator.test.ts',
      'src/storage/__tests__/es2018AndPwaUpdate.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/pedigreeCalculator.ts',
        requiredSubstrings: ['buildPedigreeBranchViewport', 'getGen3BranchesWithKnownAncestors'],
      },
      {
        filePath: 'src/components/PedigreeScreen.tsx',
        requiredSubstrings: ['expandedGen3Branches', 'buildPedigreeBranchViewport'],
      },
      {
        filePath: 'src/domain/upgradeGate.ts',
        requiredSubstrings: ['evaluateUpgradeGate', 'parseVersionManifestJson', 'parseStatusManifestJson'],
      },
      {
        filePath: 'src/domain/backupVault.ts',
        requiredSubstrings: ['buildVerifiedPreUpgradeJsonBackup', 'verifyPreUpgradeJsonBackup'],
      },
      {
        filePath: 'src/storage/pwaUpdateManager.ts',
        requiredSubstrings: ['pedigree_pwa_update_policy_v1', 'fetchUpgradeGateDecision'],
      },
      {
        filePath: 'src/storage/storageProtection.ts',
        requiredSubstrings: ['pedigree_manual_offline_v1', 'probeNetworkConnectivity'],
      },
      {
        filePath: 'public/version.json',
        requiredSubstrings: ['minDirectUpgradeSchema'],
      },
      {
        filePath: 'public/status.json',
        requiredSubstrings: ['revokedVersions'],
      },
      {
        filePath: 'vite.config.ts',
        requiredSubstrings: ['navigateFallbackDenylist: [/^\\/api\\//, /\\/version\\.json$/, /\\/status\\.json$/]'],
      },
    ],
    restorePlaybook: [
      'Keep `buildPedigreeBranchViewport`, `getGen3BranchIndex`, and `getGen3BranchesWithKnownAncestors` in `src/domain/pedigreeCalculator.ts` wired into `PedigreeScreen.tsx`.',
      'Preserve `src/domain/upgradeGate.ts`, `buildVerifiedPreUpgradeJsonBackup` / `verifyPreUpgradeJsonBackup` in `src/domain/backupVault.ts`, and uncached `public/version.json` & `public/status.json` with `no-store` middleware + Workbox denylist in `vite.config.ts`.',
      'Keep `PwaUpdatePolicy` (`auto` / `notify` / `pinned`) + `fetchUpgradeGateDecision` in `src/storage/pwaUpdateManager.ts`, `setManualOfflineMode` + `probeNetworkConnectivity` in `src/storage/storageProtection.ts`, and UI controls in `App.tsx`, `useBarnStore.ts`, and `SettingsAndSyncScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-023',
    title: 'Storage Pruning, Pre-Restore Archive Inspector, Clock-Skew Compensation, Monotonic _rev & Encrypted Backups',
    category: 'backup-safety',
    source: 'session',
    summary:
      'Adds a Diagnostics Photo Storage & Orphan Attachment Pruner (`photoMaintenance.ts`, `reoptimizeAnimalPhotoRecord`), an off-thread Pre-Restore Archive Inspector dry-run for `.ZIP`/`.JSON`/`.SQLITE` (`archiveInspector.ts`, `inspectRawSqliteBytes`), persistent HTTP `Date` clock-skew compensation (`recordServerDateHeaderSkew`, `getAdjustedNowIsoUtc`) with a non-blocking drift banner, per-record monotonic `_rev` counters (`compareSameEntitySyncOperations`, `bumpRecordRevision`) paired with deterministic `[a-v0-9]` Google Calendar IDs + `409` `PUT` updates, and optional PBKDF2-SHA256 + AES-256-GCM passphrase encryption for shared backups and SyncThing deltas (`encryptedExport.ts`, `passphraseCrypto.ts`) while keeping plain 1-click exports as the default.',
    userIntent:
      'Prevent runaway photo quota growth, inspect backups for species/conflicts before committing restores, protect multi-device sync order against wrong or rewound clocks, avoid duplicate Google Calendar events, and offer opt-in passphrase encryption for shared archives/sync folders.',
    files: [
      'src/domain/photoMaintenance.ts',
      'src/domain/archiveInspector.ts',
      'src/domain/encryptedExport.ts',
      'src/domain/syncOutbox.ts',
      'src/domain/calendarExport.ts',
      'src/domain/models.ts',
      'src/domain/inputSanitization.ts',
      'src/storage/passphraseCrypto.ts',
      'src/storage/storageProtection.ts',
      'src/storage/localSyncChannels.ts',
      'src/storage/offThreadWorkerClient.ts',
      'src/storage/archiveAndImport.worker.ts',
      'src/storage/webImageOptimizer.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/utils/googleCalendarClient.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/DiagnosticsAndSupportPanel.tsx',
      'src/components/ImportExportHubScreen.tsx',
      'src/components/SettingsAndSyncScreen.tsx',
      'src/App.tsx',
      'src/domain/__tests__/stageBResilience.test.ts',
      'src/storage/__tests__/passphraseAndClockSkew.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/photoMaintenance.ts',
        requiredSubstrings: [
          'analyzePhotoStorageFootprintPure',
          'removeOrphanPhotosFromSnapshotPure',
          'pruneFullResPayloadsFromSnapshotPure',
        ],
      },
      {
        filePath: 'src/domain/archiveInspector.ts',
        requiredSubstrings: [
          'inspectSnapshotBeforeRestorePure',
          'inspectParsedArchiveBeforeRestorePure',
        ],
      },
      {
        filePath: 'src/domain/encryptedExport.ts',
        requiredSubstrings: [
          'ENCRYPTED_ENVELOPE_FORMAT',
          'wrapEncryptedZipContainer',
          'tryExtractEncryptedEnvelopeFromZip',
        ],
      },
      {
        filePath: 'src/storage/passphraseCrypto.ts',
        requiredSubstrings: ['encryptBytesWithPassphrase', 'decryptBytesWithPassphrase'],
      },
      {
        filePath: 'src/storage/storageProtection.ts',
        requiredSubstrings: [
          'recordServerDateHeaderSkew',
          'getAdjustedNowIsoUtc',
          'clockDriftWarning',
        ],
      },
      {
        filePath: 'src/domain/syncOutbox.ts',
        requiredSubstrings: ['compareSameEntitySyncOperations', 'bumpRecordRevision'],
      },
      {
        filePath: 'src/domain/calendarExport.ts',
        requiredSubstrings: ['buildDeterministicGoogleCalendarEventId'],
      },
      {
        filePath: 'src/utils/googleCalendarClient.ts',
        requiredSubstrings: ['res.status === 409'],
      },
      {
        filePath: 'src/components/ImportExportHubScreen.tsx',
        requiredSubstrings: ['pendingRestoreInspection', 'encryptBackupExport'],
      },
      {
        filePath: 'src/components/DiagnosticsAndSupportPanel.tsx',
        requiredSubstrings: ['onAnalyzePhotoFootprint', 'onPruneOrphanPhotos'],
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: ['connectivity.clockDriftWarning'],
      },
    ],
    restorePlaybook: [
      'Keep pure modules `src/domain/photoMaintenance.ts`, `src/domain/archiveInspector.ts`, `src/domain/encryptedExport.ts`, `_rev` logic in `src/domain/syncOutbox.ts`, and `buildDeterministicGoogleCalendarEventId` in `src/domain/calendarExport.ts`.',
      'Keep `src/storage/passphraseCrypto.ts`, clock-skew compensation in `src/storage/storageProtection.ts`, encrypted delta/directory sync in `src/storage/localSyncChannels.ts`, off-thread inspection in `src/storage/offThreadWorkerClient.ts`, and `inspectRawSqliteBytes` in `src/storage/webSqliteAdapter.ts`.',
      'Keep Stage B store handlers in `src/hooks/useBarnStore.ts`, `409` PUT retry in `src/utils/googleCalendarClient.ts`, and UI mounts in `DiagnosticsAndSupportPanel.tsx`, `ImportExportHubScreen.tsx`, and `App.tsx`.',
    ],
  },
  {
    id: 'IMP-024',
    title: 'Active Medication Withdrawal Countdown & Livestock Safety Alerts',
    category: 'alerts-home',
    source: 'session',
    summary:
      'Surfaces active CareLog medication withdrawal periods (`withdrawalClearDateIso` / `dateIso + withdrawalDays`, cleared on the clear date itself) via an O(L) withdrawal map across Home species cards (session-closable), Herd roster rows, single-animal profiles, and Withdrawal filter/sort controls, and triggers non-blocking soft confirmation warnings before saving Sold/Culled dispositions or Show entries whose event date overlaps withdrawal.',
    userIntent:
      'Surface active care-log withdrawal periods on Herd cards and Home alerts and trigger soft confirmation warnings before marking an animal under active withdrawal for sale, meat/cull processing, or show exhibition.',
    files: [
      'src/domain/barnAlerts.ts',
      'src/domain/__tests__/barnAlerts.test.ts',
      'src/components/HomeSpeciesScreen.tsx',
      'src/components/HerdScreen.tsx',
      'src/components/AnimalEditorModal.tsx',
      'src/components/SpeciesDashboardScreen.tsx',
      'src/App.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/barnAlerts.ts',
        requiredSubstrings: [
          'buildWithdrawalByAnimalMap',
          'evaluateSpeciesActiveWithdrawalsAlert',
          'evaluateWithdrawalDispositionWarning',
          'evaluateShowWithdrawalConflicts',
        ],
      },
      {
        filePath: 'src/components/HomeSpeciesScreen.tsx',
        requiredSubstrings: [
          'evaluateSpeciesActiveWithdrawalsAlert',
          'onDismissWithdrawalAlert',
        ],
      },
      {
        filePath: 'src/components/HerdScreen.tsx',
        requiredSubstrings: ['buildWithdrawalByAnimalMap', 'withdrawal_soonest', 'Withdrawal ('],
      },
      {
        filePath: 'src/components/AnimalEditorModal.tsx',
        requiredSubstrings: ['evaluateWithdrawalDispositionWarning', 'pendingWithdrawalWarning'],
      },
      {
        filePath: 'src/components/SpeciesDashboardScreen.tsx',
        requiredSubstrings: ['evaluateShowWithdrawalConflicts', 'pendingShowWithdrawalWarning'],
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: ['dismissedWithdrawalSpecies', 'requestedHerdWithdrawalNonce'],
      },
    ],
    restorePlaybook: [
      'Keep pure withdrawal functions (`buildWithdrawalByAnimalMap`, `evaluateAnimalActiveWithdrawal`, `evaluateSpeciesActiveWithdrawalsAlert`, `evaluateWithdrawalDispositionWarning`, `evaluateShowWithdrawalConflicts`) in `src/domain/barnAlerts.ts`.',
      'Keep session-scoped `dismissedWithdrawalSpecies` in `src/App.tsx` wired to `HomeSpeciesScreen.tsx` and `HerdScreen.tsx`.',
      'Keep Herd withdrawal filter/sort/countdown badges in `HerdScreen.tsx` passing `animalCareLogs` into `AnimalEditorModal.tsx`, and keep show-date overlap checks in `SpeciesDashboardScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-025',
    title: 'Sync Outbox Alignment, Metadata-Only Photo Sync & Reset State Cleanup',
    category: 'diagnostics-sync',
    source: 'session',
    summary:
      'Queues metadata-only photo operations (stripping image blobs so large photos travel exclusively via .ZIP backups) and full cross-species migration snapshot diffs with bumped `_rev` counters into the delta outbox, hydrates missing blobs onto metadata-only photo placeholders during .ZIP/.JSON merges without clobbering newer edits, guards UI galleries against empty image URLs, and wipes `sync_outbox`, `sync_conflicts`, `sync_checkpoints`, plus backup reminder keys (`pedigree.lastBackupMeta.v1`, `pedigree.backupReminderSnoozedUntil.v1`) on factory resets and full Replace restores.',
    userIntent:
      'Align Folder/Delta Sync outbox mutations for photo actions and cross-species migrations while guaranteeing stale P2P sync queues, conflict logs, and backup reminders never leak across factory resets or full Replace restores.',
    files: [
      'src/domain/syncOutbox.ts',
      'src/domain/speciesMigration.ts',
      'src/domain/backupArchive.ts',
      'src/domain/syncAndExports.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/AnimalPhotoGallery.tsx',
      'src/components/HerdScreen.tsx',
      'src/domain/__tests__/stageBResilience.test.ts',
      'src/storage/__tests__/crossTabLockAndReload.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/syncOutbox.ts',
        requiredSubstrings: ['stripPhotoBlobsForSync', 'diffSnapshotsToSyncOperations'],
      },
      {
        filePath: 'src/domain/speciesMigration.ts',
        requiredSubstrings: ['bumpRecordRevision'],
      },
      {
        filePath: 'src/domain/backupArchive.ts',
        requiredSubstrings: ['existingHasBlob', 'incHasBlob'],
      },
      {
        filePath: 'src/domain/syncAndExports.ts',
        requiredSubstrings: ['mergeAnimalPhotosWithBlobPreservation'],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: [
          'clearLocalSyncAndBackupReminderState',
          'clearAllSyncStateInIdb',
          'stripPhotoBlobsForSync',
          'diffSnapshotsToSyncOperations',
        ],
      },
      {
        filePath: 'src/components/AnimalPhotoGallery.tsx',
        requiredSubstrings: ['p.thumbnailDataUrl || p.dataUrl'],
      },
    ],
    restorePlaybook: [
      'Keep `stripPhotoBlobsForSync`, `diffSnapshotsToSyncOperations`, and metadata-only `photo` `__create__` handling in `src/domain/syncOutbox.ts`.',
      'Keep `bumpRecordRevision` calls in `src/domain/speciesMigration.ts` and blob-preserving merge helpers in `src/domain/backupArchive.ts` and `src/domain/syncAndExports.ts`.',
      'Keep `clearLocalSyncAndBackupReminderState` wired across resets and Replace restores plus metadata-only photo/migration outbox emissions in `src/hooks/useBarnStore.ts`, and keep empty-src placeholders in `AnimalPhotoGallery.tsx` and `HerdScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-026',
    title: 'Clock-Skew Consistency & Archive Export Double-Tap Locks',
    category: 'backup-safety',
    source: 'session',
    summary:
      'Aligns upgrade-gate HTTP Date skew capture (`recordServerDateHeaderSkew`), core `nowEpochMs()` fallback defaults, and Settings folder/background pause timestamps (`getAdjustedNowMs()`) when device clocks drift, and guards all 4 backup/archive exports (`handleDownloadTimestampedFullBackup`, `handleDownloadDatabaseOnlyBackup`, `handleDownloadCompleteZip`, `handleDownloadPhotosOnlyZip`) plus heavy-ZIP caution and reset backup buttons with synchronous `archiveExportLock` (`useAsyncSubmitLock`).',
    userIntent:
      'Enforce clock-skew compensation consistently across upgrade checks and Settings timestamps while eliminating the <16ms double-tap race on heavy archive and backup exports.',
    files: [
      'src/domain/upgradeGate.ts',
      'src/storage/pwaUpdateManager.ts',
      'src/components/ImportExportHubScreen.tsx',
      'src/components/SettingsAndSyncScreen.tsx',
      'src/storage/__tests__/passphraseAndClockSkew.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/upgradeGate.ts',
        requiredSubstrings: ['nowEpochMs', 'computeHttpDateClockSkewMs'],
      },
      {
        filePath: 'src/storage/pwaUpdateManager.ts',
        requiredSubstrings: ['recordServerDateHeaderSkew', 'getAdjustedNowIsoUtc'],
      },
      {
        filePath: 'src/components/ImportExportHubScreen.tsx',
        requiredSubstrings: ['archiveExportLock', 'getAdjustedNowMs', 'archiveExportLock.runLocked'],
      },
    ],
    restorePlaybook: [
      'Keep `nowEpochMs` default inside `computeHttpDateClockSkewMs` in `src/domain/upgradeGate.ts`.',
      'Keep `recordServerDateHeaderSkew` and `getAdjustedNowIsoUtc` in `src/storage/pwaUpdateManager.ts`.',
      'Keep `archiveExportLock = useAsyncSubmitLock()` wrapping all 4 export handlers in `src/components/ImportExportHubScreen.tsx`, plus `getAdjustedNowMs()` for `pausedAtMs`.',
    ],
  },
  {
    id: 'IMP-027',
    title: 'True Lazy 2–3 Gen SQLite/OPFS Pedigree Fetching & ES2018 Windowed List Virtualization',
    category: 'stability-pwa',
    source: 'session',
    summary:
      'Keeps initial interactive pedigree charts bounded to Gen 0–3 while probing and lazily fetching Gen 4+ and OPFS `/archives` offloaded ancestors on branch expand or pre-print hydration via cycle-safe SQLite BFS (`queryPedigreeNeighborhood`, `queryPedigreeBranchAncestorsExist`) and a 256-entry LRU ancestor cache (`pedigreeAncestorCacheRef`); and replaces unbounded/static-slice lists in `BreedingScreen`, `HerdScreen`, and `ReportsScreen` with a zero-dependency ES2018 scroll window virtualizer (`useVirtualWindow`).',
    userIntent:
      'Reduce mobile RAM and DOM overhead by fetching Gen 4+ / archived pedigree ancestors lazily from SQLite/OPFS and virtualizing large Breeding, Herd, and Reports lists.',
    files: [
      'src/utils/useVirtualWindow.ts',
      'src/utils/__tests__/virtualWindow.test.ts',
      'src/storage/storageAdapter.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/storage/__tests__/pedigreeLazyFetch.test.ts',
      'src/domain/pedigreeCalculator.ts',
      'src/domain/__tests__/pedigreeCalculator.test.ts',
      'src/hooks/useBarnStore.ts',
      'src/App.tsx',
      'src/components/PedigreeScreen.tsx',
      'src/components/BreedingScreen.tsx',
      'src/components/HerdScreen.tsx',
      'src/components/ReportsScreen.tsx',
    ],
    invariants: [
      {
        filePath: 'src/utils/useVirtualWindow.ts',
        requiredSubstrings: ['computeVirtualWindow', 'useVirtualWindow', 'ResizeObserver'],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: ['queryPedigreeNeighborhood', 'queryPedigreeBranchAncestorsExist', 'mapAnimalRow'],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ['loadPedigreeNeighborhood', 'checkPedigreeBranchesHaveAncestors', 'pedigreeAncestorCacheRef'],
      },
      {
        filePath: 'src/domain/pedigreeCalculator.ts',
        requiredSubstrings: ['hasKnownAncestors', 'externalKnownBranches'],
      },
      {
        filePath: 'src/components/PedigreeScreen.tsx',
        requiredSubstrings: ['gen0To3BaseMap', 'fetchAndMergeBranchAncestors', 'handleOpenPrintModal'],
      },
      {
        filePath: 'src/components/BreedingScreen.tsx',
        requiredSubstrings: ['useVirtualWindow', 'breedingVirtual', 'ledgerStatusFilter'],
      },
      {
        filePath: 'src/components/HerdScreen.tsx',
        requiredSubstrings: ['useVirtualWindow', 'herdVirtual', 'HERD_PAGE_SIZE'],
      },
      {
        filePath: 'src/components/ReportsScreen.tsx',
        requiredSubstrings: ['useVirtualWindow', 'reportVirtual', 'windowedRows'],
      },
    ],
    restorePlaybook: [
      'Keep `src/utils/useVirtualWindow.ts` and `queryPedigreeNeighborhood` / `queryPedigreeBranchAncestorsExist` in `src/storage/webSqliteAdapter.ts`.',
      'Keep `loadPedigreeNeighborhood`, `checkPedigreeBranchesHaveAncestors`, and `pedigreeAncestorCacheRef` in `src/hooks/useBarnStore.ts` wired through `src/App.tsx` to `src/components/PedigreeScreen.tsx`.',
      'Keep `useVirtualWindow` integration in `BreedingScreen.tsx`, `HerdScreen.tsx`, and `ReportsScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-028',
    title: 'Cage / Pen Capacity Warnings & Quick Occupant Assignment',
    category: 'species-ux',
    source: 'session',
    summary:
      'Compares active, junior, and unarchived/non-offloaded retired occupants per species against `CageLocation.capacity` via pure single-pass evaluators (`evaluateCageOccupancy`, `evaluateSpeciesCagesOccupancy`, `evaluateCageAssignmentCapacityWarning`), surfaces over-capacity welfare alerts on `HomeSpeciesScreen` and `SpeciesDashboardScreen` and in printed Barn Binder housing tables (`barnBinder.ts`), adds inline cage capacity/section editing and 1-click quick occupant assignment/unassignment (`assignAnimalToCage`) on Cages & Pens cards, and displays soft confirmation warnings in both Quick Assign and `AnimalEditorModal` before exceeding capacity.',
    userIntent:
      'Compare current animal occupants against CageLocation.capacity (e.g., 3/2 over capacity), allow one-click occupant assignment from housing cards, and warn before exceeding capacity.',
    files: [
      'src/domain/barnAlerts.ts',
      'src/domain/barnBinder.ts',
      'src/domain/__tests__/barnAlerts.test.ts',
      'src/hooks/useBarnStore.ts',
      'src/App.tsx',
      'src/components/SpeciesDashboardScreen.tsx',
      'src/components/AnimalEditorModal.tsx',
      'src/components/HomeSpeciesScreen.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/barnAlerts.ts',
        requiredSubstrings: [
          'isCageOccupyingAnimal',
          'evaluateCageOccupancy',
          'evaluateSpeciesCagesOccupancy',
          'evaluateCageAssignmentCapacityWarning',
        ],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ['assignAnimalToCage'],
      },
      {
        filePath: 'src/components/SpeciesDashboardScreen.tsx',
        requiredSubstrings: [
          'cagesOccupancySummary',
          'handleQuickAssignSelect',
          'pendingCageAssignConfirm',
          'onAssignAnimalToCage',
        ],
      },
      {
        filePath: 'src/components/AnimalEditorModal.tsx',
        requiredSubstrings: [
          'liveCageCapacityWarning',
          'pendingCapacityWarning',
          'checkCapacityThenSave',
        ],
      },
      {
        filePath: 'src/components/HomeSpeciesScreen.tsx',
        requiredSubstrings: ['evaluateSpeciesCagesOccupancy', 'shouldShowOverCapacityAlert'],
      },
      {
        filePath: 'src/domain/barnBinder.ts',
        requiredSubstrings: ['(over capacity)'],
      },
    ],
    restorePlaybook: [
      'Keep pure cage occupancy & assignment warning evaluators in `src/domain/barnAlerts.ts` and tests in `src/domain/__tests__/barnAlerts.test.ts`.',
      'Keep `assignAnimalToCage` in `src/hooks/useBarnStore.ts` passed to `<SpeciesDashboardScreen onAssignAnimalToCage={store.assignAnimalToCage} />` in `src/App.tsx`.',
      'Keep live ratio displays, over-capacity alerts, quick assign/unassign, and soft capacity confirmations in `SpeciesDashboardScreen.tsx`, `AnimalEditorModal.tsx`, `HomeSpeciesScreen.tsx`, and `barnBinder.ts`.',
    ],
  },
  {
    id: 'IMP-029',
    title:
      'Breeding Lab & Master Task List Refinements (Post-Birth Recalculation, Quick Checkoffs & Breed Overrides)',
    category: 'species-ux',
    source: 'session',
    userIntent:
      'Recalculate post-birth tasks to the actual birth date when births arrive early or late, support one-click Palpation/Birth Check checkoffs with automatic Missed task cleanup, and allow optional per-breed gestation/weaning/milestone overrides.',
    summary:
      'Adds BreedScheduleOverride support (with case-insensitive dam-first, sire-fallback resolution via resolveEffectiveSpeciesProfileForBreeding and SQLite/sync/JSON preservation), adds pure post-birth task evaluation & recalculation (evaluateStalePostBirthTasksForBreeding, recalculatePostBirthTasksForBreeding) plus pending Missed cleanup (getPendingBreedingCleanupTasks) in taskMaster.ts, exposes recalculateBreedingPostBirthTasks & completeBreedingTaskWithOutcome in useBarnStore.ts, and adds UI controls in SpeciesEditorModal, BreedingScreen, and SpeciesDashboardScreen.',
    files: [
      'src/domain/models.ts',
      'src/domain/taskMaster.ts',
      'src/domain/__tests__/taskMaster.test.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/domain/syncAndExports.ts',
      'src/domain/syncOutbox.ts',
      'src/hooks/useBarnStore.ts',
      'src/App.tsx',
      'src/components/SpeciesEditorModal.tsx',
      'src/components/BreedingScreen.tsx',
      'src/components/SpeciesDashboardScreen.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/models.ts',
        requiredSubstrings: [
          'BreedScheduleOverride',
          'normalizeBreedScheduleOverrides',
          'breedOverrides',
        ],
      },
      {
        filePath: 'src/domain/taskMaster.ts',
        requiredSubstrings: [
          'resolveEffectiveSpeciesProfileForBreeding',
          'recalculatePostBirthTasksForBreeding',
          'getPendingBreedingCleanupTasks',
          'isPalpationTask',
          'isBirthCheckTask',
        ],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: ['breed_overrides_json'],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: [
          'recalculateBreedingPostBirthTasks',
          'completeBreedingTaskWithOutcome',
        ],
      },
      {
        filePath: 'src/components/SpeciesEditorModal.tsx',
        requiredSubstrings: [
          'Per-Breed Schedule Overrides',
          'handleSaveBreedOverride',
        ],
      },
      {
        filePath: 'src/components/BreedingScreen.tsx',
        requiredSubstrings: [
          'onRecalculatePostBirthTasks',
          'outcomeStalePostBirth',
          'outcomeMissedCleanupCount',
        ],
      },
      {
        filePath: 'src/components/SpeciesDashboardScreen.tsx',
        requiredSubstrings: [
          'onCompleteBreedingTask',
          'isPalpationTask',
          'isBirthCheckTask',
        ],
      },
    ],
    restorePlaybook: [
      'Keep BreedScheduleOverride & normalizeBreedScheduleOverrides in `src/domain/models.ts` and pure helpers in `src/domain/taskMaster.ts` with tests in `src/domain/__tests__/taskMaster.test.ts`.',
      'Keep `breed_overrides_json` persisted in `src/storage/webSqliteAdapter.ts` and normalized in `src/domain/syncAndExports.ts` and `src/domain/syncOutbox.ts`.',
      'Keep `recalculateBreedingPostBirthTasks` and `completeBreedingTaskWithOutcome` in `src/hooks/useBarnStore.ts` wired through `src/App.tsx` to `SpeciesDashboardScreen.tsx`, `BreedingScreen.tsx`, and `SpeciesEditorModal.tsx`.',
    ],
  },
  {
    id: 'IMP-030',
    title: 'Consolidated Import/Export Hub & Extensible Non-Native Exporter Registry',
    category: 'backup-safety',
    source: 'session',
    userIntent:
      'Consolidate all backup, native restore, multi-worker sync, external importer, and non-native exporter tools into a clean 3-section Import/Export Hub page integrated into navigation and Settings.',
    summary:
      'Adds a pure TypeScript extensible non-native exporter registry (`exporterTypes.ts`, `registry.ts`) supporting `.CSV`, Evans `.HTM`, Printable Barn Binder `.HTM`, Normalized Report DTO `.JSON`, and `.ICS` calendar tasks plus future external schema slots; introduces `ImportExportHubScreen` structured cleanly into System Backup, Imports (Native System Imports first followed by External Format Importers), and Exporters; wires `' +
      "'importExport'" +
      '` into `useBarnStore.ts`, `App.tsx` (desktop/mobile nav + `I` shortcut + backup banner routing), `SpeciesDashboardScreen.tsx`, `HomeSpeciesScreen.tsx`, and `SettingsAndSyncScreen.tsx`.',
    files: [
      'src/domain/exporters/exporterTypes.ts',
      'src/domain/exporters/registry.ts',
      'src/domain/__tests__/exportersRegistry.test.ts',
      'src/components/ImportExportHubScreen.tsx',
      'src/hooks/useBarnStore.ts',
      'src/App.tsx',
      'src/components/SettingsAndSyncScreen.tsx',
      'src/components/SpeciesDashboardScreen.tsx',
      'src/components/HomeSpeciesScreen.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/exporters/exporterTypes.ts',
        requiredSubstrings: ['ExternalExporterDescriptor', 'ExportedArtifactPayload'],
      },
      {
        filePath: 'src/domain/exporters/registry.ts',
        requiredSubstrings: [
          'BUILTIN_NON_NATIVE_EXPORTERS',
          'PLANNED_EXTERNAL_SCHEMA_TARGETS',
          'buildExporterCatalog',
          'runExternalExporter',
        ],
      },
      {
        filePath: 'src/components/ImportExportHubScreen.tsx',
        requiredSubstrings: [
          'ImportExportHubScreen',
          'ExternalImporterPanel',
          'UnifiedBackupVaultPanel',
          'BUILTIN_NON_NATIVE_EXPORTERS',
        ],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ["| 'importExport'"],
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: ['ImportExportHubScreen', 'openImportExportHub'],
      },
      {
        filePath: 'src/components/SettingsAndSyncScreen.tsx',
        requiredSubstrings: ['onOpenImportExportHub'],
      },
    ],
    restorePlaybook: [
      'Restore `src/domain/exporters/exporterTypes.ts`, `src/domain/exporters/registry.ts`, and `src/domain/__tests__/exportersRegistry.test.ts`.',
      'Restore `src/components/ImportExportHubScreen.tsx` and keep `importExport` inside `WorkspaceRoute` in `src/hooks/useBarnStore.ts`.',
      'Keep `ImportExportHubScreen` routing, `I` shortcut, navigation buttons, and Settings/Home/Species Hub links wired across `App.tsx`, `SettingsAndSyncScreen.tsx`, `SpeciesDashboardScreen.tsx`, and `HomeSpeciesScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-031',
    title: 'Interactive CSV Column Mapper, Starter Template & Unlinked Parent Preview',
    category: 'species-ux',
    source: 'session',
    userIntent:
      'Provide a one-click Starter CSV Template download, interactive column-mapping preview for spreadsheets, and pre-import highlighting for unresolved Sire/Dam links on non-HerdBoss CSV imports.',
    summary:
      'Adds pure TS Starter CSV Template generation (`csvStarterTemplate.ts`), unified column alias & override resolution (`csvColumnMapper.ts`), two-pass out-of-order CSV parent linking with unresolved Sire/Dam pre-import tracking in `universalPedigreeImporter.ts`, and interactive UI controls in `ExternalImporterPanel.tsx`.',
    files: [
      'src/domain/importers/importerTypes.ts',
      'src/domain/importers/csvStarterTemplate.ts',
      'src/domain/importers/csvColumnMapper.ts',
      'src/domain/importers/universalPedigreeImporter.ts',
      'src/components/ExternalImporterPanel.tsx',
      'src/domain/__tests__/resilienceAndUniversalImport.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/importers/csvStarterTemplate.ts',
        requiredSubstrings: ['buildStarterCsvTemplate', 'STARTER_CSV_TEMPLATE_HEADERS'],
      },
      {
        filePath: 'src/domain/importers/csvColumnMapper.ts',
        requiredSubstrings: ['CSV_TARGET_FIELD_OPTIONS', 'resolveCsvColumnAssignments', 'makeCsvColumnOverrideKey'],
      },
      {
        filePath: 'src/domain/importers/universalPedigreeImporter.ts',
        requiredSubstrings: ['resolveCsvColumnAssignments', 'unresolvedParentLinks', 'csvTables'],
      },
      {
        filePath: 'src/components/ExternalImporterPanel.tsx',
        requiredSubstrings: [
          'Download Starter CSV Template',
          'handleCsvColumnSelectionChange',
          'unresolvedParentLinks',
        ],
      },
    ],
    restorePlaybook: [
      'Restore `src/domain/importers/csvStarterTemplate.ts` and `src/domain/importers/csvColumnMapper.ts` and keep `CsvTableMappingSummary`/`UnresolvedParentLink` in `src/domain/importers/importerTypes.ts`.',
      'Keep two-pass CSV resolution and `csvColumnMapping`/`unresolvedParentLinks` wiring in `src/domain/importers/universalPedigreeImporter.ts`.',
      'Keep the Starter CSV Template download button, column-mapping region, and unresolved Sire/Dam highlight card in `src/components/ExternalImporterPanel.tsx`.',
    ],
  },
  {
    id: 'IMP-032',
    title: 'Low-RAM Export Streaming & Full OPFS /tmp Staging',
    category: 'backup-safety',
    source: 'session',
    userIntent:
      'Route all printable/shareable exports (including <512 KB .HTM pedigrees and cage cards) through OPFS /tmp with immediate post-use cleanup, and stream large .ZIP and .JSON backup chunks incrementally into OPFS /tmp without materializing monolithic JS heap buffers.',
    summary:
      'Adds worker-safe `opfsTempStream.ts` (`writeTempOpfsFileStreamed`) and chunked `writeTempOpfsFile`; stages all `downloadTextFile`, `downloadBinaryFile`, `shareTextFileOrDownload`, and `shareBinaryFileOrDownload` exports through OPFS `/tmp` with immediate cleanup in `webFileActions.ts`; streams `.JSON` backup chunks via `generateBarnBackupJsonChunks` (`syncAndExports.ts`); streams `.ZIP` archives one photo and one binder at a time via `streamCompleteBackupZipArchive` & `streamPhotosOnlyZipArchive` (`backupArchive.ts`); and wires worker/UI/store callers cleanly.',
    files: [
      'src/storage/opfsTempStream.ts',
      'src/storage/opfsStorage.ts',
      'src/domain/syncAndExports.ts',
      'src/domain/backupArchive.ts',
      'src/utils/webFileActions.ts',
      'src/storage/archiveAndImport.worker.ts',
      'src/storage/offThreadWorkerClient.ts',
      'src/components/ImportExportHubScreen.tsx',
      'src/components/SettingsAndSyncScreen.tsx',
      'src/hooks/useBarnStore.ts',
      'src/storage/__tests__/opfsStorage.test.ts',
      'src/storage/__tests__/photoHydrationAndWorker.test.ts',
      'src/domain/__tests__/syncAndExports.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/storage/opfsTempStream.ts',
        requiredSubstrings: [
          'writeTempOpfsFileStreamed',
          'writeTempOpfsFile',
          'purgeOpfsTmp',
          'readTempOpfsFileAsBlob',
        ],
      },
      {
        filePath: 'src/domain/syncAndExports.ts',
        requiredSubstrings: ['generateBarnBackupJsonChunks'],
      },
      {
        filePath: 'src/domain/backupArchive.ts',
        requiredSubstrings: ['streamCompleteBackupZipArchive', 'streamPhotosOnlyZipArchive'],
      },
      {
        filePath: 'src/utils/webFileActions.ts',
        requiredSubstrings: [
          'downloadTextChunks',
          'downloadTempOpfsExport',
          'stagePayloadInOpfsTmp',
        ],
      },
      {
        filePath: 'src/storage/offThreadWorkerClient.ts',
        requiredSubstrings: [
          'buildCompleteBackupZipToOpfsTmpOffThread',
          'buildPhotosOnlyZipToOpfsTmpOffThread',
        ],
      },
    ],
    restorePlaybook: [
      'Keep `src/storage/opfsTempStream.ts` free of React/DOM imports and delegated from `src/storage/opfsStorage.ts` and `src/storage/archiveAndImport.worker.ts`.',
      'Keep `generateBarnBackupJsonChunks` in `src/domain/syncAndExports.ts` and `streamCompleteBackupZipArchive` / `streamPhotosOnlyZipArchive` in `src/domain/backupArchive.ts`.',
      'Keep full OPFS `/tmp` staging + `downloadTextChunks` / `downloadTempOpfsExport` in `src/utils/webFileActions.ts`, wired through `offThreadWorkerClient.ts`, `ImportExportHubScreen.tsx`, `SettingsAndSyncScreen.tsx`, and `useBarnStore.ts`.',
    ],
  },
  {
    id: 'IMP-033',
    title: '"The Development" Developer & Troubleshooting Screen, Permanent Tier Hierarchy & Production Guardrails',
    category: 'diagnostics-sync',
    source: 'session',
    userIntent:
      'Relocate advanced, non-routine operational controls out of Settings into a dedicated lazy-loaded "The Development" developer screen with a permanent non-closeable Tier/Memory Hierarchy block, isolated error boundary, OPFS/IDB quota pre-flight checks, strict input sanitization, and multi-step destructive safeguards.',
    summary:
      'Introduces lazy-loaded `DevelopmentScreen` wrapped in an isolated `DevelopmentErrorBoundary`; relocates Storage Protection, Connectivity Governor, App Update Policy & Release Gate, `DiagnosticsAndSupportPanel`, and Destructive Reset Lab controls out of `SettingsAndSyncScreen` while preserving original `DeviceCapabilityCard` & Home hierarchy banners intact; embeds a permanent, non-closeable copy of the 5-tier Device Tier & Memory Hierarchy guidelines (`data-permanent-tier-hierarchy="true"`); and enforces pure TS validation/sanitization & OPFS/IDB quota pre-flight checks (`developmentGuardrails.ts`, `verifyStorageQuotaForDiagnosticAction`) plus multi-step armed phrase safeguards.',
    files: [
      'src/domain/developmentGuardrails.ts',
      'src/domain/__tests__/developmentGuardrails.test.ts',
      'src/storage/storageProtection.ts',
      'src/components/DevelopmentErrorBoundary.tsx',
      'src/components/DevelopmentScreen.tsx',
      'src/components/DiagnosticsAndSupportPanel.tsx',
      'src/components/SettingsAndSyncScreen.tsx',
      'src/hooks/useBarnStore.ts',
      'src/App.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/developmentGuardrails.ts',
        requiredSubstrings: [
          'evaluateStorageQuotaForOperation',
          'validateDiagnosticTriggerInput',
          'validateSupportRecipientEmail',
          'DESTRUCTIVE_CONFIRM_PHRASES',
          'isDestructiveActionConfirmationValid',
        ],
      },
      {
        filePath: 'src/storage/storageProtection.ts',
        requiredSubstrings: ['verifyStorageQuotaForDiagnosticAction'],
      },
      {
        filePath: 'src/components/DevelopmentErrorBoundary.tsx',
        requiredSubstrings: ['DevelopmentErrorBoundary', 'recordReactCrash'],
      },
      {
        filePath: 'src/components/DevelopmentScreen.tsx',
        requiredSubstrings: [
          'DevelopmentScreen',
          'data-permanent-tier-hierarchy="true"',
          'DEVICE_CAPABILITY_TIER_LIST',
          'destructiveArmed',
        ],
      },
      {
        filePath: 'src/components/SettingsAndSyncScreen.tsx',
        requiredSubstrings: ['onOpenDevelopment', 'DeviceCapabilityCard'],
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: ['DevelopmentScreen', 'DevelopmentErrorBoundary', "route === 'development'"],
      },
    ],
    restorePlaybook: [
      'Restore `src/domain/developmentGuardrails.ts` and `verifyStorageQuotaForDiagnosticAction` in `src/storage/storageProtection.ts`.',
      'Restore `src/components/DevelopmentErrorBoundary.tsx` and `src/components/DevelopmentScreen.tsx` with its permanent `data-permanent-tier-hierarchy="true"` section and `destructiveArmed` phrase gates.',
      'Keep `development` in `WorkspaceRoute` (`useBarnStore.ts`), `SettingsAndSyncScreen.tsx` launcher (`onOpenDevelopment`), and lazy boundary mount in `src/App.tsx`.',
    ],
  },
  {
    id: 'IMP-034',
    title: '"Barn Bench" Fast Sequential Batch Entry Mode',
    category: 'species-ux',
    source: 'session',
    summary:
      'Adds a tap-friendly, strictly species-isolated Barn Bench sequential chore sheet filtered by barn row/section, herd status, and search text; supports rapid cage-by-cage logging of weights (in species unit), 1-tap BCS presets, nail trims, cage moves with live capacity warnings, and notes with auto-advance, transactional batch care-log writes (`saveCareLogsBatch`), and field-level sync outbox recording.',
    userIntent:
      'Let breeders walk down a cage row logging weights, body condition scores, nail trims, or cage moves rapidly with auto-advance and minimal modal switching.',
    files: [
      'src/domain/barnBench.ts',
      'src/domain/__tests__/barnBench.test.ts',
      'src/storage/storageAdapter.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/BarnBenchScreen.tsx',
      'src/components/SpeciesDashboardScreen.tsx',
      'src/components/HerdScreen.tsx',
      'src/App.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/barnBench.ts',
        requiredSubstrings: [
          'extractSpeciesCageSections',
          'buildBarnBenchQueue',
          'buildBarnBenchCommitPlan',
          'findNextBarnBenchIndex',
          'BARN_BENCH_BCS_PRESETS',
        ],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: ['saveCareLogsBatch'],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ["| 'bench'", 'commitBarnBenchEntry', 'buildBarnBenchCommitPlan'],
      },
      {
        filePath: 'src/components/BarnBenchScreen.tsx',
        requiredSubstrings: [
          'BarnBenchScreen',
          'evaluateCageAssignmentCapacityWarning',
          'useAsyncSubmitLock',
          'findNextBarnBenchIndex',
        ],
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: ['BarnBenchScreen', "route === 'bench'", "k: { route: 'bench'"],
      },
    ],
    restorePlaybook: [
      'Restore `src/domain/barnBench.ts` and `src/domain/__tests__/barnBench.test.ts`.',
      'Keep `saveCareLogsBatch` on `StorageAdapter` and `WebSqliteAdapter` and `commitBarnBenchEntry` + `bench` route in `src/hooks/useBarnStore.ts`.',
      'Keep lazy `BarnBenchScreen` mounted in `src/App.tsx` with `K` shortcut and launchers in `SpeciesDashboardScreen.tsx` and `HerdScreen.tsx`.',
    ],
  },
];
