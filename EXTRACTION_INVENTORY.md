# Extraction Inventory: Framework vs. Domain Modularity

**Date:** 2026-11-24 (delta appended 2026-11-28)  
**Target Architecture:** Alpha 3 Three-Layer Modularity (`@engine/*`, `@features/*`, `@app/*`) — NEON Phases 1 & 2 Baseline  
**Status:** 100% non-test file classification across `src/domain/`, `src/features/`, `src/app/`, `src/storage/`, and `src/utils/`; boot-entry lock verified; zero domain terms in shared/reusable modules; zero component→storage runtime edges; `src/engine`, `src/features` and `src/utils` name no domain/app/storage/hooks/components code in sources or tests, so they are extraction-ready. Standalone `engine` (`/engine`) package creation itself is an owner scope decision (ROADMAP §2 places it out of scope for v0.1.0-alpha.3).

---

## 0. NEON Phase 1 Audit & Plan Reconciliation

### 0.1 Temporary Plan Cleanup Note
- Completed temporary root plan files (`FLASH_HYGIENE_PLAN.md`, `HYDROGEN_MODULAR_PLAN.md`, `NEON_MODULAR_PLAN.md`) were removed after all hygiene, decoupling, wrapper contract, and isolated core verification gates passed.

### 0.2 Boot-Entry Lock Baseline (Read-Only Checksums)
The following startup/entry files are locked during NEON modularization to preserve active Hydrogen boot testing and ES2018 boot stability:
- `src/main.tsx` — SHA-256: `b77239b90e2ab0ca96469ccd8692531d17fddc73267cc9aab3a3638a49a663dc`
- `src/App.tsx` — SHA-256: `10d2d3cef97434ded29408504ae095ca01d1bbba981a059866406954728db5fb`
- `index.html` — SHA-256: `2ac08f65d0471f000bde064d5edecc433a540e814790b602f99af1a578c13454`

### 0.3 Build & Test Configuration Parity Audit (Read-Only Verified)
- `tsconfig.json`: `"target": "ES2018"`, `"lib": ["ES2018", ...]`, `"exclude": ["dist", "import"]`, path aliases `@engine/*`, `@features/*`, `@app/*` active.
- `tsconfig.engine.json`: Isolated ES2018 verification profile (`npm run verify:engine`) compiling strictly `extractable-core`, `extractable-feature`, and `extractable-ui-util` with zero domain/app/storage dependencies.
- `vite.config.ts`: `importFolderGuardPlugin()` blocks `/import/` resolution and dev HTTP serving, `server.fs.deny` includes `'import'` and `'import/**'`, `build.target` targets `['es2018', 'chrome68', 'safari12', 'firefox63', 'edge79']`.
- `vitest.config.ts`: `test.exclude` excludes `'import/**'` and `'android-wrapper/**'` with matching `@engine`, `@features`, and `@app` aliases.

### 0.4 Classification Legend
- `extractable-core` — Zero domain terms, zero `@features/*`/`@app/*`/`components`/`hooks`/`storage` imports; ready for future standalone `engine` (`/engine`) extraction.
- `extractable-feature` — Self-contained reusable feature module in `src/features/`; zero domain terms and zero sibling feature or `@app/*` imports.
- `extractable-ui-util` — Reusable browser/React utility in `src/utils/` with domain-agnostic logic and parameterized defaults.
- `pedigree-domain` — Livestock/pedigree domain logic, Alpha 2 compatibility facades, application composition wiring, or legacy browser storage modules scheduled for later phases.

---

## 1. `src/engine/` & `src/domain/` File-by-File Inventory (118 Non-Test Files: 31 in `src/engine/`, 87 in `src/domain/`)

