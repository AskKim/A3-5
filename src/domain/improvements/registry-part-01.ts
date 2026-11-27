/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Improvement registry entries IMP-001 … IMP-017 (17 of 85).
 *
 * Split out of `improvementRegistry.ts` so the registry stays reviewable as it grows. The public
 * surface (`IMPROVEMENTS_REGISTRY`, invariant evaluation, markdown/JSON export) still lives in
 * `src/domain/improvementRegistry.ts` and is unchanged.
 */

import type { ImprovementEntry } from './types';

export const REGISTRY_PART_01: ImprovementEntry[] = [
  {
    id: 'IMP-001',
    title: 'Backup Freshness Tracking, Reminders & Clean Human-Readable Exports',
    category: 'backup-safety',
    source: 'session',
    summary:
      'Tracks external backup timestamps/formats, renders proactive dismissible/snoozable backup reminders when non-testing edits are unbacked, and writes human-readable JSON v5 backups with barnSummary and clean filenames.',
    userIntent:
      'Add backup reminders and timestamps where necessary, place backup buttons prominently, and keep backups clean and human-readable.',
    files: [
      'src/domain/backupStatus.ts',
      'src/domain/syncAndExports.ts',
      'src/hooks/useBarnStore.ts',
      'src/App.tsx',
      'src/components/ImportExportHubScreen.tsx',
      'src/components/SettingsAndSyncScreen.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/backupStatus.ts',
        requiredSubstrings: ['evaluateBackupStatus', 'formatLocalDateTimeReadable', 'hasNonTestingBarnData'],
      },
      {
        filePath: 'src/domain/syncAndExports.ts',
        requiredSubstrings: ['buildCleanBackupFileName', 'exportedAtLocal', 'barnSummary'],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ['recordBackupExport', 'snoozeBackupReminder', 'backupStatus'],
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: ['backupStatus.showDismissibleBanner', 'snoozeBackupReminder'],
      },
      {
        filePath: 'src/components/ImportExportHubScreen.tsx',
        requiredSubstrings: ['backupStatus', 'recordBackupExport'],
      },
      {
        filePath: 'src/components/SettingsAndSyncScreen.tsx',
        requiredSubstrings: ['backupStatus', "onOpenImportExportHub('backup')"],
      },
    ],
    restorePlaybook: [
      'Restore `evaluateBackupStatus` and timestamp formatters in `src/domain/backupStatus.ts`.',
      'Ensure `exportBarnBackupJson` emits `exportedAtLocal`, `barnSummary`, and deterministically sorted animals in `src/domain/syncAndExports.ts`.',
      'Wire `lastBackupMeta`, `recordBackupExport`, and `snoozeBackupReminder` in `src/hooks/useBarnStore.ts` and connect banner/cards in `src/App.tsx`, `ImportExportHubScreen.tsx`, and `SettingsAndSyncScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-002',
    title: 'Timestamped Pre-Removal Safety Backups & Non-Testing Record Purge',
    category: 'backup-safety',
    source: 'session',
    summary:
      'Recommends and triggers second-precision timestamped species backups before deleting a species, wiping all species data, or clearing only non-testing livestock entries—never overwriting stable daily backups.',
    userIntent:
      'Provide collision-free timestamped backups before removing a species or clearing non-testing entries in case corruption caused the reset.',
    files: [
      'src/domain/sampleData.ts',
      'src/domain/syncAndExports.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/SpeciesDashboardScreen.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/syncAndExports.ts',
        requiredSubstrings: ['SpeciesBackupReason', 'buildSpeciesSafetyBackupFileName', 'exportSpeciesBackupJson'],
      },
      {
        filePath: 'src/domain/sampleData.ts',
        requiredSubstrings: ['countSpeciesNonTestingRecords', 'purgeSpeciesNonTestingDataPure'],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ['deleteSpeciesNonTestingData', 'purgeSpeciesNonTestingDataPure'],
      },
      {
        filePath: 'src/components/SpeciesDashboardScreen.tsx',
        requiredSubstrings: ['countSpeciesNonTestingRecords', 'pre-remove-non-testing', 'pre-remove-species'],
      },
    ],
    restorePlaybook: [
      'Ensure `buildSpeciesSafetyBackupFileName` and 3-arg `exportSpeciesBackupJson(..., { reason })` exist in `src/domain/syncAndExports.ts`.',
      'Keep `countSpeciesNonTestingRecords` and `purgeSpeciesNonTestingDataPure` in `src/domain/sampleData.ts`.',
      'Expose `deleteSpeciesNonTestingData` in `src/hooks/useBarnStore.ts` and wire confirmation + timestamped backup buttons in `src/components/SpeciesDashboardScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-003',
    title: 'Decluttered Home Species Cards with Targeted Alerts & Arriving-Babies Indicator',
    category: 'alerts-home',
    source: 'session',
    summary:
      'Removes clutter (delete-all button, herd counts, terminology tables, day counts, test-data toggles) from Home cards and adds targeted Due/Overdue Task alerts (Do / Ignore Permanently / Clear Current Group) plus Arriving-Babies gestation alerts.',
    userIntent:
      'Keep Home species cards focused strictly on navigation, sorting, due/overdue task actionability, and upcoming births.',
    files: [
      'src/domain/models.ts',
      'src/domain/barnAlerts.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/HomeSpeciesScreen.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/models.ts',
        requiredSubstrings: ['pluralizeSpeciesLabel'],
      },
      {
        filePath: 'src/domain/barnAlerts.ts',
        requiredSubstrings: [
          'evaluateSpeciesDueTasksAlert',
          'evaluateSpeciesArrivingBabiesAlert',
          'buildTaskAlertGroupSignature',
        ],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ['ignoreTaskAlertsPermanently', 'clearTaskAlertGroup'],
      },
      {
        filePath: 'src/components/HomeSpeciesScreen.tsx',
        requiredSubstrings: ['evaluateSpeciesDueTasksAlert', 'evaluateSpeciesArrivingBabiesAlert'],
      },
    ],
    restorePlaybook: [
      'Export `pluralizeSpeciesLabel` from `src/domain/models.ts`.',
      'Use `evaluateSpeciesDueTasksAlert` and `evaluateSpeciesArrivingBabiesAlert` in `src/components/HomeSpeciesScreen.tsx`.',
      'Ensure `clearTaskAlertGroup(speciesName, groupSignature)` persists the string signature in `dismissedTaskGroupKeys`.',
    ],
  },
  {
    id: 'IMP-004',
    title: 'Optional Default Species Naming Prefix with Delimiter-Aware Override',
    category: 'species-ux',
    source: 'session',
    summary:
      'Supports per-species optional `defaultAnimalPrefix` (`Oak Ridge` or `OR-`) applied automatically on animal and litter creation only if the name does not already begin with the prefix, while letting users edit or override anytime.',
    userIntent:
      'Save repetitive typing for rabbitry/herd prefixes without double-prefixing or blocking custom names.',
    files: [
      'src/domain/models.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/HerdScreen.tsx',
      'src/components/SpeciesDashboardScreen.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/models.ts',
        requiredSubstrings: ['applyAnimalNamePrefix', 'defaultAnimalPrefix'],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ['applyAnimalNamePrefix'],
      },
    ],
    restorePlaybook: [
      'Keep `applyAnimalNamePrefix` (and `applySpeciesNamePrefix` alias) in `src/domain/models.ts`.',
      'Apply `applyAnimalNamePrefix` in animal creation forms (`HerdScreen.tsx`) and litter generation (`useBarnStore.ts`).',
    ],
  },
  {
    id: 'IMP-005',
    title: 'Species Hub Management Relocation, Cross-Species Migration Modal & Herd Pagination',
    category: 'species-ux',
    source: 'session',
    summary:
      'Moves species backup, delete, and migrate controls out of Home mini-cards into each Species Hub & Herd screen; adds pedigree-family-aware `SpeciesMigrationModal` and 50-row Show More pagination in HerdScreen.',
    userIntent:
      'Move heavy destructive & migration controls into each species hub and support safe family-linked cross-species moves.',
    files: [
      'src/domain/speciesMigration.ts',
      'src/components/SpeciesMigrationModal.tsx',
      'src/components/HerdScreen.tsx',
      'src/components/SpeciesDashboardScreen.tsx',
      'src/hooks/useBarnStore.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/speciesMigration.ts',
        requiredSubstrings: ['expandPedigreeFamilyInSpecies', 'migrateAnimalsToSpecies'],
      },
      {
        filePath: 'src/components/HerdScreen.tsx',
        requiredSubstrings: ['SpeciesMigrationModal', 'HERD_PAGE_SIZE'],
      },
      {
        filePath: 'src/components/SpeciesDashboardScreen.tsx',
        requiredSubstrings: ['SpeciesMigrationModal', 'onDownloadTimestampedSpeciesBackup'],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ['migrateAnimalsToSpecies', 'SpeciesMigrationOptions'],
      },
    ],
    restorePlaybook: [
      'Wire `migrateAnimalsToSpecies` + rolling safety snapshot inside `useBarnStore.ts`.',
      'Render `SpeciesMigrationModal` in both `HerdScreen.tsx` (single/multi-select) and `SpeciesDashboardScreen.tsx` (bulk-all).',
      'Keep `HERD_PAGE_SIZE = 50` slicing + Show More button in `HerdScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-006',
    title: 'Archive-Aware Herd Status & Importer Normalization',
    category: 'species-ux',
    source: 'session',
    summary:
      'Includes `Archived` in `AnimalStatus`, aligns `isAnimalArchived` / `isAnimalActive` / `normalizeAnimalStatus`, and teaches HerdBoss CSV importer to distinguish `Archived` & `Active` flags from `Reference` flags.',
    userIntent:
      'Ensure historical/inactive imported stock stays archived cleanly for pedigrees without triggering active barn tasks.',
    files: [
      'src/domain/models.ts',
      'src/domain/importers/herdBossImporter.ts',
      'src/domain/syncAndExports.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/models.ts',
        requiredSubstrings: ["'Archived'", 'isAnimalActive', 'normalizeAnimalStatus'],
      },
      {
        filePath: 'src/domain/importers/herdBossImporter.ts',
        requiredSubstrings: ['rawArchivedFlag', 'rawActiveFlag'],
      },
    ],
    restorePlaybook: [
      'Keep `Archived` in `AnimalStatus` and `ANIMAL_STATUSES` in `src/domain/models.ts`.',
      'Keep `isAnimalActive`, `isAnimalArchived`, and `normalizeAnimalStatus` aligned with `herdBossImporter.test.ts`.',
      'Separate `archivedFlag` and `activeFlag` lookup in `src/domain/importers/herdBossImporter.ts`.',
    ],
  },
  {
    id: 'IMP-007',
    title: 'Mobile Chrome Crash Prevention, Cycle-Guarded COI & Batch Storage Writes',
    category: 'stability-pwa',
    source: 'session',
    summary:
      'Eliminates Chrome Android Aw Snap renderer crashes by disabling Workbox SW in dev + adding self-unregistering `/dev-sw.js` middleware, scoping eager COI computation off home/settings boot, guarding `PedigreeIndex.inbreeding` recursion cycles, batching SQLite/IndexedDB mutations, and code-splitting secondary routes with `React.lazy`.',
    userIntent:
      'Fix repeated Chrome Android tab crashes before/during app startup and keep pedigree/bulk operations fast under tight mobile RAM.',
    files: [
      'vite.config.ts',
      'src/main.tsx',
      'src/domain/pedigreeCalculator.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/hooks/useBarnStore.ts',
    ],
    invariants: [
      {
        filePath: 'vite.config.ts',
        requiredSubstrings: ['devServiceWorkerCleanupPlugin', 'enabled: false'],
        forbiddenSubstrings: ['devOptions: {\n      enabled: true'],
      },
      {
        filePath: 'src/main.tsx',
        requiredSubstrings: ['import.meta.env.PROD', "navigator.serviceWorker.getRegistrations"],
      },
      {
        filePath: 'src/domain/pedigreeCalculator.ts',
        requiredSubstrings: ['inbreeding(id: string, activeCalls: Set<string> = new Set())'],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: ['saveAnimalsBatch', 'deleteAnimalsBatch', 'deleteTasksBatch'],
      },
    ],
    restorePlaybook: [
      'Set `devOptions: { enabled: false }` and keep `devServiceWorkerCleanupPlugin` in `vite.config.ts`.',
      'Guard `registerSW` behind `if (import.meta.env.PROD)` and unregister dev SWs in `src/main.tsx`.',
      'Forward `activeCalls` inside `PedigreeIndex.inbreeding` in `src/domain/pedigreeCalculator.ts` and skip unnecessary COI precompute on `home`/`settings` in `src/hooks/useBarnStore.ts`.',
    ],
  },
  {
    id: 'IMP-008',
    title: 'Hardcoded Root Base Path & Disabled Dev HMR Config + GitHub Actions CI',
    category: 'ci-tooling',
    source: 'session',
    summary:
      "Hardcodes `basePath = '/'`, `hmr: false`, and `watch: null` in Vite config so AI Studio never prompts for `VITE_BASE_PATH` or `DISABLE_HMR`, and runs unit tests, improvement verification, lint, and production builds in `.github/workflows/ci.yml`.",
    userIntent:
      'Automatically verify all domain tests, lint, improvements, and PWA builds on every push with `/` and disabled dev HMR hardcoded so AI Studio never prompts for env vars.',
    files: ['vite.config.ts', '.env.example', '.github/workflows/ci.yml', 'package.json'],
    invariants: [
      {
        filePath: 'vite.config.ts',
        requiredSubstrings: ["const basePath = '/'", 'hmr: false', 'watch: null'],
        forbiddenSubstrings: ['process.env.VITE_BASE_PATH', 'process.env.DISABLE_HMR'],
      },
      {
        filePath: '.env.example',
        requiredSubstrings: ['# No required environment variables.'],
        forbiddenSubstrings: ['VITE_BASE_PATH', 'DISABLE_HMR'],
      },
      {
        filePath: '.github/workflows/ci.yml',
        requiredSubstrings: ['npm test', 'npm run verify:improvements', 'npm run lint', 'npm run build'],
      },
      {
        filePath: 'package.json',
        requiredSubstrings: ['"test": "vitest run"', '"verify:improvements": "tsx scripts/verify-improvements.ts"'],
      },
      {
        filePath: '.github/workflows/deploy-pages.yml',
        requiredSubstrings: ['oven-sh/setup-bun', 'bun run build --base='],
      },
      {
        filePath: 'vite.config.ts',
        requiredSubstrings: ["scope: './'", "start_url: './'", "id: './'"],
      },
    ],
    restorePlaybook: [
      "Keep `const basePath = '/'`, `hmr: false`, and `watch: null` hardcoded in `vite.config.ts` without reading `process.env.VITE_BASE_PATH` or `process.env.DISABLE_HMR`.",
      'Keep relative `id`, `scope`, and `start_url` (`./`) in `VitePWA` manifest and keep `.github/workflows/deploy-pages.yml` strictly on Bun passing `--base=...` via CLI.',
      'Do not add `VITE_BASE_PATH` or `DISABLE_HMR` to `.env.example`.',
      'Ensure `package.json` defines `"test"` and `"verify:improvements"`, and `.github/workflows/ci.yml` executes both.',
    ],
  },
  {
    id: 'IMP-009',
    title: 'Crash Error Boundary, Persistent Crash Log & DB Health Self-Repair',
    category: 'diagnostics-sync',
    source: 'github-preserved',
    summary:
      'Catches render/window/promise crashes in `CrashErrorBoundary` + `crashLogger.ts`, exposes IndexedDB persistent-storage protection + DB integrity scan & repair in `dataHealthCheck.ts`, and exports one-click diagnostic ZIP support bundles.',
    userIntent:
      'Diagnose and recover from browser/storage failures on mobile without losing breeder data.',
    files: [
      'src/components/CrashErrorBoundary.tsx',
      'src/storage/crashLogger.ts',
      'src/domain/dataHealthCheck.ts',
      'src/domain/supportBundle.ts',
      'src/storage/storageProtection.ts',
    ],
    invariants: [
      {
        filePath: 'src/main.tsx',
        requiredSubstrings: ['CrashErrorBoundary', 'installGlobalCrashHandlers'],
      },
      {
        filePath: 'src/domain/dataHealthCheck.ts',
        requiredSubstrings: ['analyzeBarnDataHealth', 'repairBarnDataHealth'],
      },
      {
        filePath: 'src/domain/supportBundle.ts',
        requiredSubstrings: ['buildSupportBundleZipArchive'],
      },
    ],
    restorePlaybook: [
      'Keep `CrashErrorBoundary` wrapping `<App />` and `installGlobalCrashHandlers()` in `src/main.tsx`.',
      'Preserve `DiagnosticsAndSupportPanel.tsx` integration inside `SettingsAndSyncScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-010',
    title: 'Offline Delta Sync Outbox, Conflict Log & Complete ZIP Photo Archive',
    category: 'diagnostics-sync',
    source: 'github-preserved',
    summary:
      'Provides local-first field-level delta sync bundles, Syncthing/shared-folder direct sync, field collision review log, and Complete Archive `.ZIP` exports bundling real organized animal image files alongside SQLite + JSON.',
    userIntent:
      'Enable multi-device barn sync and complete archival exports containing both records and photos.',
    files: [
      'src/domain/syncOutbox.ts',
      'src/storage/localSyncChannels.ts',
      'src/domain/backupArchive.ts',
      'src/components/ImportExportHubScreen.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/syncOutbox.ts',
        requiredSubstrings: ['diffEntityFieldsToOperations', 'mergeDeltaOperations'],
      },
      {
        filePath: 'src/domain/backupArchive.ts',
        requiredSubstrings: ['buildCompleteBackupZipArchive', 'parseBackupArchiveInput'],
      },
    ],
    restorePlaybook: [
      'Preserve `syncOutbox.ts`, `localSyncChannels.ts`, and `backupArchive.ts` hooks inside `useBarnStore.ts` and `ImportExportHubScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-011',
    title: 'Durable App Improvement Registry & GitHub-Overwrite Drift Verifier',
    category: 'ci-tooling',
    source: 'session',
    summary:
      'Maintains this machine-checkable registry (`improvementRegistry.ts`), human-readable `IMPROVEMENTS.md`, automated CLI verifier (`scripts/verify-improvements.ts`), and in-app export/copy panel inside Diagnostics so any GitHub overwrite is immediately spotted and restorable.',
    userIntent:
      'Log every improvement in a durable, exportable system so a future GitHub sync wiping files can be detected and put back accurately.',
    files: [
      'src/domain/improvementRegistry.ts',
      'scripts/verify-improvements.ts',
      'IMPROVEMENTS.md',
      'src/components/DiagnosticsAndSupportPanel.tsx',
      'src/domain/__tests__/improvementRegistry.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/improvementRegistry.ts',
        requiredSubstrings: [
          'IMPROVEMENTS_REGISTRY',
          'evaluateImprovementInvariants',
          'formatImprovementsMarkdown',
          'buildImprovementsRecoveryJson',
        ],
      },
      {
        filePath: 'scripts/verify-improvements.ts',
        requiredSubstrings: ['evaluateImprovementInvariants', 'IMPROVEMENTS_REGISTRY'],
      },
      {
        filePath: 'src/components/DiagnosticsAndSupportPanel.tsx',
        requiredSubstrings: ['IMPROVEMENTS_REGISTRY', 'formatImprovementsMarkdown', 'buildImprovementsRecoveryJson'],
      },
    ],
    restorePlaybook: [
      'Run `npm run verify:improvements` after any pull/merge from GitHub to list wiped invariants.',
      'Use `IMPROVEMENTS.md` or the downloaded `pedigree-improvements-log.json` to restore missing helpers and wiring.',
    ],
  },
  {
    id: 'IMP-012',
    title: 'Startup Self-Healing, Lazy Firebase Auth Guard & Corrective Action Logging',
    category: 'stability-pwa',
    source: 'session',
    summary:
      'Prevents initial-load crashes and infinite loading hangs by keeping calendar auth initialization offline-safe (Firebase removed), wrapping SQLite JSON parsing in safe recovery helpers, isolating secondary startup promises with Promise.allSettled, running automatic startup health self-repair, falling back to rolling/starter snapshots on fatal DB load errors, and logging every corrective action via logDiagnosticEvent.',
    userIntent:
      'Auto-fix any initial loading or crash errors on startup and log every corrective action for debugging.',
    files: [
      'src/hooks/useBarnStore.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/utils/googleCalendarClient.ts',
      'src/App.tsx',
    ],
    invariants: [
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ['normalizeRufusLevel', 'Promise.allSettled', 'Corrective action:'],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: ['safeParseJson', 'Corrective action:'],
      },
      {
        filePath: 'src/utils/googleCalendarClient.ts',
        requiredSubstrings: ['initGoogleCalendarAuth', 'Corrective action:'],
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: ['Local Database Recovery Needed'],
      },
    ],
    restorePlaybook: [
      'Ensure `normalizeRufusLevel` is imported from `../domain/models` in `src/hooks/useBarnStore.ts`.',
      'Keep offline-safe `initGoogleCalendarAuth()` in `src/utils/googleCalendarClient.ts` and `safeParseJson()` in `src/storage/webSqliteAdapter.ts`.',
      'Keep startup `Promise.allSettled`, `repairBarnDataHealth`, emergency recovery, and `Corrective action:` `logDiagnosticEvent` calls in `src/hooks/useBarnStore.ts`.',
    ],
  },
  {
    id: 'IMP-013',
    title: 'Mobile Memory Hardening, Accessibility & Universal Pedigree Importer',
    category: 'stability-pwa',
    source: 'session',
    summary:
      'Adds UniversalPedigreeImporter for Evans .HTM rowspan trees, multi-gen CSV/TSV/pipe spreadsheets (UTF-8/UTF-16/Windows-1252, Excel serial dates), and nested JSON trees; hardens mobile memory/recursion bounds; and enforces dialog focus traps, label bindings, live regions, and keyboard accessibility across screens.',
    userIntent:
      'Optimize memory for mobile-first usage, improve cross-device accessibility, and import heterogeneous pedigree files gracefully without crashing.',
    files: [
      'src/domain/importers/universalPedigreeImporter.ts',
      'src/engine/codecs/archiveAndCsvUtils.ts',
      'src/domain/importers/registry.ts',
      'src/domain/pedigreeCalculator.ts',
      'src/domain/dataHealthCheck.ts',
      'src/components/ExternalImporterPanel.tsx',
      'src/components/SettingsAndSyncScreen.tsx',
      'src/domain/__tests__/resilienceAndUniversalImport.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/importers/universalPedigreeImporter.ts',
        requiredSubstrings: ['UniversalPedigreeImporter', 'parseEvansHtmlEntry', 'MULTI_GEN_COLUMN_SPECS'],
      },
      {
        filePath: 'src/engine/codecs/archiveAndCsvUtils.ts',
        requiredSubstrings: ['decodeTextBytes', 'detectUnbommedUtf16', 'validateAndFormatYmd'],
      },
      {
        filePath: 'src/domain/importers/registry.ts',
        requiredSubstrings: ['UniversalPedigreeImporter'],
      },
      {
        filePath: 'src/domain/pedigreeCalculator.ts',
        requiredSubstrings: ['visitedPath: Set<string> = new Set()'],
      },
      {
        filePath: 'src/components/ExternalImporterPanel.tsx',
        requiredSubstrings: ['effectiveParseError', 'role="progressbar"'],
      },
    ],
    restorePlaybook: [
      'Restore `UniversalPedigreeImporter` and register it in `src/domain/importers/registry.ts`.',
      'Keep `decodeTextBytes` UTF-16/Windows-1252 decoding and `validateAndFormatYmd` in `src/engine/codecs/archiveAndCsvUtils.ts`.',
      'Preserve `visitedPath` cycle guard on `countDirectAncestors` in `src/domain/pedigreeCalculator.ts` and accessibility attributes across modal/form components.',
    ],
  },
  {
    id: 'IMP-014',
    title: 'Species Tattoo/Sex Conflict Guardrails, Override & Import Conflict Alerts',
    category: 'species-ux',
    source: 'session',
    summary:
      'Enforces same-species duplicate tattoo/ID checks and parent sex checks in DB health scans, discourages same-sex duplicate tattoo reuse during animal & litter creation unless the user types "override", allows non-blocking imports while flagging conflicted pedigrees/profiles, and supports Conflicts First sorting/filtering plus persistent soft-warning ignore controls.',
    userIntent:
      'Catch duplicate within-species IDs and parent sex mismatches, discourage accidental duplicate tattoos with an explicit override, never hard-block imports on conflicts, and let breeders locate or ignore soft warnings.',
    files: [
      'src/domain/animalConflicts.ts',
      'src/domain/dataHealthCheck.ts',
      'src/components/AnimalEditorModal.tsx',
      'src/components/BreedingScreen.tsx',
      'src/components/HerdScreen.tsx',
      'src/hooks/useBarnStore.ts',
      'src/App.tsx',
      'src/domain/__tests__/animalConflictsAndHealth.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/animalConflicts.ts',
        requiredSubstrings: [
          'findSameSexDuplicateTattooCollisions',
          'isOverrideConfirmationValid',
          'analyzeBarnAnimalConflicts',
        ],
      },
      {
        filePath: 'src/domain/dataHealthCheck.ts',
        requiredSubstrings: ['duplicateTattooAnimalsCount', 'parentSexMismatchCount'],
      },
      {
        filePath: 'src/components/AnimalEditorModal.tsx',
        requiredSubstrings: ['findSameSexDuplicateTattooCollisions', 'isOverrideConfirmationValid'],
      },
      {
        filePath: 'src/components/BreedingScreen.tsx',
        requiredSubstrings: ['isOverrideConfirmationValid', 'isLitterOverrideConfirmed'],
      },
      {
        filePath: 'src/components/HerdScreen.tsx',
        requiredSubstrings: ['conflicts_first', 'duplicateTattooPeers'],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: [
          'ignoreAnimalConflicts',
          'restoreAnimalConflictAlert',
          'importConflictAlert',
        ],
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: ['store.importConflictAlert', 'locateConflictsInHerd'],
      },
    ],
    restorePlaybook: [
      'Keep `findSameSexDuplicateTattooCollisions`, `isOverrideConfirmationValid`, and `analyzeBarnAnimalConflicts` in `src/domain/animalConflicts.ts`.',
      'Preserve duplicate tattoo and parent sex mismatch checks in `src/domain/dataHealthCheck.ts`.',
      'Keep `"override"` guards in `AnimalEditorModal.tsx` and `BreedingScreen.tsx`, `conflicts_first` sorting/ignore controls in `HerdScreen.tsx`, and `importConflictAlert` wiring in `useBarnStore.ts` / `App.tsx`.',
    ],
  },
  {
    id: 'IMP-015',
    title: '5-Tier Device Capability Detection & Adaptive Memory Cautions',
    category: 'stability-pwa',
    source: 'session',
    summary:
      'Classifies host hardware into 5 memory/CPU tiers, surfaces hardware guidance in Home onboarding & Settings with tier-locked dismissal rules (Tier 1 locked in both locations; Tier 2 closable on Home but persistent in Settings; Tiers 3–5 closable and reopenable), and applies workload cautions in the External Importer.',
    userIntent:
      'Detect constrained mobile devices early, warn users appropriately by hardware tier, and keep Tier 1–2 cautions impossible to accidentally hide permanently.',
    files: [
      'src/domain/deviceCapability.ts',
      'src/storage/deviceCapabilityDetector.ts',
      'src/components/DeviceCapabilityCard.tsx',
      'src/components/HomeSpeciesScreen.tsx',
      'src/components/SettingsAndSyncScreen.tsx',
      'src/components/ExternalImporterPanel.tsx',
      'src/App.tsx',
      'src/domain/__tests__/deviceCapability.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/deviceCapability.ts',
        requiredSubstrings: [
          'DEVICE_CAPABILITY_TIERS',
          'classifyDeviceCapability',
          'evaluateBarnWorkloadForTier',
        ],
      },
      {
        filePath: 'src/storage/deviceCapabilityDetector.ts',
        requiredSubstrings: ['useDeviceCapability', 'readBrowserHardwareSignals'],
      },
      {
        filePath: 'src/components/DeviceCapabilityCard.tsx',
        requiredSubstrings: ['DeviceCapabilityCard', 'evaluateBarnWorkloadForTier'],
      },
      {
        filePath: 'src/components/HomeSpeciesScreen.tsx',
        requiredSubstrings: ['DeviceCapabilityCard'],
      },
      {
        filePath: 'src/components/SettingsAndSyncScreen.tsx',
        requiredSubstrings: ['DeviceCapabilityCard'],
      },
      {
        filePath: 'src/components/ExternalImporterPanel.tsx',
        requiredSubstrings: ['evaluateBarnWorkloadForTier'],
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: ['useDeviceCapability'],
      },
    ],
    restorePlaybook: [
      'Preserve `DEVICE_CAPABILITY_TIERS`, `classifyDeviceCapability`, and `evaluateBarnWorkloadForTier` in `src/domain/deviceCapability.ts`.',
      'Keep `useDeviceCapability` in `src/storage/deviceCapabilityDetector.ts` and `<DeviceCapabilityCard>` mounts in `HomeSpeciesScreen.tsx` and `SettingsAndSyncScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-016',
    title: 'Route-Level Code Splitting with Retry & Chunk Error Boundary',
    category: 'stability-pwa',
    source: 'session',
    summary:
      'Code-splits secondary screens and calendar modal via `lazyNamedRoute` (`React.lazy`) with automatic single retry, `RouteLoadingFallback` skeleton, and `RouteErrorBoundary` recovery UI to slash initial JS parse/compile memory on mobile devices.',
    userIntent:
      'Reduce startup JS bundle size and memory pressure by lazy-loading secondary screens without breaking offline or stale-chunk recovery.',
    files: [
      'src/utils/lazyRoute.tsx',
      'src/App.tsx',
      'src/utils/__tests__/lazyRoute.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/utils/lazyRoute.tsx',
        requiredSubstrings: [
          'lazyNamedRoute',
          'loadWithSingleRetry',
          'RouteErrorBoundary',
          'RouteLoadingFallback',
        ],
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: ['lazyNamedRoute', 'RouteErrorBoundary', 'RouteLoadingFallback'],
      },
    ],
    restorePlaybook: [
      'Keep `lazyNamedRoute`, `loadWithSingleRetry`, `RouteLoadingFallback`, and `RouteErrorBoundary` in `src/utils/lazyRoute.tsx`.',
      'Keep `React.lazy` declarations and `<RouteErrorBoundary><Suspense>` wrapping secondary routes in `src/App.tsx`.',
    ],
  },
  {
    id: 'IMP-017',
    title: 'On-Demand Full-Resolution Photo Hydration & Off-Thread `.ZIP`/Import Worker',
    category: 'stability-pwa',
    source: 'session',
    summary:
      'Keeps only lightweight thumbnails in reactive snapshot RAM, lazily hydrates full-resolution photo `dataUrl`s via a bounded LRU cache (`BoundedPhotoDataCache`) and SQLite fetchers on gallery/lightbox/pedigree-print/binder/export demand while guarding writes against wiping stored `data_url` rows, and moves `.ZIP` compression/extraction and external archive parsing into a dedicated Web Worker with async fallback.',
    userIntent:
      'Eliminate heavy base64 photo retention and UI-thread freezes during large `.ZIP` backups and external pedigree imports on mobile devices.',
    files: [
      'src/storage/photoHydration.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/storage/archiveAndImport.worker.ts',
      'src/storage/offThreadWorkerClient.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/AnimalPhotoGallery.tsx',
      'src/components/ExternalImporterPanel.tsx',
      'src/components/SettingsAndSyncScreen.tsx',
      'src/storage/__tests__/photoHydrationAndWorker.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/storage/photoHydration.ts',
        requiredSubstrings: [
          'BoundedPhotoDataCache',
          'stripPhotoDataUrlsFromSnapshot',
          'hydrateSnapshotWithPhotoDataUrls',
        ],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: [
          'lightweightPhotos',
          'loadAnimalPhotoDataUrl',
          'loadAnimalPhotoDataUrlsBatch',
        ],
      },
      {
        filePath: 'src/storage/archiveAndImport.worker.ts',
        requiredSubstrings: [
          'buildCompleteBackupZipArchive',
          'buildPhotosOnlyZipArchive',
          'parseBackupArchiveInput',
        ],
      },
      {
        filePath: 'src/storage/offThreadWorkerClient.ts',
        requiredSubstrings: [
          'buildCompleteBackupZipOffThread',
          'parseExternalImportOffThread',
          'buildImporterWorkerSnapshot',
        ],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: [
          'loadAnimalPhotoDataUrl',
          'hydrateSnapshotForExport',
          'buildCompleteBackupZipToOpfsTmpOffThread',
        ],
      },
      {
        filePath: 'src/components/AnimalPhotoGallery.tsx',
        requiredSubstrings: ['onLoadFullPhoto', 'activePhotoSrc'],
      },
      {
        filePath: 'src/components/ExternalImporterPanel.tsx',
        requiredSubstrings: ['parseExternalImportOffThread', 'isParsingArchive'],
      },
      {
        filePath: 'src/hooks/barnStore/usePhotoCache.ts',
        requiredSubstrings: ['BoundedPhotoDataCache', 'loadAnimalPhotoDataUrlWith'],
        rationale:
          'The bounded photo cache and its loaders now live in the barn-store photo slice; losing them there would silently disable on-demand full-resolution hydration.',
      },
    ],
    restorePlaybook: [
      'Keep `BoundedPhotoDataCache` and `hydrateSnapshotWithPhotoDataUrls` in `src/storage/photoHydration.ts` plus `lightweightPhotos` guards in `src/storage/webSqliteAdapter.ts`.',
      'Keep `archiveAndImport.worker.ts` and `offThreadWorkerClient.ts` wired into `useBarnStore.ts`, `SettingsAndSyncScreen.tsx`, `DiagnosticsAndSupportPanel.tsx`, and `ExternalImporterPanel.tsx`.',
      'Keep `onLoadFullPhoto` / `onHydrateSnapshotForExport` props wired from `App.tsx` to galleries, pedigree print modals, Barn Binders, and backup exports.',
    ],
  },
];
