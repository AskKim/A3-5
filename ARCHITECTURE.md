# Community Pedigree Project — Architecture & Hybrid Wrapper Guardrails

- **Project Name:** Community Pedigree Project
- **App Name:** Community Pedigree
- **Repository:** [`AskKim/Pedigree`](https://github.com/AskKim/Pedigree)
- **Package Name:** `pedigree`
- **License:** GNU AGPLv3 (`AGPL-3.0-or-later`) — see [LICENSE](./LICENSE)
- **Mandatory Core Stack:** **React + Vite + TypeScript PWA** (`/src/`, `/index.html`, `/vite.config.ts`)

## 0. Critical Hybrid Architecture Boundary (React Core PWA + Thin Android Wrapper)

1. **The Core App MUST Always Stay in React (`src/`):**
   - Every screen, state hook, storage adapter, and domain module lives in the **React + Vite + TypeScript PWA** (`src/`).
   - **Never Convert PWA Away From React:** Do not rewrite, convert, or migrate the PWA to Kotlin, Android Views, Jetpack Compose, or any non-React stack—even during GitHub import recovery, build-crash triage, or bootability troubleshooting.
2. **Thin Hybrid Android Wrapper (`android-wrapper/`):**
   - `android-wrapper/` is **strictly a thin native AndroidX `WebView` container** written in Kotlin.
   - Its sole job is to host the compiled React PWA production bundle (`npm run build -- --base=/` → `dist/` → `android-wrapper/app/src/main/assets/www/`) offline at `https://appassets.androidplatform.net/` via `WebViewAssetLoader` and bridge native file/print/vault/back actions (`window.pedigreeNative` ↔ `src/native/pedigreeBridge.ts`).
   - It contains **zero** application UI screens, genetics logic, or database schemas; all app logic remains in React/TypeScript.

## 1. Three-Layer Modular Boundaries (Alpha 3)

The codebase enforces strict dependency direction and domain isolation across `src/` (see [`EXTRACTION_INVENTORY.md`](./EXTRACTION_INVENTORY.md) and [`docs/ARCHITECTURE_GUIDE.md`](./docs/ARCHITECTURE_GUIDE.md)):

1. **Content-Agnostic Engine (`@engine/*` → `src/engine/`):**
   - Zero livestock or pedigree domain terms and zero upward imports.
   - `primitives/` (`crypto`, `sanitization`, `qrCodec`, `themeColor`, `genericSync`, `genericRegistries`, `deviceCapabilityCore`, `pdfDocumentExtractor`), `codecs/` (`archiveAndCsvUtils`, `textFormats`), `sync/`, `bridge/` (`IPlatformBridge`, `DesktopBridgeAdapter`, `PlatformBridge`), and `storage/` (`IStorageAdapter`, `MemoryStorageAdapter`, `IndexedDbStorageAdapter`, `OpfsStorageAdapter`, `SqliteWasmStorageAdapter`, `NativeBridgeStorageAdapter`, `createResilientStorageAdapter`).
   - Verified standalone via `npm run verify:engine` (`tsconfig.engine.json`) and `npm run verify:extraction` (`scripts/rehearse-engine-extraction.ts`).
2. **Reusable Feature Modules (`@features/*` → `src/features/`):**
   - Decoupled feature engines (`csv-importer`, `csv-exporter`, `backup-vault`, `document-export`, `ics-calendar`, `ocr-parser`) implementing `IFeatureModule`.
   - Cross-feature sibling imports (`@features/A` importing `@features/B`) are prohibited.
3. **Domain & Application Layers (`@domain/*` → `src/domain/`, `@app/*` → `src/app/`):**
   - `src/domain/` houses pure TypeScript livestock/pedigree rules and Alpha 2 compatibility facades. The improvement registry lives in `src/domain/improvements/` (`registry-part-*.ts` plus `rationales.ts`); `src/domain/improvementRegistry.ts` remains its public surface.
   - `src/app/` (`pedigreeAppConfig.ts`, `pedigreeAppWiring.ts`, `PlatformBridgeContext.tsx`, `animalProfileSchema.ts`, `animalCsvConfig.ts`) serves as the sole composition root wiring `@engine/*` and `@features/*` to Community Pedigree.
   - Layer boundaries and zero circular dependencies are enforced by `npm run verify:layers` (`scripts/audit-layers.ts` + shrinking allowlist `scripts/layer-allowlist.json`) and `src/domain/__tests__/modularLayerArchitecture.test.ts`. Build-time circular chunk imports are caught separately by `npm run verify:chunks` (`scripts/verify-chunk-graph.ts`), which must run after `npm run build`.

## 2. Cross-Platform & Pure Domain Guardrails

1. **100% Pure TypeScript Domain Layer (`src/domain/`):**
   - `models.ts`: Canonical entities (`BarnSettings`, `SpeciesProfile`, `Animal`, `CageLocation`, `BreedingRecord`, `BarnTask`, `CareLog`, `ShowEvent`) with globally unique `id` (UUID v4), ISO-8601 UTC `updatedAt` timestamps, per-species weight unit overrides (`lbs_oz`, `lbs`, `kg`, `grams`), and species-aware identifier labels.
   - `pedigreeCalculator.ts`: Recursive pedigree slot builder (3–8 gen), lazy Gen 4+ branch viewport helper (`buildPedigreeBranchViewport`), exact topological Wright COI / coancestry engine, depth-8 shared ancestor path contributions, pedigree completeness summaries, and cycle prevention.
   - `geneticsEngine.ts`: Multi-species coat color loci, allele inference, and Punnett test-breeding simulator across 11 predefined species plus custom-species fallback (flagged under development / incomplete via `ColorGeneticsNotice` and export notices pending domain-expert sign-off).
   - `taskMaster.ts`: Automated Master Task List chore cascading from configurable species milestone offsets, per-breed schedule overrides, and post-birth task recalculation.
   - `showResults.ts`: Structured per-animal `ShowEvent.results` normalization, XSS-safe E-Leg certificate photo sanitization, Grand Championship (3-leg / multi-judge) progress computation, `Animal.legsCount` delta reconciliation, and pedigree/report/binder show honor summaries.
   - `syncAndExports.ts`: Deterministic UUID + ISO-8601 `updatedAt` multi-device merge engine, `.json` (v5 + legacy v3/v4 import), `.csv`, Evans-compatible `.HTM` pedigrees, 4"×2" thermal cage cards, and PDF-ready DTO snapshots.
   - `backupVault.ts`, `upgradeGate.ts`, `archiveInspector.ts`, `encryptedExport.ts`, `photoMaintenance.ts`: `_schemaVersion`-stamped SHA-256 vault/pre-upgrade backup verification, pure uncached `version.json`/`status.json` release gate evaluation (`revokedVersions`, `schemaDelta >= 2`, Safe-Harbor floor), dry-run pre-restore species/conflict inspection, pure PBKDF2/AES-GCM container framing, and photo storage/orphan footprint auditing.
   - `syncOutbox.ts`, `calendarExport.ts`, & `supportBundle.ts`: Monotonic per-record `_rev` counters paired with clock-skew-adjusted timestamps (`compareSameEntitySyncOperations`), deterministic base32hex Google Calendar event IDs, and pure diagnostic support bundle packaging.
   - **Zero Browser DOM Coupling:** Domain modules in `src/domain/` do not import from `src/storage/`, `src/hooks/`, `src/components/`, or `src/utils/`, so pure domain logic remains portable to React Native / Expo.

2. **Pluggable Storage Adapter (`src/storage/`), Multi-Shell Contracts & Optional Client OAuth (`src/utils/`):**
   - `storageAdapter.ts`: Defines the `BarnStorageAdapter` contract.
   - `webSqliteAdapter.ts`: Executes standard relational SQLite (`PEDIGREE_SQLITE_SCHEMA`) in the browser via `sql.js` WebAssembly and persists the unencrypted `.sqlite` binary inside IndexedDB (or an injected `IStorageAdapter` `backingStore` for native shells). The adapter is split by concern: `sqliteSchema.ts` (DDL, shared with the native wrappers), `sqliteIdbPersistence.ts` (persistence and quota recovery), `sqliteRowMappers.ts` (row → domain) and `sqliteRowWriters.ts` (domain → row).
   - **Native Apple & Desktop Shell Blueprints (`apple-wrapper/`, `ios-wrapper/`, `desktop-wrapper/`):** Define `WKScriptMessageHandler` (`WKWebView` native SQLite storage preventing 7-day WebKit ITP eviction) and Electron/Tauri IPC contracts routed through `@engine/bridge/*` and `NativeBridgeStorageAdapter`.
   - **Why SQLite-First Wins Cross-Platform:** The exact same `PEDIGREE_SQLITE_SCHEMA` SQL runs in native SQLite containers on Android/iOS/desktop, and users can export/sync a literal unencrypted `.sqlite` database file across devices via Google Drive, OneDrive, Dropbox, or Syncthing.
   - **Offline-First Calendar Export (`src/utils/`):** `src/utils/googleCalendarClient.ts` is content-agnostic, has no external Firebase/auth dependency, and pairs with `src/app/pedigreeCalendarClient.ts` and `src/domain/calendarExport.ts` for offline `.ics` generation and optional Google/Outlook Calendar web template links.

3. **Strict Species Isolation:**
   - Every animal, breeding, task, cage, care log, and show carries an explicit `species` field.
   - `useBarnStore.ts` computes `activeSpeciesData` via case-insensitive `isSameSpecies(...)` filtering and resets selected animal IDs on species switch so records from one species never leak into another species' Herd, Breeding, or Pedigree screens.

4. **Documentation, Invariants & Backlog (`docs/plans/`):**
   - Automated anti-wipeout invariants are tracked in the registries (`src/domain/improvements/registry-part-*.ts`, `src/domain/promptRegistry.ts`) and their generated ledgers (`IMPROVEMENTS.md`, `PROMPT_CHANGES.md` — rewritten by `npm run regen:ledgers`, never by hand) and verified via `npm run verify:improvements` / `npm run verify:prompts`.
   - Open unimplemented suggestions are tracked in `docs/plans/suggestions-backlog.md` alongside `ARCHITECTURE.md`, `ROADMAP.md`, and `EXTRACTION_INVENTORY.md` so roadmap context persists across GitHub syncs and AI Studio reinstalls.
   - Documentation is indexed in [docs/README.md](./docs/README.md), with the store contract in [docs/contracts/](./docs/contracts/), decision records in [docs/decisions/](./docs/decisions/), and per-layer READMEs in `src/engine/`, `src/features/`, `src/storage/` and `src/hooks/barnStore/`. The full gate list lives in [scripts/README.md](./scripts/README.md).