### 1.1 Content-Agnostic Engine Modules (`extractable-core` — 31 files in `src/engine/`; the two `src/domain/` compatibility shims were retired in IMP-142)
- `src/engine/index.ts` — `extractable-core` — Top-level modular engine entry barrel exposing strictly domain-free primitives, codecs, bridge, storage, and sync surfaces.
- `src/engine/binaryEncoding.ts` — `extractable-core` — Pure byte, UTF-8, and base64 encoding/decoding utilities.
- `src/engine/codecs/index.ts` — `extractable-core` — Pure codecs sub-module barrel (`binaryEncoding`, `qrCodec`, `pdfDocumentExtractor`, `archiveAndCsvUtils`).
- `src/engine/sync/index.ts` — `extractable-core` — Pure sync and integrity sub-module barrel (`genericSync`, `crypto`).
- `src/engine/primitives/index.ts` — `extractable-core` — Pure primitives barrel export.
- `src/engine/primitives/boundedCache.ts` — `extractable-core` — Bounded string LRU cache (`BoundedStringLruCache`) and safe object-URL revocation helper (`revokeBlobUrlSafe`).
- `src/engine/primitives/crypto.ts` — `extractable-core` — Pure synchronous FNV-1a 64-bit hash, SHA-256 hex digest, generic AES-256-GCM/PBKDF2 envelope validation and WebCrypto encryption/decryption, JSON/ZIP extraction, and encrypted ZIP wrapper.
- `src/engine/primitives/sanitization.ts` — `extractable-core` — Payload size limits, prototype-safe key guards, text sanitization, SQLite header check, zip-slip/zip-bomb safe extraction, CSV formula escaping, HTML escaping, raster data URL check, CSS hex check, external HTTP URL validation, plain dictionary sanitizer, and slugifier.
- `src/engine/primitives/themeColor.ts` — `extractable-core` — Generic semantic palette mixing, relative luminance contrast math, and prefixed CSS custom property resolution.
- `src/engine/primitives/qrCodec.ts` — `extractable-core` — Pure ISO 18004 QR matrix encoder (versions 1–12, Reed-Solomon ECC, mask scoring), SVG renderer, and generic query deep-link builder/parser.
- `src/engine/primitives/genericSync.ts` — `extractable-core` — Generic operation log, deterministic LWW comparator, field diffing, schema-validated sync ops, WebRTC P2P wire/signal codec, and collection set impact diffing.
- `src/engine/primitives/genericRegistries.ts` — `extractable-core` — Generic exporter catalog/registry and generic multi-platform importer registry contracts.
- `src/engine/primitives/deviceCapabilityCore.ts` — `extractable-core` — Hardware tier classification (Tiers 1–5), storage policies, workload evaluation, browser compatibility assessment, and heavy ZIP export confirmation gate.
- `src/engine/primitives/pdfDocumentExtractor.ts` — `extractable-core` — Pure TypeScript offline PDF `/FlateDecode` vector text & `/DCTDecode` raster JPEG page extractor.
- `src/engine/bridge/index.ts` — `extractable-core` — Platform bridge barrel export.
- `src/engine/bridge/platformBridge.interface.ts` — `extractable-core` — Universal platform bridge contract (`IPlatformBridge`, `PlatformCapabilities`, print/export, back stack, native storage ops).
- `src/engine/bridge/desktopBridgeAdapter.ts` — `extractable-core` — Dependency-free runtime sniffer and delegate adapter for Electron and Tauri shells.
- `src/engine/bridge/platformBridge.ts` — `extractable-core` — Unified cross-platform bridge with capability detection, correlated iOS `WKWebView` SQLite storage replies, print/export, safe external URL dispatch, and back handler stack.
- `src/engine/storage/index.ts` — `extractable-core` — Storage layer barrel export.
- `src/engine/storage/storageAdapter.interface.ts` — `extractable-core` — Pure storage adapter contract (`IStorageAdapter`, capabilities, quota, batch, transactions).
- `src/engine/storage/browserProbes.ts` — `extractable-core` — Restricted-browser storage probes, active IDB/BroadcastChannel/WebLock/transfer-lease tracking, quota/block error detection, and OPFS fallback dumper registry.
- `src/engine/storage/opfsStream.ts` — `extractable-core` — Worker-safe OPFS `/tmp` & directory streaming, ES2018-safe Blob chunking, orphaned temp sweep, and active OPFS handle lifecycle tracking.
- `src/engine/storage/crossTabSync.ts` — `extractable-core` — Generic Web Locks + FIFO in-tab lock serializer and BroadcastChannel/`localStorage` cross-tab commit notification bus.
- `src/engine/storage/lifecycleCoordinator.ts` — `extractable-core` — Cooperative background freeze coordinator, auto-resume registry, and `visibilitychange`/`pagehide` handle release dispatcher.
- `src/engine/storage/lanWebRtcTransport.ts` — `extractable-core` — Serverless local-only (`iceServers: []`) WebRTC DataChannel transport with chunk framing and reassembly.
- `src/engine/storage/browserStorageAdapters.ts` — `extractable-core` — `MemoryStorageAdapter`, `IndexedDbStorageAdapter`, and `OpfsStorageAdapter`.
- `src/engine/storage/sqliteWasmStorageAdapter.ts` — `extractable-core` — SQLite 3 WASM (`sql.js`) adapter over any backing `IStorageAdapter`.
- `src/engine/storage/nativeBridgeStorageAdapter.ts` — `extractable-core` — Native bridge persistence adapter for iOS `WKWebView` anti-eviction SQLite and desktop containers.
- `src/engine/storage/resilientStorageAdapter.ts` — `extractable-core` — Multi-tier resilient storage orchestrator with strict iOS native bridge routing and SHA-256/FNV-1a portable bundle export/restore.
- `src/engine/codecs/archiveAndCsvUtils.ts` — `extractable-core` — Pure archive unpacking, delimited CSV/TSV parsing, encoding detection, and file normalization helpers delegating to `@engine/primitives/*`.
- `src/engine/codecs/textFormats.ts` — `extractable-core` — Shared RFC-4180 CSV cell escaping and RFC-5545 iCalendar text/alarm encoders used by both `@features/*` and domain facades.

### 1.2 Alpha 2 Compatibility Facades in `src/domain/` (`pedigree-domain` — 13 files)
These files preserve 100% of Alpha 2 public exports and domain defaults while delegating core algorithms to `@engine/primitives/*`:
- `src/domain/archiveInspector.ts` — `pedigree-domain` — Delegates set impact math to `@engine/primitives/genericSync`.
- `src/domain/deviceCapability.ts` — `pedigree-domain` — Delegates hardware/browser classification and gates to `@engine/primitives/deviceCapabilityCore`.
- `src/domain/encryptedExport.ts` — `pedigree-domain` — Delegates envelope validation, ZIP wrapping, and extraction to `@engine/primitives/crypto`.
- `src/domain/exporters/exporterTypes.ts` — `pedigree-domain` — Binds `GenericExporterDescriptor` to Pedigree snapshot payloads.
- `src/domain/exporters/registry.ts` — `pedigree-domain` — Delegates exporter catalog/registry mechanics to `@engine/primitives/genericRegistries`.
- `src/domain/importers/importerTypes.ts` — `pedigree-domain` — Binds `GenericPlatformImporter` to Pedigree import previews.
- `src/domain/importers/pdfScanExtractor.ts` — `pedigree-domain` — Delegates PDF extraction to `@engine/primitives/pdfDocumentExtractor`.
- `src/domain/importers/registry.ts` — `pedigree-domain` — Delegates importer registry mechanics to `@engine/primitives/genericRegistries`.
- `src/domain/inputSanitization.ts` — `pedigree-domain` — Re-exports pure primitives from `@engine/primitives/sanitization` plus domain record sanitizers.
- `src/domain/p2pSyncProtocol.ts` — `pedigree-domain` — Delegates P2P wire/signal codecs to `@engine/primitives/genericSync`.
- `src/domain/qrCode.ts` — `pedigree-domain` — Delegates QR matrix/SVG and URL helpers to `@engine/primitives/qrCodec`.
- `src/domain/syncOutbox.ts` — `pedigree-domain` — Delegates outbox ops, LWW comparison, and field diffing to `@engine/primitives/genericSync`.
- `src/domain/syncRetention.ts` — `pedigree-domain` — Pure age-plus-cap retention policy for the sync operation log.
- `src/domain/syncConflictExpiry.ts` — `pedigree-domain` — Pure retention planner for the resolved sync-conflict review log.
- `src/domain/snapshotChecksum.ts` — `pedigree-domain` — Canonical snapshot SHA-256 (payload/order normalised) behind restore checksum verification.
- `src/domain/themePalette.ts` — `pedigree-domain` — Delegates palette math and CSS variable generation to `@engine/primitives/themeColor`.

