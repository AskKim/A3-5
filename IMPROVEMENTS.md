# append-only, oldest first. Never rewrite past entries.
# Agents: read this before starting work; append an entry when you finish.
# Format updated 2026-11-28. Entries below predate Status/Rejected; do not backfill them.
# New entries are generated from the registry — add the entry, then run `npm run regen:ledgers` —
# and land at the bottom, after the last existing entry, in this shape:
#
#   ## YYYY-MM-DD — short imperative title
#   Why:        the problem this solved
#   Changed:    path(s), with @ <commit-sha> where the state matters
#   Rejected:   the alternative considered and why it lost (omit if none)
#   Status:     active | reverted | superseded by <entry>
#
# Escalation: if Rejected needs more than two lines, promote that entry to
#   docs/decisions/NNNN-slug.md (Context / Decision / Alternatives / Consequences)

# Community Pedigree — App Improvements & GitHub-Overwrite Recovery Log

This document is synchronized with `src/domain/improvementRegistry.ts` and verified automatically
by `npm run verify:improvements` (and GitHub Actions CI). If an upstream GitHub pull or AI Studio
sync overwrites customized files, run the verifier to pinpoint exactly which improvements were wiped
and follow the restoration playbook below.

## Release Milestone Classification

- **Alpha 2 (v0.1.0-alpha.2 — Released Baseline):** `IMP-001` through `IMP-064` (64 improvements).
- **Alpha 3 (v0.1.0-alpha.3 — Active Deliverables):** `IMP-065` onwards (79 improvements).

## Quick Verification & Recovery Commands

```bash
# 1. Check all tracked improvement invariants against files on disk
npm run verify:improvements

# 2. Run domain unit tests (includes improvementRegistry drift checks)
npm test

# 3. Typecheck and build
npm run lint && npm run build
```

---

## Logged Improvements (143)

### IMP-001: Backup Freshness Tracking, Reminders & Clean Human-Readable Exports

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Backups & Safety (`backup-safety`)
- **Origin:** Session Improvement
- **User Goal:** Add backup reminders and timestamps where necessary, place backup buttons prominently, and keep backups clean and human-readable.
- **Summary:** Tracks external backup timestamps/formats, renders proactive dismissible/snoozable backup reminders when non-testing edits are unbacked, and writes human-readable JSON v5 backups with barnSummary and clean filenames.
- **Tracked Files:** `src/domain/backupStatus.ts`, `src/domain/syncAndExports.ts`, `src/hooks/useBarnStore.ts`, `src/App.tsx`, `src/components/ImportExportHubScreen.tsx`, `src/components/SettingsAndSyncScreen.tsx`

**Automated Invariants Checked:**
- `src/domain/backupStatus.ts` must contain `evaluateBackupStatus`, `formatLocalDateTimeReadable`, `hasNonTestingBarnData` — *Backup freshness evaluator and human-readable timestamp formatters must stay intact.*
- `src/domain/syncAndExports.ts` must contain `buildCleanBackupFileName`, `exportedAtLocal`, `barnSummary` — *Clean filenames (`pedigree-backup-YYYY-MM-DD.json`) and top-level `barnSummary` prevent messy exports.*
- `src/hooks/useBarnStore.ts` must contain `recordBackupExport`, `snoozeBackupReminder`, `backupStatus` — *Store must track `lastBackupMeta` and expose `recordBackupExport`/`snoozeBackupReminder`.*
- `src/App.tsx` must contain `backupStatus.showDismissibleBanner`, `snoozeBackupReminder` — *Global dismissible/snoozable reminder banner alerts breeders when real edits are unbacked.*
- `src/components/ImportExportHubScreen.tsx` must contain `backupStatus`, `recordBackupExport` — *Import/Export Hub exports must show live backup timestamps and record external exports immediately.*
- `src/components/SettingsAndSyncScreen.tsx` must contain `backupStatus`, `onOpenImportExportHub('backup')` — *Settings must surface live top-level backup warnings and route exports directly to Import / Export Hub.*

**Restoration Playbook if Overwritten:**
1. Restore `evaluateBackupStatus` and timestamp formatters in `src/domain/backupStatus.ts`.
2. Ensure `exportBarnBackupJson` emits `exportedAtLocal`, `barnSummary`, and deterministically sorted animals in `src/domain/syncAndExports.ts`.
3. Wire `lastBackupMeta`, `recordBackupExport`, and `snoozeBackupReminder` in `src/hooks/useBarnStore.ts` and connect banner/cards in `src/App.tsx`, `ImportExportHubScreen.tsx`, and `SettingsAndSyncScreen.tsx`.

### IMP-002: Timestamped Pre-Removal Safety Backups & Non-Testing Record Purge

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Backups & Safety (`backup-safety`)
- **Origin:** Session Improvement
- **User Goal:** Provide collision-free timestamped backups before removing a species or clearing non-testing entries in case corruption caused the reset.
- **Summary:** Recommends and triggers second-precision timestamped species backups before deleting a species, wiping all species data, or clearing only non-testing livestock entries—never overwriting stable daily backups.
- **Tracked Files:** `src/domain/sampleData.ts`, `src/domain/syncAndExports.ts`, `src/hooks/useBarnStore.ts`, `src/components/SpeciesDashboardScreen.tsx`

**Automated Invariants Checked:**
- `src/domain/syncAndExports.ts` must contain `SpeciesBackupReason`, `buildSpeciesSafetyBackupFileName`, `exportSpeciesBackupJson` — *Pre-removal species JSON exports require distinct timestamped filenames and reason metadata.*
- `src/domain/sampleData.ts` must contain `countSpeciesNonTestingRecords`, `purgeSpeciesNonTestingDataPure` — *Non-testing purge must isolate user records cleanly without deleting starter sample rows.*
- `src/hooks/useBarnStore.ts` must contain `deleteSpeciesNonTestingData`, `purgeSpeciesNonTestingDataPure` — *Store must persist non-testing purges via batch operations and clear stale caches.*
- `src/components/SpeciesDashboardScreen.tsx` must contain `countSpeciesNonTestingRecords`, `pre-remove-non-testing`, `pre-remove-species` — *Species hub safety controls must offer 1-click timestamped safety backups before destructive wipes.*

**Restoration Playbook if Overwritten:**
1. Ensure `buildSpeciesSafetyBackupFileName` and 3-arg `exportSpeciesBackupJson(..., { reason })` exist in `src/domain/syncAndExports.ts`.
2. Keep `countSpeciesNonTestingRecords` and `purgeSpeciesNonTestingDataPure` in `src/domain/sampleData.ts`.
3. Expose `deleteSpeciesNonTestingData` in `src/hooks/useBarnStore.ts` and wire confirmation + timestamped backup buttons in `src/components/SpeciesDashboardScreen.tsx`.

### IMP-003: Decluttered Home Species Cards with Targeted Alerts & Arriving-Babies Indicator

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Home & Alerts (`alerts-home`)
- **Origin:** Session Improvement
- **User Goal:** Keep Home species cards focused strictly on navigation, sorting, due/overdue task actionability, and upcoming births.
- **Summary:** Removes clutter (delete-all button, herd counts, terminology tables, day counts, test-data toggles) from Home cards and adds targeted Due/Overdue Task alerts (Do / Ignore Permanently / Clear Current Group) plus Arriving-Babies gestation alerts.
- **Tracked Files:** `src/domain/models.ts`, `src/domain/barnAlerts.ts`, `src/hooks/useBarnStore.ts`, `src/components/HomeSpeciesScreen.tsx`

**Automated Invariants Checked:**
- `src/domain/models.ts` must contain `pluralizeSpeciesLabel` — *`barnAlerts.ts` uses `pluralizeSpeciesLabel` to format arriving-offspring labels cleanly.*
- `src/domain/barnAlerts.ts` must contain `evaluateSpeciesDueTasksAlert`, `evaluateSpeciesArrivingBabiesAlert`, `buildTaskAlertGroupSignature` — *Pure alert evaluation rules ensure group-clear signatures reappear only when new due tasks arrive.*
- `src/hooks/useBarnStore.ts` must contain `ignoreTaskAlertsPermanently`, `clearTaskAlertGroup` — *Store must persist ignored task IDs and cleared group signatures per species.*
- `src/components/HomeSpeciesScreen.tsx` must contain `evaluateSpeciesDueTasksAlert`, `evaluateSpeciesArrivingBabiesAlert` — *Home cards must consume `barnAlerts.ts` directly rather than drifting inline logic.*

**Restoration Playbook if Overwritten:**
1. Export `pluralizeSpeciesLabel` from `src/domain/models.ts`.
2. Use `evaluateSpeciesDueTasksAlert` and `evaluateSpeciesArrivingBabiesAlert` in `src/components/HomeSpeciesScreen.tsx`.
3. Ensure `clearTaskAlertGroup(speciesName, groupSignature)` persists the string signature in `dismissedTaskGroupKeys`.

### IMP-004: Optional Default Species Naming Prefix with Delimiter-Aware Override

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Save repetitive typing for rabbitry/herd prefixes without double-prefixing or blocking custom names.
- **Summary:** Supports per-species optional `defaultAnimalPrefix` (`Oak Ridge` or `OR-`) applied automatically on animal and litter creation only if the name does not already begin with the prefix, while letting users edit or override anytime.
- **Tracked Files:** `src/domain/models.ts`, `src/hooks/useBarnStore.ts`, `src/components/HerdScreen.tsx`, `src/components/SpeciesDashboardScreen.tsx`

**Automated Invariants Checked:**
- `src/domain/models.ts` must contain `applyAnimalNamePrefix`, `defaultAnimalPrefix` — *Delimiter-aware prefix helper handles hyphens/colons (`OR-Ruby`) and case-insensitive duplicate checks.*
- `src/hooks/useBarnStore.ts` must contain `applyAnimalNamePrefix` — *Litter offspring auto-creation in `updateBreedingOutcome` must respect the species default prefix.*

**Restoration Playbook if Overwritten:**
1. Keep `applyAnimalNamePrefix` (and `applySpeciesNamePrefix` alias) in `src/domain/models.ts`.
2. Apply `applyAnimalNamePrefix` in animal creation forms (`HerdScreen.tsx`) and litter generation (`useBarnStore.ts`).

### IMP-005: Species Hub Management Relocation, Cross-Species Migration Modal & Herd Pagination

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Move heavy destructive & migration controls into each species hub and support safe family-linked cross-species moves.
- **Summary:** Moves species backup, delete, and migrate controls out of Home mini-cards into each Species Hub & Herd screen; adds pedigree-family-aware `SpeciesMigrationModal` and 50-row Show More pagination in HerdScreen.
- **Tracked Files:** `src/domain/speciesMigration.ts`, `src/components/SpeciesMigrationModal.tsx`, `src/components/HerdScreen.tsx`, `src/components/SpeciesDashboardScreen.tsx`, `src/hooks/useBarnStore.ts`

**Automated Invariants Checked:**
- `src/domain/speciesMigration.ts` must contain `expandPedigreeFamilyInSpecies`, `migrateAnimalsToSpecies` — *Cross-species migration preserves ancestor/descendant links and moves photos/logs/breedings/tasks cleanly.*
- `src/components/HerdScreen.tsx` must contain `SpeciesMigrationModal`, `HERD_PAGE_SIZE` — *Herd screen uses `SpeciesMigrationModal` and paginates large rosters at 50 rows per page.*
- `src/components/SpeciesDashboardScreen.tsx` must contain `SpeciesMigrationModal`, `onDownloadTimestampedSpeciesBackup` — *Species Hub exposes hub-level backup, migration, and safety-backed deletion controls.*
- `src/hooks/useBarnStore.ts` must contain `migrateAnimalsToSpecies`, `SpeciesMigrationOptions` — *Store delegates species migration to the tested `migrateAnimalsToSpecies` engine.*

**Restoration Playbook if Overwritten:**
1. Wire `migrateAnimalsToSpecies` + rolling safety snapshot inside `useBarnStore.ts`.
2. Render `SpeciesMigrationModal` in both `HerdScreen.tsx` (single/multi-select) and `SpeciesDashboardScreen.tsx` (bulk-all).
3. Keep `HERD_PAGE_SIZE = 50` slicing + Show More button in `HerdScreen.tsx`.

### IMP-006: Archive-Aware Herd Status & Importer Normalization

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Ensure historical/inactive imported stock stays archived cleanly for pedigrees without triggering active barn tasks.
- **Summary:** Includes `Archived` in `AnimalStatus`, aligns `isAnimalArchived` / `isAnimalActive` / `normalizeAnimalStatus`, and teaches HerdBoss CSV importer to distinguish `Archived` & `Active` flags from `Reference` flags.
- **Tracked Files:** `src/domain/models.ts`, `src/domain/importers/herdBossImporter.ts`, `src/domain/syncAndExports.ts`

**Automated Invariants Checked:**
- `src/domain/models.ts` must contain `'Archived'`, `isAnimalActive`, `normalizeAnimalStatus` — *Canonical Archived status and importer helpers must stay exported from `models.ts`.*
- `src/domain/importers/herdBossImporter.ts` must contain `rawArchivedFlag`, `rawActiveFlag` — *CSV `Archived` / `Active` flags must map cleanly to `Archived` instead of collapsing into `Retired` or `Active`.*

**Restoration Playbook if Overwritten:**
1. Keep `Archived` in `AnimalStatus` and `ANIMAL_STATUSES` in `src/domain/models.ts`.
2. Keep `isAnimalActive`, `isAnimalArchived`, and `normalizeAnimalStatus` aligned with `herdBossImporter.test.ts`.
3. Separate `archivedFlag` and `activeFlag` lookup in `src/domain/importers/herdBossImporter.ts`.

### IMP-007: Mobile Chrome Crash Prevention, Cycle-Guarded COI & Batch Storage Writes

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Fix repeated Chrome Android tab crashes before/during app startup and keep pedigree/bulk operations fast under tight mobile RAM.
- **Summary:** Eliminates Chrome Android Aw Snap renderer crashes by disabling Workbox SW in dev + adding self-unregistering `/dev-sw.js` middleware, scoping eager COI computation off home/settings boot, guarding `PedigreeIndex.inbreeding` recursion cycles, batching SQLite/IndexedDB mutations, and code-splitting secondary routes with `React.lazy`.
- **Tracked Files:** `vite.config.ts`, `src/main.tsx`, `src/domain/pedigreeCalculator.ts`, `src/storage/webSqliteAdapter.ts`, `src/hooks/useBarnStore.ts`

**Automated Invariants Checked:**
- `vite.config.ts` must contain `devServiceWorkerCleanupPlugin`, `enabled: false` — *Workbox devOptions enabled=true inside preview iframes causes stale chunk/SW crash loops on mobile.*
  - Forbidden regression: `devOptions: {
      enabled: true`
- `src/main.tsx` must contain `import.meta.env.PROD`, `navigator.serviceWorker.getRegistrations` — *Dev mode must unregister lingering service workers and clear caches instead of registering Workbox.*
- `src/domain/pedigreeCalculator.ts` must contain `inbreeding(id: string, activeCalls: Set<string> = new Set())` — *Cycle guard prevents stack overflow if an imported pedigree has an ancestral loop.*
- `src/storage/webSqliteAdapter.ts` must contain `saveAnimalsBatch`, `deleteAnimalsBatch`, `deleteTasksBatch` — *Single-transaction SQLite batch methods prevent O(N) disk/IDB flushes on bulk edits.*

**Restoration Playbook if Overwritten:**
1. Set `devOptions: { enabled: false }` and keep `devServiceWorkerCleanupPlugin` in `vite.config.ts`.
2. Guard `registerSW` behind `if (import.meta.env.PROD)` and unregister dev SWs in `src/main.tsx`.
3. Forward `activeCalls` inside `PedigreeIndex.inbreeding` in `src/domain/pedigreeCalculator.ts` and skip unnecessary COI precompute on `home`/`settings` in `src/hooks/useBarnStore.ts`.

### IMP-008: Hardcoded Root Base Path & Disabled Dev HMR Config + GitHub Actions CI

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Automatically verify all domain tests, lint, improvements, and PWA builds on every push with `/` and disabled dev HMR hardcoded so AI Studio never prompts for env vars.
- **Summary:** Hardcodes `basePath = '/'`, `hmr: false`, and `watch: null` in Vite config so AI Studio never prompts for `VITE_BASE_PATH` or `DISABLE_HMR`, and runs unit tests, improvement verification, lint, and production builds in `.github/workflows/ci.yml`.
- **Tracked Files:** `vite.config.ts`, `.env.example`, `.github/workflows/ci.yml`, `package.json`

**Automated Invariants Checked:**
- `vite.config.ts` must contain `const basePath = '/'`, `hmr: false`, `watch: null` — *Hardcoding `basePath = '/'`, `hmr: false`, and `watch: null` prevents AI Studio from prompting for `VITE_BASE_PATH` or `DISABLE_HMR`.*
  - Forbidden regression: `process.env.VITE_BASE_PATH`, `process.env.DISABLE_HMR`
- `.env.example` must contain `# No required environment variables.` — *Omitting `VITE_BASE_PATH` and `DISABLE_HMR` from `.env.example` prevents AI Studio from prompting for unconfigured env vars.*
  - Forbidden regression: `VITE_BASE_PATH`, `DISABLE_HMR`
- `.github/workflows/ci.yml` must contain `npm test`, `npm run verify:improvements`, `npm run lint`, `npm run build` — *CI must block merges if tests, improvement invariants, TypeScript, or builds break.*
- `package.json` must contain `"test": "vitest run"`, `"verify:improvements": "tsx scripts/verify-improvements.ts"` — *Standard npm scripts power local & CI verification.*
- `.github/workflows/deploy-pages.yml` must contain `oven-sh/setup-bun`, `bun run build --base=` — *GitHub Pages deployment strictly requires Bun and passes dynamic --base on CLI.*
- `vite.config.ts` must contain `scope: './'`, `start_url: './'`, `id: './'` — *Relative PWA manifest fields ensure installability on both root (/) and GitHub Pages subpaths (/Pedigree/).*

**Restoration Playbook if Overwritten:**
1. Keep `const basePath = '/'`, `hmr: false`, and `watch: null` hardcoded in `vite.config.ts` without reading `process.env.VITE_BASE_PATH` or `process.env.DISABLE_HMR`.
2. Keep relative `id`, `scope`, and `start_url` (`./`) in `VitePWA` manifest and keep `.github/workflows/deploy-pages.yml` strictly on Bun passing `--base=...` via CLI.
3. Do not add `VITE_BASE_PATH` or `DISABLE_HMR` to `.env.example`.
4. Ensure `package.json` defines `"test"` and `"verify:improvements"`, and `.github/workflows/ci.yml` executes both.

### IMP-009: Crash Error Boundary, Persistent Crash Log & DB Health Self-Repair

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Diagnostics & Sync (`diagnostics-sync`)
- **Origin:** Preserved Upstream Feature
- **User Goal:** Diagnose and recover from browser/storage failures on mobile without losing breeder data.
- **Summary:** Catches render/window/promise crashes in `CrashErrorBoundary` + `crashLogger.ts`, exposes IndexedDB persistent-storage protection + DB integrity scan & repair in `dataHealthCheck.ts`, and exports one-click diagnostic ZIP support bundles.
- **Tracked Files:** `src/components/CrashErrorBoundary.tsx`, `src/storage/crashLogger.ts`, `src/domain/dataHealthCheck.ts`, `src/domain/supportBundle.ts`, `src/storage/storageProtection.ts`

**Automated Invariants Checked:**
- `src/main.tsx` must contain `CrashErrorBoundary`, `installGlobalCrashHandlers` — *Root mount must remain wrapped in `CrashErrorBoundary` with global handlers active.*
- `src/domain/dataHealthCheck.ts` must contain `analyzeBarnDataHealth`, `repairBarnDataHealth` — *Health scan & self-repair logic protects against orphaned pointers or malformed rows.*
- `src/domain/supportBundle.ts` must contain `buildSupportBundleZipArchive` — *Diagnostic ZIP generator packages device info, crash logs, and DB health safely.*

**Restoration Playbook if Overwritten:**
1. Keep `CrashErrorBoundary` wrapping `<App />` and `installGlobalCrashHandlers()` in `src/main.tsx`.
2. Preserve `DiagnosticsAndSupportPanel.tsx` integration inside `SettingsAndSyncScreen.tsx`.

### IMP-010: Offline Delta Sync Outbox, Conflict Log & Complete ZIP Photo Archive

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Diagnostics & Sync (`diagnostics-sync`)
- **Origin:** Preserved Upstream Feature
- **User Goal:** Enable multi-device barn sync and complete archival exports containing both records and photos.
- **Summary:** Provides local-first field-level delta sync bundles, Syncthing/shared-folder direct sync, field collision review log, and Complete Archive `.ZIP` exports bundling real organized animal image files alongside SQLite + JSON.
- **Tracked Files:** `src/domain/syncOutbox.ts`, `src/storage/localSyncChannels.ts`, `src/domain/backupArchive.ts`, `src/components/ImportExportHubScreen.tsx`

**Automated Invariants Checked:**
- `src/domain/syncOutbox.ts` must contain `diffEntityFieldsToOperations`, `mergeDeltaOperations` — *Field-level sync outbox prevents whole-record overwrites across peer devices.*
- `src/domain/backupArchive.ts` must contain `buildCompleteBackupZipArchive`, `parseBackupArchiveInput` — *ZIP archive builder/parser handles combined data + real image directory trees.*

**Restoration Playbook if Overwritten:**
1. Preserve `syncOutbox.ts`, `localSyncChannels.ts`, and `backupArchive.ts` hooks inside `useBarnStore.ts` and `ImportExportHubScreen.tsx`.

### IMP-011: Durable App Improvement Registry & GitHub-Overwrite Drift Verifier

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Log every improvement in a durable, exportable system so a future GitHub sync wiping files can be detected and put back accurately.
- **Summary:** Maintains this machine-checkable registry (`improvementRegistry.ts`), human-readable `IMPROVEMENTS.md`, automated CLI verifier (`scripts/verify-improvements.ts`), and in-app export/copy panel inside Diagnostics so any GitHub overwrite is immediately spotted and restorable.
- **Tracked Files:** `src/domain/improvementRegistry.ts`, `scripts/verify-improvements.ts`, `IMPROVEMENTS.md`, `src/components/DiagnosticsAndSupportPanel.tsx`, `src/domain/__tests__/improvementRegistry.test.ts`

**Automated Invariants Checked:**
- `src/domain/improvementRegistry.ts` must contain `IMPROVEMENTS_REGISTRY`, `evaluateImprovementInvariants`, `formatImprovementsMarkdown`, `buildImprovementsRecoveryJson` — *Core registry and pure export/verification helpers must remain intact.*
- `scripts/verify-improvements.ts` must contain `evaluateImprovementInvariants`, `IMPROVEMENTS_REGISTRY` — *CLI script verifies actual workspace source files against registry invariants.*
- `src/components/DiagnosticsAndSupportPanel.tsx` must contain `IMPROVEMENTS_REGISTRY`, `formatImprovementsMarkdown`, `buildImprovementsRecoveryJson` — *Users can view, download (.md / .json), or copy the improvement recovery log directly in the app.*

**Restoration Playbook if Overwritten:**
1. Run `npm run verify:improvements` after any pull/merge from GitHub to list wiped invariants.
2. Use `IMPROVEMENTS.md` or the downloaded `pedigree-improvements-log.json` to restore missing helpers and wiring.

### IMP-012: Startup Self-Healing, Lazy Firebase Auth Guard & Corrective Action Logging

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Auto-fix any initial loading or crash errors on startup and log every corrective action for debugging.
- **Summary:** Prevents initial-load crashes and infinite loading hangs by keeping calendar auth initialization offline-safe (Firebase removed), wrapping SQLite JSON parsing in safe recovery helpers, isolating secondary startup promises with Promise.allSettled, running automatic startup health self-repair, falling back to rolling/starter snapshots on fatal DB load errors, and logging every corrective action via logDiagnosticEvent.
- **Tracked Files:** `src/hooks/useBarnStore.ts`, `src/storage/webSqliteAdapter.ts`, `src/utils/googleCalendarClient.ts`, `src/App.tsx`

**Automated Invariants Checked:**
- `src/hooks/useBarnStore.ts` must contain `normalizeRufusLevel`, `Promise.allSettled`, `Corrective action:` — *Startup must import normalizeRufusLevel, isolate secondary boot promises, and log corrective recovery actions.*
- `src/storage/webSqliteAdapter.ts` must contain `safeParseJson`, `Corrective action:` — *Malformed SQLite row JSON must auto-recover cleanly and record a diagnostic log entry.*
- `src/utils/googleCalendarClient.ts` must contain `initGoogleCalendarAuth`, `Corrective action:` — *Calendar auth hooks must initialize cleanly offline without external Firebase dependencies before React mounts.*
- `src/App.tsx` must contain `Local Database Recovery Needed` — *Render a non-blocking recovery UI if snapshot loading fails instead of trapping users on a loading skeleton.*

**Restoration Playbook if Overwritten:**
1. Ensure `normalizeRufusLevel` is imported from `../domain/models` in `src/hooks/useBarnStore.ts`.
2. Keep offline-safe `initGoogleCalendarAuth()` in `src/utils/googleCalendarClient.ts` and `safeParseJson()` in `src/storage/webSqliteAdapter.ts`.
3. Keep startup `Promise.allSettled`, `repairBarnDataHealth`, emergency recovery, and `Corrective action:` `logDiagnosticEvent` calls in `src/hooks/useBarnStore.ts`.

### IMP-013: Mobile Memory Hardening, Accessibility & Universal Pedigree Importer

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Optimize memory for mobile-first usage, improve cross-device accessibility, and import heterogeneous pedigree files gracefully without crashing.
- **Summary:** Adds UniversalPedigreeImporter for Evans .HTM rowspan trees, multi-gen CSV/TSV/pipe spreadsheets (UTF-8/UTF-16/Windows-1252, Excel serial dates), and nested JSON trees; hardens mobile memory/recursion bounds; and enforces dialog focus traps, label bindings, live regions, and keyboard accessibility across screens.
- **Tracked Files:** `src/domain/importers/universalPedigreeImporter.ts`, `src/engine/codecs/archiveAndCsvUtils.ts`, `src/domain/importers/registry.ts`, `src/domain/pedigreeCalculator.ts`, `src/domain/dataHealthCheck.ts`, `src/components/ExternalImporterPanel.tsx`, `src/components/SettingsAndSyncScreen.tsx`, `src/domain/__tests__/resilienceAndUniversalImport.test.ts`

**Automated Invariants Checked:**
- `src/domain/importers/universalPedigreeImporter.ts` must contain `UniversalPedigreeImporter`, `parseEvansHtmlEntry`, `MULTI_GEN_COLUMN_SPECS` — *Universal importer handles Evans HTML, multi-generation spreadsheets, nested JSON, and unsupported binary warnings.*
- `src/engine/codecs/archiveAndCsvUtils.ts` must contain `decodeTextBytes`, `detectUnbommedUtf16`, `validateAndFormatYmd` — *Handles UTF-16LE/BE, Windows-1252, Excel serial dates, and calendar validation without crashing.*
- `src/domain/importers/registry.ts` must contain `UniversalPedigreeImporter` — *Registers the Universal Pedigree importer alongside HerdBoss.*
- `src/domain/pedigreeCalculator.ts` must contain `visitedPath: Set<string> = new Set()` — *Direct ancestor counting guards against circular ancestry loops.*
- `src/components/ExternalImporterPanel.tsx` must contain `effectiveParseError`, `role="progressbar"` — *Keeps parse error calculation pure and exposes accessible alert/progress semantics.*

**Restoration Playbook if Overwritten:**
1. Restore `UniversalPedigreeImporter` and register it in `src/domain/importers/registry.ts`.
2. Keep `decodeTextBytes` UTF-16/Windows-1252 decoding and `validateAndFormatYmd` in `src/engine/codecs/archiveAndCsvUtils.ts`.
3. Preserve `visitedPath` cycle guard on `countDirectAncestors` in `src/domain/pedigreeCalculator.ts` and accessibility attributes across modal/form components.

### IMP-014: Species Tattoo/Sex Conflict Guardrails, Override & Import Conflict Alerts

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Catch duplicate within-species IDs and parent sex mismatches, discourage accidental duplicate tattoos with an explicit override, never hard-block imports on conflicts, and let breeders locate or ignore soft warnings.
- **Summary:** Enforces same-species duplicate tattoo/ID checks and parent sex checks in DB health scans, discourages same-sex duplicate tattoo reuse during animal & litter creation unless the user types "override", allows non-blocking imports while flagging conflicted pedigrees/profiles, and supports Conflicts First sorting/filtering plus persistent soft-warning ignore controls.
- **Tracked Files:** `src/domain/animalConflicts.ts`, `src/domain/dataHealthCheck.ts`, `src/components/AnimalEditorModal.tsx`, `src/components/BreedingScreen.tsx`, `src/components/HerdScreen.tsx`, `src/hooks/useBarnStore.ts`, `src/App.tsx`, `src/domain/__tests__/animalConflictsAndHealth.test.ts`

**Automated Invariants Checked:**
- `src/domain/animalConflicts.ts` must contain `findSameSexDuplicateTattooCollisions`, `isOverrideConfirmationValid`, `analyzeBarnAnimalConflicts` — *Core conflict detection, override confirmation, and summary logic must remain intact.*
- `src/domain/dataHealthCheck.ts` must contain `duplicateTattooAnimalsCount`, `parentSexMismatchCount` — *Database health checks must report duplicate within-species tattoos and parent sex mismatches.*
- `src/components/AnimalEditorModal.tsx` must contain `findSameSexDuplicateTattooCollisions`, `isOverrideConfirmationValid` — *Single-animal editor must warn on same-sex duplicate tattoos and require explicit override typing.*
- `src/components/BreedingScreen.tsx` must contain `isOverrideConfirmationValid`, `isLitterOverrideConfirmed` — *Bulk litter creation must enforce the same duplicate tattoo override guardrail.*
- `src/components/HerdScreen.tsx` must contain `conflicts_first`, `duplicateTattooPeers` — *Herd screen must allow sorting/filtering conflicted animals and ignoring/restoring soft warnings.*
- `src/hooks/useBarnStore.ts` must contain `ignoreAnimalConflicts`, `restoreAnimalConflictAlert`, `importConflictAlert` — *Store must emit post-import conflict alerts and persist per-animal ignored conflict flags.*
- `src/App.tsx` must contain `store.importConflictAlert`, `locateConflictsInHerd` — *Root shell renders non-blocking import conflict banners with direct Locate Conflicted Animals action.*

**Restoration Playbook if Overwritten:**
1. Keep `findSameSexDuplicateTattooCollisions`, `isOverrideConfirmationValid`, and `analyzeBarnAnimalConflicts` in `src/domain/animalConflicts.ts`.
2. Preserve duplicate tattoo and parent sex mismatch checks in `src/domain/dataHealthCheck.ts`.
3. Keep `"override"` guards in `AnimalEditorModal.tsx` and `BreedingScreen.tsx`, `conflicts_first` sorting/ignore controls in `HerdScreen.tsx`, and `importConflictAlert` wiring in `useBarnStore.ts` / `App.tsx`.

### IMP-015: 5-Tier Device Capability Detection & Adaptive Memory Cautions

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Detect constrained mobile devices early, warn users appropriately by hardware tier, and keep Tier 1–2 cautions impossible to accidentally hide permanently.
- **Summary:** Classifies host hardware into 5 memory/CPU tiers, surfaces hardware guidance in Home onboarding & Settings with tier-locked dismissal rules (Tier 1 locked in both locations; Tier 2 closable on Home but persistent in Settings; Tiers 3–5 closable and reopenable), and applies workload cautions in the External Importer.
- **Tracked Files:** `src/domain/deviceCapability.ts`, `src/storage/deviceCapabilityDetector.ts`, `src/components/DeviceCapabilityCard.tsx`, `src/components/HomeSpeciesScreen.tsx`, `src/components/SettingsAndSyncScreen.tsx`, `src/components/ExternalImporterPanel.tsx`, `src/App.tsx`, `src/domain/__tests__/deviceCapability.test.ts`

**Automated Invariants Checked:**
- `src/domain/deviceCapability.ts` must contain `DEVICE_CAPABILITY_TIERS`, `classifyDeviceCapability`, `evaluateBarnWorkloadForTier` — *Pure 5-tier classification, dismissal rules, and workload evaluator must remain intact.*
- `src/storage/deviceCapabilityDetector.ts` must contain `useDeviceCapability`, `readBrowserHardwareSignals` — *Per-device hardware signal collector and localStorage dismissal hook isolate device state from portable backups.*
- `src/components/DeviceCapabilityCard.tsx` must contain `DeviceCapabilityCard`, `evaluateBarnWorkloadForTier` — *Shared tier banner respects Home vs Settings tier-specific close/reopen rules.*
- `src/components/HomeSpeciesScreen.tsx` must contain `DeviceCapabilityCard` — *Home onboarding displays device capability card on startup.*
- `src/components/SettingsAndSyncScreen.tsx` must contain `DeviceCapabilityCard` — *Settings exposes upper Device Capability section with persistent Tier 1–2 status and reopen control.*
- `src/components/ExternalImporterPanel.tsx` must contain `evaluateBarnWorkloadForTier` — *Importer evaluates incoming record counts against host device capability tier.*
- `src/App.tsx` must contain `useDeviceCapability` — *Root shell runs `useDeviceCapability()` and passes controller to Home and Settings.*

**Restoration Playbook if Overwritten:**
1. Preserve `DEVICE_CAPABILITY_TIERS`, `classifyDeviceCapability`, and `evaluateBarnWorkloadForTier` in `src/domain/deviceCapability.ts`.
2. Keep `useDeviceCapability` in `src/storage/deviceCapabilityDetector.ts` and `<DeviceCapabilityCard>` mounts in `HomeSpeciesScreen.tsx` and `SettingsAndSyncScreen.tsx`.

### IMP-016: Route-Level Code Splitting with Retry & Chunk Error Boundary

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Reduce startup JS bundle size and memory pressure by lazy-loading secondary screens without breaking offline or stale-chunk recovery.
- **Summary:** Code-splits secondary screens and calendar modal via `lazyNamedRoute` (`React.lazy`) with automatic single retry, `RouteLoadingFallback` skeleton, and `RouteErrorBoundary` recovery UI to slash initial JS parse/compile memory on mobile devices.
- **Tracked Files:** `src/utils/lazyRoute.tsx`, `src/App.tsx`, `src/utils/__tests__/lazyRoute.test.ts`

**Automated Invariants Checked:**
- `src/utils/lazyRoute.tsx` must contain `lazyNamedRoute`, `loadWithSingleRetry`, `RouteErrorBoundary`, `RouteLoadingFallback` — *Named-export lazy wrapper, single chunk retry, and route error boundary prevent blank-screen crashes.*
- `src/App.tsx` must contain `lazyNamedRoute`, `RouteErrorBoundary`, `RouteLoadingFallback` — *Secondary routes in `App.tsx` must stay lazily loaded inside `RouteErrorBoundary` + `Suspense`.*

**Restoration Playbook if Overwritten:**
1. Keep `lazyNamedRoute`, `loadWithSingleRetry`, `RouteLoadingFallback`, and `RouteErrorBoundary` in `src/utils/lazyRoute.tsx`.
2. Keep `React.lazy` declarations and `<RouteErrorBoundary><Suspense>` wrapping secondary routes in `src/App.tsx`.

### IMP-017: On-Demand Full-Resolution Photo Hydration & Off-Thread `.ZIP`/Import Worker

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Eliminate heavy base64 photo retention and UI-thread freezes during large `.ZIP` backups and external pedigree imports on mobile devices.
- **Summary:** Keeps only lightweight thumbnails in reactive snapshot RAM, lazily hydrates full-resolution photo `dataUrl`s via a bounded LRU cache (`BoundedPhotoDataCache`) and SQLite fetchers on gallery/lightbox/pedigree-print/binder/export demand while guarding writes against wiping stored `data_url` rows, and moves `.ZIP` compression/extraction and external archive parsing into a dedicated Web Worker with async fallback.
- **Tracked Files:** `src/storage/photoHydration.ts`, `src/storage/webSqliteAdapter.ts`, `src/storage/archiveAndImport.worker.ts`, `src/storage/offThreadWorkerClient.ts`, `src/hooks/useBarnStore.ts`, `src/components/AnimalPhotoGallery.tsx`, `src/components/ExternalImporterPanel.tsx`, `src/components/SettingsAndSyncScreen.tsx`, `src/storage/__tests__/photoHydrationAndWorker.test.ts`

**Automated Invariants Checked:**
- `src/storage/photoHydration.ts` must contain `BoundedPhotoDataCache`, `stripPhotoDataUrlsFromSnapshot`, `hydrateSnapshotWithPhotoDataUrls` — *Bounded LRU cache and batch hydration helpers keep full-res base64 strings out of steady-state RAM.*
- `src/storage/webSqliteAdapter.ts` must contain `lightweightPhotos`, `loadAnimalPhotoDataUrl`, `loadAnimalPhotoDataUrlsBatch` — *SQLite adapter supports thumbnail-only snapshot loads, on-demand photo reads, and non-destructive dehydrated writes.*
- `src/storage/archiveAndImport.worker.ts` must contain `buildCompleteBackupZipArchive`, `buildPhotosOnlyZipArchive`, `parseBackupArchiveInput` — *Dedicated module worker runs heavy ZIP builds/extractions and importer parsing off the UI thread.*
- `src/storage/offThreadWorkerClient.ts` must contain `buildCompleteBackupZipOffThread`, `parseExternalImportOffThread`, `buildImporterWorkerSnapshot` — *Worker client strips base64 images before cloning snapshots and falls back gracefully when `Worker` is unavailable.*
- `src/hooks/useBarnStore.ts` must contain `loadAnimalPhotoDataUrl`, `hydrateSnapshotForExport`, `buildCompleteBackupZipToOpfsTmpOffThread` — *Store loads lightweight snapshots, caches hydrated photos, hydrates rolling/export snapshots, and streams off-thread ZIP archives via OPFS /tmp.*
- `src/components/AnimalPhotoGallery.tsx` must contain `onLoadFullPhoto`, `activePhotoSrc` — *Photo gallery and lightbox fetch full-resolution images lazily while displaying thumbnails immediately.*
- `src/components/ExternalImporterPanel.tsx` must contain `parseExternalImportOffThread`, `isParsingArchive` — *External importer unpacks and parses staged archives asynchronously off-thread with request sequencing.*
- `src/hooks/barnStore/usePhotoCache.ts` must contain `BoundedPhotoDataCache`, `loadAnimalPhotoDataUrlWith` — *The bounded photo cache and its loaders now live in the barn-store photo slice; losing them there would silently disable on-demand full-resolution hydration.*

**Restoration Playbook if Overwritten:**
1. Keep `BoundedPhotoDataCache` and `hydrateSnapshotWithPhotoDataUrls` in `src/storage/photoHydration.ts` plus `lightweightPhotos` guards in `src/storage/webSqliteAdapter.ts`.
2. Keep `archiveAndImport.worker.ts` and `offThreadWorkerClient.ts` wired into `useBarnStore.ts`, `SettingsAndSyncScreen.tsx`, `DiagnosticsAndSupportPanel.tsx`, and `ExternalImporterPanel.tsx`.
3. Keep `onLoadFullPhoto` / `onHydrateSnapshotForExport` props wired from `App.tsx` to galleries, pedigree print modals, Barn Binders, and backup exports.

### IMP-018: Hybrid OPFS Storage Vault, Archived Herds, Wiped-Storage Recovery & IDB Migration Guard

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Backups & Safety (`backup-safety`)
- **Origin:** Session Improvement
- **User Goal:** Isolate temporary exports in OPFS /tmp, unify automated + manual backup vaults in OPFS /backups with IDB fallback, offload Sold/Deceased stock to OPFS /archives while preserving ancestor pedigree stubs, pause on wiped browser storage with restore recovery, and dump raw stores before resetting failed IndexedDB migrations.
- **Summary:** Adds pure TS schema v6 envelopes, SHA-256 verification, legacy migration, and .archive.zip bundling in `backupVault.ts`; manages OPFS `/tmp`, `/backups` (retention 6 monthly / 3 pre-upgrade / 8 pre-reset), `/archives`, boot orphan sweeps, QuotaExceededError recovery, idle Export Canary, prior-use sentinel, and IndexedDB rescue dumps in `opfsStorage.ts`; and mounts UnifiedBackupVaultPanel, ArchivedHerdsModal, WipedStorageRecoveryModal, and 1-click Save to Vault banner.
- **Tracked Files:** `src/domain/backupVault.ts`, `src/storage/opfsStorage.ts`, `src/storage/webSqliteAdapter.ts`, `src/hooks/useBarnStore.ts`, `src/components/UnifiedBackupVaultPanel.tsx`, `src/components/ArchivedHerdsModal.tsx`, `src/components/WipedStorageRecoveryModal.tsx`, `src/App.tsx`, `src/domain/__tests__/backupVault.test.ts`, `src/storage/__tests__/opfsStorage.test.ts`

**Automated Invariants Checked:**
- `src/domain/backupVault.ts` must contain `CURRENT_BACKUP_SCHEMA_VERSION`, `migrateAndValidateBackupEnvelope`, `buildExportCanaryProbe`, `buildArchivedAnimalsBundle` — *Pure TypeScript OPFS vault envelopes, schema migration, canary verification, and pedigree-stub-safe archive bundling must remain intact.*
- `src/storage/opfsStorage.ts` must contain `sweepOrphanedOpfsTmpOnBoot`, `saveOpfsVaultBackup`, `saveOpfsHerdArchive`, `detectReturningUserWipedStorage`, `dumpIndexedDbDatabaseToOpfs` — *OPFS `/tmp`, `/backups`, `/archives` persistence, boot sweeps, QuotaExceededError retries, wiped detection, and IDB rescue dumps must stay wired.*
- `src/storage/webSqliteAdapter.ts` must contain `allowSeedFresh`, `detectReturningUserWipedStorage`, `markPriorUseSentinelFromSnapshot`, `pre_upgrade` — *SQLite adapter must pause sample seeding on wiped returning storage, create pre-upgrade snapshots, and update prior-use sentinels.*
- `src/hooks/useBarnStore.ts` must contain `wipedRecoveryContext`, `opfsVaultBackups`, `archivedHerdBundles`, `offloadAnimalsToOpfsArchive`, `runOpfsExportCanary` — *Barn store must orchestrate unified OPFS/IDB vault actions, archive offload/restore, idle canary checks, and wiped-storage recovery.*
- `src/components/UnifiedBackupVaultPanel.tsx` must contain `UnifiedBackupVaultPanel`, `onRestoreOpfsBackup`, `onRestoreRollingBackup` — *Settings UI must unify OPFS vault backups and IndexedDB rolling snapshots in one clean recovery panel.*
- `src/components/ArchivedHerdsModal.tsx` must contain `ArchivedHerdsModal`, `autoOffloadRetiredToOpfs`, `onRestoreArchive` — *Archived Herds modal must support searching, downloading, deleting, and restoring offloaded Sold/Deceased bundles.*
- `src/components/WipedStorageRecoveryModal.tsx` must contain `WipedStorageRecoveryModal`, `onRestoreLatestOpfs`, `onStartFresh` — *Blocking wiped-storage recovery dialog must offer latest OPFS restore, local file upload, and explicit two-step Start Fresh.*
- `src/App.tsx` must contain `<WipedStorageRecoveryModal`, `store.exportCanaryWarning`, `Save to Vault` — *App shell must mount WipedStorageRecoveryModal, Export Canary alerts, and 1-click Save to Vault on backup banners.*

**Restoration Playbook if Overwritten:**
1. Keep `src/domain/backupVault.ts` pure TypeScript with schema v6 migration, SHA-256 verification, and `computePedigreeReferencedIds` stub preservation.
2. Keep `src/storage/opfsStorage.ts` managing `/tmp`, `/backups`, `/archives`, `try/finally` `.close()`, boot sweeps, canary checks, and IDB failure dumps.
3. Keep `UnifiedBackupVaultPanel.tsx`, `ArchivedHerdsModal.tsx`, `WipedStorageRecoveryModal.tsx`, `useBarnStore.ts`, and `App.tsx` connected.

### IMP-019: ES2018 Compatibility Build, Crash-Loop Circuit Breaker, Manual SW Update & Graceful Fallbacks

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Support 2018+ browsers gracefully without polyfill bloat, break reload/crash loops cleanly, defer PWA updates while editing, offer low-memory DB-only exports, and keep unavailable controls visible with explanation text.
- **Summary:** Downlevels TS/Vite build to ES2018 (2018+ devices: Chrome 68+/Safari 12+/Firefox 63+/Edge 79+) with minimal zero-bloat shims, runs an ES5 pre-flight + 3-in-60s crash-loop circuit breaker & ?emergency_reset=true hatch in index.html, switches SW updates to a manual prompt gate with controllerchange handshake and open-modal deferral, offers lightweight Database-Only .JSON backups on Tier 1/2, windows large report/care-log lists, and keeps unsupported optional controls visible with clear disabled reasons.
- **Tracked Files:** `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/utils/es2018Shims.ts`, `src/storage/pwaUpdateManager.ts`, `src/domain/deviceCapability.ts`, `src/storage/deviceCapabilityDetector.ts`, `src/utils/webFileActions.ts`, `src/components/UnifiedBackupVaultPanel.tsx`, `src/components/ImportExportHubScreen.tsx`, `src/components/SettingsAndSyncScreen.tsx`, `src/components/PrintPreviewModal.tsx`, `src/App.tsx`

**Automated Invariants Checked:**
- `vite.config.ts` must contain `es2018`, `safari12`, `cssTarget`, `registerType: 'prompt'` — *Vite build must target ES2018 / Safari 12+ (2018+ browsers) with manual prompt SW activation.*
- `index.html` must contain `__PEDIGREE_PREFLIGHT__`, `pedigree-preflight-guard`, `__PEDIGREE_BOOT_OK__`, `emergency_reset=true`, `__PEDIGREE_RECORD_BOOT_CRASH__` — *ES5 pre-flight guard, 3-in-60s crash-loop circuit breaker, and ?emergency_reset=true recovery hatch must remain intact.*
- `src/utils/es2018Shims.ts` must contain `ensureEs2018Globals`, `allSettled`, `fromEntries` — *Zero-bloat ES2018 runtime shims prevent missing globalThis/allSettled/fromEntries crashes on 2018 browsers.*
- `src/storage/pwaUpdateManager.ts` must contain `usePwaUpdateStatus`, `controllerchange`, `applyPwaUpdateNow` — *Manual Service Worker update gate and single-reload controllerchange handshake must remain intact.*
- `src/domain/deviceCapability.ts` must contain `assessBrowserCompatibility`, `getHeavyZipExportGate` — *Pure TypeScript browser compatibility classifier and Tier 1/outdated ZIP caution gate must remain intact.*
- `src/utils/webFileActions.ts` must contain `copyTextWithFallback` — *Clipboard fallback for restricted/older browser contexts must remain available.*
- `src/components/ImportExportHubScreen.tsx` must contain `pendingHeavyZipExport`, `heavyZipGate`, `handleDownloadDatabaseOnlyBackup` — *Heavy .ZIP exports must warn Tier 1/outdated browsers and offer Database-Only .JSON fallback without photo hydration.*

**Restoration Playbook if Overwritten:**
1. Keep ES2018 target in `tsconfig.json` and `vite.config.ts` (`safari12`, `registerType: "prompt"`) plus ES5 guard, circuit breaker, and `?emergency_reset=true` in `index.html`.
2. Keep `src/utils/es2018Shims.ts` imported first in `src/main.tsx` alongside `src/storage/pwaUpdateManager.ts`.
3. Keep `assessBrowserCompatibility` and `getHeavyZipExportGate` in `src/domain/deviceCapability.ts` and hook probes in `src/storage/deviceCapabilityDetector.ts`.
4. Keep disabled-with-reason UI controls (`Share .HTM` in `PrintPreviewModal.tsx`, Storage Vault, Import/Export Hub, Settings), Database-Only `.JSON` export, table/care-log windowing, and open-dialog PWA update deferral in `App.tsx`.

### IMP-020: Mobile Background Freeze Pause/Resume, Double-Submit Guards & Async Error Toast

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Prevent mid-batch IndexedDB corruption on iOS/Android background freeze, stop rapid-tap duplicate submits while holding unsaved form notes on write failures, and surface gentle non-blocking recovery toasts for uncaught async errors.
- **Summary:** Cooperatively pauses & checkpoints active Folder Sync / idle vault tasks on mobile background freeze (`visibilityState === "hidden"`), auto-resumes clean pauses on foreground return while keeping severity/permission faults sticky, adds bounded `sessionStorage` emergency crash traces (`pedigree_emergency_trace_v1`) + deduplicated `AsyncErrorToastHost` notifications for uncaught rejections/persistence errors, serializes `useBarnStore` mutations via a FIFO write queue (`enqueueStoreMutation`), and enforces synchronous `ref` + React submit locks (`useAsyncSubmitLock`, `useAsyncKeyedLock`) across primary forms, sync actions, and inline toggles.
- **Tracked Files:** `src/storage/backgroundFreezeCoordinator.ts`, `src/storage/crashLogger.ts`, `src/storage/localSyncChannels.ts`, `src/utils/useAsyncSubmitLock.ts`, `src/hooks/useBarnStore.ts`, `src/components/AsyncErrorToastHost.tsx`, `src/components/AnimalEditorModal.tsx`, `src/components/BreedingScreen.tsx`, `src/components/HerdScreen.tsx`, `src/components/SpeciesDashboardScreen.tsx`, `src/components/SpeciesEditorModal.tsx`, `src/components/SettingsAndSyncScreen.tsx`, `src/components/DiagnosticsAndSupportPanel.tsx`, `src/App.tsx`, `src/utils/__tests__/asyncSubmitLock.test.ts`, `src/storage/__tests__/backgroundFreezeAndToast.test.ts`

**Automated Invariants Checked:**
- `src/storage/backgroundFreezeCoordinator.ts` must contain `BackgroundPausedError`, `notifyBackgroundTransition`, `registerPausedBackgroundJob`, `registerFreezeLifecycleListener` — *Single-source background freeze coordinator must manage cooperative pauses, auto-resume clean tasks, and hold severity tasks until acknowledged.*
- `src/storage/crashLogger.ts` must contain `EMERGENCY_SESSION_TRACE_KEY`, `emitAsyncErrorToast`, `handleUnhandledRejectionReason`, `notifyBackgroundTransition` — *Uncaught rejections and QuotaExceeded writes must fall back to bounded sessionStorage emergency traces and emit deduplicated non-blocking error toasts.*
- `src/storage/localSyncChannels.ts` must contain `withSyncIdb`, `sync_checkpoints`, `BackgroundPausedError`, `resumePersistedDirectorySyncIfGranted` — *Folder Sync must close IDB handles deterministically on abort, checkpoint progress on hide, and support foreground resume.*
- `src/utils/useAsyncSubmitLock.ts` must contain `createAsyncLockController`, `createAsyncKeyedLockController`, `useAsyncSubmitLock`, `useAsyncKeyedLock` — *Synchronous ref-based double-submit locks must gate same-frame double taps and always unlock in finally.*
- `src/hooks/useBarnStore.ts` must contain `enqueueStoreMutation`, `registerFreezeLifecycleListener`, `emitAsyncErrorToast` — *Store mutations must run sequentially without interleaving outbox/SQLite writes and surface storage errors without dropping typed form inputs.*
- `src/components/AsyncErrorToastHost.tsx` must contain `subscribeAsyncErrorToasts`, `subscribePausedBackgroundJobs`, `Tap to Resume` — *Global non-blocking toast stack must render auto-dismissing minor notices, sticky error alerts, and severity-only Tap to Resume controls.*
- `src/components/AnimalEditorModal.tsx` must contain `useAsyncSubmitLock` — *Animal editor modal Save/Delete actions must prevent rapid double-tap duplicate animals.*
- `src/components/BreedingScreen.tsx` must contain `breedingSubmitLock`, `outcomeSubmitLock` — *Breeding Log and Outcome forms must block rapid double-submits and hold entered fields on storage error.*
- `src/components/HerdScreen.tsx` must contain `careLogSubmitLock`, `inlineAnimalLock` — *Care log form and inline quick animal actions must prevent duplicate writes cleanly.*
- `src/components/SpeciesDashboardScreen.tsx` must contain `taskSubmitLock`, `taskToggleLock` — *Species hub chore/cage/show forms and silent per-row chore toggles must prevent rapid double-tap races.*

**Restoration Playbook if Overwritten:**
1. Restore `src/storage/backgroundFreezeCoordinator.ts` and hook `notifyBackgroundTransition` inside `src/storage/crashLogger.ts`.
2. Preserve `writeEmergencySessionTraceSync`, `emitAsyncErrorToast`, and `handleUnhandledRejectionReason` in `src/storage/crashLogger.ts` and mount `<AsyncErrorToastHost />` in `src/App.tsx`.
3. Keep `withSyncIdb`, `sync_checkpoints` (IDB v3), `BackgroundPausedError`, and `resumePersistedDirectorySyncIfGranted` in `src/storage/localSyncChannels.ts` wired into `SettingsAndSyncScreen.tsx`.
4. Keep `enqueueStoreMutation` + boolean/id Promise returns in `src/hooks/useBarnStore.ts` and `useAsyncSubmitLock` / `useAsyncKeyedLock` guards in `App.tsx`, `AnimalEditorModal.tsx`, `BreedingScreen.tsx`, `HerdScreen.tsx`, `SpeciesDashboardScreen.tsx`, `SpeciesEditorModal.tsx`, `SettingsAndSyncScreen.tsx`, and `DiagnosticsAndSupportPanel.tsx`.

### IMP-021: ARIA Combobox Navigation, Reports/Settings Shortcuts, Focus Polish & rAF Observer Optimization

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Restore and strengthen keyboard shortcuts, tab stops, ARIA combobox navigation, and focus indicators while cleaning up minor export and DOM observer inefficiencies.
- **Summary:** Adds full WAI-ARIA keyboard navigation (`stepEnabledComboboxIndex`, `aria-activedescendant`, `ArrowDown`/`ArrowUp`/`Home`/`End`/`Enter`/`Escape`, `scrollIntoView`, and blur boundary closing) across `CarrierTraitCombobox`, `SearchableParentPicker`, and `ExternalImporterPanel`; adds `O` (Reports) and `S` (Import & Settings) global shortcuts with IME/widget guards and synchronized help panels; restores visible focus rings and pedigree focus scrolling; coalesces `App.tsx` modal `MutationObserver` via `requestAnimationFrame`; and aligns `buildPdfReadyBarnSnapshot` carrier disclosures.
- **Tracked Files:** `src/utils/comboboxNav.ts`, `src/utils/__tests__/comboboxNav.test.ts`, `src/components/CarrierTraitCombobox.tsx`, `src/components/SearchableParentPicker.tsx`, `src/components/ExternalImporterPanel.tsx`, `src/App.tsx`, `src/components/SettingsAndSyncScreen.tsx`, `src/components/HomeSpeciesScreen.tsx`, `src/components/AnimalPhotoGallery.tsx`, `src/components/PedigreeScreen.tsx`, `src/components/HerdScreen.tsx`, `src/components/SpeciesMemoScreen.tsx`, `src/domain/syncAndExports.ts`

**Automated Invariants Checked:**
- `src/utils/comboboxNav.ts` must contain `clampComboboxIndex`, `stepEnabledComboboxIndex` — *Pure combobox index-stepping helper powers keyboard traversal across all custom listboxes.*
- `src/components/CarrierTraitCombobox.tsx` must contain `aria-activedescendant`, `stepEnabledComboboxIndex` — *Carrier trait combobox must expose aria-activedescendant and full keyboard navigation.*
- `src/components/SearchableParentPicker.tsx` must contain `aria-activedescendant`, `stepEnabledComboboxIndex` — *Searchable parent picker must expose aria-activedescendant and full keyboard navigation.*
- `src/components/ExternalImporterPanel.tsx` must contain `aria-activedescendant`, `stepEnabledComboboxIndex`, `speciesOptionRefs` — *Default species combobox must support keyboard traversal and close on focus blur.*
- `src/App.tsx` must contain `subscribeOpenDialogCount`, `o: { route: 'reports', label: 'Reports' }`, `i: { route: 'importExport', label: 'Import / Export Hub' }`, `s: { route: 'settings', label: 'Settings' }`, `e.isComposing` — *Root shell tracks open dialogs via subscribeOpenDialogCount (superseding rAF MutationObserver in IMP-052) and guards O/I/S/H/D/R/B/P/? shortcuts cleanly.*
- `src/domain/syncAndExports.ts` must contain `includeCleared: true,
          includeLineage: true` — *PDF snapshot DTO exports must include cleared and ancestral lineage carrier disclosures.*

**Restoration Playbook if Overwritten:**
1. Keep `src/utils/comboboxNav.ts` wired into `CarrierTraitCombobox.tsx`, `SearchableParentPicker.tsx`, and `ExternalImporterPanel.tsx` with `aria-activedescendant` and `onBlur`.
2. Keep `subscribeOpenDialogCount` dialog tracking, IME/widget guards, and `O`/`S` shortcuts in `src/App.tsx` synced with `SettingsAndSyncScreen.tsx`.
3. Preserve `focus-visible` outlines (`HomeSpeciesScreen.tsx`, `PedigreeScreen.tsx`, `AnimalPhotoGallery.tsx`), `WeightTrendSvg` ARIA labels (`HerdScreen.tsx`), `aria-pressed` (`SpeciesMemoScreen.tsx`), and `buildPdfReadyBarnSnapshot` carrier options (`syncAndExports.ts`).

### IMP-022: Virtualized Pedigree Branch Loading, PWA Update Governor, Offline Probe & Upgrade Gate

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Keep pedigree SVG/DOM light on mobile devices, prevent unwanted or revoked app-shell reloads during active barn sessions, separate app offline holding from device Airplane Mode, and require verified backups on multi-version schema jumps.
- **Summary:** Bounds collapsed 4–6 generation pedigree chart DOM to Gen 0–3 (15 slots max) via lazy per-branch Gen 4+ expansion (`buildPedigreeBranchViewport`) while preserving full-depth `.HTM`/Barn Binder printouts; decouples PWA updates from raw `navigator.onLine` using `auto`/`notify`/`pinned` policy governance, a Manual App Offline toggle, and a timed `AbortController` captive-portal connectivity probe; and serves uncached `version.json`/`status.json` manifests with pre-upgrade SHA-256 backup verification and Safe-Harbor reset gates.
- **Tracked Files:** `src/domain/pedigreeCalculator.ts`, `src/domain/upgradeGate.ts`, `src/domain/backupVault.ts`, `src/components/PedigreeScreen.tsx`, `src/storage/pwaUpdateManager.ts`, `src/storage/storageProtection.ts`, `src/hooks/useBarnStore.ts`, `src/components/SettingsAndSyncScreen.tsx`, `src/App.tsx`, `public/version.json`, `public/status.json`, `vite.config.ts`, `src/domain/__tests__/upgradeGate.test.ts`, `src/domain/__tests__/pedigreeCalculator.test.ts`, `src/storage/__tests__/es2018AndPwaUpdate.test.ts`

**Automated Invariants Checked:**
- `src/domain/pedigreeCalculator.ts` must contain `buildPedigreeBranchViewport`, `getGen3BranchesWithKnownAncestors` — *Pure branch viewport helper keeps initial 4–6 gen DOM compact while preserving full-depth export slots.*
- `src/components/PedigreeScreen.tsx` must contain `expandedGen3Branches`, `buildPedigreeBranchViewport` — *Interactive pedigree chart must lazy-expand Gen 4+ branches on demand without losing focus or keyboard access.*
- `src/domain/upgradeGate.ts` must contain `evaluateUpgradeGate`, `parseVersionManifestJson`, `parseStatusManifestJson` — *Pure pre-flight Upgrade Gate evaluates revoked builds, paused updates, Safe-Harbor schema floors, and schemaDelta>=2 backup gates.*
- `src/domain/backupVault.ts` must contain `buildVerifiedPreUpgradeJsonBackup`, `verifyPreUpgradeJsonBackup` — *Pre-upgrade safety backups must emit _schemaVersion-stamped envelopes and verify SHA-256 round-trip integrity.*
- `src/storage/pwaUpdateManager.ts` must contain `pedigree_pwa_update_policy_v1`, `fetchUpgradeGateDecision` — *PWA updater enforces persisted auto/notify/pinned policies and uncached Upgrade Gate checks before posting SKIP_WAITING.*
- `src/storage/storageProtection.ts` must contain `pedigree_manual_offline_v1`, `probeNetworkConnectivity` — *Connectivity governor combines Manual App Offline Mode with a timed AbortController captive-portal probe.*
- `public/version.json` must contain `minDirectUpgradeSchema` — *Release version manifest must expose current appVersion, schemaVersion, and minDirectUpgradeSchema floor.*
- `public/status.json` must contain `revokedVersions` — *Remote killswitch manifest must expose allowUpdates and revokedVersions lists.*
- `vite.config.ts` must contain `navigateFallbackDenylist: [/^\/api\//, /\/version\.json$/, /\/status\.json$/]` — *Service worker navigation fallback must never intercept or precache uncached version.json / status.json manifests on root or subpaths.*

**Restoration Playbook if Overwritten:**
1. Keep `buildPedigreeBranchViewport`, `getGen3BranchIndex`, and `getGen3BranchesWithKnownAncestors` in `src/domain/pedigreeCalculator.ts` wired into `PedigreeScreen.tsx`.
2. Preserve `src/domain/upgradeGate.ts`, `buildVerifiedPreUpgradeJsonBackup` / `verifyPreUpgradeJsonBackup` in `src/domain/backupVault.ts`, and uncached `public/version.json` & `public/status.json` with `no-store` middleware + Workbox denylist in `vite.config.ts`.
3. Keep `PwaUpdatePolicy` (`auto` / `notify` / `pinned`) + `fetchUpgradeGateDecision` in `src/storage/pwaUpdateManager.ts`, `setManualOfflineMode` + `probeNetworkConnectivity` in `src/storage/storageProtection.ts`, and UI controls in `App.tsx`, `useBarnStore.ts`, and `SettingsAndSyncScreen.tsx`.

### IMP-023: Storage Pruning, Pre-Restore Archive Inspector, Clock-Skew Compensation, Monotonic _rev & Encrypted Backups

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Backups & Safety (`backup-safety`)
- **Origin:** Session Improvement
- **User Goal:** Prevent runaway photo quota growth, inspect backups for species/conflicts before committing restores, protect multi-device sync order against wrong or rewound clocks, avoid duplicate Google Calendar events, and offer opt-in passphrase encryption for shared archives/sync folders.
- **Summary:** Adds a Diagnostics Photo Storage & Orphan Attachment Pruner (`photoMaintenance.ts`, `reoptimizeAnimalPhotoRecord`), an off-thread Pre-Restore Archive Inspector dry-run for `.ZIP`/`.JSON`/`.SQLITE` (`archiveInspector.ts`, `inspectRawSqliteBytes`), persistent HTTP `Date` clock-skew compensation (`recordServerDateHeaderSkew`, `getAdjustedNowIsoUtc`) with a non-blocking drift banner, per-record monotonic `_rev` counters (`compareSameEntitySyncOperations`, `bumpRecordRevision`) paired with deterministic `[a-v0-9]` Google Calendar IDs + `409` `PUT` updates, and optional PBKDF2-SHA256 + AES-256-GCM passphrase encryption for shared backups and SyncThing deltas (`encryptedExport.ts`, `passphraseCrypto.ts`) while keeping plain 1-click exports as the default.
- **Tracked Files:** `src/domain/photoMaintenance.ts`, `src/domain/archiveInspector.ts`, `src/domain/encryptedExport.ts`, `src/domain/syncOutbox.ts`, `src/domain/calendarExport.ts`, `src/domain/models.ts`, `src/domain/inputSanitization.ts`, `src/storage/passphraseCrypto.ts`, `src/storage/storageProtection.ts`, `src/storage/localSyncChannels.ts`, `src/storage/offThreadWorkerClient.ts`, `src/storage/archiveAndImport.worker.ts`, `src/storage/webImageOptimizer.ts`, `src/storage/webSqliteAdapter.ts`, `src/utils/googleCalendarClient.ts`, `src/hooks/useBarnStore.ts`, `src/components/DiagnosticsAndSupportPanel.tsx`, `src/components/ImportExportHubScreen.tsx`, `src/components/SettingsAndSyncScreen.tsx`, `src/App.tsx`, `src/domain/__tests__/stageBResilience.test.ts`, `src/storage/__tests__/passphraseAndClockSkew.test.ts`

**Automated Invariants Checked:**
- `src/domain/photoMaintenance.ts` must contain `analyzePhotoStorageFootprintPure`, `removeOrphanPhotosFromSnapshotPure`, `pruneFullResPayloadsFromSnapshotPure` — *Pure photo storage footprint analyzer, orphan cleaner, and thumbnail compactor must stay DOM-free.*
- `src/domain/archiveInspector.ts` must contain `inspectSnapshotBeforeRestorePure`, `inspectParsedArchiveBeforeRestorePure` — *Dry-run pre-restore inspector summarizes species, conflicts, and replace/merge impact before DB writes.*
- `src/domain/encryptedExport.ts` must contain `ENCRYPTED_ENVELOPE_FORMAT`, `wrapEncryptedZipContainer`, `tryExtractEncryptedEnvelopeFromZip` — *Pure encrypted envelope framing and ZIP wrapper/extractor must remain intact.*
- `src/storage/passphraseCrypto.ts` must contain `encryptBytesWithPassphrase`, `decryptBytesWithPassphrase` — *Client-side PBKDF2-SHA256 + AES-256-GCM encryption runs strictly with memory-only passphrases.*
- `src/storage/storageProtection.ts` must contain `recordServerDateHeaderSkew`, `getAdjustedNowIsoUtc`, `clockDriftWarning` — *Server Date skew capture compensates timestamps and flags drift >= 5 minutes cleanly.*
- `src/domain/syncOutbox.ts` must contain `compareSameEntitySyncOperations`, `bumpRecordRevision` — *Monotonic record_rev ensures newer same-entity edits win even when a device clock rewinds.*
- `src/domain/calendarExport.ts` must contain `buildDeterministicGoogleCalendarEventId` — *Deterministic [a-v0-9] Google Calendar IDs prevent duplicate calendar events on retry/sync.*
- `src/utils/googleCalendarClient.ts` must contain `res.status === 409` — *Google Calendar push must update existing events via PUT when deterministic ID returns HTTP 409.*
- `src/components/ImportExportHubScreen.tsx` must contain `pendingRestoreInspection`, `encryptBackupExport` — *Import/Export Hub must require Pre-Restore Inspector confirmation and expose opt-in backup/sync encryption.*
- `src/components/DiagnosticsAndSupportPanel.tsx` must contain `onAnalyzePhotoFootprint`, `onPruneOrphanPhotos` — *Diagnostics exposes Photo Storage & Orphan Attachment Pruner actions safely.*
- `src/App.tsx` must contain `connectivity.clockDriftWarning` — *Root shell renders non-blocking Clock Drift Nudge Banner when drift reaches threshold.*

**Restoration Playbook if Overwritten:**
1. Keep pure modules `src/domain/photoMaintenance.ts`, `src/domain/archiveInspector.ts`, `src/domain/encryptedExport.ts`, `_rev` logic in `src/domain/syncOutbox.ts`, and `buildDeterministicGoogleCalendarEventId` in `src/domain/calendarExport.ts`.
2. Keep `src/storage/passphraseCrypto.ts`, clock-skew compensation in `src/storage/storageProtection.ts`, encrypted delta/directory sync in `src/storage/localSyncChannels.ts`, off-thread inspection in `src/storage/offThreadWorkerClient.ts`, and `inspectRawSqliteBytes` in `src/storage/webSqliteAdapter.ts`.
3. Keep Stage B store handlers in `src/hooks/useBarnStore.ts`, `409` PUT retry in `src/utils/googleCalendarClient.ts`, and UI mounts in `DiagnosticsAndSupportPanel.tsx`, `ImportExportHubScreen.tsx`, and `App.tsx`.

### IMP-024: Active Medication Withdrawal Countdown & Livestock Safety Alerts

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Home & Alerts (`alerts-home`)
- **Origin:** Session Improvement
- **User Goal:** Surface active care-log withdrawal periods on Herd cards and Home alerts and trigger soft confirmation warnings before marking an animal under active withdrawal for sale, meat/cull processing, or show exhibition.
- **Summary:** Surfaces active CareLog medication withdrawal periods (`withdrawalClearDateIso` / `dateIso + withdrawalDays`, cleared on the clear date itself) via an O(L) withdrawal map across Home species cards (session-closable), Herd roster rows, single-animal profiles, and Withdrawal filter/sort controls, and triggers non-blocking soft confirmation warnings before saving Sold/Culled dispositions or Show entries whose event date overlaps withdrawal.
- **Tracked Files:** `src/domain/barnAlerts.ts`, `src/domain/__tests__/barnAlerts.test.ts`, `src/components/HomeSpeciesScreen.tsx`, `src/components/HerdScreen.tsx`, `src/components/AnimalEditorModal.tsx`, `src/components/SpeciesDashboardScreen.tsx`, `src/App.tsx`

**Automated Invariants Checked:**
- `src/domain/barnAlerts.ts` must contain `buildWithdrawalByAnimalMap`, `evaluateSpeciesActiveWithdrawalsAlert`, `evaluateWithdrawalDispositionWarning`, `evaluateShowWithdrawalConflicts` — *Pure withdrawal countdown evaluator and safety conflict helpers must remain intact and DOM-free.*
- `src/components/HomeSpeciesScreen.tsx` must contain `evaluateSpeciesActiveWithdrawalsAlert`, `onDismissWithdrawalAlert` — *Home species cards must surface closable session-scoped withdrawal safety alerts.*
- `src/components/HerdScreen.tsx` must contain `buildWithdrawalByAnimalMap`, `withdrawal_soonest`, `Withdrawal (` — *HerdScreen must display active withdrawal countdowns, filter tab, sort, and profile alert banner.*
- `src/components/AnimalEditorModal.tsx` must contain `evaluateWithdrawalDispositionWarning`, `pendingWithdrawalWarning` — *AnimalEditorModal must require soft confirmation before saving Sold or Flagged-for-Cull stock under active withdrawal.*
- `src/components/SpeciesDashboardScreen.tsx` must contain `evaluateShowWithdrawalConflicts`, `pendingShowWithdrawalWarning` — *Show entry form must warn when selected animals have medication withdrawals overlapping eventDateIso.*
- `src/App.tsx` must contain `dismissedWithdrawalSpecies`, `requestedHerdWithdrawalNonce` — *Root shell tracks session-scoped Home withdrawal dismissal and Herd filter navigation.*

**Restoration Playbook if Overwritten:**
1. Keep pure withdrawal functions (`buildWithdrawalByAnimalMap`, `evaluateAnimalActiveWithdrawal`, `evaluateSpeciesActiveWithdrawalsAlert`, `evaluateWithdrawalDispositionWarning`, `evaluateShowWithdrawalConflicts`) in `src/domain/barnAlerts.ts`.
2. Keep session-scoped `dismissedWithdrawalSpecies` in `src/App.tsx` wired to `HomeSpeciesScreen.tsx` and `HerdScreen.tsx`.
3. Keep Herd withdrawal filter/sort/countdown badges in `HerdScreen.tsx` passing `animalCareLogs` into `AnimalEditorModal.tsx`, and keep show-date overlap checks in `SpeciesDashboardScreen.tsx`.

### IMP-025: Sync Outbox Alignment, Metadata-Only Photo Sync & Reset State Cleanup

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Diagnostics & Sync (`diagnostics-sync`)
- **Origin:** Session Improvement
- **User Goal:** Align Folder/Delta Sync outbox mutations for photo actions and cross-species migrations while guaranteeing stale P2P sync queues, conflict logs, and backup reminders never leak across factory resets or full Replace restores.
- **Summary:** Queues metadata-only photo operations (stripping image blobs so large photos travel exclusively via .ZIP backups) and full cross-species migration snapshot diffs with bumped `_rev` counters into the delta outbox, hydrates missing blobs onto metadata-only photo placeholders during .ZIP/.JSON merges without clobbering newer edits, guards UI galleries against empty image URLs, and wipes `sync_outbox`, `sync_conflicts`, `sync_checkpoints`, plus backup reminder keys (`pedigree.lastBackupMeta.v1`, `pedigree.backupReminderSnoozedUntil.v1`) on factory resets and full Replace restores.
- **Tracked Files:** `src/domain/syncOutbox.ts`, `src/domain/speciesMigration.ts`, `src/domain/backupArchive.ts`, `src/domain/syncAndExports.ts`, `src/hooks/useBarnStore.ts`, `src/components/AnimalPhotoGallery.tsx`, `src/components/HerdScreen.tsx`, `src/domain/__tests__/stageBResilience.test.ts`, `src/storage/__tests__/crossTabLockAndReload.test.ts`

**Automated Invariants Checked:**
- `src/domain/syncOutbox.ts` must contain `stripPhotoBlobsForSync`, `diffSnapshotsToSyncOperations` — *Sync outbox must strip binary blobs on photo creates and support snapshot diffing for bulk migrations.*
- `src/domain/speciesMigration.ts` must contain `bumpRecordRevision` — *Cross-species migration must advance `_rev` counters on every migrated or created record.*
- `src/domain/backupArchive.ts` must contain `existingHasBlob`, `incHasBlob` — *Photos-Only ZIP merge must hydrate blobs onto metadata-only photo placeholders without overwriting newer metadata.*
- `src/domain/syncAndExports.ts` must contain `mergeAnimalPhotosWithBlobPreservation` — *Barn snapshot merges must rehydrate blobs onto metadata-only photos without losing existing local blobs.*
- `src/hooks/useBarnStore.ts` must contain `clearLocalSyncAndBackupReminderState`, `clearAllSyncStateInIdb`, `stripPhotoBlobsForSync`, `diffSnapshotsToSyncOperations` — *Store must clear sync/backup-reminder state on resets/replaces and enqueue metadata-only photo & migration outbox ops.*
- `src/components/AnimalPhotoGallery.tsx` must contain `p.thumbnailDataUrl || p.dataUrl` — *Photo gallery must avoid rendering broken <img src=""> tags for metadata-only synced photo placeholders.*

**Restoration Playbook if Overwritten:**
1. Keep `stripPhotoBlobsForSync`, `diffSnapshotsToSyncOperations`, and metadata-only `photo` `__create__` handling in `src/domain/syncOutbox.ts`.
2. Keep `bumpRecordRevision` calls in `src/domain/speciesMigration.ts` and blob-preserving merge helpers in `src/domain/backupArchive.ts` and `src/domain/syncAndExports.ts`.
3. Keep `clearLocalSyncAndBackupReminderState` wired across resets and Replace restores plus metadata-only photo/migration outbox emissions in `src/hooks/useBarnStore.ts`, and keep empty-src placeholders in `AnimalPhotoGallery.tsx` and `HerdScreen.tsx`.

### IMP-026: Clock-Skew Consistency & Archive Export Double-Tap Locks

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Backups & Safety (`backup-safety`)
- **Origin:** Session Improvement
- **User Goal:** Enforce clock-skew compensation consistently across upgrade checks and Settings timestamps while eliminating the <16ms double-tap race on heavy archive and backup exports.
- **Summary:** Aligns upgrade-gate HTTP Date skew capture (`recordServerDateHeaderSkew`), core `nowEpochMs()` fallback defaults, and Settings folder/background pause timestamps (`getAdjustedNowMs()`) when device clocks drift, and guards all 4 backup/archive exports (`handleDownloadTimestampedFullBackup`, `handleDownloadDatabaseOnlyBackup`, `handleDownloadCompleteZip`, `handleDownloadPhotosOnlyZip`) plus heavy-ZIP caution and reset backup buttons with synchronous `archiveExportLock` (`useAsyncSubmitLock`).
- **Tracked Files:** `src/domain/upgradeGate.ts`, `src/storage/pwaUpdateManager.ts`, `src/components/ImportExportHubScreen.tsx`, `src/components/SettingsAndSyncScreen.tsx`, `src/storage/__tests__/passphraseAndClockSkew.test.ts`

**Automated Invariants Checked:**
- `src/domain/upgradeGate.ts` must contain `nowEpochMs`, `computeHttpDateClockSkewMs` — *Upgrade-gate HTTP Date skew calculation must default to clock-skew-aware nowEpochMs().*
- `src/storage/pwaUpdateManager.ts` must contain `recordServerDateHeaderSkew`, `getAdjustedNowIsoUtc` — *Version/status manifest checks must propagate HTTP Date skew and record adjusted timestamps.*
- `src/components/ImportExportHubScreen.tsx` must contain `archiveExportLock`, `getAdjustedNowMs`, `archiveExportLock.runLocked` — *Archive/backup exports must lock synchronously against double-tap and record skew-adjusted pause timestamps.*

**Restoration Playbook if Overwritten:**
1. Keep `nowEpochMs` default inside `computeHttpDateClockSkewMs` in `src/domain/upgradeGate.ts`.
2. Keep `recordServerDateHeaderSkew` and `getAdjustedNowIsoUtc` in `src/storage/pwaUpdateManager.ts`.
3. Keep `archiveExportLock = useAsyncSubmitLock()` wrapping all 4 export handlers in `src/components/ImportExportHubScreen.tsx`, plus `getAdjustedNowMs()` for `pausedAtMs`.

### IMP-027: True Lazy 2–3 Gen SQLite/OPFS Pedigree Fetching & ES2018 Windowed List Virtualization

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Reduce mobile RAM and DOM overhead by fetching Gen 4+ / archived pedigree ancestors lazily from SQLite/OPFS and virtualizing large Breeding, Herd, and Reports lists.
- **Summary:** Keeps initial interactive pedigree charts bounded to Gen 0–3 while probing and lazily fetching Gen 4+ and OPFS `/archives` offloaded ancestors on branch expand or pre-print hydration via cycle-safe SQLite BFS (`queryPedigreeNeighborhood`, `queryPedigreeBranchAncestorsExist`) and a 256-entry LRU ancestor cache (`pedigreeAncestorCacheRef`); and replaces unbounded/static-slice lists in `BreedingScreen`, `HerdScreen`, and `ReportsScreen` with a zero-dependency ES2018 scroll window virtualizer (`useVirtualWindow`).
- **Tracked Files:** `src/utils/useVirtualWindow.ts`, `src/utils/__tests__/virtualWindow.test.ts`, `src/storage/storageAdapter.ts`, `src/storage/webSqliteAdapter.ts`, `src/storage/__tests__/pedigreeLazyFetch.test.ts`, `src/domain/pedigreeCalculator.ts`, `src/domain/__tests__/pedigreeCalculator.test.ts`, `src/hooks/useBarnStore.ts`, `src/App.tsx`, `src/components/PedigreeScreen.tsx`, `src/components/BreedingScreen.tsx`, `src/components/HerdScreen.tsx`, `src/components/ReportsScreen.tsx`

**Automated Invariants Checked:**
- `src/utils/useVirtualWindow.ts` must contain `computeVirtualWindow`, `useVirtualWindow`, `ResizeObserver` — *Zero-dependency ES2018 scroll virtualizer must remain intact with guarded ResizeObserver cleanup.*
- `src/storage/webSqliteAdapter.ts` must contain `queryPedigreeNeighborhood`, `queryPedigreeBranchAncestorsExist`, `mapAnimalRow` — *SQLite adapter must provide cycle-safe bounded BFS pedigree queries and lightweight branch-existence probes.*
- `src/hooks/useBarnStore.ts` must contain `loadPedigreeNeighborhood`, `checkPedigreeBranchesHaveAncestors`, `pedigreeAncestorCacheRef` — *Barn store must cache lazily fetched SQLite/OPFS pedigree ancestors in a bounded LRU map.*
- `src/domain/pedigreeCalculator.ts` must contain `hasKnownAncestors`, `externalKnownBranches` — *Branch summaries must surface externally detected Gen 4+ ancestors before full depth is loaded in RAM.*
- `src/components/PedigreeScreen.tsx` must contain `gen0To3BaseMap`, `fetchAndMergeBranchAncestors`, `handleOpenPrintModal` — *Pedigree screen must scope initial tree to Gen 0–3 and hydrate Gen 4+ on branch expand or print.*
- `src/components/BreedingScreen.tsx` must contain `useVirtualWindow`, `breedingVirtual`, `ledgerStatusFilter` — *Breeding & litter ledger must filter and virtualize large pairing histories cleanly.*
- `src/components/HerdScreen.tsx` must contain `useVirtualWindow`, `herdVirtual`, `HERD_PAGE_SIZE` — *Herd roster list must virtualize rows via useVirtualWindow with HERD_PAGE_SIZE pre-layout fallback.*
- `src/components/ReportsScreen.tsx` must contain `useVirtualWindow`, `reportVirtual`, `windowedRows` — *Reports table must virtualize displayed rows while exporting full filtered sets to CSV and Print.*

**Restoration Playbook if Overwritten:**
1. Keep `src/utils/useVirtualWindow.ts` and `queryPedigreeNeighborhood` / `queryPedigreeBranchAncestorsExist` in `src/storage/webSqliteAdapter.ts`.
2. Keep `loadPedigreeNeighborhood`, `checkPedigreeBranchesHaveAncestors`, and `pedigreeAncestorCacheRef` in `src/hooks/useBarnStore.ts` wired through `src/App.tsx` to `src/components/PedigreeScreen.tsx`.
3. Keep `useVirtualWindow` integration in `BreedingScreen.tsx`, `HerdScreen.tsx`, and `ReportsScreen.tsx`.

### IMP-028: Cage / Pen Capacity Warnings & Quick Occupant Assignment

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Compare current animal occupants against CageLocation.capacity (e.g., 3/2 over capacity), allow one-click occupant assignment from housing cards, and warn before exceeding capacity.
- **Summary:** Compares active, junior, and unarchived/non-offloaded retired occupants per species against `CageLocation.capacity` via pure single-pass evaluators (`evaluateCageOccupancy`, `evaluateSpeciesCagesOccupancy`, `evaluateCageAssignmentCapacityWarning`), surfaces over-capacity welfare alerts on `HomeSpeciesScreen` and `SpeciesDashboardScreen` and in printed Barn Binder housing tables (`barnBinder.ts`), adds inline cage capacity/section editing and 1-click quick occupant assignment/unassignment (`assignAnimalToCage`) on Cages & Pens cards, and displays soft confirmation warnings in both Quick Assign and `AnimalEditorModal` before exceeding capacity.
- **Tracked Files:** `src/domain/barnAlerts.ts`, `src/domain/barnBinder.ts`, `src/domain/__tests__/barnAlerts.test.ts`, `src/hooks/useBarnStore.ts`, `src/App.tsx`, `src/components/SpeciesDashboardScreen.tsx`, `src/components/AnimalEditorModal.tsx`, `src/components/HomeSpeciesScreen.tsx`

**Automated Invariants Checked:**
- `src/domain/barnAlerts.ts` must contain `isCageOccupyingAnimal`, `evaluateCageOccupancy`, `evaluateSpeciesCagesOccupancy`, `evaluateCageAssignmentCapacityWarning` — *Pure occupancy counting and capacity warning evaluation must remain in pure TS core with species isolation.*
- `src/hooks/useBarnStore.ts` must contain `assignAnimalToCage` — *Store must expose queued FIFO assignAnimalToCage mutation updating _rev and syncOutbox.*
- `src/components/SpeciesDashboardScreen.tsx` must contain `cagesOccupancySummary`, `handleQuickAssignSelect`, `pendingCageAssignConfirm`, `onAssignAnimalToCage` — *Cages & Pens cards must show occupancy ratios, quick occupant assignment/unassignment, inline edit, and over-capacity alerts.*
- `src/components/AnimalEditorModal.tsx` must contain `liveCageCapacityWarning`, `pendingCapacityWarning`, `checkCapacityThenSave` — *Animal editor must display live cage occupancy feedback and soft confirmation before saving an over-capacity assignment.*
- `src/components/HomeSpeciesScreen.tsx` must contain `evaluateSpeciesCagesOccupancy`, `shouldShowOverCapacityAlert` — *Home species cards must surface an actionable alert when any species cage exceeds capacity.*
- `src/domain/barnBinder.ts` must contain `(over capacity)` — *Printable Barn Binder cage table must show occupancy/capacity ratios and over-capacity markers.*

**Restoration Playbook if Overwritten:**
1. Keep pure cage occupancy & assignment warning evaluators in `src/domain/barnAlerts.ts` and tests in `src/domain/__tests__/barnAlerts.test.ts`.
2. Keep `assignAnimalToCage` in `src/hooks/useBarnStore.ts` passed to `<SpeciesDashboardScreen onAssignAnimalToCage={store.assignAnimalToCage} />` in `src/App.tsx`.
3. Keep live ratio displays, over-capacity alerts, quick assign/unassign, and soft capacity confirmations in `SpeciesDashboardScreen.tsx`, `AnimalEditorModal.tsx`, `HomeSpeciesScreen.tsx`, and `barnBinder.ts`.

### IMP-029: Breeding Lab & Master Task List Refinements (Post-Birth Recalculation, Quick Checkoffs & Breed Overrides)

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Recalculate post-birth tasks to the actual birth date when births arrive early or late, support one-click Palpation/Birth Check checkoffs with automatic Missed task cleanup, and allow optional per-breed gestation/weaning/milestone overrides.
- **Summary:** Adds BreedScheduleOverride support (with case-insensitive dam-first, sire-fallback resolution via resolveEffectiveSpeciesProfileForBreeding and SQLite/sync/JSON preservation), adds pure post-birth task evaluation & recalculation (evaluateStalePostBirthTasksForBreeding, recalculatePostBirthTasksForBreeding) plus pending Missed cleanup (getPendingBreedingCleanupTasks) in taskMaster.ts, exposes recalculateBreedingPostBirthTasks & completeBreedingTaskWithOutcome in useBarnStore.ts, and adds UI controls in SpeciesEditorModal, BreedingScreen, and SpeciesDashboardScreen.
- **Tracked Files:** `src/domain/models.ts`, `src/domain/taskMaster.ts`, `src/domain/__tests__/taskMaster.test.ts`, `src/storage/webSqliteAdapter.ts`, `src/domain/syncAndExports.ts`, `src/domain/syncOutbox.ts`, `src/hooks/useBarnStore.ts`, `src/App.tsx`, `src/components/SpeciesEditorModal.tsx`, `src/components/BreedingScreen.tsx`, `src/components/SpeciesDashboardScreen.tsx`

**Automated Invariants Checked:**
- `src/domain/models.ts` must contain `BreedScheduleOverride`, `normalizeBreedScheduleOverrides`, `breedOverrides` — *SpeciesProfile must carry optional BreedScheduleOverride entries normalized deterministically in pure TypeScript.*
- `src/domain/taskMaster.ts` must contain `resolveEffectiveSpeciesProfileForBreeding`, `recalculatePostBirthTasksForBreeding`, `getPendingBreedingCleanupTasks`, `isPalpationTask`, `isBirthCheckTask` — *Breed override resolution, AFTER_BIRTH task date recalculation, and Missed breeding task cleanup helpers must remain pure and reusable.*
- `src/storage/webSqliteAdapter.ts` must contain `breed_overrides_json` — *SQLite schema and migrations must persist species breedOverrides across reloads.*
- `src/hooks/useBarnStore.ts` must contain `recalculateBreedingPostBirthTasks`, `completeBreedingTaskWithOutcome` — *Store must expose queued FIFO mutations for post-birth task recalculation and one-click breeding task outcome checkoffs with cleanup.*
- `src/components/SpeciesEditorModal.tsx` must contain `Per-Breed Schedule Overrides`, `handleSaveBreedOverride` — *Species Editor must allow configuring optional per-breed gestation, weaning, rebreed, maturity, and milestone day overrides.*
- `src/components/BreedingScreen.tsx` must contain `onRecalculatePostBirthTasks`, `outcomeStalePostBirth`, `outcomeMissedCleanupCount` — *Breeding Lab must resolve breed overrides in previews, offer one-tap post-birth chore shifting, and surface automatic Missed cleanup notice.*
- `src/components/SpeciesDashboardScreen.tsx` must contain `onCompleteBreedingTask`, `isPalpationTask`, `isBirthCheckTask` — *Species Hub task list must support one-click Palpation & Birth Check checkoffs and inline post-birth chore shifting on active pairings.*

**Restoration Playbook if Overwritten:**
1. Keep BreedScheduleOverride & normalizeBreedScheduleOverrides in `src/domain/models.ts` and pure helpers in `src/domain/taskMaster.ts` with tests in `src/domain/__tests__/taskMaster.test.ts`.
2. Keep `breed_overrides_json` persisted in `src/storage/webSqliteAdapter.ts` and normalized in `src/domain/syncAndExports.ts` and `src/domain/syncOutbox.ts`.
3. Keep `recalculateBreedingPostBirthTasks` and `completeBreedingTaskWithOutcome` in `src/hooks/useBarnStore.ts` wired through `src/App.tsx` to `SpeciesDashboardScreen.tsx`, `BreedingScreen.tsx`, and `SpeciesEditorModal.tsx`.

### IMP-030: Consolidated Import/Export Hub & Extensible Non-Native Exporter Registry

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Backups & Safety (`backup-safety`)
- **Origin:** Session Improvement
- **User Goal:** Consolidate all backup, native restore, multi-worker sync, external importer, and non-native exporter tools into a clean 3-section Import/Export Hub page integrated into navigation and Settings.
- **Summary:** Adds a pure TypeScript extensible non-native exporter registry (`exporterTypes.ts`, `registry.ts`) supporting `.CSV`, Evans `.HTM`, Printable Barn Binder `.HTM`, Normalized Report DTO `.JSON`, and `.ICS` calendar tasks plus future external schema slots; introduces `ImportExportHubScreen` structured cleanly into System Backup, Imports (Native System Imports first followed by External Format Importers), and Exporters; wires `'importExport'` into `useBarnStore.ts`, `App.tsx` (desktop/mobile nav + `I` shortcut + backup banner routing), `SpeciesDashboardScreen.tsx`, `HomeSpeciesScreen.tsx`, and `SettingsAndSyncScreen.tsx`.
- **Tracked Files:** `src/domain/exporters/exporterTypes.ts`, `src/domain/exporters/registry.ts`, `src/domain/__tests__/exportersRegistry.test.ts`, `src/components/ImportExportHubScreen.tsx`, `src/hooks/useBarnStore.ts`, `src/App.tsx`, `src/components/SettingsAndSyncScreen.tsx`, `src/components/SpeciesDashboardScreen.tsx`, `src/components/HomeSpeciesScreen.tsx`

**Automated Invariants Checked:**
- `src/domain/exporters/exporterTypes.ts` must contain `ExternalExporterDescriptor`, `ExportedArtifactPayload` — *Pure TypeScript exporter interface contracts must remain DOM-free for cross-platform reuse.*
- `src/domain/exporters/registry.ts` must contain `BUILTIN_NON_NATIVE_EXPORTERS`, `PLANNED_EXTERNAL_SCHEMA_TARGETS`, `buildExporterCatalog`, `runExternalExporter` — *Non-native exporter catalog must keep built-in formats and extensible registry hooks intact.*
- `src/components/ImportExportHubScreen.tsx` must contain `ImportExportHubScreen`, `ExternalImporterPanel`, `UnifiedBackupVaultPanel`, `BUILTIN_NON_NATIVE_EXPORTERS` — *Hub screen must organize System Backup, Native & External Imports, and Exporters cleanly.*
- `src/hooks/useBarnStore.ts` must contain `| 'importExport'` — *WorkspaceRoute union must include importExport.*
- `src/App.tsx` must contain `ImportExportHubScreen`, `openImportExportHub` — *Root shell must route, lazy-load, and link banners/shortcuts cleanly to ImportExportHubScreen.*
- `src/components/SettingsAndSyncScreen.tsx` must contain `onOpenImportExportHub` — *Settings must link cleanly into all sections of the Import/Export Hub without duplicating forms.*

**Restoration Playbook if Overwritten:**
1. Restore `src/domain/exporters/exporterTypes.ts`, `src/domain/exporters/registry.ts`, and `src/domain/__tests__/exportersRegistry.test.ts`.
2. Restore `src/components/ImportExportHubScreen.tsx` and keep `importExport` inside `WorkspaceRoute` in `src/hooks/useBarnStore.ts`.
3. Keep `ImportExportHubScreen` routing, `I` shortcut, navigation buttons, and Settings/Home/Species Hub links wired across `App.tsx`, `SettingsAndSyncScreen.tsx`, `SpeciesDashboardScreen.tsx`, and `HomeSpeciesScreen.tsx`.

### IMP-031: Interactive CSV Column Mapper, Starter Template & Unlinked Parent Preview

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Provide a one-click Starter CSV Template download, interactive column-mapping preview for spreadsheets, and pre-import highlighting for unresolved Sire/Dam links on non-HerdBoss CSV imports.
- **Summary:** Adds pure TS Starter CSV Template generation (`csvStarterTemplate.ts`), unified column alias & override resolution (`csvColumnMapper.ts`), two-pass out-of-order CSV parent linking with unresolved Sire/Dam pre-import tracking in `universalPedigreeImporter.ts`, and interactive UI controls in `ExternalImporterPanel.tsx`.
- **Tracked Files:** `src/domain/importers/importerTypes.ts`, `src/domain/importers/csvStarterTemplate.ts`, `src/domain/importers/csvColumnMapper.ts`, `src/domain/importers/universalPedigreeImporter.ts`, `src/components/ExternalImporterPanel.tsx`, `src/domain/__tests__/resilienceAndUniversalImport.test.ts`

**Automated Invariants Checked:**
- `src/domain/importers/csvStarterTemplate.ts` must contain `buildStarterCsvTemplate`, `STARTER_CSV_TEMPLATE_HEADERS` — *Pure TS starter CSV template generator must remain DOM-free with standard pedigree headers.*
- `src/domain/importers/csvColumnMapper.ts` must contain `CSV_TARGET_FIELD_OPTIONS`, `resolveCsvColumnAssignments`, `makeCsvColumnOverrideKey` — *Pure TS column mapper must resolve aliases, sample cells, and user overrides cleanly.*
- `src/domain/importers/universalPedigreeImporter.ts` must contain `resolveCsvColumnAssignments`, `unresolvedParentLinks`, `csvTables` — *Universal importer must perform two-pass parent resolution and surface column mapping & unresolved Sire/Dam links.*
- `src/components/ExternalImporterPanel.tsx` must contain `Download Starter CSV Template`, `handleCsvColumnSelectionChange`, `unresolvedParentLinks` — *External importer UI must expose template download, interactive column mapping, and unresolved parent link warnings.*

**Restoration Playbook if Overwritten:**
1. Restore `src/domain/importers/csvStarterTemplate.ts` and `src/domain/importers/csvColumnMapper.ts` and keep `CsvTableMappingSummary`/`UnresolvedParentLink` in `src/domain/importers/importerTypes.ts`.
2. Keep two-pass CSV resolution and `csvColumnMapping`/`unresolvedParentLinks` wiring in `src/domain/importers/universalPedigreeImporter.ts`.
3. Keep the Starter CSV Template download button, column-mapping region, and unresolved Sire/Dam highlight card in `src/components/ExternalImporterPanel.tsx`.

### IMP-032: Low-RAM Export Streaming & Full OPFS /tmp Staging

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Backups & Safety (`backup-safety`)
- **Origin:** Session Improvement
- **User Goal:** Route all printable/shareable exports (including <512 KB .HTM pedigrees and cage cards) through OPFS /tmp with immediate post-use cleanup, and stream large .ZIP and .JSON backup chunks incrementally into OPFS /tmp without materializing monolithic JS heap buffers.
- **Summary:** Adds worker-safe `opfsTempStream.ts` (`writeTempOpfsFileStreamed`) and chunked `writeTempOpfsFile`; stages all `downloadTextFile`, `downloadBinaryFile`, `shareTextFileOrDownload`, and `shareBinaryFileOrDownload` exports through OPFS `/tmp` with immediate cleanup in `webFileActions.ts`; streams `.JSON` backup chunks via `generateBarnBackupJsonChunks` (`syncAndExports.ts`); streams `.ZIP` archives one photo and one binder at a time via `streamCompleteBackupZipArchive` & `streamPhotosOnlyZipArchive` (`backupArchive.ts`); and wires worker/UI/store callers cleanly.
- **Tracked Files:** `src/storage/opfsTempStream.ts`, `src/storage/opfsStorage.ts`, `src/domain/syncAndExports.ts`, `src/domain/backupArchive.ts`, `src/utils/webFileActions.ts`, `src/storage/archiveAndImport.worker.ts`, `src/storage/offThreadWorkerClient.ts`, `src/components/ImportExportHubScreen.tsx`, `src/components/SettingsAndSyncScreen.tsx`, `src/hooks/useBarnStore.ts`, `src/storage/__tests__/opfsStorage.test.ts`, `src/storage/__tests__/photoHydrationAndWorker.test.ts`, `src/domain/__tests__/syncAndExports.test.ts`

**Automated Invariants Checked:**
- `src/storage/opfsTempStream.ts` must contain `writeTempOpfsFileStreamed`, `writeTempOpfsFile`, `purgeOpfsTmp`, `readTempOpfsFileAsBlob` — *Worker-safe OPFS /tmp chunk streamer must remain free of React/DOM imports and close writables in try/finally.*
- `src/domain/syncAndExports.ts` must contain `generateBarnBackupJsonChunks` — *Pure TypeScript backup JSON chunk generator prevents allocating monolithic strings for photo-heavy backups.*
- `src/domain/backupArchive.ts` must contain `streamCompleteBackupZipArchive`, `streamPhotosOnlyZipArchive` — *Streaming fflate Zip/ZipPassThrough/ZipDeflate builders decode and flush one entry at a time incrementally.*
- `src/utils/webFileActions.ts` must contain `downloadTextChunks`, `downloadTempOpfsExport`, `stagePayloadInOpfsTmp` — *All printable, shareable, and streamed browser exports stage via OPFS /tmp when supported and clean up deterministically.*
- `src/storage/offThreadWorkerClient.ts` must contain `buildCompleteBackupZipToOpfsTmpOffThread`, `buildPhotosOnlyZipToOpfsTmpOffThread` — *Off-thread worker bridge streams ZIP chunks straight to OPFS /tmp and falls back gracefully without Worker or OPFS.*

**Restoration Playbook if Overwritten:**
1. Keep `src/storage/opfsTempStream.ts` free of React/DOM imports and delegated from `src/storage/opfsStorage.ts` and `src/storage/archiveAndImport.worker.ts`.
2. Keep `generateBarnBackupJsonChunks` in `src/domain/syncAndExports.ts` and `streamCompleteBackupZipArchive` / `streamPhotosOnlyZipArchive` in `src/domain/backupArchive.ts`.
3. Keep full OPFS `/tmp` staging + `downloadTextChunks` / `downloadTempOpfsExport` in `src/utils/webFileActions.ts`, wired through `offThreadWorkerClient.ts`, `ImportExportHubScreen.tsx`, `SettingsAndSyncScreen.tsx`, and `useBarnStore.ts`.

### IMP-033: "The Development" Developer & Troubleshooting Screen, Permanent Tier Hierarchy & Production Guardrails

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Diagnostics & Sync (`diagnostics-sync`)
- **Origin:** Session Improvement
- **User Goal:** Relocate advanced, non-routine operational controls out of Settings into a dedicated lazy-loaded "The Development" developer screen with a permanent non-closeable Tier/Memory Hierarchy block, isolated error boundary, OPFS/IDB quota pre-flight checks, strict input sanitization, and multi-step destructive safeguards.
- **Summary:** Introduces lazy-loaded `DevelopmentScreen` wrapped in an isolated `DevelopmentErrorBoundary`; relocates Storage Protection, Connectivity Governor, App Update Policy & Release Gate, `DiagnosticsAndSupportPanel`, and Destructive Reset Lab controls out of `SettingsAndSyncScreen` while preserving original `DeviceCapabilityCard` & Home hierarchy banners intact; embeds a permanent, non-closeable copy of the 5-tier Device Tier & Memory Hierarchy guidelines (`data-permanent-tier-hierarchy="true"`); and enforces pure TS validation/sanitization & OPFS/IDB quota pre-flight checks (`developmentGuardrails.ts`, `verifyStorageQuotaForDiagnosticAction`) plus multi-step armed phrase safeguards.
- **Tracked Files:** `src/domain/developmentGuardrails.ts`, `src/domain/__tests__/developmentGuardrails.test.ts`, `src/storage/storageProtection.ts`, `src/components/DevelopmentErrorBoundary.tsx`, `src/components/DevelopmentScreen.tsx`, `src/components/DiagnosticsAndSupportPanel.tsx`, `src/components/SettingsAndSyncScreen.tsx`, `src/hooks/useBarnStore.ts`, `src/App.tsx`

**Automated Invariants Checked:**
- `src/domain/developmentGuardrails.ts` must contain `evaluateStorageQuotaForOperation`, `validateDiagnosticTriggerInput`, `validateSupportRecipientEmail`, `DESTRUCTIVE_CONFIRM_PHRASES`, `isDestructiveActionConfirmationValid` — *Pure TS developer guardrails module must stay DOM-free and enforce quota evaluations, strict input validation/sanitization, and confirmation phrases.*
- `src/storage/storageProtection.ts` must contain `verifyStorageQuotaForDiagnosticAction` — *Browser storage adapter must execute OPFS + IndexedDB quota pre-flight checks and log low-headroom diagnostics.*
- `src/components/DevelopmentErrorBoundary.tsx` must contain `DevelopmentErrorBoundary`, `recordReactCrash` — *Developer & Troubleshooting screen must stay isolated in a dedicated Error Boundary so faulty diagnostics cannot crash herd/breeding views.*
- `src/components/DevelopmentScreen.tsx` must contain `DevelopmentScreen`, `data-permanent-tier-hierarchy="true"`, `DEVICE_CAPABILITY_TIER_LIST`, `destructiveArmed` — *The Development screen must include a permanent non-closeable Tier/Memory Hierarchy block and multi-step armed safeguards for destructive actions.*
- `src/components/SettingsAndSyncScreen.tsx` must contain `onOpenDevelopment`, `DeviceCapabilityCard` — *Settings must link cleanly to The Development while keeping routine barn preferences and original DeviceCapabilityCard intact.*
- `src/App.tsx` must contain `DevelopmentScreen`, `DevelopmentErrorBoundary`, `route === 'development'` — *Root shell must lazy-load DevelopmentScreen inside Suspense + DevelopmentErrorBoundary.*

**Restoration Playbook if Overwritten:**
1. Restore `src/domain/developmentGuardrails.ts` and `verifyStorageQuotaForDiagnosticAction` in `src/storage/storageProtection.ts`.
2. Restore `src/components/DevelopmentErrorBoundary.tsx` and `src/components/DevelopmentScreen.tsx` with its permanent `data-permanent-tier-hierarchy="true"` section and `destructiveArmed` phrase gates.
3. Keep `development` in `WorkspaceRoute` (`useBarnStore.ts`), `SettingsAndSyncScreen.tsx` launcher (`onOpenDevelopment`), and lazy boundary mount in `src/App.tsx`.

### IMP-034: "Barn Bench" Fast Sequential Batch Entry Mode

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Let breeders walk down a cage row logging weights, body condition scores, nail trims, or cage moves rapidly with auto-advance and minimal modal switching.
- **Summary:** Adds a tap-friendly, strictly species-isolated Barn Bench sequential chore sheet filtered by barn row/section, herd status, and search text; supports rapid cage-by-cage logging of weights (in species unit), 1-tap BCS presets, nail trims, cage moves with live capacity warnings, and notes with auto-advance, transactional batch care-log writes (`saveCareLogsBatch`), and field-level sync outbox recording.
- **Tracked Files:** `src/domain/barnBench.ts`, `src/domain/__tests__/barnBench.test.ts`, `src/storage/storageAdapter.ts`, `src/storage/webSqliteAdapter.ts`, `src/hooks/useBarnStore.ts`, `src/components/BarnBenchScreen.tsx`, `src/components/SpeciesDashboardScreen.tsx`, `src/components/HerdScreen.tsx`, `src/App.tsx`

**Automated Invariants Checked:**
- `src/domain/barnBench.ts` must contain `extractSpeciesCageSections`, `buildBarnBenchQueue`, `buildBarnBenchCommitPlan`, `findNextBarnBenchIndex`, `BARN_BENCH_BCS_PRESETS` — *Pure TS Barn Bench queue builder, commit planner, and auto-advance selector must remain DOM-free and species-isolated.*
- `src/storage/webSqliteAdapter.ts` must contain `saveCareLogsBatch` — *Transactional batch CareLog persistence prevents multi-flush overhead when logging combined bench entries.*
- `src/hooks/useBarnStore.ts` must contain `| 'bench'`, `commitBarnBenchEntry`, `buildBarnBenchCommitPlan` — *Store must expose the bench route and queued atomic commitBarnBenchEntry action with outbox sync ops.*
- `src/components/BarnBenchScreen.tsx` must contain `BarnBenchScreen`, `evaluateCageAssignmentCapacityWarning`, `useAsyncSubmitLock`, `findNextBarnBenchIndex` — *Barn Bench screen must guard async commits against double-taps, check cage capacity on moves, and auto-advance cleanly.*
- `src/App.tsx` must contain `BarnBenchScreen`, `route === 'bench'`, `k: { route: 'bench'` — *Root shell must lazy-load BarnBenchScreen under route === bench with keyboard shortcut K.*

**Restoration Playbook if Overwritten:**
1. Restore `src/domain/barnBench.ts` and `src/domain/__tests__/barnBench.test.ts`.
2. Keep `saveCareLogsBatch` on `StorageAdapter` and `WebSqliteAdapter` and `commitBarnBenchEntry` + `bench` route in `src/hooks/useBarnStore.ts`.
3. Keep lazy `BarnBenchScreen` mounted in `src/App.tsx` with `K` shortcut and launchers in `SpeciesDashboardScreen.tsx` and `HerdScreen.tsx`.

### IMP-035: Batch Cage Card, Compact Mini-Sheet & Pedigree Printing from Herd Multi-Select

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Print cage cards, 4-up mini pedigrees, 4x6 photo cards, or stacked pedigrees for multiple selected animals in one pass for shows, auctions, or transport.
- **Summary:** Allows breeders to multi-select animals in `HerdScreen` and generate a single printable `.HTM` / Print-to-PDF sheet across four formats: 8-up kennel/cage cards, 1/4-page (4-up) mini 3-gen pedigree sheets, 3-generation 4x6 photo cards (2-up Letter or direct 4x6 paper), and stacked formal 3–6G pedigrees, backed by pure TS HTML generation (`batchPrint.ts`), bounded on-demand batch photo hydration (`loadAnimalPhotoDataUrlsBatch`), and live layout/option controls in `PrintPreviewModal`.
- **Tracked Files:** `src/domain/batchPrint.ts`, `src/domain/__tests__/batchPrint.test.ts`, `src/hooks/useBarnStore.ts`, `src/App.tsx`, `src/components/PrintPreviewModal.tsx`, `src/components/HerdScreen.tsx`

**Automated Invariants Checked:**
- `src/domain/batchPrint.ts` must contain `BATCH_PRINT_LAYOUTS`, `generateBatchPrintHtml`, `resolveBatchPrintAnimals`, `computeBatchPrintPageCount`, `buildBatchPrintFileName` — *Pure TS batch print engine must remain DOM-free and support cage cards, 4-up mini sheets, 4x6 photo cards, and stacked pedigrees.*
- `src/hooks/useBarnStore.ts` must contain `loadAnimalPhotoDataUrlsBatch` — *Store must expose bounded on-demand batch photo hydration without retaining full-res images in reactive snapshot RAM.*
- `src/components/PrintPreviewModal.tsx` must contain `batchPrintOptions`, `onChangeBatchPrintOptions`, `BATCH_PRINT_LAYOUTS` — *Print preview modal must render live layout switcher and batch print options toolbar.*
- `src/components/HerdScreen.tsx` must contain `openBatchPrintPreview`, `generateBatchPrintHtml`, `resolveBatchPrintAnimals`, `Batch Print (` — *HerdScreen multi-select bulk bar must launch batch print previews and clean up hydrated photos on close.*

**Restoration Playbook if Overwritten:**
1. Restore `src/domain/batchPrint.ts` and `src/domain/__tests__/batchPrint.test.ts`.
2. Keep `loadAnimalPhotoDataUrlsBatch` exported from `src/hooks/useBarnStore.ts` and passed as `onLoadFullPhotosBatch` to `HerdScreen` in `src/App.tsx`.
3. Keep `batchPrintOptions` controls in `src/components/PrintPreviewModal.tsx` and multi-select `Batch Print` wiring in `src/components/HerdScreen.tsx`.

### IMP-036: QR-Coded Cage Cards & Visual Hutch-Row / Facility Pen Board

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Embed scannable QR codes on printable cage cards that open the animal profile route directly in the PWA, and provide a visual Hutch-by-Hutch / Cage Row & Pasture Board grouping pens by barn section with linked feedlot inventories and recurring maintenance reminders.
- **Summary:** Adds a zero-dependency pure TS ISO/IEC 18004 QR code encoder and single-path SVG renderer (`qrCode.ts`), embeds toggleable scannable QR profile deep links into both thermal single cage cards (`generateThermalCageCardHtml`) and 8-up batch cage cards (`batchPrint.ts`), parses `?route=herd&animalId=...` and `?route=dashboard&cageId=...` on startup in `useBarnStore.ts`, extends `CageLocation` and SQLite/JSON serialization with housing unit type, feedlot inventory, and recurring maintenance schedules, and adds the pure `facilityBoard.ts` engine plus interactive `FacilityPenBoard` inside `SpeciesDashboardScreen` (with compact list toggle, full-screen board modal, quick stock adjustments, 1-click maintenance logging/task scheduling, and pen/row QR card printing).
- **Tracked Files:** `src/domain/qrCode.ts`, `src/domain/facilityBoard.ts`, `src/domain/models.ts`, `src/domain/batchPrint.ts`, `src/domain/syncAndExports.ts`, `src/domain/__tests__/qrCode.test.ts`, `src/domain/__tests__/facilityBoard.test.ts`, `src/domain/__tests__/batchPrint.test.ts`, `src/storage/webSqliteAdapter.ts`, `src/hooks/useBarnStore.ts`, `src/components/FacilityPenBoard.tsx`, `src/components/PrintPreviewModal.tsx`, `src/components/HerdScreen.tsx`, `src/components/SpeciesDashboardScreen.tsx`, `src/App.tsx`

**Automated Invariants Checked:**
- `src/domain/qrCode.ts` must contain `encodeQrMatrix`, `renderQrSvg`, `buildAnimalProfileDeepLink`, `buildCageBoardDeepLink`, `parseAppDeepLinkParams` — *Pure TS offline QR encoder, vector SVG renderer, and deep-link helpers must remain zero-DOM and self-contained.*
- `src/domain/facilityBoard.ts` must contain `buildFacilityBoardModel`, `evaluateCageMaintenanceStatus`, `evaluateCageFeedStatus`, `buildCageMaintenanceTaskDraft`, `matchesFacilityBoardFilter` — *Pure TS facility board grouping, feedlot rollups, and UTC calendar maintenance evaluators must remain DOM-free.*
- `src/domain/batchPrint.ts` must contain `includeQrCodes`, `supportsQrCode`, `buildAnimalProfileDeepLink` — *8-up batch cage cards must support scannable QR profile codes via includeQrCodes.*
- `src/domain/syncAndExports.ts` must contain `ThermalCageCardOptions`, `buildAnimalProfileDeepLink`, `renderQrSvg` — *Single thermal cage cards must embed optional QR profile deep links and backup JSON must preserve extended CageLocation metadata.*
- `src/storage/webSqliteAdapter.ts` must contain `feed_lot_name`, `maintenance_interval_days`, `last_maintenance_date_iso` — *SQLite cages table and idempotent migrations must persist housing type, feedlot inventory, and maintenance schedule columns.*
- `src/hooks/useBarnStore.ts` must contain `parseAppDeepLinkParams`, `highlightedCageId`, `setHighlightedCageId` — *Store startup deep-link handler must resolve scanned QR animalId and cageId routes cleanly.*
- `src/components/FacilityPenBoard.tsx` must contain `FacilityPenBoard`, `buildCageMaintenanceTaskDraft`, `onPrintCageCardsForAnimals` — *Visual Hutch-Row & Pasture Board must display grouped pens, feedlot controls, maintenance checkoffs, and QR cage card printing.*
- `src/components/SpeciesDashboardScreen.tsx` must contain `FacilityPenBoard`, `facilityBoardModel`, `handlePrintCageCardsForAnimals`, `highlightedCageId` — *Species dashboard Cages & Pens block must mount FacilityPenBoard alongside compact list view, full-screen board modal, and QR card print preview.*

**Restoration Playbook if Overwritten:**
1. Restore `src/domain/qrCode.ts`, `src/domain/facilityBoard.ts`, and their tests in `src/domain/__tests__/qrCode.test.ts` and `src/domain/__tests__/facilityBoard.test.ts`.
2. Keep extended `CageLocation` fields in `src/domain/models.ts`, SQLite columns/migrations in `src/storage/webSqliteAdapter.ts`, and JSON round-trip parsing in `src/domain/syncAndExports.ts`.
3. Keep QR code rendering in `src/domain/syncAndExports.ts` (`generateThermalCageCardHtml`) and `src/domain/batchPrint.ts` (`includeQrCodes`) wired to `PrintPreviewModal.tsx`, `HerdScreen.tsx`, and `SpeciesDashboardScreen.tsx`.
4. Keep `FacilityPenBoard.tsx` mounted in `SpeciesDashboardScreen.tsx` and `highlightedCageId` deep-link resolution in `useBarnStore.ts` and `src/App.tsx`.

### IMP-037: Side-by-Side Multi-Candidate Pairing Comparison Matrix (Breeding Lab)

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Compare one dam against multiple candidate sires (or vice versa) in a single Breeding Lab table showing COI %, shared bottleneck ancestors, carrier risk flags, and predicted coat varieties side by side.
- **Summary:** Adds a pure TypeScript multi-candidate pairing matrix engine (`pairingMatrix.ts`) and interactive `PairingComparisonMatrix` table inside `BreedingScreen` so breeders can compare one Dam against multiple candidate Sires (or one Sire against multiple candidate Dams) side by side for projected Wright COI %, shared bottleneck ancestors, carrier and genetic health/lethal risk flags, and predicted coat varieties, with 1-click loading into the Cage-Side Pairing Logger.
- **Tracked Files:** `src/domain/pairingMatrix.ts`, `src/domain/__tests__/pairingMatrix.test.ts`, `src/components/PairingComparisonMatrix.tsx`, `src/components/BreedingScreen.tsx`

**Automated Invariants Checked:**
- `src/domain/pairingMatrix.ts` must contain `buildPairingComparisonMatrix`, `selectDefaultMatrixCandidateIds`, `createSpeciesCoiEvaluator`, `analyzePairingCarrierRisksFromAnalyses`, `simulatePairingGenetics` — *Pure TS multi-candidate comparison matrix must share one species COI evaluator, run carrier lineage + Punnett simulations, and remain zero-DOM.*
- `src/components/PairingComparisonMatrix.tsx` must contain `PairingComparisonMatrix`, `buildPairingComparisonMatrix`, `ColorGeneticsNotice`, `onLoadPairingInLogger` — *Breeding Lab comparison matrix UI must render anchor/candidate selectors, sort/filter controls, coat genetics notice, and Load in Logger wiring.*
- `src/components/BreedingScreen.tsx` must contain `PairingComparisonMatrix`, `handleLoadPairingFromMatrix` — *BreedingScreen must mount PairingComparisonMatrix and connect Load in Logger to the Cage-Side Pairing Logger.*

**Restoration Playbook if Overwritten:**
1. Restore `src/domain/pairingMatrix.ts` and its unit tests in `src/domain/__tests__/pairingMatrix.test.ts`.
2. Restore `src/components/PairingComparisonMatrix.tsx` with anchor role toggle, candidate multi-select, COI/bottleneck/carrier/variety columns, and `ColorGeneticsNotice`.
3. Mount `<PairingComparisonMatrix />` and `handleLoadPairingFromMatrix` inside `src/components/BreedingScreen.tsx`.

### IMP-038: Color-Coded Allele Provenance, Unique-Ancestor Dimming & ARBA Registration Flags

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Color-code alleles by inheritance provenance (sire vs. dam vs. offspring vs. manual), dim unique non-convergent ancestors on pedigree trees to highlight linebred convergence, and flag Gen 0–3 pedigree nodes in red when missing ARBA registration fields would block registration.
- **Summary:** Adds a pure TypeScript allele provenance classifier (`analyzeAlleleProvenance` in `geneticsEngine.ts`) and pedigree convergence + ARBA 3-generation registration evaluator (`pedigreeAnalysis.ts`), a reusable color-coded genotype renderer (`ColoredGenotypeDisplay.tsx`), Dim Unique convergence spotlighting and red ARBA registration deficiency overlays on `PedigreeScreen`, and provenance displays with legend across `HerdScreen` and `BreedingScreen`.
- **Tracked Files:** `src/domain/geneticsEngine.ts`, `src/domain/pedigreeAnalysis.ts`, `src/domain/__tests__/pedigreeAnalysis.test.ts`, `src/components/ColoredGenotypeDisplay.tsx`, `src/components/PedigreeScreen.tsx`, `src/components/HerdScreen.tsx`, `src/components/BreedingScreen.tsx`

**Automated Invariants Checked:**
- `src/domain/geneticsEngine.ts` must contain `analyzeAlleleProvenance`, `AlleleProvenanceSource`, `AnimalAlleleProvenanceResult` — *Pure TS allele provenance classifier must support Mendelian elimination, offspring inference, X-linked loci, and custom species isolation without DOM dependencies.*
- `src/domain/pedigreeAnalysis.ts` must contain `isArbaRegistrationSpecies`, `evaluateAnimalArbaRegistration`, `analyzePedigreeTree` — *Pure TS pedigree convergence and ARBA registration evaluator must scope ARBA rules to Rabbit/Cavy Gen 0–3 nodes and remain zero-DOM.*
- `src/components/ColoredGenotypeDisplay.tsx` must contain `ColoredGenotypeDisplay`, `AlleleProvenanceLegend` — *Reusable provenance renderer must style Sire, Dam, Offspring, Manual, and Unverified alleles with accessible labels and legend.*
- `src/components/PedigreeScreen.tsx` must contain `analyzePedigreeTree`, `analyzeAlleleProvenance`, `dimUniqueAncestors`, `showRegistrationFlags`, `ColoredGenotypeDisplay` — *PedigreeScreen must wire Dim Unique convergence spotlighting, ARBA registration flags, and color-coded node alleles.*
- `src/components/HerdScreen.tsx` must contain `analyzeAlleleProvenance`, `ColoredGenotypeDisplay` — *HerdScreen Genetics & Allele Inference card must display color-coded allele provenance and uncommitted inference previews.*
- `src/components/BreedingScreen.tsx` must contain `analyzeAlleleProvenance`, `ColoredGenotypeDisplay`, `AlleleProvenanceLegend` — *BreedingScreen Coat Color Punnett panel must display color-coded Sire/Dam allele provenance alongside locus pair highlights.*

**Restoration Playbook if Overwritten:**
1. Keep `analyzeAlleleProvenance` in `src/domain/geneticsEngine.ts` and `src/domain/pedigreeAnalysis.ts` with unit tests in `src/domain/__tests__/pedigreeAnalysis.test.ts`.
2. Restore `src/components/ColoredGenotypeDisplay.tsx` (`ColoredGenotypeDisplay` + `AlleleProvenanceLegend`).
3. Keep Dim Unique, ARBA Reg Flags, and provenance wiring in `PedigreeScreen.tsx`, `HerdScreen.tsx`, and `BreedingScreen.tsx`.

### IMP-039: Pedigree Print Orientation Toggle, Optional Breeder Logo, ARBA lbs.oz Notation & Direct Offline PDF Export

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Allow breeders to switch ARBA pedigrees between Landscape and Portrait 8.5"x11", attach a rabbitry/barn logo in the header, toggle ARBA lbs.oz decimal dot weights, and download a .PDF file directly 100% offline.
- **Summary:** Adds Landscape/Portrait 8.5"x11" print orientation, optional barn/rabbitry raster logo header upload (`BarnSettings.breederLogoDataUrl`), ARBA `lbs.oz` dot weight notation (`formatWeightArbaLbsOzDot`, e.g., `10.04`), and a zero-dependency pure TypeScript 100% offline PDF 1.4 binary generator (`buildPedigreePdfBytes` in `pdfExporter.ts` + `webPdfActions.ts`) with direct Download .PDF in `PrintPreviewModal`.
- **Tracked Files:** `src/domain/models.ts`, `src/domain/syncAndExports.ts`, `src/domain/pdfExporter.ts`, `src/domain/__tests__/pdfExporter.test.ts`, `src/utils/webPdfActions.ts`, `src/storage/webSqliteAdapter.ts`, `src/components/SettingsAndSyncScreen.tsx`, `src/components/PrintPreviewModal.tsx`, `src/components/PedigreeScreen.tsx`, `src/components/HerdScreen.tsx`

**Automated Invariants Checked:**
- `src/domain/models.ts` must contain `breederLogoDataUrl`, `formatWeightArbaLbsOzDot`, `formatPedigreeWeight` — *BarnSettings must persist optional breederLogoDataUrl and models.ts must expose pure ARBA lbs.oz dot notation formatters.*
- `src/domain/syncAndExports.ts` must contain `PedigreePrintOrientation`, `arbaLbsOzDotNotation`, `showBreederLogo`, `barn-logo` — *generateEvansHtmPedigree must support Landscape/Portrait @page sizing, ARBA lbs.oz dot weights, and header logo rendering.*
- `src/domain/pdfExporter.ts` must contain `buildPedigreePdfBytes`, `PdfRasterImage`, `/DCTDecode` — *Pure TS offline PDF 1.4 generator must emit valid PDF binaries with JPEG XObjects and zero DOM dependencies.*
- `src/components/PrintPreviewModal.tsx` must contain `onDownloadPdf`, `Download .PDF`, `ARBA lbs.oz (10.04)`, `Portrait (8.5` — *PrintPreviewModal must expose orientation toggle, lbs.oz dot toggle, logo controls, and direct Download .PDF action.*

**Restoration Playbook if Overwritten:**
1. Keep `breederLogoDataUrl`, `formatWeightArbaLbsOzDot`, and `formatPedigreeWeight` in `src/domain/models.ts` and `webSqliteAdapter.ts` extra_settings_json.
2. Restore `src/domain/pdfExporter.ts`, `src/utils/webPdfActions.ts`, and `src/domain/__tests__/pdfExporter.test.ts`.
3. Keep orientation, ARBA lbs.oz, logo upload/toggle, and `onDownloadPdf` wired across `SettingsAndSyncScreen.tsx`, `PrintPreviewModal.tsx`, `PedigreeScreen.tsx`, and `HerdScreen.tsx`.

### IMP-040: 8-Generation Pedigree Tree Mode, Custom Print Styling Presets & Shareable HTML Pedigree Cards

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Let breeders view and export up to 8 generations on demand, customize pedigree print borders, colors, and layouts safely on crisp white paper, and export lightweight standalone shareable pedigree HTML cards.
- **Summary:** Extends pedigree traversal, SQLite neighborhood loading, Evans .HTM output, and pure-TS offline PDF 1.4 export (auto-paginating 7-gen into 2 sheets and 8-gen into 4 grandparent quadrants) up to 8 generations on demand while keeping startup defaults capped at 3–6G; adds white-paper-locked color/border/layout print presets (`pedigreePrintStyles.ts`) and lightweight standalone mobile `.HTML` shareable pedigree cards (`shareablePedigreeCard.ts`).
- **Tracked Files:** `src/domain/models.ts`, `src/domain/pedigreeCalculator.ts`, `src/domain/pedigreePrintStyles.ts`, `src/domain/shareablePedigreeCard.ts`, `src/domain/syncAndExports.ts`, `src/domain/pdfExporter.ts`, `src/domain/exporters/exporterTypes.ts`, `src/domain/exporters/registry.ts`, `src/storage/webSqliteAdapter.ts`, `src/hooks/useBarnStore.ts`, `src/components/PrintPreviewModal.tsx`, `src/components/PedigreeScreen.tsx`, `src/components/HerdScreen.tsx`, `src/components/ImportExportHubScreen.tsx`

**Automated Invariants Checked:**
- `src/domain/models.ts` must contain `DefaultPedigreeGenerations`, `PedigreeGenerationDepth`, `normalizePedigreeGenerationDepth`, `normalizeDefaultPedigreeGenerations` — *models.ts must separate 3–6G startup defaults from on-demand 3–8G PedigreeGenerationDepth.*
- `src/domain/pedigreePrintStyles.ts` must contain `PEDIGREE_COLOR_PRESETS`, `PEDIGREE_BORDER_STYLES`, `PEDIGREE_LAYOUT_PRESETS`, `resolvePedigreePrintTheme` — *Pure TS print preset engine must define color, border, and layout presets locked to #FFFFFF paper.*
- `src/domain/shareablePedigreeCard.ts` must contain `generateShareablePedigreeCardHtml`, `buildShareablePedigreeCardFileName`, `ShareablePedigreeCardOptions` — *Pure TS shareable HTML pedigree card generator must render zero-DOM self-contained cards with collapsible Gen 4–8 ancestry.*
- `src/domain/exporters/registry.ts` must contain `shareable-pedigree-card`, `generateShareablePedigreeCardHtml` — *Exporters registry must expose Shareable Pedigree Card (.HTML) alongside 8-gen Evans .HTM.*
- `src/components/PrintPreviewModal.tsx` must contain `pedigreeDocMode`, `onChangePedigreeDocMode`, `PEDIGREE_COLOR_PRESETS`, `PEDIGREE_BORDER_STYLES`, `PEDIGREE_LAYOUT_PRESETS` — *PrintPreviewModal must allow switching between Formal Certificate and Shareable Card and picking color, border, and layout presets.*
- `src/storage/webSqliteAdapter.ts` must contain `Math.min(8, Math.max(0, Math.floor(maxDepth)))`, `MAX_RECORDS = 512` — *SQLite neighborhood loader must fetch up to 8 generations with expanded ancestor node cap (512).*

**Restoration Playbook if Overwritten:**
1. Keep `PedigreeGenerationDepth` (`3..8`) and normalizers in `src/domain/models.ts` plus Gen 7–8 `slotRoleLabel`/`buildPedigreeSlots` in `src/domain/pedigreeCalculator.ts`.
2. Restore `src/domain/pedigreePrintStyles.ts`, `src/domain/shareablePedigreeCard.ts`, multi-page 7–8G sheets in `src/domain/pdfExporter.ts`, and `shareable-pedigree-card` in `src/domain/exporters/registry.ts`.
3. Preserve 7/8-gen toggles, style preset selectors, and `pedigreeDocMode` wiring across `webSqliteAdapter.ts`, `useBarnStore.ts`, `PrintPreviewModal.tsx`, `PedigreeScreen.tsx`, `HerdScreen.tsx`, and `ImportExportHubScreen.tsx`.

### IMP-041: Structured Show Placements, Wins, Judge Notes & E-Leg Vault

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Capture structured show results, judge feedback, legs, and E-Leg certificate photos per entered animal so GC progress and show wins automatically enrich pedigrees, Barn Binder, and breeder reports.
- **Summary:** Expands ShowEvent entries with per-animal class placements, sanctionable awards (BOB, BOS, BIS, GCH, BOV, BOSV, RIS), judge names and notes, earned legs/points, E-Leg certificate numbers, and compressed raster E-Leg photo attachments (showResults.ts), synchronizing Animal.legsCount deltas and feeding Grand Championship progress and show honors into Male/Female reports, Barn Binder, Evans .HTM, Shareable Cards, Offline PDF pedigrees, and Herd/Pedigree/Species screens.
- **Tracked Files:** `src/domain/models.ts`, `src/domain/showResults.ts`, `src/domain/__tests__/showResults.test.ts`, `src/storage/webSqliteAdapter.ts`, `src/hooks/useBarnStore.ts`, `src/domain/reportGenerators.ts`, `src/domain/barnBinder.ts`, `src/domain/syncAndExports.ts`, `src/domain/pdfExporter.ts`, `src/domain/shareablePedigreeCard.ts`, `src/domain/exporters/registry.ts`, `src/domain/speciesMigration.ts`, `src/domain/syncOutbox.ts`, `src/components/SpeciesDashboardScreen.tsx`, `src/components/PedigreeScreen.tsx`, `src/components/HerdScreen.tsx`

**Automated Invariants Checked:**
- `src/domain/models.ts` must contain `ShowAwardCode`, `SHOW_AWARD_OPTIONS`, `ShowELegAttachment`, `ShowAnimalResult` — *Canonical show award codes, E-Leg attachment types, and ShowEvent.results schema must stay intact.*
- `src/domain/showResults.ts` must contain `normalizeShowResults`, `sanitizeShowELegAttachment`, `computeShowLegDeltas`, `computeAnimalShowSummary` — *Pure TS show results normalization, XSS-safe E-Leg attachment sanitization, leg delta reconciliation, and GC progress calculation must remain zero-DOM.*
- `src/storage/webSqliteAdapter.ts` must contain `results_json`, `normalizeShowResults` — *SQLite shows table and idempotent schema migration must persist and normalize results_json.*
- `src/hooks/useBarnStore.ts` must contain `normalizeShowResults`, `computeShowLegDeltas` — *Store show save/delete mutations must normalize results and reconcile Animal.legsCount deltas atomically.*
- `src/domain/reportGenerators.ts` must contain `computeAnimalShowSummary`, `gcProgress`, `showWins`, `showPoints` — *Male/Female reports must aggregate show wins, points, combined legs, and Grand Champion progress automatically.*
- `src/domain/barnBinder.ts` must contain `computeAnimalShowSummary`, `Show Legs / GC Progress` — *Barn Binder must include structured show placements, judge notes, E-Leg cert numbers, and E-Leg photo thumbnails.*
- `src/domain/syncAndExports.ts` must contain `computeAnimalShowSummary`, `gcProgress.shortLabel` — *Evans .HTM pedigrees and JSON backups must carry structured ShowEvent.results and display show honors.*
- `src/domain/pdfExporter.ts` must contain `computeAnimalShowSummary`, `gcProgress.shortLabel` — *Offline PDF 1.4 pedigrees must render show legs/GC status, awards, points, and ancestor honors.*
- `src/domain/shareablePedigreeCard.ts` must contain `computeAnimalShowSummary`, `awardsSummaryText` — *Shareable pedigree cards must badge show legs, GC eligibility, awards, and points.*
- `src/components/SpeciesDashboardScreen.tsx` must contain `ShowAnimalResult`, `SHOW_AWARD_OPTIONS`, `eLegLightboxRef`, `showSubmitLock` — *Species Hub must expose the accessible Show & Results Editor Modal, multi-award toggles, E-Leg photo vault uploader, and lightbox viewer.*
- `src/components/PedigreeScreen.tsx` must contain `computeAnimalShowSummary`, `subjectShowSummary` — *PedigreeScreen must surface show honors and forward shows/careLogs to all pedigree exports.*
- `src/components/HerdScreen.tsx` must contain `computeAnimalShowSummary`, `activeAnimalShowSummary`, `eLegLightboxRef` — *HerdScreen profile must display GC progress bar, show history, E-Leg vault lightbox, and forward shows/careLogs to formal prints.*

**Restoration Playbook if Overwritten:**
1. Keep ShowAwardCode, SHOW_AWARD_OPTIONS, ShowELegAttachment, ShowAnimalResult, and ShowEvent.results in `src/domain/models.ts` plus `src/domain/showResults.ts` and `src/domain/__tests__/showResults.test.ts`.
2. Preserve `results_json` persistence/migration in `src/storage/webSqliteAdapter.ts`, leg delta reconciliation in `src/hooks/useBarnStore.ts`, and species migration/outbox handling in `speciesMigration.ts` / `syncOutbox.ts`.
3. Keep `computeAnimalShowSummary` integrations across `reportGenerators.ts`, `barnBinder.ts`, `syncAndExports.ts`, `pdfExporter.ts`, `shareablePedigreeCard.ts`, `exporters/registry.ts`, `SpeciesDashboardScreen.tsx`, `PedigreeScreen.tsx`, and `HerdScreen.tsx`.

### IMP-042: Genetic Variety / Coat Explorer Sandbox (What-If Playground in Breeding Lab)

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Let breeders experiment with hypothetical loci combinations and What-If crosses inside Breeding Lab and see predicted coat varieties, hidden carriers, and alerts without creating temporary animal records first.
- **Summary:** Adds pure TS single-genotype phenotype, hidden recessive carrier, and single-animal health/lethal alert evaluation (`evaluateSingleGenotypeSandbox`, `buildSandboxHypotheticalAnimal` in `geneticsEngine.ts`) plus the ephemeral interactive `CoatExplorerSandbox` playground inside `BreedingScreen` supporting Single Genotype and What-If Pairing Cross modes, variety presets with optional modifier checks, read-only herd/logger seeding, and interactive locus allele editing without creating temporary animal records.
- **Tracked Files:** `src/domain/geneticsEngine.ts`, `src/domain/__tests__/geneticsEngine.test.ts`, `src/components/CoatExplorerSandbox.tsx`, `src/components/BreedingScreen.tsx`

**Automated Invariants Checked:**
- `src/domain/geneticsEngine.ts` must contain `SingleGenotypeEvaluation`, `evaluateSingleGenotypeSandbox`, `buildSandboxHypotheticalAnimal` — *Pure TS Coat Explorer Sandbox evaluator and hypothetical animal shell builder must remain zero-DOM and custom-species isolated.*
- `src/components/CoatExplorerSandbox.tsx` must contain `CoatExplorerSandbox`, `evaluateSingleGenotypeSandbox`, `buildSandboxHypotheticalAnimal`, `ColorGeneticsNotice` — *Breeding Lab Coat Explorer Sandbox UI must remain strictly ephemeral (no persistence writes) with What-If Single & Cross modes and ColorGeneticsNotice.*
- `src/components/BreedingScreen.tsx` must contain `<CoatExplorerSandbox` — *BreedingScreen must mount CoatExplorerSandbox inside Breeding Lab.*

**Restoration Playbook if Overwritten:**
1. Keep `SingleGenotypeEvaluation`, `evaluateSingleGenotypeSandbox`, and `buildSandboxHypotheticalAnimal` in `src/domain/geneticsEngine.ts` with tests in `src/domain/__tests__/geneticsEngine.test.ts`.
2. Restore `src/components/CoatExplorerSandbox.tsx` with Single Genotype & What-If Cross modes, variety presets, locus selectors, and `ColorGeneticsNotice`.
3. Mount `<CoatExplorerSandbox />` inside `src/components/BreedingScreen.tsx`.

### IMP-043: Rate of Gain, Comparative Weight Charts & Litter Survival Curves

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Track kit/offspring survival rate per dam and sire, chart litter weight-gain milestones across seasons, and compare multi-animal Rate of Gain curves on an age-in-days axis with native target/goal overlays.
- **Summary:** Adds pure TS age-in-days Rate of Gain (ADG), Barn Cohort Benchmark, interpolated user-defined goal weight curves, meteorological seasonal bucketing, and dam/sire litter survival & milestone analytics (`growthAnalytics.ts`) backed by `SpeciesProfile.targetWeightCurve` and `BreedingRecord.litterWeightMilestones` across SQLite, JSON, store hooks, `GrowthAndSurvivalLab`, `BreedingScreen` Outcome milestone editor, `HerdScreen` compare actions, and the `litter-survival-performance-report`.
- **Tracked Files:** `src/domain/models.ts`, `src/domain/growthAnalytics.ts`, `src/domain/__tests__/growthAnalytics.test.ts`, `src/domain/syncAndExports.ts`, `src/domain/reportCatalog.ts`, `src/domain/reportGenerators.ts`, `src/storage/webSqliteAdapter.ts`, `src/hooks/useBarnStore.ts`, `src/components/GrowthAndSurvivalLab.tsx`, `src/components/BreedingScreen.tsx`, `src/components/HerdScreen.tsx`, `src/App.tsx`

**Automated Invariants Checked:**
- `src/domain/models.ts` must contain `TargetWeightPoint`, `normalizeTargetWeightCurve`, `LitterWeightMilestone`, `normalizeLitterWeightMilestones` — *Target weight curve points and litter weight-gain milestone types/normalizers must remain intact on SpeciesProfile and BreedingRecord.*
- `src/domain/growthAnalytics.ts` must contain `evaluateLitterSurvivalAndMilestones`, `buildAnimalGrowthSeries`, `buildBarnCohortBenchmarkCurve`, `buildComparativeGrowthChartModel`, `resolveMeteorologicalSeason` — *Pure TS growth, seasonal litter survival, cohort benchmark, and comparative ADG engine must stay zero-DOM.*
- `src/storage/webSqliteAdapter.ts` must contain `target_weight_curve_json`, `litter_weight_milestones_json` — *SQLite schema and idempotent migrations must persist species target curves and breeding litter milestones.*
- `src/hooks/useBarnStore.ts` must contain `updateSpeciesTargetWeightCurve`, `openGrowthCompareForAnimals` — *Store must persist species target weight curves, litter milestones, and launch preselected multi-animal growth comparisons.*
- `src/components/GrowthAndSurvivalLab.tsx` must contain `GrowthAndSurvivalLab`, `buildComparativeGrowthChartModel`, `evaluateLitterSurvivalAndMilestones` — *GrowthAndSurvivalLab UI must expose Comparative Rate of Gain charts with goal/cohort overlays and Litter Survival & Parent Curves.*
- `src/components/BreedingScreen.tsx` must contain `<GrowthAndSurvivalLab`, `litterWeightMilestones` — *BreedingScreen must mount GrowthAndSurvivalLab and expose litter weight milestone editing inside the Outcome modal.*
- `src/domain/reportGenerators.ts` must contain `litter-survival-performance-report`, `evaluateLitterSurvivalAndMilestones` — *Reports catalog and generator must expose Litter Survival & Parent Performance Report.*

**Restoration Playbook if Overwritten:**
1. Keep `TargetWeightPoint`, `normalizeTargetWeightCurve`, `LitterWeightMilestone`, and `normalizeLitterWeightMilestones` in `src/domain/models.ts` plus `target_weight_curve_json` & `litter_weight_milestones_json` in `src/storage/webSqliteAdapter.ts` and `src/domain/syncAndExports.ts`.
2. Restore `src/domain/growthAnalytics.ts` and `src/domain/__tests__/growthAnalytics.test.ts`.
3. Keep `updateSpeciesTargetWeightCurve`, `openGrowthCompareForAnimals`, `GrowthAndSurvivalLab.tsx`, Outcome milestone inputs in `BreedingScreen.tsx`, Herd growth compare buttons in `HerdScreen.tsx` / `App.tsx`, and `litter-survival-performance-report` in `reportCatalog.ts` / `reportGenerators.ts`.

### IMP-044: Feed Inventory Ledger, Tag Lot-Number OCR & Biosecurity Auto-Purge

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Track purchased feed lots, allocate intake to pens and litters, scan feed tag stamps before deep compression with manual fallback, auto-purge heavy raw tag images after lot indexing, and keep an offline feed manufacturer recall & hotline directory.
- **Summary:** Adds strictly species-isolated `FeedBatch` & `FeedAllocation` tracking across SQLite schema v3 (`feed_batches`, `feed_allocations`), JSON/ZIP backups, data health repair, and `useBarnStore`, paired with pre-compression local OCR (`captureFeedTagWithPreCompressionOcr` + `extractFeedTagDetailsFromOcrText`) to index mill lot numbers and plant codes with manual override, configurable 30/60/90-day biosecurity auto-purge of stored tag images (`purgeExpiredFeedTagPhotosPure`), lot traceability across cages/litters/animals (`traceFeedLotToCagesAndLitters`), and an offline manufacturer emergency directory (`FEED_MANUFACTURER_DIRECTORY`).
- **Tracked Files:** `src/domain/models.ts`, `src/domain/feedInventory.ts`, `src/domain/feedManufacturerDirectory.ts`, `src/domain/__tests__/feedInventory.test.ts`, `src/storage/feedTagOcr.ts`, `src/storage/webSqliteAdapter.ts`, `src/hooks/useBarnStore.ts`, `src/components/FeedLedgerScreen.tsx`, `src/components/FacilityPenBoard.tsx`, `src/components/SpeciesDashboardScreen.tsx`, `src/App.tsx`

**Automated Invariants Checked:**
- `src/domain/models.ts` must contain `FeedBatch`, `FeedAllocation`, `FEED_PURGE_WINDOW_OPTIONS`, `normalizeFeedPurgeWindowDays` — *FeedBatch, FeedAllocation, and 30/60/90/0 biosecurity purge window options must remain intact in core models.*
- `src/domain/feedInventory.ts` must contain `extractFeedTagDetailsFromOcrText`, `purgeExpiredFeedTagPhotosPure`, `traceFeedLotToCagesAndLitters`, `formatFeedLedgerCsv` — *Pure TS lot OCR parser, lot-gated biosecurity purge transform, lot traceability, and CSV exporter must stay zero-DOM.*
- `src/domain/feedManufacturerDirectory.ts` must contain `FEED_MANUFACTURER_DIRECTORY`, `filterFeedManufacturerDirectory`, `matchManufacturerForBrand` — *Bundled offline manufacturer emergency & recall directory must stay accessible with zero network.*
- `src/storage/feedTagOcr.ts` must contain `captureFeedTagWithPreCompressionOcr`, `optimizeImageBlob` — *Feed tag OCR must decode and analyze full-resolution images BEFORE compact image compression.*
- `src/storage/webSqliteAdapter.ts` must contain `feed_batches`, `feed_allocations`, `saveFeedBatchesBatch` — *SQLite persistence schema and adapter methods must store and hydrate feed batches and intake allocations.*
- `src/hooks/useBarnStore.ts` must contain `saveFeedBatch`, `logFeedAllocation`, `runFeedTagBiosecurityAutoPurge` — *Store must expose species-isolated feed ledger mutations, cage stock sync, and idle biosecurity auto-purge.*
- `src/components/FeedLedgerScreen.tsx` must contain `FeedLedgerScreen`, `captureFeedTagWithPreCompressionOcr`, `FEED_MANUFACTURER_DIRECTORY` — *FeedLedgerScreen must provide purchase/OCR scanning, intake allocations, lot traceability, and offline manufacturer contacts.*
- `src/App.tsx` must contain `FeedLedgerScreen`, `route === 'feed'` — *Root router must lazy-load and mount FeedLedgerScreen on route feed.*

**Restoration Playbook if Overwritten:**
1. Keep `FeedBatch`, `FeedAllocation`, `FEED_PURGE_WINDOW_OPTIONS`, and `normalizeFeedPurgeWindowDays` in `src/domain/models.ts` plus SQLite tables in `src/storage/webSqliteAdapter.ts`.
2. Restore `src/domain/feedInventory.ts`, `src/domain/feedManufacturerDirectory.ts`, `src/domain/__tests__/feedInventory.test.ts`, and `src/storage/feedTagOcr.ts`.
3. Keep `saveFeedBatch`, `logFeedAllocation`, `runFeedTagBiosecurityAutoPurge` in `useBarnStore.ts` and mount `FeedLedgerScreen.tsx` in `SpeciesDashboardScreen.tsx`, `FacilityPenBoard.tsx`, and `App.tsx`.

### IMP-045: Offline Photo Pedigree Scanning & Local OCR Importer

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Allow breeders to snap a photo or upload JPG/PNG/WebP/PDF scans of paper pedigrees completely offline, review/correct extracted ancestor names, ear tattoos, weights, and ARBA registration numbers across 3 generations, and stage them straight into the Import Review Queue with duplicate/conflict resolution.
- **Summary:** Adds 100% offline client-side paper pedigree scanning and PDF extraction via `pdfScanExtractor.ts` (searchable `/FlateDecode` `BT...ET` text vectors with coordinates and embedded `/DCTDecode` scanned JPEG pages) plus `pedigreeOcrParser.ts` (2D bounding-box 3-col/4-col pedigree tree reconstruction and text heuristics into an editable 15-slot 3-generation draft queue backed by `PlatformImportPreview`), wired with `pedigreeOcrScanner.ts` (native Chromium `TextDetector` + lazy bounded `tesseract.js` worker with `offline_manual` fallback) into `PedigreeOcrScannerPanel.tsx` and `ExternalImporterPanel.tsx`.
- **Tracked Files:** `src/domain/importers/pdfScanExtractor.ts`, `src/domain/importers/pedigreeOcrParser.ts`, `src/domain/__tests__/pedigreeOcrParser.test.ts`, `src/storage/pedigreeOcrScanner.ts`, `src/components/PedigreeOcrScannerPanel.tsx`, `src/components/ExternalImporterPanel.tsx`, `src/components/ImportExportHubScreen.tsx`

**Automated Invariants Checked:**
- `src/domain/importers/pdfScanExtractor.ts` must contain `extractPedigreePdfPages`, `MAX_PDF_SCAN_BYTES`, `MAX_PDF_SCAN_PAGES` — *Pure TS offline PDF vector text (`BT...ET`) and embedded `/DCTDecode` JPEG extractor must remain zero-DOM.*
- `src/domain/importers/pedigreeOcrParser.ts` must contain `PEDIGREE_OCR_SLOT_DESCRIPTORS`, `parsePedigreeSlotLines`, `parsePedigreeOcrResult`, `buildPlatformImportPreviewFromOcrDrafts` — *Pure TS 2D tree/line pedigree parser and Import Review Queue preview bridge must stay zero-DOM and deterministic.*
- `src/storage/pedigreeOcrScanner.ts` must contain `scanPedigreeDocumentFile`, `tesseract.js` — *Browser OCR runner must lazy-load Tesseract worker with bounded timeout, native TextDetector precheck, and soft offline manual fallback.*
- `src/components/PedigreeOcrScannerPanel.tsx` must contain `PedigreeOcrScannerPanel`, `scanPedigreeDocumentFile`, `buildPlatformImportPreviewFromOcrDrafts` — *Scanner UI must offer camera/photo/PDF capture, editable 15-slot 3-generation review, and staging into Import Review Queue.*
- `src/components/ExternalImporterPanel.tsx` must contain `externalOcrPreview`, `onClearExternalOcrPreview` — *ExternalImporterPanel must accept staged OCR PlatformImportPreview drafts for full conflict resolution and WebP photo optimization.*
- `src/components/ImportExportHubScreen.tsx` must contain `<PedigreeOcrScannerPanel`, `stagedOcrPreview` — *ImportExportHubScreen Section 02 must mount PedigreeOcrScannerPanel connected to ExternalImporterPanel.*

**Restoration Playbook if Overwritten:**
1. Restore pure parsers `src/domain/importers/pdfScanExtractor.ts`, `src/domain/importers/pedigreeOcrParser.ts`, and `src/domain/__tests__/pedigreeOcrParser.test.ts`.
2. Restore `src/storage/pedigreeOcrScanner.ts` and `src/components/PedigreeOcrScannerPanel.tsx`.
3. Keep `externalOcrPreview`/`onClearExternalOcrPreview` props in `ExternalImporterPanel.tsx` and `<PedigreeOcrScannerPanel>` wired inside `ImportExportHubScreen.tsx`.

### IMP-046: Local Economic Ledger, Meat/Pelt Processing Yields & 4-H/FFA Project Books

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Provide offline barn bookkeeping with receipt photos, automated animal/litter P&L margins, meat/pelt carcass yield and pelt grading logs, and printable 4-H/FFA youth livestock project completion books.
- **Summary:** Adds species-isolated general barn income/expense tracking (`LedgerEntry`) with compressed receipt photo attachments (`optimizeImageFile`) and feed-lot deduplication; automated per-animal and per-litter net profit/loss margins (`computeAnimalProfitMargins`, `computeLitterProfitMargins`); meat & pelt processing logs (`ProcessingLog`) tracking butcher schedules, harvest dates, live-to-dressed carcass dress-out %, and pelt grades; 4-H/FFA Youth Project Record Books (`YouthProjectBook`) with ration feed logs, inventory changes, and printable `.HTM`/PDF completion reports (`generateYouthProjectReportHtml`); SQLite v4 persistence, sync outbox deltas, 3 new report presets, and `EconomicsLedgerScreen.tsx` accessible from Species Dashboard & `E` shortcut.
- **Tracked Files:** `src/domain/models.ts`, `src/domain/economicsLedger.ts`, `src/domain/__tests__/economicsLedger.test.ts`, `src/domain/reportCatalog.ts`, `src/domain/reportGenerators.ts`, `src/domain/syncOutbox.ts`, `src/storage/webSqliteAdapter.ts`, `src/hooks/useBarnStore.ts`, `src/components/EconomicsLedgerScreen.tsx`, `src/components/SpeciesDashboardScreen.tsx`, `src/App.tsx`

**Automated Invariants Checked:**
- `src/domain/models.ts` must contain `LedgerEntry`, `LEDGER_CATEGORY_OPTIONS`, `ProcessingLog`, `PELT_GRADE_OPTIONS`, `YouthProjectBook` — *LedgerEntry, ProcessingLog, and YouthProjectBook domain models and normalizers must remain intact.*
- `src/domain/economicsLedger.ts` must contain `calculateDressOutPercent`, `computeAnimalProfitMargins`, `computeLitterProfitMargins`, `evaluateSpeciesEconomicsSummary`, `evaluateProcessingSummary`, `evaluateYouthProjectSummary`, `generateYouthProjectReportHtml` — *Pure TS economics margins, yield analytics, CSV exporters, and printable youth completion report builder must remain zero-DOM.*
- `src/storage/webSqliteAdapter.ts` must contain `ledger_entries`, `processing_logs`, `youth_project_books`, `saveLedgerEntry`, `saveProcessingLog`, `saveYouthProjectBook` — *SQLite persistence schema v4 and adapter CRUD methods must store and hydrate ledger entries, processing logs, and youth project books.*
- `src/hooks/useBarnStore.ts` must contain `saveLedgerEntry`, `saveProcessingLog`, `saveYouthProjectBook` — *Store must expose species-isolated economics, processing, and 4-H/FFA project mutations with delta outbox sync.*
- `src/components/EconomicsLedgerScreen.tsx` must contain `EconomicsLedgerScreen`, `generateYouthProjectReportHtml`, `evaluateSpeciesEconomicsSummary` — *EconomicsLedgerScreen must provide general ledger + receipt photos, meat/pelt yields, and 4-H/FFA project record books.*
- `src/App.tsx` must contain `EconomicsLedgerScreen`, `route === 'economics'` — *Root router must lazy-load and mount EconomicsLedgerScreen on route economics.*

**Restoration Playbook if Overwritten:**
1. Keep `LedgerEntry`, `ProcessingLog`, and `YouthProjectBook` interfaces and normalizers in `src/domain/models.ts` plus SQLite v4 tables in `src/storage/webSqliteAdapter.ts`.
2. Restore `src/domain/economicsLedger.ts` and `src/domain/__tests__/economicsLedger.test.ts` along with the 3 financial/production/youth presets in `reportCatalog.ts` and `reportGenerators.ts`.
3. Keep store CRUD mutations in `src/hooks/useBarnStore.ts` and wire `EconomicsLedgerScreen.tsx` into `SpeciesDashboardScreen.tsx` and `App.tsx`.

### IMP-047: Post-Crash Alignment, Ready External Exporters, Feed/Archive Parity & Android WebView Print/Share

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Realign the entire codebase after build-crash drift, keep the PWA locked to React + Vite + TypeScript, complete half-done exporters and migration/inspector coverage, and make pedigree/binder print & share work seamlessly on desktop, mobile web, and the Android WebView APK.
- **Summary:** Enforces the React PWA preservation rule in `AGENTS.md` and `prompts/master_system_prompt.md`; aligns PWA/Android versions to `0.1.0-alpha.2`; migrates `feedBatches` and `feedAllocations` during cross-species moves; surfaces v3/v4 feed, ledger, processing, and 4-H/FFA counts in `archiveInspector.ts`; implements `herdboss-transfer-bundle` (.ZIP) and `registry-worksheet-csv` (.CSV) as ready exporters; and fixes `@media print` extraction, accent-ink preservation, native wrapper Share .HTM enablement, and Android `PrintBridge.kt` offscreen HTML + landscape/portrait printing while removing the stale `PedigreePrintNotice` banner.
- **Tracked Files:** `AGENTS.md`, `.env.example`, `package.json`, `public/version.json`, `src/domain/upgradeGate.ts`, `src/domain/speciesMigration.ts`, `src/domain/archiveInspector.ts`, `src/domain/exporters/exporterTypes.ts`, `src/domain/exporters/registry.ts`, `src/native/pedigreeBridge.ts`, `src/components/PrintPreviewModal.tsx`, `src/components/ImportExportHubScreen.tsx`, `src/index.css`, `android-wrapper/app/src/main/java/org/askkim/pedigree/wrapper/MainActivity.kt`, `android-wrapper/app/src/main/java/org/askkim/pedigree/wrapper/PrintBridge.kt`, `.github/structure.txt`

**Automated Invariants Checked:**
- `AGENTS.md` must contain `Never Convert PWA Away From React` — *Workspace agent rules must lock the PWA against non-React rewrites.*
- `src/domain/speciesMigration.ts` must contain `feedBatchesMigrated`, `feedAllocationsMigrated` — *Cross-species migrations must move linked feedBatches and feedAllocations.*
- `src/domain/archiveInspector.ts` must contain `feedBatchCount`, `feedAllocationCount`, `ledgerEntryCount`, `processingLogCount`, `youthProjectBookCount` — *Pre-restore dry-run inspection must count v3/v4 feed, ledger, processing, and youth records.*
- `src/domain/exporters/registry.ts` must contain `herdboss-transfer-bundle`, `registry-worksheet-csv`, `binaryContent` — *HerdBoss Transfer Tables (.ZIP) and Breed Registry & Show Worksheets (.CSV) must stay active ready exporters.*
- `src/components/PrintPreviewModal.tsx` must contain `canShareHtmlDocument`, `extractScopedPrintCssFromRules`, `detectDocumentPrintOrientation` — *PrintPreviewModal must enable Share .HTM on native wrappers, extract @media print rules, and forward orientation/HTML to native print.*
- `android-wrapper/app/src/main/java/org/askkim/pedigree/wrapper/PrintBridge.kt` must contain `printFromBridge`, `printHtmlDocument`, `buildPrintAttributes` — *Android PrintBridge must render self-contained HTML in a hardened offscreen WebView with landscape/portrait PrintAttributes.*

**Restoration Playbook if Overwritten:**
1. Verify `AGENTS.md` and `prompts/master_system_prompt.md` keep the React PWA lock rule intact.
2. Ensure `package.json`, `public/version.json`, and `src/domain/upgradeGate.ts` match `android-wrapper/app/build.gradle.kts` (`0.1.0-alpha.2`).
3. Keep `herdboss-transfer-bundle` and `registry-worksheet-csv` in `src/domain/exporters/registry.ts` with `binaryContent` download dispatch in `ImportExportHubScreen.tsx`.
4. Keep `@media print` extraction, native Share .HTM support, and Android `PrintBridge.kt` offscreen HTML rendering intact and do not reintroduce `PedigreePrintNotice`.

### IMP-048: Hybrid Architecture Guardrails & React-Only Core PWA Lock

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Prevent AI Studio, GitHub import triage, or contributors from misinterpreting the hybrid Kotlin Android WebView wrapper (`android-wrapper/`) as a signal to rewrite the core React PWA into Kotlin.
- **Summary:** Documents and enforces across `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `metadata.json`, `package.json`, `index.html`, `.github/structure.txt`, `.github/workflows/build-android-apk.yml`, and `android-wrapper/` (`README.md`, Gradle build files, `MainActivity.kt`) that the core PWA (`/src/`) MUST always stay React + Vite + TypeScript while `android-wrapper/` is strictly a thin hybrid WebView shell.
- **Tracked Files:** `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `metadata.json`, `package.json`, `index.html`, `android-wrapper/README.md`, `android-wrapper/build.gradle.kts`, `android-wrapper/settings.gradle.kts`, `android-wrapper/app/build.gradle.kts`, `android-wrapper/app/src/main/java/org/askkim/pedigree/wrapper/MainActivity.kt`, `.github/structure.txt`, `.github/workflows/build-android-apk.yml`

**Automated Invariants Checked:**
- `AGENTS.md` must contain `Core PWA MUST Always Stay in React`, `NEVER recode the site in Kotlin` — *AGENTS.md must explicitly define the hybrid wrapper boundary and forbid Kotlin rewrites during bootability recovery.*
- `README.md` must contain `Core PWA MUST Always Stay in React`, `Never Recode the PWA in Kotlin` — *Root README must immediately clarify the React + Vite + TypeScript core PWA vs thin android-wrapper/ split.*
- `ARCHITECTURE.md` must contain `Critical Hybrid Architecture Boundary`, `Never Convert PWA Away From React` — *ARCHITECTURE.md must define the thin Kotlin WebView shell vs mandatory React PWA architecture.*
- `metadata.json` must contain `React + Vite + TypeScript offline-first PWA`, `thin hybrid Kotlin WebView shell` — *AI Studio metadata.json must state that the core app is a React + Vite + TypeScript PWA.*
- `package.json` must contain `React + Vite + TypeScript offline-first PWA` — *package.json description must identify the React + Vite + TypeScript PWA stack and thin hybrid wrapper.*
- `index.html` must contain `NEVER CONVERT THIS PWA AWAY FROM REACT` — *HTML entry point must carry an explicit guard comment against converting the PWA into Kotlin.*
- `android-wrapper/README.md` must contain `Thin Hybrid Shell ONLY`, `NEVER convert, rewrite, or recode the core PWA into Kotlin` — *android-wrapper/ must explicitly warn readers that it is only a thin WebView container.*
- `android-wrapper/app/build.gradle.kts` must contain `CRITICAL HYBRID BOUNDARY` — *Android Gradle config must mark itself as a thin WebView shell packaging the React PWA.*

**Restoration Playbook if Overwritten:**
1. Ensure `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `metadata.json`, `package.json`, and `index.html` explicitly lock the core PWA to React + Vite + TypeScript.
2. Keep `android-wrapper/README.md` and the `CRITICAL HYBRID BOUNDARY` headers in `android-wrapper/build.gradle.kts`, `settings.gradle.kts`, `app/build.gradle.kts`, and `MainActivity.kt`.

### IMP-049: Client CRM, Buyer Waitlist, Reservations & Deposit Reminders

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Track buyer contacts, waitlist queues, animal/litter reservations, deposit due reminders, and printable sales agreements offline without cloud dependencies.
- **Summary:** Adds species-isolated local-first breeder CRM tracking buyer contacts (`ClientContact`), ranked waitlist inquiries (`WaitlistEntry`) with live unreserved animal/pairing match scoring (`findWaitlistMatches`), animal/litter-pick reservations (`AnimalReservation`) with sequential agreement numbering and deposit/balance progress (`evaluateReservationFinancials`), automated overdue/due/upcoming follow-up reminders (`evaluateCrmFollowUpReminders`) with 1-click Master Task creation, XSS-safe printable Sales Agreements with optional breeder logo and active withdrawal disclosures (`generateSalesAgreementHtml`), SQLite v5 persistence, sync outbox deltas, 2 CRM report presets, and `ClientCrmScreen.tsx` accessible from Species Dashboard & `C` shortcut.
- **Tracked Files:** `src/domain/models.ts`, `src/domain/clientCrm.ts`, `src/domain/__tests__/clientCrm.test.ts`, `src/domain/reportCatalog.ts`, `src/domain/reportGenerators.ts`, `src/domain/syncOutbox.ts`, `src/storage/webSqliteAdapter.ts`, `src/hooks/useBarnStore.ts`, `src/components/ClientCrmScreen.tsx`, `src/components/SpeciesDashboardScreen.tsx`, `src/App.tsx`

**Automated Invariants Checked:**
- `src/domain/models.ts` must contain `ClientContact`, `WaitlistEntry`, `AnimalReservation`, `RESERVATION_STATUSES`, `WAITLIST_STATUSES` — *ClientContact, WaitlistEntry, and AnimalReservation domain models and normalizers must remain intact.*
- `src/domain/clientCrm.ts` must contain `evaluateReservationFinancials`, `evaluateCrmFollowUpReminders`, `findWaitlistMatches`, `generateSalesAgreementHtml`, `formatReservationsCsv` — *Pure TS CRM financial evaluation, automated follow-up reminders, waitlist matching, CSV export, and printable Sales Agreement generator must stay zero-DOM.*
- `src/storage/webSqliteAdapter.ts` must contain `client_contacts`, `waitlist_entries`, `animal_reservations`, `saveClientContact`, `saveWaitlistEntry`, `saveAnimalReservation` — *SQLite schema v5 and adapter CRUD methods must store and hydrate CRM contacts, waitlist entries, and reservations.*
- `src/hooks/useBarnStore.ts` must contain `saveClientContact`, `saveWaitlistEntry`, `saveAnimalReservation`, `completeReservationSale`, `createCrmReminderTask` — *Store must expose species-isolated CRM mutations, atomic sale completion, and reminder task creation with delta outbox sync.*
- `src/components/ClientCrmScreen.tsx` must contain `ClientCrmScreen`, `generateSalesAgreementHtml`, `evaluateCrmFollowUpReminders`, `findWaitlistMatches` — *ClientCrmScreen must render reminders, reservation/deposit tracking, ranked waitlist matching, client directory, and printable sales agreements.*
- `src/App.tsx` must contain `ClientCrmScreen`, `route === 'crm'` — *Root router must lazy-load and mount ClientCrmScreen on route crm.*

**Restoration Playbook if Overwritten:**
1. Keep `ClientContact`, `WaitlistEntry`, and `AnimalReservation` interfaces and normalizers in `src/domain/models.ts` plus SQLite v5 tables in `src/storage/webSqliteAdapter.ts`.
2. Restore `src/domain/clientCrm.ts` and `src/domain/__tests__/clientCrm.test.ts` along with the 2 CRM presets in `reportCatalog.ts` and `reportGenerators.ts`.
3. Keep CRM mutations in `src/hooks/useBarnStore.ts` and wire `ClientCrmScreen.tsx` into `SpeciesDashboardScreen.tsx` and `App.tsx`.

### IMP-050: Alternative Certificates, Show Entry/Remark Cards & IAGARB Wool/Fiber Tracking

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Support alternative companion birth/breeding certificates, printable/emailable show documents directly from show rosters, family portrait & IAGARB Angora pedigree templates, and wool/fiber harvest logging.
- **Summary:** Adds privacy-scoped Pet-Sale Birth Certificates (omitting breeder contact info & pricing), official Breeding/Service Certificates, ARBA-style Show Entry Forms (`mailto:` + plain-text copy + Open/Youth/fees) & 4-up/1-up Show Remark Cards from ShowEvent rosters, Gen 0–2 multi-photo Family Portrait and IAGARB German Angora pedigree layouts, and SQLite v6 `wool_harvests` tracking via lazy-loaded `WoolHarvestPanel` with 7-position 100-pt IAGARB scoring and 90-day 325g shearing yield calculations.
- **Tracked Files:** `src/domain/models.ts`, `src/domain/woolFiber.ts`, `src/domain/alternativeCertificates.ts`, `src/domain/showDocuments.ts`, `src/domain/pedigreePrintStyles.ts`, `src/domain/syncAndExports.ts`, `src/domain/pdfExporter.ts`, `src/storage/webSqliteAdapter.ts`, `src/hooks/useBarnStore.ts`, `src/components/PrintPreviewModal.tsx`, `src/components/WoolHarvestPanel.tsx`, `src/components/HerdScreen.tsx`, `src/components/PedigreeScreen.tsx`, `src/components/BreedingScreen.tsx`, `src/components/SpeciesDashboardScreen.tsx`, `src/App.tsx`, `src/domain/__tests__/woolFiber.test.ts`, `src/domain/__tests__/alternativeCertificates.test.ts`, `src/domain/__tests__/showDocuments.test.ts`

**Automated Invariants Checked:**
- `src/domain/models.ts` must contain `WoolHarvest`, `IagarbScorecard`, `WOOL_HARVEST_METHODS`, `normalizeWoolHarvestMethod` — *WoolHarvest and IagarbScorecard domain models and normalizers must remain intact.*
- `src/domain/woolFiber.ts` must contain `IAGARB_JUDGING_POSITIONS`, `computeIagarbScoreTotal`, `evaluateIagarbEligibility`, `compute90DayEquivalentGrams`, `summarizeAnimalWoolHarvests` — *Pure TS IAGARB 100-point rubric, 325g/90-day performance yield normalization, and harvest summary calculators must stay zero-DOM.*
- `src/domain/alternativeCertificates.ts` must contain `generatePetBirthCertificateHtml`, `generateBreedingCertificateHtml`, `buildPetBirthCertificateFileName`, `buildBreedingCertificateFileName` — *Pure TS Pet-Sale Birth Certificate (no breeder contact/pricing) and Breeding Certificate generators must remain zero-DOM and XSS-safe.*
- `src/domain/showDocuments.ts` must contain `generateShowEntryFormHtml`, `generateShowRemarkCardsHtml`, `buildShowEntryMailtoUrl`, `buildShowEntryPlainTextSummary` — *Pure TS ARBA Show Entry Form, emailable plain-text/mailto dispatchers, and 4-up/1-up Remark Card generators must remain zero-DOM.*
- `src/domain/pedigreePrintStyles.ts` must contain `family_portrait`, `iagarb_angora` — *Family Portrait and IAGARB German Angora pedigree presets must stay registered.*
- `src/storage/webSqliteAdapter.ts` must contain `wool_harvests`, `saveWoolHarvest`, `deleteWoolHarvest` — *SQLite schema v6 must store and hydrate wool_harvests cleanly.*
- `src/hooks/useBarnStore.ts` must contain `saveWoolHarvest`, `deleteWoolHarvest` — *Store must expose species-isolated wool harvest mutations with delta outbox sync.*
- `src/components/WoolHarvestPanel.tsx` must contain `WoolHarvestPanel`, `onSaveWoolHarvest`, `IAGARB_JUDGING_POSITIONS` — *WoolHarvestPanel must provide lazy-loaded Wool / Fiber logging and IAGARB 100-pt judging scorecards.*
- `src/components/HerdScreen.tsx` must contain `generatePetBirthCertificateHtml`, `onSaveWoolHarvest`, `WoolHarvestPanel` — *HerdScreen must provide Pet-Sale Birth Certificate previews and mount WoolHarvestPanel.*
- `src/components/BreedingScreen.tsx` must contain `generateBreedingCertificateHtml`, `Breeding Cert` — *BreedingScreen must expose Breeding Certificate preview controls.*
- `src/components/SpeciesDashboardScreen.tsx` must contain `generateShowEntryFormHtml`, `generateShowRemarkCardsHtml`, `buildShowEntryMailtoUrl` — *SpeciesDashboardScreen must expose Show Entry Form and Remark Cards print/email previews directly from ShowEvents.*

**Restoration Playbook if Overwritten:**
1. Keep `WoolHarvest` and `IagarbScorecard` models in `src/domain/models.ts` and `wool_harvests` SQLite v6 schema in `src/storage/webSqliteAdapter.ts`.
2. Restore pure modules `src/domain/woolFiber.ts`, `src/domain/alternativeCertificates.ts`, and `src/domain/showDocuments.ts` with their unit tests.
3. Keep `family_portrait` & `iagarb_angora` rendering in `pedigreePrintStyles.ts`, `syncAndExports.ts`, and `pdfExporter.ts`, plus UI wiring in `WoolHarvestPanel.tsx`, `HerdScreen.tsx`, `PedigreeScreen.tsx`, `BreedingScreen.tsx`, `SpeciesDashboardScreen.tsx`, and `App.tsx`.

### IMP-051: Founder Loss / Heritability Analytics, Interactive Barn Scheduler Gantt & LAN P2P Outbox Sync

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Provide heritability trends, founder-loss analytics, drag-and-drop chore scheduling with smart escalation, and serverless LAN P2P outbox sync.
- **Summary:** Wires pure TypeScript path-summed founder & ancestor genetic contributions (`0.5^depth`), Lacy effective founders (`fe`), Lost/Endangered/Active founder bottleneck ledger, and mid-parent OLS heritability (`h²`) cohort trends (`pedigreeAnalytics.ts`) via lazy-loaded `FounderAndHeritabilityPanel` into both `PedigreeScreen.tsx` and `BreedingScreen.tsx`; wires pure UTC multi-day Gantt timeline, smart critical priority escalation (`barnScheduler.ts`), SQLite `barn_tasks.start_date_iso` persistence, `useBarnStore` task rescheduling/escalation/reconciliation mutations, and zero-server WebRTC DataChannel & folder delta reconciliation (`p2pSyncProtocol.ts`, `p2pLanChannel.ts`) via lazy-loaded `BarnSchedulerGantt` inside `SpeciesDashboardScreen.tsx`.
- **Tracked Files:** `src/domain/models.ts`, `src/domain/pedigreeAnalytics.ts`, `src/domain/barnScheduler.ts`, `src/domain/p2pSyncProtocol.ts`, `src/storage/p2pLanChannel.ts`, `src/storage/webSqliteAdapter.ts`, `src/hooks/useBarnStore.ts`, `src/components/FounderAndHeritabilityPanel.tsx`, `src/components/BarnSchedulerGantt.tsx`, `src/components/PedigreeScreen.tsx`, `src/components/BreedingScreen.tsx`, `src/components/SpeciesDashboardScreen.tsx`, `src/App.tsx`, `src/domain/__tests__/pedigreeAnalytics.test.ts`, `src/domain/__tests__/barnScheduler.test.ts`, `src/domain/__tests__/p2pSyncProtocol.test.ts`

**Automated Invariants Checked:**
- `src/domain/pedigreeAnalytics.ts` must contain `analyzeAnimalFounderContributions`, `analyzePairingFounderShift`, `analyzeSpeciesFounderLoss`, `analyzeSpeciesHeritabilityTrends` — *Pure TS founder contribution, effective founders fe, founder-loss ledger, and heritability h² calculators must remain zero-DOM.*
- `src/domain/barnScheduler.ts` must contain `evaluateTaskPriorityEscalation`, `buildPriorityEscalationUpdates`, `buildBarnGanttTimeline`, `shiftTaskDatesByDays`, `resizeTaskStartDateByDays` — *Pure TS Gantt timeline builder, UTC span shift/resize helpers, and critical-task escalation engine must remain zero-DOM.*
- `src/domain/p2pSyncProtocol.ts` must contain `encodeP2pSignalToken`, `decodeP2pSignalToken`, `createP2pDeltaWireMessage`, `parseP2pWireOrDeltaPayload`, `summarizeTaskReconciliation` — *Pure TS LAN P2P CP-LAN1 signaling codec, wire delta framing, and reconciliation summary helpers must remain intact.*
- `src/storage/p2pLanChannel.ts` must contain `supportsLanWebRtcP2p`, `createLanP2pSession`, `reconcileWithPickedSyncFolder` — *Zero-server WebRTC DataChannel (iceServers: []) and Sync Folder reconciliation bridge must remain wired.*
- `src/storage/webSqliteAdapter.ts` must contain `start_date_iso` — *SQLite barn_tasks table must persist and hydrate startDateIso across reloads.*
- `src/hooks/useBarnStore.ts` must contain `rescheduleTask`, `applySmartTaskEscalations`, `reconcileP2pOutboxOps` — *Store must expose serialized mutations for Gantt rescheduling, smart priority escalation, and P2P outbox reconciliation.*
- `src/components/FounderAndHeritabilityPanel.tsx` must contain `FounderAndHeritabilityPanel`, `analyzeSpeciesFounderLoss`, `analyzeSpeciesHeritabilityTrends` — *FounderAndHeritabilityPanel must render subject founder balance, herd bottleneck ledger, and cohort h² SVG trends.*
- `src/components/BarnSchedulerGantt.tsx` must contain `BarnSchedulerGantt`, `buildBarnGanttTimeline`, `createLanP2pSession` — *BarnSchedulerGantt must render interactive drag/resize Gantt lanes, smart escalations, and LAN P2P sync controls.*
- `src/components/PedigreeScreen.tsx` must contain `FounderAndHeritabilityPanel`, `mode="pedigree"` — *PedigreeScreen must lazy-mount FounderAndHeritabilityPanel in pedigree mode.*
- `src/components/BreedingScreen.tsx` must contain `FounderAndHeritabilityPanel`, `mode="breeding"` — *BreedingScreen must lazy-mount FounderAndHeritabilityPanel in breeding mode.*
- `src/components/SpeciesDashboardScreen.tsx` must contain `BarnSchedulerGantt`, `taskViewMode`, `onReconcileOutboxOps` — *SpeciesDashboardScreen must expose List/Gantt chore view switching and mount lazy-loaded BarnSchedulerGantt.*

**Restoration Playbook if Overwritten:**
1. Keep pure domain engines `src/domain/pedigreeAnalytics.ts`, `src/domain/barnScheduler.ts`, `src/domain/p2pSyncProtocol.ts`, `src/storage/p2pLanChannel.ts`, and their Vitest suites intact.
2. Keep `barn_tasks.start_date_iso` in `src/storage/webSqliteAdapter.ts` and `rescheduleTask`, `applySmartTaskEscalations`, and `reconcileP2pOutboxOps` in `src/hooks/useBarnStore.ts`.
3. Keep lazy-loaded `FounderAndHeritabilityPanel` mounted in `PedigreeScreen.tsx` & `BreedingScreen.tsx` and lazy-loaded `BarnSchedulerGantt` toggled inside `SpeciesDashboardScreen.tsx` & wired from `App.tsx`.

### IMP-052: Post-Import Bootability, Bundle Hygiene, Atomic SQLite Migrations & Memory Hardening

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Harden post-import booting stability, first-paint loading speed, bundle footprint, and mobile memory management without breaking offline-first guarantees.
- **Summary:** Restores `.env.example` (IMP-008), archives 3.6 MB AI Studio dumps out of `public/` into `docs/archive/aistudio-exports/`, enforces `NODE_ENV=production` in Android APK CI, removes explicit `: any` annotations (fixing a silent `AFTER_BRED` backup-parser bug), makes `index.html` preflight treat missing `indexedDB` as advisory so Safari Lockdown / Private Mode can enter Ephemeral Mode, loads Google Fonts asynchronously, arms boot-stability completion only after React store hydration (`!store.isLoading`), upgrades SQLite migrations to version-gated atomic `BEGIN`/`COMMIT`/`ROLLBACK` transactions with `PRAGMA table_info` checks and `{ lightweightPhotos: true }` pre-upgrade backups, bypasses OPFS `/tmp` staging for `<512 KB` iOS standalone PWA shares to preserve user activation, extracts pure `src/engine/binaryEncoding.ts` + eliminates all 3 Vite `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings + configures vendor/icon Rolldown code-splitting, defers non-critical startup probes/auto-repair off first paint, scopes `syncOperations` React state to sync-consuming routes, replaces `document.body` `MutationObserver` with `subscribeOpenDialogCount`, stabilizes `AnimalPhotoGallery` lazy hydration, and dehydrates Tier 3 mirror photos.
- **Tracked Files:** `.env.example`, `.github/workflows/build-android-apk.yml`, `index.html`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, `src/engine/binaryEncoding.ts`, `src/domain/deviceCapability.ts`, `src/domain/syncAndExports.ts`, `src/storage/storageProbes.ts`, `src/storage/opfsStorage.ts`, `src/storage/webSqliteAdapter.ts`, `src/hooks/useBarnStore.ts`, `src/utils/webFileActions.ts`, `src/utils/useAccessibleDialog.ts`, `src/components/AnimalPhotoGallery.tsx`, `src/components/CrashErrorBoundary.tsx`, `src/components/DevelopmentErrorBoundary.tsx`, `src/storage/__tests__/postImportHardening.test.ts`

**Automated Invariants Checked:**
- `.env.example` must contain `# No required environment variables.` — *Keep .env.example present with zero secret placeholders to satisfy IMP-008.*
- `.github/workflows/build-android-apk.yml` must contain `NODE_ENV: production` — *Android APK CI must force NODE_ENV=production so jsx-dev-runtime never ships in APK assets.*
- `index.html` must contain `indexedDbAvailable`, `media="print"`, `this.media='all'` — *Preflight must allow Safari Lockdown/Private Ephemeral Mode and keep Google Fonts non-render-blocking.*
- `vite.config.ts` must contain `codeSplitting`, `vendor-react`, `vendor-icons`, `vendor-sql` — *Rolldown code-splitting must isolate vendor chunks and consolidate lucide-react micro-chunks.*
- `src/engine/binaryEncoding.ts` must contain `utf8StringToBytes`, `bytesToUtf8String`, `bytesToBase64Pure`, `base64ToBytesPure`, `dataUrlToBinary`, `binaryToDataUrl` — *Pure TS binary/base64/dataURL encoding helpers must stay decoupled from fflate and DOM.*
- `src/storage/webSqliteAdapter.ts` must contain `PRAGMA table_info(`, `BEGIN TRANSACTION;`, `ROLLBACK;`, `this.loadSnapshotUnlocked({ lightweightPhotos: true })` — *SQLite migrations must be version-gated, PRAGMA-checked, atomic, and memory-bounded during pre-upgrade backups.*
- `src/storage/storageProbes.ts` must contain `registerIndexedDbOpfsDumper`, `triggerIndexedDbOpfsDump` — *Shared callback registry avoids circular dynamic import warnings for opfsStorage.*
- `src/utils/webFileActions.ts` must contain `shouldBypassOpfsForIosGesture` — *Small (<512 KB) iOS standalone PWA shares must bypass OPFS /tmp staging to preserve tap gesture activation.*
- `src/utils/useAccessibleDialog.ts` must contain `getOpenDialogCount`, `subscribeOpenDialogCount` — *Dialog count subscription replaces document.body MutationObserver in App.tsx.*
- `src/App.tsx` must contain `subscribeOpenDialogCount`, `__PEDIGREE_MARK_BOOT_STABLE__`, `routeKey="calendar-sync-confirm"` — *Root shell must mark boot stable after store hydration, track dialogs via subscription, and guard CalendarSyncConfirmModal.*
- `src/hooks/useBarnStore.ts` must contain `isSyncOperationsRoute`, `ensureMaxRevIndexInitialized`, `import('../domain/archiveInspector')` — *Store must defer non-critical startup probes, scope syncOperations state to sync routes, and dynamic-import cold modules.*
- `src/components/AnimalPhotoGallery.tsx` must contain `hydratedUrlsRef`, `inFlightPhotoIdsRef` — *Photo gallery lazy hydration must guard duplicate requests via refs instead of self-retriggering effect deps.*

**Restoration Playbook if Overwritten:**
1. Keep `.env.example` clean, keep AI Studio dumps archived in `docs/archive/aistudio-exports/` (never under `public/`), and preserve `NODE_ENV: production` in `.github/workflows/build-android-apk.yml`.
2. Preserve advisory `indexedDbAvailable` preflight & async Google Fonts in `index.html`, post-hydration `__PEDIGREE_MARK_BOOT_STABLE__` in `src/App.tsx`, and atomic `PRAGMA table_info` migrations in `src/storage/webSqliteAdapter.ts`.
3. Keep `src/engine/binaryEncoding.ts`, `triggerIndexedDbOpfsDump` in `storageProbes.ts`, `shouldBypassOpfsForIosGesture` in `webFileActions.ts`, `subscribeOpenDialogCount` in `useAccessibleDialog.ts`, Rolldown `codeSplitting` in `vite.config.ts`, and route-scoped `syncOperations` + deferred startup work in `useBarnStore.ts`.

### IMP-053: v0.1.0-alpha.2 Release Readiness: Targeted Strict TS, Cold-Start Splits, Worker Freeze Trim, Unified PWA+APK Release CI & Prompt Governance

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Prepare Community Pedigree cleanly for its v0.1.0-alpha.2 GitHub release tag with zero new features—optimizing cold-start payload, compiler strictness, mobile worker memory cleanup, unified PWA+Android APK release packaging, plan deletion on wrap-up, and mandatory improvement logging for significant changes.
- **Summary:** Enables 7 targeted strict TypeScript compiler checks in `tsconfig.json` (`alwaysStrict`, `noImplicitAny`, `noImplicitThis`, `strictBindCallApply`, `strictFunctionTypes`, `useUnknownInCatchVariables`, `noFallthroughCasesInSwitch`), converts Excel serial date parsing in `src/engine/codecs/archiveAndCsvUtils.ts` to calendar-safe `Date.UTC(1899, 11, 30 + serial)`, splits 7 cold domain modules (`barnBench`, `barnScheduler`, `p2pSyncProtocol`, `clientCrm`, `economicsLedger`, `feedInventory`, `importers/conflictResolver`) out of the initial entry bundle in `src/hooks/useBarnStore.ts`, hooks `src/storage/offThreadWorkerClient.ts` into `registerFreezeLifecycleListener` to terminate idle Web Workers immediately on mobile background hide/`pagehide`, upgrades `.github/workflows/release.yml` to verify cross-file version alignment (`0.1.0-alpha.2`), verify root + subpath builds, and attach both PWA `.zip` + `.sha256` and Android WebView `.apk` + `.sha256` artifacts to GitHub Releases, syncs `public/version.json`, Fastlane changelog, and release guides, updates `prompts/master_system_prompt.md` (and backlog/crash prompts) to delete wrapped-up plans and log every significant boot/load/memory change in `IMPROVEMENTS.md`, and removes completed crash-era plan files from `docs/archive/`.
- **Tracked Files:** `tsconfig.json`, `src/engine/codecs/archiveAndCsvUtils.ts`, `src/hooks/useBarnStore.ts`, `src/storage/offThreadWorkerClient.ts`, `.github/workflows/release.yml`, `public/version.json`, `fastlane/metadata/android/en-US/changelogs/1.txt`, `docs/HOW_TO_CREATE_A_RELEASE.md`, `.github/WORKFLOWS_GUIDE.md`, `README.md`, `prompts/master_system_prompt.md`, `prompts/start_new_backlog_prompt.md`, `prompts/resume_backlog_plan_prompt.md`, `prompts/fix_error_log_prompt.md`, `src/domain/__tests__/releaseReadiness.test.ts`

**Automated Invariants Checked:**
- `tsconfig.json` must contain `"noImplicitAny": true`, `"strictFunctionTypes": true`, `"useUnknownInCatchVariables": true`, `"noFallthroughCasesInSwitch": true` — *Targeted strict TypeScript checks must remain enabled to catch implicit-any and untyped catch regressions before release.*
- `src/engine/codecs/archiveAndCsvUtils.ts` must contain `Date.UTC(1899, 11, 30 + serial)` — *Excel serial date decoding must use explicit Date.UTC calendar offset math instead of raw millisecond addition.*
- `src/hooks/useBarnStore.ts` must contain `import('../domain/economicsLedger')`, `import('../domain/clientCrm')`, `import('../domain/barnBench')`, `import('../domain/barnScheduler')`, `import('../domain/p2pSyncProtocol')`, `import('../domain/feedInventory')`, `import('../domain/importers/conflictResolver')` — *Cold domain modules must remain dynamically imported inside async store handlers to keep the initial entry bundle lean.*
- `src/storage/offThreadWorkerClient.ts` must contain `terminateIdleArchiveWorker`, `archive-worker-freeze-trim`, `registerFreezeLifecycleListener` — *Idle archive/import Web Workers must terminate promptly on background hide/pagehide to release mobile RAM.*
- `.github/workflows/release.yml` must contain `Verify cross-file version alignment`, `release-android-apk:`, `publish-github-release:`, `release-pwa-dist` — *GitHub tag releases must verify version sync and package + attach both the PWA ZIP and Android WebView APKs with SHA-256 checksums.*
- `prompts/master_system_prompt.md` must contain `Plan Lifecycle (Delete on Wrap-Up)`, `Mandatory Improvement Logging (`IMPROVEMENTS.md` & `src/domain/improvementRegistry.ts`)` — *Master System Prompt must enforce deleting wrapped-up plan files and logging every significant boot/load/memory change in IMPROVEMENTS.md.*

**Restoration Playbook if Overwritten:**
1. Keep targeted strict TypeScript flags in `tsconfig.json` and calendar-safe `Date.UTC(1899, 11, 30 + serial)` in `src/engine/codecs/archiveAndCsvUtils.ts`.
2. Preserve dynamic `import(...)` lazy splits for the 7 cold modules in `src/hooks/useBarnStore.ts` and `terminateIdleArchiveWorker` background-freeze cleanup in `src/storage/offThreadWorkerClient.ts`.
3. Keep unified PWA ZIP + Android WebView APK + SHA-256 packaging and version-alignment checks in `.github/workflows/release.yml`, and retain the Plan Lifecycle and Mandatory Improvement Logging rules in `prompts/master_system_prompt.md`.

### IMP-054: Zero-Server Breeder Showcase & For-Sale Catalog Exporter

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Let breeders mark eligible livestock For Sale with asking price and buyer notes, configure public contact details in Barn Settings, and export a self-contained static HTML storefront & printable buyer stock sheet without any server.
- **Summary:** Adds `forSale`, `askingPriceCents`, and `saleNotes` fields plus `isAnimalAvailableForSale()` on `Animal`, optional public contact/tagline fields on `BarnSettings` (`breederEmail`, `breederPhone`, `breederLocation`, `breederWebsite`, `showcaseTagline`), `sanitizeSafeExternalHttpUrl()` + sync field allowlists in `inputSanitization.ts`, JSON v6 backup round-trip in `syncAndExports.ts`, atomic SQLite schema v7 migration (`for_sale`, `asking_price_cents`, `sale_notes` + `extra_settings_json`) in `webSqliteAdapter.ts`, pure TypeScript `src/domain/breederShowcase.ts` static HTML catalog + printable stock sheet generator (photos, 2-gen pedigrees, COI%, show/wool/carrier disclosures, reservation hold badges, medication withdrawal holds, QR badge, zero-dependency progressive search/filter, and XSS/SVG-safe sanitization), registers `breeder-showcase-html` in `src/domain/exporters/registry.ts`, adds For-Sale listing controls in `AnimalEditorModal.tsx`, breeder contact inputs in `SettingsAndSyncScreen.tsx`, `For Sale` herd filter + preview toggles in `HerdScreen.tsx`, and showcase photo hydration in `ImportExportHubScreen.tsx`.
- **Tracked Files:** `src/domain/models.ts`, `src/domain/inputSanitization.ts`, `src/domain/breederShowcase.ts`, `src/domain/exporters/registry.ts`, `src/domain/syncAndExports.ts`, `src/storage/webSqliteAdapter.ts`, `src/components/AnimalEditorModal.tsx`, `src/components/SettingsAndSyncScreen.tsx`, `src/components/HerdScreen.tsx`, `src/components/ImportExportHubScreen.tsx`, `src/domain/__tests__/breederShowcase.test.ts`

**Automated Invariants Checked:**
- `src/domain/models.ts` must contain `isAnimalAvailableForSale`, `forSale?: boolean`, `breederEmail?: string` — *Animal For-Sale eligibility helper and BarnSettings showcase contact fields must stay intact.*
- `src/domain/inputSanitization.ts` must contain `sanitizeSafeExternalHttpUrl` — *Showcase website links must enforce strict http/https protocol sanitization.*
- `src/domain/breederShowcase.ts` must contain `buildBreederShowcaseResult`, `generateBreederShowcaseHtml`, `buildBreederShowcaseFileName` — *Pure TypeScript zero-server showcase HTML + stock sheet generator must stay decoupled from DOM.*
- `src/domain/exporters/registry.ts` must contain `breeder-showcase-html`, `buildBreederShowcaseResult` — *Import/Export Hub exporter registry must retain breeder-showcase-html.*
- `src/domain/syncAndExports.ts` must contain `breederEmail`, `askingPriceCents` — *JSON backup parser must preserve breeder contact info and animal asking prices.*
- `src/storage/webSqliteAdapter.ts` must contain `SQLITE_SCHEMA_VERSION`, `for_sale`, `asking_price_cents` — *SQLite schema v7+ must persist and migrate For-Sale columns and contact settings atomically.*
- `src/components/AnimalEditorModal.tsx` must contain `askingPriceInput`, `saleNotes` — *Animal editor must expose For-Sale toggle, asking price, and buyer-facing listing notes.*
- `src/components/SettingsAndSyncScreen.tsx` must contain `breederEmail`, `showcaseTagline` — *Barn settings must expose public showcase contact info and catalog tagline.*
- `src/components/HerdScreen.tsx` must contain `For-Sale Catalog`, `generateBreederShowcaseHtml` — *Herd screen must expose For-Sale filter pill and live PrintPreviewModal catalog toggles.*
- `src/components/ImportExportHubScreen.tsx` must contain `breeder-showcase-html` — *Import/Export Hub must hydrate photos on Tier 2+ devices for breeder-showcase-html exports.*

**Restoration Playbook if Overwritten:**
1. Restore `BarnSettings` contact fields, `Animal` for-sale fields, and `isAnimalAvailableForSale` in `src/domain/models.ts`, plus `sanitizeSafeExternalHttpUrl` and sync field allowlists in `src/domain/inputSanitization.ts`.
2. Restore `src/domain/breederShowcase.ts`, register `breeder-showcase-html` in `src/domain/exporters/registry.ts`, preserve JSON round-trip in `src/domain/syncAndExports.ts`, and retain SQLite schema v7 columns in `src/storage/webSqliteAdapter.ts`.
3. Keep For-Sale controls in `AnimalEditorModal.tsx`, breeder contact settings in `SettingsAndSyncScreen.tsx`, For-Sale catalog preview/filter in `HerdScreen.tsx`, photo hydration in `ImportExportHubScreen.tsx`, and unit tests in `src/domain/__tests__/breederShowcase.test.ts`.

### IMP-055: Health Reference Wiki Links, Local Veterinary PDF Folder Pointer & External Backup Reminders

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Provide curated online links to external rabbit and livestock health wikis alongside a simple local device folder pointer for personal offline veterinary PDFs, paired with periodic reminders to back up external document folders.
- **Summary:** Adds a pure TypeScript curated health wiki index and reminder engine (`src/domain/healthReference.ts`) covering all 11 predefined species plus custom species substring resolution with strict `https://` URL sanitization (`sanitizeSafeExternalHttpUrl`); adds generic named directory-handle helpers in `src/storage/localSyncChannels.ts` reusing the existing `sync_handles` IDB store without bumping schema version; creates `src/storage/vetDocsFolder.ts` for read-only folder handle persistence, bounded depth/entry PDF scanning (`MAX_VET_PDF_SCAN_DEPTH = 2`, `MAX_VET_PDF_ENTRIES = 250`), path-note persistence, and configurable backup reminder cadence (`14/30/60/90` days + `7d` snooze); integrates full wipe/reset cleanup in `src/hooks/useBarnStore.ts`; builds lazy-loaded `HealthReferencePanel` & `HealthReferenceModal` with offline notice, disabled-with-explanation fallback on unsupported browsers (`IMP-019`), direct file-picker fallback, single-PDF `<iframe>` preview + `URL.revokeObjectURL` lifecycle cleanup; and wires periodic reminder banners and launchers into `App.tsx`, `SpeciesDashboardScreen.tsx`, `HerdScreen.tsx`, and `SettingsAndSyncScreen.tsx`.
- **Tracked Files:** `src/domain/healthReference.ts`, `src/storage/localSyncChannels.ts`, `src/storage/vetDocsFolder.ts`, `src/hooks/useBarnStore.ts`, `src/components/HealthReferencePanel.tsx`, `src/App.tsx`, `src/components/SpeciesDashboardScreen.tsx`, `src/components/HerdScreen.tsx`, `src/components/SettingsAndSyncScreen.tsx`, `src/domain/__tests__/healthReference.test.ts`, `src/storage/__tests__/vetDocsFolder.test.ts`

**Automated Invariants Checked:**
- `src/domain/healthReference.ts` must contain `HEALTH_WIKI_REFERENCES`, `getHealthWikiLinksForSpecies`, `evaluateVetDocsBackupReminder`, `filterAndSortVetPdfEntries`, `normalizeVetDocsFolderMeta` — *Pure TypeScript health wiki directory and external PDF folder backup reminder evaluator must remain DOM-free and strict https:// validated.*
- `src/storage/localSyncChannels.ts` must contain `saveNamedDirectoryHandleToIdb`, `loadNamedDirectoryHandleFromIdb`, `deleteNamedDirectoryHandleFromIdb`, `queryDirectoryHandleReadPermission` — *Shared IDB sync_handles accessors allow vetDocsFolder persistence without bumping the IDB schema version.*
- `src/storage/vetDocsFolder.ts` must contain `VET_DOCS_HANDLE_KEY`, `VET_DOCS_META_LS_KEY`, `connectVetDocsFolder`, `scanVetDocsDirectory`, `markVetDocsBackedUpNow`, `clearAllVetDocsFolderState` — *Vet PDF folder adapter must persist read-only directory handles, scan PDFs safely, track backup acknowledgments, and support full factory reset cleanup.*
- `src/hooks/useBarnStore.ts` must contain `clearAllVetDocsFolderState` — *Factory reset and sync-state wipe flows must clear stored vet PDF handles and metadata.*
- `src/components/HealthReferencePanel.tsx` must contain `HealthReferencePanel`, `HealthReferenceModal`, `platformBridge.openExternalUrl`, `URL.revokeObjectURL` — *Lazy health reference modal must route external links through IPlatformBridge and deterministically revoke PDF blob URLs.*
- `src/App.tsx` must contain `HealthReferenceModal`, `vetDocsReminder.showBanner`, `onOpenHealthReference` — *App shell must lazy-load HealthReferenceModal, surface periodic external PDF folder backup reminders, and pass launcher handlers to screens.*
- `src/components/SpeciesDashboardScreen.tsx` must contain `onOpenHealthReference` — *Species Dashboard must expose quick Health Wikis & Vet PDFs launcher.*
- `src/components/HerdScreen.tsx` must contain `onOpenHealthReference` — *Animal Health Journal must expose contextual Health Wikis & Vet PDFs launcher.*
- `src/components/SettingsAndSyncScreen.tsx` must contain `onOpenHealthReference` — *Barn Settings must expose Health Reference Wikis & Local Vet PDF Folder launcher.*

**Restoration Playbook if Overwritten:**
1. Restore pure TypeScript wiki links, species matcher, and reminder math in `src/domain/healthReference.ts` and tests in `src/domain/__tests__/healthReference.test.ts`.
2. Keep generic `saveNamedDirectoryHandleToIdb`/`loadNamedDirectoryHandleFromIdb`/`deleteNamedDirectoryHandleFromIdb` in `src/storage/localSyncChannels.ts` and restore `src/storage/vetDocsFolder.ts` + `src/storage/__tests__/vetDocsFolder.test.ts`.
3. Keep `clearAllVetDocsFolderState()` cleanup in `src/hooks/useBarnStore.ts`, lazy `HealthReferenceModal` + reminder banner in `src/App.tsx`, and `onOpenHealthReference` launchers in `SpeciesDashboardScreen.tsx`, `HerdScreen.tsx`, and `SettingsAndSyncScreen.tsx`.

### IMP-056: Restricted Health Wiki Article Sources Blocklist (House Rabbit Society & Custom Rules)

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Maintain a restricted sources list for health wiki article connections starting with House Rabbit Society.
- **Summary:** Removes House Rabbit Society (`rabbit.org`) from curated health wiki links and introduces a pure TypeScript restricted wiki sources engine (`DEFAULT_RESTRICTED_WIKI_SOURCES`, `findMatchingRestrictedWikiSource`, `isHealthWikiSourceRestricted`, `filterAllowedHealthWikiReferences`, `normalizeRestrictedWikiSources`) in `src/domain/healthReference.ts`; persists user-added custom restricted sources in `localStorage` via `src/storage/vetDocsFolder.ts` while keeping built-in restrictions locked; enforces click-time blocking and exposes a collapsible Restricted Wiki Sources manager inside `src/components/HealthReferencePanel.tsx`.
- **Tracked Files:** `src/domain/healthReference.ts`, `src/storage/vetDocsFolder.ts`, `src/components/HealthReferencePanel.tsx`, `src/domain/__tests__/healthReference.test.ts`, `src/storage/__tests__/vetDocsFolder.test.ts`

**Automated Invariants Checked:**
- `src/domain/healthReference.ts` must contain `DEFAULT_RESTRICTED_WIKI_SOURCES`, `restricted-house-rabbit-society`, `findMatchingRestrictedWikiSource`, `filterAllowedHealthWikiReferences`, `normalizeRestrictedWikiSources` — *House Rabbit Society must remain on the built-in restricted wiki sources list and excluded from curated health wiki links.*
  - Forbidden regression: `wiki-rabbit-hrs`
- `src/storage/vetDocsFolder.ts` must contain `RESTRICTED_WIKI_SOURCES_LS_KEY`, `readRestrictedWikiSources`, `addCustomRestrictedWikiSource`, `removeCustomRestrictedWikiSource` — *Custom restricted wiki sources must persist locally without allowing built-in restricted entries to be deleted.*
- `src/components/HealthReferencePanel.tsx` must contain `Restricted Wiki Sources`, `findMatchingRestrictedWikiSource`, `handleAddRestrictedSource` — *Health Reference panel must enforce restricted source checks at click time and let users view/manage restricted sources.*

**Restoration Playbook if Overwritten:**
1. Restore `DEFAULT_RESTRICTED_WIKI_SOURCES` (with `House Rabbit Society` / `rabbit.org`), `findMatchingRestrictedWikiSource`, and `filterAllowedHealthWikiReferences` in `src/domain/healthReference.ts`.
2. Restore `readRestrictedWikiSources`, `addCustomRestrictedWikiSource`, and `removeCustomRestrictedWikiSource` in `src/storage/vetDocsFolder.ts`.
3. Restore the click-time `findMatchingRestrictedWikiSource` guard and collapsible `Restricted Wiki Sources` manager in `src/components/HealthReferencePanel.tsx`.

### IMP-057: Preferred Wiki Sources, English USA (en-US) App Locale & Multi-Language Wiki Filter

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Create a preferred sources list for health wiki links (Merck Veterinary Manual, USDA & equivalent federal agencies in all countries, and state/federal/land-grant universities in all countries), define the app locale as English USA (en-US), and require English wiki sources via an extensible multi-language array.
- **Summary:** Defines `APP_LOCALE = 'en-US'` (`APP_LOCALE_METADATA`, `normalizeBcp47LanguageTag`, `extractBaseLanguageCode`) in `src/domain/models.ts` and updates `index.html` + `vite.config.ts` PWA manifest to `en-US`; adds `DEFAULT_PREFERRED_WIKI_SOURCES` (`Merck Veterinary Manual`, global federal ag/vet agencies, and global state/federal/land-grant universities), `DEFAULT_ALLOWED_WIKI_LANGUAGES = ['en']`, `doesWikiLanguageMatchAllowed`, `normalizeAllowedWikiLanguages`, `findMatchingPreferredWikiSource`, and `sortHealthWikiReferencesWithPreferred` in `src/domain/healthReference.ts`; persists custom preferred sources and multi-language arrays in `src/storage/vetDocsFolder.ts`; and renders preferred source prioritization and management inside `src/components/HealthReferencePanel.tsx`.
- **Tracked Files:** `src/domain/models.ts`, `index.html`, `vite.config.ts`, `src/domain/healthReference.ts`, `src/storage/vetDocsFolder.ts`, `src/components/HealthReferencePanel.tsx`, `src/domain/__tests__/healthReference.test.ts`, `src/storage/__tests__/vetDocsFolder.test.ts`

**Automated Invariants Checked:**
- `src/domain/models.ts` must contain `APP_LOCALE = 'en-US'`, `APP_LOCALE_METADATA`, `normalizeBcp47LanguageTag`, `extractBaseLanguageCode` — *Application code and translation baseline must remain explicitly typed as English (United States) `en-US`.*
- `index.html` must contain `<html lang="en-US">` — *Root HTML document language must declare English USA (`en-US`).*
- `vite.config.ts` must contain `lang: 'en-US'` — *PWA web app manifest must declare `lang: "en-US"`.*
- `src/domain/healthReference.ts` must contain `DEFAULT_PREFERRED_WIKI_SOURCES`, `DEFAULT_ALLOWED_WIKI_LANGUAGES`, `doesWikiLanguageMatchAllowed`, `normalizeAllowedWikiLanguages`, `findMatchingPreferredWikiSource`, `sortHealthWikiReferencesWithPreferred` — *Preferred sources (Merck, global federal ag/vet agencies, global universities) and configurable multi-language English filtering must remain intact.*
- `src/storage/vetDocsFolder.ts` must contain `PREFERRED_WIKI_SOURCES_LS_KEY`, `ALLOWED_WIKI_LANGUAGES_LS_KEY`, `readPreferredWikiSources`, `readAllowedWikiLanguages`, `setAllowedWikiLanguages` — *Custom preferred wiki sources and multi-language wiki filters must persist locally with built-in locking.*
- `src/components/HealthReferencePanel.tsx` must contain `Preferred Wiki Sources`, `findMatchingPreferredWikiSource`, `handleAddPreferredSource`, `APP_LOCALE` — *Health Reference panel must surface preferred source badges, language requirements, and preferred source management.*

**Restoration Playbook if Overwritten:**
1. Restore `APP_LOCALE = 'en-US'` and BCP 47 helpers in `src/domain/models.ts`, `<html lang="en-US">` in `index.html`, and `lang: 'en-US'` in `vite.config.ts`.
2. Restore `DEFAULT_PREFERRED_WIKI_SOURCES`, `DEFAULT_ALLOWED_WIKI_LANGUAGES`, and language/preferred matching + sorting in `src/domain/healthReference.ts`.
3. Restore `readPreferredWikiSources`/`readAllowedWikiLanguages`/`setAllowedWikiLanguages` in `src/storage/vetDocsFolder.ts` and UI controls in `src/components/HealthReferencePanel.tsx`.

### IMP-058: Breeding Calendar Moon/Holiday/Weather Overlays, Mileage & Tax Report Log & Personal Barn Journal

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Add offline moon-phase and holiday markers plus an optional online 7-day weather forecast strip to the Breeding Calendar, track IRS-deductible farm/show mileage with annual tax reports, and add a date-organized Personal Barn Journal with rich text notes, color categories, star ratings, and full-text search.
- **Summary:** Introduces pure TypeScript `src/domain/breedingCalendar.ts` (synodic moon-phase engine, Gregorian Easter & US/seasonal holiday calculator, monthly calendar grid builder, WMO code mapping) paired with strictly opt-in Open-Meteo client `src/storage/weatherForecast.ts` and `src/components/BreedingCalendarPanel.tsx` inside `BreedingScreen.tsx`; creates `src/domain/mileageTaxLog.ts` (IRS standard mileage presets, integer-cent deduction calculations, formula-safe CSV and XSS-safe annual tax HTML) with `src/components/MileageTaxPanel.tsx` inside `EconomicsLedgerScreen.tsx`; builds `src/domain/barnJournal.ts` (rich-text AST notes via `parseMemoBlocks`, color categories, 0–5 star ratings, pinning, `#tag` hygiene, multi-token full-text search, Markdown/CSV/Print exports) and `src/components/BarnJournalScreen.tsx` at route `journal`; and persists `mileage_logs`, `journal_entries`, and `weatherForecast` settings across SQLite schema v8 (`webSqliteAdapter.ts`), JSON v5/ZIP exports, sample-data purging, cross-species migration, and delta sync outbox (`IMP-025`).
- **Tracked Files:** `src/domain/models.ts`, `src/domain/breedingCalendar.ts`, `src/domain/mileageTaxLog.ts`, `src/domain/barnJournal.ts`, `src/storage/weatherForecast.ts`, `src/storage/webSqliteAdapter.ts`, `src/hooks/useBarnStore.ts`, `src/components/BreedingCalendarPanel.tsx`, `src/components/MileageTaxPanel.tsx`, `src/components/BarnJournalScreen.tsx`, `src/components/BreedingScreen.tsx`, `src/components/EconomicsLedgerScreen.tsx`, `src/components/SpeciesDashboardScreen.tsx`, `src/App.tsx`, `src/domain/__tests__/breedingCalendar.test.ts`, `src/domain/__tests__/mileageTaxLog.test.ts`, `src/domain/__tests__/barnJournal.test.ts`

**Automated Invariants Checked:**
- `src/domain/breedingCalendar.ts` must contain `computeMoonPhaseForDateIso`, `getHolidaysForYear`, `buildBreedingCalendarMonth`, `formatTemperatureForUnit` — *Pure TypeScript moon-phase, holiday, and monthly calendar computation must stay DOM-free and UTC-deterministic.*
- `src/storage/weatherForecast.ts` must contain `searchWeatherLocations`, `fetchWeeklyWeatherForecast`, `clearWeatherForecastCache` — *Optional Open-Meteo 7-day forecast client must respect connectivity checks, cache TTL, and reset clearing.*
- `src/domain/mileageTaxLog.ts` must contain `computeMileageLogDeductionCents`, `evaluateAnnualMileageTaxSummary`, `exportMileageTaxCsv`, `generateAnnualMileageTaxHtml` — *IRS mileage tax deduction calculations and formula/HTML-escaped annual exports must remain pure TypeScript.*
- `src/domain/barnJournal.ts` must contain `normalizeBarnJournalEntry`, `filterAndSearchJournalEntries`, `groupJournalEntriesByMonthAndDate`, `exportBarnJournalMarkdown`, `generateBarnJournalHtml` — *Personal Barn Journal search, grouping, tag normalization, and exports must remain DOM-free and AST-sanitized.*
- `src/storage/webSqliteAdapter.ts` must contain `SQLITE_SCHEMA_VERSION`, `mileage_logs`, `journal_entries` — *SQLite schema must create and migrate mileage_logs and journal_entries tables atomically.*
- `src/hooks/useBarnStore.ts` must contain `saveMileageLog`, `deleteMileageLog`, `saveJournalEntry`, `deleteJournalEntry` — *Store must expose persisted CRUD mutators for mileage logs and journal entries.*
- `src/App.tsx` must contain `BarnJournalScreen`, `route === 'journal'` — *App router must lazy-load and mount BarnJournalScreen at route journal.*

**Restoration Playbook if Overwritten:**
1. Restore types (`MileageLog`, `BarnJournalEntry`, `WeatherForecastSettings`) in `src/domain/models.ts` plus pure engines `breedingCalendar.ts`, `mileageTaxLog.ts`, and `barnJournal.ts`.
2. Restore `src/storage/weatherForecast.ts`, SQLite schema v8 (`mileage_logs`, `journal_entries`) in `webSqliteAdapter.ts`, and CRUD actions in `useBarnStore.ts`.
3. Restore `BreedingCalendarPanel.tsx` in `BreedingScreen.tsx`, `MileageTaxPanel.tsx` in `EconomicsLedgerScreen.tsx`, and `BarnJournalScreen.tsx` at route `journal` in `App.tsx`.

### IMP-059: The Judge's Notebook (Dedicated Show Judge Module)

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Species & Herd UX (`species-ux`)
- **Origin:** Session Improvement
- **User Goal:** Add an optional module for show judges to manage assigned show dates, club contacts, travel mileage, judging expenses, bid statuses, and judging contracts.
- **Summary:** Introduces optional show-judge models (`enableJudgeNotebook`, `JudgeClubContact`, `JudgeAssignment`, `JudgeExpense`) in `src/domain/models.ts`; implements pure TypeScript DOM-free engine `src/domain/judgeNotebook.ts` (normalizers, draft factories, double-booking date conflict detection, `MileageLog`-integrated financials & reimbursements, annual summary, formula-safe CSV exports, and XSS-escaped printable HTML Judging Agreements & Annual Summary Reports); persists `judge_clubs`, `judge_assignments`, and `judge_expenses` tables across SQLite schema v9 (`webSqliteAdapter.ts`), JSON/ZIP backups, delta sync outbox, sample-data purging, species migration, and health repair; exposes store CRUD actions in `src/hooks/useBarnStore.ts`; and renders opt-in `src/components/JudgeNotebookScreen.tsx` at route `judge` (`G` shortcut) with dashboard and Settings toggles.
- **Tracked Files:** `src/domain/models.ts`, `src/domain/judgeNotebook.ts`, `src/storage/storageAdapter.ts`, `src/storage/webSqliteAdapter.ts`, `src/domain/syncOutbox.ts`, `src/domain/inputSanitization.ts`, `src/domain/syncAndExports.ts`, `src/domain/backupArchive.ts`, `src/domain/backupStatus.ts`, `src/domain/backupVault.ts`, `src/domain/sampleData.ts`, `src/domain/speciesMigration.ts`, `src/domain/dataHealthCheck.ts`, `src/hooks/useBarnStore.ts`, `src/components/JudgeNotebookScreen.tsx`, `src/components/SettingsAndSyncScreen.tsx`, `src/components/SpeciesDashboardScreen.tsx`, `src/App.tsx`, `src/domain/__tests__/judgeNotebook.test.ts`

**Automated Invariants Checked:**
- `src/domain/models.ts` must contain `enableJudgeNotebook?: boolean`, `JudgeClubContact`, `JudgeAssignment`, `JudgeExpense` — *BarnSettings must preserve the optional enableJudgeNotebook flag alongside Judge domain interfaces.*
- `src/domain/judgeNotebook.ts` must contain `detectJudgeDateConflicts`, `evaluateJudgeAssignmentFinancials`, `summarizeJudgeNotebook`, `exportJudgeAssignmentsCsv`, `generateJudgeContractHtml`, `generateJudgeSummaryReportHtml` — *Pure TypeScript Judge Notebook conflict checks, mileage/expense calculations, CSV exports, and XSS-safe HTML contracts must remain DOM-free.*
- `src/storage/webSqliteAdapter.ts` must contain `SQLITE_SCHEMA_VERSION = 9`, `judge_clubs`, `judge_assignments`, `judge_expenses` — *SQLite schema v9 must create and migrate judge_clubs, judge_assignments, and judge_expenses.*
- `src/storage/sqliteSnapshotReaders.ts` must contain `enableJudgeNotebook` — *Snapshot reads must hydrate enableJudgeNotebook from barn_settings, since the settings row is now mapped in the snapshot readers.*
- `src/hooks/useBarnStore.ts` must contain `saveJudgeClub`, `deleteJudgeClub`, `saveJudgeAssignment`, `deleteJudgeAssignment`, `saveJudgeExpense`, `deleteJudgeExpense` — *Store must expose outbox-tracked CRUD mutators for Judge clubs, assignments, and expenses.*
- `src/components/JudgeNotebookScreen.tsx` must contain `JudgeNotebookScreen`, `detectJudgeDateConflicts`, `generateJudgeContractHtml`, `PrintPreviewModal` — *JudgeNotebookScreen must provide the opt-in gate, conflict alerts, financial tabs, and printable contract preview.*
- `src/App.tsx` must contain `JudgeNotebookScreen`, `route === 'judge'` — *App router must lazy-load and mount JudgeNotebookScreen at route 'judge'.*

**Restoration Playbook if Overwritten:**
1. Restore Judge types and `enableJudgeNotebook` in `src/domain/models.ts` plus pure engine `src/domain/judgeNotebook.ts`.
2. Restore SQLite schema v9 tables (`judge_clubs`, `judge_assignments`, `judge_expenses`) in `webSqliteAdapter.ts` and sync/export wiring.
3. Restore CRUD methods in `useBarnStore.ts`, `JudgeNotebookScreen.tsx`, Settings toggle, Dashboard launcher, and route `judge` in `App.tsx`.

### IMP-060: Optional Cloud App-Folder Sync (Google Drive AppFolder / OneDrive AppRoot) & 403/507 Quota Circuit Breaker

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Diagnostics & Sync (`diagnostics-sync`)
- **Origin:** Session Improvement
- **User Goal:** Support strictly optional app-folder cloud delta sync with tight-storage incremental chunking and an immediate 403/507 quota circuit breaker that protects local IndexedDB writes.
- **Summary:** Adds strictly opt-in personal cloud sync (`enabled: false` by default, zero Firebase, zero `.env` secrets) targeting isolated Google Drive `appDataFolder` and OneDrive `special/approot` directories using memory-only OAuth tokens and PKCE; plans incremental delta chunks that automatically downshift to tight-storage chunking (`25 ops / 48 KiB`) when storage usage or device tier is constrained; and intercepts HTTP 403/507 quota responses with an immediate persistent circuit breaker that pauses automated cloud syncs, prunes oldest rolling cloud backups, surfaces persistent banners in `App.tsx` and Sync panels, and never blocks or rolls back local IndexedDB writes.
- **Tracked Files:** `src/domain/cloudAppFolderSync.ts`, `src/storage/cloudAppFolderSync.ts`, `src/hooks/useBarnStore.ts`, `src/components/CloudAppFolderSyncPanel.tsx`, `src/components/ImportExportHubScreen.tsx`, `src/components/SettingsAndSyncScreen.tsx`, `src/App.tsx`, `src/domain/__tests__/cloudAppFolderSync.test.ts`, `src/storage/__tests__/cloudAppFolderSync.test.ts`

**Automated Invariants Checked:**
- `src/domain/cloudAppFolderSync.ts` must contain `planIncrementalCloudDeltaChunks`, `classifyCloudHttpResponse`, `tripCloudQuotaCircuitBreaker`, `selectRollingCloudBackupsToPrune`, `shouldRunAutomatedCloudSync` — *Pure TypeScript incremental delta chunk planner, HTTP 403/507 classifier, circuit breaker state machine, and rolling backup pruner must remain DOM-free.*
- `src/storage/cloudAppFolderSync.ts` must contain `memoryTokensByProvider`, `createGoogleDriveAppFolderTransport`, `createOneDriveAppRootTransport`, `runCloudAppFolderSync` — *Cloud app-folder transport must keep OAuth tokens strictly in JS memory, isolate appDataFolder/approot, and never block or roll back local IndexedDB writes.*
- `src/hooks/useBarnStore.ts` must contain `executeCloudAppFolderSync`, `scheduleBackgroundCloudSync`, `resetAndRetryCloudSync`, `dismissCloudCircuitBreakerWarning` — *Store must schedule non-blocking background cloud delta sync after outbox commits and expose manual sync, reset-and-retry, and warning dismissal controls.*
- `src/components/CloudAppFolderSyncPanel.tsx` must contain `CloudAppFolderSyncPanel`, `Reset Circuit Breaker`, `Sync Cloud App-Folder Now` — *Cloud App-Folder Sync panel must provide opt-in provider/token controls, tight-storage chunk indicators, and circuit breaker reset actions.*
- `src/App.tsx` must contain `store.cloudSyncState.circuitBreaker.tripped`, `store.dismissCloudCircuitBreakerWarning`, `cloudSyncState={store.cloudSyncState}` — *App shell must display the persistent global 403/507 quota circuit breaker warning banner and wire cloud sync state into ImportExportHubScreen and SettingsAndSyncScreen.*

**Restoration Playbook if Overwritten:**
1. Restore pure chunking, HTTP 403/507 classification, and circuit breaker state helpers in `src/domain/cloudAppFolderSync.ts`.
2. Restore memory-only OAuth token store, Google Drive/OneDrive transports, and cross-tab-locked coordinator in `src/storage/cloudAppFolderSync.ts`.
3. Restore non-blocking `scheduleBackgroundCloudSync`, `CloudAppFolderSyncPanel.tsx`, and global persistent circuit breaker warning banner in `useBarnStore.ts`, `ImportExportHubScreen.tsx`, `SettingsAndSyncScreen.tsx`, and `App.tsx`.

### IMP-061: Developer Console Tabbed Reorganization, Collapsible Subunits & OPFS/Runtime Telemetry

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Diagnostics & Sync (`diagnostics-sync`)
- **Origin:** Session Improvement
- **User Goal:** Optimize the developer page, identify and surface unadded useful internal tools, organize the workspace into clean tabbed and collapsible subunits with a header Open All toggle to improve UI/UX.
- **Summary:** Reorganizes "The Development" (`DevelopmentScreen.tsx`) with an always-open title header containing an "Open All Sections / Collapse All Sections" toggle, 4 segmented workspace tabs (`Storage & OPFS`, `Runtime & Sync`, `Logs & Support`, `Maintenance & Resets`), and 15 individually collapsible subunits (`createDefaultSubunitOpenMap(false)` — including the host telemetry bar, the permanent non-closeable 5-tier comparison matrix `data-permanent-tier-hierarchy="true"`, and modular `DiagnosticsAndSupportPanel` `visibleSections` + `collapsible` cards). Surfaces previously unexposed storage and runtime utilities: read-only OPFS `/tmp`/`/backups`/`/archives` inspector (`inspectOpfsNamespaces`), OPFS canary & orphan sweep controls, Prior-Use Sentinel & prune sync warning status, 20-collection `computeSnapshotCollectionFootprint`, 14-signal browser compatibility matrix, idle Archive Worker heap reclaim, live IDB/BroadcastChannel/WebLocks/OPFS handle counters (`getTrackedActiveResourceCounts`, `getActiveOpfsHandleCount`), Freeze Queue controls, clock skew causality & release manifest diff, Sync Outbox/Cloud breaker status, and Native Bridge event log.
- **Tracked Files:** `src/domain/developmentGuardrails.ts`, `src/domain/__tests__/developmentGuardrails.test.ts`, `src/storage/storageProbes.ts`, `src/storage/opfsTempStream.ts`, `src/storage/opfsStorage.ts`, `src/components/DiagnosticsAndSupportPanel.tsx`, `src/components/DevelopmentScreen.tsx`, `src/App.tsx`

**Automated Invariants Checked:**
- `src/domain/developmentGuardrails.ts` must contain `DEVELOPER_CONSOLE_TABS`, `DEVELOPER_CONSOLE_SUBUNIT_IDS`, `createDefaultSubunitOpenMap`, `normalizeDeveloperConsoleTab`, `computeSnapshotCollectionFootprint` — *Pure TypeScript developer console tab registry, 15-subunit collapsible state helpers, and 20-collection snapshot footprint calculator must remain DOM-free.*
- `src/storage/storageProbes.ts` must contain `getTrackedActiveResourceCounts` — *Storage probes must expose live IDB connection/transaction, BroadcastChannel, and Web Lock resource counts for runtime inspection.*
- `src/storage/opfsStorage.ts` must contain `inspectOpfsNamespaces`, `getActiveOpfsHandleCount`, `getActiveTempFiles` — *OPFS storage adapter must expose read-only namespace inspection across /tmp, /backups, and /archives alongside live OPFS handle counters.*
- `src/components/DiagnosticsAndSupportPanel.tsx` must contain `visibleSections`, `collapsible` — *DiagnosticsAndSupportPanel must support section filtering (`all`, `logs-and-support`, `maintenance`) and optional collapsible outer wrapping without breaking standalone rendering.*
- `src/components/DevelopmentScreen.tsx` must contain `DEVELOPER_CONSOLE_TABS`, `DEVELOPER_CONSOLE_SUBUNIT_IDS`, `createDefaultSubunitOpenMap`, `Open All Sections`, `inspectOpfsNamespaces`, `computeSnapshotCollectionFootprint`, `detectCurrentBrowserCompatibility`, `getTrackedActiveResourceCounts` — *DevelopmentScreen must keep the title header open with an Open All Sections toggle, make all 15 subunits collapsible, and surface OPFS inspection, snapshot footprint, browser compatibility matrix, and live handle telemetry.*
- `src/App.tsx` must contain `syncOperations={store.syncOperations}`, `backupSyncStatus={store.backupSyncStatus}` — *App shell must pass live sync outbox operations and backup sync folder status into DevelopmentScreen.*

**Restoration Playbook if Overwritten:**
1. Restore `DEVELOPER_CONSOLE_TABS`, `DEVELOPER_CONSOLE_SUBUNIT_IDS`, `createDefaultSubunitOpenMap`, `normalizeDeveloperConsoleTab`, and `computeSnapshotCollectionFootprint` in `src/domain/developmentGuardrails.ts`.
2. Restore `getTrackedActiveResourceCounts` in `src/storage/storageProbes.ts`, plus `getActiveOpfsHandleCount`, `getActiveTempFiles`, and `inspectOpfsNamespaces` in `src/storage/opfsTempStream.ts` and `src/storage/opfsStorage.ts`.
3. Restore `visibleSections` and `collapsible` props in `src/components/DiagnosticsAndSupportPanel.tsx`, the collapsible 15-subunit tabbed workspace layout + header Open All toggle + telemetry cards in `src/components/DevelopmentScreen.tsx`, and live sync props in `src/App.tsx`.

### IMP-062: Alpha-to-Release Optimization: CI & Android APK Hardening, IndexedDB Quota Recovery, Print Stage XSS Sanitization & Sub-500kB Bundle Splits

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Prepare Community Pedigree from Alpha to release with zero new features by fixing highest-risk CI, storage, security, and cold-start bundle bottlenecks while guaranteeing bootability.
- **Summary:** Restores clean `.env.example` (IMP-008/IMP-052); scopes `NODE_ENV: production` strictly to the Vite build step in `.github/workflows/build-android-apk.yml` so `npm install` never skips `devDependencies` (`vitest`, `tsx`, `typescript`, `vite-plugin-pwa`); adds `status.json` to Android `PedigreeAssetPathHandler.kt` `Cache-Control: no-cache`; implements `executeIdbWriteWithQuotaRecovery` in `src/storage/webSqliteAdapter.ts` to purge OPFS `/tmp` and non-essential fallback caches and retry once on `QuotaExceededError`; hardens `#barn-print-stage` in `src/components/PrintPreviewModal.tsx` with `sanitizePrintStageHtml` + DOM node/attribute scrubbing; decouples `src/domain/backupVault.ts` from `backupArchive.ts` via direct `./binaryEncoding` imports (eliminating Vite `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings); converts cold imports (`geneticsEngine`, `syncAndExports`, `weatherForecast`) in `src/hooks/useBarnStore.ts` and `improvementRegistry` (~206 kB) in `src/components/DiagnosticsAndSupportPanel.tsx` to on-demand dynamic imports; and refines Rolldown `codeSplitting` groups with `includeDependenciesRecursively: false` in `vite.config.ts`, cutting `index-*.js` from 645 kB to 350 kB (-45.8%) and `DevelopmentScreen` from 339 kB to 136 kB (-59.9%) with zero Vite >500 kB chunk warnings.
- **Tracked Files:** `.env.example`, `.github/workflows/build-android-apk.yml`, `android-wrapper/app/src/main/java/org/askkim/pedigree/wrapper/PedigreeAssetPathHandler.kt`, `src/storage/webSqliteAdapter.ts`, `src/components/PrintPreviewModal.tsx`, `src/domain/backupVault.ts`, `src/hooks/useBarnStore.ts`, `src/components/DiagnosticsAndSupportPanel.tsx`, `vite.config.ts`, `src/utils/__tests__/printPreviewHelpers.test.ts`, `src/domain/__tests__/releaseReadiness.test.ts`

**Automated Invariants Checked:**
- `.github/workflows/build-android-apk.yml` must contain `Install PWA dependencies & run verification suite`, `Build production PWA bundle (root path)`, `NODE_ENV: production` — *Android APK CI must install devDependencies without NODE_ENV=production and apply NODE_ENV=production strictly to the Vite production build step.*
- `android-wrapper/app/src/main/java/org/askkim/pedigree/wrapper/PedigreeAssetPathHandler.kt` must contain `resolvedPath == "status.json"` — *Android WebView asset handler must serve status.json with Cache-Control: no-cache alongside version.json.*
- `src/storage/webSqliteAdapter.ts` must contain `executeIdbWriteWithQuotaRecovery`, `purgeOpfsTmp` — *Primary IndexedDB writes must catch QuotaExceededError, purge OPFS /tmp and non-essential fallback caches, and retry once before failing.*
- `src/components/PrintPreviewModal.tsx` must contain `sanitizePrintStageHtml` — *Print stage DOM mounting must strip executable tags, inline event handlers, and dangerous URLs before inserting HTML into #barn-print-stage.*
- `src/domain/backupVault.ts` must contain `from '@engine/binaryEncoding'` — *backupVault.ts must import binary encoding helpers directly from binaryEncoding.ts instead of pulling backupArchive.ts into the startup graph.*
- `src/components/DiagnosticsAndSupportPanel.tsx` must contain `loadImprovementRegistryModule`, `import('../domain/improvementRegistry')` — *DiagnosticsAndSupportPanel must lazy-load the 200+ kB improvementRegistry manifest on demand instead of bloating DevelopmentScreen.*
- `vite.config.ts` must contain `storage-sqlite`, `core-backups`, `improvement-registry`, `includeDependenciesRecursively: false` — *Rolldown codeSplitting must isolate app storage, backup, domain, and registry chunks with includeDependenciesRecursively: false so no chunk exceeds 500 kB.*

**Restoration Playbook if Overwritten:**
1. Keep `.env.example` clean, keep `NODE_ENV: production` scoped only to `npm run build` in `.github/workflows/build-android-apk.yml`, and preserve `resolvedPath == "status.json"` no-cache handling in `PedigreeAssetPathHandler.kt`.
2. Preserve `executeIdbWriteWithQuotaRecovery` in `src/storage/webSqliteAdapter.ts` and `sanitizePrintStageHtml` in `src/components/PrintPreviewModal.tsx`.
3. Keep `backupVault.ts` importing from `./binaryEncoding`, keep dynamic imports of `geneticsEngine`, `syncAndExports`, and `weatherForecast` in `src/hooks/useBarnStore.ts`, keep lazy `loadImprovementRegistryModule` in `DiagnosticsAndSupportPanel.tsx`, and retain isolated Rolldown `codeSplitting` groups in `vite.config.ts`.

### IMP-063: Mobile Chrome Dev Preview Boot Memory Guard: Inline Sourcemap Stripping, Direct Lucide Icon ESM & Lazy Error-Boundary Export

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Fix mobile Chrome Preview iframe Aw Snap crashes on startup by eliminating excessive dev-mode JS parse memory and inline source map bloat.
- **Summary:** Adds dev-only `devInlineSourcemapStripPlugin` (stripping ~9.5 MB of base64 inline sourcemaps from served JS/CSS responses) and `devLucideDirectImportPlugin` + `optimizeDeps.exclude: ['lucide-react']` (rewriting `lucide-react` barrel imports to direct per-icon ESM files and eliminating the 3.72 MB monolithic icon bundle and 504 dep re-optimization errors) in `vite.config.ts`, while deferring `syncAndExports` imports in `CrashErrorBoundary.tsx` and `DevelopmentErrorBoundary.tsx` to click handlers—cutting dev boot payload from 13.52 MB to 3.05 MB (-77.4%) with zero production build changes.
- **Tracked Files:** `vite.config.ts`, `src/components/CrashErrorBoundary.tsx`, `src/components/DevelopmentErrorBoundary.tsx`

**Automated Invariants Checked:**
- `vite.config.ts` must contain `devInlineSourcemapStripPlugin`, `devLucideDirectImportPlugin`, `exclude: ['lucide-react']` — *Dev preview must strip multi-megabyte base64 inline sourcemaps and resolve lucide-react icons directly without pre-bundling all 1,600+ icons so mobile Chrome preview iframes do not OOM.*
- `src/components/CrashErrorBoundary.tsx` must contain `import('../domain/syncAndExports')` — *CrashErrorBoundary mounts at root and must load formatTimestampedBackupSlug dynamically on click rather than eagerly pulling syncAndExports into startup.*
  - Forbidden regression: `from '../domain/syncAndExports'`
- `src/components/DevelopmentErrorBoundary.tsx` must contain `import('../domain/syncAndExports')` — *DevelopmentErrorBoundary mounts in App.tsx and must load formatTimestampedBackupSlug dynamically on click rather than eagerly pulling syncAndExports into startup.*
  - Forbidden regression: `from '../domain/syncAndExports'`

**Restoration Playbook if Overwritten:**
1. Keep `devLucideDirectImportPlugin()`, `devInlineSourcemapStripPlugin()`, and `optimizeDeps.exclude: ['lucide-react']` in `vite.config.ts`.
2. Keep dynamic `import('../domain/syncAndExports')` inside crash log download handlers in `CrashErrorBoundary.tsx` and `DevelopmentErrorBoundary.tsx`.

### IMP-064: GitHub Pages Deployment, Subpath Routing & Search Engine Optimization (SEO)

- **Release Milestone:** Alpha 2 (`alpha-2`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Optimize all GitHub Pages for utility, setup, social preview cards, and search engine discoverability.
- **Summary:** Enhances GitHub Pages delivery and SEO discovery: configures GitHub repository description, homepage URL, and 16 topics; optimizes index.html with keyword-rich meta tags, canonical link, Open Graph preview tags, Twitter summary card, and Schema.org WebApplication structured data resolved from `%SITE_URL%` tokens instead of a hardcoded path; creates public/robots.txt, public/sitemap.xml, and public/404.html SPA router fallback templates; updates deploy-pages.yml to trigger on both main and release branches while verifying robots.txt, sitemap.xml, and 404.html in distribution; and adds GitHub Pages status badges and direct web app launch links to README.md and package.json.
- **Tracked Files:** `index.html`, `public/robots.txt`, `public/sitemap.xml`, `public/404.html`, `.github/workflows/deploy-pages.yml`, `README.md`, `package.json`

**Automated Invariants Checked:**
- `index.html` must contain `%SITE_URL%`, `application/ld+json`, `og:image`, `twitter:card`, `rel="canonical"` — *index.html must maintain canonical, OpenGraph, Twitter card, and Schema.org structured data for SEO.*
- `public/robots.txt` must contain `User-agent: *`, `Sitemap: %SITE_URL%sitemap.xml` — *public/robots.txt must guide search crawlers to the sitemap.*
- `public/sitemap.xml` must contain `<loc>%SITE_URL%</loc>` — *public/sitemap.xml must define the canonical GitHub Pages location through the build-time site URL token.*
- `public/404.html` must contain `Community Pedigree Project - GitHub Pages SPA Fallback` — *public/404.html must provide client-side route fallback for GitHub Pages.*
- `.github/workflows/deploy-pages.yml` must contain `- main`, `- release`, `dist/robots.txt`, `dist/sitemap.xml` — *deploy-pages.yml must deploy from both main and release branches and verify SEO artifacts.*
- `package.json` must contain `"homepage": "https://askkim.github.io/Pedigree/"` — *package.json must state the official GitHub Pages homepage URL and stay the single authored source for every derived URL.*

**Restoration Playbook if Overwritten:**
1. Preserve SEO meta tags, canonical link, Open Graph, and JSON-LD structured data in `index.html`, keeping the absolute URLs as `%SITE_URL%` tokens.
2. Keep `public/robots.txt`, `public/sitemap.xml`, and `public/404.html` in place as `%SITE_URL%` / `%SITE_BASE%` templates; `scripts/siteIdentity.ts` fills them during the build.
3. Ensure `.github/workflows/deploy-pages.yml` triggers on `main` and `release` and verifies `dist/robots.txt` and `dist/sitemap.xml`.
4. Keep `"homepage"` in `package.json` as the one authored site URL and live links in `README.md`; every other URL is derived from it.

### IMP-065: Boot Stability & Stale-Chunk Recovery: 504 Outdated-Dep Auto-Reload, Pre-Boot Error Separation & Safe EOF Sourcemap Stripping

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Eliminate transient first-load boot errors after updates or dev restarts that only disappear on manual refresh.
- **Summary:** Hardens startup resilience across 4 layers: (1) updates `stripDevSourceMapTrailer` and `devInlineSourcemapStripPlugin` in `vite.config.ts` to strip only true EOF `sourceMappingURL` trailers and guard `Content-Length` against encoded/chunked headers; (2) splits genuine ES2018 syntax/parse incompatibility from transient module fetch / HTTP 504 `Outdated Optimize Dep` errors in `index.html`, adding capture-phase `<script>` and `unhandledrejection` pre-boot listeners with a 15-second cooldown-guarded reload that clears `pedigree_pending_boot_ts` so recovery never trips crash-loop protection; (3) upgrades `src/main.tsx` dev-mode cleanup to trigger a single guarded reload whenever a stale Service Worker controller was active; and (4) adds `isRecoverableChunkError` + `attemptOneTimeChunkReload` to `src/utils/lazyRoute.tsx` so stale dynamic imports and `RouteErrorBoundary` Retry Screen reload cleanly instead of reusing memoized rejected ES module promises.
- **Tracked Files:** `vite.config.ts`, `index.html`, `src/main.tsx`, `src/utils/lazyRoute.tsx`, `src/utils/__tests__/lazyRoute.test.ts`

**Automated Invariants Checked:**
- `vite.config.ts` must contain `export function stripDevSourceMapTrailer`, `hasEncoding` — *Dev sourcemap stripping must only remove trailing EOF comments and skip Content-Length mutation on encoded responses.*
- `index.html` must contain `PREBOOT_RELOAD_KEY`, `attemptOneShotPreBootReload`, `handlePreBootTransientFetchFailure` — *Pre-boot guard must separate transient module fetch/504 glitches from real ES2018 browser incompatibility and recover via cooldown-guarded reload.*
- `src/main.tsx` must contain `hadActiveController`, `pedigree_dev_sw_cleanup_reload_ts` — *Dev startup must reload cleanly once if a stale Service Worker controller intercepted the initial boot.*
- `src/utils/lazyRoute.tsx` must contain `isRecoverableChunkError`, `attemptOneTimeChunkReload` — *Lazy route loader and RouteErrorBoundary must detect stale chunk / 504 errors and perform a guarded clean reload instead of retrying a permanently rejected ES module entry.*

**Restoration Playbook if Overwritten:**
1. Keep EOF-only `stripDevSourceMapTrailer` checks and `hasEncoding` guard in `vite.config.ts`.
2. Preserve `attemptOneShotPreBootReload`, `handlePreBootTransientFetchFailure`, capture-phase script `error`, and pre-boot `unhandledrejection` handlers in `index.html`.
3. Preserve `hadActiveController` reload guard in `src/main.tsx`.
4. Preserve `isRecoverableChunkError` and `attemptOneTimeChunkReload` in `src/utils/lazyRoute.tsx`.

### IMP-066: Alpha 3 Modular Core Primitives, Multi-Platform Storage Bridges, Decoupled @features/* Modules & Parameterized Android Wrapper

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Execute the Hydrogen modular architecture plan with strict three-layer boundaries, iOS/desktop/Android storage and print bridges, decoupled feature packages, and zero boot or Alpha 2 baseline regressions.
- **Summary:** Establishes `@engine/primitives/*` pure sanitization and crypto utilities; upgrades `@engine/bridge/*` with request-ID-correlated iOS `WKWebView` SQLite storage replies + timeouts (`ios-wrapper/BRIDGE_CONTRACT.md`), runtime Electron/Tauri `desktopBridgeAdapter.ts` delegation, and Android WebView two-frame `ArrayBuffer`/print parity; enforces strict `requiresIosStorageBridge` anti-eviction routing in `resilientStorageAdapter.ts` and `NativeBridgeStorageAdapter`; parameterizes `android-wrapper/` names, shortcuts, prefs, clipboard labels, and export filenames via Gradle `pedigree.wrapper.*` properties while keeping `minSdk = 26`; extracts 5 new domain-agnostic feature modules (`@features/csv-exporter`, `@features/backup-vault`, `@features/document-export`, `@features/ics-calendar`, `@features/ocr-parser`) alongside `@features/csv-importer`; and wires lightweight `PEDIGREE_APP_CONFIG` + end-to-end repositories and workflows through `@app/pedigreeAppWiring.ts` and `useBarnStore.ts` while deferring standalone `core` extraction until transfer readiness.
- **Tracked Files:** `HYDROGEN_MODULAR_PLAN.md`, `src/engine/primitives/index.ts`, `src/engine/primitives/sanitization.ts`, `src/engine/primitives/crypto.ts`, `src/engine/bridge/platformBridge.ts`, `src/engine/bridge/desktopBridgeAdapter.ts`, `src/engine/storage/resilientStorageAdapter.ts`, `src/engine/storage/nativeBridgeStorageAdapter.ts`, `src/features/csv-exporter/csvExporter.ts`, `src/features/backup-vault/portableVault.ts`, `src/features/document-export/htmlPrintPackage.ts`, `src/features/ics-calendar/icsBuilder.ts`, `src/features/ocr-parser/ocrTextPipeline.ts`, `src/app/pedigreeAppConfig.ts`, `src/app/pedigreeAppWiring.ts`, `src/hooks/useBarnStore.ts`, `android-wrapper/app/build.gradle.kts`, `android-wrapper/settings.gradle.kts`, `ios-wrapper/BRIDGE_CONTRACT.md`

**Automated Invariants Checked:**
- `src/engine/primitives/sanitization.ts` must contain `isSafeObjectKey`, `sanitizeCsvFormulaCell`, `escapeSafeHtml` — *Shared pure sanitization helpers must live in @engine/primitives without DOM/Node or domain dependencies.*
- `src/engine/primitives/crypto.ts` must contain `fnv1a64Hex`, `sha256HexPure`, `wrapGenericEncryptedZip` — *Shared FNV-1a and SHA-256 primitives must live in @engine/primitives.*
- `src/engine/bridge/desktopBridgeAdapter.ts` must contain `detectDesktopShellType`, `createDesktopBridgeDelegates` — *Desktop Electron/Tauri runtime detection must remain dependency-free in @engine/bridge.*
- `src/engine/bridge/platformBridge.ts` must contain `DEFAULT_IOS_STORAGE_REPLY_GLOBAL`, `handleStorageBridgeResponse`, `openExternalUrl` — *PlatformBridge must support correlated iOS WKWebView storage replies and unified safe URL/desktop/Android routing.*
- `src/engine/storage/nativeBridgeStorageAdapter.ts` must contain `return caps.hasNativeBridge;`, `Native storage bridge is not configured` — *NativeBridgeStorageAdapter must verify caps.hasNativeBridge is active instead of accepting unbacked iOS signals.*
- `src/engine/storage/resilientStorageAdapter.ts` must contain `if (caps.requiresIosStorageBridge)`, `fnv1a64Hex` — *createResilientStorageAdapter must strictly route ios-wkwebview through native bridge storage rather than evictable IndexedDB/OPFS.*
- `src/features/csv-exporter/csvExporter.ts` must contain `exportRecordsToCsv`, `createCsvExporterFeatureModule` — *Decoupled CSV exporter must remain domain-agnostic in @features/csv-exporter.*
- `src/features/backup-vault/portableVault.ts` must contain `exportPortableVault`, `restorePortableVault`, `createBackupVaultFeatureModule` — *Decoupled SHA-256 verified portable vault must remain domain-agnostic in @features/backup-vault.*
- `src/features/document-export/htmlPrintPackage.ts` must contain `buildPrintableHtmlDocument`, `dispatchPrintPackage`, `createDocumentExportFeatureModule` — *Printable HTML packager must dispatch through IPlatformBridge without domain coupling.*
- `src/features/ics-calendar/icsBuilder.ts` must contain `buildGenericIcsCalendar`, `createIcsCalendarFeatureModule` — *RFC 5545 calendar builder must accept generic events without livestock domain coupling.*
- `src/features/ocr-parser/ocrTextPipeline.ts` must contain `groupWordBoxesIntoLines`, `extractStructuredFieldsFromOcr`, `createOcrParserFeatureModule` — *OCR line/field extraction pipeline must remain schema-driven and domain-agnostic.*
- `src/app/pedigreeAppConfig.ts` must contain `export const PEDIGREE_APP_CONFIG`, `document-export`, `backup-vault` — *PEDIGREE_APP_CONFIG must stay lightweight so useBarnStore startup does not pull ZIP or SQLite WASM engines.*
  - Forbidden regression: `fflate`, `sql.js`
- `src/app/pedigreeAppWiring.ts` must contain `exportAnimalCsvFromStorage`, `exportPedigreePortableVault`, `printPedigreeDocument`, `buildBarnTasksIcsFeed`, `extractPedigreeOcrSummary` — *@app/pedigreeAppWiring.ts is the sole composition layer connecting domain configs to @features/* and @engine/*.*
- `android-wrapper/app/build.gradle.kts` must contain `minSdk = 26`, `pedigree.wrapper.appName`, `pedigree.wrapper.debugPrefsName`, `pedigree.wrapper.diagnosticsClipLabel`, `pedigree.wrapper.defaultExportFilename` — *Android wrapper must preserve minSdk = 26 and Gradle property parameterization.*
- `ios-wrapper/BRIDGE_CONTRACT.md` must contain `NATIVE_STORAGE_OP`, `__platformBridgeStorageReceive`, `.applicationSupportDirectory` — *iOS WKWebView SQLite storage bridge protocol must remain documented for native Apple shell implementations.*

**Restoration Playbook if Overwritten:**
1. Restore `@engine/primitives/*`, `@engine/bridge/desktopBridgeAdapter.ts`, and request-ID-correlated iOS storage reply handling in `@engine/bridge/platformBridge.ts`.
2. Keep strict `caps.hasNativeBridge` verification in `NativeBridgeStorageAdapter` and anti-eviction routing in `createResilientStorageAdapter`.
3. Preserve all six decoupled `@features/*` modules (`csv-importer`, `csv-exporter`, `backup-vault`, `document-export`, `ics-calendar`, `ocr-parser`) and `@app/pedigreeAppConfig.ts` + `@app/pedigreeAppWiring.ts` composition wiring.
4. Maintain Gradle `pedigree.wrapper.*` parameterization and `minSdk = 26` in `android-wrapper/app/build.gradle.kts`.

### IMP-067: NEON Phases 1–2: Boot-Entry Lock, 100% Extraction Inventory & Pure Shared Primitives Decoupling

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Lock boot/entry stability, classify 100% of shared vs domain modules, and extract pure content-agnostic primitives from remaining shared src/domain and src/utils modules without breaking Alpha 2 exports.
- **Summary:** Establishes immutable boot-entry SHA-256 lock checksums (`BOOT_ENTRY_LOCK_CHECKSUMS`) for `src/main.tsx`, `src/App.tsx`, and `index.html`; classifies 100% of non-test modules across `src/domain/`, `src/features/`, `src/app/`, `src/storage/`, and `src/utils/` in `EXTRACTION_INVENTORY.md` (recording `FLASH_HYGIENE_PLAN.md` absorption and ES2018/`import/` config parity); extracts pure content-agnostic primitives (`themeColor.ts`, `qrCodec.ts`, `genericSync.ts`, `genericRegistries.ts`, `deviceCapabilityCore.ts`, `pdfDocumentExtractor.ts`, plus expanded `crypto.ts` and `sanitization.ts`) behind thin Alpha 2 compatibility facades; decouples `archiveAndCsvUtils.ts` and reusable `src/utils/*` (`es2018Shims.ts`, `useVirtualWindow.ts`, `lazyRoute.tsx`); wires domain factories in `@app/pedigreeAppWiring.ts`; and enforces automated zero-domain-term, import-direction, and boot-lock tests while deferring standalone `core` extraction until Phase 7.
- **Tracked Files:** `EXTRACTION_INVENTORY.md`, `ROADMAP.md`, `src/domain/improvementRegistry.ts`, `src/engine/primitives/index.ts`, `src/engine/primitives/crypto.ts`, `src/engine/primitives/sanitization.ts`, `src/engine/primitives/themeColor.ts`, `src/engine/primitives/qrCodec.ts`, `src/engine/primitives/genericSync.ts`, `src/engine/primitives/genericRegistries.ts`, `src/engine/primitives/deviceCapabilityCore.ts`, `src/engine/primitives/pdfDocumentExtractor.ts`, `src/engine/codecs/archiveAndCsvUtils.ts`, `src/domain/importers/pdfScanExtractor.ts`, `src/app/pedigreeAppWiring.ts`, `src/utils/es2018Shims.ts`, `src/utils/useVirtualWindow.ts`, `src/utils/lazyRoute.tsx`, `src/domain/__tests__/modularLayerArchitecture.test.ts`

**Automated Invariants Checked:**
- `EXTRACTION_INVENTORY.md` must contain `FLASH_HYGIENE_PLAN.md`, `extractable-core`, `extractable-feature`, `extractable-ui-util`, `pedigree-domain` — *Extraction inventory must document FLASH_HYGIENE_PLAN.md absorption and classify 100% of non-test source files.*
- `src/domain/improvementRegistry.ts` must contain `export const BOOT_ENTRY_LOCK_CHECKSUMS`, `src/main.tsx`, `src/App.tsx`, `index.html` — *Boot-entry SHA-256 lock checksums must remain registered to protect active boot stability.*
- `src/engine/primitives/index.ts` must contain `./themeColor`, `./qrCodec`, `./genericSync`, `./genericRegistries`, `./deviceCapabilityCore`, `./pdfDocumentExtractor` — *Pure content-agnostic Phase 2 primitives must stay exported from @engine/primitives.*
- `src/engine/codecs/archiveAndCsvUtils.ts` must contain `@engine/primitives/sanitization`, `@engine/primitives/genericRegistries` — *archiveAndCsvUtils.ts must depend solely on content-agnostic @engine/primitives contracts.*
- `src/app/pedigreeAppWiring.ts` must contain `wrapPedigreeEncryptedZip`, `PEDIGREE_P2P_WIRE_CONFIG`, `buildPedigreeRecordDeepLink`, `getPedigreeHeavyZipGate` — *@app/pedigreeAppWiring.ts must inject Pedigree defaults into pure @engine/primitives helpers.*
- `src/utils/es2018Shims.ts` must contain `__coreEs2018Shim` — *Reusable ES2018 shims must stay free of domain-specific internal marker names.*
  - Forbidden regression: `__pedigreeEs2018Shim`
- `src/utils/lazyRoute.tsx` must contain `configureLazyRouteDefaults`, `ChunkReloadOptions` — *lazyRoute.tsx must expose parameterized reload defaults and domain-neutral fallback UI copy.*
  - Forbidden regression: `Back to All Species`

**Restoration Playbook if Overwritten:**
1. Preserve `BOOT_ENTRY_LOCK_CHECKSUMS` in `src/domain/improvementRegistry.ts` and boot-lock verification tests in `src/domain/__tests__/modularLayerArchitecture.test.ts`.
2. Keep all pure content-agnostic primitives under `src/engine/primitives/*` and thin Alpha 2 compatibility facades in `src/domain/*`.
3. Keep 100% file-by-file module classifications synchronized in `EXTRACTION_INVENTORY.md` and domain wiring in `@app/pedigreeAppWiring.ts`.
4. Preserve domain-neutral markers and parameterized defaults in `src/utils/es2018Shims.ts`, `src/utils/useVirtualWindow.ts`, and `src/utils/lazyRoute.tsx`.

### IMP-068: AI Studio GitHub Import Fast-Boot, Compact Initial Output & Cold-Start Optimizations

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Speed up AI Studio startup when importing from GitHub, keep prompts/master_system_prompt.md mandatory, and reduce initial screen output.
- **Summary:** Adds Section 0 (AI Studio GitHub Import Fast-Boot & Compact Output) to `AGENTS.md` so GitHub imports always read `prompts/master_system_prompt.md`, declare pre-configured AI Studio runtime facts (Node/npm, `0.0.0.0:3000`, `hmr: false`, browser `sql.js`, zero env vars), skip non-boot docs and full `npm test`/`tsc --noEmit`/`verify:improvements` runs on import-only boot, and limit clean startup output to `ALIGNED` + `Ready: Community Pedigree (port 3000).`; sets `audit=false` and `fund=false` in `.npmrc`; removes lazy `tesseract.js` from eager Vite `optimizeDeps.include` and sets `reportCompressedSize: false` in `vite.config.ts`; and keeps `releaseReadiness.test.ts` tolerant of gitignored `Screenshot_*` attachments in `public/assets/aistudio/`.
- **Tracked Files:** `AGENTS.md`, `.npmrc`, `vite.config.ts`, `src/domain/__tests__/releaseReadiness.test.ts`

**Automated Invariants Checked:**
- `AGENTS.md` must contain `prompts/master_system_prompt.md`, `AI Studio GitHub Import Fast-Boot & Compact Output`, `Minimal Initial Screen Output`, `Ready: Community Pedigree (port 3000).` — *AGENTS.md must enforce reading master_system_prompt.md, fast-boot skip rules on GitHub import, and compact 2-line initial screen output.*
- `.npmrc` must contain `legacy-peer-deps=true`, `audit=false`, `fund=false` — *.npmrc must disable npm audit and funding network calls to accelerate cold AI Studio dependency installation.*
- `vite.config.ts` must contain `reportCompressedSize: false` — *Vite must skip gzip size reporting on build and avoid eagerly pre-bundling lazy tesseract.js during dev startup.*
  - Forbidden regression: `'tesseract.js',`

**Restoration Playbook if Overwritten:**
1. Keep Section 0 (`AI Studio GitHub Import Fast-Boot & Compact Output`) and the mandatory `prompts/master_system_prompt.md` directive at the top of `AGENTS.md`.
2. Keep `legacy-peer-deps=true`, `audit=false`, and `fund=false` in `.npmrc`.
3. Keep `reportCompressedSize: false` and omit `tesseract.js` from `optimizeDeps.include` in `vite.config.ts`.

### IMP-069: Alpha 3 Modularity Remediation: Full Utils Decoupling, IPlatformBridge Context DI, iOS SQLite Backing Seam & Boundary Guardrails

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Close all remaining modularity gaps after Phase 1 DI rollout: decouple src/utils/*, remove all concrete pedigreeBridge imports from components/utils/storage, route iOS WKWebView SQLite persistence through NativeBridgeStorageAdapter, fix double back-handler registration, and harden automated layer tests.
- **Summary:** Decouples `src/utils/lazyRoute.tsx` (`app_chunk_reload_ts`, `--ui-*` CSS aliases in `src/index.css`, injectable diagnostic hooks), `src/utils/webFileActions.ts` (`configureWebFileBridge`), `src/utils/webPdfActions.ts` -> `src/app/pedigreePdfActions.ts`, and `src/utils/googleCalendarClient.ts` -> `src/app/pedigreeCalendarClient.ts` so 100% of `src/utils/` is domain-free; adds `PlatformBridgeContext` (`usePlatformBridge()`) and extends `IPlatformBridge` with optional diagnostic/dev-panel/container hooks, migrating `PrintPreviewModal`, `HealthReferencePanel`, `SettingsAndSyncScreen`, `DiagnosticsAndSupportPanel`, `DevelopmentScreen`, and `storageProtection.ts` off concrete `pedigreeBridge`; fixes duplicate back-handler registration in `createPedigreeBridgePlatformAdapter`; adds an optional `backingStore?: IStorageAdapter` seam to `WebSqliteAdapter` wired via `createPedigreeDomainStorageAdapter` in `pedigreeAppWiring.ts` so iOS `WKWebView` routes SQLite persistence through `NativeBridgeStorageAdapter`; decouples `CrashErrorBoundary` from direct `WebSqliteAdapter` construction; and upgrades `modularLayerArchitecture.test.ts` with dynamic core/utils scanning, relative cross-feature import detection, and zero concrete `pedigreeBridge` enforcement.
- **Tracked Files:** `src/index.css`, `src/utils/lazyRoute.tsx`, `src/utils/webFileActions.ts`, `src/utils/webPdfActions.ts`, `src/utils/googleCalendarClient.ts`, `src/app/PlatformBridgeContext.tsx`, `src/app/pedigreePdfActions.ts`, `src/app/pedigreeCalendarClient.ts`, `src/app/pedigreeAppWiring.ts`, `src/engine/bridge/platformBridge.interface.ts`, `src/native/pedigreeBridge.ts`, `src/storage/storageProtection.ts`, `src/storage/webSqliteAdapter.ts`, `src/hooks/useBarnStore.ts`, `src/App.tsx`, `src/components/CrashErrorBoundary.tsx`, `src/components/HealthReferencePanel.tsx`, `src/components/SettingsAndSyncScreen.tsx`, `src/components/PrintPreviewModal.tsx`, `src/components/DiagnosticsAndSupportPanel.tsx`, `src/components/DevelopmentScreen.tsx`, `src/domain/__tests__/modularLayerArchitecture.test.ts`, `EXTRACTION_INVENTORY.md`

**Automated Invariants Checked:**
- `src/app/PlatformBridgeContext.tsx` must contain `PlatformBridgeProvider`, `usePlatformBridge` — *UI components must consume IPlatformBridge via React Context rather than importing concrete pedigreeBridge.*
- `src/utils/webFileActions.ts` must contain `configureWebFileBridge`, `NativeExportBridge` — *webFileActions.ts must stay decoupled from concrete pedigreeBridge globals.*
  - Forbidden regression: `pedigreeBridge`
- `src/app/pedigreeAppWiring.ts` must contain `initializePedigreeRuntimeDefaults`, `createPedigreeDomainStorageAdapter`, `NativeBridgeStorageAdapter` — *Composition root must wire runtime defaults and route iOS WKWebView SQLite persistence through NativeBridgeStorageAdapter.*
- `src/storage/webSqliteAdapter.ts` must contain `backingStore?: IStorageAdapter` — *WebSqliteAdapter must support an injected IStorageAdapter backing store for iOS anti-eviction routing.*

**Restoration Playbook if Overwritten:**
1. Preserve `PlatformBridgeProvider` in `src/App.tsx` and `usePlatformBridge()` across UI components.
2. Keep `configureLazyRouteDefaults`, `configureWebFileBridge`, and `configureStorageProtectionBridge` wired in `src/app/pedigreeAppWiring.ts`.
3. Keep `backingStore?: IStorageAdapter` in `src/storage/webSqliteAdapter.ts` and `createPedigreeDomainStorageAdapter` in `src/app/pedigreeAppWiring.ts`.

### IMP-070: Alpha 3 Modularity Hardening: iOS Backing-Store Write Guard, True Utils Isolation, Zero-Cycle Gate, Core Typecheck & Wrapper Contracts

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Review the completed Alpha 3 modularity rollout, fix missed runtime bugs and boundary leaks, eliminate circular dependencies, harden core storage/bridge adapters, and add an isolated core build profile.
- **Summary:** Fixes a critical `WebSqliteAdapter` persistence bug where `persistToDiskLocked` and `findRecoveredBackupSnapshot` short-circuited on `!getSafeIndexedDb()` before checking `this.backingStore` (verified with an end-to-end no-IDB SQLite WASM round-trip test over `NativeBridgeStorageAdapter`); syncs injected bridges in `PlatformBridgeProvider`; decouples `src/utils/webFileActions.ts`, `src/utils/googleCalendarClient.ts`, and `src/utils/webPdfActions.ts` (`src/utils/canvasUtils.ts`) from all `src/storage/*` imports and breaks all 3 circular dependencies (`opfsStorage <-> localSyncChannels <-> webFileActions`, `inputSanitization <-> syncOutbox <-> showResults`); adds forbidden-import checks for `src/utils/*` and a DFS zero-cycle test in `modularLayerArchitecture.test.ts`; wires Electron `onBackPressed` in `PlatformBridge`, adds `VersionError`/`QuotaExceededError` hooks to `IndexedDbStorageAdapter`, adds `wasmUrl` to `SqliteWasmStorageAdapter`, and adds SHA-256 + FNV-1a verification to `PortableStorageBundle`; adds `configureCapturedIdeasBackingStore` for iOS anti-eviction; adds modular `core` barrels (`src/engine/index.ts`, `src/engine/codecs/index.ts`, `src/engine/sync/index.ts`) and `tsconfig.engine.json` (`npm run verify:engine`), fixing an ES2019 `.trimStart()` leak in `sanitization.ts`; removes remaining `as any` casts in tests and temporary root plan files; and completes `apple-wrapper/` and `desktop-wrapper/` bridge/storage/installer contracts.
- **Tracked Files:** `src/storage/webSqliteAdapter.ts`, `src/storage/__tests__/nativeBackingStore.test.ts`, `src/app/PlatformBridgeContext.tsx`, `src/utils/canvasUtils.ts`, `src/utils/webPdfActions.ts`, `src/utils/googleCalendarClient.ts`, `src/utils/webFileActions.ts`, `src/utils/es2018Shims.ts`, `src/app/pedigreeAppWiring.ts`, `src/domain/inputSanitization.ts`, `src/domain/syncOutbox.ts`, `src/engine/primitives/sanitization.ts`, `src/engine/bridge/desktopBridgeAdapter.ts`, `src/engine/bridge/platformBridge.ts`, `src/engine/storage/browserStorageAdapters.ts`, `src/engine/storage/sqliteWasmStorageAdapter.ts`, `src/engine/storage/resilientStorageAdapter.ts`, `src/storage/capturedIdeasStore.ts`, `src/storage/photoHydration.ts`, `src/engine/index.ts`, `src/engine/codecs/index.ts`, `src/engine/sync/index.ts`, `tsconfig.engine.json`, `package.json`, `apple-wrapper/BRIDGE_CONTRACT.md`, `apple-wrapper/WKWebViewSQLiteContract.md`, `desktop-wrapper/BRIDGE_CONTRACT.md`, `desktop-wrapper/INSTALLER_TARGETS.md`, `src/domain/__tests__/modularLayerArchitecture.test.ts`, `EXTRACTION_INVENTORY.md`

**Automated Invariants Checked:**
- `src/storage/webSqliteAdapter.ts` must contain `(!this.backingStore && !getSafeIndexedDb())` — *WebSqliteAdapter must never silently drop writes into ephemeral mode when backingStore is configured without IndexedDB.*
- `src/utils/webFileActions.ts` must contain `configureWebFileRuntime`, `WebFileRuntimeHooks` — *Extractable UI utilities in src/utils/ must never import legacy pedigree-domain modules from src/storage/.*
  - Forbidden regression: `../storage/`
- `tsconfig.engine.json` must contain `src/engine/index.ts`, `src/features/**/*.ts`, `src/utils/*.ts` — *Isolated tsconfig.engine.json profile (npm run verify:engine) proves the extractable framework compiles with zero domain/app/storage dependencies.*
- `package.json` must contain `"verify:engine": "tsc -p tsconfig.engine.json --noEmit"` — *package.json must expose verify:engine for isolated framework compilation checks.*
- `src/domain/__tests__/modularLayerArchitecture.test.ts` must contain `enforces zero circular dependencies across core, features, app, utils, and storage` — *Automated boundary suite must fail on any circular dependency or src/utils/* storage import.*

**Restoration Playbook if Overwritten:**
1. Keep `(!this.backingStore && !getSafeIndexedDb())` guards in `src/storage/webSqliteAdapter.ts` and preserve `src/storage/__tests__/nativeBackingStore.test.ts`.
2. Keep `configureWebFileRuntime`, `configureGoogleCalendarClient`, and `src/utils/canvasUtils.ts` decoupled from `src/storage/*` and wired in `src/app/pedigreeAppWiring.ts`.
3. Keep `tsconfig.engine.json`, `npm run verify:engine`, and the zero-cycle test in `src/domain/__tests__/modularLayerArchitecture.test.ts`.

### IMP-071: Engine Extraction Readiness: Core→Domain Rename, Engine Dependency Direction, Layer Audit Ratchet & Shared Text Encoders

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Review the modularity rollout, fix gaps after the `@core` → `@engine` migration, avoid the term "core" (reserved for the Core Pedigree brand), and add automated enforcement.
- **Summary:** Moves `binaryEncoding` and `archiveAndCsvUtils` into `src/engine` (shims remain in `src/domain`); renames `src/core/` to `src/domain/` (`@domain`) with the `App.tsx` boot-lock checksum updated; adds `npm run verify:layers` (`scripts/audit-layers.ts`, shrinking-allowlist ratchet) in CI alongside `verify:engine`; globs `tsconfig.engine.json`; moves engine-only tests to `src/engine/__tests__`; and shares CSV/ICS encoders via `@engine/codecs/textFormats`.
- **Tracked Files:** `src/engine/binaryEncoding.ts`, `src/engine/codecs/archiveAndCsvUtils.ts`, `src/engine/codecs/textFormats.ts`, `scripts/audit-layers.ts`, `scripts/layer-allowlist.json`, `tsconfig.engine.json`, `package.json`, `.github/workflows/ci.yml`, `EXTRACTION_INVENTORY.md`

**Automated Invariants Checked:**
- `src/engine/index.ts` must contain `'./binaryEncoding'`, `'./codecs/archiveAndCsvUtils'` — *The engine must never import from the domain layer.*
  - Forbidden regression: `../domain/`
- `src/engine/codecs/textFormats.ts` must contain `escapeCsvCell`, `escapeCsvCellWithLimit`, `escapeIcsText`, `formatIcsAlarmTrigger` — *CSV and ICS encoders must have a single shared implementation.*
- `package.json` must contain `"verify:layers": "tsx scripts/audit-layers.ts"` — *package.json must expose verify:layers.*
- `.github/workflows/ci.yml` must contain `npm run verify:layers`, `npm run verify:engine` — *CI must run the layer audit and the isolated engine typecheck.*

**Restoration Playbook if Overwritten:**
1. Keep implementations of `binaryEncoding`, `archiveAndCsvUtils` and `textFormats` under `src/engine/` with only re-export shims in `src/domain/`.
2. Keep `scripts/audit-layers.ts` and `scripts/layer-allowlist.json` (entries may only be removed) and run them in CI.
3. Use `@domain` / `src/domain/` for pedigree domain logic; never reintroduce "core" in layer names.

### IMP-072: Isolated Engine Extraction Rehearsal Gate & Shared Text-Format Codec Tests

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Add an automated temp-directory extraction rehearsal proving @engine, @features, and src/utils compile standalone without domain/app/storage files, and add direct engine codec unit tests.
- **Summary:** Adds `scripts/rehearse-engine-extraction.ts` (`npm run verify:extraction`) which copies `src/engine`, `src/features`, `src/utils`, `tsconfig.json`, and `tsconfig.engine.json` into an isolated temp directory and runs `tsc -p tsconfig.engine.json --noEmit` with zero `src/domain`, `src/app`, `src/storage`, `src/hooks`, or `src/components` files present; wires `verify:extraction` into `.github/workflows/ci.yml`; and adds `src/engine/__tests__/textFormats.test.ts` covering CSV cell escaping, `.map(escapeCsvCell)` safety, and RFC-5545 ICS formatting.
- **Tracked Files:** `scripts/rehearse-engine-extraction.ts`, `package.json`, `.github/workflows/ci.yml`, `src/engine/__tests__/textFormats.test.ts`

**Automated Invariants Checked:**
- `package.json` must contain `"verify:extraction": "tsx scripts/rehearse-engine-extraction.ts"` — *package.json must expose verify:extraction for isolated engine extraction rehearsal.*
- `.github/workflows/ci.yml` must contain `npm run verify:extraction` — *CI must run the isolated engine extraction rehearsal.*
- `scripts/rehearse-engine-extraction.ts` must contain `'src/engine'`, `'src/features'`, `'src/utils'`, `'tsconfig.engine.json'` — *Extraction rehearsal must compile engine, features, and utils without domain/app/storage.*

**Restoration Playbook if Overwritten:**
1. Keep `scripts/rehearse-engine-extraction.ts` and `"verify:extraction"` in `package.json` and `.github/workflows/ci.yml`.
2. Keep `src/engine/__tests__/textFormats.test.ts` testing `@engine/codecs/textFormats`.

### IMP-073: Shared Canvas/OCR Decoding, SQLite Statement Cleanup & Workflow Modularity Gates

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Improve modularity and workflows, verify boot and loading, optimize memory management, and reduce token use.
- **Summary:** Consolidates duplicated image-blob decoding, ObjectURL/bitmap teardown, and contrast-grayscale OCR canvas preprocessing into `src/utils/canvasUtils.ts` (`decodeBlobToCanvasSource`, `buildContrastGrayscaleCanvas`, `releaseCanvas`) across `pedigreeOcrScanner.ts`, `feedTagOcr.ts`, and `webImageOptimizer.ts`; wraps `queryObjectsFromDb` prepared-statement stepping in `try/finally { stmt.free(); }` in `src/storage/webSqliteAdapter.ts`; adds npm download caching, concurrency cancellation, and `verify:layers`/`verify:engine`/`verify:extraction` gates across `.github/workflows/ci.yml`, `deploy-pages.yml`, `build-android-apk.yml`, and `guardrails.yml`; and excludes `.vite`, `.idea`, `.vscode`, `import`, `upload`, and `.map` artifacts in `export_repo_to_md.yml`.
- **Tracked Files:** `src/utils/canvasUtils.ts`, `src/storage/pedigreeOcrScanner.ts`, `src/storage/feedTagOcr.ts`, `src/storage/webImageOptimizer.ts`, `src/storage/webSqliteAdapter.ts`, `.github/workflows/ci.yml`, `.github/workflows/deploy-pages.yml`, `.github/workflows/build-android-apk.yml`, `.github/workflows/guardrails.yml`, `.github/workflows/export_repo_to_md.yml`

**Automated Invariants Checked:**
- `src/utils/canvasUtils.ts` must contain `decodeBlobToCanvasSource`, `buildContrastGrayscaleCanvas`, `releaseCanvas` — *Shared canvas/blob decode and OCR preprocessing helpers must remain centralized in src/utils/canvasUtils.ts.*
- `src/storage/webSqliteAdapter.ts` must contain `try {`, `stmt.free();`, `} finally {` — *SQLite WASM prepared statements in queryObjectsFromDb must always be freed in a finally block.*
- `.github/workflows/deploy-pages.yml` must contain `bun run verify:layers`, `bun run verify:engine`, `bun run verify:extraction` — *GitHub Pages deployment workflow must enforce layer boundary and engine extraction gates.*
- `.github/workflows/build-android-apk.yml` must contain `npm run verify:layers`, `npm run verify:engine`, `npm run verify:extraction` — *Android APK workflow must enforce layer boundary and engine extraction gates.*

**Restoration Playbook if Overwritten:**
1. Keep `decodeBlobToCanvasSource`, `buildContrastGrayscaleCanvas`, and `releaseCanvas` centralized in `src/utils/canvasUtils.ts` and imported by `pedigreeOcrScanner.ts`, `feedTagOcr.ts`, and `webImageOptimizer.ts`.
2. Keep `try/finally { stmt.free(); }` in `queryObjectsFromDb` inside `src/storage/webSqliteAdapter.ts`.
3. Keep `verify:layers`, `verify:engine`, and `verify:extraction` active in `ci.yml`, `deploy-pages.yml`, and `build-android-apk.yml`.

### IMP-074: Settings UI/UX Modernization, Logical Subunits, Title Header & System Links

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** Improve the UI/UX of the settings page by condensing logically related items into shared subunits in logical order, adding title text, and providing links to prompts, about, developer, and help pages.
- **Summary:** Reorganizes `SettingsAndSyncScreen.tsx` into 8 clean, logically ordered subunits beneath a prominent page header and quick-jump navigation bar linking to Prompts (`onOpenPromptsDirectory`), About (`AboutModal.tsx`), Developer (`onOpenDevelopment`), and Help & Husbandry Guides (`onOpenHelpDocs`); groups Farm Identity, Species Setup, Measurement Units, Appearance Studio, Calendar Alarms, Storage & Image Compression, Backup & Installation, and System Resources; and coordinates return routing from `PromptsDirectoryScreen` in `src/App.tsx`.
- **Tracked Files:** `src/components/SettingsAndSyncScreen.tsx`, `src/components/AboutModal.tsx`, `src/App.tsx`

**Automated Invariants Checked:**
- `src/components/SettingsAndSyncScreen.tsx` must contain `Settings &amp; Preferences`, `onOpenPromptsDirectory`, `handleOpenAboutTrigger`, `AboutModal` — *SettingsAndSyncScreen must include title header, quick jump links for prompts, about, developer, and help.*
- `src/components/AboutModal.tsx` must contain `Community Pedigree`, `100% On-Device`, `Zero Telemetry`, `AGPL-3.0` — *AboutModal must present app details, offline architecture, and AGPL-3.0 license.*
- `src/App.tsx` must contain `returnRouteFromPrompts`, `onOpenPromptsDirectory` — *App.tsx must wire onOpenPromptsDirectory and track return routing for PromptsDirectoryScreen.*

**Restoration Playbook if Overwritten:**
1. Keep Settings header title, quick navigation links (Prompts, About, Developer, Help), and 8 modular subunits in `src/components/SettingsAndSyncScreen.tsx`.
2. Keep `AboutModal.tsx` accessible modal showing offline guarantees and AGPL license.
3. Keep `returnRouteFromPrompts` and `onOpenPromptsDirectory` wired in `src/App.tsx`.

### IMP-075: Dependency Reduction, Deprecated API & Legacy Config Remediation

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Remove unused/deprecated dependencies, replace outdated runtime/API calls and legacy syntax, and clean up unsupported or obsolete configurations across the app without feature loss.
- **Summary:** Removes unused `autoprefixer` (and its unused transitive PostCSS helpers) since Tailwind CSS v4 (`@tailwindcss/vite`) handles prefixing natively via Lightning CSS; moves `@types/sql.js` from `dependencies` to `devDependencies` (`^1.16.1`) with strict peer-dependency resolution verified; strips obsolete `experimentalDecorators`, `useDefineForClassFields`, and `allowJs` from `tsconfig.json`; uses `node:path` in `vite.config.ts`; adds standard `<meta name="mobile-web-app-capable" content="yes" />` alongside iOS meta tags in `index.html`; replaces deprecated Annex B `escape()`/`unescape()` fallbacks in `src/engine/binaryEncoding.ts` with pure RFC 3629 UTF-8 encode/decode loops (covered by `binaryEncoding.test.ts`); prefers `navigator.userAgentData?.platform` before `navigator.platform` in `src/storage/storageProtection.ts`; migrates `PWAInstallButton.tsx` off legacy `React.FC`; and updates `bg-gradient-to-br` to Tailwind v4 `bg-linear-to-br` in `ImportExportHubScreen.tsx`.
- **Tracked Files:** `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/engine/binaryEncoding.ts`, `src/domain/__tests__/binaryEncoding.test.ts`, `src/storage/storageProtection.ts`, `src/components/PWAInstallButton.tsx`, `src/components/ImportExportHubScreen.tsx`

**Automated Invariants Checked:**
- `package.json` must contain `"@types/sql.js"` — *Unused autoprefixer must not be re-introduced under Tailwind CSS v4 (@tailwindcss/vite).*
  - Forbidden regression: `"autoprefixer"`
- `tsconfig.json` must contain `"target": "ES2018"`, `"jsx": "react-jsx"` — *Obsolete decorator and JS-interop compiler flags must stay removed from strict TS config.*
  - Forbidden regression: `"experimentalDecorators"`, `"allowJs"`
- `vite.config.ts` must contain `import path from 'node:path';` — *Vite config must use explicit Node built-in protocol imports (node:path).*
- `index.html` must contain `<meta name="mobile-web-app-capable" content="yes" />` — *index.html must include the standard mobile-web-app-capable meta tag.*
- `src/engine/binaryEncoding.ts` must contain `RFC 3629 UTF-8 fallback` — *binaryEncoding.ts must use pure RFC 3629 UTF-8 fallbacks instead of deprecated Annex B escape/unescape globals.*
  - Forbidden regression: `unescape(`, `escape(raw)`
- `src/components/PWAInstallButton.tsx` must contain `export function PWAInstallButton(`, `export function OfflineIndicator()` — *PWAInstallButton.tsx must use standard React 19 function component signatures.*
  - Forbidden regression: `React.FC`

**Restoration Playbook if Overwritten:**
1. Keep `autoprefixer` removed from `package.json` and `@types/sql.js` in `devDependencies`.
2. Keep `experimentalDecorators`, `useDefineForClassFields`, and `allowJs` out of `tsconfig.json`, and keep `node:path` in `vite.config.ts`.
3. Keep `<meta name="mobile-web-app-capable" content="yes" />` in `index.html`.
4. Preserve pure RFC 3629 UTF-8 fallback in `src/engine/binaryEncoding.ts` (no `escape`/`unescape`), `userAgentData?.platform` check in `src/storage/storageProtection.ts`, React 19 function components in `src/components/PWAInstallButton.tsx`, and `bg-linear-to-br` in `src/components/ImportExportHubScreen.tsx`.

### IMP-076: Older-Browser Performance, Zero-Dep ES2018+ Shims & Graceful CSS/API Fallbacks

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Improve performance and runtime compatibility in older ES2018-era browsers while preserving memory management, strict modularity, and graceful degradation when APIs or CSS features are unavailable.
- **Summary:** Extends zero-dependency `src/utils/es2018Shims.ts` with non-enumerable, frozen-host-safe shims for `queueMicrotask`, `Object.hasOwn`, `String.prototype.replaceAll`, `Array.prototype.at`, and `String.prototype.at` (covered in `es2018AndPwaUpdate.test.ts`); guards `AbortController` and timeout cleanup in `src/storage/weatherForecast.ts` so older browsers without `AbortController` degrade gracefully; adds `flex-basis` and `@supports not (height: 1dvh)` viewport fallbacks plus `html.pedigree-low-power` / `prefers-reduced-transparency` / `prefers-reduced-motion` GPU compositing reductions in `src/index.css` wired via `useDeviceCapability` with unmount cleanup in `src/storage/deviceCapabilityDetector.ts` (preserving boot-locked `src/App.tsx`); and adds `loading="lazy" decoding="async"` to list/gallery thumbnails in `HerdScreen.tsx`, `SpeciesDashboardScreen.tsx`, `FeedLedgerScreen.tsx`, and `AnimalPhotoGallery.tsx`.
- **Tracked Files:** `src/utils/es2018Shims.ts`, `src/storage/weatherForecast.ts`, `src/storage/deviceCapabilityDetector.ts`, `src/index.css`, `src/components/HerdScreen.tsx`, `src/components/SpeciesDashboardScreen.tsx`, `src/components/FeedLedgerScreen.tsx`, `src/components/AnimalPhotoGallery.tsx`, `src/storage/__tests__/es2018AndPwaUpdate.test.ts`

**Automated Invariants Checked:**
- `src/utils/es2018Shims.ts` must contain `queueMicrotaskShim`, `objectHasOwnShim`, `stringReplaceAllShim`, `arrayAtShim`, `stringAtShim` — *Zero-dependency ES2018 runtime shims must cover queueMicrotask, Object.hasOwn, replaceAll, and .at() with graceful frozen-host handling.*
- `src/storage/weatherForecast.ts` must contain `typeof AbortController === 'function' ? new AbortController() : null`, `if (timer !== null) clearTimeout(timer);` — *Weather forecast fetches must guard AbortController on legacy browsers and always clear timers in finally blocks.*
- `src/index.css` must contain `@supports not (height: 1dvh)`, `html.pedigree-low-power`, `prefers-reduced-transparency: reduce`, `prefers-reduced-motion: reduce` — *Legacy browsers must receive vh viewport fallbacks and reduced backdrop-filter/motion GPU load.*
- `src/storage/deviceCapabilityDetector.ts` must contain `isLegacyOrLowPowerDevice`, `classList.toggle('pedigree-low-power'`, `classList.remove('pedigree-low-power')` — *useDeviceCapability must toggle pedigree-low-power for constrained/outdated browsers with unmount cleanup.*

**Restoration Playbook if Overwritten:**
1. Keep `queueMicrotask`, `Object.hasOwn`, `String.prototype.replaceAll`, `Array.prototype.at`, and `String.prototype.at` shims in `src/utils/es2018Shims.ts`.
2. Keep guarded `AbortController` and `if (timer !== null) clearTimeout(timer)` in `src/storage/weatherForecast.ts`.
3. Keep `@supports not (height: 1dvh)` and `html.pedigree-low-power` / reduced-motion rules in `src/index.css` and the cleanup `useEffect` in `src/storage/deviceCapabilityDetector.ts`.
4. Keep `loading="lazy" decoding="async"` on list/gallery thumbnail `<img>` tags.

### IMP-077: Settings Consolidation, Collapsible Subunits, Open All Control & Jump Navigation

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** Merge overlapping items into unified units/subsections, simplify Settings navigation, make every subunit collapsible with all subunits collapsed by default except the top unit closest to the title, and add an Open All button near the title.
- **Summary:** Consolidates duplicated Quick Launchers (Backup Hub, Health Library, Help Guides, Developer, About, Prompts) into a single unified bar inside the Top Unit of `SettingsAndSyncScreen.tsx`, merges `Species & Workspace Setup` with `Units, Currency & Pedigree Standards`, and merges `Backup, Sync & Installation` with `Keyboard Navigation Shortcuts`; adds a "Jump to Settings Section" navigation strip that auto-expands and scrolls to each subunit; makes all subunits (including the Top Overview subunit) collapsible via `subunitOpen` state (`top_overview: true` by default, all 6 configuration subunits `false` by default); and adds an `Open All` / `Collapse All` button directly beside the title.
- **Tracked Files:** `src/components/SettingsAndSyncScreen.tsx`

**Automated Invariants Checked:**
- `src/components/SettingsAndSyncScreen.tsx` must contain `createDefaultSubunitOpenMap`, `handleToggleOpenAll`, `Open All`, `Collapse All`, `jumpToSection`, `Species, Workspace &amp; Pedigree Standards`, `Backup, Sync, Install &amp; Shortcuts` — *SettingsAndSyncScreen must provide consolidated subunits, section jump navigation, collapsible subunits defaulting to collapsed except top_overview, and an Open All control near the title.*

**Restoration Playbook if Overwritten:**
1. Keep `createDefaultSubunitOpenMap()` with `top_overview: true` and all 6 settings subunits `false` by default in `src/components/SettingsAndSyncScreen.tsx`.
2. Keep `handleToggleOpenAll` (`Open All` / `Collapse All`) in the top header beside `Settings &amp; Preferences` and `jumpToSection` navigation inside the top overview panel.
3. Keep consolidated `Species, Workspace &amp; Pedigree Standards` and `Backup, Sync, Install &amp; Shortcuts` subunits without duplicating top-bar launcher cards.

### IMP-078: Multi-Platform & Multi-Model Agent Rules, NO PENDING WORK Notice & Preflight Tooling Repair

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Optimize repository rules, prompt workflows, and preflight tooling for broad compatibility across coding platforms and models, and change the no-pending notice to NO PENDING WORK.
- **Summary:** Updates `GEMINI.md` Startup Check notice from `NO PENDING PLANS OR HANDOFFS` to `NO PENDING WORK` with explicit cross-model/read-only applicability; reconciles `AGENTS.md`, `ROADMAP.md`, and `prompts/master_system_prompt.md` around model-agnostic `BOOT_ENTRY_LOCK_CHECKSUMS`, full three-layer boundaries (`engine/`, `features/`, `domain/`, `app/`), and CLI fallbacks; expands `CLAUDE.md`, `.cursor/rules/project.mdc`, `.windsurfrules`, and `.github/copilot-instructions.md` with inline non-negotiable guardrails and adds `.clinerules`, `.roorules`, `.aider.conf.yml`, and path-scoped `.cursor/rules/*` + `.github/instructions/*` synced in `.github/structure.txt`; fixes stale `src/core/` and AI Studio-only references in `/prompts/`; repairs invalid JSON, stray characters, JS syntax errors, missing `preflight-run-context.mjs`, and `.github/workflows/preflight.yml` in `prompts/preflight/`; and adds a unified `npm run verify` script plus `tsconfig.json` excludes.
- **Tracked Files:** `GEMINI.md`, `AGENTS.md`, `ROADMAP.md`, `prompts/master_system_prompt.md`, `CLAUDE.md`, `.cursor/rules/project.mdc`, `.windsurfrules`, `.github/copilot-instructions.md`, `.clinerules`, `.roorules`, `.aider.conf.yml`, `.github/structure.txt`, `prompts/start_new_backlog_prompt.md`, `prompts/resume_backlog_plan_prompt.md`, `prompts/fix_error_log_prompt.md`, `prompts/preflight/preflight.config.json`, `prompts/preflight/handoff-state.schema.json`, `prompts/preflight/manifest/preflight.manifest.json`, `prompts/preflight/scripts/preflight-lint.mjs`, `prompts/preflight/scripts/preflight-log.mjs`, `prompts/preflight/scripts/gen-preflight.mjs`, `prompts/preflight/scripts/preflight-run-context.mjs`, `prompts/preflight/pf-launcher-uni.md`, `.github/workflows/preflight.yml`, `package.json`, `tsconfig.json`

**Automated Invariants Checked:**
- `GEMINI.md` must contain `NO PENDING WORK`, `Startup Check: Incomplete Plan / Work Notice` — *GEMINI.md must emit NO PENDING WORK when no incomplete plan or handoff exists and avoid legacy wording.*
  - Forbidden regression: `NO PENDING PLANS OR HANDOFFS`
- `prompts/master_system_prompt.md` must contain `NO PENDING WORK`, `engine/`, `npm run verify` — *Master System Prompt must stay aligned with GEMINI.md NO PENDING WORK notice and three-layer boundaries.*
- `package.json` must contain `"verify":`, `"preflight:lint": "node prompts/preflight/scripts/preflight-lint.mjs"` — *package.json must expose unified npm run verify and zero-dependency preflight:lint across coding platforms.*
- `prompts/start_new_backlog_prompt.md` must contain `src/domain/improvementRegistry.ts` — *Backlog prompts must point to src/domain/improvementRegistry.ts rather than removed src/core/.*
  - Forbidden regression: `src/core/improvementRegistry.ts`

**Restoration Playbook if Overwritten:**
1. Keep `NO PENDING WORK` in `GEMINI.md`, `AGENTS.md`, and `prompts/master_system_prompt.md`.
2. Keep inline non-negotiable summaries and adapters across `CLAUDE.md`, `.cursor/rules/*`, `.windsurfrules`, `.github/copilot-instructions.md`, `.clinerules`, `.roorules`, and `.aider.conf.yml`.
3. Keep valid JSON and zero-dependency `prompts/preflight/scripts/*.mjs` plus `"verify"` in `package.json`.

### IMP-079: Reusable Modularity Check & Reusability Check Prompts + Two-Pass Boundary & Utility Consolidation

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Provide project-agnostic reusable modularity and reusability evaluation/remediation prompts in /prompts/, improve both prompts, and apply two passes of modularity and reusability improvements across the codebase.
- **Summary:** Adds reusable, protected `modularity-check.md` (`Modularity Check`) and `reusability-check.md` (`Reusability Check`), later relocated from `/prompts/` into `prompts/preflight/run-uni/` as `[REUSABLE]` preflight steps with mate readmes; expands `scripts/audit-layers.ts` to audit `hooks/` and `components/`, block `node:*` imports in browser source with comment/string-literal-safe import parsing, and verifies zero upward leaks by moving `PendingGoogleCalendarSync` from `CalendarIntegrationModals.tsx` to `src/domain/calendarExport.ts`; consolidates duplicated slugifiers, `escapeRegExp`, `escapeHtml`, `dataUrlToBinary`, and `fnv1a32Base36` onto `@engine/primitives/sanitization`, `@engine/binaryEncoding`, and `@engine/primitives/crypto`; exports `resetLazyRouteDefaults`, `resetWebFileConfiguration`, and `resetGoogleCalendarClientConfiguration` singleton reset hooks; and expands cycle/bridge test coverage in `modularLayerArchitecture.test.ts` with accurate `@engine/*` alias resolution.
- **Tracked Files:** `prompts/preflight/run-uni/modularity-check.md`, `prompts/preflight/run-uni/reusability-check.md`, `src/domain/promptsCatalog.ts`, `scripts/audit-layers.ts`, `src/engine/primitives/sanitization.ts`, `src/engine/primitives/crypto.ts`, `src/domain/calendarExport.ts`, `src/hooks/useBarnStore.ts`, `src/utils/webPdfActions.ts`, `src/utils/lazyRoute.tsx`, `src/utils/webFileActions.ts`, `src/utils/googleCalendarClient.ts`, `src/domain/__tests__/modularLayerArchitecture.test.ts`

**Automated Invariants Checked:**
- `prompts/preflight/run-uni/modularity-check.md` must contain `# Modularity Check`, `Prompt Reusability:`, `DO_NOT_REMOVE_WITHOUT_CONFIRMATION` — *modularity-check.md must remain protected, concisely titled, and marked as reusable across repositories.*
- `prompts/preflight/run-uni/reusability-check.md` must contain `# Reusability Check`, `Prompt Reusability:`, `DO_NOT_REMOVE_WITHOUT_CONFIRMATION` — *reusability-check.md must remain protected, concisely titled, and marked as reusable across repositories.*
- `scripts/audit-layers.ts` must contain `hooks:`, `components:`, `extractSpecifiers`, `withoutComments` — *audit-layers.ts must audit hooks/ and components/ without false positives from comments or string literals.*
- `src/engine/primitives/crypto.ts` must contain `export function fnv1a32Base36` — *Shared FNV-1a 32-bit base36 hash helper must stay in pure crypto primitives rather than duplicated across importers.*
- `src/engine/primitives/sanitization.ts` must contain `export function escapeRegExp`, `export function slugifySegment` — *Shared escapeRegExp and slugifySegment primitives must remain in @engine/primitives/sanitization.*
- `src/utils/lazyRoute.tsx` must contain `export function resetLazyRouteDefaults` — *lazyRoute singleton configuration must expose resetLazyRouteDefaults for isolated tests and multi-instance reuse.*
- `src/utils/webFileActions.ts` must contain `export function resetWebFileConfiguration` — *webFileActions singleton configuration must expose resetWebFileConfiguration for test and bridge teardown.*
- `src/utils/googleCalendarClient.ts` must contain `export function resetGoogleCalendarClientConfiguration` — *googleCalendarClient singleton hooks must expose resetGoogleCalendarClientConfiguration for isolated testing.*

**Restoration Playbook if Overwritten:**
1. Keep `prompts/preflight/run-uni/modularity-check.md` and `prompts/preflight/run-uni/reusability-check.md` wired as the `modularity-check` / `reusability-check` `[REUSABLE]` preflight steps in `prompts/preflight/preflight.manifest.json` and `prompts/preflight/pf-launcher-uni.md`; both left `src/domain/promptsCatalog.ts` when they moved under `prompts/preflight/`.
2. Keep `hooks/` and `components/` coverage plus comment/string-safe scanning in `scripts/audit-layers.ts` and keep `PendingGoogleCalendarSync` in `src/domain/calendarExport.ts`.
3. Keep shared `escapeRegExp`, `slugifySegment`, `fnv1a32Base36`, and `dataUrlToBinary` reuse across domain and utils modules, plus `resetLazyRouteDefaults`, `resetWebFileConfiguration`, and `resetGoogleCalendarClientConfiguration`.

### IMP-080: Dev Lucide ESM Resolution, Boot Graph Decoupling & Parallel SQLite Startup Hydration

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Diagnose and eliminate extreme dev/first-load latency and shrink the initial boot bundle and startup SQLite/IndexedDB waterfall.
- **Summary:** Fixes `devLucideDirectImportPlugin()` in `vite.config.ts` to read `lucide-react/dist/esm/lucide-react.mjs` (instead of missing `.js`), eliminating a 2,100+ HTTP module waterfall during Vite dev startup; relocates `CURRENT_BACKUP_SCHEMA_VERSION`, `APP_SCHEMA_BUILD_TAG`, `buildEmptyFallbackSettings`, `buildEmptyShellSnapshot`, `isSampleTestingId`, species testing record counters, and `reconcileCarrierTraitLists` into `src/domain/models.ts` (with backwards-compatible facade re-exports in `backupVault.ts`, `sampleData.ts`, and `carrierGenetics.ts`); switches `barnJournal.ts`, `judgeNotebook.ts`, `mileageTaxLog.ts`, `calendarExport.ts`, `icsBuilder.ts`, `capturedIdeasStore.ts`, `pwaUpdateManager.ts`, `upgradeGate.ts`, `archiveInspector.ts`, `backupStatus.ts`, `storageProtection.ts`, `opfsStorage.ts`, `pedigreeAppWiring.ts`, and `useBarnStore.ts` to lightweight `@engine/*`/`models` imports and dynamic `import(...)` on heavy feature paths (`backupVault`, `syncAndExports`, `barnBinder`, `geneticsEngine`, `sampleData`, `pdfDocumentExtractor`); and parallelizes `initSqlJs(...)` WASM compilation with IndexedDB reads in `webSqliteAdapter.ts`.
- **Tracked Files:** `vite.config.ts`, `src/domain/models.ts`, `src/domain/backupVault.ts`, `src/domain/sampleData.ts`, `src/domain/carrierGenetics.ts`, `src/domain/calendarExport.ts`, `src/domain/barnJournal.ts`, `src/domain/judgeNotebook.ts`, `src/domain/mileageTaxLog.ts`, `src/domain/backupStatus.ts`, `src/domain/upgradeGate.ts`, `src/domain/archiveInspector.ts`, `src/features/ics-calendar/icsBuilder.ts`, `src/storage/pwaUpdateManager.ts`, `src/storage/capturedIdeasStore.ts`, `src/storage/storageProtection.ts`, `src/storage/opfsStorage.ts`, `src/storage/webSqliteAdapter.ts`, `src/app/pedigreeAppWiring.ts`, `src/hooks/useBarnStore.ts`

**Automated Invariants Checked:**
- `vite.config.ts` must contain `lucide-react.mjs` — *devLucideDirectImportPlugin must resolve lucide-react v1+ ESM entry (.mjs) so Vite dev startup does not trigger a 2,100+ icon request waterfall.*
- `src/domain/models.ts` must contain `export const CURRENT_BACKUP_SCHEMA_VERSION`, `export function isSampleTestingId`, `export function reconcileCarrierTraitLists` — *Lightweight boot constants and normalizers must live in models.ts so initial boot does not pull heavy backupVault, sampleData, or geneticsEngine modules.*
- `src/storage/webSqliteAdapter.ts` must contain `Promise.all([`, `import('../domain/sampleData')` — *webSqliteAdapter must parallelize sql.js WASM init with IndexedDB reads and lazy-load sampleData only when seeding empty storage.*
- `src/storage/opfsStorage.ts` must contain `import('../domain/backupVault')` — *opfsStorage must dynamically import backupVault only when OPFS vault/archive files are actively read or written.*
- `src/domain/barnJournal.ts` must contain `@engine/codecs/textFormats` — *barnJournal must import CSV primitives from @engine/codecs/textFormats rather than domain csvExport.*
- `src/domain/calendarExport.ts` must contain `@engine/primitives/crypto` — *calendarExport must import sha256HexPure from @engine/primitives/crypto rather than backupVault.*

**Restoration Playbook if Overwritten:**
1. Keep `lucide-react.mjs` fallback order inside `loadLucideIconMap()` in `vite.config.ts`.
2. Keep lightweight schema/sample/carrier helpers in `src/domain/models.ts` and dynamic imports for heavy domain modules in `webSqliteAdapter.ts`, `opfsStorage.ts`, `pedigreeAppWiring.ts`, and `useBarnStore.ts`.
3. Keep direct `@engine/*` subpath imports in `calendarExport.ts`, `barnJournal.ts`, `judgeNotebook.ts`, `mileageTaxLog.ts`, and `icsBuilder.ts`.

### IMP-081: Prompt Changelog Registry, Core Hygiene/PII Prompt & Split Module Catalog System

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Audit core files for content-specific names (preserving domain modules like useBarnStore.ts), track prompt changes with recovery invariants, add an optimized core-naming + PII audit prompt, and provide a live Core/Non-Content vs Content-Specific module listing system.
- **Summary:** Confirms `src/hooks/useBarnStore.ts` is content-specific and verifies zero content-specific filenames across `src/engine/`, `src/features/`, and `src/utils/`; adds protected reusable `prompts/core_hygiene.md` (registered in `src/domain/promptsCatalog.ts`) to audit & fix content-specific core names and human/contact PII; introduces `src/domain/promptRegistry.ts` + `PROMPT_CHANGES.md` + `scripts/verify-prompts.ts` (`npm run verify:prompts`) mirroring `improvementRegistry.ts` for `/prompts/*` recovery; and introduces `src/domain/moduleCatalog.ts` + `MODULES.md` + `scripts/list-modules.ts` (`npm run list:modules`, `npm run verify:modules`) wired into `npm run verify`.
- **Tracked Files:** `prompts/core_hygiene.md`, `PROMPT_CHANGES.md`, `MODULES.md`, `package.json`, `src/domain/promptsCatalog.ts`, `src/domain/promptRegistry.ts`, `src/domain/moduleCatalog.ts`, `scripts/verify-prompts.ts`, `scripts/list-modules.ts`, `src/domain/__tests__/promptsCatalog.test.ts`, `src/domain/__tests__/promptRegistry.test.ts`, `src/domain/__tests__/moduleCatalog.test.ts`

**Automated Invariants Checked:**
- `prompts/core_hygiene.md` must contain `<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->`, `# Core Hygiene & PII Check`, `Track B: Personal Identifiable Information (PII) & Human Contact Scan` — *core_hygiene.md must remain protected and cover both core content-free naming and PII scrubbing.*
- `src/domain/promptRegistry.ts` must contain `export const PROMPT_CHANGES_REGISTRY`, `export function evaluatePromptInvariants`, `export function formatPromptChangelogMarkdown` — *promptRegistry.ts must maintain automated invariant checks and recovery markdown generation for /prompts/*.*
- `src/domain/moduleCatalog.ts` must contain `export function classifyModulePath`, `export function buildModuleCatalog`, `export function verifyNoContentNamesInCoreModules` — *moduleCatalog.ts must split src/ modules into Core/Non-Content vs Content-Specific and enforce zero content tokens in core filenames.*
- `package.json` must contain `verify:prompts`, `list:modules`, `verify:modules` — *package.json must expose prompt recovery verification and module split listing/checking scripts.*

**Restoration Playbook if Overwritten:**
1. Keep `prompts/core_hygiene.md` registered in `src/domain/promptsCatalog.ts` and tracked in `src/domain/promptRegistry.ts` (`PRM-008`).
2. Keep `PROMPT_CHANGES.md` synced from `src/domain/promptRegistry.ts` and `MODULES.md` synced via `npx tsx scripts/list-modules.ts --write`.
3. Keep `verify:prompts` and `verify:modules` chained into `npm run verify` in `package.json`.

### IMP-082: Three-Phase Full-Sweep Routine, Catalog/Inventory Sync & Typed Memory Probe

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Define one comprehensive full-sweep verification routine and clear every issue it surfaced: stale MODULES.md, missing EXTRACTION_INVENTORY coverage for the split SQLite row mapper/writer modules, and untyped performance.memory access in useBarnStore.
- **Summary:** Records the three-phase full-sweep contract in `AGENTS.md` (repo gates, Git/CI environment, live browser runtime checks ending in a report artifact); resynchronizes `MODULES.md` with `src/` via `scripts/list-modules.ts --write`; classifies `src/storage/sqliteRowMappers.ts` and `src/storage/sqliteRowWriters.ts` as `pedigree-domain` in `EXTRACTION_INVENTORY.md` so the 100% coverage invariant passes; replaces both `as any` casts in `useBarnStore.ts` with a typed Chromium `performance.memory` interface; and commits `package-lock.json` so installs resolve deterministically.
- **Tracked Files:** `AGENTS.md`, `MODULES.md`, `EXTRACTION_INVENTORY.md`, `src/hooks/useBarnStore.ts`, `package-lock.json`, `IMPROVEMENTS.md`

**Automated Invariants Checked:**
- `EXTRACTION_INVENTORY.md` must contain ``src/storage/sqliteRowMappers.ts` — `pedigree-domain``, ``src/storage/sqliteRowWriters.ts` — `pedigree-domain`` — *EXTRACTION_INVENTORY.md must classify every non-test storage file, including the SQLite row mapper and writer split modules, so inventory coverage stays at 100%.*
- `MODULES.md` must contain `sqliteRowMappers.ts`, `sqliteRowWriters.ts`, `useBarnStore.ts` — *MODULES.md must stay regenerated from src/ so the module catalog lists the split SQLite row modules and the state hook.*
- `src/hooks/useBarnStore.ts` must contain `interface PerformanceMemory`, `memory?: PerformanceMemory` — *useBarnStore must read the non-standard Chromium performance.memory API through a typed interface instead of `as any`, per the repo-wide no-type-escapes rule.*
  - Forbidden regression: `as any`
- `AGENTS.md` must contain `### Phase 1 — The repo's own gates`, `### Phase 2 — Repo & Git environment`, `### Phase 3 — Agent environment`, `Trigger: full sweep` — *AGENTS.md must keep the three-phase full-sweep contract so future sweeps stay comprehensive.*

**Restoration Playbook if Overwritten:**
1. Regenerate `MODULES.md` with `npx tsx scripts/list-modules.ts --write` and re-run `npm run verify:modules`.
2. Keep `src/storage/sqliteRowMappers.ts` and `src/storage/sqliteRowWriters.ts` classified as `pedigree-domain` in `EXTRACTION_INVENTORY.md`.
3. Keep the typed `PerformanceMemory` interface in `src/hooks/useBarnStore.ts` instead of `as any`, and keep `package-lock.json` committed for deterministic installs.

### IMP-083: Complete Gradle Wrapper, Static Android Gate & Remote APK Dispatch

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Fix the Android wrapper issues that do not require a multi-gigabyte SDK install, document what the full build needs, and make the GitHub APK build callable from a local agent.
- **Summary:** Completes the half-installed Gradle wrapper (adds `gradlew`, `gradlew.bat` and `gradle-wrapper.jar` pinned to 8.13, matching CI), recreates the tracked `assets/www/.gitkeep` asset root, adds `android-wrapper/scripts/stage-web-assets.sh` plus `syncWebAssets`/`verifyWebAssets` Gradle tasks so a bare assemble fails fast instead of packaging an empty shell, adds `scripts/verify-android.ts` (`npm run verify:android`, 16 static checks: wrapper completeness, Gradle/CI pin agreement, four-way release version alignment, manifest security flags, SDK levels, staging guards, dependency policy and native bridge-name agreement) wired into `npm run verify`, adds `scripts/android-build-remote.mjs` to dispatch `.github/workflows/build-android-apk.yml` through the GitHub API with a dry-run and explicit token error, and documents the JDK 17 + Android SDK (~3-4 GB) requirement in `android-wrapper/README.md`.
- **Tracked Files:** `android-wrapper/gradlew`, `android-wrapper/gradlew.bat`, `android-wrapper/gradle/wrapper/gradle-wrapper.jar`, `android-wrapper/app/src/main/assets/www/.gitkeep`, `android-wrapper/scripts/stage-web-assets.sh`, `android-wrapper/app/build.gradle.kts`, `android-wrapper/README.md`, `scripts/verify-android.ts`, `scripts/android-build-remote.mjs`, `package.json`, `IMPROVEMENTS.md`

**Automated Invariants Checked:**
- `android-wrapper/gradle/wrapper/gradle-wrapper.properties` must contain `gradle-8.13-bin.zip` — *The Gradle wrapper must stay pinned to the same 8.13 distribution CI installs, so local and CI builds resolve identically.*
- `android-wrapper/app/build.gradle.kts` must contain `tasks.register<Copy>("syncWebAssets")`, `verifyWebAssets`, `dependsOn("verifyWebAssets")` — *The wrapper must stage dist/ into assets/www and fail preBuild when the WebView asset root has no index.html, instead of packaging a shell that renders nothing.*
- `scripts/verify-android.ts` must contain `[verify:android] PASS`, `Gradle wrapper is complete`, `Release version is aligned across manifests` — *The static Android gate must remain intact so wrapper and version drift fail on a machine without the Android SDK.*
- `package.json` must contain `verify:android` — *package.json must expose the Android static gate and keep it chained into `npm run verify`.*
- `android-wrapper/README.md` must contain `./gradlew`, `stage-web-assets.sh`, `JDK 17` — *The wrapper README must document the real build path and the JDK 17 + Android SDK prerequisite.*

**Restoration Playbook if Overwritten:**
1. Keep `gradlew`, `gradlew.bat` and `gradle/wrapper/gradle-wrapper.jar` committed and pinned to Gradle 8.13; regenerate with `gradle wrapper --gradle-version 8.13` if lost.
2. Keep `npm run verify:android` chained into `npm run verify` and run it before touching `android-wrapper/`.
3. Keep `assets/www/.gitkeep` tracked and stage assets with `android-wrapper/scripts/stage-web-assets.sh` or `./gradlew syncWebAssets`.

### IMP-084: Preflight Workflow Validation Fix (Never-Starting CI Job)

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Find out why the preflight workflow had never passed and make it actually run, now that CI results are readable from the public API.
- **Summary:** Preflight.yml had failed on all seven pushes since the repository first commit, producing zero jobs and no check-runs — GitHub rendering the workflow name as the file path, which is what it does for a definition it rejects. The `workflow_dispatch` `branch` input used `${{ github.ref_name }}` as its default, an expression GitHub does not evaluate in that position. The default is now empty and the step-level `github.event.inputs.branch || github.ref_name` fallback supplies the branch; the workflow runs all eight steps green for the first time. A forbidden-substring invariant prevents an expression default from returning.
- **Tracked Files:** `.github/workflows/preflight.yml`, `IMPROVEMENTS.md`

**Automated Invariants Checked:**
- `.github/workflows/preflight.yml` must contain `name: Preflight CI`, `workflow_dispatch`, `npm run preflight:lint`, `github.event.inputs.branch || github.ref_name` — *preflight.yml must keep a literal input default (never an expression, which GitHub rejects without starting a job) while still resolving the current branch at step level.*
  - Forbidden regression: `default: "${{`
- `package.json` must contain `preflight:lint`, `preflight` — *The preflight CLI entry points the workflow runs must stay available in package.json.*

**Restoration Playbook if Overwritten:**
1. Keep the `branch` input default a literal empty string; resolve the branch with `${{ github.event.inputs.branch || github.ref_name }}` inside the step env instead.
2. If the preflight run shows zero jobs and its name is the file path, the workflow definition was rejected — check `on.workflow_dispatch.inputs.*.default` first.

### IMP-085: CI Honesty: Pages Deploy Guard & Dependency Audit Trigger Fix

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Stop a deploy workflow from reporting failures for conditions it cannot control, and make the dependency audit actually re-run when the npm lockfile changes.
- **Summary:** deploy-pages.yml failed on every push because `actions/configure-pages` cannot configure a site that is served from a branch, or one that does not exist in this copy of the repository. A `guard` job now asks the Pages API (with the workflow token) for the site and its `build_type`: deployment proceeds only when Pages reports `workflow`; otherwise the run ends green with a step-summary notice naming the exact Settings change, and an unreadable response falls through to the real deploy rather than blocking it. Branch triggers, Bun tooling and the SEO artifact assertions are untouched. Separately, security-audit.yml watched `bun.lock`, a file this npm project does not have, so dependency changes never triggered the audit; it now watches `package-lock.json`.
- **Tracked Files:** `.github/workflows/deploy-pages.yml`, `.github/workflows/security-audit.yml`, `IMPROVEMENTS.md`

**Automated Invariants Checked:**
- `.github/workflows/deploy-pages.yml` must contain `oven-sh/setup-bun`, `bun run build --base=`, `- main`, `- release`, `dist/robots.txt`, `dist/sitemap.xml`, `build_type`, `needs.guard.outputs.deploy` — *Pages keeps deploying from main and release with Bun and its SEO assertions, while the guard decides whether Actions may deploy at all.*
- `.github/workflows/security-audit.yml` must contain `package-lock.json`, `android-wrapper/app/build.gradle.kts` — *The audit must trigger on the lockfile this project actually uses; bun.lock does not exist here.*
  - Forbidden regression: `bun.lock`

**Restoration Playbook if Overwritten:**
1. Keep the `guard` job first and both `if: needs.guard.outputs.deploy == 'true'` conditions on `build` and `deploy`; removing them restores the permanent red failure.
2. Treat an unreadable Pages API response as "proceed", so a token-scope change can never silently stop real deployments.
3. Never point the security audit at a lockfile the project does not ship.

### IMP-086: Registry Maintainability: Five Part Modules & On-Demand Rationale Prose

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Make the improvement registry reviewable and stop shipping explanatory prose that only the markdown/JSON export ever reads.
- **Summary:** Splits the 85 entries out of a 6,428-line improvementRegistry.ts into five part modules (IMP-001–017 through IMP-069–085) assembled by the unchanged public surface, with shared types in improvements/types.ts so parts never import the registry that owns them. The 484 invariant rationale strings move to improvements/rationales.ts keyed entryId#filePath#ordinal and are resolved by resolveEntryRationales only for markdown export, recovery JSON and verifier messages, which the diagnostics panel loads on demand. The registry chunk drops from 287 KB to 225 KB raw (76 KB to 58.5 KB gzipped) and IMPROVEMENTS.md regenerates byte-identically; a test asserts every invariant still resolves to non-empty prose.
- **Tracked Files:** `src/domain/improvementRegistry.ts`, `src/domain/improvements/types.ts`, `src/domain/improvements/rationales.ts`, `scripts/audit-layers.ts`

**Automated Invariants Checked:**
- `src/domain/improvementRegistry.ts` must contain `export const IMPROVEMENTS_REGISTRY`, `resolveEntryRationales`, `formatImprovementsMarkdown`, `buildImprovementsRecoveryJson` — *The registry must keep one public surface even though its entries are split across part modules and its prose lives elsewhere.*
- `vite.config.ts` must contain `improvement-registry`, `registry-part-` — *The facade and its entry parts must stay in one chunk; splitting them produced a circular chunk pair that threw "not iterable" when the improvements panel opened.*
- `src/domain/improvements/types.ts` must contain `ImprovementRationaleMap`, `rationale?: string` — *Shared types must stay available so part modules can be typed without importing the registry, and rationale must stay optional for entries that carry it inline.*

**Restoration Playbook if Overwritten:**
1. Keep the five import and spread lines in improvementRegistry.ts; concatenating entries inline again reintroduces the 6,428-line file.
2. When adding an entry, add its rationale to improvements/rationales.ts under entryId#filePath#ordinal — the resolution test fails if you forget.
3. The part data files and rationales.ts are exempt from the DOM/Node text scans in scripts/audit-layers.ts because their content is prose, not code.
4. Keep the `improvement-registry` codeSplitting group matching `improvements/registry-part-*.ts` as well as the facade — separating them reintroduces the circular chunk that broke the panel in production while dev looked fine.

### IMP-087: Production Chunk-Cycle Gate (Dev-Passes/Prod-Breaks Guard)

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Stop a bundling split that works in dev from shipping a production build that throws on first use.
- **Summary:** Adds `npm run verify:chunks` (scripts/verify-chunk-graph.ts), which walks the static import edges of every emitted chunk in dist/assets and fails when two chunks import each other. Cycles that already exist in the graph are frozen in scripts/chunk-cycle-allowlist.json — a ratchet keyed by hash-stripped chunk names, so content-hash churn does not create phantom entries — and stale entries must be removed. CI runs it after the production build. This is the gate that would have caught the registry split, whose parts chunk and facade chunk imported each other and left the parts undefined at init while dev hid the problem completely.
- **Tracked Files:** `scripts/verify-chunk-graph.ts`, `scripts/chunk-cycle-allowlist.json`, `package.json`, `.github/workflows/ci.yml`

**Automated Invariants Checked:**
- `scripts/verify-chunk-graph.ts` must contain `chunk-cycle-allowlist`, `no new circular chunk imports`, `STATIC_IMPORT_RE` — *The gate must exist, keep its ratchet file, and keep ignoring dynamic imports while inspecting static ones.*
- `package.json` must contain `"verify:chunks"` — *The gate needs a stable npm entry point for CI and the sweep.*
- `.github/workflows/ci.yml` must contain `npm run verify:chunks` — *CI must run the chunk gate on the real build output; running it locally without a fresh dist proves nothing.*
- `.github/workflows/deploy-pages.yml` must contain `verify:chunks` — *The Pages workflow can deploy without CI, so it must run the chunk gate on the bundle it is about to publish.*

**Restoration Playbook if Overwritten:**
1. Keep `npm run verify:chunks` in CI after `npm run build`; the check needs the emitted bundles, not the source.
2. When it reports a new cycle, group the members in one `codeSplitting` chunk (see the improvement-registry group) instead of adding an allowlist entry.
3. Only regenerate scripts/chunk-cycle-allowlist.json with `tsx scripts/verify-chunk-graph.ts --write-allowlist` for cycles that already predate the gate.

### IMP-088: Diagnostics Chunks Stay Precached (Offline-First Beats Install Size)

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Keep every reachable feature working on a first run with no network, without paying for it with a panel that only fails offline.
- **Summary:** Excluding the lazily-imported improvement registry (`improvement-registry-*.js`) and its rationale prose (`rationales-*.js`) from the Workbox precache was measured and rejected: it trimmed install weight from 113 files / 4.64 MB to 111 / 4.35 MB, but it also meant a device that opened the developer diagnostics panel for the first time while offline got a load error there. In an offline-first app every reachable screen must work with no network, so both chunks stay in `globPatterns` and the exclusion/runtime-cache pair was removed. If install weight ever needs to shrink again, shrink the registry data itself — never the offline capability.
- **Tracked Files:** `vite.config.ts`

**Automated Invariants Checked:**
- `vite.config.ts` must contain `globPatterns: [` — *The diagnostics chunks must stay in the precache manifest: excluding them (or re-adding a dedicated runtime cache as a substitute) reintroduces the first-offline-open failure this entry exists to prevent.*
  - Forbidden regression: `**/improvement-registry-*.js`, `**/rationales-*.js`, `diagnostics-chunks`

**Restoration Playbook if Overwritten:**
1. Do not exclude `improvement-registry-*.js` or `rationales-*.js` from `globPatterns`; a lazy import is still reachable, and reachable means precached.
2. Before any future precache trim, test the screen offline on a device that has never visited it — the online path hides this class of bug completely.
3. Genuine offline-safe savings must come from smaller registry data, not from dropping a feature out of the precache.

### IMP-089: Barn Store Surface Contract (Prerequisite for the Slice Decomposition)

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Make it impossible to lose or rename a store action while `useBarnStore` is split up, without a DOM test harness the project does not have.
- **Summary:** The store returns 200 keys through a single context value consumed by every screen, and the repo has no jsdom/testing-library renderer, so no runtime test could catch a dropped action. `barnStoreContract.test.ts` parses the hook's returned object literal straight from source and compares its keys against `barnStoreContract.keys.json`. Adding a key is a normal snapshot update; removing or renaming one fails by name until the snapshot and consumers move in the same commit. The parser rejects spread and computed keys so the contract cannot be silently bypassed, and a `MIN_EXPECTED_KEYS` floor stops a parser regression from passing by finding nothing. Proven against a real edit: deleting `deviceId` from the literal fails the test naming `deviceId`. `export type BarnStore = ReturnType<typeof useBarnStore>` gives the same guarantee at the type level.
- **Tracked Files:** `src/hooks/useBarnStore.ts`, `src/hooks/__tests__/barnStoreContract.test.ts`, `src/hooks/__tests__/barnStoreContract.keys.json`

**Automated Invariants Checked:**
- `src/hooks/__tests__/barnStoreContract.test.ts` must contain `barnStoreContract.keys.json`, `MIN_EXPECTED_KEYS`, `computed key is not allowed` — *The contract must keep comparing against its snapshot, keep its sanity floor, and keep refusing spread/computed keys.*
- `src/hooks/__tests__/barnStoreContract.keys.json` must contain `"deviceId"`, `"isLoading"` — *The snapshot is the record of the public surface; deleting it or trimming it to a stub would let a decomposition drop actions unnoticed.*
- `src/hooks/useBarnStore.ts` must contain `export type BarnStore = ReturnType<typeof useBarnStore>` — *Consumers and slices must be able to type against the exported store shape rather than re-deriving it.*

**Restoration Playbook if Overwritten:**
1. When splitting the store, carry the returned keys over unchanged and update `barnStoreContract.keys.json` only in the same commit that changes a consumer.
2. Never satisfy this contract by adding spread (`...slice`) or computed keys: the parser rejects both on purpose.
3. Extend this file into the per-slice contract as slices land; the snapshot stays the single source of truth for the public surface.

### IMP-090: Barn Store Decomposition Begins: Pure Policy Leaves First

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Start shrinking the 9.5k-line store without changing behaviour, one provably pure slice at a time.
- **Summary:** First slice of the `useBarnStore` decomposition: `getPhotoCacheBudgetForTier` moved to `src/hooks/barnStore/photoCacheBudget.ts` with a `PhotoCacheBudget` type and its first direct unit tests (tier floors, caps, monotonicity, non-finite probes). The hook keeps all state and wiring and simply imports the policy. Extraction was made behaviour-neutral on purpose: a non-finite tier still falls through to the largest budget because that is what the inline version did, and the test now pins that as intentional rather than letting a refactor quietly change cache sizing. The `src/hooks/barnStore/*` folder is the destination for later slices; `MODULES.md` was regenerated for the new module.
- **Tracked Files:** `src/hooks/barnStore/photoCacheBudget.ts`, `src/hooks/__tests__/photoCacheBudget.test.ts`, `src/hooks/useBarnStore.ts`, `MODULES.md`

**Automated Invariants Checked:**
- `src/hooks/barnStore/photoCacheBudget.ts` must contain `export function getPhotoCacheBudgetForTier`, `export interface PhotoCacheBudget` — *The extracted slice must keep its public surface so the hook and any future slice share one policy.*
- `src/hooks/barnStore/usePhotoCache.ts` must contain `from './photoCacheBudget'` — *The photo-cache slice must consume the extracted budget policy rather than re-deriving cache sizes, which would let the two drift.*
- `src/hooks/__tests__/photoCacheBudget.test.ts` must contain `never shrinks as the tier rises`, `non-finite tiers` — *The slice keeps the guard rails that made it safe to move: monotonic sizing and the preserved non-finite behaviour.*

**Restoration Playbook if Overwritten:**
1. Every later slice follows this shape: pure policy to `src/hooks/barnStore/*`, state and wiring stay in the hook, tests land with the move.
2. Never change behaviour inside a move. Pin the old quirk in a test first (as with non-finite tiers) or leave it in place.
3. Run `npm test`, `npm run verify` and `npx tsx scripts/list-modules.ts --write` for each slice; the contract snapshot must stay untouched unless a key truly changes.

### IMP-091: Backup-Reminder Policy Extracted From the Barn Store

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Backups & Safety (`backup-safety`)
- **Origin:** Session Improvement
- **User Goal:** Keep the reminder logic testable and out of the monolith, without changing when or how the app nags about backups.
- **Summary:** Second barn-store slice: the reminder persistence and snooze policy moved to `src/hooks/barnStore/backupReminder.ts`. Four inline `localStorage` blocks in the hook (state initialisers, reset, export recording, snooze) became named helpers with an injected `ReminderStorage` seam, so they are now unit-tested with fakes and a throwing storage. Behaviour is unchanged: unparsable values still read as "not snoozed", snapshot settings still win over the local mirror via `??` (an explicit stored `0` is respected, not treated as absent), snooze deadlines still use the skew-adjusted clock, and blocked storage still degrades to a no-op. The 200-key contract snapshot did not change.
- **Tracked Files:** `src/hooks/barnStore/backupReminder.ts`, `src/hooks/__tests__/backupReminder.test.ts`, `src/hooks/useBarnStore.ts`, `MODULES.md`

**Automated Invariants Checked:**
- `src/hooks/barnStore/backupReminder.ts` must contain `pedigree.backupReminderSnoozedUntil.v1`, `pedigree.lastBackupMeta.v1`, `resolveEffectiveSnoozedUntilMs`, `computeSnoozedUntilMs` — *The storage keys and both policy functions live only here now; losing either key would silently reset reminders for existing installs.*
- `src/hooks/useBarnStore.ts` must contain `from './barnStore/backupReminder'` — *The hook must consume the slice rather than re-inline storage keys, which is how the four duplicated blocks appeared in the first place.*
  - Forbidden regression: `pedigree.lastBackupMeta.v1`, `pedigree.backupReminderSnoozedUntil.v1`
- `src/hooks/__tests__/backupReminder.test.ts` must contain `never throws when storage is blocked`, `explicit zero`, `treats missing, empty or unparsable snooze values as "not snoozed"` — *These three cases encode the behaviour a future refactor is most likely to break: blocked storage, explicit zero versus absent, and corrupt values.*

**Restoration Playbook if Overwritten:**
1. Reminder storage belongs to `barnStore/backupReminder.ts`; pass a `ReminderStorage` fake in tests instead of touching global `localStorage`.
2. Keep `resolveEffectiveSnoozedUntilMs` on `??`: a stored `0` means "not snoozed" and must not fall back to the local mirror.
3. Do not change the two storage key strings — they are the only link to reminders already snoozed on users' devices.

### IMP-092: Backup-Reminder Callbacks Moved Into a Sub-Hook

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Backups & Safety (`backup-safety`)
- **Origin:** Session Improvement
- **User Goal:** Make the store actually smaller by moving the reminder actions out, not just their inline expressions.
- **Summary:** Third barn-store slice: `recordBackupExport` and `snoozeBackupReminder` now live in `src/hooks/barnStore/useBackupReminderActions.ts`, which takes exactly the wiring it needs — `enqueueStoreMutation`, `updateSettingsInternal`, `snapshotRef`, and the two local setters. Their bodies are plain exported functions (`recordBackupExportAction`, `snoozeBackupReminderAction`) so the real logic is unit-tested without a renderer; `useBackupReminderActions` only adds `useCallback` identity with the same dependency list the inline versions had. Behaviour is unchanged: export metadata still uses the adjusted UTC clock, the snooze is cleared on export, a 24-hour default is kept, settings writes stay wrapped in the write queue and marked silent, and nothing is written to settings before a snapshot exists. `useBarnStore.ts` dropped from 9,530 to 9,498 lines and the 200-key contract snapshot is untouched.
- **Tracked Files:** `src/hooks/barnStore/useBackupReminderActions.ts`, `src/hooks/__tests__/backupReminderActions.test.ts`, `src/hooks/useBarnStore.ts`, `MODULES.md`

**Automated Invariants Checked:**
- `src/hooks/barnStore/useBackupReminderActions.ts` must contain `export function useBackupReminderActions`, `recordBackupExportAction`, `snoozeBackupReminderAction`, `Deps` — *The actions and their dependency contract must stay in this slice; the plain bodies are what make the behaviour testable.*
- `src/hooks/useBarnStore.ts` must contain `from './barnStore/useBackupReminderActions'` — *Re-inlining either callback would undo the extraction and split the ownership of reminder behaviour again.*
  - Forbidden regression: `const recordBackupExport = useCallback(`, `const snoozeBackupReminder = useCallback(`
- `src/hooks/__tests__/backupReminderActions.test.ts` must contain `defaults to a 24 hour snooze`, `no snapshot is loaded yet` — *The two easy-to-break behaviours: the default snooze length and skipping settings writes when no snapshot is loaded.*

**Restoration Playbook if Overwritten:**
1. Reminder actions live in `useBackupReminderActions`; extend the deps object rather than reaching back into the store for new wiring.
2. Keep the plain `*Action` bodies exported and tested — they are the only place reminder behaviour can be verified without a DOM harness.
3. Preserve `{ silent: true }` on these settings writes; they must not fire the "Barn preferences saved" toast after an export or snooze.

### IMP-093: Photo Cache Cluster Moved Into a Sub-Hook

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Stability & Mobile PWA (`stability-pwa`)
- **Origin:** Session Improvement
- **User Goal:** Get the photo cache and its four loaders out of the monolith while keeping the memory behaviour and lookup order identical.
- **Summary:** Fourth barn-store slice: `src/hooks/barnStore/usePhotoCache.ts` now creates the bounded LRU (sized from the device capability tier) and owns the four loaders for animal photos, animal photo batches, feed-batch tags and ledger receipts. The sub-hook takes only `adapterRef`, `snapshotRef` and the live `snapshot`, and returns the cache ref plus the loaders, so the thirty-odd imperative `photoCacheRef` touch points elsewhere in the store keep working unchanged. Lookup order is unchanged and now testable: cache, snapshot data URL, storage adapter, snapshot thumbnail, with the batch loader deduping, capping at 60 ids and falling back to thumbnails when the adapter throws. Every remaining set/delete/clear in the store now goes through `rememberPhoto`, `forgetPhoto` and `clearPhotoCache` — 25 call sites, with only the read passed to `hydrateSnapshotWithPhotoDataUrls` still touching the ref directly. `useBarnStore.ts` dropped from 9,498 to 9,386 lines; the memory-pressure effect moved two statements down but still clears the same cache every five seconds above 80% heap. The 200-key contract snapshot is untouched.
- **Tracked Files:** `src/hooks/barnStore/usePhotoCache.ts`, `src/hooks/__tests__/photoCache.test.ts`, `src/hooks/useBarnStore.ts`, `MODULES.md`

**Automated Invariants Checked:**
- `src/hooks/barnStore/usePhotoCache.ts` must contain `export function usePhotoCache`, `createBudgetedPhotoCache`, `loadAnimalPhotoDataUrlWith`, `loadFeedBatchTagPhotoDataUrlWith`, `loadLedgerEntryReceiptPhotoDataUrlWith`, `rememberPhoto`, `forgetPhoto`, `clearPhotoCache` — *The loaders and the budgeted cache construction must stay in this slice; the plain `*With` bodies are the only testable record of the lookup order.*
- `src/hooks/useBarnStore.ts` must contain `from './barnStore/usePhotoCache'` — *Re-inlining a loader would fork the cache lookup order and reopen the drift this extraction closed.*
  - Forbidden regression: `const loadAnimalPhotoDataUrl = useCallback(`
- `src/hooks/__tests__/photoCache.test.ts` must contain `survives a failing adapter batch`, `namespaced cache key` — *The two behaviours most likely to regress: adapter failures must not break print preview, and feed/ledger keys must not collide with animal photo ids.*

**Restoration Playbook if Overwritten:**
1. Photo cache policy lives in `barnStore/usePhotoCache.ts`; the store keeps the ref only for imperative clear/set/delete calls.
2. Keep the key prefixes (`feed-tag:`, `ledger-receipt:`) — dropping them lets a batch or entry id overwrite an animal photo.
3. The cache is transient and rebuildable: never persist it, and keep the memory-pressure clear wired to the same ref the loaders use.

### IMP-094: Task & Memo Alert Dismissals Moved Into a Sub-Hook

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Home & Alerts (`alerts-home`)
- **Origin:** Session Improvement
- **User Goal:** Shrink the barn store again with the smallest remaining cluster, without changing when an ignored task or dismissed memo alert returns.
- **Summary:** Fifth barn-store slice: `src/hooks/barnStore/useAlertDismissals.ts` now owns the three settings-only dismissal actions (permanent task-alert ignore, clearing one species overdue-alert group, dismissing a species memo alert). The sub-hook takes `enqueueStoreMutation`, `updateSettingsInternal`, `snapshotRef` and `notify`; the store keeps revisions, the outbox and the settings writer. The map merges are plain exported functions (`mergeIgnoredTaskIds`, `buildDismissedTaskGroupKeys`, `buildDismissedMemoAlertSignatures`) with a shared `normalizeAlertSpeciesKey`, so the persistence decisions are pinned by tests instead of hidden in callbacks: blank or empty-array signatures record nothing, other species are preserved, task ids dedupe against existing entries, and only the task-ignore and group-clear paths toast. Toast strings, silent writes, empty-input early returns and the no-snapshot guard are unchanged. `useBarnStore.ts` dropped from 9,391 to 9,347 lines and the 200-key contract snapshot is untouched.
- **Tracked Files:** `src/hooks/barnStore/useAlertDismissals.ts`, `src/hooks/__tests__/alertDismissals.test.ts`, `src/hooks/useBarnStore.ts`, `docs/plans/handoff-modularity-reusability.yaml`, `MODULES.md`

**Automated Invariants Checked:**
- `src/hooks/barnStore/useAlertDismissals.ts` must contain `export function useAlertDismissals`, `mergeIgnoredTaskIds`, `buildDismissedTaskGroupKeys`, `buildDismissedMemoAlertSignatures`, `normalizeAlertSpeciesKey` — *The three merges and the species-key normaliser are the only record of which dismissal survives and under which key; inlining them again would hide the rule inside a callback.*
- `src/hooks/useBarnStore.ts` must contain `from './barnStore/useAlertDismissals'` — *Re-inlining a dismissal callback forks the map merge and silently changes when the alert returns.*
  - Forbidden regression: `const clearTaskAlertGroup = useCallback(`
- `src/hooks/__tests__/alertDismissals.test.ts` must contain `Dismissed 2 task alert(s) permanently.`, `ignores a blank signature` — *The count-toasted message and the blank-signature no-op are the two behaviours most likely to drift; both are user-visible.*

**Restoration Playbook if Overwritten:**
1. Alert dismissals live in `barnStore/useAlertDismissals.ts`; the store only wires the queue, settings writer, ref and notifier.
2. Keep `normalizeAlertSpeciesKey` shared by all three maps — divergent keys make a dismissal appear not to stick.
3. Only the task-ignore and group-clear paths toast; memo dismissal is deliberately silent, and empty input must never write settings.

### IMP-095: Cloud-Sync Settings & PKCE Actions Moved Into a Sub-Hook

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Diagnostics & Sync (`diagnostics-sync`)
- **Origin:** Session Improvement
- **User Goal:** Move the cloud app-folder settings and sign-in controls out of the store so the OAuth hand-off and its toasts are readable and testable in one place.
- **Summary:** Sixth barn-store slice: `src/hooks/barnStore/useCloudSyncActions.ts` owns the four cloud-sync controls — persist a settings patch, adopt a hand-entered access token, disconnect, and start the OAuth PKCE redirect. Each mirrors the client-state module result into React state, so the slice takes `setCloudSyncState` and `notify`; the client-state module is reached through `CLOUD_SYNC_CLIENT_PORT`, which tests replace with fakes and production leaves unset. Behaviour is unchanged: a rejected token keeps the previously persisted `enabled` flag, persists `provider` anyway and stays silent; an accepted one forces `enabled: true` and toasts the provider label; disconnect always toasts and clears either one provider or all of them; PKCE persists `provider`, `customOAuthClientId` and `enabled` before the redirect and lets a redirect failure reject to the caller. The store keeps the sync run, background schedule and busy flag. `useBarnStore.ts` dropped from 9,347 to 9,302 lines; the 200-key contract snapshot is untouched.
- **Tracked Files:** `src/hooks/barnStore/useCloudSyncActions.ts`, `src/hooks/__tests__/cloudSyncActions.test.ts`, `src/hooks/useBarnStore.ts`, `docs/plans/handoff-modularity-reusability.yaml`, `MODULES.md`

**Automated Invariants Checked:**
- `src/hooks/barnStore/useCloudSyncActions.ts` must contain `export function useCloudSyncActions`, `CLOUD_SYNC_CLIENT_PORT`, `cloudSyncProviderLabel`, `startCloudSyncPkceAction` — *The provider label and the injectable client port are what keep the four actions testable; recreating the label inline is how OneDrive and Drive toasts drift apart.*
- `src/hooks/useBarnStore.ts` must contain `from './barnStore/useCloudSyncActions'` — *Re-inlining an auth control would split the settings write from the state mirror and can strand a token without an enabled provider.*
  - Forbidden regression: `const startCloudSyncPkce = useCallback(`
- `src/hooks/__tests__/cloudSyncActions.test.ts` must contain `held in memory only`, `persists provider, client id and enabled before redirecting` — *Memory-only tokens are a privacy promise, and persisting settings before redirecting is what lets the OAuth callback find its provider.*

**Restoration Playbook if Overwritten:**
1. Cloud-sync controls live in `barnStore/useCloudSyncActions.ts`; the store supplies `setCloudSyncState` and `notify` and keeps the actual sync run.
2. Never persist an access token — only settings and the custom client id may be written; tokens stay in memory by design.
3. Persist the provider and client id before starting the PKCE redirect, or the callback cannot resolve which provider it belongs to.

### IMP-096: OPFS Vault Save/Describe/Delete/Restore Moved Into a Sub-Hook

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Backups & Safety (`backup-safety`)
- **Origin:** Session Improvement
- **User Goal:** Keep the vault restore path — the one operation that overwrites a live barn — in a small, tested module instead of a 9k-line hook.
- **Summary:** Seventh barn-store slice: `src/hooks/barnStore/useOpfsVaultActions.ts` owns the four vault operations — save a manual snapshot, describe a backup by key or file name, download it, delete it, and restore it by key. The restore keeps the exact order that makes it safe to interrupt (safety snapshot → photo-cache clear → snapshot replace → sync-state clear → species reset → reload) and still runs inside `enqueueStoreMutation`; the wiped-recovery path calls the unqueued variant so it never waits on a lock it already holds. Save still mirrors to the native vault and still falls back to the rolling IndexedDB vault when OPFS is missing, with the same toasts. Storage primitives are an injectable `OPFS_VAULT_STORAGE_PORT`, so tests drive every branch without OPFS or IndexedDB. `useBarnStore.ts` dropped from 9,302 to 9,199 lines; the 200-key contract snapshot is untouched.
- **Tracked Files:** `src/hooks/barnStore/useOpfsVaultActions.ts`, `src/hooks/__tests__/opfsVaultActions.test.ts`, `src/hooks/useBarnStore.ts`, `docs/plans/handoff-modularity-reusability.yaml`, `MODULES.md`

**Automated Invariants Checked:**
- `src/hooks/barnStore/useOpfsVaultActions.ts` must contain `export function useOpfsVaultActions`, `OPFS_VAULT_STORAGE_PORT`, `describeOpfsVaultBackup`, `restoreOpfsVaultBackupUnqueued` — *The injected storage port is what lets the restore path be tested without a real OPFS; the unqueued restore is what keeps the wiped-recovery path from deadlocking on the mutation lock.*
- `src/hooks/useBarnStore.ts` must contain `from './barnStore/useOpfsVaultActions'` — *Re-inlining restore would separate the safety snapshot from the replace, which is the one ordering that prevents a failed restore from destroying the only copy of a barn.*
  - Forbidden regression: `const restoreOpfsVaultBackupInternal = useCallback(`
- `src/hooks/__tests__/opfsVaultActions.test.ts` must contain `runs inside the mutation queue in safety order`, `skips the safety snapshot after a wiped-storage recovery` — *Those two tests are the guard rails for the restore: the order of side effects, and the deliberate exception after storage was wiped (there is nothing left to back up).*

**Restoration Playbook if Overwritten:**
1. Vault operations live in `barnStore/useOpfsVaultActions.ts`; the store supplies the snapshot refs, adapter replace and listing.
2. Restore order is the safety contract: safety snapshot, clear photo cache, replace snapshot, clear sync/reminder state, reset species, reload — then toast.
3. Call `restoreOpfsVaultBackupUnqueued` only from code that already runs inside `enqueueStoreMutation`, never from UI handlers.

### IMP-097: Sync-Conflict Dismissal Moved Into a Sub-Hook

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Diagnostics & Sync (`diagnostics-sync`)
- **Origin:** Session Improvement
- **User Goal:** Make the two ways a sync conflict is cleared share one definition of “resolved”, so dismissing and resolving can never disagree about what the settled record looks like.
- **Summary:** Eighth barn-store slice: `src/hooks/barnStore/useSyncConflictDismissal.ts` owns dismissing a sync conflict — find it, mark a resolved copy, persist it, replace it in the React list — and exports the two pure helpers (`buildResolvedSyncConflict`, `markSyncConflictResolved`) that `resolveSyncConflict` now also uses instead of rebuilding the same `{ ...conflict, resolved: true }` mapping inline. Behaviour is unchanged: an unknown conflict id stays a silent no-op with no IndexedDB write, dismissal applies no delta operation and toasts nothing (the toast belongs to resolve), and a failed write propagates without touching the list. The store keeps `syncConflicts` state, `resolveSyncConflict` and the sync runs. `useBarnStore.ts` dropped from 9,199 to 9,195 lines; the 200-key contract snapshot is untouched.
- **Tracked Files:** `src/hooks/barnStore/useSyncConflictDismissal.ts`, `src/hooks/__tests__/syncConflictDismissal.test.ts`, `src/hooks/useBarnStore.ts`, `docs/plans/handoff-modularity-reusability.yaml`, `MODULES.md`

**Automated Invariants Checked:**
- `src/hooks/barnStore/useSyncConflictDismissal.ts` must contain `export function useSyncConflictDismissal`, `buildResolvedSyncConflict`, `markSyncConflictResolved` — *Both cleared-conflict paths must build the same resolved record; a local `resolved: true` guess in either caller is how the list and IndexedDB drift apart.*
- `src/hooks/useBarnStore.ts` must contain `from './barnStore/useSyncConflictDismissal'` — *Dismissal is the quiet path: it must not grow a delta operation or a toast of its own, which is exactly what re-inlining it next to resolve invites.*
  - Forbidden regression: `const dismissSyncConflict = useCallback(`
- `src/hooks/__tests__/syncConflictDismissal.test.ts` must contain `persists the resolved copy before updating the list`, `leaves the barn-data fields alone` — *Dismissal must write before it mutates UI state, and it must never touch winning/losing values — those two facts are what make it a dismissal rather than a resolution.*

**Restoration Playbook if Overwritten:**
1. Conflict dismissal lives in `barnStore/useSyncConflictDismissal.ts`; the store supplies the list, its setter and the IndexedDB write.
2. Dismissal is silent by design — no toast, no delta operation, no barn write. Only `resolveSyncConflict` applies a chosen value.
3. Use `buildResolvedSyncConflict` + `markSyncConflictResolved` for any new cleared-conflict path instead of rebuilding the mapping.

### IMP-098: Sync-Conflict Resolution Moved Into a Sub-Hook

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Diagnostics & Sync (`diagnostics-sync`)
- **Origin:** Session Improvement
- **User Goal:** Make “apply the winning/losing value” a single reviewed path, since it is the only conflict action that rewrites both the barn snapshot and the operation log.
- **Summary:** Ninth barn-store slice: `src/hooks/barnStore/useSyncConflictResolution.ts` owns resolving a sync conflict — build the outbox operation for the chosen side, merge it into the snapshot and op log, reindex revisions, mark the conflict resolved, reload and toast. It runs inside `enqueueStoreMutation`, loads the op log only when it is not hydrated yet (and then deliberately leaves React state alone), and shares the resolved-marking helpers with dismissal. The pure sync engine is a port (`SYNC_RESOLUTION_ENGINE`), so tests assert the exact operation parameters without running a real merge. Behaviour is unchanged, including swallowing failures into `reportPersistenceFailure` and skipping unknown ids or an unloaded snapshot. The 200-key contract snapshot is untouched.
- **Tracked Files:** `src/hooks/barnStore/useSyncConflictResolution.ts`, `src/hooks/__tests__/syncConflictResolution.test.ts`, `src/hooks/useBarnStore.ts`

**Automated Invariants Checked:**
- `src/hooks/barnStore/useSyncConflictResolution.ts` must contain `export function useSyncConflictResolution`, `SYNC_RESOLUTION_ENGINE`, `syncOperationsHydratedRef` — *The hydrated check is what stops resolution from replacing the in-memory op log with a stale reloaded one; removing it silently drops operations from the sync index.*
- `src/hooks/useBarnStore.ts` must contain `from './barnStore/useSyncConflictResolution'` — *Resolution rewrites snapshot and op log together; re-inlining it invites a caller that does only one of the two.*
  - Forbidden regression: `const resolveSyncConflict = useCallback(`
- `src/hooks/__tests__/syncConflictResolution.test.ts` must contain `loads the operation log when it is not hydrated yet`, `reports a failure without marking the conflict resolved` — *Those are the two ways this path can corrupt sync state: stale op-log replacement and a half-applied resolution marked clean.*

**Restoration Playbook if Overwritten:**
1. Conflict resolution lives in `barnStore/useSyncConflictResolution.ts`; the store supplies the sync refs, revision index and adapter.
2. Only resolve rewrites the barn; dismissal never applies a value.
3. When the op log is not hydrated, use the freshly loaded operations and do not mirror the merge into React state.

### IMP-099: Rolling IndexedDB Backup Actions Moved Into a Sub-Hook

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Backups & Safety (`backup-safety`)
- **Origin:** Session Improvement
- **User Goal:** Give the always-available rolling vault the same tested restore ordering as the OPFS vault, instead of a second hand-copied sequence.
- **Summary:** Tenth barn-store slice: `src/hooks/barnStore/useRollingBackupActions.ts` owns restoring and deleting rolling IndexedDB snapshots. Restore keeps the safety order (safety snapshot → photo-cache clear → replace with bookkeeping stripped → sync/reminder clear → reload → toast) inside `enqueueStoreMutation`, and intentionally differs from the OPFS restore in one way: it does not switch the active species, because the rolling snapshot came from this same app instance and the current selection is still valid. Both restore paths now share `stripRestoredBackupBookkeeping`. Storage primitives are an injectable `ROLLING_BACKUP_STORAGE_PORT`. The 200-key contract snapshot is untouched.
- **Tracked Files:** `src/hooks/barnStore/useRollingBackupActions.ts`, `src/hooks/__tests__/rollingBackupActions.test.ts`, `src/hooks/useBarnStore.ts`

**Automated Invariants Checked:**
- `src/hooks/barnStore/useRollingBackupActions.ts` must contain `export function useRollingBackupActions`, `ROLLING_BACKUP_STORAGE_PORT`, `runDestructiveRestore` — *Both restore paths must strip `lastBackupMeta` and the reminder snooze; a local copy of that cleaning step is how a restored backup immediately triggers “backup overdue” again.*
- `src/hooks/useBarnStore.ts` must contain `from './barnStore/useRollingBackupActions'` — *Re-inlining the rolling restore would let it drift from the OPFS ordering, which is the pair users rely on when one storage backend fails.*
  - Forbidden regression: `const restoreRollingBackupByKey = useCallback(`
- `src/hooks/__tests__/rollingBackupActions.test.ts` must contain `restores in safety order inside the mutation queue`, `keeps the selected species` — *Order is the safety contract, and the species difference from the OPFS path is deliberate — asserting it stops a future “unify these two” edit from changing behaviour.*

**Restoration Playbook if Overwritten:**
1. Rolling restore lives in `barnStore/useRollingBackupActions.ts`; the store supplies the refs, adapter replace and vault refresh.
2. Keep restore inside the mutation queue, and keep the safety snapshot before replacing anything.
3. Do not add a species switch here — the rolling snapshot belongs to the current session.

### IMP-100: OPFS /archives Offload Moved Into a Sub-Hook

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Backups & Safety (`backup-safety`)
- **Origin:** Session Improvement
- **User Goal:** Keep the archive offload — the operation that removes animals from the live barn — in a tested module that always reads the authoritative snapshot.
- **Summary:** Eleventh and final planned barn-store slice: `src/hooks/barnStore/useOpfsArchiveOffload.ts` owns moving animals out of the active database into a zipped OPFS archive bundle: read the adapter snapshot (never React state, so a post-save offload cannot archive a stale barn), hydrate photos, build the bundle, save it, replace the snapshot with the stubs-only one, clear photo cache, drop selections pointing at animals that left, reload and toast. Empty selections, unsupported OPFS, nothing-eligible and build failures all keep their original silent-or-toast behaviour. `backupVault` stays a dynamic import so its chunk is unchanged; tests inject the builder instead of running the ZIP pipeline. The unqueued variant is exposed for callers that already hold `enqueueStoreMutation`. `useBarnStore.ts` dropped from 9,130 to 9,075 lines; the 200-key contract snapshot is untouched.
- **Tracked Files:** `src/hooks/barnStore/useOpfsArchiveOffload.ts`, `src/hooks/__tests__/opfsArchiveOffload.test.ts`, `src/hooks/useBarnStore.ts`

**Automated Invariants Checked:**
- `src/hooks/barnStore/useOpfsArchiveOffload.ts` must contain `export function useOpfsArchiveOffload`, `OPFS_ARCHIVE_STORAGE_PORT`, `loadBundleBuilder` — *The lazy bundle builder keeps `backupVault` and its ZIP code out of the main chunk; a static import here would silently undo that split.*
- `src/hooks/useBarnStore.ts` must contain `from './barnStore/useOpfsArchiveOffload'` — *Offload deletes live animals; re-inlining it next to snapshot state invites reading React state instead of the adapter and archiving the wrong barn.*
  - Forbidden regression: `const offloadAnimalsToOpfsArchiveInternal = useCallback(`
- `src/hooks/__tests__/opfsArchiveOffload.test.ts` must contain `drops stale selections`, `stays disabled with a toast when OPFS archives are unavailable` — *Selections must not survive an offload that removed their animal, and a browser without OPFS must keep the animals in the Archived tab rather than pretending to offload.*

**Restoration Playbook if Overwritten:**
1. Offload lives in `barnStore/useOpfsArchiveOffload.ts`; the store supplies the adapter read/replace and selection setters.
2. Always build from `loadFreshSnapshot`, never from React state.
3. Keep the `backupVault` dynamic import; `verify:chunks` guards the split.

### IMP-101: Typed Facades Over the Barn Store Surface

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** Let a screen import only the part of the store it needs, without changing the flat return object that the 200-key contract pins.
- **Summary:** Adds `src/hooks/barnStore/storeFacades.ts`: nine `Pick<BarnStore, ...>` facades (shell, animal, photo, backup, sync, species, calendar, husbandry, data) plus identity selectors, so consumers can name the slice they use and a domain-crossing call becomes visible in review. Nothing is added to the store object: the runtime surface, key order and `barnStoreContract.keys.json` are unchanged. `BarnStoreFacadeCoverage` is a compile-time `AssertNever<Exclude<keyof BarnStore, BarnStoreFacadeKeys>>`, so a new store key that no facade claims fails the typecheck instead of drifting. Typecheck and the 3-test contract gate pass unchanged.
- **Tracked Files:** `src/hooks/barnStore/storeFacades.ts`, `src/hooks/__tests__/barnStoreContract.keys.json`

**Automated Invariants Checked:**
- `src/hooks/barnStore/storeFacades.ts` must contain `export type BarnStoreFacadeCoverage`, `BarnStoreUnfacetedKeys`, `selectAnimalFacade`, `export type BarnStoreBackupFacade` — *The coverage assertion is the whole point: without it the facades silently fall behind the store and stop describing the surface.*
- `src/hooks/__tests__/barnStoreContract.keys.json` must contain `addOptimizedAnimalPhotos` — *The contract snapshot must stay byte-identical through facade work — facades are type-level and may never add, rename or reorder a key.*

**Restoration Playbook if Overwritten:**
1. Facades are type-only `Pick`s plus identity selectors; never add runtime keys to the store for them.
2. When the store gains a key, claim it in exactly one facade or the build fails by design.

### IMP-102: Animal CRUD Moved Into `useAnimalsCrud`

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** Keep the four actions that write or remove animal rows together, so the revision and outbox rules are written once instead of four times.
- **Summary:** Extracts `saveAnimal`, `archiveAnimals`, `deleteAnimalsBatch` and `deleteAnimal` into `src/hooks/barnStore/useAnimalsCrud.ts` (~348 lines out of the store). Behaviour is unchanged: saves still reconcile carriers, parse genotypes lazily, merge concurrent edits and refuse with `ConcurrentEditConflictError`; archives still auto-offload retired stock when OPFS is available; deletes still write a safety snapshot first, unlink offspring sire/dam references before removing rows, forget cached photos, clear stale selections and emit a `__delete__` outbox operation per animal. The store passes a stable adapter facade memoised once, so the returned callbacks keep their identity across renders. `useBarnStore.ts` 9,075 → 8,727 lines; 12 new unit tests; the 200-key contract snapshot is untouched.
- **Tracked Files:** `src/hooks/barnStore/useAnimalsCrud.ts`, `src/hooks/__tests__/animalsCrud.test.ts`, `src/hooks/useBarnStore.ts`

**Automated Invariants Checked:**
- `src/hooks/barnStore/useAnimalsCrud.ts` must contain `export function useAnimalsCrud`, `saveAnimalAction`, `deleteAnimalsBatchAction`, `ConcurrentEditConflictError` — *A concurrent edit must keep rejecting the save rather than silently overwrite a remote change; that check lives in the save action and nowhere else.*
- `src/hooks/useBarnStore.ts` must contain `from './barnStore/useAnimalsCrud'` — *Re-inlining save would separate the `_rev` bump from the outbox diff, which is how rows and sync operations drift apart.*
  - Forbidden regression: `const saveAnimal = useCallback(`
- `src/hooks/__tests__/animalsCrud.test.ts` must contain `takes a safety snapshot, unlinks offspring and forgets photos`, `hands retired stock to the offloader and stops when it succeeds` — *Those two tests pin the destructive-delete ordering and the archive-to-offload hand-off, the two paths where a regression loses user data.*

**Restoration Playbook if Overwritten:**
1. Animal mutations live in `barnStore/useAnimalsCrud.ts`; the store supplies a memoised adapter facade and the refs.
2. Every animal row write needs a matching `diffEntityFieldsToOperations` call with the same `_rev` and timestamp.
3. Deletes take a safety rolling snapshot before any unlink or removal.

### IMP-103: One Destructive-Restore Orchestrator With Verified Rollback

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Backups & Safety (`backup-safety`)
- **Origin:** Session Improvement
- **User Goal:** Make it impossible for a restore path to skip the safety snapshot or reorder the steps that protect a live barn.
- **Summary:** Adds `src/hooks/barnStore/restoreOrchestrator.ts` and points both the OPFS vault and rolling IndexedDB restores at it. The orchestrator owns the order once — load and refuse, safety snapshot (skipped after a wiped recovery or with an empty barn), photo-cache clear, replace with backup bookkeeping stripped, sync-state clear, recovery-context clear, source hook, verification, reload, toast. It also adds the step every path lacked: after the replace it re-reads the committed snapshot and compares animal and photo counts with the file; on a mismatch it puts the safety snapshot back, toasts what was expected versus found, and fails the restore instead of leaving a half-loaded barn. `stripRestoredBackupBookkeeping` now lives with the orchestrator, so the two slices no longer import each other. Recorded as ADR `docs/decisions/0001-destructive-restore.md`; 9 orchestrator tests cover ordering, both safety-snapshot skips, verification match, rollback and write failure.
- **Tracked Files:** `src/hooks/barnStore/restoreOrchestrator.ts`, `src/hooks/__tests__/restoreOrchestrator.test.ts`, `src/hooks/barnStore/useOpfsVaultActions.ts`, `src/hooks/barnStore/useRollingBackupActions.ts`, `docs/decisions/0001-destructive-restore.md`

**Automated Invariants Checked:**
- `src/hooks/barnStore/restoreOrchestrator.ts` must contain `export async function runDestructiveRestore`, `verifyRowCounts`, `Your previous barn was put back.` — *Verification without a rollback is worse than none: it detects a bad restore and still leaves the user with it.*
- `src/hooks/barnStore/useOpfsVaultActions.ts` must contain `runDestructiveRestore` — *The OPFS path must not clean and replace on its own again — that is how the two restore paths drifted apart the first time.*
  - Forbidden regression: `const cleanedVaultSnap`
- `docs/decisions/0001-destructive-restore.md` must contain `Every destructive restore goes through one orchestrator`, `verify the committed row counts` — *The ordering is a contract, and an ADR is what stops a future path from quietly doing it differently.*

**Restoration Playbook if Overwritten:**
1. All restores go through `runDestructiveRestore`; callers only decode their format and add source-specific steps.
2. Keep the safety snapshot before the replace and keep the count verification plus rollback after it.
3. A new restore source gets the net for free — do not copy the sequence.

### IMP-104: Sweep Hardening: Quota Tests, Import A11y, No Blanket Host Allow

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Close the small, concrete gaps the full sweep found instead of leaving them as report findings.
- **Summary:** Three sweep fixes. (1) Quota-failure coverage: new tests drive `QuotaExceededError` through animal save, batch delete and archive offload, asserting the failure is reported and that no success toast or reload happens. (2) Accessibility: the hidden backup file input in `WipedStorageRecoveryModal` now has `aria-label="Choose a backup file to recover from"`, so strict audits and automation see a named control. (3) Dev-server exposure: `vite.config.ts` no longer uses `allowedHosts: true`; localhost is allowed by default and preview hostnames come from `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` for the process that needs them, so the blanket any-Host acceptance is gone.
- **Tracked Files:** `src/hooks/__tests__/animalsCrud.test.ts`, `src/hooks/__tests__/opfsArchiveOffload.test.ts`, `src/components/WipedStorageRecoveryModal.tsx`, `vite.config.ts`

**Automated Invariants Checked:**
- `vite.config.ts` must contain `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` — *A blanket host allow lets any hostname reach the dev server; the env allowlist is the supported way to admit a preview origin.*
  - Forbidden regression: `allowedHosts: true`
- `src/components/WipedStorageRecoveryModal.tsx` must contain `aria-label="Choose a backup file to recover from"` — *The input is visually hidden, so the label is the only thing that names it for assistive tech.*
- `src/hooks/__tests__/animalsCrud.test.ts` must contain `surfaces a quota failure instead of claiming the animal was saved` — *Storage-full is a normal state on a phone; the save path must report it rather than toast success over a failed write.*

**Restoration Playbook if Overwritten:**
1. Preview hostnames are per-process: start the dev server with `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=<host>`, never by re-enabling blanket host acceptance.
2. Hidden inputs still need accessible names.
3. Quota paths must report and stay silent, never toast success.

### IMP-105: Backlog Workflow Gate Now Covers Open Handoffs, Not Just Plans

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** Stop a new backlog item from starting while an unfinished handoff still owns the work — the gate only looked for plans and silently ignored handoffs.
- **Summary:** Both backlog prompts now treat an open `handoff-*.yaml` as work in progress. `start_new_backlog_prompt.md` prechecks for active plans *and* handoffs whose `status:` still contains `[WIP]`/`[TODO]`, and refuses to pick a new entry until the handoff is finished; `resume_backlog_plan_prompt.md` now continues an open handoff when no active plan exists, instead of jumping straight to a new backlog item. `docs/plans/suggestions-backlog.md` records the gate in its header note and states plainly that the file is the owner’s scratch pad, worked one entry at a time and deliberately kept near-empty between releases. PRM-003/PRM-004 gained `handoff-*.yaml` invariants so the check cannot be dropped again.
- **Tracked Files:** `prompts/start_new_backlog_prompt.md`, `prompts/resume_backlog_plan_prompt.md`, `docs/plans/suggestions-backlog.md`, `src/domain/promptRegistry.ts`, `src/domain/promptsCatalog.ts`

**Automated Invariants Checked:**
- `prompts/start_new_backlog_prompt.md` must contain `handoff-*.yaml`, `open handoff` — *Without the handoff branch the precheck only guards plans, which is exactly how an unfinished handoff got abandoned for a fresh backlog item.*
- `prompts/resume_backlog_plan_prompt.md` must contain `handoff-*.yaml` — *The resume path is the one that decides what to work on when no plan exists; it must see handoffs before falling through to the starter.*
- `docs/plans/suggestions-backlog.md` must contain `no open plan and no open handoff`, `scratch pad` — *The backlog file itself has to say that it is a one-at-a-time scratch pad behind an open-work gate, or the next reader treats an empty list as an invitation.*

**Restoration Playbook if Overwritten:**
1. Both backlog prompts gate on open handoffs: continue `handoff-*.yaml` work with `[WIP]`/`[TODO]` before starting a new backlog entry.
2. The backlog is a scratch pad, not a queue — keep the header gate note and the one-at-a-time rule intact.

### IMP-106: Photo Mutations Moved Into `usePhotoMutations`

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** Keep the four photo writes together, because the easy mistakes are all photo-specific: two primaries, wrong sort order, or binary payloads leaking into the sync log.
- **Summary:** Milestone 1 continuation: `src/hooks/barnStore/usePhotoMutations.ts` now owns adding optimized photos, changing the primary cover, retitling and deleting. Behaviour is unchanged — appends after existing `sortOrder`, only the first photo becomes primary when none exists, every sibling gets a `_rev` bump when the cover changes, sync operations are metadata-only (`stripPhotoBlobsForSync`, `ignoreFields` on `dataUrl`/`thumbnailDataUrl`), and deleting the primary promotes the next sibling by sort order. Captions stay silent on success; deleting toasts `Photo removed.`. The store passes a memoised adapter facade, so the callbacks keep their identity across renders. `useBarnStore.ts` 8,731 → 8,531 lines; 11 new unit tests; the 200-key contract snapshot is untouched.
- **Tracked Files:** `src/hooks/barnStore/usePhotoMutations.ts`, `src/hooks/__tests__/photoMutations.test.ts`, `src/hooks/useBarnStore.ts`

**Automated Invariants Checked:**
- `src/hooks/barnStore/usePhotoMutations.ts` must contain `export function usePhotoMutations`, `stripPhotoBlobsForSync`, `isPrimary: !hasPrimary && idx === 0` — *Photo binaries must never enter the sync log, and the primary rule must stay one-per-animal — both are silent corruption when they drift.*
- `src/hooks/useBarnStore.ts` must contain `from './barnStore/usePhotoMutations'` — *Re-inlining delete would separate the primary-promotion step from the delete, leaving an animal with no cover photo.*
  - Forbidden regression: `const deleteAnimalPhoto = useCallback(`
- `src/hooks/__tests__/photoMutations.test.ts` must contain `promotes the next sibling when the primary is deleted`, `never creates a second primary` — *Those two are the invariants a future “simplify photos” edit is most likely to break.*

**Restoration Playbook if Overwritten:**
1. Photo writes live in `barnStore/usePhotoMutations.ts`; the store supplies the adapter facade, cache helpers and mutation queue.
2. Keep sync operations metadata-only and keep exactly one primary per animal.

### IMP-107: Breeding Lifecycle Moved Into `useBreeding`

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** Keep the rule that a breeding record and its post-birth chores agree about dates in one place, instead of five callbacks that each half-implement it.
- **Summary:** Milestone 1 continued: `src/hooks/barnStore/useBreeding.ts` owns log, outcome, recalculation, chore check-off and delete. `BreedingTaskCheckoffAction` moved with them and is re-exported from the store, so callers are unchanged. The date coupling now lives in one module: logging cascades chores from the gestation profile, marking Missed clears pending cleanup chores, recording a birth shifts post-birth chores to the actual date (excluding the chore just completed), and deleting removes the linked chores in the same operation batch. The store passes a memoised adapter facade plus the calendar/online probes. `useBarnStore.ts` 8,531 → 7,718 lines; 13 new unit tests; 200-key contract snapshot untouched.
- **Tracked Files:** `src/hooks/barnStore/useBreeding.ts`, `src/hooks/__tests__/breeding.test.ts`, `src/hooks/useBarnStore.ts`

**Automated Invariants Checked:**
- `src/hooks/barnStore/useBreeding.ts` must contain `export function useBreeding`, `getPendingBreedingCleanupTasks`, `recalculatePostBirthTasksForBreeding` — *A breeding write that forgets to clear or shift its chores leaves the barn showing work for a litter that will never arrive.*
- `src/hooks/useBarnStore.ts` must contain `from './barnStore/useBreeding'` — *Re-inlining any one breeding callback would split the date coupling that this module exists to hold together.*
  - Forbidden regression: `const logBreedingWithCascade = useCallback(`
- `src/hooks/__tests__/breeding.test.ts` must contain `clears pending chores when the breeding is marked missed`, `refuses to run before a birth date is recorded` — *These two guard the cleanup and the precondition that keeps a wrong-date recalculation from silently moving chores.*

**Restoration Playbook if Overwritten:**
1. Breeding writes live in `barnStore/useBreeding.ts`; the store supplies the adapter facade, calendar queue and online probe.
2. Never save a breeding status change without reconciling its linked post-birth chores.

### IMP-108: React-Free Store Ports Factory (`createStorePorts`)

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** Let backup import, reconciliation and tests drive the same mutation slices as the UI, without mounting a React component to get a write queue and revision allocator.
- **Summary:** Milestone 1 complete: `src/hooks/barnStore/storePorts.ts` builds the shared deps bundle for the extracted slices — serial write queue that survives a rejected mutation, per-entity revision allocation that never goes backwards even when handed a stale rev, the persisted logical sync counter, a caller-owned snapshot ref and no-op defaults for the UI-only callbacks. Together with the exported action functions this makes the store logic reusable outside React.
- **Tracked Files:** `src/hooks/barnStore/storePorts.ts`, `src/hooks/__tests__/storePorts.test.ts`

**Automated Invariants Checked:**
- `src/hooks/barnStore/storePorts.ts` must contain `export function createStorePorts`, `bumpRecordRevision`, `allocateNextLogicalCounter` — *A second revision allocator or counter source would let two writers mint the same revision for one entity.*
- `src/hooks/__tests__/storePorts.test.ts` must contain `keeps going after a rejection` — *A rejected mutation that kills the queue silently freezes every later write in the session.*

**Restoration Playbook if Overwritten:**
1. Unmountable callers build deps with `createStorePorts({ deviceId, snapshotRef })` rather than hand-rolling a queue and rev counter.
2. One storage-backed sync counter; never a second in-memory counter.

### IMP-109: Milestone Closure Is a Checkpoint, Not a Turn Boundary

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** A handoff run asked to go milestone to milestone stopped after each green verification instead of continuing, because the closure ritual read like the end of the work.
- **Summary:** The handoff now states its own execution policy: registering, verifying and committing a milestone is a checkpoint, not a turn boundary. After a checkpoint the run continues straight into the next milestone with no confirmation and no hand-back, and it ends only when the remaining list is empty or the run budget is exhausted — at which point the stop is reported as budget, with what landed and what remains. Missing tooling for a later milestone (coverage provider, jsdom harness, SDK) is added when needed and reported as a limitation instead of ending the run early. The resume prompt carries the same rule in an *Execution Continuity* section, and its “work remains ongoing” branch now says to continue rather than stop, with PRM-004 enforcing the phrase so the rule cannot be quietly dropped.
- **Tracked Files:** `docs/plans/handoff-barn-store-improvements.yaml`, `prompts/resume_backlog_plan_prompt.md`, `src/domain/promptRegistry.ts`, `src/domain/promptsCatalog.ts`

**Automated Invariants Checked:**
- `prompts/resume_backlog_plan_prompt.md` must contain `checkpoint, not a turn boundary`, `Execution Continuity`, `only acceptable reason to stop with work left` — *Without the continuity rule the resume workflow hands back after every verified milestone — the exact behaviour this entry exists to prevent.*
- `docs/plans/handoff-barn-store-improvements.yaml` must contain `execution_policy`, `checkpoint, not a turn boundary` — *The rule has to live in the handoff the run is following, not only in a prompt someone may not reload.*

**Restoration Playbook if Overwritten:**
1. A milestone closure is a checkpoint: register, verify, commit, then start the next milestone in the same run.
2. Only an empty remaining list or an exhausted budget ends a handoff run; report budget stops as budget, with what landed.

### IMP-110: Sync Outbox Retention (Age Window Plus Hard Cap)

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** Stop the sync operation log from growing for the life of the install, which made every full rewrite pay for the entire history.
- **Summary:** Milestone 3, first half: `src/domain/syncRetention.ts` decides what a bounded outbox keeps, and the store applies it in `replaceSyncOperationsWithRetention` on every full rewrite — the path all merges and conflict resolutions already go through. Retention stays out of the storage layer deliberately: importing the policy there pulled the domain module into the storage chunk and created a new chunk cycle. The policy is age-first and conservative: an operation is only expired once it is older than the retention window (120 days) because peers have had many chances to pull it, the hard ceiling (20,000) is a pathological-growth backstop that drops only the oldest, ordering is timestamp-then-logical-counter so a clock tie cannot invert age, and an unparseable timestamp is treated as recent rather than ancient. The common case — a log inside both limits — returns the operations untouched, so ordering cannot be perturbed. Pruning is reported as a storage diagnostic event rather than happening silently.
- **Tracked Files:** `src/domain/syncRetention.ts`, `src/hooks/useBarnStore.ts`, `EXTRACTION_INVENTORY.md`, `src/hooks/__tests__/syncRetention.test.ts`

**Automated Invariants Checked:**
- `src/domain/syncRetention.ts` must contain `export function planSyncOperationRetention`, `DEFAULT_SYNC_RETENTION_POLICY` — *Retention is a policy decision, not a storage detail; it has to stay a pure, testable function.*
- `src/hooks/useBarnStore.ts` must contain `planSyncOperationRetention`, `replaceSyncOperationsWithRetention` — *Without the prune on the rewrite path the outbox silently returns to unbounded growth, which is exactly the regression this entry exists to prevent — and the policy must stay in the store, not the storage chunk.*

**Restoration Playbook if Overwritten:**
1. Expire by age before cap, never the reverse: a young operation is never dropped merely because the log is large.
2. Undated operations are kept; treat an unparseable timestamp as recent.

### IMP-111: Bulk Sync-Conflict Resolution in One Merge

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** Clearing a review queue of conflicts meant clicking through each one, and each click rewrote the snapshot and the whole operation log — twenty conflicts, twenty full merges.
- **Summary:** Milestone 3, second half: `resolveAllSyncConflictsAction` builds one operation per open conflict, merges them together, writes the snapshot and op log once, then marks each conflict resolved. Returns how many were resolved; `resolveSyncConflict` keeps its per-item path. The slice still returns only `resolveSyncConflict` to the store, so the 200-key contract is untouched, and the batched action sits on the same deps seam (`engine`, hydrated-ref fast path) as the single resolver. Four tests cover the single merge, the chosen side, the nothing-open case and a failed merge.
- **Tracked Files:** `src/hooks/barnStore/useSyncConflictResolution.ts`, `src/hooks/__tests__/syncConflictBulkResolve.test.ts`

**Automated Invariants Checked:**
- `src/hooks/barnStore/useSyncConflictResolution.ts` must contain `export async function resolveAllSyncConflictsAction`, `resolve all sync conflicts` — *A bulk path that loops the single resolver would silently reintroduce one full merge per conflict.*
- `src/hooks/__tests__/syncConflictBulkResolve.test.ts` must contain `merges every open conflict in a single pass` — *The single-merge property is the entire point of this action and is invisible from the outside.*

**Restoration Playbook if Overwritten:**
1. Bulk resolution builds all operations first, merges once, then marks conflicts resolved.
2. Open conflicts are those with `resolved === false`; never re-resolve an already cleared one.

### IMP-112: Seeded Property Tests for `mergeDeltaOperations`

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** Hand-picked merge fixtures prove one path each; nothing checked the properties multi-device sync actually depends on across many different divergences.
- **Summary:** Milestone 4: `src/domain/__tests__/mergeDeltaProperties.test.ts` drives real `diffSnapshotsToSyncOperations` output through the merge engine across five seeds, asserting that merge order does not change the resulting operation set, that operation ids never duplicate, that replaying the same delta is idempotent, that local operations keep their order with unseen remote operations appended, and that repeated replay does not grow the log. The generator is a small LCG, so a failure names the seed and reproduces exactly — no new dependency and no randomised CI failures.
- **Tracked Files:** `src/domain/__tests__/mergeDeltaProperties.test.ts`

**Automated Invariants Checked:**
- `src/domain/__tests__/mergeDeltaProperties.test.ts` must contain `mergeDeltaOperations`, `diffSnapshotsToSyncOperations`, `SEEDS` — *The seeds must stay fixed: a random seed turns a reproducible failure into an intermittent one.*

**Restoration Playbook if Overwritten:**
1. Merge properties: order-independent op set, no duplicate ids, idempotent replay, stable local order, bounded log.
2. Keep the seed list literal so a failing case is reproducible.

### IMP-113: Bulk Conflict Resolution Is Reachable From the Review Log

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** The batched resolver existed but nothing could call it — the review UI only had per-conflict buttons, so the whole queue still meant clicking each row.
- **Summary:** The Field Collision Review Log header now carries **Keep all applied** and **Use all alternate** whenever more than one conflict is open. They share the row lock under a dedicated key (never a real conflict id), so a bulk run and a row click cannot overlap. The first attempt added a 201st store key and wired it through `src/App.tsx`, and the boot-entry checksum gate rejected the edit — `App.tsx` is checksum-locked, correctly. Instead the existing `resolveSyncConflict` now accepts either one id or a list: a list routes to the batched merge, so the key set stays at 200, no facade claim was needed, and no locked file was touched. The changelog records the widened signature anyway.
- **Tracked Files:** `src/components/ImportExportHubScreen.tsx`, `src/hooks/barnStore/useSyncConflictResolution.ts`, `docs/contracts/barn-store-contract.md`

**Automated Invariants Checked:**
- `src/components/ImportExportHubScreen.tsx` must contain `BULK_RESOLVE_LOCK_KEY`, `Keep all applied`, `Use all alternate` — *The bulk resolver is worthless if no control reaches it, and an unlocked bulk run can interleave with a row click.*
- `src/hooks/barnStore/useSyncConflictResolution.ts` must contain `typeof conflictId !== 'string'`, `resolveAllSyncConflictsAction` — *The list form is the only route to the single-merge path; without it the bulk buttons silently fall back to one merge per conflict.*

**Restoration Playbook if Overwritten:**
1. Bulk resolve lives on the review-log header, guarded by its own lock key.
2. Adding a store key means claiming it in a facade and recording it in the contract changelog.

### IMP-114: Contract-Change Gate Requires a Recorded Reason

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** The contract test froze the key set but said nothing about why it changed, so a snapshot edit could land with no explanation beyond the diff.
- **Summary:** Milestone 6, first half: `npm run verify:contract` compares `barnStoreContract.keys.json` against `docs/contracts/barn-store-contract.md`. The doc must declare the current key count and the snapshot’s SHA-256, and carry at least one dated changelog entry; any silent snapshot edit fails with a message naming the mismatch and telling you to add the line and update both. Added to `npm run verify`, so it runs with the rest of the gates. The changelog starts with the 200-key freeze and the 201st key added for bulk conflict resolution.
- **Tracked Files:** `scripts/verify-contract-changelog.ts`, `docs/contracts/barn-store-contract.md`, `package.json`

**Automated Invariants Checked:**
- `docs/contracts/barn-store-contract.md` must contain `## Changelog`, `- Keys: 200`, `- SHA-256:` — *The doc is the gate’s only input; without the declared count, hash and a changelog section the gate has nothing to compare.*
- `package.json` must contain `verify:contract` — *A gate that is not in `npm run verify` is a gate nobody runs.*

**Restoration Playbook if Overwritten:**
1. Changing the store contract: update the snapshot, add a dated changelog line, then update the declared key count and SHA-256 in the same change.
2. The hash is over the snapshot file’s exact bytes.

### IMP-115: Coverage Provider With a Ratcheted Floor

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** Test count is not coverage: the suite could grow while whole modules stayed untested, and nothing in the pipeline would notice.
- **Summary:** Milestone 6 complete: `@vitest/coverage-v8` is installed at the vitest version, `vitest.config.ts` measures `src/**` (tests excluded) and enforces floors of 47% statements, 39% branches, 33% functions and 48% lines, and `npm run verify:coverage` joins `npm run verify`. Measuring over all of `src/**` matters: the first run without an explicit include only counted files a test happened to import and reported 71.88 / 59.73 / 69.09 / 74.07, while the honest figure over every source file is 48.01 / 40.31 / 34.35 / 49.23 — untested modules were simply absent. Floors sit a point under the honest numbers as a ratchet.
- **Tracked Files:** `vitest.config.ts`, `package.json`

**Automated Invariants Checked:**
- `vitest.config.ts` must contain `provider: 'v8'`, `thresholds:` — *A provider without thresholds reports coverage and enforces nothing — the exact state this entry replaces.*
- `package.json` must contain `verify:coverage` — *The floor only holds if the pipeline runs it.*

**Restoration Playbook if Overwritten:**
1. Coverage floors are a ratchet: raise them when the real numbers rise, lower them only with a recorded reason.
2. Coverage measures `src/**` minus tests; do not exclude source to make a floor pass.

### IMP-116: Timing Instrumentation for Restores

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** Slow restores were reported as “it feels slow”, with no number to compare across barn sizes or releases.
- **Summary:** Milestone 5, third item: `src/utils/perfTiming.ts` provides a bounded recorder that times an async operation, records whether it resolves or rejects, rounds to hundredths and never throws into the caller. `runDestructiveRestore` is wrapped in `restore:destructive`, so every OPFS, rolling and archive restore lands a comparable duration in the process-wide `appPerfTimings` ring without touching the restore logic itself.
- **Tracked Files:** `src/utils/perfTiming.ts`, `src/hooks/barnStore/restoreOrchestrator.ts`, `src/utils/__tests__/perfTiming.test.ts`

**Automated Invariants Checked:**
- `src/hooks/barnStore/restoreOrchestrator.ts` must contain `appPerfTimings.time('restore:destructive'` — *Instrumentation that is not on the shared restore path measures nothing, because every restore goes through this function.*
- `src/utils/perfTiming.ts` must contain `createPerfTimingRecorder`, `while (kept.length > limit)` — *The ring bound is what keeps instrumentation from becoming its own memory leak.*

**Restoration Playbook if Overwritten:**
1. Wrap long operations with `appPerfTimings.time(label, fn)`; never let measurement throw into the caller.
2. Keep the sample ring bounded.

### IMP-117: Conflicts Can Be Cleared by Expiry Without a Delete Path

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** The review log kept every collision ever detected, and the loader sorted the whole history on every load — but there was no way to delete a row, so nothing could ever age out.
- **Summary:** Milestone 3 tail: `src/domain/syncConflictExpiry.ts` decides what ages out and the store applies it during conflict hydration, using a new `deleteSyncConflictsFromIdb` indexed delete. The rule that matters more than the window: **an unresolved conflict never expires**, because resolving is a decision only the owner can make and dropping the row would silently pick a side. Only rows already marked resolved expire, 30 days after `resolved_at` — the moment the owner decided — falling back to `detected_at` for rows resolved before that field existed; an unparseable timestamp counts as recent, a disabled window or bad clock returns the log unchanged, and survivors keep their newest-first order. Pruning is reported as a storage diagnostic rather than happening silently.
- **Tracked Files:** `src/domain/syncConflictExpiry.ts`, `src/storage/localSyncChannels.ts`, `src/hooks/useBarnStore.ts`, `src/domain/__tests__/syncConflictExpiry.test.ts`, `EXTRACTION_INVENTORY.md`

**Automated Invariants Checked:**
- `src/domain/syncConflictExpiry.ts` must contain `export function planSyncConflictRetention`, `conflict.resolved === true` — *The resolved check is the safety property: expiring an open conflict destroys an undecided choice.*
- `src/hooks/useBarnStore.ts` must contain `planSyncConflictRetention`, `deleteSyncConflictsFromIdb` — *A planner nobody calls leaves the log growing forever — the state this entry replaces.*

**Restoration Playbook if Overwritten:**
1. Only resolved conflicts expire; the window runs from `resolved_at`.
2. Deleting review-log rows is best effort: the log is history, not source of truth.

### IMP-118: Development Page Is Called Development Again

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** “The Development” started life as a section title inside Settings and got carried over as the page name when the section became its own screen. The page is the development and diagnostics console; it should say so.
- **Summary:** Every user-visible label now reads **Development**: the route title and lazy-route label in `src/App.tsx`, the Settings launcher tooltip, the two offline/probe hints, the weather panel’s pointer, the About modal entry, the back links from the Prompts Directory and the Suggestions Backlog, the diagnostics log message, the isolated error panel heading and the screen’s own update-policy toast. Internal identifiers (`development` route key, `DevelopmentScreen`, `onOpenDevelopment`, `DevelopmentErrorBoundary`) are unchanged, so the registry’s structural invariants still hold. Because the route label lives in the boot-locked `src/App.tsx`, the owner’s explicit request made this a sanctioned boot-entry edit: `BOOT_ENTRY_LOCK_CHECKSUMS` was regenerated for `src/App.tsx` in the same commit.
- **Tracked Files:** `src/App.tsx`, `src/domain/improvementRegistry.ts`, `src/components/DevelopmentScreen.tsx`, `src/components/DevelopmentErrorBoundary.tsx`, `src/components/SettingsAndSyncScreen.tsx`, `src/components/AboutModal.tsx`, `src/components/PromptsDirectoryScreen.tsx`, `src/components/SuggestionsBacklogScreen.tsx`, `src/components/DiagnosticsAndSupportPanel.tsx`, `src/storage/weatherForecast.ts`

**Automated Invariants Checked:**
- `src/App.tsx` must contain `development: 'Development'` — *The old settings-section title was the page name by accident; keeping it out of the route table is the point of this entry.*
  - Forbidden regression: `The Development`
- `src/components/DevelopmentScreen.tsx` must contain `Development` — *User-visible copy must not reintroduce the section title as a page name.*
  - Forbidden regression: `The Development`

**Restoration Playbook if Overwritten:**
1. The page is “Development”; the route key and component names were renamed in IMP-120.
2. Renaming user-visible copy in `src/App.tsx` requires regenerating its boot-entry checksum in the same commit.

### IMP-119: Build-Time Site Identity: One Authored URL Instead of Hardcoded /Pedigree/ Paths

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** CI & Tooling (`ci-tooling`)
- **Origin:** Session Improvement
- **User Goal:** Keep the app modular and reusable so the same source deploys from a differently named repository without hand-editing public URLs.
- **Summary:** Moves every public URL the build emits behind one authored value, `package.json#homepage`. A new `scripts/siteIdentity.ts` resolves origin, deployment base path and sitemap date - explicit `--base` flag first, then `GITHUB_REPOSITORY` in CI, then the homepage path - into `%SITE_URL%` / `%SITE_BASE%` / `%SITE_LASTMOD%` tokens. `vite.config.ts` registers the `site-identity-tokens` plugin, which substitutes the canonical/OpenGraph/Twitter/JSON-LD tags during the HTML transform and rewrites `dist/robots.txt`, `dist/sitemap.xml` and `dist/404.html` after the public folder is copied, so a fork or a personal test repository needs no source edits to stop pointing at `/Pedigree/`. A `verify:site-identity` gate then fails any build in which the canonical link, the `robots.txt` sitemap URL, the `sitemap.xml` location or the `404.html` redirect disagrees with the `--base` it was built with.
- **Tracked Files:** `scripts/siteIdentity.ts`, `scripts/verify-site-identity.ts`, `vite.config.ts`, `index.html`, `public/robots.txt`, `public/sitemap.xml`, `public/404.html`, `package.json`, `.github/workflows/ci.yml`, `.github/workflows/deploy-pages.yml`, `IMPROVEMENTS.md`, `AGENTS.md`

**Automated Invariants Checked:**
- `scripts/siteIdentity.ts` must contain `%SITE_URL%`, `resolveSiteIdentity`, `GITHUB_REPOSITORY`, `site-identity-tokens` — *Every emitted site URL, base path and sitemap date must be resolved from one authored homepage value plus the build base path rather than repository-specific literals.*
- `vite.config.ts` must contain `siteIdentityPlugin` — *The site-identity plugin must stay registered in Vite so dev HTML and the built public assets share one URL source.*
- `scripts/verify-site-identity.ts` must contain `rel="canonical"`, `Sitemap:`, `<loc>`, `404.html`, `--base` — *A gate must compare the emitted canonical, robots sitemap, sitemap location and 404 redirect against the build base instead of trusting the token substitution.*
- `package.json` must contain `"verify:site-identity"` — *The site-identity gate needs a stable npm entry point for CI.*
- `.github/workflows/ci.yml` must contain `npm run verify:site-identity -- --base=` — *CI must run the site-identity gate right after the subpath build, while that build is still in dist.*
- `.github/workflows/deploy-pages.yml` must contain `bun scripts/verify-site-identity.ts --base=` — *The Pages deploy must gate on the real base_path it is publishing, not one inferred from source.*

**Restoration Playbook if Overwritten:**
1. Keep both token passes in `site-identity-tokens`: `transformIndexHtml` (order `pre`) for `index.html` and `closeBundle` for the `public/` files Vite copies verbatim.
2. Never re-introduce a hardcoded owner, repository or `/Pedigree/` path in `index.html`, `public/robots.txt`, `public/sitemap.xml` or `public/404.html`; author the URL once in `package.json#homepage`.
3. Keep base-path precedence as explicit `--base` (including `/`, which must win over the homepage path for root and custom-domain deploys), then `GITHUB_REPOSITORY`, then the homepage path; reordering it silently breaks subpath or root deployments.
4. Run `npm run verify:site-identity -- --base=<deployment base>` after every build; it is the only check that reads the emitted canonical, robots and sitemap URLs and the 404 redirect against the base actually used.

### IMP-120: Development Rename Reaches Files, Symbols and the Route Key

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** Renaming only the labels left the old settings-section name everywhere else — file names, component names, prop names, the route key, the guardrails module and the crash-dump filename — so the codebase still called the page by the wrong name.
- **Summary:** The rename is complete rather than cosmetic: `TechyStuffScreen.tsx` → `DevelopmentScreen.tsx`, `TechyStuffErrorBoundary.tsx` → `DevelopmentErrorBoundary.tsx`, `domain/techyStuffGuardrails.ts` → `domain/developmentGuardrails.ts` (test included), `onOpenTechyStuff` → `onOpenDevelopment`, `onBackToTechyStuff` → `onBackToDevelopment`, and the `techyStuff` route key → `development` across the route table, `WorkspaceRoute`, the settings launcher and the isolated boundary mounts. The crash-dump filename became `pedigree-development-fault-*.txt`. Registry text, rationales, the extraction inventory and the generated docs were rewritten to match, and `src/App.tsx`’s boot-entry checksum was regenerated again in the same commit. One fallout fix: the OPFS multi-vault restore test legitimately takes ~6s in a full parallel suite, so `vitest.config.ts` now sets a 15s test timeout instead of letting a slow machine fail the build.
- **Tracked Files:** `src/components/DevelopmentScreen.tsx`, `src/components/DevelopmentErrorBoundary.tsx`, `src/domain/developmentGuardrails.ts`, `src/domain/__tests__/developmentGuardrails.test.ts`, `src/App.tsx`, `src/domain/improvementRegistry.ts`, `vitest.config.ts`

**Automated Invariants Checked:**
- `src/components/DevelopmentScreen.tsx` must contain `DevelopmentScreen` — *The screen file anchors the rename; if it disappears the rest of the renames are dangling.*
- `src/domain/developmentGuardrails.ts` must contain `evaluateStorageQuotaForOperation` — *The guardrails module carries the page policy; it must stay findable under the new name.*
- `src/App.tsx` must contain `DevelopmentScreen` — *The route key was the last place the old section title survived in code.*
  - Forbidden regression: `techyStuff`

**Restoration Playbook if Overwritten:**
1. The page, its files and its route key are all “development”; only historical changelog prose may still name the old section.
2. Any rename touching `src/App.tsx` must regenerate its boot-entry checksum in the same commit.

### IMP-121: Sync-Conflict Slice Leaves Prop Drilling

- **Release Milestone:** Alpha 3 (`alpha-3`)
- **Category:** Workflow & UI Polish (`workflow-polish`)
- **Origin:** Session Improvement
- **User Goal:** The Import/Export hub was handed conflicts and their two actions as props it only forwarded to one panel, so every conflict change re-rendered the whole hub and the derived open-conflict list was rebuilt on every render.
- **Summary:** First slice of the milestone 5 context split: `hooks/barnStore/syncConflictSlice.tsx` now carries `syncConflicts`, its two actions and a memoised `openConflicts` list on their own context, and `SyncConflictSliceProvider` wraps the hub in `App.tsx`. The hub no longer declares `syncConflicts`, `onResolveSyncConflict` or `onDismissSyncConflict`; it reads the slice, which also means the open list keeps one identity per conflict-array change instead of one per render. `useBarnStore` still returns the same keys, so the contract snapshot is untouched. `selectOpenConflicts` is pure and unit-tested.
- **Tracked Files:** `src/hooks/barnStore/syncConflictSlice.tsx`, `src/hooks/__tests__/syncConflictSlice.test.ts`, `src/components/ImportExportHubScreen.tsx`, `src/App.tsx`, `src/domain/improvementRegistry.ts`

**Automated Invariants Checked:**
- `src/hooks/barnStore/syncConflictSlice.tsx` must contain `selectOpenConflicts`, `SyncConflictSliceProvider`, `useSyncConflictSlice` — *The slice is the only place the open-conflict list is derived; losing it re-introduces per-render filtering.*
- `src/components/ImportExportHubScreen.tsx` must contain `useSyncConflictSlice` — *The hub reads conflicts from the slice; re-adding the props restarts prop drilling for the next screen.*
  - Forbidden regression: `onResolveSyncConflict`, `onDismissSyncConflict`

**Restoration Playbook if Overwritten:**
1. Wrap any consumer that needs conflicts in `<SyncConflictSliceProvider>`; it throws outside one, by design.
2. Keep `useBarnStore` returning every key it did before the split — slices are additional ways in, not removals.
3. Add the next slice the same way: provider at the route, derived lists memoised inside it.

## 2026-11-28 — Append-Only Ledgers Generated From Their Registries
Why:        IMPROVEMENTS.md and PROMPT_CHANGES.md were hand-maintained and generated at the same time, so the append-only header vanished on regeneration and their prose silently drifted from the registries.
Changed:    `IMPROVEMENTS.md`, `PROMPT_CHANGES.md`, `src/domain/ledgerContract.ts`, `src/domain/improvementRegistry.ts`, `src/domain/promptRegistry.ts`, `src/domain/improvements/types.ts`, `src/domain/__tests__/ledgerContract.test.ts`, `scripts/regen-ledgers.ts`, `scripts/verify-improvements.ts`, `scripts/verify-prompts.ts`, `scripts/verify-site-identity.ts`, `vite.config.ts`, `package.json`, `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`
Rejected:   Keeping a hand-appended ledger tail that regeneration carries over. It lost because two writers had already drifted ten lines in PRM-003/PRM-004, and once appends moved to the registry the region logic rendered the new contract entry and then cut it back out of the file.
Status:     active

**Automated Invariants Checked:**
- `src/domain/ledgerContract.ts` must contain `export function formatLedgerHeader`, `export function evaluateLedgerContract`, `export function evaluateLedgerFreshness` — *The header, the entry-shape gate and the freshness comparison must stay in one module, or the two ledgers drift apart again.*
- `scripts/verify-improvements.ts` must contain `evaluateLedgerFreshness` — *A ledger checked only for its header still drifts; the improvement verifier must compare the file with the registry render.*
- `scripts/verify-prompts.ts` must contain `evaluateLedgerFreshness` — *The prompt changelog is generated too — stale prose there is exactly the drift this gate exists to catch.*
- `package.json` must contain `regen:ledgers` — *Appending means registry plus regeneration; without the command the documented workflow cannot be followed.*

**Restoration Playbook if Overwritten:**
1. Keep `formatLedgerHeader` as the only source of the ledger header and run `npm run regen:ledgers` after every registry change.
2. Add the ledger fields (`decidedOn`, `status`, `rejected`) to new registry entries; never hand-edit the generated ledgers.

## 2026-11-28 — Vault State Moves to Its Own Slice
Why:        The Import/Export hub accepted four vault collections and five vault actions as props and forwarded every one to a backup panel, so a single new vault snapshot re-rendered the whole hub.
Changed:    `src/hooks/barnStore/vaultSlice.tsx`, `src/components/ImportExportHubScreen.tsx`, `src/App.tsx`, `src/domain/improvementRegistry.ts`
Status:     active

**Automated Invariants Checked:**
- `src/hooks/barnStore/vaultSlice.tsx` must contain `VaultSliceProvider`, `useVaultSlice`, `vaultBackupCount` — *The slice is the only place the vault counts are derived; losing it hands the panels back their per-render filtering.*
- `src/components/ImportExportHubScreen.tsx` must contain `useVaultSlice` — *The hub reads vault state from the slice; reinstating optional vault props restarts prop drilling.*
  - Forbidden regression: `onSaveManualOpfsVaultBackup?:`, `opfsVaultBackups?:`

**Restoration Playbook if Overwritten:**
1. Wrap a consumer in `<VaultSliceProvider>` before calling `useVaultSlice()`; the hook throws outside one by design.
2. Keep `useBarnStore` returning every key it did before the split — slices are additional ways in, not removals.
3. Next slice on the same pattern: sync state (`syncOperations`, backup status), then drop the pass-through props.

## 2026-11-28 — Sync State Moves to Its Own Slice
Why:        The Import/Export hub accepted the outbox, backup status, storage-protection status and the whole backup-sync/cloud-sync action surface as nineteen props it only forwarded to the sync and backup panels, so any outbox or cloud-sync change re-rendered the hub.
Changed:    `src/hooks/barnStore/syncStateSlice.tsx`, `src/hooks/__tests__/syncStateSlice.test.ts`, `src/components/ImportExportHubScreen.tsx`, `src/App.tsx`, `src/domain/improvementRegistry.ts`
Status:     active

**Automated Invariants Checked:**
- `src/hooks/barnStore/syncStateSlice.tsx` must contain `SyncStateSliceProvider`, `useSyncStateSlice`, `pendingOperationCount` — *The slice is the only place the outbox count is derived; losing it hands the sync panel back its per-render length.*
- `src/components/ImportExportHubScreen.tsx` must contain `useSyncStateSlice` — *The hub reads sync state from the slice; reinstating optional sync props restarts prop drilling.*
  - Forbidden regression: `syncOperations?:`, `cloudSyncBusy?:`, `backupSyncStatus?:`

**Restoration Playbook if Overwritten:**
1. Wrap a consumer in `<SyncStateSliceProvider>` before calling `useSyncStateSlice()`; the hook throws outside one by design.
2. Keep `useBarnStore` returning every key it did before the split — slices are additional ways in, not removals.
3. Remaining milestone 5 work is rev-keyed memoised selectors for the derived lists; no store key may be dropped.

## 2026-11-28 — Rev-Keyed Memoised Species Selectors
Why:        `baseSpeciesData` re-filtered and re-sorted every collection whenever the snapshot object changed identity, which any settings or outbox write does, so an untouched collection paid a full localeCompare sort on every store write.
Changed:    `src/hooks/barnStore/speciesSelectors.ts`, `src/hooks/__tests__/speciesSelectors.test.ts`, `src/hooks/useBarnStore.ts`
Status:     active

**Automated Invariants Checked:**
- `src/hooks/barnStore/speciesSelectors.ts` must contain `collectionRevKey`, `memoizeByCollectionRev`, `selectSpeciesAnimals`, `selectSpeciesPhotoIndex` — *The rev signature is what makes reuse safe; losing it either drops the memo or serves stale rows.*
- `src/hooks/useBarnStore.ts` must contain `selectSpeciesAnimals`, `selectSpeciesPhotoIndex` — *The store must read the memoised selectors; the inline derivation is what this item removed.*
  - Forbidden regression: `const animals = snapshot.animals`

**Restoration Playbook if Overwritten:**
1. Keep every selector a pure function of one collection and the species name — the cache key assumes it.
2. Bump the entity `_rev` on every write; a silent field edit would serve a stale list until the next revision.
3. Call `resetSpeciesSelectorCache()` in a test that reuses ids and revisions with different content.

## 2026-11-28 — Selector Cache Flushed on Dataset Replacement
Why:        The rev-keyed selector cache keyed on row ids and revisions could not tell a restored or imported dataset from the one it replaced: a backup holding the same ids at the same revisions with different field values would have been served from the old cache.
Changed:    `src/hooks/barnStore/speciesSelectors.ts`, `src/hooks/barnStore/restoreOrchestrator.ts`, `src/hooks/useBarnStore.ts`, `src/hooks/__tests__/speciesSelectors.test.ts`, `src/hooks/__tests__/restoreOrchestrator.test.ts`
Status:     active

**Automated Invariants Checked:**
- `src/hooks/barnStore/speciesSelectors.ts` must contain `invalidateSpeciesSelectorCache`, `datasetEpoch` — *The generation is the only guard between a restore and a stale list; losing it silently reintroduces the hazard.*
- `src/hooks/barnStore/restoreOrchestrator.ts` must contain `invalidateSpeciesSelectorCache` — *All restores share this path, so the flush belongs here rather than in each caller.*
- `src/hooks/useBarnStore.ts` must contain `invalidateSpeciesSelectorCache` — *Imports bypass the restore orchestrator and need their own flush.*

**Restoration Playbook if Overwritten:**
1. Call `invalidateSpeciesSelectorCache()` in any new path that replaces the snapshot wholesale, before the replacement can render.
2. Never rely on revision signatures alone for cross-dataset identity — restores reuse ids and revisions.
3. Keep the generation bump ahead of the cache clear so in-flight entries cannot be re-keyed to the old dataset.

## 2026-11-28 — Render-Level Store Harness
Why:        Every store test so far was a pure-function test or a key snapshot, so the loops that actually break — a real React commit, a write through the adapter, a snapshot that comes back as a new object, derived selectors and their memo re-running, and a restore replacing the dataset underneath them — had no coverage at all.
Changed:    `src/hooks/__tests__/barnStoreIntegration.test.tsx`, `src/hooks/__tests__/support/memoryStorageAdapter.ts`, `src/storage/__tests__/support/inMemoryOpfs.ts`, `package.json`
Status:     active

**Automated Invariants Checked:**
- `src/hooks/__tests__/barnStoreIntegration.test.tsx` must contain `@vitest-environment jsdom`, `renderHook`, `importJsonBackup` — *Without the jsdom environment or a real render the file silently degrades to the same unit-level coverage it replaces.*
- `src/hooks/__tests__/support/memoryStorageAdapter.ts` must contain `replaceSnapshot`, `loadSnapshot`, `structuredClone` — *A shallow adapter that hands back the same object would hide the identity bugs the harness exists to catch.*

**Restoration Playbook if Overwritten:**
1. Keep the adapter honest: every write must be visible to the next `loadSnapshot`, and the snapshot must come back as a new object.
2. Enter a species route (`setRoute('herd')`) before asserting derived lists; non-species routes return empty lists by design.
3. Keep `fake-indexeddb/auto` imported before the store so the outbox and conflict log persist as they do in the browser.

## 2026-11-28 — Checksum-Level Restore Verification
Why:        Restores verified only row counts, so a backup that landed the right number of animals with the wrong field values passed verification and silently overwrote the barn.
Changed:    `src/domain/snapshotChecksum.ts`, `src/domain/__tests__/snapshotChecksum.test.ts`, `src/hooks/barnStore/restoreOrchestrator.ts`, `src/hooks/barnStore/useOpfsVaultActions.ts`, `src/hooks/barnStore/useRollingBackupActions.ts`, `src/hooks/__tests__/restoreOrchestrator.test.ts`
Status:     active

**Automated Invariants Checked:**
- `src/domain/snapshotChecksum.ts` must contain `computeSnapshotChecksum`, `sha256HexPure`, `VOLATILE_KEYS` — *Volatile payload exclusion is what keeps checksum verification from failing every real restore.*
- `src/hooks/barnStore/restoreOrchestrator.ts` must contain `verifyChecksum`, `computeSnapshotChecksum`, `Restore checksum verification failed` — *A restore path without the checksum gate only proves the row count survived.*
- `src/hooks/barnStore/useOpfsVaultActions.ts` must contain `verifyChecksum: true` — *Every restore plan must opt into the checksum check, or the default leaves it off.*

**Restoration Playbook if Overwritten:**
1. Never hash photo dataUrl payloads: the committed read is lightweight, so compare records, not bytes.
2. A checksum mismatch must roll back exactly like a count mismatch, using the pre-restore safety snapshot.
3. Add new volatile fields to `VOLATILE_KEYS` when a read path changes their presence.

## 2026-11-28 — Prompt Changelog Wires Up Like the Improvements Ledger
Why:        The prompt changelog was generated like IMPROVEMENTS.md but every entry still rendered the legacy `### PRM-0NN:` block, and its status vocabulary could not name the entry that replaced it.
Changed:    `src/domain/promptRegistry.ts`, `src/domain/ledgerContract.ts`, `src/domain/__tests__/ledgerContract.test.ts`, `src/domain/__tests__/promptRegistry.test.ts`, `PROMPT_CHANGES.md`
Rejected:   Requiring `Supersedes` as the opt-in condition. It reads well for a revision but makes the contract branch unreachable for a first kept version, so no prompt entry could ever render the documented shape.
Status:     active

**Automated Invariants Checked:**
- `src/domain/promptRegistry.ts` must contain `supersededBy`, `entry.decidedOn && entry.version`, `superseded by ${entry.supersededBy}` — *Prompts must opt in without a Supersedes line and keep the shared `superseded by <entry>` status, or the two ledgers diverge again.*
- `src/domain/ledgerContract.ts` must contain `'prompt-changes': ['Prompt', 'Why', 'Changed', 'Status']`, `superseded(?: by \S.*)?`, `omit for a first version` — *The shape gate must require only the fields every kept prompt version has, and the header must say Supersedes is optional.*

**Restoration Playbook if Overwritten:**
1. Keep the prompt opt-in at `decidedOn` + `version` + `commitShaOrTag`; add `Supersedes` only when a previous kept version exists.
2. When a prompt version is replaced, set `status: superseded` with `supersededBy` naming the replacing entry, then run `npm run regen:ledgers`.

## 2026-11-28 — The Prompt Ledger Rejects Half-Opted-In Entries
Why:        An entry that set `decidedOn` but not `version` or `commitShaOrTag` rendered as a legacy `### PRM-` block with no failure, so a change could look logged while only part of it was.
Changed:    `src/domain/promptRegistry.ts`, `scripts/verify-prompts.ts`, `src/domain/__tests__/promptRegistry.test.ts`
Rejected:   Relying on review to catch it. The bug this closes was a field combination the formatter ignored in silence, so a check that only runs when someone notices cannot be the gate.
Status:     active

**Automated Invariants Checked:**
- `src/domain/promptRegistry.ts` must contain `findLedgerOptInViolations`, `LEDGER_OPT_IN_FIELDS`, `supersededBy` — *The formatter falls back to the legacy block whenever the opt-in is incomplete; without this check that fallback is silent again.*
- `scripts/verify-prompts.ts` must contain `findLedgerOptInViolations`, `half-opted-in` — *A helper nothing calls is not a gate — the prompt verifier must run it and fail on it.*

**Restoration Playbook if Overwritten:**
1. Keep `findLedgerOptInViolations` called from `scripts/verify-prompts.ts` and in its pass condition, not just imported.
2. Log a prompt version with all three opt-in fields, or with none at all.

## 2026-11-28 — Documentation Pass: Layer READMEs, Gate Map and Corrected Doc Paths
Why:        After the Alpha 3 slice work, the docs no longer described the tree: README/CONTRIBUTING/CLAUDE listed a six-gate verification suite that had grown to ten, ARCHITECTURE still pointed at the pre-split registry path, the module folders with the most new structure (engine, features, storage, barn-store slices, scripts, improvements) had no README, and the registry part headers claimed 85 entries when part 05 alone held 59.
Changed:    `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `AGENTS.md`, `EXTRACTION_INVENTORY.md`, `docs/README.md`, `docs/ARCHITECTURE_GUIDE.md`, `scripts/README.md`, `src/engine/README.md`, `src/features/README.md`, `src/storage/README.md`, `src/hooks/barnStore/README.md`, `src/domain/improvements/README.md`, `src/domain/improvements/registry-part-01.ts`, `src/domain/improvements/registry-part-02.ts`, `src/domain/improvements/registry-part-03.ts`, `src/domain/improvements/registry-part-04.ts`, `src/domain/improvements/registry-part-05.ts`, `src/hooks/barnStore/restoreOrchestrator.ts`, `src/hooks/barnStore/speciesSelectors.ts`, `src/hooks/barnStore/storePorts.ts`, `src/domain/models.ts`, `src/domain/inputSanitization.ts`, `src/domain/syncAndExports.ts`, `src/domain/syncOutbox.ts`, `src/domain/pedigreeCalculator.ts`, `src/domain/imageOptimizationSpec.ts`, `src/domain/backupVault.ts`, `src/domain/geneticsEngine.ts`, `src/domain/carrierGenetics.ts`, `src/domain/showResults.ts`, `src/domain/barnAlerts.ts`, `src/domain/deviceCapability.ts`, `src/domain/backupArchive.ts`, `src/storage/storageProtection.ts`, `src/storage/crashLogger.ts`, `src/storage/storageProbes.ts`, `src/storage/deviceCapabilityDetector.ts`, `src/storage/webImageOptimizer.ts`, `src/storage/offThreadWorkerClient.ts`, `src/utils/webFileActions.ts`, `src/utils/useAsyncSubmitLock.ts`, `src/utils/useAccessibleDialog.ts`, `ios-wrapper/README.md`, `.github/WORKFLOWS_GUIDE.md`
Status:     active

**Automated Invariants Checked:**
- `README.md` must contain `npm run verify`, `docs/README.md`, `scripts/README.md` — *The front page is where a new contributor gets the command list; a stale list sends them to a subset of the gates.*
- `docs/README.md` must contain `barn-store-contract.md`, `src/hooks/barnStore/README.md`, `regen:ledgers` — *The index is only useful if it reaches the contract, the module maps and the generated-file rule.*
- `scripts/README.md` must contain `verify:chunks`, `verify:site-identity`, `regen:ledgers` — *The build-dependent gates and the one writing command are exactly the ones people forget.*
- `src/hooks/barnStore/README.md` must contain `runDestructiveRestore`, `invalidateSpeciesSelectorCache`, `verify:contract` — *The two rules that cause data loss when forgotten, plus the gate that guards the key surface.*

**Restoration Playbook if Overwritten:**
1. When a gate or npm script changes, update `scripts/README.md` and the command blocks in README, CONTRIBUTING and CLAUDE in the same change.
2. Keep generated files generated: edit the registry and run `npm run regen:ledgers`, never the ledger.
3. If a folder gains a second concern or a new contract, add or update its README rather than growing the top-level one.

## 2026-11-28 — Storage Adapters Exercised Through Their Failure Arms
Why:        Branch coverage sat at 41% with the storage layer weakest (webSqliteAdapter 36%, sqliteIdbPersistence 32%, browserStorageAdapters 0%), and the untaken arms were exactly the offline failure paths: QuotaExceededError purge-and-retry, VersionError recovery, corrupt vault envelopes and a returning user whose IndexedDB was evicted.
Changed:    `src/storage/__tests__/quotaRecoveryAndIdbAdapters.test.ts`, `src/storage/__tests__/opfsVaultCorruption.test.ts`, `src/domain/improvements/registry-part-05.ts`
Status:     active

**Automated Invariants Checked:**
- `src/storage/__tests__/quotaRecoveryAndIdbAdapters.test.ts` must contain `executeIdbWriteWithQuotaRecovery`, `onQuotaExceeded`, `resetOnVersionError` — *The quota-retry and VersionError-reset branches are the ones that silently regress when an adapter is refactored.*
- `src/storage/__tests__/opfsVaultCorruption.test.ts` must contain `loadOpfsVaultBackup`, `detectReturningUserWipedStorage`, `dumpIndexedDbDatabaseToOpfs` — *A corrupt backup must fail loudly and an evicted user must still be recognised; both are data-loss paths if untested.*

**Restoration Playbook if Overwritten:**
1. Keep the adapters on hand-built fake IndexedDB/OPFS factories: no browser, no network, deterministic failure injection.
2. When an adapter adds a retry or fallback arm, add the failing case to these files rather than a happy-path assertion.
3. If a threshold in `vitest.config.ts` moves, re-measure first and raise the ratchet in the same change as the tests that earned it.

## 2026-11-28 — Ledger Opt-In Gates for New Entries & Prompt Verification in CI
Why:        Both ledger gates only rejected half-opted-in entries, so a brand-new prompt revision or improvement could still be logged in the old `### IMP-` / `### PRM-` shape simply by omitting every ledger field — and `verify:prompts` ran nowhere in CI, so prompt drift only failed on the author's machine.
Changed:    `src/domain/promptRegistry.ts`, `src/domain/improvementRegistry.ts`, `scripts/verify-prompts.ts`, `scripts/verify-improvements.ts`, `.github/workflows/ci.yml`
Status:     active

**Automated Invariants Checked:**
- `src/domain/promptRegistry.ts` must contain `LEGACY_PROMPT_ENTRY_IDS`, `findLedgerPinViolations` — *A new prompt revision must not be able to render legacy by omission; only the pinned IDs may skip the opt-in, and a stale pin must fail.*
- `src/domain/improvementRegistry.ts` must contain `LEGACY_IMPROVEMENT_ENTRY_IDS`, `findImprovementLedgerOptInViolations` — *The same hole existed for improvements: without the pinned list, a new entry with no `decidedOn` rendered a legacy block and passed.*
- `.github/workflows/ci.yml` must contain `verify:prompts` — *A gate that only runs locally is advice; CI has to fail on prompt drift before a merge lands.*

**Restoration Playbook if Overwritten:**
1. Log a new improvement with `decidedOn` (plus `status`/`rejected` where they apply) and a new prompt revision with all three of `decidedOn`, `version`, `commitShaOrTag`.
2. When an old entry opts into the contract, delete its ID from `LEGACY_*_ENTRY_IDS` — the pin gate fails until the list is pruned.
3. Keep `npm run verify:prompts` in `ci.yml` beside `verify:improvements`, and run `npm run regen:ledgers` after touching a registry.

## 2026-11-28 — Tier A Screens and the Backup/Export Surfaces Render-Tested
Why:        The suite had one render-level file against 53 components and 68k lines, so a selector, a dialog gate or a save-lock regression could reach the user with every gate green. The owner asked for the Tier A screens — the ones where a rendering bug looks like data loss — and then the backup/export surfaces to be tested the same way.
Changed:    `src/components/__tests__/tierARecoveryAndEditor.render.test.tsx`, `src/components/__tests__/backupExportSurfaces.render.test.tsx`, `src/hooks/__tests__/speciesSwitch.render.test.tsx`, `src/domain/improvements/registry-part-05.ts`
Status:     active

**Automated Invariants Checked:**
- `src/components/__tests__/tierARecoveryAndEditor.render.test.tsx` must contain `WipedStorageRecoveryModal`, `Confirm Restore`, `Confirm Delete` — *A recovery or delete that fires without its confirm step is the most expensive rendering regression in the app.*
- `src/components/__tests__/backupExportSurfaces.render.test.tsx` must contain `SyncStateSliceProvider`, `VaultSliceProvider`, `BUILTIN_NON_NATIVE_EXPORTERS` — *The hub reads three slice contexts; dropping one provider breaks the screen for every caller, and the exporter list is the surface users export through.*
- `src/hooks/__tests__/speciesSwitch.render.test.tsx` must contain `selectSpeciesWorkspace`, `selectedAnimalId` — *Species isolation is the domain invariant; a switch that keeps the old selection leaks one herd into another.*

**Restoration Playbook if Overwritten:**
1. Render screens through their real slice providers and callbacks; do not mock the component under test.
2. Assert user-visible text, roles and the callback contract, plus surfaced alerts — never whole-DOM snapshots.
3. Tier A tests belong in jsdom files named `*.render.test.tsx`; keep pure units out of them so the slow tier stays small.

## 2026-11-28 — SQLite Snapshot Readers and Mutation Helpers Split Out of the Adapter
Why:        webSqliteAdapter.ts was still 2,609 lines and carried three unrelated jobs inside one class: connection lifecycle, reading every barn table back into a snapshot, and its own copies of the transaction envelope, batch-write and multi-row-delete loops. A new entity had to re-implement the transaction handling to add a batch save or a cascade delete.
Changed:    `src/storage/sqliteSnapshotReaders.ts`, `src/storage/sqliteMutationHelpers.ts`, `src/storage/__tests__/sqliteSnapshotReaders.test.ts`, `src/storage/__tests__/sqliteMutationHelpers.test.ts`, `src/storage/webSqliteAdapter.ts`, `EXTRACTION_INVENTORY.md`, `docs/plans/handoff-modularity-reusability.yaml`, `src/domain/improvements/registry-part-05.ts`
Status:     active

**Automated Invariants Checked:**
- `src/storage/sqliteSnapshotReaders.ts` must contain `readSnapshotFromDatabase`, `queryObjectsFromDb`, `lightweightPhotos` — *The lightweight-photo projection is the difference between a fast boot and a 40 MB snapshot read; it has to stay next to the readers that apply it.*
- `src/storage/webSqliteAdapter.ts` must contain `from './sqliteSnapshotReaders'`, `deleteRowsForIds`, `writeRowsInTransaction` — *The adapter must keep delegating snapshot reads and batch mutations instead of growing a second copy of either loop.*

**Restoration Playbook if Overwritten:**
1. Snapshot reads belong in `sqliteSnapshotReaders.ts`; a new table is one query plus one mapper call there, not a new adapter method.
2. Batch writes and multi-row deletes belong in `sqliteMutationHelpers.ts`; pass statements, do not re-open a transaction by hand.
3. Keep the missing-table tolerance in `safeTableQuery` — older imported databases legitimately lack the newer tables.

## 2026-11-28 — Handoff Closure Must Scan Every Handoff File
Why:        Finishing one handoff was reported as `NO PENDING WORK` while `docs/plans/handoff-modularity-reusability.yaml` still had seven open steps. The workflow only ever looked at the file it was reading, so a second open handoff was invisible at the exact moment a run decided it was done.
Changed:    `prompts/resume_backlog_plan_prompt.md`, `prompts/start_new_backlog_prompt.md`, `GEMINI.md`, `src/domain/improvements/registry-part-05.ts`
Status:     active

**Automated Invariants Checked:**
- `GEMINI.md` must contain `for **every** open file`, `after scanning **all** `handoff-*.yaml` files` — *The status line is the first thing a run reports; if it can name only one file, a second open handoff stays invisible.*
- `prompts/resume_backlog_plan_prompt.md` must contain `re-scan `docs/plans/handoff-*.yaml` after every closure`, `List **every** open `handoff-*.yaml`` — *The resume path decides when a run is finished, so the all-files scan and the re-scan rule have to live there.*
- `prompts/start_new_backlog_prompt.md` must contain `scan every `handoff-*.yaml`, not just the first`, `a finished file is not a finished directory` — *The backlog gate is the other place that can start unrelated work while a handoff is still open.*

**Restoration Playbook if Overwritten:**
1. Never report `NO PENDING WORK` from the file in hand: list `docs/plans/handoff-*.yaml` and read every `status:` block first.
2. After closing a handoff, re-scan the directory before moving to a backlog item or ending the run.
3. When a new prompt is added to this workflow, give it the same all-files scan rather than a single-file check.

## 2026-11-28 — Coverage Ratchet Raised and the CSV Exporter Executed End to End
Why:        The coverage floors were still set against the 48/40/34/49 baseline, roughly four points under the post-render-test measurement, so a new untested module could absorb the render gains before the gate noticed. The hub tests also only proved the exporter registry rendered, never that an export produced a file.
Changed:    `vitest.config.ts`, `src/components/__tests__/backupExportSurfaces.render.test.tsx`, `src/domain/improvements/registry-part-05.ts`
Status:     active

**Automated Invariants Checked:**
- `vitest.config.ts` must contain `thresholds:`, `statements: 51`, `branches: 42`, `functions: 37`, `lines: 53` — *The ratchet is the only thing that stops an untested module from diluting the render and storage gains; a floor left below the measurement is a silent allowance.*
- `src/components/__tests__/backupExportSurfaces.render.test.tsx` must contain `downloadTextFileMock`, `Herd Roster Spreadsheet`, `getByRole('status')` — *Only a click that reaches the download layer proves the exporter runs; asserting the registry list alone would pass with every exporter broken.*

**Restoration Playbook if Overwritten:**
1. Re-measure before moving a floor, and keep it one point under the measured number so the ratchet stays achievable but tight.
2. Stub only the boundary in an end-to-end UI test: mock the download call, keep the exporter registry, snapshot and CSV serializer real.
3. Assert the artifact contract (filename, MIME type, BOM, header, a real record) rather than a snapshot of generated text.

## 2026-11-28 — Ratchet Tests That Freeze the Pinned Legacy ID Lists
Why:        The pinned legacy lists made the opt-in gates sound, but nothing stopped the lists themselves from growing: appending a new entry ID to `LEGACY_*_ENTRY_IDS` exempts that entry from the contract without touching a verifier, so the gate could be bypassed by pinning.
Changed:    `src/domain/__tests__/promptRegistry.test.ts`, `src/domain/__tests__/improvementRegistry.test.ts`, `src/domain/improvements/registry-part-05.ts`, `src/domain/improvements/rationales.ts`
Status:     active

**Automated Invariants Checked:**
- `src/domain/__tests__/promptRegistry.test.ts` must contain `ratchets the pinned legacy prompt IDs`, `pinnedSnapshot` — *The pin list is the only exemption from the opt-in; without a frozen snapshot a new PRM ID can be appended and skip the gate silently.*
- `src/domain/__tests__/improvementRegistry.test.ts` must contain `ratchets the pinned legacy improvement IDs`, `pinnedSnapshot` — *The improvement pins need the same ratchet, or a `decidedOn`-less entry passes simply by being added to the list.*

**Restoration Playbook if Overwritten:**
1. Keep both ratchet tests comparing `[...LEGACY_*_ENTRY_IDS]` to a frozen snapshot with `toEqual`, not a length-only assertion.
2. To pin a genuinely old entry, change the snapshot and the list in one reviewable commit and state why that entry cannot opt in.
3. Prefer opting an entry into the contract and pruning its pin over widening an exemption.

## 2026-11-28 — Store Entity CRUD and Backup Import Controllers
Why:        `src/hooks/useBarnStore.ts` was still 7,676 lines because every flat collection repeated the same write by hand: queue the mutation, look up the previous row, allocate a revision, persist, diff it into the outbox, reload, toast. Thirteen save/delete pairs differed only in their builder and copy, and both file imports (JSON backup and archive) carried their own copy of the same destructive install order, so a fix to one import did not reach the other.
Changed:    `src/hooks/barnStore/entityCrudController.ts`, `src/hooks/barnStore/backupImportController.ts`, `src/hooks/__tests__/entityCrudController.test.ts`, `src/hooks/__tests__/backupImportController.test.ts`, `src/hooks/useBarnStore.ts`, `IMPROVEMENTS.md`, `MODULES.md`, `docs/plans/handoff-modularity-reusability.yaml`, `src/domain/improvements/registry-part-05.ts`
Status:     active

**Automated Invariants Checked:**
- `src/hooks/barnStore/entityCrudController.ts` must contain `saveEntityRecord`, `deleteEntityRecord`, `__delete__` — *Every flat collection must write through this one path; a collection that hand-rolls its own queue/revision/outbox order is how the copies drifted apart.*
- `src/hooks/useBarnStore.ts` must contain `saveEntityRecord`, `deleteEntityRecord`, `installImportedSnapshot` — *The store must keep delegating to the controllers rather than re-growing inline CRUD bodies or a second import install order.*
- `src/hooks/barnStore/backupImportController.ts` must contain `installImportedSnapshot`, `stripRestoredBackupBookkeeping`, `clearLocalSyncAndBackupReminderState` — *A destructive replace must always take the safety snapshot, strip backup bookkeeping and reset sync state; that order only stays correct while there is one implementation of it.*

**Restoration Playbook if Overwritten:**
1. A new flat collection gets a spec (`readRows`, `build`, `persist`, `describe`, `failureLabel`) and a `useCallback` pair over `entityCrudPorts`; do not copy the old inline body.
2. Collections whose save touches other rows (show legs, feed-batch allocations, reservation occupancy) keep their own action until they get a controller that also owns the cascade.
3. A new file format imports through `installImportedSnapshot`; decode it, then pass `mode` and the safety note, and word the toast in the caller.

## 2026-11-28 — Barn Store Cascade Controllers and One Shared Slice-Port Bundle
Why:        The remaining store actions that touch more than one row (show legs, feed-batch allocations, reservation waitlist sync, task calendar export) still hand-rolled the whole queue/diff/reload sequence, and every one of the nine `use*` slices was wired by hand with the same ten capabilities — a capability added at one call site could be silently missing at another.
Changed:    `src/hooks/barnStore/entityCrudController.ts`, `src/hooks/barnStore/slicePorts.ts`, `src/hooks/__tests__/slicePorts.test.ts`, `src/hooks/__tests__/entityCrudController.test.ts`, `src/hooks/useBarnStore.ts`, `IMPROVEMENTS.md`, `MODULES.md`, `docs/plans/handoff-modularity-reusability.yaml`, `src/domain/improvements/registry-part-05.ts`
Status:     active

**Automated Invariants Checked:**
- `src/hooks/barnStore/slicePorts.ts` must contain `SliceCorePorts`, `SLICE_CORE_PORT_KEYS`, `createSliceCorePorts` — *The shared bundle and its key list are the wiring contract; a slice that needs a new shared capability must take it from here, not from the store.*
- `src/hooks/barnStore/entityCrudController.ts` must contain `EntitySaveCascadeContext`, `EntityDeleteCascadeContext`, `afterSave` — *Cascades must run inside the same queue slot and operations batch as the row that caused them, or a crash between the two writes leaves related rows permanently out of step.*
- `src/hooks/useBarnStore.ts` must contain `sliceCorePorts`, `applyShowLegDeltas` — *The store must keep spreading the shared bundle into every slice and keep show leg maths in one helper used by both save and delete.*

**Restoration Playbook if Overwritten:**
1. An action that writes related rows belongs on the controller with a `cascade`; that is how the related rows share the primary row timestamp, revision allocation and outbox batch.
2. Never wire a slice by hand: spread `sliceCorePorts` and add only that slice's own capabilities.
3. A slice that needs a new shared capability adds it to `SliceCorePorts` and `SLICE_CORE_PORT_KEYS`; the test tuple then fails until every slice agrees on the shape.

## 2026-11-28 — Retire the Domain Binary/Archive Compatibility Shims
Why:        `src/domain/binaryEncoding.ts` and `src/domain/importers/archiveAndCsvUtils.ts` were eight-line re-export shims kept alive for six callers plus three tests. They advertised the engine path as optional, so new code could keep importing through the domain and quietly re-couple the domain layer to what was meant to be the extracted engine surface.
Changed:    `src/domain/binaryEncoding.ts`, `src/domain/importers/archiveAndCsvUtils.ts`, `src/domain/importers/herdBossImporter.ts`, `src/domain/importers/pedigreeOcrParser.ts`, `src/domain/importers/universalPedigreeImporter.ts`, `src/domain/importers/csvColumnMapper.ts`, `src/domain/backupVault.ts`, `src/domain/backupArchive.ts`, `EXTRACTION_INVENTORY.md`, `IMPROVEMENTS.md`, `MODULES.md`, `src/domain/improvements/registry-part-04.ts`, `src/domain/improvements/registry-part-05.ts`
Status:     active

**Automated Invariants Checked:**
- `src/domain/backupVault.ts` must contain `from '@engine/binaryEncoding'` — *The vault must import encoding helpers straight from the engine module; the domain re-export that used to sit in between is gone.*
- `src/domain/importers/universalPedigreeImporter.ts` must contain `from '@engine/codecs/archiveAndCsvUtils'` — *Importers read archive/CSV helpers from the engine codec module, which is what makes the domain layer droppable later.*
- `EXTRACTION_INVENTORY.md` must contain `retired in IMP-142` — *The inventory must not advertise deleted shims as available entry points.*

**Restoration Playbook if Overwritten:**
1. Import `@engine/binaryEncoding` and `@engine/codecs/archiveAndCsvUtils` directly; do not recreate a domain re-export.
2. Before deleting a shim, codemod every caller (production and test) in one change; a partially migrated shim is worse than none.
3. Update the inventory and any registry invariant that names the old path in the same change, or the ledger advertises a file that no longer exists.

## 2026-11-28 — Ledger Gates Reject Impossible Dates and Dangling Replacements
Why:        The gates checked that the ledger fields were present but never what they said: `decidedOn: 2026-13-45` rendered an impossible heading and passed both verifiers, and a `supersededBy: PRM-999` typo was accepted even though no such entry exists, so the replacing entry could never be found.
Changed:    `src/domain/ledgerContract.ts`, `src/domain/promptRegistry.ts`, `src/domain/improvementRegistry.ts`, `src/domain/__tests__/promptRegistry.test.ts`, `src/domain/__tests__/improvementRegistry.test.ts`, `src/domain/improvements/registry-part-05.ts`, `src/domain/improvements/rationales.ts`
Status:     active

**Automated Invariants Checked:**
- `src/domain/ledgerContract.ts` must contain `isRealCalendarDate`, `Date.UTC` — *A regex-shaped date is not a real date; only a UTC round-trip rejects an impossible month or day while keeping leap days valid.*
- `src/domain/promptRegistry.ts` must contain `isRealCalendarDate`, `knownIds` — *The prompt gate has to validate the value it renders into the heading and resolve `supersededBy`, or a typo becomes a permanent dangling reference.*
- `src/domain/improvementRegistry.ts` must contain `isRealCalendarDate`, `knownIds` — *The improvement gate needs the same two checks; otherwise only one ledger rejects impossible dates and dangling replacements.*
- `src/domain/__tests__/promptRegistry.test.ts` must contain `rejects an impossible decidedOn`, `real calendar date` — *The rejection has to be asserted, not assumed: the impossible month, the missing February day and the leap day pin the boundary.*
- `src/domain/__tests__/improvementRegistry.test.ts` must contain `rejects an impossible decidedOn`, `real calendar date` — *Both gates are separate functions, so each needs its own value-validation test rather than one shared expectation.*

**Restoration Playbook if Overwritten:**
1. Keep `isRealCalendarDate` in `src/domain/ledgerContract.ts` and call it from both gates whenever `decidedOn` is set.
2. Resolve `supersededBy` against the entries being validated; a replacement must be an entry in the same registry.
3. Extend the boundary tests with any new date rule rather than deleting the impossible-month and missing-day cases.

## 2026-11-28 — Diagnostics Panel Drops In-Flight Refreshes After Unmount
Why:        CI kept failing the render tests with `ReferenceError: window is not defined` from a state update dispatched by `DiagnosticsAndSupportPanel`, so a suite that passes locally would go red on an unrelated commit — the failure looked like the ledger work and was not.
Changed:    `src/components/DiagnosticsAndSupportPanel.tsx`, `src/components/__tests__/backupExportSurfaces.render.test.tsx`, `src/domain/improvements/registry-part-05.ts`, `src/domain/improvements/rationales.ts`
Status:     active

**Automated Invariants Checked:**
- `src/components/DiagnosticsAndSupportPanel.tsx` must contain `isMountedRef`, `if (!isMountedRef.current) return` — *The awaits in `refreshDiagnostics` can resolve after unmount; without this guard the update is dispatched into a document that no longer exists.*
- `src/components/__tests__/backupExportSurfaces.render.test.tsx` must contain `drops a diagnostics refresh that resolves after the panel unmounts`, `readEmergencyTraceSpy` — *That call sits inside the guarded tail of `refreshDiagnostics`, so a spy on it is the only signal React exposes: an update on an unmounted root is a silent no-op.*

**Restoration Playbook if Overwritten:**
1. Keep the `isMountedRef` check after the awaits in `refreshDiagnostics`, before any `setState` call.
2. Treat a post-teardown state update as a component bug, not a test-ordering problem: fix the guard instead of skipping, retrying or serialising the test.
3. New async handlers that set state after an await need the same check if they can outlive the panel.
