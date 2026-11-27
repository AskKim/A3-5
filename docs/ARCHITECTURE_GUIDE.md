# Community Pedigree Architecture Guide

This guide provides a comprehensive dual-audience breakdown of how Community Pedigree is engineered, organized, and maintained.

---

## Part 1: Plain-English Guide (Beginner & Breeder Friendly)

### 1. What This Application Does
Community Pedigree is a free, private livestock and pet management system. It acts like a digital barn binder:
- It records animal lineages, tattoos/ear tags, breed standards, and coat color genetics.
- It calculates inbreeding percentages (Wright's Coefficient of Inbreeding, or COI) so breeders avoid accidental close inbreeding.
- It tracks breeding dates, automatically calculates kindling/kidding schedules, and creates chore checklists.
- It generates printable pedigree certificates and cage cards.

### 2. How Your Data Moves (No Cloud Required)
Unlike modern apps that require you to create an account, log in with an email, and send all your private livestock records to a remote server in the cloud:
1. **Everything Runs Locally:** When you click "Save Animal", the record is saved directly to your device's storage.
2. **Offline-First:** You can take your phone or laptop into a barn with zero Wi-Fi or cellular service and use every single feature without interruption.
3. **You Own Your Data:** You can export your entire database at any time as a standard SQLite file, a human-readable JSON backup, or a CSV spreadsheet.
4. **Device-to-Device Sharing:** You can transfer an animal profile to another breeder's phone using a simple offline QR code scan.

### 3. Folder Map for Beginners
- `src/` — The main application code:
  - `src/components/` — The visual screens you see and interact with (the Barn Bench, Herd screen, Pedigree explorer, Settings).
  - `src/domain/` — The underlying livestock calculation and data engines (genetics math, COI math, calendar date calculations).
  - `src/engine/` — The content-agnostic core engine (crypto, sanitization, QR coding, storage adapters, platform bridges).
  - `src/features/` — Self-contained tools for importing/exporting spreadsheets, printing documents, backups, OCR, and building calendar files.
  - `src/app/` — Settings and wiring that configure animal terminology (e.g. buck/doe vs sire/dam, litter vs kids) and connect the engine/features to the app.
  - `src/storage/` — Browser database adapters (SQLite WASM, IndexedDB, OPFS vaults, background workers, image optimization).
  - `src/hooks/` & `src/utils/` — State management (`useBarnStore.ts`) and reusable UI helpers (accessibility, PDF helpers, ES2018 shims).
  - `src/native/` — Bridge connecting the web app to native Android/iOS wrapper features.
- `android-wrapper/` — A small native Android project that wraps the web app so it can be installed on Android phones and tablets via an `.apk`.
- `apple-wrapper/` & `ios-wrapper/` — The architecture and bridge definitions for running as an installable app on iPhones, iPads, and Macs.
- `desktop-wrapper/` — The blueprint for running as a standalone desktop app on Windows, Mac, and Linux.
- `scripts/` & `prompts/` — Automated verification checks (`verify:*`) and engineering/preflight workflow prompts.

---

## Part 2: AI & Developer Technical Reference

### 1. Three-Layer Architectural Boundaries
The codebase enforces strict structural decoupling across three layers:

```
+-------------------------------------------------------------+
| Layer 3: Domain & Application (@domain/*, @app/*)           |
| - src/domain/: Livestock genetics, COI, calendars, models   |
| - src/app/: Terminology dictionaries, schemas, wiring       |
| - Connects @engine/* and @features/* to UI & store          |
+-------------------------------------------------------------+
                              |
+-------------------------------------------------------------+
| Layer 2: Decoupled Feature Modules (@features/*)            |
| - csv-importer: Schema-driven tabular import pipeline       |
| - csv-exporter: RFC 4180 CSV serialization with CSV formula |
|   injection escaping                                        |
| - backup-vault: SHA-256 verified portable vault archives    |
| - document-export: HTML print package builder & bridge      |
| - ics-calendar: RFC 5545 iCalendar event stream builder     |
| - ocr-parser: 2D line grouping & rule-based field extractor |
| * RULE: No sibling feature imports (@features/A -> B = FORBIDDEN)
+-------------------------------------------------------------+
                              |
+-------------------------------------------------------------+
| Layer 1: Content-Agnostic Core (@engine/*)                    |
| - ZERO livestock or pedigree domain terms                   |
| - Primitives: crypto, sanitization, qrCodec, genericSync    |
| - Storage: IStorageAdapter, memory/idb/opfs adapters,       |
|   sqliteWasmStorageAdapter, nativeBridgeStorageAdapter      |
| - Bridge: IPlatformBridge, capability detection, IPC routes |
+-------------------------------------------------------------+
```

### 2. Multi-Platform Storage Routing & Eviction Defense
- **Browser PWA:** Relational queries run in-memory via `sql.js` (SQLite WASM) and synchronize to IndexedDB or OPFS.
- **Android APK:** Native Kotlin wrapper (`MainActivity.kt`) serves bundled Vite assets offline via `WebViewAssetLoader`, provides SAF file saving, and maintains a 5-snapshot backup vault in `filesDir/pedigree-vault/`.
- **Apple WKWebView (iOS/macOS):** Browser storage (`IndexedDB`, `localStorage`) is purged after 7 days under WebKit Intelligent Tracking Prevention (ITP). Persistence **must** route through `NativeBridgeStorageAdapter` and `WKScriptMessageHandler` (`nativeStorage` / `pedigreeNative`) to app sandbox SQLite (`Application Support/`).
- **Desktop (Tauri/Electron):** Binds to `DesktopBridgeAdapter` for native filesystem operations and silent printing.

### 3. Non-Negotiable Invariants
- **React PWA Lock:** Core application (`src/`) must ALWAYS remain React + Vite + TypeScript. Never rewrite PWA in Kotlin or Swift.
- **Zero Type Escapes:** No `as any`, `@ts-ignore`, or `@ts-expect-error`.
- **Temporal Arithmetic:** Store pure calendar dates as `"YYYY-MM-DD"`. Perform date offsets using `Date.UTC(y, m, d + offset)`.
- **Memory Safety:** Cap active pedigree trees at 2–3 generations; revoke object URLs immediately after compression; teardown all subscriptions and timers on component unmount.
- **Drift & Boundary Protection:** Register significant changes in `src/domain/improvementRegistry.ts` and `IMPROVEMENTS.md`, and keep checks passing via `npm run verify:improvements`, `npm run verify:layers`, `npm run verify:engine`, `npm run verify:extraction`, `npm test`, and `npm run lint`.