### 1.3 Pedigree Domain Engines in `src/domain/` (`pedigree-domain` — 63 files)
- `src/domain/alternativeCertificates.ts` — `pedigree-domain` — Alternative pedigree certificate templates and layouts.
- `src/domain/animalConflicts.ts` — `pedigree-domain` — Animal conflict detection and lineage validation rules.
- `src/domain/backupArchive.ts` — `pedigree-domain` — Pedigree backup ZIP builder and parser.
- `src/domain/backupStatus.ts` — `pedigree-domain` — Barn backup freshness evaluation and reminder rules.
- `src/domain/backupVault.ts` — `pedigree-domain` — Pedigree schema v6 vault envelopes, migrations, and retired-herd archive bundles.
- `src/domain/barnAlerts.ts` — `pedigree-domain` — Barn dashboard alerts and overdue breeding/chore checks.
- `src/domain/barnBench.ts` — `pedigree-domain` — Quick-entry barn bench scoring and batch workflows.
- `src/domain/barnBinder.ts` — `pedigree-domain` — Printable barn binder document assembler.
- `src/domain/barnJournal.ts` — `pedigree-domain` — Barn journal note models and timeline grouping.
- `src/domain/barnScheduler.ts` — `pedigree-domain` — Breeding and chore Gantt schedule builder.
- `src/domain/batchPrint.ts` — `pedigree-domain` — Multi-animal batch pedigree print packager.
- `src/domain/breederShowcase.ts` — `pedigree-domain` — Public breeder showcase page generator.
- `src/domain/breedingCalendar.ts` — `pedigree-domain` — Multi-species gestation, kindling, and weaning calendar calculator.
- `src/domain/calendarExport.ts` — `pedigree-domain` — Barn task and breeding calendar `.ics` export builder.
- `src/domain/carrierGenetics.ts` — `pedigree-domain` — Carrier trait and recessive allele tracking logic.
- `src/domain/clientCrm.ts` — `pedigree-domain` — Buyer, waitlist, and transfer CRM ledger.
- `src/domain/cloudAppFolderSync.ts` — `pedigree-domain` — Cloud folder sync manifest and delta merge policies.
- `src/domain/csvExport.ts` — `pedigree-domain` — Pedigree herd CSV exporter.
- `src/domain/dataHealthCheck.ts` — `pedigree-domain` — Pedigree snapshot integrity and orphan link diagnostics.
- `src/domain/economicsLedger.ts` — `pedigree-domain` — Farm income, expense, and cost-per-animal ledger.
- `src/domain/facilityBoard.ts` — `pedigree-domain` — Hutch, cage, pen, and stall occupancy board logic.
- `src/domain/feedInventory.ts` — `pedigree-domain` — Feed lot inventory and consumption tracking.
- `src/domain/feedManufacturerDirectory.ts` — `pedigree-domain` — Commercial livestock feed brand directory.
- `src/domain/geneticsEngine.ts` — `pedigree-domain` — Coat color locus calculator and Punnett square predictor.
- `src/domain/growthAnalytics.ts` — `pedigree-domain` — Weight gain curve and litter survival analytics.
- `src/domain/healthReference.ts` — `pedigree-domain` — Species health reference notes and medication logs.
- `src/domain/imageOptimizationSpec.ts` — `pedigree-domain` — Pedigree photo compression presets and target specs.
- `src/domain/importers/conflictResolver.ts` — `pedigree-domain` — Animal deduplication and merge conflict resolver.
- `src/domain/importers/csvColumnMapper.ts` — `pedigree-domain` — Pedigree CSV column alias mapper.
- `src/domain/importers/csvStarterTemplate.ts` — `pedigree-domain` — Species-specific starter CSV template generator.
- `src/domain/importers/herdBossImporter.ts` — `pedigree-domain` — Third-party herd software backup importer.
- `src/domain/importers/pedigreeOcrParser.ts` — `pedigree-domain` — 2D paper pedigree card tree OCR parser.
- `src/domain/importers/universalPedigreeImporter.ts` — `pedigree-domain` — Universal pedigree CSV/archive importer.
- `src/domain/improvementRegistry.ts` — `pedigree-domain` — Anti-wipeout invariant registry, boot-entry lock checksums, and recovery log formatter.
- `src/domain/improvements/rationales.ts` — `pedigree-domain` — Invariant rationale prose keyed by entry/file/ordinal, loaded only for markdown and JSON export.
- `src/domain/improvements/types.ts` — `pedigree-domain` — Shared registry types (entry, invariant, category, release) so part modules avoid a registry import cycle.
- `src/domain/improvements/registry-part-01.ts` — `pedigree-domain` — Registry entries IMP-001 … IMP-017.
- `src/domain/improvements/registry-part-02.ts` — `pedigree-domain` — Registry entries IMP-018 … IMP-034.
- `src/domain/improvements/registry-part-03.ts` — `pedigree-domain` — Registry entries IMP-035 … IMP-051.
- `src/domain/improvements/registry-part-04.ts` — `pedigree-domain` — Registry entries IMP-052 … IMP-068.
- `src/domain/improvements/registry-part-05.ts` — `pedigree-domain` — Registry entries IMP-069 … IMP-085.
- `src/domain/judgeNotebook.ts` — `pedigree-domain` — Show judge comments and placement notebook engine.
- `src/domain/ledgerContract.ts` — `pedigree-domain` — Append-only ledger header contract and new-entry shape validator shared by `IMPROVEMENTS.md` and `PROMPT_CHANGES.md`.
- `src/domain/mileageTaxLog.ts` — `pedigree-domain` — Agricultural travel mileage and tax deduction calculator.
- `src/domain/milestones.ts` — `pedigree-domain` — Youth 4-H/FFA and breeder milestone trackers.
- `src/domain/models.ts` — `pedigree-domain` — Canonical livestock/pedigree TypeScript domain interfaces.
- `src/domain/moduleCatalog.ts` — `pedigree-domain` — Live workspace module split classifier (`core-non-content` vs `content-specific`) and core filename guard.
- `src/domain/pairingMatrix.ts` — `pedigree-domain` — Multi-pair inbreeding and coat outcome comparison matrix.
- `src/domain/pdfExporter.ts` — `pedigree-domain` — Printable HTML/PDF pedigree certificate generator.
- `src/domain/pedigreeAnalysis.ts` — `pedigree-domain` — Founder contribution and line-breeding analysis.
- `src/domain/pedigreeAnalytics.ts` — `pedigree-domain` — Herd-wide pedigree completeness and diversity metrics.
- `src/domain/pedigreeCalculator.ts` — `pedigree-domain` — Wright's COI, ancestor tree traversal, and kinship math.
- `src/domain/pedigreePrintStyles.ts` — `pedigree-domain` — Print stylesheet tokens for pedigree certificates.
- `src/domain/photoMaintenance.ts` — `pedigree-domain` — Orphan photo cleanup and storage size estimator.
- `src/domain/promptRegistry.ts` — `pedigree-domain` — Anti-overwrite prompt changelog invariant registry and recovery formatter (`PROMPT_CHANGES.md`).
- `src/domain/promptsCatalog.ts` — `pedigree-domain` — Repository prompt index manifest builder.
- `src/domain/reportCatalog.ts` — `pedigree-domain` — Registry report metadata catalog.
- `src/domain/reportGenerators.ts` — `pedigree-domain` — Herd, breeding, and show report generators.
- `src/domain/sampleData.ts` — `pedigree-domain` — Multi-species sample herd fixtures.
- `src/domain/shareablePedigreeCard.ts` — `pedigree-domain` — Shareable pedigree summary card generator.
- `src/domain/showDocuments.ts` — `pedigree-domain` — Show entry form and coop card generators.
- `src/domain/showResults.ts` — `pedigree-domain` — Show legs, wins, and grand champion tracking.
- `src/domain/speciesMemo.ts` — `pedigree-domain` — Species-specific management memo engine.
- `src/domain/speciesMigration.ts` — `pedigree-domain` — Cross-species record migration helpers.
- `src/domain/suggestionsBacklog.ts` — `pedigree-domain` — Feature suggestions backlog parser.
- `src/domain/supportBundle.ts` — `pedigree-domain` — Diagnostics support bundle serializer.
- `src/domain/syncAndExports.ts` — `pedigree-domain` — Barn JSON backup export/import and sync helpers.
- `src/domain/taskMaster.ts` — `pedigree-domain` — Barn chore recurrence and task scheduling engine.
- `src/domain/developmentGuardrails.ts` — `pedigree-domain` — Advanced developer tools guardrails and safety checks.
- `src/domain/upgradeGate.ts` — `pedigree-domain` — Schema migration gate and version comparison checks.
- `src/domain/woolFiber.ts` — `pedigree-domain` — Wool/fiber harvest yield and micron tracking.

