/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Improvement registry entries IMP-052 … IMP-068 (17 of 85).
 *
 * Split out of `improvementRegistry.ts` so the registry stays reviewable as it grows. The public
 * surface (`IMPROVEMENTS_REGISTRY`, invariant evaluation, markdown/JSON export) still lives in
 * `src/domain/improvementRegistry.ts` and is unchanged.
 */

import type { ImprovementEntry } from './types';

export const REGISTRY_PART_04: ImprovementEntry[] = [
  {
    id: 'IMP-052',
    title: 'Post-Import Bootability, Bundle Hygiene, Atomic SQLite Migrations & Memory Hardening',
    category: 'stability-pwa',
    source: 'session',
    summary:
      'Restores `.env.example` (IMP-008), archives 3.6 MB AI Studio dumps out of `public/` into `docs/archive/aistudio-exports/`, enforces `NODE_ENV=production` in Android APK CI, removes explicit `: any` annotations (fixing a silent `AFTER_BRED` backup-parser bug), makes `index.html` preflight treat missing `indexedDB` as advisory so Safari Lockdown / Private Mode can enter Ephemeral Mode, loads Google Fonts asynchronously, arms boot-stability completion only after React store hydration (`!store.isLoading`), upgrades SQLite migrations to version-gated atomic `BEGIN`/`COMMIT`/`ROLLBACK` transactions with `PRAGMA table_info` checks and `{ lightweightPhotos: true }` pre-upgrade backups, bypasses OPFS `/tmp` staging for `<512 KB` iOS standalone PWA shares to preserve user activation, extracts pure `src/engine/binaryEncoding.ts` + eliminates all 3 Vite `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings + configures vendor/icon Rolldown code-splitting, defers non-critical startup probes/auto-repair off first paint, scopes `syncOperations` React state to sync-consuming routes, replaces `document.body` `MutationObserver` with `subscribeOpenDialogCount`, stabilizes `AnimalPhotoGallery` lazy hydration, and dehydrates Tier 3 mirror photos.',
    userIntent:
      'Harden post-import booting stability, first-paint loading speed, bundle footprint, and mobile memory management without breaking offline-first guarantees.',
    files: [
      '.env.example',
      '.github/workflows/build-android-apk.yml',
      'index.html',
      'vite.config.ts',
      'src/main.tsx',
      'src/App.tsx',
      'src/engine/binaryEncoding.ts',
      'src/domain/deviceCapability.ts',
      'src/domain/syncAndExports.ts',
      'src/storage/storageProbes.ts',
      'src/storage/opfsStorage.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/hooks/useBarnStore.ts',
      'src/utils/webFileActions.ts',
      'src/utils/useAccessibleDialog.ts',
      'src/components/AnimalPhotoGallery.tsx',
      'src/components/CrashErrorBoundary.tsx',
      'src/components/TechyStuffErrorBoundary.tsx',
      'src/storage/__tests__/postImportHardening.test.ts',
    ],
    invariants: [
      {
        filePath: '.env.example',
        requiredSubstrings: ['# No required environment variables.'],
        rationale: 'Keep .env.example present with zero secret placeholders to satisfy IMP-008.',
      },
      {
        filePath: '.github/workflows/build-android-apk.yml',
        requiredSubstrings: ['NODE_ENV: production'],
        rationale: 'Android APK CI must force NODE_ENV=production so jsx-dev-runtime never ships in APK assets.',
      },
      {
        filePath: 'index.html',
        requiredSubstrings: ['indexedDbAvailable', 'media="print"', "this.media='all'"],
        rationale: 'Preflight must allow Safari Lockdown/Private Ephemeral Mode and keep Google Fonts non-render-blocking.',
      },
      {
        filePath: 'vite.config.ts',
        requiredSubstrings: ['codeSplitting', 'vendor-react', 'vendor-icons', 'vendor-sql'],
        rationale: 'Rolldown code-splitting must isolate vendor chunks and consolidate lucide-react micro-chunks.',
      },
      {
        filePath: 'src/engine/binaryEncoding.ts',
        requiredSubstrings: [
          'utf8StringToBytes',
          'bytesToUtf8String',
          'bytesToBase64Pure',
          'base64ToBytesPure',
          'dataUrlToBinary',
          'binaryToDataUrl',
        ],
        rationale: 'Pure TS binary/base64/dataURL encoding helpers must stay decoupled from fflate and DOM.',
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: [
          'PRAGMA table_info(',
          'BEGIN TRANSACTION;',
          'ROLLBACK;',
          'this.loadSnapshotUnlocked({ lightweightPhotos: true })',
        ],
        rationale: 'SQLite migrations must be version-gated, PRAGMA-checked, atomic, and memory-bounded during pre-upgrade backups.',
      },
      {
        filePath: 'src/storage/storageProbes.ts',
        requiredSubstrings: ['registerIndexedDbOpfsDumper', 'triggerIndexedDbOpfsDump'],
        rationale: 'Shared callback registry avoids circular dynamic import warnings for opfsStorage.',
      },
      {
        filePath: 'src/utils/webFileActions.ts',
        requiredSubstrings: ['shouldBypassOpfsForIosGesture'],
        rationale: 'Small (<512 KB) iOS standalone PWA shares must bypass OPFS /tmp staging to preserve tap gesture activation.',
      },
      {
        filePath: 'src/utils/useAccessibleDialog.ts',
        requiredSubstrings: ['getOpenDialogCount', 'subscribeOpenDialogCount'],
        rationale: 'Dialog count subscription replaces document.body MutationObserver in App.tsx.',
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: [
          'subscribeOpenDialogCount',
          '__PEDIGREE_MARK_BOOT_STABLE__',
          'routeKey="calendar-sync-confirm"',
        ],
        rationale: 'Root shell must mark boot stable after store hydration, track dialogs via subscription, and guard CalendarSyncConfirmModal.',
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: [
          'isSyncOperationsRoute',
          'ensureMaxRevIndexInitialized',
          "import('../domain/archiveInspector')",
        ],
        rationale: 'Store must defer non-critical startup probes, scope syncOperations state to sync routes, and dynamic-import cold modules.',
      },
      {
        filePath: 'src/components/AnimalPhotoGallery.tsx',
        requiredSubstrings: ['hydratedUrlsRef', 'inFlightPhotoIdsRef'],
        rationale: 'Photo gallery lazy hydration must guard duplicate requests via refs instead of self-retriggering effect deps.',
      },
    ],
    restorePlaybook: [
      'Keep `.env.example` clean, keep AI Studio dumps archived in `docs/archive/aistudio-exports/` (never under `public/`), and preserve `NODE_ENV: production` in `.github/workflows/build-android-apk.yml`.',
      'Preserve advisory `indexedDbAvailable` preflight & async Google Fonts in `index.html`, post-hydration `__PEDIGREE_MARK_BOOT_STABLE__` in `src/App.tsx`, and atomic `PRAGMA table_info` migrations in `src/storage/webSqliteAdapter.ts`.',
      'Keep `src/engine/binaryEncoding.ts`, `triggerIndexedDbOpfsDump` in `storageProbes.ts`, `shouldBypassOpfsForIosGesture` in `webFileActions.ts`, `subscribeOpenDialogCount` in `useAccessibleDialog.ts`, Rolldown `codeSplitting` in `vite.config.ts`, and route-scoped `syncOperations` + deferred startup work in `useBarnStore.ts`.',
    ],
  },
  {
    id: 'IMP-053',
    title: 'v0.1.0-alpha.2 Release Readiness: Targeted Strict TS, Cold-Start Splits, Worker Freeze Trim, Unified PWA+APK Release CI & Prompt Governance',
    category: 'stability-pwa',
    source: 'session',
    userIntent:
      'Prepare Community Pedigree cleanly for its v0.1.0-alpha.2 GitHub release tag with zero new features—optimizing cold-start payload, compiler strictness, mobile worker memory cleanup, unified PWA+Android APK release packaging, plan deletion on wrap-up, and mandatory improvement logging for significant changes.',
    summary:
      'Enables 7 targeted strict TypeScript compiler checks in `tsconfig.json` (`alwaysStrict`, `noImplicitAny`, `noImplicitThis`, `strictBindCallApply`, `strictFunctionTypes`, `useUnknownInCatchVariables`, `noFallthroughCasesInSwitch`), converts Excel serial date parsing in `src/engine/codecs/archiveAndCsvUtils.ts` to calendar-safe `Date.UTC(1899, 11, 30 + serial)`, splits 7 cold domain modules (`barnBench`, `barnScheduler`, `p2pSyncProtocol`, `clientCrm`, `economicsLedger`, `feedInventory`, `importers/conflictResolver`) out of the initial entry bundle in `src/hooks/useBarnStore.ts`, hooks `src/storage/offThreadWorkerClient.ts` into `registerFreezeLifecycleListener` to terminate idle Web Workers immediately on mobile background hide/`pagehide`, upgrades `.github/workflows/release.yml` to verify cross-file version alignment (`0.1.0-alpha.2`), verify root + subpath builds, and attach both PWA `.zip` + `.sha256` and Android WebView `.apk` + `.sha256` artifacts to GitHub Releases, syncs `public/version.json`, Fastlane changelog, and release guides, updates `prompts/master_system_prompt.md` (and backlog/crash prompts) to delete wrapped-up plans and log every significant boot/load/memory change in `IMPROVEMENTS.md`, and removes completed crash-era plan files from `docs/archive/`.',
    files: [
      'tsconfig.json',
      'src/engine/codecs/archiveAndCsvUtils.ts',
      'src/hooks/useBarnStore.ts',
      'src/storage/offThreadWorkerClient.ts',
      '.github/workflows/release.yml',
      'public/version.json',
      'fastlane/metadata/android/en-US/changelogs/1.txt',
      'docs/HOW_TO_CREATE_A_RELEASE.md',
      '.github/WORKFLOWS_GUIDE.md',
      'README.md',
      'prompts/master_system_prompt.md',
      'prompts/start_new_backlog_prompt.md',
      'prompts/resume_backlog_plan_prompt.md',
      'prompts/fix_error_log_prompt.md',
      'src/domain/__tests__/releaseReadiness.test.ts',
    ],
    invariants: [
      {
        filePath: 'tsconfig.json',
        requiredSubstrings: [
          '"noImplicitAny": true',
          '"strictFunctionTypes": true',
          '"useUnknownInCatchVariables": true',
          '"noFallthroughCasesInSwitch": true',
        ],
        rationale: 'Targeted strict TypeScript checks must remain enabled to catch implicit-any and untyped catch regressions before release.',
      },
      {
        filePath: 'src/engine/codecs/archiveAndCsvUtils.ts',
        requiredSubstrings: ['Date.UTC(1899, 11, 30 + serial)'],
        rationale: 'Excel serial date decoding must use explicit Date.UTC calendar offset math instead of raw millisecond addition.',
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: [
          "import('../domain/economicsLedger')",
          "import('../domain/clientCrm')",
          "import('../domain/barnBench')",
          "import('../domain/barnScheduler')",
          "import('../domain/p2pSyncProtocol')",
          "import('../domain/feedInventory')",
          "import('../domain/importers/conflictResolver')",
        ],
        rationale: 'Cold domain modules must remain dynamically imported inside async store handlers to keep the initial entry bundle lean.',
      },
      {
        filePath: 'src/storage/offThreadWorkerClient.ts',
        requiredSubstrings: [
          'terminateIdleArchiveWorker',
          'archive-worker-freeze-trim',
          'registerFreezeLifecycleListener',
        ],
        rationale: 'Idle archive/import Web Workers must terminate promptly on background hide/pagehide to release mobile RAM.',
      },
      {
        filePath: '.github/workflows/release.yml',
        requiredSubstrings: [
          'Verify cross-file version alignment',
          'release-android-apk:',
          'publish-github-release:',
          'release-pwa-dist',
        ],
        rationale: 'GitHub tag releases must verify version sync and package + attach both the PWA ZIP and Android WebView APKs with SHA-256 checksums.',
      },
      {
        filePath: 'prompts/master_system_prompt.md',
        requiredSubstrings: [
          'Plan Lifecycle (Delete on Wrap-Up)',
          'Mandatory Improvement Logging (`IMPROVEMENTS.md` & `src/domain/improvementRegistry.ts`)',
        ],
        rationale: 'Master System Prompt must enforce deleting wrapped-up plan files and logging every significant boot/load/memory change in IMPROVEMENTS.md.',
      },
    ],
    restorePlaybook: [
      'Keep targeted strict TypeScript flags in `tsconfig.json` and calendar-safe `Date.UTC(1899, 11, 30 + serial)` in `src/engine/codecs/archiveAndCsvUtils.ts`.',
      'Preserve dynamic `import(...)` lazy splits for the 7 cold modules in `src/hooks/useBarnStore.ts` and `terminateIdleArchiveWorker` background-freeze cleanup in `src/storage/offThreadWorkerClient.ts`.',
      'Keep unified PWA ZIP + Android WebView APK + SHA-256 packaging and version-alignment checks in `.github/workflows/release.yml`, and retain the Plan Lifecycle and Mandatory Improvement Logging rules in `prompts/master_system_prompt.md`.',
    ],
  },
  {
    id: 'IMP-054',
    title: 'Zero-Server Breeder Showcase & For-Sale Catalog Exporter',
    category: 'species-ux',
    source: 'session',
    userIntent:
      'Let breeders mark eligible livestock For Sale with asking price and buyer notes, configure public contact details in Barn Settings, and export a self-contained static HTML storefront & printable buyer stock sheet without any server.',
    summary:
      'Adds `forSale`, `askingPriceCents`, and `saleNotes` fields plus `isAnimalAvailableForSale()` on `Animal`, optional public contact/tagline fields on `BarnSettings` (`breederEmail`, `breederPhone`, `breederLocation`, `breederWebsite`, `showcaseTagline`), `sanitizeSafeExternalHttpUrl()` + sync field allowlists in `inputSanitization.ts`, JSON v6 backup round-trip in `syncAndExports.ts`, atomic SQLite schema v7 migration (`for_sale`, `asking_price_cents`, `sale_notes` + `extra_settings_json`) in `webSqliteAdapter.ts`, pure TypeScript `src/domain/breederShowcase.ts` static HTML catalog + printable stock sheet generator (photos, 2-gen pedigrees, COI%, show/wool/carrier disclosures, reservation hold badges, medication withdrawal holds, QR badge, zero-dependency progressive search/filter, and XSS/SVG-safe sanitization), registers `breeder-showcase-html` in `src/domain/exporters/registry.ts`, adds For-Sale listing controls in `AnimalEditorModal.tsx`, breeder contact inputs in `SettingsAndSyncScreen.tsx`, `For Sale` herd filter + preview toggles in `HerdScreen.tsx`, and showcase photo hydration in `ImportExportHubScreen.tsx`.',
    files: [
      'src/domain/models.ts',
      'src/domain/inputSanitization.ts',
      'src/domain/breederShowcase.ts',
      'src/domain/exporters/registry.ts',
      'src/domain/syncAndExports.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/components/AnimalEditorModal.tsx',
      'src/components/SettingsAndSyncScreen.tsx',
      'src/components/HerdScreen.tsx',
      'src/components/ImportExportHubScreen.tsx',
      'src/domain/__tests__/breederShowcase.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/models.ts',
        requiredSubstrings: [
          'isAnimalAvailableForSale',
          'forSale?: boolean',
          'breederEmail?: string',
        ],
        rationale: 'Animal For-Sale eligibility helper and BarnSettings showcase contact fields must stay intact.',
      },
      {
        filePath: 'src/domain/inputSanitization.ts',
        requiredSubstrings: ['sanitizeSafeExternalHttpUrl'],
        rationale: 'Showcase website links must enforce strict http/https protocol sanitization.',
      },
      {
        filePath: 'src/domain/breederShowcase.ts',
        requiredSubstrings: [
          'buildBreederShowcaseResult',
          'generateBreederShowcaseHtml',
          'buildBreederShowcaseFileName',
        ],
        rationale: 'Pure TypeScript zero-server showcase HTML + stock sheet generator must stay decoupled from DOM.',
      },
      {
        filePath: 'src/domain/exporters/registry.ts',
        requiredSubstrings: ['breeder-showcase-html', 'buildBreederShowcaseResult'],
        rationale: 'Import/Export Hub exporter registry must retain breeder-showcase-html.',
      },
      {
        filePath: 'src/domain/syncAndExports.ts',
        requiredSubstrings: ['breederEmail', 'askingPriceCents'],
        rationale: 'JSON backup parser must preserve breeder contact info and animal asking prices.',
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: ['SQLITE_SCHEMA_VERSION', 'for_sale', 'asking_price_cents'],
        rationale: 'SQLite schema v7+ must persist and migrate For-Sale columns and contact settings atomically.',
      },
      {
        filePath: 'src/components/AnimalEditorModal.tsx',
        requiredSubstrings: ['askingPriceInput', 'saleNotes'],
        rationale: 'Animal editor must expose For-Sale toggle, asking price, and buyer-facing listing notes.',
      },
      {
        filePath: 'src/components/SettingsAndSyncScreen.tsx',
        requiredSubstrings: ['breederEmail', 'showcaseTagline'],
        rationale: 'Barn settings must expose public showcase contact info and catalog tagline.',
      },
      {
        filePath: 'src/components/HerdScreen.tsx',
        requiredSubstrings: ['For-Sale Catalog', 'generateBreederShowcaseHtml'],
        rationale: 'Herd screen must expose For-Sale filter pill and live PrintPreviewModal catalog toggles.',
      },
      {
        filePath: 'src/components/ImportExportHubScreen.tsx',
        requiredSubstrings: ['breeder-showcase-html'],
        rationale: 'Import/Export Hub must hydrate photos on Tier 2+ devices for breeder-showcase-html exports.',
      },
    ],
    restorePlaybook: [
      'Restore `BarnSettings` contact fields, `Animal` for-sale fields, and `isAnimalAvailableForSale` in `src/domain/models.ts`, plus `sanitizeSafeExternalHttpUrl` and sync field allowlists in `src/domain/inputSanitization.ts`.',
      'Restore `src/domain/breederShowcase.ts`, register `breeder-showcase-html` in `src/domain/exporters/registry.ts`, preserve JSON round-trip in `src/domain/syncAndExports.ts`, and retain SQLite schema v7 columns in `src/storage/webSqliteAdapter.ts`.',
      'Keep For-Sale controls in `AnimalEditorModal.tsx`, breeder contact settings in `SettingsAndSyncScreen.tsx`, For-Sale catalog preview/filter in `HerdScreen.tsx`, photo hydration in `ImportExportHubScreen.tsx`, and unit tests in `src/domain/__tests__/breederShowcase.test.ts`.',
    ],
  },
  {
    id: 'IMP-055',
    title: 'Health Reference Wiki Links, Local Veterinary PDF Folder Pointer & External Backup Reminders',
    category: 'species-ux',
    source: 'session',
    userIntent:
      'Provide curated online links to external rabbit and livestock health wikis alongside a simple local device folder pointer for personal offline veterinary PDFs, paired with periodic reminders to back up external document folders.',
    summary:
      'Adds a pure TypeScript curated health wiki index and reminder engine (`src/domain/healthReference.ts`) covering all 11 predefined species plus custom species substring resolution with strict `https://` URL sanitization (`sanitizeSafeExternalHttpUrl`); adds generic named directory-handle helpers in `src/storage/localSyncChannels.ts` reusing the existing `sync_handles` IDB store without bumping schema version; creates `src/storage/vetDocsFolder.ts` for read-only folder handle persistence, bounded depth/entry PDF scanning (`MAX_VET_PDF_SCAN_DEPTH = 2`, `MAX_VET_PDF_ENTRIES = 250`), path-note persistence, and configurable backup reminder cadence (`14/30/60/90` days + `7d` snooze); integrates full wipe/reset cleanup in `src/hooks/useBarnStore.ts`; builds lazy-loaded `HealthReferencePanel` & `HealthReferenceModal` with offline notice, disabled-with-explanation fallback on unsupported browsers (`IMP-019`), direct file-picker fallback, single-PDF `<iframe>` preview + `URL.revokeObjectURL` lifecycle cleanup; and wires periodic reminder banners and launchers into `App.tsx`, `SpeciesDashboardScreen.tsx`, `HerdScreen.tsx`, and `SettingsAndSyncScreen.tsx`.',
    files: [
      'src/domain/healthReference.ts',
      'src/storage/localSyncChannels.ts',
      'src/storage/vetDocsFolder.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/HealthReferencePanel.tsx',
      'src/App.tsx',
      'src/components/SpeciesDashboardScreen.tsx',
      'src/components/HerdScreen.tsx',
      'src/components/SettingsAndSyncScreen.tsx',
      'src/domain/__tests__/healthReference.test.ts',
      'src/storage/__tests__/vetDocsFolder.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/healthReference.ts',
        requiredSubstrings: [
          'HEALTH_WIKI_REFERENCES',
          'getHealthWikiLinksForSpecies',
          'evaluateVetDocsBackupReminder',
          'filterAndSortVetPdfEntries',
          'normalizeVetDocsFolderMeta',
        ],
        rationale:
          'Pure TypeScript health wiki directory and external PDF folder backup reminder evaluator must remain DOM-free and strict https:// validated.',
      },
      {
        filePath: 'src/storage/localSyncChannels.ts',
        requiredSubstrings: [
          'saveNamedDirectoryHandleToIdb',
          'loadNamedDirectoryHandleFromIdb',
          'deleteNamedDirectoryHandleFromIdb',
          'queryDirectoryHandleReadPermission',
        ],
        rationale:
          'Shared IDB sync_handles accessors allow vetDocsFolder persistence without bumping the IDB schema version.',
      },
      {
        filePath: 'src/storage/vetDocsFolder.ts',
        requiredSubstrings: [
          'VET_DOCS_HANDLE_KEY',
          'VET_DOCS_META_LS_KEY',
          'connectVetDocsFolder',
          'scanVetDocsDirectory',
          'markVetDocsBackedUpNow',
          'clearAllVetDocsFolderState',
        ],
        rationale:
          'Vet PDF folder adapter must persist read-only directory handles, scan PDFs safely, track backup acknowledgments, and support full factory reset cleanup.',
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ['clearAllVetDocsFolderState'],
        rationale: 'Factory reset and sync-state wipe flows must clear stored vet PDF handles and metadata.',
      },
      {
        filePath: 'src/components/HealthReferencePanel.tsx',
        requiredSubstrings: [
          'HealthReferencePanel',
          'HealthReferenceModal',
          'platformBridge.openExternalUrl',
          'URL.revokeObjectURL',
        ],
        rationale:
          'Lazy health reference modal must route external links through IPlatformBridge and deterministically revoke PDF blob URLs.',
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: [
          'HealthReferenceModal',
          'vetDocsReminder.showBanner',
          'onOpenHealthReference',
        ],
        rationale:
          'App shell must lazy-load HealthReferenceModal, surface periodic external PDF folder backup reminders, and pass launcher handlers to screens.',
      },
      {
        filePath: 'src/components/SpeciesDashboardScreen.tsx',
        requiredSubstrings: ['onOpenHealthReference'],
        rationale: 'Species Dashboard must expose quick Health Wikis & Vet PDFs launcher.',
      },
      {
        filePath: 'src/components/HerdScreen.tsx',
        requiredSubstrings: ['onOpenHealthReference'],
        rationale: 'Animal Health Journal must expose contextual Health Wikis & Vet PDFs launcher.',
      },
      {
        filePath: 'src/components/SettingsAndSyncScreen.tsx',
        requiredSubstrings: ['onOpenHealthReference'],
        rationale: 'Barn Settings must expose Health Reference Wikis & Local Vet PDF Folder launcher.',
      },
    ],
    restorePlaybook: [
      'Restore pure TypeScript wiki links, species matcher, and reminder math in `src/domain/healthReference.ts` and tests in `src/domain/__tests__/healthReference.test.ts`.',
      'Keep generic `saveNamedDirectoryHandleToIdb`/`loadNamedDirectoryHandleFromIdb`/`deleteNamedDirectoryHandleFromIdb` in `src/storage/localSyncChannels.ts` and restore `src/storage/vetDocsFolder.ts` + `src/storage/__tests__/vetDocsFolder.test.ts`.',
      'Keep `clearAllVetDocsFolderState()` cleanup in `src/hooks/useBarnStore.ts`, lazy `HealthReferenceModal` + reminder banner in `src/App.tsx`, and `onOpenHealthReference` launchers in `SpeciesDashboardScreen.tsx`, `HerdScreen.tsx`, and `SettingsAndSyncScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-056',
    title: 'Restricted Health Wiki Article Sources Blocklist (House Rabbit Society & Custom Rules)',
    category: 'species-ux',
    source: 'session',
    userIntent:
      'Maintain a restricted sources list for health wiki article connections starting with House Rabbit Society.',
    summary:
      'Removes House Rabbit Society (`rabbit.org`) from curated health wiki links and introduces a pure TypeScript restricted wiki sources engine (`DEFAULT_RESTRICTED_WIKI_SOURCES`, `findMatchingRestrictedWikiSource`, `isHealthWikiSourceRestricted`, `filterAllowedHealthWikiReferences`, `normalizeRestrictedWikiSources`) in `src/domain/healthReference.ts`; persists user-added custom restricted sources in `localStorage` via `src/storage/vetDocsFolder.ts` while keeping built-in restrictions locked; enforces click-time blocking and exposes a collapsible Restricted Wiki Sources manager inside `src/components/HealthReferencePanel.tsx`.',
    files: [
      'src/domain/healthReference.ts',
      'src/storage/vetDocsFolder.ts',
      'src/components/HealthReferencePanel.tsx',
      'src/domain/__tests__/healthReference.test.ts',
      'src/storage/__tests__/vetDocsFolder.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/healthReference.ts',
        requiredSubstrings: [
          'DEFAULT_RESTRICTED_WIKI_SOURCES',
          'restricted-house-rabbit-society',
          'findMatchingRestrictedWikiSource',
          'filterAllowedHealthWikiReferences',
          'normalizeRestrictedWikiSources',
        ],
        forbiddenSubstrings: ['wiki-rabbit-hrs'],
        rationale:
          'House Rabbit Society must remain on the built-in restricted wiki sources list and excluded from curated health wiki links.',
      },
      {
        filePath: 'src/storage/vetDocsFolder.ts',
        requiredSubstrings: [
          'RESTRICTED_WIKI_SOURCES_LS_KEY',
          'readRestrictedWikiSources',
          'addCustomRestrictedWikiSource',
          'removeCustomRestrictedWikiSource',
        ],
        rationale:
          'Custom restricted wiki sources must persist locally without allowing built-in restricted entries to be deleted.',
      },
      {
        filePath: 'src/components/HealthReferencePanel.tsx',
        requiredSubstrings: [
          'Restricted Wiki Sources',
          'findMatchingRestrictedWikiSource',
          'handleAddRestrictedSource',
        ],
        rationale:
          'Health Reference panel must enforce restricted source checks at click time and let users view/manage restricted sources.',
      },
    ],
    restorePlaybook: [
      'Restore `DEFAULT_RESTRICTED_WIKI_SOURCES` (with `House Rabbit Society` / `rabbit.org`), `findMatchingRestrictedWikiSource`, and `filterAllowedHealthWikiReferences` in `src/domain/healthReference.ts`.',
      'Restore `readRestrictedWikiSources`, `addCustomRestrictedWikiSource`, and `removeCustomRestrictedWikiSource` in `src/storage/vetDocsFolder.ts`.',
      'Restore the click-time `findMatchingRestrictedWikiSource` guard and collapsible `Restricted Wiki Sources` manager in `src/components/HealthReferencePanel.tsx`.',
    ],
  },
  {
    id: 'IMP-057',
    title: 'Preferred Wiki Sources, English USA (en-US) App Locale & Multi-Language Wiki Filter',
    category: 'species-ux',
    source: 'session',
    userIntent:
      'Create a preferred sources list for health wiki links (Merck Veterinary Manual, USDA & equivalent federal agencies in all countries, and state/federal/land-grant universities in all countries), define the app locale as English USA (en-US), and require English wiki sources via an extensible multi-language array.',
    summary:
      'Defines `APP_LOCALE = \'en-US\'` (`APP_LOCALE_METADATA`, `normalizeBcp47LanguageTag`, `extractBaseLanguageCode`) in `src/domain/models.ts` and updates `index.html` + `vite.config.ts` PWA manifest to `en-US`; adds `DEFAULT_PREFERRED_WIKI_SOURCES` (`Merck Veterinary Manual`, global federal ag/vet agencies, and global state/federal/land-grant universities), `DEFAULT_ALLOWED_WIKI_LANGUAGES = [\'en\']`, `doesWikiLanguageMatchAllowed`, `normalizeAllowedWikiLanguages`, `findMatchingPreferredWikiSource`, and `sortHealthWikiReferencesWithPreferred` in `src/domain/healthReference.ts`; persists custom preferred sources and multi-language arrays in `src/storage/vetDocsFolder.ts`; and renders preferred source prioritization and management inside `src/components/HealthReferencePanel.tsx`.',
    files: [
      'src/domain/models.ts',
      'index.html',
      'vite.config.ts',
      'src/domain/healthReference.ts',
      'src/storage/vetDocsFolder.ts',
      'src/components/HealthReferencePanel.tsx',
      'src/domain/__tests__/healthReference.test.ts',
      'src/storage/__tests__/vetDocsFolder.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/models.ts',
        requiredSubstrings: [
          "APP_LOCALE = 'en-US'",
          'APP_LOCALE_METADATA',
          'normalizeBcp47LanguageTag',
          'extractBaseLanguageCode',
        ],
        rationale:
          'Application code and translation baseline must remain explicitly typed as English (United States) `en-US`.',
      },
      {
        filePath: 'index.html',
        requiredSubstrings: ['<html lang="en-US">'],
        rationale: 'Root HTML document language must declare English USA (`en-US`).',
      },
      {
        filePath: 'vite.config.ts',
        requiredSubstrings: ["lang: 'en-US'"],
        rationale: 'PWA web app manifest must declare `lang: "en-US"`.',
      },
      {
        filePath: 'src/domain/healthReference.ts',
        requiredSubstrings: [
          'DEFAULT_PREFERRED_WIKI_SOURCES',
          'DEFAULT_ALLOWED_WIKI_LANGUAGES',
          'doesWikiLanguageMatchAllowed',
          'normalizeAllowedWikiLanguages',
          'findMatchingPreferredWikiSource',
          'sortHealthWikiReferencesWithPreferred',
        ],
        rationale:
          'Preferred sources (Merck, global federal ag/vet agencies, global universities) and configurable multi-language English filtering must remain intact.',
      },
      {
        filePath: 'src/storage/vetDocsFolder.ts',
        requiredSubstrings: [
          'PREFERRED_WIKI_SOURCES_LS_KEY',
          'ALLOWED_WIKI_LANGUAGES_LS_KEY',
          'readPreferredWikiSources',
          'readAllowedWikiLanguages',
          'setAllowedWikiLanguages',
        ],
        rationale:
          'Custom preferred wiki sources and multi-language wiki filters must persist locally with built-in locking.',
      },
      {
        filePath: 'src/components/HealthReferencePanel.tsx',
        requiredSubstrings: [
          'Preferred Wiki Sources',
          'findMatchingPreferredWikiSource',
          'handleAddPreferredSource',
          'APP_LOCALE',
        ],
        rationale:
          'Health Reference panel must surface preferred source badges, language requirements, and preferred source management.',
      },
    ],
    restorePlaybook: [
      'Restore `APP_LOCALE = \'en-US\'` and BCP 47 helpers in `src/domain/models.ts`, `<html lang="en-US">` in `index.html`, and `lang: \'en-US\'` in `vite.config.ts`.',
      'Restore `DEFAULT_PREFERRED_WIKI_SOURCES`, `DEFAULT_ALLOWED_WIKI_LANGUAGES`, and language/preferred matching + sorting in `src/domain/healthReference.ts`.',
      'Restore `readPreferredWikiSources`/`readAllowedWikiLanguages`/`setAllowedWikiLanguages` in `src/storage/vetDocsFolder.ts` and UI controls in `src/components/HealthReferencePanel.tsx`.',
    ],
  },
  {
    id: 'IMP-058',
    title: 'Breeding Calendar Moon/Holiday/Weather Overlays, Mileage & Tax Report Log & Personal Barn Journal',
    category: 'species-ux',
    source: 'session',
    userIntent:
      'Add offline moon-phase and holiday markers plus an optional online 7-day weather forecast strip to the Breeding Calendar, track IRS-deductible farm/show mileage with annual tax reports, and add a date-organized Personal Barn Journal with rich text notes, color categories, star ratings, and full-text search.',
    summary:
      'Introduces pure TypeScript `src/domain/breedingCalendar.ts` (synodic moon-phase engine, Gregorian Easter & US/seasonal holiday calculator, monthly calendar grid builder, WMO code mapping) paired with strictly opt-in Open-Meteo client `src/storage/weatherForecast.ts` and `src/components/BreedingCalendarPanel.tsx` inside `BreedingScreen.tsx`; creates `src/domain/mileageTaxLog.ts` (IRS standard mileage presets, integer-cent deduction calculations, formula-safe CSV and XSS-safe annual tax HTML) with `src/components/MileageTaxPanel.tsx` inside `EconomicsLedgerScreen.tsx`; builds `src/domain/barnJournal.ts` (rich-text AST notes via `parseMemoBlocks`, color categories, 0–5 star ratings, pinning, `#tag` hygiene, multi-token full-text search, Markdown/CSV/Print exports) and `src/components/BarnJournalScreen.tsx` at route `journal`; and persists `mileage_logs`, `journal_entries`, and `weatherForecast` settings across SQLite schema v8 (`webSqliteAdapter.ts`), JSON v5/ZIP exports, sample-data purging, cross-species migration, and delta sync outbox (`IMP-025`).',
    files: [
      'src/domain/models.ts',
      'src/domain/breedingCalendar.ts',
      'src/domain/mileageTaxLog.ts',
      'src/domain/barnJournal.ts',
      'src/storage/weatherForecast.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/BreedingCalendarPanel.tsx',
      'src/components/MileageTaxPanel.tsx',
      'src/components/BarnJournalScreen.tsx',
      'src/components/BreedingScreen.tsx',
      'src/components/EconomicsLedgerScreen.tsx',
      'src/components/SpeciesDashboardScreen.tsx',
      'src/App.tsx',
      'src/domain/__tests__/breedingCalendar.test.ts',
      'src/domain/__tests__/mileageTaxLog.test.ts',
      'src/domain/__tests__/barnJournal.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/breedingCalendar.ts',
        requiredSubstrings: [
          'computeMoonPhaseForDateIso',
          'getHolidaysForYear',
          'buildBreedingCalendarMonth',
          'formatTemperatureForUnit',
        ],
        rationale:
          'Pure TypeScript moon-phase, holiday, and monthly calendar computation must stay DOM-free and UTC-deterministic.',
      },
      {
        filePath: 'src/storage/weatherForecast.ts',
        requiredSubstrings: [
          'searchWeatherLocations',
          'fetchWeeklyWeatherForecast',
          'clearWeatherForecastCache',
        ],
        rationale:
          'Optional Open-Meteo 7-day forecast client must respect connectivity checks, cache TTL, and reset clearing.',
      },
      {
        filePath: 'src/domain/mileageTaxLog.ts',
        requiredSubstrings: [
          'computeMileageLogDeductionCents',
          'evaluateAnnualMileageTaxSummary',
          'exportMileageTaxCsv',
          'generateAnnualMileageTaxHtml',
        ],
        rationale:
          'IRS mileage tax deduction calculations and formula/HTML-escaped annual exports must remain pure TypeScript.',
      },
      {
        filePath: 'src/domain/barnJournal.ts',
        requiredSubstrings: [
          'normalizeBarnJournalEntry',
          'filterAndSearchJournalEntries',
          'groupJournalEntriesByMonthAndDate',
          'exportBarnJournalMarkdown',
          'generateBarnJournalHtml',
        ],
        rationale:
          'Personal Barn Journal search, grouping, tag normalization, and exports must remain DOM-free and AST-sanitized.',
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: [
          'SQLITE_SCHEMA_VERSION',
          'mileage_logs',
          'journal_entries',
        ],
        rationale:
          'SQLite schema must create and migrate mileage_logs and journal_entries tables atomically.',
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ['saveMileageLog', 'deleteMileageLog', 'saveJournalEntry', 'deleteJournalEntry'],
        rationale: 'Store must expose persisted CRUD mutators for mileage logs and journal entries.',
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: ['BarnJournalScreen', "route === 'journal'"],
        rationale: 'App router must lazy-load and mount BarnJournalScreen at route journal.',
      },
    ],
    restorePlaybook: [
      'Restore types (`MileageLog`, `BarnJournalEntry`, `WeatherForecastSettings`) in `src/domain/models.ts` plus pure engines `breedingCalendar.ts`, `mileageTaxLog.ts`, and `barnJournal.ts`.',
      'Restore `src/storage/weatherForecast.ts`, SQLite schema v8 (`mileage_logs`, `journal_entries`) in `webSqliteAdapter.ts`, and CRUD actions in `useBarnStore.ts`.',
      'Restore `BreedingCalendarPanel.tsx` in `BreedingScreen.tsx`, `MileageTaxPanel.tsx` in `EconomicsLedgerScreen.tsx`, and `BarnJournalScreen.tsx` at route `journal` in `App.tsx`.',
    ],
  },
  {
    id: 'IMP-059',
    title: "The Judge's Notebook (Dedicated Show Judge Module)",
    category: 'species-ux',
    source: 'session',
    userIntent:
      'Add an optional module for show judges to manage assigned show dates, club contacts, travel mileage, judging expenses, bid statuses, and judging contracts.',
    summary:
      "Introduces optional show-judge models (`enableJudgeNotebook`, `JudgeClubContact`, `JudgeAssignment`, `JudgeExpense`) in `src/domain/models.ts`; implements pure TypeScript DOM-free engine `src/domain/judgeNotebook.ts` (normalizers, draft factories, double-booking date conflict detection, `MileageLog`-integrated financials & reimbursements, annual summary, formula-safe CSV exports, and XSS-escaped printable HTML Judging Agreements & Annual Summary Reports); persists `judge_clubs`, `judge_assignments`, and `judge_expenses` tables across SQLite schema v9 (`webSqliteAdapter.ts`), JSON/ZIP backups, delta sync outbox, sample-data purging, species migration, and health repair; exposes store CRUD actions in `src/hooks/useBarnStore.ts`; and renders opt-in `src/components/JudgeNotebookScreen.tsx` at route `judge` (`G` shortcut) with dashboard and Settings toggles.",
    files: [
      'src/domain/models.ts',
      'src/domain/judgeNotebook.ts',
      'src/storage/storageAdapter.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/domain/syncOutbox.ts',
      'src/domain/inputSanitization.ts',
      'src/domain/syncAndExports.ts',
      'src/domain/backupArchive.ts',
      'src/domain/backupStatus.ts',
      'src/domain/backupVault.ts',
      'src/domain/sampleData.ts',
      'src/domain/speciesMigration.ts',
      'src/domain/dataHealthCheck.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/JudgeNotebookScreen.tsx',
      'src/components/SettingsAndSyncScreen.tsx',
      'src/components/SpeciesDashboardScreen.tsx',
      'src/App.tsx',
      'src/domain/__tests__/judgeNotebook.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/models.ts',
        requiredSubstrings: [
          'enableJudgeNotebook?: boolean',
          'JudgeClubContact',
          'JudgeAssignment',
          'JudgeExpense',
        ],
        rationale:
          'BarnSettings must preserve the optional enableJudgeNotebook flag alongside Judge domain interfaces.',
      },
      {
        filePath: 'src/domain/judgeNotebook.ts',
        requiredSubstrings: [
          'detectJudgeDateConflicts',
          'evaluateJudgeAssignmentFinancials',
          'summarizeJudgeNotebook',
          'exportJudgeAssignmentsCsv',
          'generateJudgeContractHtml',
          'generateJudgeSummaryReportHtml',
        ],
        rationale:
          'Pure TypeScript Judge Notebook conflict checks, mileage/expense calculations, CSV exports, and XSS-safe HTML contracts must remain DOM-free.',
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: [
          'SQLITE_SCHEMA_VERSION = 9',
          'judge_clubs',
          'judge_assignments',
          'judge_expenses',
          'enableJudgeNotebook',
        ],
        rationale:
          'SQLite schema v9 must create, migrate, and persist judge_clubs, judge_assignments, judge_expenses, and enableJudgeNotebook.',
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: [
          'saveJudgeClub',
          'deleteJudgeClub',
          'saveJudgeAssignment',
          'deleteJudgeAssignment',
          'saveJudgeExpense',
          'deleteJudgeExpense',
        ],
        rationale:
          'Store must expose outbox-tracked CRUD mutators for Judge clubs, assignments, and expenses.',
      },
      {
        filePath: 'src/components/JudgeNotebookScreen.tsx',
        requiredSubstrings: [
          'JudgeNotebookScreen',
          'detectJudgeDateConflicts',
          'generateJudgeContractHtml',
          'PrintPreviewModal',
        ],
        rationale:
          "JudgeNotebookScreen must provide the opt-in gate, conflict alerts, financial tabs, and printable contract preview.",
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: ['JudgeNotebookScreen', "route === 'judge'"],
        rationale: "App router must lazy-load and mount JudgeNotebookScreen at route 'judge'.",
      },
    ],
    restorePlaybook: [
      'Restore Judge types and `enableJudgeNotebook` in `src/domain/models.ts` plus pure engine `src/domain/judgeNotebook.ts`.',
      'Restore SQLite schema v9 tables (`judge_clubs`, `judge_assignments`, `judge_expenses`) in `webSqliteAdapter.ts` and sync/export wiring.',
      'Restore CRUD methods in `useBarnStore.ts`, `JudgeNotebookScreen.tsx`, Settings toggle, Dashboard launcher, and route `judge` in `App.tsx`.',
    ],
  },
  {
    id: 'IMP-060',
    title: 'Optional Cloud App-Folder Sync (Google Drive AppFolder / OneDrive AppRoot) & 403/507 Quota Circuit Breaker',
    category: 'diagnostics-sync',
    source: 'session',
    summary:
      'Adds strictly opt-in personal cloud sync (`enabled: false` by default, zero Firebase, zero `.env` secrets) targeting isolated Google Drive `appDataFolder` and OneDrive `special/approot` directories using memory-only OAuth tokens and PKCE; plans incremental delta chunks that automatically downshift to tight-storage chunking (`25 ops / 48 KiB`) when storage usage or device tier is constrained; and intercepts HTTP 403/507 quota responses with an immediate persistent circuit breaker that pauses automated cloud syncs, prunes oldest rolling cloud backups, surfaces persistent banners in `App.tsx` and Sync panels, and never blocks or rolls back local IndexedDB writes.',
    userIntent:
      'Support strictly optional app-folder cloud delta sync with tight-storage incremental chunking and an immediate 403/507 quota circuit breaker that protects local IndexedDB writes.',
    files: [
      'src/domain/cloudAppFolderSync.ts',
      'src/storage/cloudAppFolderSync.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/CloudAppFolderSyncPanel.tsx',
      'src/components/ImportExportHubScreen.tsx',
      'src/components/SettingsAndSyncScreen.tsx',
      'src/App.tsx',
      'src/domain/__tests__/cloudAppFolderSync.test.ts',
      'src/storage/__tests__/cloudAppFolderSync.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/cloudAppFolderSync.ts',
        requiredSubstrings: [
          'planIncrementalCloudDeltaChunks',
          'classifyCloudHttpResponse',
          'tripCloudQuotaCircuitBreaker',
          'selectRollingCloudBackupsToPrune',
          'shouldRunAutomatedCloudSync',
        ],
        rationale:
          'Pure TypeScript incremental delta chunk planner, HTTP 403/507 classifier, circuit breaker state machine, and rolling backup pruner must remain DOM-free.',
      },
      {
        filePath: 'src/storage/cloudAppFolderSync.ts',
        requiredSubstrings: [
          'memoryTokensByProvider',
          'createGoogleDriveAppFolderTransport',
          'createOneDriveAppRootTransport',
          'runCloudAppFolderSync',
        ],
        rationale:
          'Cloud app-folder transport must keep OAuth tokens strictly in JS memory, isolate appDataFolder/approot, and never block or roll back local IndexedDB writes.',
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: [
          'executeCloudAppFolderSync',
          'scheduleBackgroundCloudSync',
          'resetAndRetryCloudSync',
          'dismissCloudCircuitBreakerWarning',
        ],
        rationale:
          'Store must schedule non-blocking background cloud delta sync after outbox commits and expose manual sync, reset-and-retry, and warning dismissal controls.',
      },
      {
        filePath: 'src/components/CloudAppFolderSyncPanel.tsx',
        requiredSubstrings: [
          'CloudAppFolderSyncPanel',
          'Reset Circuit Breaker',
          'Sync Cloud App-Folder Now',
        ],
        rationale:
          'Cloud App-Folder Sync panel must provide opt-in provider/token controls, tight-storage chunk indicators, and circuit breaker reset actions.',
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: [
          'store.cloudSyncState.circuitBreaker.tripped',
          'store.dismissCloudCircuitBreakerWarning',
          'cloudSyncState={store.cloudSyncState}',
        ],
        rationale:
          'App shell must display the persistent global 403/507 quota circuit breaker warning banner and wire cloud sync state into ImportExportHubScreen and SettingsAndSyncScreen.',
      },
    ],
    restorePlaybook: [
      'Restore pure chunking, HTTP 403/507 classification, and circuit breaker state helpers in `src/domain/cloudAppFolderSync.ts`.',
      'Restore memory-only OAuth token store, Google Drive/OneDrive transports, and cross-tab-locked coordinator in `src/storage/cloudAppFolderSync.ts`.',
      'Restore non-blocking `scheduleBackgroundCloudSync`, `CloudAppFolderSyncPanel.tsx`, and global persistent circuit breaker warning banner in `useBarnStore.ts`, `ImportExportHubScreen.tsx`, `SettingsAndSyncScreen.tsx`, and `App.tsx`.',
    ],
  },
  {
    id: 'IMP-061',
    title: 'Developer Console Tabbed Reorganization, Collapsible Subunits & OPFS/Runtime Telemetry',
    category: 'diagnostics-sync',
    source: 'session',
    summary:
      'Reorganizes "The Techy Stuff" (`TechyStuffScreen.tsx`) with an always-open title header containing an "Open All Sections / Collapse All Sections" toggle, 4 segmented workspace tabs (`Storage & OPFS`, `Runtime & Sync`, `Logs & Support`, `Maintenance & Resets`), and 15 individually collapsible subunits (`createDefaultSubunitOpenMap(false)` — including the host telemetry bar, the permanent non-closeable 5-tier comparison matrix `data-permanent-tier-hierarchy="true"`, and modular `DiagnosticsAndSupportPanel` `visibleSections` + `collapsible` cards). Surfaces previously unexposed storage and runtime utilities: read-only OPFS `/tmp`/`/backups`/`/archives` inspector (`inspectOpfsNamespaces`), OPFS canary & orphan sweep controls, Prior-Use Sentinel & prune sync warning status, 20-collection `computeSnapshotCollectionFootprint`, 14-signal browser compatibility matrix, idle Archive Worker heap reclaim, live IDB/BroadcastChannel/WebLocks/OPFS handle counters (`getTrackedActiveResourceCounts`, `getActiveOpfsHandleCount`), Freeze Queue controls, clock skew causality & release manifest diff, Sync Outbox/Cloud breaker status, and Native Bridge event log.',
    userIntent:
      'Optimize the developer page, identify and surface unadded useful internal tools, organize the workspace into clean tabbed and collapsible subunits with a header Open All toggle to improve UI/UX.',
    files: [
      'src/domain/techyStuffGuardrails.ts',
      'src/domain/__tests__/techyStuffGuardrails.test.ts',
      'src/storage/storageProbes.ts',
      'src/storage/opfsTempStream.ts',
      'src/storage/opfsStorage.ts',
      'src/components/DiagnosticsAndSupportPanel.tsx',
      'src/components/TechyStuffScreen.tsx',
      'src/App.tsx',
    ],
    invariants: [
      {
        filePath: 'src/domain/techyStuffGuardrails.ts',
        requiredSubstrings: [
          'DEVELOPER_CONSOLE_TABS',
          'DEVELOPER_CONSOLE_SUBUNIT_IDS',
          'createDefaultSubunitOpenMap',
          'normalizeDeveloperConsoleTab',
          'computeSnapshotCollectionFootprint',
        ],
        rationale:
          'Pure TypeScript developer console tab registry, 15-subunit collapsible state helpers, and 20-collection snapshot footprint calculator must remain DOM-free.',
      },
      {
        filePath: 'src/storage/storageProbes.ts',
        requiredSubstrings: ['getTrackedActiveResourceCounts'],
        rationale:
          'Storage probes must expose live IDB connection/transaction, BroadcastChannel, and Web Lock resource counts for runtime inspection.',
      },
      {
        filePath: 'src/storage/opfsStorage.ts',
        requiredSubstrings: [
          'inspectOpfsNamespaces',
          'getActiveOpfsHandleCount',
          'getActiveTempFiles',
        ],
        rationale:
          'OPFS storage adapter must expose read-only namespace inspection across /tmp, /backups, and /archives alongside live OPFS handle counters.',
      },
      {
        filePath: 'src/components/DiagnosticsAndSupportPanel.tsx',
        requiredSubstrings: ['visibleSections', 'collapsible'],
        rationale:
          'DiagnosticsAndSupportPanel must support section filtering (`all`, `logs-and-support`, `maintenance`) and optional collapsible outer wrapping without breaking standalone rendering.',
      },
      {
        filePath: 'src/components/TechyStuffScreen.tsx',
        requiredSubstrings: [
          'DEVELOPER_CONSOLE_TABS',
          'DEVELOPER_CONSOLE_SUBUNIT_IDS',
          'createDefaultSubunitOpenMap',
          'Open All Sections',
          'inspectOpfsNamespaces',
          'computeSnapshotCollectionFootprint',
          'detectCurrentBrowserCompatibility',
          'getTrackedActiveResourceCounts',
        ],
        rationale:
          'TechyStuffScreen must keep the title header open with an Open All Sections toggle, make all 15 subunits collapsible, and surface OPFS inspection, snapshot footprint, browser compatibility matrix, and live handle telemetry.',
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: [
          'syncOperations={store.syncOperations}',
          'backupSyncStatus={store.backupSyncStatus}',
        ],
        rationale:
          'App shell must pass live sync outbox operations and backup sync folder status into TechyStuffScreen.',
      },
    ],
    restorePlaybook: [
      'Restore `DEVELOPER_CONSOLE_TABS`, `DEVELOPER_CONSOLE_SUBUNIT_IDS`, `createDefaultSubunitOpenMap`, `normalizeDeveloperConsoleTab`, and `computeSnapshotCollectionFootprint` in `src/domain/techyStuffGuardrails.ts`.',
      'Restore `getTrackedActiveResourceCounts` in `src/storage/storageProbes.ts`, plus `getActiveOpfsHandleCount`, `getActiveTempFiles`, and `inspectOpfsNamespaces` in `src/storage/opfsTempStream.ts` and `src/storage/opfsStorage.ts`.',
      'Restore `visibleSections` and `collapsible` props in `src/components/DiagnosticsAndSupportPanel.tsx`, the collapsible 15-subunit tabbed workspace layout + header Open All toggle + telemetry cards in `src/components/TechyStuffScreen.tsx`, and live sync props in `src/App.tsx`.',
    ],
  },
  {
    id: 'IMP-062',
    title: 'Alpha-to-Release Optimization: CI & Android APK Hardening, IndexedDB Quota Recovery, Print Stage XSS Sanitization & Sub-500kB Bundle Splits',
    category: 'stability-pwa',
    source: 'session',
    userIntent:
      'Prepare Community Pedigree from Alpha to release with zero new features by fixing highest-risk CI, storage, security, and cold-start bundle bottlenecks while guaranteeing bootability.',
    summary:
      'Restores clean `.env.example` (IMP-008/IMP-052); scopes `NODE_ENV: production` strictly to the Vite build step in `.github/workflows/build-android-apk.yml` so `npm install` never skips `devDependencies` (`vitest`, `tsx`, `typescript`, `vite-plugin-pwa`); adds `status.json` to Android `PedigreeAssetPathHandler.kt` `Cache-Control: no-cache`; implements `executeIdbWriteWithQuotaRecovery` in `src/storage/webSqliteAdapter.ts` to purge OPFS `/tmp` and non-essential fallback caches and retry once on `QuotaExceededError`; hardens `#barn-print-stage` in `src/components/PrintPreviewModal.tsx` with `sanitizePrintStageHtml` + DOM node/attribute scrubbing; decouples `src/domain/backupVault.ts` from `backupArchive.ts` via direct `./binaryEncoding` imports (eliminating Vite `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings); converts cold imports (`geneticsEngine`, `syncAndExports`, `weatherForecast`) in `src/hooks/useBarnStore.ts` and `improvementRegistry` (~206 kB) in `src/components/DiagnosticsAndSupportPanel.tsx` to on-demand dynamic imports; and refines Rolldown `codeSplitting` groups with `includeDependenciesRecursively: false` in `vite.config.ts`, cutting `index-*.js` from 645 kB to 350 kB (-45.8%) and `TechyStuffScreen` from 339 kB to 136 kB (-59.9%) with zero Vite >500 kB chunk warnings.',
    files: [
      '.env.example',
      '.github/workflows/build-android-apk.yml',
      'android-wrapper/app/src/main/java/org/askkim/pedigree/wrapper/PedigreeAssetPathHandler.kt',
      'src/storage/webSqliteAdapter.ts',
      'src/components/PrintPreviewModal.tsx',
      'src/domain/backupVault.ts',
      'src/hooks/useBarnStore.ts',
      'src/components/DiagnosticsAndSupportPanel.tsx',
      'vite.config.ts',
      'src/utils/__tests__/printPreviewHelpers.test.ts',
      'src/domain/__tests__/releaseReadiness.test.ts',
    ],
    invariants: [
      {
        filePath: '.github/workflows/build-android-apk.yml',
        requiredSubstrings: [
          'Install PWA dependencies & run verification suite',
          'Build production PWA bundle (root path)',
          'NODE_ENV: production',
        ],
        rationale:
          'Android APK CI must install devDependencies without NODE_ENV=production and apply NODE_ENV=production strictly to the Vite production build step.',
      },
      {
        filePath:
          'android-wrapper/app/src/main/java/org/askkim/pedigree/wrapper/PedigreeAssetPathHandler.kt',
        requiredSubstrings: ['resolvedPath == "status.json"'],
        rationale:
          'Android WebView asset handler must serve status.json with Cache-Control: no-cache alongside version.json.',
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: ['executeIdbWriteWithQuotaRecovery', 'purgeOpfsTmp'],
        rationale:
          'Primary IndexedDB writes must catch QuotaExceededError, purge OPFS /tmp and non-essential fallback caches, and retry once before failing.',
      },
      {
        filePath: 'src/components/PrintPreviewModal.tsx',
        requiredSubstrings: ['sanitizePrintStageHtml'],
        rationale:
          'Print stage DOM mounting must strip executable tags, inline event handlers, and dangerous URLs before inserting HTML into #barn-print-stage.',
      },
      {
        filePath: 'src/domain/backupVault.ts',
        requiredSubstrings: ["from './binaryEncoding'"],
        rationale:
          'backupVault.ts must import binary encoding helpers directly from binaryEncoding.ts instead of pulling backupArchive.ts into the startup graph.',
      },
      {
        filePath: 'src/components/DiagnosticsAndSupportPanel.tsx',
        requiredSubstrings: ['loadImprovementRegistryModule', "import('../domain/improvementRegistry')"],
        rationale:
          'DiagnosticsAndSupportPanel must lazy-load the 200+ kB improvementRegistry manifest on demand instead of bloating TechyStuffScreen.',
      },
      {
        filePath: 'vite.config.ts',
        requiredSubstrings: [
          'storage-sqlite',
          'core-backups',
          'improvement-registry',
          'includeDependenciesRecursively: false',
        ],
        rationale:
          'Rolldown codeSplitting must isolate app storage, backup, domain, and registry chunks with includeDependenciesRecursively: false so no chunk exceeds 500 kB.',
      },
    ],
    restorePlaybook: [
      'Keep `.env.example` clean, keep `NODE_ENV: production` scoped only to `npm run build` in `.github/workflows/build-android-apk.yml`, and preserve `resolvedPath == "status.json"` no-cache handling in `PedigreeAssetPathHandler.kt`.',
      'Preserve `executeIdbWriteWithQuotaRecovery` in `src/storage/webSqliteAdapter.ts` and `sanitizePrintStageHtml` in `src/components/PrintPreviewModal.tsx`.',
      'Keep `backupVault.ts` importing from `./binaryEncoding`, keep dynamic imports of `geneticsEngine`, `syncAndExports`, and `weatherForecast` in `src/hooks/useBarnStore.ts`, keep lazy `loadImprovementRegistryModule` in `DiagnosticsAndSupportPanel.tsx`, and retain isolated Rolldown `codeSplitting` groups in `vite.config.ts`.',
    ],
  },
  {
    id: 'IMP-063',
    title: 'Mobile Chrome Dev Preview Boot Memory Guard: Inline Sourcemap Stripping, Direct Lucide Icon ESM & Lazy Error-Boundary Export',
    category: 'stability-pwa',
    source: 'session',
    userIntent:
      'Fix mobile Chrome Preview iframe Aw Snap crashes on startup by eliminating excessive dev-mode JS parse memory and inline source map bloat.',
    summary:
      'Adds dev-only `devInlineSourcemapStripPlugin` (stripping ~9.5 MB of base64 inline sourcemaps from served JS/CSS responses) and `devLucideDirectImportPlugin` + `optimizeDeps.exclude: [\'lucide-react\']` (rewriting `lucide-react` barrel imports to direct per-icon ESM files and eliminating the 3.72 MB monolithic icon bundle and 504 dep re-optimization errors) in `vite.config.ts`, while deferring `syncAndExports` imports in `CrashErrorBoundary.tsx` and `TechyStuffErrorBoundary.tsx` to click handlers—cutting dev boot payload from 13.52 MB to 3.05 MB (-77.4%) with zero production build changes.',
    files: [
      'vite.config.ts',
      'src/components/CrashErrorBoundary.tsx',
      'src/components/TechyStuffErrorBoundary.tsx',
    ],
    invariants: [
      {
        filePath: 'vite.config.ts',
        requiredSubstrings: [
          'devInlineSourcemapStripPlugin',
          'devLucideDirectImportPlugin',
          "exclude: ['lucide-react']",
        ],
        rationale:
          'Dev preview must strip multi-megabyte base64 inline sourcemaps and resolve lucide-react icons directly without pre-bundling all 1,600+ icons so mobile Chrome preview iframes do not OOM.',
      },
      {
        filePath: 'src/components/CrashErrorBoundary.tsx',
        requiredSubstrings: ["import('../domain/syncAndExports')"],
        forbiddenSubstrings: ["from '../domain/syncAndExports'"],
        rationale:
          'CrashErrorBoundary mounts at root and must load formatTimestampedBackupSlug dynamically on click rather than eagerly pulling syncAndExports into startup.',
      },
      {
        filePath: 'src/components/TechyStuffErrorBoundary.tsx',
        requiredSubstrings: ["import('../domain/syncAndExports')"],
        forbiddenSubstrings: ["from '../domain/syncAndExports'"],
        rationale:
          'TechyStuffErrorBoundary mounts in App.tsx and must load formatTimestampedBackupSlug dynamically on click rather than eagerly pulling syncAndExports into startup.',
      },
    ],
    restorePlaybook: [
      'Keep `devLucideDirectImportPlugin()`, `devInlineSourcemapStripPlugin()`, and `optimizeDeps.exclude: [\'lucide-react\']` in `vite.config.ts`.',
      'Keep dynamic `import(\'../domain/syncAndExports\')` inside crash log download handlers in `CrashErrorBoundary.tsx` and `TechyStuffErrorBoundary.tsx`.',
    ],
  },
  {
    id: 'IMP-064',
    title: 'GitHub Pages Deployment, Subpath Routing & Search Engine Optimization (SEO)',
    category: 'ci-tooling',
    source: 'session',
    userIntent:
      'Optimize all GitHub Pages for utility, setup, social preview cards, and search engine discoverability.',
    summary:
      'Enhances GitHub Pages delivery and SEO discovery: configures GitHub repository description, homepage URL, and 16 topics; optimizes index.html with keyword-rich meta tags, canonical link, Open Graph preview tags, Twitter summary card, and Schema.org WebApplication structured data; creates public/robots.txt, public/sitemap.xml, and public/404.html SPA router fallback; updates deploy-pages.yml to trigger on both main and release branches while verifying robots.txt, sitemap.xml, and 404.html in distribution; and adds GitHub Pages status badges and direct web app launch links to README.md and package.json.',
    files: [
      'index.html',
      'public/robots.txt',
      'public/sitemap.xml',
      'public/404.html',
      '.github/workflows/deploy-pages.yml',
      'README.md',
      'package.json',
    ],
    invariants: [
      {
        filePath: 'index.html',
        requiredSubstrings: [
          'https://askkim.github.io/Pedigree/',
          'application/ld+json',
          'og:image',
          'twitter:card',
          'rel="canonical"',
        ],
        rationale:
          'index.html must maintain canonical, OpenGraph, Twitter card, and Schema.org structured data for SEO.',
      },
      {
        filePath: 'public/robots.txt',
        requiredSubstrings: ['User-agent: *', 'Sitemap: https://askkim.github.io/Pedigree/sitemap.xml'],
        rationale: 'public/robots.txt must guide search crawlers to the sitemap.',
      },
      {
        filePath: 'public/sitemap.xml',
        requiredSubstrings: ['<loc>https://askkim.github.io/Pedigree/</loc>'],
        rationale: 'public/sitemap.xml must define the canonical GitHub Pages location.',
      },
      {
        filePath: 'public/404.html',
        requiredSubstrings: ['Community Pedigree Project - GitHub Pages SPA Fallback'],
        rationale: 'public/404.html must provide client-side route fallback for GitHub Pages.',
      },
      {
        filePath: '.github/workflows/deploy-pages.yml',
        requiredSubstrings: ['- main', '- release', 'dist/robots.txt', 'dist/sitemap.xml'],
        rationale:
          'deploy-pages.yml must deploy from both main and release branches and verify SEO artifacts.',
      },
      {
        filePath: 'package.json',
        requiredSubstrings: ['"homepage": "https://askkim.github.io/Pedigree/"'],
        rationale: 'package.json must state the official GitHub Pages homepage URL.',
      },
    ],
    restorePlaybook: [
      'Preserve SEO meta tags, canonical link, Open Graph, and JSON-LD structured data in `index.html`.',
      'Keep `public/robots.txt`, `public/sitemap.xml`, and `public/404.html` in place.',
      'Ensure `.github/workflows/deploy-pages.yml` triggers on `main` and `release` and verifies `dist/robots.txt` and `dist/sitemap.xml`.',
      'Keep `"homepage": "https://askkim.github.io/Pedigree/"` in `package.json` and live links in `README.md`.',
    ],
  },
  {
    id: 'IMP-065',
    title: 'Boot Stability & Stale-Chunk Recovery: 504 Outdated-Dep Auto-Reload, Pre-Boot Error Separation & Safe EOF Sourcemap Stripping',
    category: 'stability-pwa',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Eliminate transient first-load boot errors after updates or dev restarts that only disappear on manual refresh.',
    summary:
      'Hardens startup resilience across 4 layers: (1) updates `stripDevSourceMapTrailer` and `devInlineSourcemapStripPlugin` in `vite.config.ts` to strip only true EOF `sourceMappingURL` trailers and guard `Content-Length` against encoded/chunked headers; (2) splits genuine ES2018 syntax/parse incompatibility from transient module fetch / HTTP 504 `Outdated Optimize Dep` errors in `index.html`, adding capture-phase `<script>` and `unhandledrejection` pre-boot listeners with a 15-second cooldown-guarded reload that clears `pedigree_pending_boot_ts` so recovery never trips crash-loop protection; (3) upgrades `src/main.tsx` dev-mode cleanup to trigger a single guarded reload whenever a stale Service Worker controller was active; and (4) adds `isRecoverableChunkError` + `attemptOneTimeChunkReload` to `src/utils/lazyRoute.tsx` so stale dynamic imports and `RouteErrorBoundary` Retry Screen reload cleanly instead of reusing memoized rejected ES module promises.',
    files: [
      'vite.config.ts',
      'index.html',
      'src/main.tsx',
      'src/utils/lazyRoute.tsx',
      'src/utils/__tests__/lazyRoute.test.ts',
    ],
    invariants: [
      {
        filePath: 'vite.config.ts',
        requiredSubstrings: ['export function stripDevSourceMapTrailer', 'hasEncoding'],
        rationale:
          'Dev sourcemap stripping must only remove trailing EOF comments and skip Content-Length mutation on encoded responses.',
      },
      {
        filePath: 'index.html',
        requiredSubstrings: [
          'PREBOOT_RELOAD_KEY',
          'attemptOneShotPreBootReload',
          'handlePreBootTransientFetchFailure',
        ],
        rationale:
          'Pre-boot guard must separate transient module fetch/504 glitches from real ES2018 browser incompatibility and recover via cooldown-guarded reload.',
      },
      {
        filePath: 'src/main.tsx',
        requiredSubstrings: ['hadActiveController', 'pedigree_dev_sw_cleanup_reload_ts'],
        rationale:
          'Dev startup must reload cleanly once if a stale Service Worker controller intercepted the initial boot.',
      },
      {
        filePath: 'src/utils/lazyRoute.tsx',
        requiredSubstrings: ['isRecoverableChunkError', 'attemptOneTimeChunkReload'],
        rationale:
          'Lazy route loader and RouteErrorBoundary must detect stale chunk / 504 errors and perform a guarded clean reload instead of retrying a permanently rejected ES module entry.',
      },
    ],
    restorePlaybook: [
      'Keep EOF-only `stripDevSourceMapTrailer` checks and `hasEncoding` guard in `vite.config.ts`.',
      'Preserve `attemptOneShotPreBootReload`, `handlePreBootTransientFetchFailure`, capture-phase script `error`, and pre-boot `unhandledrejection` handlers in `index.html`.',
      'Preserve `hadActiveController` reload guard in `src/main.tsx`.',
      'Preserve `isRecoverableChunkError` and `attemptOneTimeChunkReload` in `src/utils/lazyRoute.tsx`.',
    ],
  },
  {
    id: 'IMP-066',
    title:
      'Alpha 3 Modular Core Primitives, Multi-Platform Storage Bridges, Decoupled @features/* Modules & Parameterized Android Wrapper',
    category: 'stability-pwa',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Execute the Hydrogen modular architecture plan with strict three-layer boundaries, iOS/desktop/Android storage and print bridges, decoupled feature packages, and zero boot or Alpha 2 baseline regressions.',
    summary:
      'Establishes `@engine/primitives/*` pure sanitization and crypto utilities; upgrades `@engine/bridge/*` with request-ID-correlated iOS `WKWebView` SQLite storage replies + timeouts (`ios-wrapper/BRIDGE_CONTRACT.md`), runtime Electron/Tauri `desktopBridgeAdapter.ts` delegation, and Android WebView two-frame `ArrayBuffer`/print parity; enforces strict `requiresIosStorageBridge` anti-eviction routing in `resilientStorageAdapter.ts` and `NativeBridgeStorageAdapter`; parameterizes `android-wrapper/` names, shortcuts, prefs, clipboard labels, and export filenames via Gradle `pedigree.wrapper.*` properties while keeping `minSdk = 26`; extracts 5 new domain-agnostic feature modules (`@features/csv-exporter`, `@features/backup-vault`, `@features/document-export`, `@features/ics-calendar`, `@features/ocr-parser`) alongside `@features/csv-importer`; and wires lightweight `PEDIGREE_APP_CONFIG` + end-to-end repositories and workflows through `@app/pedigreeAppWiring.ts` and `useBarnStore.ts` while deferring standalone `core` extraction until transfer readiness.',
    files: [
      'HYDROGEN_MODULAR_PLAN.md',
      'src/engine/primitives/index.ts',
      'src/engine/primitives/sanitization.ts',
      'src/engine/primitives/crypto.ts',
      'src/engine/bridge/platformBridge.ts',
      'src/engine/bridge/desktopBridgeAdapter.ts',
      'src/engine/storage/resilientStorageAdapter.ts',
      'src/engine/storage/nativeBridgeStorageAdapter.ts',
      'src/features/csv-exporter/csvExporter.ts',
      'src/features/backup-vault/portableVault.ts',
      'src/features/document-export/htmlPrintPackage.ts',
      'src/features/ics-calendar/icsBuilder.ts',
      'src/features/ocr-parser/ocrTextPipeline.ts',
      'src/app/pedigreeAppConfig.ts',
      'src/app/pedigreeAppWiring.ts',
      'src/hooks/useBarnStore.ts',
      'android-wrapper/app/build.gradle.kts',
      'android-wrapper/settings.gradle.kts',
      'ios-wrapper/BRIDGE_CONTRACT.md',
    ],
    invariants: [
      {
        filePath: 'src/engine/primitives/sanitization.ts',
        requiredSubstrings: ['isSafeObjectKey', 'sanitizeCsvFormulaCell', 'escapeSafeHtml'],
        rationale: 'Shared pure sanitization helpers must live in @engine/primitives without DOM/Node or domain dependencies.',
      },
      {
        filePath: 'src/engine/primitives/crypto.ts',
        requiredSubstrings: ['fnv1a64Hex', 'sha256HexPure', 'wrapGenericEncryptedZip'],
        rationale: 'Shared FNV-1a and SHA-256 primitives must live in @engine/primitives.',
      },
      {
        filePath: 'src/engine/bridge/desktopBridgeAdapter.ts',
        requiredSubstrings: ['detectDesktopShellType', 'createDesktopBridgeDelegates'],
        rationale: 'Desktop Electron/Tauri runtime detection must remain dependency-free in @engine/bridge.',
      },
      {
        filePath: 'src/engine/bridge/platformBridge.ts',
        requiredSubstrings: [
          'DEFAULT_IOS_STORAGE_REPLY_GLOBAL',
          'handleStorageBridgeResponse',
          'openExternalUrl',
        ],
        rationale: 'PlatformBridge must support correlated iOS WKWebView storage replies and unified safe URL/desktop/Android routing.',
      },
      {
        filePath: 'src/engine/storage/nativeBridgeStorageAdapter.ts',
        requiredSubstrings: ['return caps.hasNativeBridge;', 'Native storage bridge is not configured'],
        rationale: 'NativeBridgeStorageAdapter must verify caps.hasNativeBridge is active instead of accepting unbacked iOS signals.',
      },
      {
        filePath: 'src/engine/storage/resilientStorageAdapter.ts',
        requiredSubstrings: ['if (caps.requiresIosStorageBridge)', 'fnv1a64Hex'],
        rationale: 'createResilientStorageAdapter must strictly route ios-wkwebview through native bridge storage rather than evictable IndexedDB/OPFS.',
      },
      {
        filePath: 'src/features/csv-exporter/csvExporter.ts',
        requiredSubstrings: ['exportRecordsToCsv', 'createCsvExporterFeatureModule'],
        rationale: 'Decoupled CSV exporter must remain domain-agnostic in @features/csv-exporter.',
      },
      {
        filePath: 'src/features/backup-vault/portableVault.ts',
        requiredSubstrings: ['exportPortableVault', 'restorePortableVault', 'createBackupVaultFeatureModule'],
        rationale: 'Decoupled SHA-256 verified portable vault must remain domain-agnostic in @features/backup-vault.',
      },
      {
        filePath: 'src/features/document-export/htmlPrintPackage.ts',
        requiredSubstrings: ['buildPrintableHtmlDocument', 'dispatchPrintPackage', 'createDocumentExportFeatureModule'],
        rationale: 'Printable HTML packager must dispatch through IPlatformBridge without domain coupling.',
      },
      {
        filePath: 'src/features/ics-calendar/icsBuilder.ts',
        requiredSubstrings: ['buildGenericIcsCalendar', 'createIcsCalendarFeatureModule'],
        rationale: 'RFC 5545 calendar builder must accept generic events without livestock domain coupling.',
      },
      {
        filePath: 'src/features/ocr-parser/ocrTextPipeline.ts',
        requiredSubstrings: ['groupWordBoxesIntoLines', 'extractStructuredFieldsFromOcr', 'createOcrParserFeatureModule'],
        rationale: 'OCR line/field extraction pipeline must remain schema-driven and domain-agnostic.',
      },
      {
        filePath: 'src/app/pedigreeAppConfig.ts',
        requiredSubstrings: ['export const PEDIGREE_APP_CONFIG', 'document-export', 'backup-vault'],
        forbiddenSubstrings: ['fflate', 'sql.js'],
        rationale: 'PEDIGREE_APP_CONFIG must stay lightweight so useBarnStore startup does not pull ZIP or SQLite WASM engines.',
      },
      {
        filePath: 'src/app/pedigreeAppWiring.ts',
        requiredSubstrings: [
          'exportAnimalCsvFromStorage',
          'exportPedigreePortableVault',
          'printPedigreeDocument',
          'buildBarnTasksIcsFeed',
          'extractPedigreeOcrSummary',
        ],
        rationale: '@app/pedigreeAppWiring.ts is the sole composition layer connecting domain configs to @features/* and @engine/*.',
      },
      {
        filePath: 'android-wrapper/app/build.gradle.kts',
        requiredSubstrings: [
          'minSdk = 26',
          'pedigree.wrapper.appName',
          'pedigree.wrapper.debugPrefsName',
          'pedigree.wrapper.diagnosticsClipLabel',
          'pedigree.wrapper.defaultExportFilename',
        ],
        rationale: 'Android wrapper must preserve minSdk = 26 and Gradle property parameterization.',
      },
      {
        filePath: 'ios-wrapper/BRIDGE_CONTRACT.md',
        requiredSubstrings: ['NATIVE_STORAGE_OP', '__platformBridgeStorageReceive', '.applicationSupportDirectory'],
        rationale: 'iOS WKWebView SQLite storage bridge protocol must remain documented for native Apple shell implementations.',
      },
    ],
    restorePlaybook: [
      'Restore `@engine/primitives/*`, `@engine/bridge/desktopBridgeAdapter.ts`, and request-ID-correlated iOS storage reply handling in `@engine/bridge/platformBridge.ts`.',
      'Keep strict `caps.hasNativeBridge` verification in `NativeBridgeStorageAdapter` and anti-eviction routing in `createResilientStorageAdapter`.',
      'Preserve all six decoupled `@features/*` modules (`csv-importer`, `csv-exporter`, `backup-vault`, `document-export`, `ics-calendar`, `ocr-parser`) and `@app/pedigreeAppConfig.ts` + `@app/pedigreeAppWiring.ts` composition wiring.',
      'Maintain Gradle `pedigree.wrapper.*` parameterization and `minSdk = 26` in `android-wrapper/app/build.gradle.kts`.',
    ],
  },
  {
    id: 'IMP-067',
    title: 'NEON Phases 1–2: Boot-Entry Lock, 100% Extraction Inventory & Pure Shared Primitives Decoupling',
    category: 'stability-pwa',
    source: 'session',
    release: 'alpha-3',
    userIntent:
      'Lock boot/entry stability, classify 100% of shared vs domain modules, and extract pure content-agnostic primitives from remaining shared src/domain and src/utils modules without breaking Alpha 2 exports.',
    summary:
      'Establishes immutable boot-entry SHA-256 lock checksums (`BOOT_ENTRY_LOCK_CHECKSUMS`) for `src/main.tsx`, `src/App.tsx`, and `index.html`; classifies 100% of non-test modules across `src/domain/`, `src/features/`, `src/app/`, `src/storage/`, and `src/utils/` in `EXTRACTION_INVENTORY.md` (recording `FLASH_HYGIENE_PLAN.md` absorption and ES2018/`import/` config parity); extracts pure content-agnostic primitives (`themeColor.ts`, `qrCodec.ts`, `genericSync.ts`, `genericRegistries.ts`, `deviceCapabilityCore.ts`, `pdfDocumentExtractor.ts`, plus expanded `crypto.ts` and `sanitization.ts`) behind thin Alpha 2 compatibility facades; decouples `archiveAndCsvUtils.ts` and reusable `src/utils/*` (`es2018Shims.ts`, `useVirtualWindow.ts`, `lazyRoute.tsx`); wires domain factories in `@app/pedigreeAppWiring.ts`; and enforces automated zero-domain-term, import-direction, and boot-lock tests while deferring standalone `core` extraction until Phase 7.',
    files: [
      'EXTRACTION_INVENTORY.md',
      'ROADMAP.md',
      'src/domain/improvementRegistry.ts',
      'src/engine/primitives/index.ts',
      'src/engine/primitives/crypto.ts',
      'src/engine/primitives/sanitization.ts',
      'src/engine/primitives/themeColor.ts',
      'src/engine/primitives/qrCodec.ts',
      'src/engine/primitives/genericSync.ts',
      'src/engine/primitives/genericRegistries.ts',
      'src/engine/primitives/deviceCapabilityCore.ts',
      'src/engine/primitives/pdfDocumentExtractor.ts',
      'src/engine/codecs/archiveAndCsvUtils.ts',
      'src/domain/importers/pdfScanExtractor.ts',
      'src/app/pedigreeAppWiring.ts',
      'src/utils/es2018Shims.ts',
      'src/utils/useVirtualWindow.ts',
      'src/utils/lazyRoute.tsx',
      'src/domain/__tests__/modularLayerArchitecture.test.ts',
    ],
    invariants: [
      {
        filePath: 'EXTRACTION_INVENTORY.md',
        requiredSubstrings: [
          'FLASH_HYGIENE_PLAN.md',
          'extractable-core',
          'extractable-feature',
          'extractable-ui-util',
          'pedigree-domain',
        ],
        rationale: 'Extraction inventory must document FLASH_HYGIENE_PLAN.md absorption and classify 100% of non-test source files.',
      },
      {
        filePath: 'src/domain/improvementRegistry.ts',
        requiredSubstrings: ['export const BOOT_ENTRY_LOCK_CHECKSUMS', 'src/main.tsx', 'src/App.tsx', 'index.html'],
        rationale: 'Boot-entry SHA-256 lock checksums must remain registered to protect active boot stability.',
      },
      {
        filePath: 'src/engine/primitives/index.ts',
        requiredSubstrings: [
          './themeColor',
          './qrCodec',
          './genericSync',
          './genericRegistries',
          './deviceCapabilityCore',
          './pdfDocumentExtractor',
        ],
        rationale: 'Pure content-agnostic Phase 2 primitives must stay exported from @engine/primitives.',
      },
      {
        filePath: 'src/engine/codecs/archiveAndCsvUtils.ts',
        requiredSubstrings: ['@engine/primitives/sanitization', '@engine/primitives/genericRegistries'],
        rationale: 'archiveAndCsvUtils.ts must depend solely on content-agnostic @engine/primitives contracts.',
      },
      {
        filePath: 'src/app/pedigreeAppWiring.ts',
        requiredSubstrings: [
          'wrapPedigreeEncryptedZip',
          'PEDIGREE_P2P_WIRE_CONFIG',
          'buildPedigreeRecordDeepLink',
          'getPedigreeHeavyZipGate',
        ],
        rationale: '@app/pedigreeAppWiring.ts must inject Pedigree defaults into pure @engine/primitives helpers.',
      },
      {
        filePath: 'src/utils/es2018Shims.ts',
        requiredSubstrings: ['__coreEs2018Shim'],
        forbiddenSubstrings: ['__pedigreeEs2018Shim'],
        rationale: 'Reusable ES2018 shims must stay free of domain-specific internal marker names.',
      },
      {
        filePath: 'src/utils/lazyRoute.tsx',
        requiredSubstrings: ['configureLazyRouteDefaults', 'ChunkReloadOptions'],
        forbiddenSubstrings: ['Back to All Species'],
        rationale: 'lazyRoute.tsx must expose parameterized reload defaults and domain-neutral fallback UI copy.',
      },
    ],
    restorePlaybook: [
      'Preserve `BOOT_ENTRY_LOCK_CHECKSUMS` in `src/domain/improvementRegistry.ts` and boot-lock verification tests in `src/domain/__tests__/modularLayerArchitecture.test.ts`.',
      'Keep all pure content-agnostic primitives under `src/engine/primitives/*` and thin Alpha 2 compatibility facades in `src/domain/*`.',
      'Keep 100% file-by-file module classifications synchronized in `EXTRACTION_INVENTORY.md` and domain wiring in `@app/pedigreeAppWiring.ts`.',
      'Preserve domain-neutral markers and parameterized defaults in `src/utils/es2018Shims.ts`, `src/utils/useVirtualWindow.ts`, and `src/utils/lazyRoute.tsx`.',
    ],
  },
  {
    id: 'IMP-068',
    title: 'AI Studio GitHub Import Fast-Boot, Compact Initial Output & Cold-Start Optimizations',
    category: 'ci-tooling',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Speed up AI Studio startup when importing from GitHub, keep prompts/master_system_prompt.md mandatory, and reduce initial screen output.',
    summary:
      'Adds Section 0 (AI Studio GitHub Import Fast-Boot & Compact Output) to `AGENTS.md` so GitHub imports always read `prompts/master_system_prompt.md`, declare pre-configured AI Studio runtime facts (Node/npm, `0.0.0.0:3000`, `hmr: false`, browser `sql.js`, zero env vars), skip non-boot docs and full `npm test`/`tsc --noEmit`/`verify:improvements` runs on import-only boot, and limit clean startup output to `ALIGNED` + `Ready: Community Pedigree (port 3000).`; sets `audit=false` and `fund=false` in `.npmrc`; removes lazy `tesseract.js` from eager Vite `optimizeDeps.include` and sets `reportCompressedSize: false` in `vite.config.ts`; and keeps `releaseReadiness.test.ts` tolerant of gitignored `Screenshot_*` attachments in `public/assets/aistudio/`.',
    files: [
      'AGENTS.md',
      '.npmrc',
      'vite.config.ts',
      'src/domain/__tests__/releaseReadiness.test.ts',
    ],
    invariants: [
      {
        filePath: 'AGENTS.md',
        requiredSubstrings: [
          'prompts/master_system_prompt.md',
          'AI Studio GitHub Import Fast-Boot & Compact Output',
          'Minimal Initial Screen Output',
          'Ready: Community Pedigree (port 3000).',
        ],
        rationale:
          'AGENTS.md must enforce reading master_system_prompt.md, fast-boot skip rules on GitHub import, and compact 2-line initial screen output.',
      },
      {
        filePath: '.npmrc',
        requiredSubstrings: ['legacy-peer-deps=true', 'audit=false', 'fund=false'],
        rationale:
          '.npmrc must disable npm audit and funding network calls to accelerate cold AI Studio dependency installation.',
      },
      {
        filePath: 'vite.config.ts',
        requiredSubstrings: ['reportCompressedSize: false'],
        forbiddenSubstrings: ["'tesseract.js',"],
        rationale:
          'Vite must skip gzip size reporting on build and avoid eagerly pre-bundling lazy tesseract.js during dev startup.',
      },
    ],
    restorePlaybook: [
      'Keep Section 0 (`AI Studio GitHub Import Fast-Boot & Compact Output`) and the mandatory `prompts/master_system_prompt.md` directive at the top of `AGENTS.md`.',
      'Keep `legacy-peer-deps=true`, `audit=false`, and `fund=false` in `.npmrc`.',
      'Keep `reportCompressedSize: false` and omit `tesseract.js` from `optimizeDeps.include` in `vite.config.ts`.',
    ],
  },
];
