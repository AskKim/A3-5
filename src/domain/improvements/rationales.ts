/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Why each invariant exists, keyed `${entryId}#${filePath}#${ordinalForThatFile}`.
 *
 * Documentation, not runtime logic: entries stay lean and this module loads only when the
 * explanations are needed (markdown/JSON export, `npm run verify:improvements` messages)
 * instead of on every diagnostics visit.
 */

import type { ImprovementRationaleMap } from './types';

export const INVARIANT_RATIONALES: ImprovementRationaleMap = {
  'IMP-001#src/domain/backupStatus.ts#1':
    'Backup freshness evaluator and human-readable timestamp formatters must stay intact.',
  'IMP-001#src/domain/syncAndExports.ts#1':
    'Clean filenames (`pedigree-backup-YYYY-MM-DD.json`) and top-level `barnSummary` prevent messy exports.',
  'IMP-001#src/hooks/useBarnStore.ts#1':
    'Store must track `lastBackupMeta` and expose `recordBackupExport`/`snoozeBackupReminder`.',
  'IMP-001#src/App.tsx#1':
    'Global dismissible/snoozable reminder banner alerts breeders when real edits are unbacked.',
  'IMP-001#src/components/ImportExportHubScreen.tsx#1':
    'Import/Export Hub exports must show live backup timestamps and record external exports immediately.',
  'IMP-001#src/components/SettingsAndSyncScreen.tsx#1':
    'Settings must surface live top-level backup warnings and route exports directly to Import / Export Hub.',
  'IMP-002#src/domain/syncAndExports.ts#1':
    'Pre-removal species JSON exports require distinct timestamped filenames and reason metadata.',
  'IMP-002#src/domain/sampleData.ts#1':
    'Non-testing purge must isolate user records cleanly without deleting starter sample rows.',
  'IMP-002#src/hooks/useBarnStore.ts#1':
    'Store must persist non-testing purges via batch operations and clear stale caches.',
  'IMP-002#src/components/SpeciesDashboardScreen.tsx#1':
    'Species hub safety controls must offer 1-click timestamped safety backups before destructive wipes.',
  'IMP-003#src/domain/models.ts#1':
    '`barnAlerts.ts` uses `pluralizeSpeciesLabel` to format arriving-offspring labels cleanly.',
  'IMP-003#src/domain/barnAlerts.ts#1':
    'Pure alert evaluation rules ensure group-clear signatures reappear only when new due tasks arrive.',
  'IMP-003#src/hooks/useBarnStore.ts#1':
    'Store must persist ignored task IDs and cleared group signatures per species.',
  'IMP-003#src/components/HomeSpeciesScreen.tsx#1':
    'Home cards must consume `barnAlerts.ts` directly rather than drifting inline logic.',
  'IMP-004#src/domain/models.ts#1':
    'Delimiter-aware prefix helper handles hyphens/colons (`OR-Ruby`) and case-insensitive duplicate checks.',
  'IMP-004#src/hooks/useBarnStore.ts#1':
    'Litter offspring auto-creation in `updateBreedingOutcome` must respect the species default prefix.',
  'IMP-005#src/domain/speciesMigration.ts#1':
    'Cross-species migration preserves ancestor/descendant links and moves photos/logs/breedings/tasks cleanly.',
  'IMP-005#src/components/HerdScreen.tsx#1':
    'Herd screen uses `SpeciesMigrationModal` and paginates large rosters at 50 rows per page.',
  'IMP-005#src/components/SpeciesDashboardScreen.tsx#1':
    'Species Hub exposes hub-level backup, migration, and safety-backed deletion controls.',
  'IMP-005#src/hooks/useBarnStore.ts#1':
    'Store delegates species migration to the tested `migrateAnimalsToSpecies` engine.',
  'IMP-006#src/domain/models.ts#1':
    'Canonical Archived status and importer helpers must stay exported from `models.ts`.',
  'IMP-006#src/domain/importers/herdBossImporter.ts#1':
    'CSV `Archived` / `Active` flags must map cleanly to `Archived` instead of collapsing into `Retired` or `Active`.',
  'IMP-007#vite.config.ts#1':
    'Workbox devOptions enabled=true inside preview iframes causes stale chunk/SW crash loops on mobile.',
  'IMP-007#src/main.tsx#1':
    'Dev mode must unregister lingering service workers and clear caches instead of registering Workbox.',
  'IMP-007#src/domain/pedigreeCalculator.ts#1':
    'Cycle guard prevents stack overflow if an imported pedigree has an ancestral loop.',
  'IMP-007#src/storage/webSqliteAdapter.ts#1':
    'Single-transaction SQLite batch methods prevent O(N) disk/IDB flushes on bulk edits.',
  'IMP-008#vite.config.ts#1':
    "Hardcoding `basePath = '/'`, `hmr: false`, and `watch: null` prevents AI Studio from prompting for `VITE_BASE_PATH` or `DISABLE_HMR`.",
  'IMP-008#.env.example#1':
    'Omitting `VITE_BASE_PATH` and `DISABLE_HMR` from `.env.example` prevents AI Studio from prompting for unconfigured env vars.',
  'IMP-008#.github/workflows/ci.yml#1':
    'CI must block merges if tests, improvement invariants, TypeScript, or builds break.',
  'IMP-008#package.json#1':
    'Standard npm scripts power local & CI verification.',
  'IMP-008#.github/workflows/deploy-pages.yml#1':
    'GitHub Pages deployment strictly requires Bun and passes dynamic --base on CLI.',
  'IMP-008#vite.config.ts#2':
    'Relative PWA manifest fields ensure installability on both root (/) and GitHub Pages subpaths (/Pedigree/).',
  'IMP-009#src/main.tsx#1':
    'Root mount must remain wrapped in `CrashErrorBoundary` with global handlers active.',
  'IMP-009#src/domain/dataHealthCheck.ts#1':
    'Health scan & self-repair logic protects against orphaned pointers or malformed rows.',
  'IMP-009#src/domain/supportBundle.ts#1':
    'Diagnostic ZIP generator packages device info, crash logs, and DB health safely.',
  'IMP-010#src/domain/syncOutbox.ts#1':
    'Field-level sync outbox prevents whole-record overwrites across peer devices.',
  'IMP-010#src/domain/backupArchive.ts#1':
    'ZIP archive builder/parser handles combined data + real image directory trees.',
  'IMP-011#src/domain/improvementRegistry.ts#1':
    'Core registry and pure export/verification helpers must remain intact.',
  'IMP-011#scripts/verify-improvements.ts#1':
    'CLI script verifies actual workspace source files against registry invariants.',
  'IMP-011#src/components/DiagnosticsAndSupportPanel.tsx#1':
    'Users can view, download (.md / .json), or copy the improvement recovery log directly in the app.',
  'IMP-012#src/hooks/useBarnStore.ts#1':
    'Startup must import normalizeRufusLevel, isolate secondary boot promises, and log corrective recovery actions.',
  'IMP-012#src/storage/webSqliteAdapter.ts#1':
    'Malformed SQLite row JSON must auto-recover cleanly and record a diagnostic log entry.',
  'IMP-012#src/utils/googleCalendarClient.ts#1':
    'Calendar auth hooks must initialize cleanly offline without external Firebase dependencies before React mounts.',
  'IMP-012#src/App.tsx#1':
    'Render a non-blocking recovery UI if snapshot loading fails instead of trapping users on a loading skeleton.',
  'IMP-013#src/domain/importers/universalPedigreeImporter.ts#1':
    'Universal importer handles Evans HTML, multi-generation spreadsheets, nested JSON, and unsupported binary warnings.',
  'IMP-013#src/engine/codecs/archiveAndCsvUtils.ts#1':
    'Handles UTF-16LE/BE, Windows-1252, Excel serial dates, and calendar validation without crashing.',
  'IMP-013#src/domain/importers/registry.ts#1':
    'Registers the Universal Pedigree importer alongside HerdBoss.',
  'IMP-013#src/domain/pedigreeCalculator.ts#1':
    'Direct ancestor counting guards against circular ancestry loops.',
  'IMP-013#src/components/ExternalImporterPanel.tsx#1':
    'Keeps parse error calculation pure and exposes accessible alert/progress semantics.',
  'IMP-014#src/domain/animalConflicts.ts#1':
    'Core conflict detection, override confirmation, and summary logic must remain intact.',
  'IMP-014#src/domain/dataHealthCheck.ts#1':
    'Database health checks must report duplicate within-species tattoos and parent sex mismatches.',
  'IMP-014#src/components/AnimalEditorModal.tsx#1':
    'Single-animal editor must warn on same-sex duplicate tattoos and require explicit override typing.',
  'IMP-014#src/components/BreedingScreen.tsx#1':
    'Bulk litter creation must enforce the same duplicate tattoo override guardrail.',
  'IMP-014#src/components/HerdScreen.tsx#1':
    'Herd screen must allow sorting/filtering conflicted animals and ignoring/restoring soft warnings.',
  'IMP-014#src/hooks/useBarnStore.ts#1':
    'Store must emit post-import conflict alerts and persist per-animal ignored conflict flags.',
  'IMP-014#src/App.tsx#1':
    'Root shell renders non-blocking import conflict banners with direct Locate Conflicted Animals action.',
  'IMP-015#src/domain/deviceCapability.ts#1':
    'Pure 5-tier classification, dismissal rules, and workload evaluator must remain intact.',
  'IMP-015#src/storage/deviceCapabilityDetector.ts#1':
    'Per-device hardware signal collector and localStorage dismissal hook isolate device state from portable backups.',
  'IMP-015#src/components/DeviceCapabilityCard.tsx#1':
    'Shared tier banner respects Home vs Settings tier-specific close/reopen rules.',
  'IMP-015#src/components/HomeSpeciesScreen.tsx#1':
    'Home onboarding displays device capability card on startup.',
  'IMP-015#src/components/SettingsAndSyncScreen.tsx#1':
    'Settings exposes upper Device Capability section with persistent Tier 1–2 status and reopen control.',
  'IMP-015#src/components/ExternalImporterPanel.tsx#1':
    'Importer evaluates incoming record counts against host device capability tier.',
  'IMP-015#src/App.tsx#1':
    'Root shell runs `useDeviceCapability()` and passes controller to Home and Settings.',
  'IMP-016#src/utils/lazyRoute.tsx#1':
    'Named-export lazy wrapper, single chunk retry, and route error boundary prevent blank-screen crashes.',
  'IMP-016#src/App.tsx#1':
    'Secondary routes in `App.tsx` must stay lazily loaded inside `RouteErrorBoundary` + `Suspense`.',
  'IMP-017#src/storage/photoHydration.ts#1':
    'Bounded LRU cache and batch hydration helpers keep full-res base64 strings out of steady-state RAM.',
  'IMP-017#src/storage/webSqliteAdapter.ts#1':
    'SQLite adapter supports thumbnail-only snapshot loads, on-demand photo reads, and non-destructive dehydrated writes.',
  'IMP-017#src/storage/archiveAndImport.worker.ts#1':
    'Dedicated module worker runs heavy ZIP builds/extractions and importer parsing off the UI thread.',
  'IMP-017#src/storage/offThreadWorkerClient.ts#1':
    'Worker client strips base64 images before cloning snapshots and falls back gracefully when `Worker` is unavailable.',
  'IMP-017#src/hooks/useBarnStore.ts#1':
    'Store loads lightweight snapshots, caches hydrated photos, hydrates rolling/export snapshots, and streams off-thread ZIP archives via OPFS /tmp.',
  'IMP-017#src/components/AnimalPhotoGallery.tsx#1':
    'Photo gallery and lightbox fetch full-resolution images lazily while displaying thumbnails immediately.',
  'IMP-017#src/components/ExternalImporterPanel.tsx#1':
    'External importer unpacks and parses staged archives asynchronously off-thread with request sequencing.',
  'IMP-018#src/domain/backupVault.ts#1':
    'Pure TypeScript OPFS vault envelopes, schema migration, canary verification, and pedigree-stub-safe archive bundling must remain intact.',
  'IMP-018#src/storage/opfsStorage.ts#1':
    'OPFS `/tmp`, `/backups`, `/archives` persistence, boot sweeps, QuotaExceededError retries, wiped detection, and IDB rescue dumps must stay wired.',
  'IMP-018#src/storage/webSqliteAdapter.ts#1':
    'SQLite adapter must pause sample seeding on wiped returning storage, create pre-upgrade snapshots, and update prior-use sentinels.',
  'IMP-018#src/hooks/useBarnStore.ts#1':
    'Barn store must orchestrate unified OPFS/IDB vault actions, archive offload/restore, idle canary checks, and wiped-storage recovery.',
  'IMP-018#src/components/UnifiedBackupVaultPanel.tsx#1':
    'Settings UI must unify OPFS vault backups and IndexedDB rolling snapshots in one clean recovery panel.',
  'IMP-018#src/components/ArchivedHerdsModal.tsx#1':
    'Archived Herds modal must support searching, downloading, deleting, and restoring offloaded Sold/Deceased bundles.',
  'IMP-018#src/components/WipedStorageRecoveryModal.tsx#1':
    'Blocking wiped-storage recovery dialog must offer latest OPFS restore, local file upload, and explicit two-step Start Fresh.',
  'IMP-018#src/App.tsx#1':
    'App shell must mount WipedStorageRecoveryModal, Export Canary alerts, and 1-click Save to Vault on backup banners.',
  'IMP-019#vite.config.ts#1':
    'Vite build must target ES2018 / Safari 12+ (2018+ browsers) with manual prompt SW activation.',
  'IMP-019#index.html#1':
    'ES5 pre-flight guard, 3-in-60s crash-loop circuit breaker, and ?emergency_reset=true recovery hatch must remain intact.',
  'IMP-019#src/utils/es2018Shims.ts#1':
    'Zero-bloat ES2018 runtime shims prevent missing globalThis/allSettled/fromEntries crashes on 2018 browsers.',
  'IMP-019#src/storage/pwaUpdateManager.ts#1':
    'Manual Service Worker update gate and single-reload controllerchange handshake must remain intact.',
  'IMP-019#src/domain/deviceCapability.ts#1':
    'Pure TypeScript browser compatibility classifier and Tier 1/outdated ZIP caution gate must remain intact.',
  'IMP-019#src/utils/webFileActions.ts#1':
    'Clipboard fallback for restricted/older browser contexts must remain available.',
  'IMP-019#src/components/ImportExportHubScreen.tsx#1':
    'Heavy .ZIP exports must warn Tier 1/outdated browsers and offer Database-Only .JSON fallback without photo hydration.',
  'IMP-020#src/storage/backgroundFreezeCoordinator.ts#1':
    'Single-source background freeze coordinator must manage cooperative pauses, auto-resume clean tasks, and hold severity tasks until acknowledged.',
  'IMP-020#src/storage/crashLogger.ts#1':
    'Uncaught rejections and QuotaExceeded writes must fall back to bounded sessionStorage emergency traces and emit deduplicated non-blocking error toasts.',
  'IMP-020#src/storage/localSyncChannels.ts#1':
    'Folder Sync must close IDB handles deterministically on abort, checkpoint progress on hide, and support foreground resume.',
  'IMP-020#src/utils/useAsyncSubmitLock.ts#1':
    'Synchronous ref-based double-submit locks must gate same-frame double taps and always unlock in finally.',
  'IMP-020#src/hooks/useBarnStore.ts#1':
    'Store mutations must run sequentially without interleaving outbox/SQLite writes and surface storage errors without dropping typed form inputs.',
  'IMP-020#src/components/AsyncErrorToastHost.tsx#1':
    'Global non-blocking toast stack must render auto-dismissing minor notices, sticky error alerts, and severity-only Tap to Resume controls.',
  'IMP-020#src/components/AnimalEditorModal.tsx#1':
    'Animal editor modal Save/Delete actions must prevent rapid double-tap duplicate animals.',
  'IMP-020#src/components/BreedingScreen.tsx#1':
    'Breeding Log and Outcome forms must block rapid double-submits and hold entered fields on storage error.',
  'IMP-020#src/components/HerdScreen.tsx#1':
    'Care log form and inline quick animal actions must prevent duplicate writes cleanly.',
  'IMP-020#src/components/SpeciesDashboardScreen.tsx#1':
    'Species hub chore/cage/show forms and silent per-row chore toggles must prevent rapid double-tap races.',
  'IMP-021#src/utils/comboboxNav.ts#1':
    'Pure combobox index-stepping helper powers keyboard traversal across all custom listboxes.',
  'IMP-021#src/components/CarrierTraitCombobox.tsx#1':
    'Carrier trait combobox must expose aria-activedescendant and full keyboard navigation.',
  'IMP-021#src/components/SearchableParentPicker.tsx#1':
    'Searchable parent picker must expose aria-activedescendant and full keyboard navigation.',
  'IMP-021#src/components/ExternalImporterPanel.tsx#1':
    'Default species combobox must support keyboard traversal and close on focus blur.',
  'IMP-021#src/App.tsx#1':
    'Root shell tracks open dialogs via subscribeOpenDialogCount (superseding rAF MutationObserver in IMP-052) and guards O/I/S/H/D/R/B/P/? shortcuts cleanly.',
  'IMP-021#src/domain/syncAndExports.ts#1':
    'PDF snapshot DTO exports must include cleared and ancestral lineage carrier disclosures.',
  'IMP-022#src/domain/pedigreeCalculator.ts#1':
    'Pure branch viewport helper keeps initial 4–6 gen DOM compact while preserving full-depth export slots.',
  'IMP-022#src/components/PedigreeScreen.tsx#1':
    'Interactive pedigree chart must lazy-expand Gen 4+ branches on demand without losing focus or keyboard access.',
  'IMP-022#src/domain/upgradeGate.ts#1':
    'Pure pre-flight Upgrade Gate evaluates revoked builds, paused updates, Safe-Harbor schema floors, and schemaDelta>=2 backup gates.',
  'IMP-022#src/domain/backupVault.ts#1':
    'Pre-upgrade safety backups must emit _schemaVersion-stamped envelopes and verify SHA-256 round-trip integrity.',
  'IMP-022#src/storage/pwaUpdateManager.ts#1':
    'PWA updater enforces persisted auto/notify/pinned policies and uncached Upgrade Gate checks before posting SKIP_WAITING.',
  'IMP-022#src/storage/storageProtection.ts#1':
    'Connectivity governor combines Manual App Offline Mode with a timed AbortController captive-portal probe.',
  'IMP-022#public/version.json#1':
    'Release version manifest must expose current appVersion, schemaVersion, and minDirectUpgradeSchema floor.',
  'IMP-022#public/status.json#1':
    'Remote killswitch manifest must expose allowUpdates and revokedVersions lists.',
  'IMP-022#vite.config.ts#1':
    'Service worker navigation fallback must never intercept or precache uncached version.json / status.json manifests on root or subpaths.',
  'IMP-023#src/domain/photoMaintenance.ts#1':
    'Pure photo storage footprint analyzer, orphan cleaner, and thumbnail compactor must stay DOM-free.',
  'IMP-023#src/domain/archiveInspector.ts#1':
    'Dry-run pre-restore inspector summarizes species, conflicts, and replace/merge impact before DB writes.',
  'IMP-023#src/domain/encryptedExport.ts#1':
    'Pure encrypted envelope framing and ZIP wrapper/extractor must remain intact.',
  'IMP-023#src/storage/passphraseCrypto.ts#1':
    'Client-side PBKDF2-SHA256 + AES-256-GCM encryption runs strictly with memory-only passphrases.',
  'IMP-023#src/storage/storageProtection.ts#1':
    'Server Date skew capture compensates timestamps and flags drift >= 5 minutes cleanly.',
  'IMP-023#src/domain/syncOutbox.ts#1':
    'Monotonic record_rev ensures newer same-entity edits win even when a device clock rewinds.',
  'IMP-023#src/domain/calendarExport.ts#1':
    'Deterministic [a-v0-9] Google Calendar IDs prevent duplicate calendar events on retry/sync.',
  'IMP-023#src/utils/googleCalendarClient.ts#1':
    'Google Calendar push must update existing events via PUT when deterministic ID returns HTTP 409.',
  'IMP-023#src/components/ImportExportHubScreen.tsx#1':
    'Import/Export Hub must require Pre-Restore Inspector confirmation and expose opt-in backup/sync encryption.',
  'IMP-023#src/components/DiagnosticsAndSupportPanel.tsx#1':
    'Diagnostics exposes Photo Storage & Orphan Attachment Pruner actions safely.',
  'IMP-023#src/App.tsx#1':
    'Root shell renders non-blocking Clock Drift Nudge Banner when drift reaches threshold.',
  'IMP-024#src/domain/barnAlerts.ts#1':
    'Pure withdrawal countdown evaluator and safety conflict helpers must remain intact and DOM-free.',
  'IMP-024#src/components/HomeSpeciesScreen.tsx#1':
    'Home species cards must surface closable session-scoped withdrawal safety alerts.',
  'IMP-024#src/components/HerdScreen.tsx#1':
    'HerdScreen must display active withdrawal countdowns, filter tab, sort, and profile alert banner.',
  'IMP-024#src/components/AnimalEditorModal.tsx#1':
    'AnimalEditorModal must require soft confirmation before saving Sold or Flagged-for-Cull stock under active withdrawal.',
  'IMP-024#src/components/SpeciesDashboardScreen.tsx#1':
    'Show entry form must warn when selected animals have medication withdrawals overlapping eventDateIso.',
  'IMP-024#src/App.tsx#1':
    'Root shell tracks session-scoped Home withdrawal dismissal and Herd filter navigation.',
  'IMP-025#src/domain/syncOutbox.ts#1':
    'Sync outbox must strip binary blobs on photo creates and support snapshot diffing for bulk migrations.',
  'IMP-025#src/domain/speciesMigration.ts#1':
    'Cross-species migration must advance `_rev` counters on every migrated or created record.',
  'IMP-025#src/domain/backupArchive.ts#1':
    'Photos-Only ZIP merge must hydrate blobs onto metadata-only photo placeholders without overwriting newer metadata.',
  'IMP-025#src/domain/syncAndExports.ts#1':
    'Barn snapshot merges must rehydrate blobs onto metadata-only photos without losing existing local blobs.',
  'IMP-025#src/hooks/useBarnStore.ts#1':
    'Store must clear sync/backup-reminder state on resets/replaces and enqueue metadata-only photo & migration outbox ops.',
  'IMP-025#src/components/AnimalPhotoGallery.tsx#1':
    'Photo gallery must avoid rendering broken <img src=""> tags for metadata-only synced photo placeholders.',
  'IMP-026#src/domain/upgradeGate.ts#1':
    'Upgrade-gate HTTP Date skew calculation must default to clock-skew-aware nowEpochMs().',
  'IMP-026#src/storage/pwaUpdateManager.ts#1':
    'Version/status manifest checks must propagate HTTP Date skew and record adjusted timestamps.',
  'IMP-026#src/components/ImportExportHubScreen.tsx#1':
    'Archive/backup exports must lock synchronously against double-tap and record skew-adjusted pause timestamps.',
  'IMP-027#src/utils/useVirtualWindow.ts#1':
    'Zero-dependency ES2018 scroll virtualizer must remain intact with guarded ResizeObserver cleanup.',
  'IMP-027#src/storage/webSqliteAdapter.ts#1':
    'SQLite adapter must provide cycle-safe bounded BFS pedigree queries and lightweight branch-existence probes.',
  'IMP-027#src/hooks/useBarnStore.ts#1':
    'Barn store must cache lazily fetched SQLite/OPFS pedigree ancestors in a bounded LRU map.',
  'IMP-027#src/domain/pedigreeCalculator.ts#1':
    'Branch summaries must surface externally detected Gen 4+ ancestors before full depth is loaded in RAM.',
  'IMP-027#src/components/PedigreeScreen.tsx#1':
    'Pedigree screen must scope initial tree to Gen 0–3 and hydrate Gen 4+ on branch expand or print.',
  'IMP-027#src/components/BreedingScreen.tsx#1':
    'Breeding & litter ledger must filter and virtualize large pairing histories cleanly.',
  'IMP-027#src/components/HerdScreen.tsx#1':
    'Herd roster list must virtualize rows via useVirtualWindow with HERD_PAGE_SIZE pre-layout fallback.',
  'IMP-027#src/components/ReportsScreen.tsx#1':
    'Reports table must virtualize displayed rows while exporting full filtered sets to CSV and Print.',
  'IMP-028#src/domain/barnAlerts.ts#1':
    'Pure occupancy counting and capacity warning evaluation must remain in pure TS core with species isolation.',
  'IMP-028#src/hooks/useBarnStore.ts#1':
    'Store must expose queued FIFO assignAnimalToCage mutation updating _rev and syncOutbox.',
  'IMP-028#src/components/SpeciesDashboardScreen.tsx#1':
    'Cages & Pens cards must show occupancy ratios, quick occupant assignment/unassignment, inline edit, and over-capacity alerts.',
  'IMP-028#src/components/AnimalEditorModal.tsx#1':
    'Animal editor must display live cage occupancy feedback and soft confirmation before saving an over-capacity assignment.',
  'IMP-028#src/components/HomeSpeciesScreen.tsx#1':
    'Home species cards must surface an actionable alert when any species cage exceeds capacity.',
  'IMP-028#src/domain/barnBinder.ts#1':
    'Printable Barn Binder cage table must show occupancy/capacity ratios and over-capacity markers.',
  'IMP-029#src/domain/models.ts#1':
    'SpeciesProfile must carry optional BreedScheduleOverride entries normalized deterministically in pure TypeScript.',
  'IMP-029#src/domain/taskMaster.ts#1':
    'Breed override resolution, AFTER_BIRTH task date recalculation, and Missed breeding task cleanup helpers must remain pure and reusable.',
  'IMP-029#src/storage/webSqliteAdapter.ts#1':
    'SQLite schema and migrations must persist species breedOverrides across reloads.',
  'IMP-029#src/hooks/useBarnStore.ts#1':
    'Store must expose queued FIFO mutations for post-birth task recalculation and one-click breeding task outcome checkoffs with cleanup.',
  'IMP-029#src/components/SpeciesEditorModal.tsx#1':
    'Species Editor must allow configuring optional per-breed gestation, weaning, rebreed, maturity, and milestone day overrides.',
  'IMP-029#src/components/BreedingScreen.tsx#1':
    'Breeding Lab must resolve breed overrides in previews, offer one-tap post-birth chore shifting, and surface automatic Missed cleanup notice.',
  'IMP-029#src/components/SpeciesDashboardScreen.tsx#1':
    'Species Hub task list must support one-click Palpation & Birth Check checkoffs and inline post-birth chore shifting on active pairings.',
  'IMP-030#src/domain/exporters/exporterTypes.ts#1':
    'Pure TypeScript exporter interface contracts must remain DOM-free for cross-platform reuse.',
  'IMP-030#src/domain/exporters/registry.ts#1':
    'Non-native exporter catalog must keep built-in formats and extensible registry hooks intact.',
  'IMP-030#src/components/ImportExportHubScreen.tsx#1':
    'Hub screen must organize System Backup, Native & External Imports, and Exporters cleanly.',
  'IMP-030#src/hooks/useBarnStore.ts#1':
    'WorkspaceRoute union must include importExport.',
  'IMP-030#src/App.tsx#1':
    'Root shell must route, lazy-load, and link banners/shortcuts cleanly to ImportExportHubScreen.',
  'IMP-030#src/components/SettingsAndSyncScreen.tsx#1':
    'Settings must link cleanly into all sections of the Import/Export Hub without duplicating forms.',
  'IMP-031#src/domain/importers/csvStarterTemplate.ts#1':
    'Pure TS starter CSV template generator must remain DOM-free with standard pedigree headers.',
  'IMP-031#src/domain/importers/csvColumnMapper.ts#1':
    'Pure TS column mapper must resolve aliases, sample cells, and user overrides cleanly.',
  'IMP-031#src/domain/importers/universalPedigreeImporter.ts#1':
    'Universal importer must perform two-pass parent resolution and surface column mapping & unresolved Sire/Dam links.',
  'IMP-031#src/components/ExternalImporterPanel.tsx#1':
    'External importer UI must expose template download, interactive column mapping, and unresolved parent link warnings.',
  'IMP-032#src/storage/opfsTempStream.ts#1':
    'Worker-safe OPFS /tmp chunk streamer must remain free of React/DOM imports and close writables in try/finally.',
  'IMP-032#src/domain/syncAndExports.ts#1':
    'Pure TypeScript backup JSON chunk generator prevents allocating monolithic strings for photo-heavy backups.',
  'IMP-032#src/domain/backupArchive.ts#1':
    'Streaming fflate Zip/ZipPassThrough/ZipDeflate builders decode and flush one entry at a time incrementally.',
  'IMP-032#src/utils/webFileActions.ts#1':
    'All printable, shareable, and streamed browser exports stage via OPFS /tmp when supported and clean up deterministically.',
  'IMP-032#src/storage/offThreadWorkerClient.ts#1':
    'Off-thread worker bridge streams ZIP chunks straight to OPFS /tmp and falls back gracefully without Worker or OPFS.',
  'IMP-033#src/domain/techyStuffGuardrails.ts#1':
    'Pure TS developer guardrails module must stay DOM-free and enforce quota evaluations, strict input validation/sanitization, and confirmation phrases.',
  'IMP-033#src/storage/storageProtection.ts#1':
    'Browser storage adapter must execute OPFS + IndexedDB quota pre-flight checks and log low-headroom diagnostics.',
  'IMP-033#src/components/TechyStuffErrorBoundary.tsx#1':
    'Developer & Troubleshooting screen must stay isolated in a dedicated Error Boundary so faulty diagnostics cannot crash herd/breeding views.',
  'IMP-033#src/components/TechyStuffScreen.tsx#1':
    'The Techy Stuff screen must include a permanent non-closeable Tier/Memory Hierarchy block and multi-step armed safeguards for destructive actions.',
  'IMP-033#src/components/SettingsAndSyncScreen.tsx#1':
    'Settings must link cleanly to The Techy Stuff while keeping routine barn preferences and original DeviceCapabilityCard intact.',
  'IMP-033#src/App.tsx#1':
    'Root shell must lazy-load TechyStuffScreen inside Suspense + TechyStuffErrorBoundary.',
  'IMP-034#src/domain/barnBench.ts#1':
    'Pure TS Barn Bench queue builder, commit planner, and auto-advance selector must remain DOM-free and species-isolated.',
  'IMP-034#src/storage/webSqliteAdapter.ts#1':
    'Transactional batch CareLog persistence prevents multi-flush overhead when logging combined bench entries.',
  'IMP-034#src/hooks/useBarnStore.ts#1':
    'Store must expose the bench route and queued atomic commitBarnBenchEntry action with outbox sync ops.',
  'IMP-034#src/components/BarnBenchScreen.tsx#1':
    'Barn Bench screen must guard async commits against double-taps, check cage capacity on moves, and auto-advance cleanly.',
  'IMP-034#src/App.tsx#1':
    'Root shell must lazy-load BarnBenchScreen under route === bench with keyboard shortcut K.',
  'IMP-035#src/domain/batchPrint.ts#1':
    'Pure TS batch print engine must remain DOM-free and support cage cards, 4-up mini sheets, 4x6 photo cards, and stacked pedigrees.',
  'IMP-035#src/hooks/useBarnStore.ts#1':
    'Store must expose bounded on-demand batch photo hydration without retaining full-res images in reactive snapshot RAM.',
  'IMP-035#src/components/PrintPreviewModal.tsx#1':
    'Print preview modal must render live layout switcher and batch print options toolbar.',
  'IMP-035#src/components/HerdScreen.tsx#1':
    'HerdScreen multi-select bulk bar must launch batch print previews and clean up hydrated photos on close.',
  'IMP-036#src/domain/qrCode.ts#1':
    'Pure TS offline QR encoder, vector SVG renderer, and deep-link helpers must remain zero-DOM and self-contained.',
  'IMP-036#src/domain/facilityBoard.ts#1':
    'Pure TS facility board grouping, feedlot rollups, and UTC calendar maintenance evaluators must remain DOM-free.',
  'IMP-036#src/domain/batchPrint.ts#1':
    '8-up batch cage cards must support scannable QR profile codes via includeQrCodes.',
  'IMP-036#src/domain/syncAndExports.ts#1':
    'Single thermal cage cards must embed optional QR profile deep links and backup JSON must preserve extended CageLocation metadata.',
  'IMP-036#src/storage/webSqliteAdapter.ts#1':
    'SQLite cages table and idempotent migrations must persist housing type, feedlot inventory, and maintenance schedule columns.',
  'IMP-036#src/hooks/useBarnStore.ts#1':
    'Store startup deep-link handler must resolve scanned QR animalId and cageId routes cleanly.',
  'IMP-036#src/components/FacilityPenBoard.tsx#1':
    'Visual Hutch-Row & Pasture Board must display grouped pens, feedlot controls, maintenance checkoffs, and QR cage card printing.',
  'IMP-036#src/components/SpeciesDashboardScreen.tsx#1':
    'Species dashboard Cages & Pens block must mount FacilityPenBoard alongside compact list view, full-screen board modal, and QR card print preview.',
  'IMP-037#src/domain/pairingMatrix.ts#1':
    'Pure TS multi-candidate comparison matrix must share one species COI evaluator, run carrier lineage + Punnett simulations, and remain zero-DOM.',
  'IMP-037#src/components/PairingComparisonMatrix.tsx#1':
    'Breeding Lab comparison matrix UI must render anchor/candidate selectors, sort/filter controls, coat genetics notice, and Load in Logger wiring.',
  'IMP-037#src/components/BreedingScreen.tsx#1':
    'BreedingScreen must mount PairingComparisonMatrix and connect Load in Logger to the Cage-Side Pairing Logger.',
  'IMP-038#src/domain/geneticsEngine.ts#1':
    'Pure TS allele provenance classifier must support Mendelian elimination, offspring inference, X-linked loci, and custom species isolation without DOM dependencies.',
  'IMP-038#src/domain/pedigreeAnalysis.ts#1':
    'Pure TS pedigree convergence and ARBA registration evaluator must scope ARBA rules to Rabbit/Cavy Gen 0–3 nodes and remain zero-DOM.',
  'IMP-038#src/components/ColoredGenotypeDisplay.tsx#1':
    'Reusable provenance renderer must style Sire, Dam, Offspring, Manual, and Unverified alleles with accessible labels and legend.',
  'IMP-038#src/components/PedigreeScreen.tsx#1':
    'PedigreeScreen must wire Dim Unique convergence spotlighting, ARBA registration flags, and color-coded node alleles.',
  'IMP-038#src/components/HerdScreen.tsx#1':
    'HerdScreen Genetics & Allele Inference card must display color-coded allele provenance and uncommitted inference previews.',
  'IMP-038#src/components/BreedingScreen.tsx#1':
    'BreedingScreen Coat Color Punnett panel must display color-coded Sire/Dam allele provenance alongside locus pair highlights.',
  'IMP-039#src/domain/models.ts#1':
    'BarnSettings must persist optional breederLogoDataUrl and models.ts must expose pure ARBA lbs.oz dot notation formatters.',
  'IMP-039#src/domain/syncAndExports.ts#1':
    'generateEvansHtmPedigree must support Landscape/Portrait @page sizing, ARBA lbs.oz dot weights, and header logo rendering.',
  'IMP-039#src/domain/pdfExporter.ts#1':
    'Pure TS offline PDF 1.4 generator must emit valid PDF binaries with JPEG XObjects and zero DOM dependencies.',
  'IMP-039#src/components/PrintPreviewModal.tsx#1':
    'PrintPreviewModal must expose orientation toggle, lbs.oz dot toggle, logo controls, and direct Download .PDF action.',
  'IMP-040#src/domain/models.ts#1':
    'models.ts must separate 3–6G startup defaults from on-demand 3–8G PedigreeGenerationDepth.',
  'IMP-040#src/domain/pedigreePrintStyles.ts#1':
    'Pure TS print preset engine must define color, border, and layout presets locked to #FFFFFF paper.',
  'IMP-040#src/domain/shareablePedigreeCard.ts#1':
    'Pure TS shareable HTML pedigree card generator must render zero-DOM self-contained cards with collapsible Gen 4–8 ancestry.',
  'IMP-040#src/domain/exporters/registry.ts#1':
    'Exporters registry must expose Shareable Pedigree Card (.HTML) alongside 8-gen Evans .HTM.',
  'IMP-040#src/components/PrintPreviewModal.tsx#1':
    'PrintPreviewModal must allow switching between Formal Certificate and Shareable Card and picking color, border, and layout presets.',
  'IMP-040#src/storage/webSqliteAdapter.ts#1':
    'SQLite neighborhood loader must fetch up to 8 generations with expanded ancestor node cap (512).',
  'IMP-041#src/domain/models.ts#1':
    'Canonical show award codes, E-Leg attachment types, and ShowEvent.results schema must stay intact.',
  'IMP-041#src/domain/showResults.ts#1':
    'Pure TS show results normalization, XSS-safe E-Leg attachment sanitization, leg delta reconciliation, and GC progress calculation must remain zero-DOM.',
  'IMP-041#src/storage/webSqliteAdapter.ts#1':
    'SQLite shows table and idempotent schema migration must persist and normalize results_json.',
  'IMP-041#src/hooks/useBarnStore.ts#1':
    'Store show save/delete mutations must normalize results and reconcile Animal.legsCount deltas atomically.',
  'IMP-041#src/domain/reportGenerators.ts#1':
    'Male/Female reports must aggregate show wins, points, combined legs, and Grand Champion progress automatically.',
  'IMP-041#src/domain/barnBinder.ts#1':
    'Barn Binder must include structured show placements, judge notes, E-Leg cert numbers, and E-Leg photo thumbnails.',
  'IMP-041#src/domain/syncAndExports.ts#1':
    'Evans .HTM pedigrees and JSON backups must carry structured ShowEvent.results and display show honors.',
  'IMP-041#src/domain/pdfExporter.ts#1':
    'Offline PDF 1.4 pedigrees must render show legs/GC status, awards, points, and ancestor honors.',
  'IMP-041#src/domain/shareablePedigreeCard.ts#1':
    'Shareable pedigree cards must badge show legs, GC eligibility, awards, and points.',
  'IMP-041#src/components/SpeciesDashboardScreen.tsx#1':
    'Species Hub must expose the accessible Show & Results Editor Modal, multi-award toggles, E-Leg photo vault uploader, and lightbox viewer.',
  'IMP-041#src/components/PedigreeScreen.tsx#1':
    'PedigreeScreen must surface show honors and forward shows/careLogs to all pedigree exports.',
  'IMP-041#src/components/HerdScreen.tsx#1':
    'HerdScreen profile must display GC progress bar, show history, E-Leg vault lightbox, and forward shows/careLogs to formal prints.',
  'IMP-042#src/domain/geneticsEngine.ts#1':
    'Pure TS Coat Explorer Sandbox evaluator and hypothetical animal shell builder must remain zero-DOM and custom-species isolated.',
  'IMP-042#src/components/CoatExplorerSandbox.tsx#1':
    'Breeding Lab Coat Explorer Sandbox UI must remain strictly ephemeral (no persistence writes) with What-If Single & Cross modes and ColorGeneticsNotice.',
  'IMP-042#src/components/BreedingScreen.tsx#1':
    'BreedingScreen must mount CoatExplorerSandbox inside Breeding Lab.',
  'IMP-043#src/domain/models.ts#1':
    'Target weight curve points and litter weight-gain milestone types/normalizers must remain intact on SpeciesProfile and BreedingRecord.',
  'IMP-043#src/domain/growthAnalytics.ts#1':
    'Pure TS growth, seasonal litter survival, cohort benchmark, and comparative ADG engine must stay zero-DOM.',
  'IMP-043#src/storage/webSqliteAdapter.ts#1':
    'SQLite schema and idempotent migrations must persist species target curves and breeding litter milestones.',
  'IMP-043#src/hooks/useBarnStore.ts#1':
    'Store must persist species target weight curves, litter milestones, and launch preselected multi-animal growth comparisons.',
  'IMP-043#src/components/GrowthAndSurvivalLab.tsx#1':
    'GrowthAndSurvivalLab UI must expose Comparative Rate of Gain charts with goal/cohort overlays and Litter Survival & Parent Curves.',
  'IMP-043#src/components/BreedingScreen.tsx#1':
    'BreedingScreen must mount GrowthAndSurvivalLab and expose litter weight milestone editing inside the Outcome modal.',
  'IMP-043#src/domain/reportGenerators.ts#1':
    'Reports catalog and generator must expose Litter Survival & Parent Performance Report.',
  'IMP-044#src/domain/models.ts#1':
    'FeedBatch, FeedAllocation, and 30/60/90/0 biosecurity purge window options must remain intact in core models.',
  'IMP-044#src/domain/feedInventory.ts#1':
    'Pure TS lot OCR parser, lot-gated biosecurity purge transform, lot traceability, and CSV exporter must stay zero-DOM.',
  'IMP-044#src/domain/feedManufacturerDirectory.ts#1':
    'Bundled offline manufacturer emergency & recall directory must stay accessible with zero network.',
  'IMP-044#src/storage/feedTagOcr.ts#1':
    'Feed tag OCR must decode and analyze full-resolution images BEFORE compact image compression.',
  'IMP-044#src/storage/webSqliteAdapter.ts#1':
    'SQLite persistence schema and adapter methods must store and hydrate feed batches and intake allocations.',
  'IMP-044#src/hooks/useBarnStore.ts#1':
    'Store must expose species-isolated feed ledger mutations, cage stock sync, and idle biosecurity auto-purge.',
  'IMP-044#src/components/FeedLedgerScreen.tsx#1':
    'FeedLedgerScreen must provide purchase/OCR scanning, intake allocations, lot traceability, and offline manufacturer contacts.',
  'IMP-044#src/App.tsx#1':
    'Root router must lazy-load and mount FeedLedgerScreen on route feed.',
  'IMP-045#src/domain/importers/pdfScanExtractor.ts#1':
    'Pure TS offline PDF vector text (`BT...ET`) and embedded `/DCTDecode` JPEG extractor must remain zero-DOM.',
  'IMP-045#src/domain/importers/pedigreeOcrParser.ts#1':
    'Pure TS 2D tree/line pedigree parser and Import Review Queue preview bridge must stay zero-DOM and deterministic.',
  'IMP-045#src/storage/pedigreeOcrScanner.ts#1':
    'Browser OCR runner must lazy-load Tesseract worker with bounded timeout, native TextDetector precheck, and soft offline manual fallback.',
  'IMP-045#src/components/PedigreeOcrScannerPanel.tsx#1':
    'Scanner UI must offer camera/photo/PDF capture, editable 15-slot 3-generation review, and staging into Import Review Queue.',
  'IMP-045#src/components/ExternalImporterPanel.tsx#1':
    'ExternalImporterPanel must accept staged OCR PlatformImportPreview drafts for full conflict resolution and WebP photo optimization.',
  'IMP-045#src/components/ImportExportHubScreen.tsx#1':
    'ImportExportHubScreen Section 02 must mount PedigreeOcrScannerPanel connected to ExternalImporterPanel.',
  'IMP-046#src/domain/models.ts#1':
    'LedgerEntry, ProcessingLog, and YouthProjectBook domain models and normalizers must remain intact.',
  'IMP-046#src/domain/economicsLedger.ts#1':
    'Pure TS economics margins, yield analytics, CSV exporters, and printable youth completion report builder must remain zero-DOM.',
  'IMP-046#src/storage/webSqliteAdapter.ts#1':
    'SQLite persistence schema v4 and adapter CRUD methods must store and hydrate ledger entries, processing logs, and youth project books.',
  'IMP-046#src/hooks/useBarnStore.ts#1':
    'Store must expose species-isolated economics, processing, and 4-H/FFA project mutations with delta outbox sync.',
  'IMP-046#src/components/EconomicsLedgerScreen.tsx#1':
    'EconomicsLedgerScreen must provide general ledger + receipt photos, meat/pelt yields, and 4-H/FFA project record books.',
  'IMP-046#src/App.tsx#1':
    'Root router must lazy-load and mount EconomicsLedgerScreen on route economics.',
  'IMP-047#AGENTS.md#1':
    'Workspace agent rules must lock the PWA against non-React rewrites.',
  'IMP-047#src/domain/speciesMigration.ts#1':
    'Cross-species migrations must move linked feedBatches and feedAllocations.',
  'IMP-047#src/domain/archiveInspector.ts#1':
    'Pre-restore dry-run inspection must count v3/v4 feed, ledger, processing, and youth records.',
  'IMP-047#src/domain/exporters/registry.ts#1':
    'HerdBoss Transfer Tables (.ZIP) and Breed Registry & Show Worksheets (.CSV) must stay active ready exporters.',
  'IMP-047#src/components/PrintPreviewModal.tsx#1':
    'PrintPreviewModal must enable Share .HTM on native wrappers, extract @media print rules, and forward orientation/HTML to native print.',
  'IMP-047#android-wrapper/app/src/main/java/org/askkim/pedigree/wrapper/PrintBridge.kt#1':
    'Android PrintBridge must render self-contained HTML in a hardened offscreen WebView with landscape/portrait PrintAttributes.',
  'IMP-048#AGENTS.md#1':
    'AGENTS.md must explicitly define the hybrid wrapper boundary and forbid Kotlin rewrites during bootability recovery.',
  'IMP-048#README.md#1':
    'Root README must immediately clarify the React + Vite + TypeScript core PWA vs thin android-wrapper/ split.',
  'IMP-048#ARCHITECTURE.md#1':
    'ARCHITECTURE.md must define the thin Kotlin WebView shell vs mandatory React PWA architecture.',
  'IMP-048#metadata.json#1':
    'AI Studio metadata.json must state that the core app is a React + Vite + TypeScript PWA.',
  'IMP-048#package.json#1':
    'package.json description must identify the React + Vite + TypeScript PWA stack and thin hybrid wrapper.',
  'IMP-048#index.html#1':
    'HTML entry point must carry an explicit guard comment against converting the PWA into Kotlin.',
  'IMP-048#android-wrapper/README.md#1':
    'android-wrapper/ must explicitly warn readers that it is only a thin WebView container.',
  'IMP-048#android-wrapper/app/build.gradle.kts#1':
    'Android Gradle config must mark itself as a thin WebView shell packaging the React PWA.',
  'IMP-049#src/domain/models.ts#1':
    'ClientContact, WaitlistEntry, and AnimalReservation domain models and normalizers must remain intact.',
  'IMP-049#src/domain/clientCrm.ts#1':
    'Pure TS CRM financial evaluation, automated follow-up reminders, waitlist matching, CSV export, and printable Sales Agreement generator must stay zero-DOM.',
  'IMP-049#src/storage/webSqliteAdapter.ts#1':
    'SQLite schema v5 and adapter CRUD methods must store and hydrate CRM contacts, waitlist entries, and reservations.',
  'IMP-049#src/hooks/useBarnStore.ts#1':
    'Store must expose species-isolated CRM mutations, atomic sale completion, and reminder task creation with delta outbox sync.',
  'IMP-049#src/components/ClientCrmScreen.tsx#1':
    'ClientCrmScreen must render reminders, reservation/deposit tracking, ranked waitlist matching, client directory, and printable sales agreements.',
  'IMP-049#src/App.tsx#1':
    'Root router must lazy-load and mount ClientCrmScreen on route crm.',
  'IMP-050#src/domain/models.ts#1':
    'WoolHarvest and IagarbScorecard domain models and normalizers must remain intact.',
  'IMP-050#src/domain/woolFiber.ts#1':
    'Pure TS IAGARB 100-point rubric, 325g/90-day performance yield normalization, and harvest summary calculators must stay zero-DOM.',
  'IMP-050#src/domain/alternativeCertificates.ts#1':
    'Pure TS Pet-Sale Birth Certificate (no breeder contact/pricing) and Breeding Certificate generators must remain zero-DOM and XSS-safe.',
  'IMP-050#src/domain/showDocuments.ts#1':
    'Pure TS ARBA Show Entry Form, emailable plain-text/mailto dispatchers, and 4-up/1-up Remark Card generators must remain zero-DOM.',
  'IMP-050#src/domain/pedigreePrintStyles.ts#1':
    'Family Portrait and IAGARB German Angora pedigree presets must stay registered.',
  'IMP-050#src/storage/webSqliteAdapter.ts#1':
    'SQLite schema v6 must store and hydrate wool_harvests cleanly.',
  'IMP-050#src/hooks/useBarnStore.ts#1':
    'Store must expose species-isolated wool harvest mutations with delta outbox sync.',
  'IMP-050#src/components/WoolHarvestPanel.tsx#1':
    'WoolHarvestPanel must provide lazy-loaded Wool / Fiber logging and IAGARB 100-pt judging scorecards.',
  'IMP-050#src/components/HerdScreen.tsx#1':
    'HerdScreen must provide Pet-Sale Birth Certificate previews and mount WoolHarvestPanel.',
  'IMP-050#src/components/BreedingScreen.tsx#1':
    'BreedingScreen must expose Breeding Certificate preview controls.',
  'IMP-050#src/components/SpeciesDashboardScreen.tsx#1':
    'SpeciesDashboardScreen must expose Show Entry Form and Remark Cards print/email previews directly from ShowEvents.',
  'IMP-051#src/domain/pedigreeAnalytics.ts#1':
    'Pure TS founder contribution, effective founders fe, founder-loss ledger, and heritability h² calculators must remain zero-DOM.',
  'IMP-051#src/domain/barnScheduler.ts#1':
    'Pure TS Gantt timeline builder, UTC span shift/resize helpers, and critical-task escalation engine must remain zero-DOM.',
  'IMP-051#src/domain/p2pSyncProtocol.ts#1':
    'Pure TS LAN P2P CP-LAN1 signaling codec, wire delta framing, and reconciliation summary helpers must remain intact.',
  'IMP-051#src/storage/p2pLanChannel.ts#1':
    'Zero-server WebRTC DataChannel (iceServers: []) and Sync Folder reconciliation bridge must remain wired.',
  'IMP-051#src/storage/webSqliteAdapter.ts#1':
    'SQLite barn_tasks table must persist and hydrate startDateIso across reloads.',
  'IMP-051#src/hooks/useBarnStore.ts#1':
    'Store must expose serialized mutations for Gantt rescheduling, smart priority escalation, and P2P outbox reconciliation.',
  'IMP-051#src/components/FounderAndHeritabilityPanel.tsx#1':
    'FounderAndHeritabilityPanel must render subject founder balance, herd bottleneck ledger, and cohort h² SVG trends.',
  'IMP-051#src/components/BarnSchedulerGantt.tsx#1':
    'BarnSchedulerGantt must render interactive drag/resize Gantt lanes, smart escalations, and LAN P2P sync controls.',
  'IMP-051#src/components/PedigreeScreen.tsx#1':
    'PedigreeScreen must lazy-mount FounderAndHeritabilityPanel in pedigree mode.',
  'IMP-051#src/components/BreedingScreen.tsx#1':
    'BreedingScreen must lazy-mount FounderAndHeritabilityPanel in breeding mode.',
  'IMP-051#src/components/SpeciesDashboardScreen.tsx#1':
    'SpeciesDashboardScreen must expose List/Gantt chore view switching and mount lazy-loaded BarnSchedulerGantt.',
  'IMP-052#.env.example#1':
    'Keep .env.example present with zero secret placeholders to satisfy IMP-008.',
  'IMP-052#.github/workflows/build-android-apk.yml#1':
    'Android APK CI must force NODE_ENV=production so jsx-dev-runtime never ships in APK assets.',
  'IMP-052#index.html#1':
    'Preflight must allow Safari Lockdown/Private Ephemeral Mode and keep Google Fonts non-render-blocking.',
  'IMP-052#vite.config.ts#1':
    'Rolldown code-splitting must isolate vendor chunks and consolidate lucide-react micro-chunks.',
  'IMP-052#src/engine/binaryEncoding.ts#1':
    'Pure TS binary/base64/dataURL encoding helpers must stay decoupled from fflate and DOM.',
  'IMP-052#src/storage/webSqliteAdapter.ts#1':
    'SQLite migrations must be version-gated, PRAGMA-checked, atomic, and memory-bounded during pre-upgrade backups.',
  'IMP-052#src/storage/storageProbes.ts#1':
    'Shared callback registry avoids circular dynamic import warnings for opfsStorage.',
  'IMP-052#src/utils/webFileActions.ts#1':
    'Small (<512 KB) iOS standalone PWA shares must bypass OPFS /tmp staging to preserve tap gesture activation.',
  'IMP-052#src/utils/useAccessibleDialog.ts#1':
    'Dialog count subscription replaces document.body MutationObserver in App.tsx.',
  'IMP-052#src/App.tsx#1':
    'Root shell must mark boot stable after store hydration, track dialogs via subscription, and guard CalendarSyncConfirmModal.',
  'IMP-052#src/hooks/useBarnStore.ts#1':
    'Store must defer non-critical startup probes, scope syncOperations state to sync routes, and dynamic-import cold modules.',
  'IMP-052#src/components/AnimalPhotoGallery.tsx#1':
    'Photo gallery lazy hydration must guard duplicate requests via refs instead of self-retriggering effect deps.',
  'IMP-053#tsconfig.json#1':
    'Targeted strict TypeScript checks must remain enabled to catch implicit-any and untyped catch regressions before release.',
  'IMP-053#src/engine/codecs/archiveAndCsvUtils.ts#1':
    'Excel serial date decoding must use explicit Date.UTC calendar offset math instead of raw millisecond addition.',
  'IMP-053#src/hooks/useBarnStore.ts#1':
    'Cold domain modules must remain dynamically imported inside async store handlers to keep the initial entry bundle lean.',
  'IMP-053#src/storage/offThreadWorkerClient.ts#1':
    'Idle archive/import Web Workers must terminate promptly on background hide/pagehide to release mobile RAM.',
  'IMP-053#.github/workflows/release.yml#1':
    'GitHub tag releases must verify version sync and package + attach both the PWA ZIP and Android WebView APKs with SHA-256 checksums.',
  'IMP-053#prompts/master_system_prompt.md#1':
    'Master System Prompt must enforce deleting wrapped-up plan files and logging every significant boot/load/memory change in IMPROVEMENTS.md.',
  'IMP-054#src/domain/models.ts#1':
    'Animal For-Sale eligibility helper and BarnSettings showcase contact fields must stay intact.',
  'IMP-054#src/domain/inputSanitization.ts#1':
    'Showcase website links must enforce strict http/https protocol sanitization.',
  'IMP-054#src/domain/breederShowcase.ts#1':
    'Pure TypeScript zero-server showcase HTML + stock sheet generator must stay decoupled from DOM.',
  'IMP-054#src/domain/exporters/registry.ts#1':
    'Import/Export Hub exporter registry must retain breeder-showcase-html.',
  'IMP-054#src/domain/syncAndExports.ts#1':
    'JSON backup parser must preserve breeder contact info and animal asking prices.',
  'IMP-054#src/storage/webSqliteAdapter.ts#1':
    'SQLite schema v7+ must persist and migrate For-Sale columns and contact settings atomically.',
  'IMP-054#src/components/AnimalEditorModal.tsx#1':
    'Animal editor must expose For-Sale toggle, asking price, and buyer-facing listing notes.',
  'IMP-054#src/components/SettingsAndSyncScreen.tsx#1':
    'Barn settings must expose public showcase contact info and catalog tagline.',
  'IMP-054#src/components/HerdScreen.tsx#1':
    'Herd screen must expose For-Sale filter pill and live PrintPreviewModal catalog toggles.',
  'IMP-054#src/components/ImportExportHubScreen.tsx#1':
    'Import/Export Hub must hydrate photos on Tier 2+ devices for breeder-showcase-html exports.',
  'IMP-055#src/domain/healthReference.ts#1':
    'Pure TypeScript health wiki directory and external PDF folder backup reminder evaluator must remain DOM-free and strict https:// validated.',
  'IMP-055#src/storage/localSyncChannels.ts#1':
    'Shared IDB sync_handles accessors allow vetDocsFolder persistence without bumping the IDB schema version.',
  'IMP-055#src/storage/vetDocsFolder.ts#1':
    'Vet PDF folder adapter must persist read-only directory handles, scan PDFs safely, track backup acknowledgments, and support full factory reset cleanup.',
  'IMP-055#src/hooks/useBarnStore.ts#1':
    'Factory reset and sync-state wipe flows must clear stored vet PDF handles and metadata.',
  'IMP-055#src/components/HealthReferencePanel.tsx#1':
    'Lazy health reference modal must route external links through IPlatformBridge and deterministically revoke PDF blob URLs.',
  'IMP-055#src/App.tsx#1':
    'App shell must lazy-load HealthReferenceModal, surface periodic external PDF folder backup reminders, and pass launcher handlers to screens.',
  'IMP-055#src/components/SpeciesDashboardScreen.tsx#1':
    'Species Dashboard must expose quick Health Wikis & Vet PDFs launcher.',
  'IMP-055#src/components/HerdScreen.tsx#1':
    'Animal Health Journal must expose contextual Health Wikis & Vet PDFs launcher.',
  'IMP-055#src/components/SettingsAndSyncScreen.tsx#1':
    'Barn Settings must expose Health Reference Wikis & Local Vet PDF Folder launcher.',
  'IMP-056#src/domain/healthReference.ts#1':
    'House Rabbit Society must remain on the built-in restricted wiki sources list and excluded from curated health wiki links.',
  'IMP-056#src/storage/vetDocsFolder.ts#1':
    'Custom restricted wiki sources must persist locally without allowing built-in restricted entries to be deleted.',
  'IMP-056#src/components/HealthReferencePanel.tsx#1':
    'Health Reference panel must enforce restricted source checks at click time and let users view/manage restricted sources.',
  'IMP-057#src/domain/models.ts#1':
    'Application code and translation baseline must remain explicitly typed as English (United States) `en-US`.',
  'IMP-057#index.html#1':
    'Root HTML document language must declare English USA (`en-US`).',
  'IMP-057#vite.config.ts#1':
    'PWA web app manifest must declare `lang: "en-US"`.',
  'IMP-057#src/domain/healthReference.ts#1':
    'Preferred sources (Merck, global federal ag/vet agencies, global universities) and configurable multi-language English filtering must remain intact.',
  'IMP-057#src/storage/vetDocsFolder.ts#1':
    'Custom preferred wiki sources and multi-language wiki filters must persist locally with built-in locking.',
  'IMP-057#src/components/HealthReferencePanel.tsx#1':
    'Health Reference panel must surface preferred source badges, language requirements, and preferred source management.',
  'IMP-058#src/domain/breedingCalendar.ts#1':
    'Pure TypeScript moon-phase, holiday, and monthly calendar computation must stay DOM-free and UTC-deterministic.',
  'IMP-058#src/storage/weatherForecast.ts#1':
    'Optional Open-Meteo 7-day forecast client must respect connectivity checks, cache TTL, and reset clearing.',
  'IMP-058#src/domain/mileageTaxLog.ts#1':
    'IRS mileage tax deduction calculations and formula/HTML-escaped annual exports must remain pure TypeScript.',
  'IMP-058#src/domain/barnJournal.ts#1':
    'Personal Barn Journal search, grouping, tag normalization, and exports must remain DOM-free and AST-sanitized.',
  'IMP-058#src/storage/webSqliteAdapter.ts#1':
    'SQLite schema must create and migrate mileage_logs and journal_entries tables atomically.',
  'IMP-058#src/hooks/useBarnStore.ts#1':
    'Store must expose persisted CRUD mutators for mileage logs and journal entries.',
  'IMP-058#src/App.tsx#1':
    'App router must lazy-load and mount BarnJournalScreen at route journal.',
  'IMP-059#src/domain/models.ts#1':
    'BarnSettings must preserve the optional enableJudgeNotebook flag alongside Judge domain interfaces.',
  'IMP-059#src/domain/judgeNotebook.ts#1':
    'Pure TypeScript Judge Notebook conflict checks, mileage/expense calculations, CSV exports, and XSS-safe HTML contracts must remain DOM-free.',
  'IMP-059#src/storage/webSqliteAdapter.ts#1':
    'SQLite schema v9 must create, migrate, and persist judge_clubs, judge_assignments, judge_expenses, and enableJudgeNotebook.',
  'IMP-059#src/hooks/useBarnStore.ts#1':
    'Store must expose outbox-tracked CRUD mutators for Judge clubs, assignments, and expenses.',
  'IMP-059#src/components/JudgeNotebookScreen.tsx#1':
    "JudgeNotebookScreen must provide the opt-in gate, conflict alerts, financial tabs, and printable contract preview.",
  'IMP-059#src/App.tsx#1':
    "App router must lazy-load and mount JudgeNotebookScreen at route 'judge'.",
  'IMP-060#src/domain/cloudAppFolderSync.ts#1':
    'Pure TypeScript incremental delta chunk planner, HTTP 403/507 classifier, circuit breaker state machine, and rolling backup pruner must remain DOM-free.',
  'IMP-060#src/storage/cloudAppFolderSync.ts#1':
    'Cloud app-folder transport must keep OAuth tokens strictly in JS memory, isolate appDataFolder/approot, and never block or roll back local IndexedDB writes.',
  'IMP-060#src/hooks/useBarnStore.ts#1':
    'Store must schedule non-blocking background cloud delta sync after outbox commits and expose manual sync, reset-and-retry, and warning dismissal controls.',
  'IMP-060#src/components/CloudAppFolderSyncPanel.tsx#1':
    'Cloud App-Folder Sync panel must provide opt-in provider/token controls, tight-storage chunk indicators, and circuit breaker reset actions.',
  'IMP-060#src/App.tsx#1':
    'App shell must display the persistent global 403/507 quota circuit breaker warning banner and wire cloud sync state into ImportExportHubScreen and SettingsAndSyncScreen.',
  'IMP-061#src/domain/techyStuffGuardrails.ts#1':
    'Pure TypeScript developer console tab registry, 15-subunit collapsible state helpers, and 20-collection snapshot footprint calculator must remain DOM-free.',
  'IMP-061#src/storage/storageProbes.ts#1':
    'Storage probes must expose live IDB connection/transaction, BroadcastChannel, and Web Lock resource counts for runtime inspection.',
  'IMP-061#src/storage/opfsStorage.ts#1':
    'OPFS storage adapter must expose read-only namespace inspection across /tmp, /backups, and /archives alongside live OPFS handle counters.',
  'IMP-061#src/components/DiagnosticsAndSupportPanel.tsx#1':
    'DiagnosticsAndSupportPanel must support section filtering (`all`, `logs-and-support`, `maintenance`) and optional collapsible outer wrapping without breaking standalone rendering.',
  'IMP-061#src/components/TechyStuffScreen.tsx#1':
    'TechyStuffScreen must keep the title header open with an Open All Sections toggle, make all 15 subunits collapsible, and surface OPFS inspection, snapshot footprint, browser compatibility matrix, and live handle telemetry.',
  'IMP-061#src/App.tsx#1':
    'App shell must pass live sync outbox operations and backup sync folder status into TechyStuffScreen.',
  'IMP-062#.github/workflows/build-android-apk.yml#1':
    'Android APK CI must install devDependencies without NODE_ENV=production and apply NODE_ENV=production strictly to the Vite production build step.',
  'IMP-062#android-wrapper/app/src/main/java/org/askkim/pedigree/wrapper/PedigreeAssetPathHandler.kt#1':
    'Android WebView asset handler must serve status.json with Cache-Control: no-cache alongside version.json.',
  'IMP-062#src/storage/webSqliteAdapter.ts#1':
    'Primary IndexedDB writes must catch QuotaExceededError, purge OPFS /tmp and non-essential fallback caches, and retry once before failing.',
  'IMP-062#src/components/PrintPreviewModal.tsx#1':
    'Print stage DOM mounting must strip executable tags, inline event handlers, and dangerous URLs before inserting HTML into #barn-print-stage.',
  'IMP-062#src/domain/backupVault.ts#1':
    'backupVault.ts must import binary encoding helpers directly from binaryEncoding.ts instead of pulling backupArchive.ts into the startup graph.',
  'IMP-062#src/components/DiagnosticsAndSupportPanel.tsx#1':
    'DiagnosticsAndSupportPanel must lazy-load the 200+ kB improvementRegistry manifest on demand instead of bloating TechyStuffScreen.',
  'IMP-062#vite.config.ts#1':
    'Rolldown codeSplitting must isolate app storage, backup, domain, and registry chunks with includeDependenciesRecursively: false so no chunk exceeds 500 kB.',
  'IMP-063#vite.config.ts#1':
    'Dev preview must strip multi-megabyte base64 inline sourcemaps and resolve lucide-react icons directly without pre-bundling all 1,600+ icons so mobile Chrome preview iframes do not OOM.',
  'IMP-063#src/components/CrashErrorBoundary.tsx#1':
    'CrashErrorBoundary mounts at root and must load formatTimestampedBackupSlug dynamically on click rather than eagerly pulling syncAndExports into startup.',
  'IMP-063#src/components/TechyStuffErrorBoundary.tsx#1':
    'TechyStuffErrorBoundary mounts in App.tsx and must load formatTimestampedBackupSlug dynamically on click rather than eagerly pulling syncAndExports into startup.',
  'IMP-064#index.html#1':
    'index.html must maintain canonical, OpenGraph, Twitter card, and Schema.org structured data for SEO.',
  'IMP-064#public/robots.txt#1':
    'public/robots.txt must guide search crawlers to the sitemap.',
  'IMP-064#public/sitemap.xml#1':
    'public/sitemap.xml must define the canonical GitHub Pages location.',
  'IMP-064#public/404.html#1':
    'public/404.html must provide client-side route fallback for GitHub Pages.',
  'IMP-064#.github/workflows/deploy-pages.yml#1':
    'deploy-pages.yml must deploy from both main and release branches and verify SEO artifacts.',
  'IMP-064#package.json#1':
    'package.json must state the official GitHub Pages homepage URL.',
  'IMP-065#vite.config.ts#1':
    'Dev sourcemap stripping must only remove trailing EOF comments and skip Content-Length mutation on encoded responses.',
  'IMP-065#index.html#1':
    'Pre-boot guard must separate transient module fetch/504 glitches from real ES2018 browser incompatibility and recover via cooldown-guarded reload.',
  'IMP-065#src/main.tsx#1':
    'Dev startup must reload cleanly once if a stale Service Worker controller intercepted the initial boot.',
  'IMP-065#src/utils/lazyRoute.tsx#1':
    'Lazy route loader and RouteErrorBoundary must detect stale chunk / 504 errors and perform a guarded clean reload instead of retrying a permanently rejected ES module entry.',
  'IMP-066#src/engine/primitives/sanitization.ts#1':
    'Shared pure sanitization helpers must live in @engine/primitives without DOM/Node or domain dependencies.',
  'IMP-066#src/engine/primitives/crypto.ts#1':
    'Shared FNV-1a and SHA-256 primitives must live in @engine/primitives.',
  'IMP-066#src/engine/bridge/desktopBridgeAdapter.ts#1':
    'Desktop Electron/Tauri runtime detection must remain dependency-free in @engine/bridge.',
  'IMP-066#src/engine/bridge/platformBridge.ts#1':
    'PlatformBridge must support correlated iOS WKWebView storage replies and unified safe URL/desktop/Android routing.',
  'IMP-066#src/engine/storage/nativeBridgeStorageAdapter.ts#1':
    'NativeBridgeStorageAdapter must verify caps.hasNativeBridge is active instead of accepting unbacked iOS signals.',
  'IMP-066#src/engine/storage/resilientStorageAdapter.ts#1':
    'createResilientStorageAdapter must strictly route ios-wkwebview through native bridge storage rather than evictable IndexedDB/OPFS.',
  'IMP-066#src/features/csv-exporter/csvExporter.ts#1':
    'Decoupled CSV exporter must remain domain-agnostic in @features/csv-exporter.',
  'IMP-066#src/features/backup-vault/portableVault.ts#1':
    'Decoupled SHA-256 verified portable vault must remain domain-agnostic in @features/backup-vault.',
  'IMP-066#src/features/document-export/htmlPrintPackage.ts#1':
    'Printable HTML packager must dispatch through IPlatformBridge without domain coupling.',
  'IMP-066#src/features/ics-calendar/icsBuilder.ts#1':
    'RFC 5545 calendar builder must accept generic events without livestock domain coupling.',
  'IMP-066#src/features/ocr-parser/ocrTextPipeline.ts#1':
    'OCR line/field extraction pipeline must remain schema-driven and domain-agnostic.',
  'IMP-066#src/app/pedigreeAppConfig.ts#1':
    'PEDIGREE_APP_CONFIG must stay lightweight so useBarnStore startup does not pull ZIP or SQLite WASM engines.',
  'IMP-066#src/app/pedigreeAppWiring.ts#1':
    '@app/pedigreeAppWiring.ts is the sole composition layer connecting domain configs to @features/* and @engine/*.',
  'IMP-066#android-wrapper/app/build.gradle.kts#1':
    'Android wrapper must preserve minSdk = 26 and Gradle property parameterization.',
  'IMP-066#ios-wrapper/BRIDGE_CONTRACT.md#1':
    'iOS WKWebView SQLite storage bridge protocol must remain documented for native Apple shell implementations.',
  'IMP-067#EXTRACTION_INVENTORY.md#1':
    'Extraction inventory must document FLASH_HYGIENE_PLAN.md absorption and classify 100% of non-test source files.',
  'IMP-067#src/domain/improvementRegistry.ts#1':
    'Boot-entry SHA-256 lock checksums must remain registered to protect active boot stability.',
  'IMP-067#src/engine/primitives/index.ts#1':
    'Pure content-agnostic Phase 2 primitives must stay exported from @engine/primitives.',
  'IMP-067#src/engine/codecs/archiveAndCsvUtils.ts#1':
    'archiveAndCsvUtils.ts must depend solely on content-agnostic @engine/primitives contracts.',
  'IMP-067#src/app/pedigreeAppWiring.ts#1':
    '@app/pedigreeAppWiring.ts must inject Pedigree defaults into pure @engine/primitives helpers.',
  'IMP-067#src/utils/es2018Shims.ts#1':
    'Reusable ES2018 shims must stay free of domain-specific internal marker names.',
  'IMP-067#src/utils/lazyRoute.tsx#1':
    'lazyRoute.tsx must expose parameterized reload defaults and domain-neutral fallback UI copy.',
  'IMP-068#AGENTS.md#1':
    'AGENTS.md must enforce reading master_system_prompt.md, fast-boot skip rules on GitHub import, and compact 2-line initial screen output.',
  'IMP-068#.npmrc#1':
    '.npmrc must disable npm audit and funding network calls to accelerate cold AI Studio dependency installation.',
  'IMP-068#vite.config.ts#1':
    'Vite must skip gzip size reporting on build and avoid eagerly pre-bundling lazy tesseract.js during dev startup.',
  'IMP-069#src/app/PlatformBridgeContext.tsx#1':
    'UI components must consume IPlatformBridge via React Context rather than importing concrete pedigreeBridge.',
  'IMP-069#src/utils/webFileActions.ts#1':
    'webFileActions.ts must stay decoupled from concrete pedigreeBridge globals.',
  'IMP-069#src/app/pedigreeAppWiring.ts#1':
    'Composition root must wire runtime defaults and route iOS WKWebView SQLite persistence through NativeBridgeStorageAdapter.',
  'IMP-069#src/storage/webSqliteAdapter.ts#1':
    'WebSqliteAdapter must support an injected IStorageAdapter backing store for iOS anti-eviction routing.',
  'IMP-070#src/storage/webSqliteAdapter.ts#1':
    'WebSqliteAdapter must never silently drop writes into ephemeral mode when backingStore is configured without IndexedDB.',
  'IMP-070#src/utils/webFileActions.ts#1':
    'Extractable UI utilities in src/utils/ must never import legacy pedigree-domain modules from src/storage/.',
  'IMP-070#tsconfig.engine.json#1':
    'Isolated tsconfig.engine.json profile (npm run verify:engine) proves the extractable framework compiles with zero domain/app/storage dependencies.',
  'IMP-070#package.json#1':
    'package.json must expose verify:engine for isolated framework compilation checks.',
  'IMP-070#src/domain/__tests__/modularLayerArchitecture.test.ts#1':
    'Automated boundary suite must fail on any circular dependency or src/utils/* storage import.',
  'IMP-071#src/engine/index.ts#1':
    'The engine must never import from the domain layer.',
  'IMP-071#src/engine/codecs/textFormats.ts#1':
    'CSV and ICS encoders must have a single shared implementation.',
  'IMP-071#package.json#1':
    'package.json must expose verify:layers.',
  'IMP-071#.github/workflows/ci.yml#1':
    'CI must run the layer audit and the isolated engine typecheck.',
  'IMP-072#package.json#1':
    'package.json must expose verify:extraction for isolated engine extraction rehearsal.',
  'IMP-072#.github/workflows/ci.yml#1':
    'CI must run the isolated engine extraction rehearsal.',
  'IMP-072#scripts/rehearse-engine-extraction.ts#1':
    'Extraction rehearsal must compile engine, features, and utils without domain/app/storage.',
  'IMP-073#src/utils/canvasUtils.ts#1':
    'Shared canvas/blob decode and OCR preprocessing helpers must remain centralized in src/utils/canvasUtils.ts.',
  'IMP-073#src/storage/webSqliteAdapter.ts#1':
    'SQLite WASM prepared statements in queryObjectsFromDb must always be freed in a finally block.',
  'IMP-073#.github/workflows/deploy-pages.yml#1':
    'GitHub Pages deployment workflow must enforce layer boundary and engine extraction gates.',
  'IMP-073#.github/workflows/build-android-apk.yml#1':
    'Android APK workflow must enforce layer boundary and engine extraction gates.',
  'IMP-074#src/components/SettingsAndSyncScreen.tsx#1':
    'SettingsAndSyncScreen must include title header, quick jump links for prompts, about, developer, and help.',
  'IMP-074#src/components/AboutModal.tsx#1':
    'AboutModal must present app details, offline architecture, and AGPL-3.0 license.',
  'IMP-074#src/App.tsx#1':
    'App.tsx must wire onOpenPromptsDirectory and track return routing for PromptsDirectoryScreen.',
  'IMP-075#package.json#1':
    'Unused autoprefixer must not be re-introduced under Tailwind CSS v4 (@tailwindcss/vite).',
  'IMP-075#tsconfig.json#1':
    'Obsolete decorator and JS-interop compiler flags must stay removed from strict TS config.',
  'IMP-075#vite.config.ts#1':
    'Vite config must use explicit Node built-in protocol imports (node:path).',
  'IMP-075#index.html#1':
    'index.html must include the standard mobile-web-app-capable meta tag.',
  'IMP-075#src/engine/binaryEncoding.ts#1':
    'binaryEncoding.ts must use pure RFC 3629 UTF-8 fallbacks instead of deprecated Annex B escape/unescape globals.',
  'IMP-075#src/components/PWAInstallButton.tsx#1':
    'PWAInstallButton.tsx must use standard React 19 function component signatures.',
  'IMP-076#src/utils/es2018Shims.ts#1':
    'Zero-dependency ES2018 runtime shims must cover queueMicrotask, Object.hasOwn, replaceAll, and .at() with graceful frozen-host handling.',
  'IMP-076#src/storage/weatherForecast.ts#1':
    'Weather forecast fetches must guard AbortController on legacy browsers and always clear timers in finally blocks.',
  'IMP-076#src/index.css#1':
    'Legacy browsers must receive vh viewport fallbacks and reduced backdrop-filter/motion GPU load.',
  'IMP-076#src/storage/deviceCapabilityDetector.ts#1':
    'useDeviceCapability must toggle pedigree-low-power for constrained/outdated browsers with unmount cleanup.',
  'IMP-077#src/components/SettingsAndSyncScreen.tsx#1':
    'SettingsAndSyncScreen must provide consolidated subunits, section jump navigation, collapsible subunits defaulting to collapsed except top_overview, and an Open All control near the title.',
  'IMP-078#GEMINI.md#1':
    'GEMINI.md must emit NO PENDING WORK when no incomplete plan or handoff exists and avoid legacy wording.',
  'IMP-078#prompts/master_system_prompt.md#1':
    'Master System Prompt must stay aligned with GEMINI.md NO PENDING WORK notice and three-layer boundaries.',
  'IMP-078#package.json#1':
    'package.json must expose unified npm run verify and zero-dependency preflight:lint across coding platforms.',
  'IMP-078#prompts/start_new_backlog_prompt.md#1':
    'Backlog prompts must point to src/domain/improvementRegistry.ts rather than removed src/core/.',
  'IMP-079#prompts/preflight/run-uni/modularity-check.md#1':
    'modularity-check.md must remain protected, concisely titled, and marked as reusable across repositories.',
  'IMP-079#prompts/preflight/run-uni/reusability-check.md#1':
    'reusability-check.md must remain protected, concisely titled, and marked as reusable across repositories.',
  'IMP-079#scripts/audit-layers.ts#1':
    'audit-layers.ts must audit hooks/ and components/ without false positives from comments or string literals.',
  'IMP-079#src/engine/primitives/crypto.ts#1':
    'Shared FNV-1a 32-bit base36 hash helper must stay in pure crypto primitives rather than duplicated across importers.',
  'IMP-079#src/engine/primitives/sanitization.ts#1':
    'Shared escapeRegExp and slugifySegment primitives must remain in @engine/primitives/sanitization.',
  'IMP-079#src/utils/lazyRoute.tsx#1':
    'lazyRoute singleton configuration must expose resetLazyRouteDefaults for isolated tests and multi-instance reuse.',
  'IMP-079#src/utils/webFileActions.ts#1':
    'webFileActions singleton configuration must expose resetWebFileConfiguration for test and bridge teardown.',
  'IMP-079#src/utils/googleCalendarClient.ts#1':
    'googleCalendarClient singleton hooks must expose resetGoogleCalendarClientConfiguration for isolated testing.',
  'IMP-080#vite.config.ts#1':
    'devLucideDirectImportPlugin must resolve lucide-react v1+ ESM entry (.mjs) so Vite dev startup does not trigger a 2,100+ icon request waterfall.',
  'IMP-080#src/domain/models.ts#1':
    'Lightweight boot constants and normalizers must live in models.ts so initial boot does not pull heavy backupVault, sampleData, or geneticsEngine modules.',
  'IMP-080#src/storage/webSqliteAdapter.ts#1':
    'webSqliteAdapter must parallelize sql.js WASM init with IndexedDB reads and lazy-load sampleData only when seeding empty storage.',
  'IMP-080#src/storage/opfsStorage.ts#1':
    'opfsStorage must dynamically import backupVault only when OPFS vault/archive files are actively read or written.',
  'IMP-080#src/domain/barnJournal.ts#1':
    'barnJournal must import CSV primitives from @engine/codecs/textFormats rather than domain csvExport.',
  'IMP-080#src/domain/calendarExport.ts#1':
    'calendarExport must import sha256HexPure from @engine/primitives/crypto rather than backupVault.',
  'IMP-081#prompts/core_hygiene.md#1':
    'core_hygiene.md must remain protected and cover both core content-free naming and PII scrubbing.',
  'IMP-081#src/domain/promptRegistry.ts#1':
    'promptRegistry.ts must maintain automated invariant checks and recovery markdown generation for /prompts/*.',
  'IMP-081#src/domain/moduleCatalog.ts#1':
    'moduleCatalog.ts must split src/ modules into Core/Non-Content vs Content-Specific and enforce zero content tokens in core filenames.',
  'IMP-081#package.json#1':
    'package.json must expose prompt recovery verification and module split listing/checking scripts.',
  'IMP-082#EXTRACTION_INVENTORY.md#1':
    'EXTRACTION_INVENTORY.md must classify every non-test storage file, including the SQLite row mapper and writer split modules, so inventory coverage stays at 100%.',
  'IMP-082#MODULES.md#1':
    'MODULES.md must stay regenerated from src/ so the module catalog lists the split SQLite row modules and the state hook.',
  'IMP-082#src/hooks/useBarnStore.ts#1':
    'useBarnStore must read the non-standard Chromium performance.memory API through a typed interface instead of `as any`, per the repo-wide no-type-escapes rule.',
  'IMP-082#AGENTS.md#1':
    'AGENTS.md must keep the three-phase full-sweep contract so future sweeps stay comprehensive.',
  'IMP-083#android-wrapper/gradle/wrapper/gradle-wrapper.properties#1':
    'The Gradle wrapper must stay pinned to the same 8.13 distribution CI installs, so local and CI builds resolve identically.',
  'IMP-083#android-wrapper/app/build.gradle.kts#1':
    'The wrapper must stage dist/ into assets/www and fail preBuild when the WebView asset root has no index.html, instead of packaging a shell that renders nothing.',
  'IMP-083#scripts/verify-android.ts#1':
    'The static Android gate must remain intact so wrapper and version drift fail on a machine without the Android SDK.',
  'IMP-083#package.json#1':
    'package.json must expose the Android static gate and keep it chained into `npm run verify`.',
  'IMP-083#android-wrapper/README.md#1':
    'The wrapper README must document the real build path and the JDK 17 + Android SDK prerequisite.',
  'IMP-084#.github/workflows/preflight.yml#1':
    'preflight.yml must keep a literal input default (never an expression, which GitHub rejects without starting a job) while still resolving the current branch at step level.',
  'IMP-084#package.json#1':
    'The preflight CLI entry points the workflow runs must stay available in package.json.',
  'IMP-085#.github/workflows/deploy-pages.yml#1':
    'Pages keeps deploying from main and release with Bun and its SEO assertions, while the guard decides whether Actions may deploy at all.',
  'IMP-085#.github/workflows/security-audit.yml#1':
    'The audit must trigger on the lockfile this project actually uses; bun.lock does not exist here.',
};