---

## 2. `src/features/` File-by-File Inventory (17 Non-Test Files — All `extractable-feature`)

- `src/features/index.ts` — `extractable-feature` — Features layer barrel export.
- `src/features/featureModule.interface.ts` — `extractable-feature` — Reusable feature module lifecycle contract (`IFeatureModule`).
- `src/features/backup-vault/index.ts` — `extractable-feature` — Backup vault feature barrel.
- `src/features/backup-vault/portableVault.ts` — `extractable-feature` — SHA-256 verified portable vault export/restore.
- `src/features/csv-exporter/index.ts` — `extractable-feature` — CSV exporter feature barrel.
- `src/features/csv-exporter/csvExporter.ts` — `extractable-feature` — RFC-4180 CSV serializer with formula escaping.
- `src/features/csv-exporter/types.ts` — `extractable-feature` — Generic CSV exporter schema contracts.
- `src/features/csv-importer/index.ts` — `extractable-feature` — CSV importer feature barrel.
- `src/features/csv-importer/csvImporter.ts` — `extractable-feature` — Schema-driven tabular import orchestrator.
- `src/features/csv-importer/csvParser.ts` — `extractable-feature` — Delimited text parser and value normalizers.
- `src/features/csv-importer/types.ts` — `extractable-feature` — Generic CSV importer schema contracts.
- `src/features/document-export/index.ts` — `extractable-feature` — Document export feature barrel.
- `src/features/document-export/htmlPrintPackage.ts` — `extractable-feature` — Printable HTML document packager and platform bridge dispatcher.
- `src/features/ics-calendar/index.ts` — `extractable-feature` — iCalendar feature barrel.
- `src/features/ics-calendar/icsBuilder.ts` — `extractable-feature` — RFC 5545 `.ics` calendar generator.
- `src/features/ocr-parser/index.ts` — `extractable-feature` — OCR parser feature barrel.
- `src/features/ocr-parser/ocrTextPipeline.ts` — `extractable-feature` — 2D word-box line grouping and schema-driven field extractor.

---

## 3. `src/app/` File-by-File Inventory (29 Non-Test Files — All `pedigree-domain`)

- `src/app/index.ts` — `pedigree-domain` — Application layer barrel export.
- `src/app/appConfig.interface.ts` — `pedigree-domain` — Multi-species registry and terminology contracts.
- `src/app/pedigreeAppConfig.ts` — `pedigree-domain` — Lightweight Community Pedigree species/feature configuration.
- `src/app/animalProfileSchema.ts` — `pedigree-domain` — Domain animal profile schema normalization and JSON serialization.
- `src/app/animalCsvConfig.ts` — `pedigree-domain` — Pedigree animal CSV import/export schemas.
- `src/app/pedigreeAppWiring.ts` — `pedigree-domain` — Sole composition layer connecting `@engine/*` primitives/storage/bridges and `@features/*` to Community Pedigree domain workflows.
- `src/app/PlatformBridgeContext.tsx` — `pedigree-domain` — React Context provider and `usePlatformBridge()` hook for `IPlatformBridge` dependency injection across UI components.
- `src/app/pedigreePdfActions.ts` — `pedigree-domain` — Domain PDF certificate export actions binding `src/domain/pdfExporter.ts` to content-agnostic `src/utils/webPdfActions.ts`.
- `src/app/pedigreeCalendarClient.ts` — `pedigree-domain` — Domain Google Calendar push wrapper binding `BarnTask`/`CalendarSyncSettings` to content-agnostic `src/utils/googleCalendarClient.ts`.
- `src/app/ports/installPrompt.tsx` — `pedigree-domain` — Install/offline capability port: owns the `src/storage/storageProtection` import so `PWAInstallButton`/`OfflineIndicator` render from an injected `InstallPromptPort` (IMP-145).
- `src/app/ports/ideasBacklog.tsx` — `pedigree-domain` — Offline captured-ideas capability port: owns the `src/storage/capturedIdeasStore` import so `SuggestionsBacklogScreen` loads, saves, removes and clears ideas through an injected `IdeasBacklogPort` (IMP-147).
- `src/app/ports/diagnostics.ts` — `pedigree-domain` — Crash/diagnostics capability port: owns the `crashLogger`, `backgroundFreezeCoordinator` and `offThreadWorkerClient` imports so `CrashErrorBoundary`, `DevelopmentErrorBoundary` and `AsyncErrorToastHost` log, summarise and dismiss through `getDiagnosticsPort()` (IMP-151).
- `src/app/ports/imageOptimizer.ts` — `pedigree-domain` — Image-optimization capability port: owns the `webImageOptimizer` import so the animal editor, photo gallery, importer panel, print preview and three screens call `getImageOptimizerPort()` instead of compressing through a storage module (IMP-154).
- `src/app/ports/storageProtection.ts` — `pedigree-domain` — Persistent-storage, connectivity and PWA install capability port; owns the `src/storage/storageProtection` edge for the settings, calendar, health, cloud-folder, crash and diagnostics surfaces (IMP-156).
- `src/app/ports/localSyncChannels.ts` — `pedigree-domain` — Cross-tab/local sync channel capability port for the scheduler, species dashboard, backup vault and hub screens (IMP-156).
- `src/app/ports/offThreadWorkerClient.ts` — `pedigree-domain` — Off-main-thread worker capability port for the developer console, import hub and external importer (IMP-156).
- `src/app/ports/opfsStorage.ts` — `pedigree-domain` — OPFS archive/vault storage capability port for the developer console, import hub and backup vault (IMP-156).
- `src/app/ports/deviceCapabilityDetector.ts` — `pedigree-domain` — Device capability detection capability port for the developer console, import hub and diagnostics panel (IMP-156).
- `src/app/ports/backgroundFreezeCoordinator.ts` — `pedigree-domain` — Background job freeze/resume capability port for the developer console and import hub (IMP-156).
- `src/app/ports/pwaUpdateManager.ts` — `pedigree-domain` — PWA update lifecycle capability port for the developer console (IMP-156).
- `src/app/ports/storageProbes.ts` — `pedigree-domain` — Storage probe/quota measurement capability port for the developer console (IMP-156).
- `src/app/ports/photoHydration.ts` — `pedigree-domain` — Photo blob hydration and data-url normalisation capability port for the photo gallery and import hub (IMP-156).
- `src/app/ports/weatherForecast.ts` — `pedigree-domain` — Weather forecast lookup capability port for the breeding calendar (IMP-156).
- `src/app/ports/vetDocsFolder.ts` — `pedigree-domain` — Veterinary document folder capability port for the health reference panel (IMP-156).
- `src/app/ports/feedTagOcr.ts` — `pedigree-domain` — Feed-tag OCR capability port for the feed ledger (IMP-156).
- `src/app/ports/pedigreeOcrScanner.ts` — `pedigree-domain` — Pedigree OCR scanning capability port for the pedigree scanner panel (IMP-156).
- `src/app/ports/passphraseCrypto.ts` — `pedigree-domain` — Backup passphrase encryption capability port for the import hub (IMP-156).
- `src/app/ports/p2pLanChannel.ts` — `pedigree-domain` — Peer-to-peer LAN channel capability port for the barn scheduler Gantt (IMP-156).
- `src/app/ports/webSqliteMaintenance.ts` — `pedigree-domain` — Web SQLite cache-purge capability port for the crash boundary (IMP-156).

---

## 4. `src/storage/` File-by-File Inventory (27 Non-Test Files — Phase 3 Storage Alignment)

All legacy browser/worker storage modules are classified `pedigree-domain` in Phases 1–3 (`storageProbes`, `opfsTempStream`, `passphraseCrypto`, `backgroundFreezeCoordinator`, `p2pLanChannel`, `photoHydration`, `localSyncChannels`, `storageProtection`, `cloudAppFolderSync`, and `weatherForecast` delegate core primitives to `@engine/storage/*` & `@engine/primitives/*`):
- `src/storage/archiveAndImport.worker.ts` — `pedigree-domain` — Off-thread `.ZIP` backup and external archive import Web Worker.
- `src/storage/backgroundFreezeCoordinator.ts` — `pedigree-domain` — Page lifecycle freeze/resume flush coordinator facade over `@engine/storage/lifecycleCoordinator`.
- `src/storage/capturedIdeasStore.ts` — `pedigree-domain` — Local storage store for captured user ideas.
- `src/storage/cloudAppFolderSync.ts` — `pedigree-domain` — File System Access API / OAuth cloud folder sync driver.
- `src/storage/crashLogger.ts` — `pedigree-domain` — Boot crash loop guard and diagnostic ring buffer.
- `src/storage/deviceCapabilityDetector.ts` — `pedigree-domain` — Browser hardware signal probe and capability hook.
- `src/storage/feedTagOcr.ts` — `pedigree-domain` — Feed tag image OCR runner.
- `src/storage/localSyncChannels.ts` — `pedigree-domain` — Cross-tab mutex/commit bus facade over `@engine/storage/crossTabSync` and directory handle store.
- `src/storage/offThreadWorkerClient.ts` — `pedigree-domain` — Main-thread Web Worker RPC client with fallback.
- `src/storage/opfsStorage.ts` — `pedigree-domain` — OPFS `/tmp`, `/backups`, `/archives` vault manager and IDB rescue dumps.
- `src/storage/opfsTempStream.ts` — `pedigree-domain` — Streaming OPFS temporary export writer facade over `@engine/storage/opfsStream`.
- `src/storage/p2pLanChannel.ts` — `pedigree-domain` — WebRTC DataChannel peer sync facade over `@engine/storage/lanWebRtcTransport`.
- `src/storage/passphraseCrypto.ts` — `pedigree-domain` — WebCrypto PBKDF2 + AES-256-GCM passphrase encryption facade over `@engine/primitives/crypto`.
- `src/storage/pedigreeOcrScanner.ts` — `pedigree-domain` — Browser `TextDetector` / Tesseract OCR pipeline for pedigree cards.
- `src/storage/photoHydration.ts` — `pedigree-domain` — Bounded LRU photo data URL cache (`@engine/primitives/boundedCache`) and lazy hydration helpers.
- `src/storage/pwaUpdateManager.ts` — `pedigree-domain` — Service Worker registration and update prompt controller.
- `src/storage/sqliteIdbPersistence.ts` — `pedigree-domain` — IndexedDB persistence, quota recovery, and browser cache purge helpers for `WebSqliteAdapter`.
- `src/storage/sqliteRowMappers.ts` — `pedigree-domain` — SQLite row-to-domain mappers (`mapSettingsRow`, `mapSqliteAnimalRow`, `mapCageRow`, …) that rebuild barn models from query rows for `WebSqliteAdapter`.
- `src/storage/sqliteMutationHelpers.ts` — `pedigree-domain` — Transaction envelope plus generic batch-write and multi-row delete helpers (`runSqliteTransaction`, `writeRowsInTransaction`, `deleteRowsForIds`) shared by every `WebSqliteAdapter` write path.
- `src/storage/sqliteRowWriters.ts` — `pedigree-domain` — SQLite row upsert/delete writers (`upsertSettingsRow`, `upsertAnimalRow`, …) that bind barn models to statements inside `WebSqliteAdapter` transactions.
- `src/storage/sqliteSnapshotReaders.ts` — `pedigree-domain` — Snapshot row readers (`readSnapshotFromDatabase`, `queryObjectsFromDb`, `mapAnimalRow`) that rebuild every barn table into a `BarnDatabaseSnapshot` for `WebSqliteAdapter`.
- `src/storage/sqliteSchema.ts` — `pedigree-domain` — Canonical SQLite schema DDL (`PEDIGREE_SQLITE_SCHEMA`) shared across SQLite adapters.
- `src/storage/storageAdapter.ts` — `pedigree-domain` — Alpha 2 `BarnStorageAdapter` contract.
- `src/storage/storageProbes.ts` — `pedigree-domain` — Browser storage quota and probe facade over `@engine/storage/browserProbes`.
- `src/storage/storageProtection.ts` — `pedigree-domain` — Persistent storage request and eviction guardrails (decoupled via `configureStorageProtectionBridge` and `@engine/storage/browserProbes`).
- `src/storage/vetDocsFolder.ts` — `pedigree-domain` — Local vet document attachment folder storage.
- `src/storage/weatherForecast.ts` — `pedigree-domain` — Local weather advisory cache.
- `src/storage/webImageOptimizer.ts` — `pedigree-domain` — Offscreen/Canvas WebP/JPEG image compressor.
- `src/storage/webSqliteAdapter.ts` — `pedigree-domain` — Alpha 2 SQLite WASM + IndexedDB barn database engine with optional `IStorageAdapter` backing store seam for iOS `WKWebView`.

---

## 5. `src/utils/` File-by-File Inventory (10 Non-Test Files — All `extractable-ui-util`)

### 5.1 Reusable UI & Runtime Utilities (`extractable-ui-util` — 10 files)
- `src/utils/canvasUtils.ts` — `extractable-ui-util` — Pure browser `<canvas>` / `OffscreenCanvas` GPU memory release and safe pixel-area clamping helpers.
- `src/utils/comboboxNav.ts` — `extractable-ui-util` — Pure keyboard navigation state helper for accessible comboboxes.
- `src/utils/es2018Shims.ts` — `extractable-ui-util` — Minimal ES2018 browser compatibility shims (`globalThis`, `allSettled`, `fromEntries`, `flat`/`flatMap`, `Blob` readers).
- `src/utils/googleCalendarClient.ts` — `extractable-ui-util` — Content-agnostic Google Calendar REST transport with `CalendarTaskRecord` and `CalendarEventPayloadBuilder` DI.
- `src/utils/lazyRoute.tsx` — `extractable-ui-util` — Content-agnostic code-splitting `lazyNamedRoute`, `RouteLoadingFallback`, and `RouteErrorBoundary` using `--ui-*` tokens and `configureLazyRouteDefaults`.
- `src/utils/useAccessibleDialog.ts` — `extractable-ui-util` — Accessible modal focus trap and Escape-key hook.
- `src/utils/useAsyncSubmitLock.ts` — `extractable-ui-util` — Re-entrancy guard hook for async form submissions.
- `src/utils/useVirtualWindow.ts` — `extractable-ui-util` — ES2018 scroll window virtualizer hook for large lists and tables.
- `src/utils/perfTiming.ts` — `extractable-ui-util` — Bounded labelled timing recorder for long operations.
- `src/utils/webFileActions.ts` — `extractable-ui-util` — Bridge-agnostic browser/native binary download and share helpers configured via `configureWebFileBridge`.
- `src/utils/webPdfActions.ts` — `extractable-ui-util` — Content-agnostic offscreen-canvas raster-to-JPEG encoder and generic `buildAndDownloadPdfDocument` helper.

---

## 6. UI, State Store & Native Shell Boundaries (Reference Summary)
- **UI Components (`src/components/*`):** Domain screens, editors, and modals remaining in the application layer.
- **State Store (`src/hooks/useBarnStore.ts`):** Pedigree Zustand store orchestrating domain state and Alpha 3 app wiring.
- **Native Packaging Shells:** `src/native/pedigreeBridge.ts`, `android-wrapper/*` (AndroidX WebView wrapper, `minSdk = 26`, Gradle-parameterized), `ios-wrapper/*` (`WKWebView` native SQLite storage bridge contract preventing 7-day WebKit eviction).

---

## 7. Browser Storage Touchpoints Inventory (Native SQLite Bridge Routing Guide)

Guide for routing persistence through `@engine/bridge/*` and `@engine/storage/nativeBridgeStorageAdapter.ts` to native SQLite in Apple `WKWebView` (preventing 7-day WebKit eviction) and desktop containers:

### 7.1 `localStorage` Touchpoints (Key-Value Browser State)
- `src/hooks/useBarnStore.ts`: `pedigree.lastBackupMeta.v1` (backup timestamp and format metadata) & `pedigree.backupReminderSnoozedUntil.v1` (snoozed reminder expiry).
- `src/storage/weatherForecast.ts`: `pedigree.weatherForecast.v1` (cached 7-day weather forecast payload).
- `src/storage/vetDocsFolder.ts`: `pedigree.vetDocsMeta.v1` (vet document attachments manifest & user custom restricted health sources).
- `src/storage/deviceCapabilityDetector.ts`: `pedigree.deviceTierDismissed.v1` (per-device capability tier notice dismissal).
- `src/storage/crashLogger.ts`: `pedigree_crash_ring_buffer_v1` (synchronous ring buffer of critical errors for sudden-kill survival).
- `src/storage/capturedIdeasStore.ts`: fallback key-value store for user ideas when IndexedDB/OPFS are unavailable.
- `src/storage/storageProbes.ts`: synchronous read/write quota and availability probe.

### 7.2 `sessionStorage` Touchpoints (Tab/Process Lifecycle State)
- `src/utils/lazyRoute.tsx`: `pedigree_lazy_route_reload_ts` & `pedigree_pending_boot_ts` (chunk-load retry dampening and boot error recovery).
- `src/main.tsx`: `pedigree_main_reload_ts` & `pedigree_pending_boot_ts` (top-level boot error loop limiter).
- `src/storage/cloudAppFolderSync.ts`: `pedigree_cloud_pkce_pending_v1` (ephemeral OAuth PKCE code verifier and challenge state).
- `src/storage/backgroundFreezeCoordinator.ts`: `pedigree_emergency_trace_v1` (bounded emergency crash traces during background freeze).
- `src/storage/storageProbes.ts`: probe validating transient session availability.

### 7.3 `IndexedDB` Touchpoints (Browser Relational & Blob Persistence)
- `src/storage/webSqliteAdapter.ts`: `pedigree-db-store` / `sqlite_master_db` (primary browser storage holding the serialized SQLite database snapshot).
- `src/engine/storage/browserStorageAdapters.ts`: `IndexedDbStorageAdapter` (content-agnostic key-value chunk adapter backing storage engines in standard browsers).
- `src/storage/capturedIdeasStore.ts`: `community_pedigree_ideas_v1` (standalone offline user ideas; routes through `configureCapturedIdeasBackingStore` -> `NativeBridgeStorageAdapter` on iOS `WKWebView`).
- `src/storage/photoHydration.ts`: strictly transient in-memory `BoundedPhotoDataCache` LRU cache (zero exclusive user data outside the primary SQLite DB).
- `src/storage/storageProbes.ts`: probe checking IndexedDB factory availability and storage quota.

### 7.4 `OPFS` (Origin Private File System) Touchpoints
- `src/storage/opfsStorage.ts`: root directories `/tmp`, `/backups`, `/archives`, plus emergency rescue dumps from IndexedDB corruption.
- `src/storage/opfsTempStream.ts`: streaming temporary file writer using `FileSystemWritableFileStream` for large PDF/ZIP exports without main-thread RAM bloat.
- `src/engine/storage/browserStorageAdapters.ts`: `OpfsStorageAdapter` (content-agnostic directory handle adapter).
- `src/storage/capturedIdeasStore.ts`: `pedigree_ideas` directory fallback.
- `src/engine/primitives/deviceCapabilityCore.ts` & `src/engine/bridge/platformBridge.ts`: OPFS capability probe (`navigator.storage.getDirectory`).

### 7.5 `SQLite WASM` (`sql.js`) Touchpoints
- `src/storage/webSqliteAdapter.ts`: `sql.js` WebAssembly relational database engine running in-memory and persisting serialized byte snapshots to IndexedDB.
- `src/engine/storage/sqliteWasmStorageAdapter.ts`: `SqliteWasmStorageAdapter` wrapping `sql.js` over swappable `IStorageAdapter` backends (`MemoryStorageAdapter`, `IndexedDbStorageAdapter`, `OpfsStorageAdapter`, or `NativeBridgeStorageAdapter`).
- Native Routing Strategy: Under native Apple `WKWebView` or desktop shells, `NativeBridgeStorageAdapter` intercepts `IStorageAdapter` calls and delegates directly to host native SQLite via `window.webkit.messageHandlers.pedigreeStorage` or desktop IPC, completely bypassing browser WebKit storage eviction.


---

## 8. Delta since 2026-11-24 (appended 2026-11-28)

The file-by-file lists above are the original audit. Modules added or split since then are classified
here so the inventory keeps matching the tree without rewriting the sections above.

### 8.1 `src/engine/` additions (all `extractable-core`)

- `binaryEncoding.ts` — the encoding helpers moved down from `src/domain/`; the domain shim was
  retired in IMP-142 once every caller imported `@engine/binaryEncoding` directly.
- `primitives/boundedCache.ts`, `primitives/deviceCapabilityCore.ts` — bounded LRU and hardware-tier
  policy lifted out of `src/storage/`.
- `storage/browserStorageAdapters.ts` — memory and IndexedDB adapters.
- `storage/sqliteWasmStorageAdapter.ts`, `storage/resilientStorageAdapter.ts` — `sql.js` execution and
  the retry/fallback wrapper.
- `storage/opfsStream.ts`, `storage/crossTabSync.ts`, `storage/lifecycleCoordinator.ts`,
  `storage/lanWebRtcTransport.ts`, `storage/browserProbes.ts` — OPFS streaming, cross-tab commit bus,
  background-freeze lifecycle, WebRTC transport and storage probes.
- `bridge/desktopBridgeAdapter.ts` — Electron/Tauri runtime sniffer and delegate.

### 8.2 `src/storage/` split (`pedigree-domain`, browser implementation)

`webSqliteAdapter.ts` now delegates to six modules that carry no UI concerns of their own:
`sqliteSchema.ts` (canonical DDL, shared with the native wrappers), `sqliteIdbPersistence.ts`
(persistence, quota recovery, cache cleanup), `sqliteRowMappers.ts` (row → domain),
`sqliteSnapshotReaders.ts` (SELECTs + snapshot assembly), `sqliteRowWriters.ts` (domain → row) and
`sqliteMutationHelpers.ts` (transaction envelope, batch write, multi-row delete). `backgroundFreezeCoordinator.ts`, `opfsTempStream.ts`,
`p2pLanChannel.ts`, `passphraseCrypto.ts` and `storageProbes.ts` are thin domain-wired facades over
`@engine/*`; they stay `pedigree-domain` because they configure app-specific keys and policies.

### 8.3 `src/hooks/barnStore/` (new folder, `pedigree-domain`)

Twenty-four modules split out of `useBarnStore.ts`: two pure policy modules (`photoCacheBudget`,
`backupReminder`), the restore orchestrator, rev-keyed species selectors, the typed facades and
React-free ports, three context slices (`syncConflictSlice`, `vaultSlice`, `syncStateSlice`) and
fifteen mutation sub-hooks (`useAnimalsCrud`, `usePhotoMutations`, `useBreeding`, `useSpeciesProfileActions`,
`useReservationSale`, `useAlertDismissals`, `useCloudSyncActions`, `useOpfsVaultActions`, `useRollingBackupActions`,
`useOpfsArchiveOffload`, `useSyncConflictResolution`, `useSyncConflictDismissal`, `usePhotoCache`,
`useBackupReminderActions`), plus the `storeNoticeActions` factories behind the frozen return literal.
See `src/hooks/barnStore/README.md` for the map and the contract rules.

### 8.4 `src/domain/` additions (`pedigree-domain`)

- `improvements/` — the registry split into `registry-part-01…05.ts`, shared `types.ts` and
  `rationales.ts`; `improvementRegistry.ts` remains the public surface.
- `ledgerContract.ts` — the append-only ledger header and entry shape used by both verifiers.
- `syncRetention.ts` — 120-day window plus 20k hard cap for the sync outbox.
- `syncConflictExpiry.ts` — resolved conflicts expire; unresolved ones never do.
- `moduleCatalog.ts` — classification rules behind `MODULES.md`.

### 8.5 Tooling (`ci-tooling`, outside the runtime layers)

`scripts/verify-chunk-graph.ts` (`verify:chunks`), `scripts/verify-contract-changelog.ts`
(`verify:contract`), `scripts/verify-site-identity.ts` + `scripts/siteIdentity.ts`, and
`scripts/regen-ledgers.ts` (`regen:ledgers`). The gate map is `scripts/README.md`.

### 8.6 Documentation added

`docs/README.md` (index), `docs/contracts/barn-store-contract.md`, `docs/decisions/0001-destructive-restore.md`,
and the layer READMEs in `src/engine/`, `src/features/`, `src/storage/`, `src/hooks/barnStore/`,
`src/domain/improvements/` and `scripts/`.

### 8.7 Extraction-readiness closure (IMP-156, IMP-157)

- `src/app/ports/` grew from 4 to 20 capability ports; every remaining component→storage runtime
  import moved behind one of them and `scripts/ui-storage-coupling-budget.json` is now `[]`.
- Three UI tests moved out of the framework layer to sit with the components they exercise:
  `printPreviewFileActions.test.ts`, `printPreviewHelpers.test.ts` and `parentPickerAndMemory.test.ts`
  now live in `src/components/__tests__/`.
- `scripts/rehearse-engine-extraction.ts` (`verify:extraction`) now also fails when any file in
  `src/engine`, `src/features` or `src/utils` — tests included — imports from `src/domain`,
  `src/app`, `src/storage`, `src/hooks` or `src/components`: the reach-back `tsc` cannot see, because
  it skips `__tests__`.
