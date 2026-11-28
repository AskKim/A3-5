/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Improvement registry entries IMP-069 … IMP-085 (17 of 85).
 *
 * Split out of `improvementRegistry.ts` so the registry stays reviewable as it grows. The public
 * surface (`IMPROVEMENTS_REGISTRY`, invariant evaluation, markdown/JSON export) still lives in
 * `src/domain/improvementRegistry.ts` and is unchanged.
 */

import type { ImprovementEntry } from './types';

export const REGISTRY_PART_05: ImprovementEntry[] = [
  {
    id: 'IMP-069',
    title: 'Alpha 3 Modularity Remediation: Full Utils Decoupling, IPlatformBridge Context DI, iOS SQLite Backing Seam & Boundary Guardrails',
    category: 'stability-pwa',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Close all remaining modularity gaps after Phase 1 DI rollout: decouple src/utils/*, remove all concrete pedigreeBridge imports from components/utils/storage, route iOS WKWebView SQLite persistence through NativeBridgeStorageAdapter, fix double back-handler registration, and harden automated layer tests.',
    summary:
      'Decouples `src/utils/lazyRoute.tsx` (`app_chunk_reload_ts`, `--ui-*` CSS aliases in `src/index.css`, injectable diagnostic hooks), `src/utils/webFileActions.ts` (`configureWebFileBridge`), `src/utils/webPdfActions.ts` -> `src/app/pedigreePdfActions.ts`, and `src/utils/googleCalendarClient.ts` -> `src/app/pedigreeCalendarClient.ts` so 100% of `src/utils/` is domain-free; adds `PlatformBridgeContext` (`usePlatformBridge()`) and extends `IPlatformBridge` with optional diagnostic/dev-panel/container hooks, migrating `PrintPreviewModal`, `HealthReferencePanel`, `SettingsAndSyncScreen`, `DiagnosticsAndSupportPanel`, `TechyStuffScreen`, and `storageProtection.ts` off concrete `pedigreeBridge`; fixes duplicate back-handler registration in `createPedigreeBridgePlatformAdapter`; adds an optional `backingStore?: IStorageAdapter` seam to `WebSqliteAdapter` wired via `createPedigreeDomainStorageAdapter` in `pedigreeAppWiring.ts` so iOS `WKWebView` routes SQLite persistence through `NativeBridgeStorageAdapter`; decouples `CrashErrorBoundary` from direct `WebSqliteAdapter` construction; and upgrades `modularLayerArchitecture.test.ts` with dynamic core/utils scanning, relative cross-feature import detection, and zero concrete `pedigreeBridge` enforcement.',
    files: [
      'src/index.css',
      'src/utils/lazyRoute.tsx',
      'src/utils/webFileActions.ts',
      'src/utils/webPdfActions.ts',
      'src/utils/googleCalendarClient.ts',
      'src/app/PlatformBridgeContext.tsx',
      'src/app/pedigreePdfActions.ts',
      'src/app/pedigreeCalendarClient.ts',
      'src/app/pedigreeAppWiring.ts',
      'src/engine/bridge/platformBridge.interface.ts',
      'src/native/pedigreeBridge.ts',
      'src/storage/storageProtection.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/hooks/useBarnStore.ts',
      'src/App.tsx',
      'src/components/CrashErrorBoundary.tsx',
      'src/components/HealthReferencePanel.tsx',
      'src/components/SettingsAndSyncScreen.tsx',
      'src/components/PrintPreviewModal.tsx',
      'src/components/DiagnosticsAndSupportPanel.tsx',
      'src/components/TechyStuffScreen.tsx',
      'src/domain/__tests__/modularLayerArchitecture.test.ts',
      'EXTRACTION_INVENTORY.md',
    ],
    invariants: [
      {
        filePath: 'src/app/PlatformBridgeContext.tsx',
        requiredSubstrings: ['PlatformBridgeProvider', 'usePlatformBridge'],
      },
      {
        filePath: 'src/utils/webFileActions.ts',
        requiredSubstrings: ['configureWebFileBridge', 'NativeExportBridge'],
        forbiddenSubstrings: ['pedigreeBridge'],
      },
      {
        filePath: 'src/app/pedigreeAppWiring.ts',
        requiredSubstrings: [
          'initializePedigreeRuntimeDefaults',
          'createPedigreeDomainStorageAdapter',
          'NativeBridgeStorageAdapter',
        ],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: ['backingStore?: IStorageAdapter'],
      },
    ],
    restorePlaybook: [
      'Preserve `PlatformBridgeProvider` in `src/App.tsx` and `usePlatformBridge()` across UI components.',
      'Keep `configureLazyRouteDefaults`, `configureWebFileBridge`, and `configureStorageProtectionBridge` wired in `src/app/pedigreeAppWiring.ts`.',
      'Keep `backingStore?: IStorageAdapter` in `src/storage/webSqliteAdapter.ts` and `createPedigreeDomainStorageAdapter` in `src/app/pedigreeAppWiring.ts`.',
    ],
  },
  {
    id: 'IMP-070',
    title: 'Alpha 3 Modularity Hardening: iOS Backing-Store Write Guard, True Utils Isolation, Zero-Cycle Gate, Core Typecheck & Wrapper Contracts',
    category: 'stability-pwa',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Review the completed Alpha 3 modularity rollout, fix missed runtime bugs and boundary leaks, eliminate circular dependencies, harden core storage/bridge adapters, and add an isolated core build profile.',
    summary:
      'Fixes a critical `WebSqliteAdapter` persistence bug where `persistToDiskLocked` and `findRecoveredBackupSnapshot` short-circuited on `!getSafeIndexedDb()` before checking `this.backingStore` (verified with an end-to-end no-IDB SQLite WASM round-trip test over `NativeBridgeStorageAdapter`); syncs injected bridges in `PlatformBridgeProvider`; decouples `src/utils/webFileActions.ts`, `src/utils/googleCalendarClient.ts`, and `src/utils/webPdfActions.ts` (`src/utils/canvasUtils.ts`) from all `src/storage/*` imports and breaks all 3 circular dependencies (`opfsStorage <-> localSyncChannels <-> webFileActions`, `inputSanitization <-> syncOutbox <-> showResults`); adds forbidden-import checks for `src/utils/*` and a DFS zero-cycle test in `modularLayerArchitecture.test.ts`; wires Electron `onBackPressed` in `PlatformBridge`, adds `VersionError`/`QuotaExceededError` hooks to `IndexedDbStorageAdapter`, adds `wasmUrl` to `SqliteWasmStorageAdapter`, and adds SHA-256 + FNV-1a verification to `PortableStorageBundle`; adds `configureCapturedIdeasBackingStore` for iOS anti-eviction; adds modular `core` barrels (`src/engine/index.ts`, `src/engine/codecs/index.ts`, `src/engine/sync/index.ts`) and `tsconfig.engine.json` (`npm run verify:engine`), fixing an ES2019 `.trimStart()` leak in `sanitization.ts`; removes remaining `as any` casts in tests and temporary root plan files; and completes `apple-wrapper/` and `desktop-wrapper/` bridge/storage/installer contracts.',
    files: [
      'src/storage/webSqliteAdapter.ts',
      'src/storage/__tests__/nativeBackingStore.test.ts',
      'src/app/PlatformBridgeContext.tsx',
      'src/utils/canvasUtils.ts',
      'src/utils/webPdfActions.ts',
      'src/utils/googleCalendarClient.ts',
      'src/utils/webFileActions.ts',
      'src/utils/es2018Shims.ts',
      'src/app/pedigreeAppWiring.ts',
      'src/domain/inputSanitization.ts',
      'src/domain/syncOutbox.ts',
      'src/engine/primitives/sanitization.ts',
      'src/engine/bridge/desktopBridgeAdapter.ts',
      'src/engine/bridge/platformBridge.ts',
      'src/engine/storage/browserStorageAdapters.ts',
      'src/engine/storage/sqliteWasmStorageAdapter.ts',
      'src/engine/storage/resilientStorageAdapter.ts',
      'src/storage/capturedIdeasStore.ts',
      'src/storage/photoHydration.ts',
      'src/engine/index.ts',
      'src/engine/codecs/index.ts',
      'src/engine/sync/index.ts',
      'tsconfig.engine.json',
      'package.json',
      'apple-wrapper/BRIDGE_CONTRACT.md',
      'apple-wrapper/WKWebViewSQLiteContract.md',
      'desktop-wrapper/BRIDGE_CONTRACT.md',
      'desktop-wrapper/INSTALLER_TARGETS.md',
      'src/domain/__tests__/modularLayerArchitecture.test.ts',
      'EXTRACTION_INVENTORY.md',
    ],
    invariants: [
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: ['(!this.backingStore && !getSafeIndexedDb())'],
      },
      {
        filePath: 'src/utils/webFileActions.ts',
        requiredSubstrings: ['configureWebFileRuntime', 'WebFileRuntimeHooks'],
        forbiddenSubstrings: ['../storage/'],
      },
      {
        filePath: 'tsconfig.engine.json',
        requiredSubstrings: ['src/engine/index.ts', 'src/features/**/*.ts', 'src/utils/*.ts'],
      },
      {
        filePath: 'package.json',
        requiredSubstrings: ['"verify:engine": "tsc -p tsconfig.engine.json --noEmit"'],
      },
      {
        filePath: 'src/domain/__tests__/modularLayerArchitecture.test.ts',
        requiredSubstrings: ['enforces zero circular dependencies across core, features, app, utils, and storage'],
      },
    ],
    restorePlaybook: [
      'Keep `(!this.backingStore && !getSafeIndexedDb())` guards in `src/storage/webSqliteAdapter.ts` and preserve `src/storage/__tests__/nativeBackingStore.test.ts`.',
      'Keep `configureWebFileRuntime`, `configureGoogleCalendarClient`, and `src/utils/canvasUtils.ts` decoupled from `src/storage/*` and wired in `src/app/pedigreeAppWiring.ts`.',
      'Keep `tsconfig.engine.json`, `npm run verify:engine`, and the zero-cycle test in `src/domain/__tests__/modularLayerArchitecture.test.ts`.',
    ],
  },
  {
    id: 'IMP-071',
    title: 'Engine Extraction Readiness: Core→Domain Rename, Engine Dependency Direction, Layer Audit Ratchet & Shared Text Encoders',
    category: 'stability-pwa',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Review the modularity rollout, fix gaps after the `@core` → `@engine` migration, avoid the term "core" (reserved for the Core Pedigree brand), and add automated enforcement.',
    summary:
      'Moves `binaryEncoding` and `archiveAndCsvUtils` into `src/engine` (shims remain in `src/domain`); renames `src/core/` to `src/domain/` (`@domain`) with the `App.tsx` boot-lock checksum updated; adds `npm run verify:layers` (`scripts/audit-layers.ts`, shrinking-allowlist ratchet) in CI alongside `verify:engine`; globs `tsconfig.engine.json`; moves engine-only tests to `src/engine/__tests__`; and shares CSV/ICS encoders via `@engine/codecs/textFormats`.',
    files: [
      'src/engine/binaryEncoding.ts',
      'src/engine/codecs/archiveAndCsvUtils.ts',
      'src/engine/codecs/textFormats.ts',
      'scripts/audit-layers.ts',
      'scripts/layer-allowlist.json',
      'tsconfig.engine.json',
      'package.json',
      '.github/workflows/ci.yml',
      'EXTRACTION_INVENTORY.md',
    ],
    invariants: [
      {
        filePath: 'src/engine/index.ts',
        requiredSubstrings: ["'./binaryEncoding'", "'./codecs/archiveAndCsvUtils'"],
        forbiddenSubstrings: ['../domain/'],
      },
      {
        filePath: 'src/engine/codecs/textFormats.ts',
        requiredSubstrings: ['escapeCsvCell', 'escapeCsvCellWithLimit', 'escapeIcsText', 'formatIcsAlarmTrigger'],
      },
      {
        filePath: 'package.json',
        requiredSubstrings: ['"verify:layers": "tsx scripts/audit-layers.ts"'],
      },
      {
        filePath: '.github/workflows/ci.yml',
        requiredSubstrings: ['npm run verify:layers', 'npm run verify:engine'],
      },
    ],
    restorePlaybook: [
      'Keep implementations of `binaryEncoding`, `archiveAndCsvUtils` and `textFormats` under `src/engine/` with only re-export shims in `src/domain/`.',
      'Keep `scripts/audit-layers.ts` and `scripts/layer-allowlist.json` (entries may only be removed) and run them in CI.',
      'Use `@domain` / `src/domain/` for pedigree domain logic; never reintroduce "core" in layer names.',
    ],
  },
  {
    id: 'IMP-072',
    title: 'Isolated Engine Extraction Rehearsal Gate & Shared Text-Format Codec Tests',
    category: 'stability-pwa',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Add an automated temp-directory extraction rehearsal proving @engine, @features, and src/utils compile standalone without domain/app/storage files, and add direct engine codec unit tests.',
    summary:
      'Adds `scripts/rehearse-engine-extraction.ts` (`npm run verify:extraction`) which copies `src/engine`, `src/features`, `src/utils`, `tsconfig.json`, and `tsconfig.engine.json` into an isolated temp directory and runs `tsc -p tsconfig.engine.json --noEmit` with zero `src/domain`, `src/app`, `src/storage`, `src/hooks`, or `src/components` files present; wires `verify:extraction` into `.github/workflows/ci.yml`; and adds `src/engine/__tests__/textFormats.test.ts` covering CSV cell escaping, `.map(escapeCsvCell)` safety, and RFC-5545 ICS formatting.',
    files: [
      'scripts/rehearse-engine-extraction.ts',
      'package.json',
      '.github/workflows/ci.yml',
      'src/engine/__tests__/textFormats.test.ts',
    ],
    invariants: [
      {
        filePath: 'package.json',
        requiredSubstrings: ['"verify:extraction": "tsx scripts/rehearse-engine-extraction.ts"'],
      },
      {
        filePath: '.github/workflows/ci.yml',
        requiredSubstrings: ['npm run verify:extraction'],
      },
      {
        filePath: 'scripts/rehearse-engine-extraction.ts',
        requiredSubstrings: ["'src/engine'", "'src/features'", "'src/utils'", "'tsconfig.engine.json'"],
      },
    ],
    restorePlaybook: [
      'Keep `scripts/rehearse-engine-extraction.ts` and `"verify:extraction"` in `package.json` and `.github/workflows/ci.yml`.',
      'Keep `src/engine/__tests__/textFormats.test.ts` testing `@engine/codecs/textFormats`.',
    ],
  },
  {
    id: 'IMP-073',
    title: 'Shared Canvas/OCR Decoding, SQLite Statement Cleanup & Workflow Modularity Gates',
    category: 'stability-pwa',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Improve modularity and workflows, verify boot and loading, optimize memory management, and reduce token use.',
    summary:
      'Consolidates duplicated image-blob decoding, ObjectURL/bitmap teardown, and contrast-grayscale OCR canvas preprocessing into `src/utils/canvasUtils.ts` (`decodeBlobToCanvasSource`, `buildContrastGrayscaleCanvas`, `releaseCanvas`) across `pedigreeOcrScanner.ts`, `feedTagOcr.ts`, and `webImageOptimizer.ts`; wraps `queryObjectsFromDb` prepared-statement stepping in `try/finally { stmt.free(); }` in `src/storage/webSqliteAdapter.ts`; adds npm download caching, concurrency cancellation, and `verify:layers`/`verify:engine`/`verify:extraction` gates across `.github/workflows/ci.yml`, `deploy-pages.yml`, `build-android-apk.yml`, and `guardrails.yml`; and excludes `.vite`, `.idea`, `.vscode`, `import`, `upload`, and `.map` artifacts in `export_repo_to_md.yml`.',
    files: [
      'src/utils/canvasUtils.ts',
      'src/storage/pedigreeOcrScanner.ts',
      'src/storage/feedTagOcr.ts',
      'src/storage/webImageOptimizer.ts',
      'src/storage/webSqliteAdapter.ts',
      '.github/workflows/ci.yml',
      '.github/workflows/deploy-pages.yml',
      '.github/workflows/build-android-apk.yml',
      '.github/workflows/guardrails.yml',
      '.github/workflows/export_repo_to_md.yml',
    ],
    invariants: [
      {
        filePath: 'src/utils/canvasUtils.ts',
        requiredSubstrings: [
          'decodeBlobToCanvasSource',
          'buildContrastGrayscaleCanvas',
          'releaseCanvas',
        ],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: ['try {', 'stmt.free();', '} finally {'],
      },
      {
        filePath: '.github/workflows/deploy-pages.yml',
        requiredSubstrings: ['bun run verify:layers', 'bun run verify:engine', 'bun run verify:extraction'],
      },
      {
        filePath: '.github/workflows/build-android-apk.yml',
        requiredSubstrings: ['npm run verify:layers', 'npm run verify:engine', 'npm run verify:extraction'],
      },
    ],
    restorePlaybook: [
      'Keep `decodeBlobToCanvasSource`, `buildContrastGrayscaleCanvas`, and `releaseCanvas` centralized in `src/utils/canvasUtils.ts` and imported by `pedigreeOcrScanner.ts`, `feedTagOcr.ts`, and `webImageOptimizer.ts`.',
      'Keep `try/finally { stmt.free(); }` in `queryObjectsFromDb` inside `src/storage/webSqliteAdapter.ts`.',
      'Keep `verify:layers`, `verify:engine`, and `verify:extraction` active in `ci.yml`, `deploy-pages.yml`, and `build-android-apk.yml`.',
    ],
  },
  {
    id: 'IMP-074',
    title: 'Settings UI/UX Modernization, Logical Subunits, Title Header & System Links',
    category: 'workflow-polish',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Improve the UI/UX of the settings page by condensing logically related items into shared subunits in logical order, adding title text, and providing links to prompts, about, developer, and help pages.',
    summary:
      'Reorganizes `SettingsAndSyncScreen.tsx` into 8 clean, logically ordered subunits beneath a prominent page header and quick-jump navigation bar linking to Prompts (`onOpenPromptsDirectory`), About (`AboutModal.tsx`), Developer (`onOpenTechyStuff`), and Help & Husbandry Guides (`onOpenHelpDocs`); groups Farm Identity, Species Setup, Measurement Units, Appearance Studio, Calendar Alarms, Storage & Image Compression, Backup & Installation, and System Resources; and coordinates return routing from `PromptsDirectoryScreen` in `src/App.tsx`.',
    files: [
      'src/components/SettingsAndSyncScreen.tsx',
      'src/components/AboutModal.tsx',
      'src/App.tsx',
    ],
    invariants: [
      {
        filePath: 'src/components/SettingsAndSyncScreen.tsx',
        requiredSubstrings: [
          'Settings &amp; Preferences',
          'onOpenPromptsDirectory',
          'handleOpenAboutTrigger',
          'AboutModal',
        ],
      },
      {
        filePath: 'src/components/AboutModal.tsx',
        requiredSubstrings: [
          'Community Pedigree',
          '100% On-Device',
          'Zero Telemetry',
          'AGPL-3.0',
        ],
      },
      {
        filePath: 'src/App.tsx',
        requiredSubstrings: [
          'returnRouteFromPrompts',
          'onOpenPromptsDirectory',
        ],
      },
    ],
    restorePlaybook: [
      'Keep Settings header title, quick navigation links (Prompts, About, Developer, Help), and 8 modular subunits in `src/components/SettingsAndSyncScreen.tsx`.',
      'Keep `AboutModal.tsx` accessible modal showing offline guarantees and AGPL license.',
      'Keep `returnRouteFromPrompts` and `onOpenPromptsDirectory` wired in `src/App.tsx`.',
    ],
  },
  {
    id: 'IMP-075',
    title: 'Dependency Reduction, Deprecated API & Legacy Config Remediation',
    category: 'ci-tooling',
    source: 'session',
    release: 'alpha-3',
    userIntent:
      'Remove unused/deprecated dependencies, replace outdated runtime/API calls and legacy syntax, and clean up unsupported or obsolete configurations across the app without feature loss.',
    summary:
      'Removes unused `autoprefixer` (and its unused transitive PostCSS helpers) since Tailwind CSS v4 (`@tailwindcss/vite`) handles prefixing natively via Lightning CSS; moves `@types/sql.js` from `dependencies` to `devDependencies` (`^1.16.1`) with strict peer-dependency resolution verified; strips obsolete `experimentalDecorators`, `useDefineForClassFields`, and `allowJs` from `tsconfig.json`; uses `node:path` in `vite.config.ts`; adds standard `<meta name="mobile-web-app-capable" content="yes" />` alongside iOS meta tags in `index.html`; replaces deprecated Annex B `escape()`/`unescape()` fallbacks in `src/engine/binaryEncoding.ts` with pure RFC 3629 UTF-8 encode/decode loops (covered by `binaryEncoding.test.ts`); prefers `navigator.userAgentData?.platform` before `navigator.platform` in `src/storage/storageProtection.ts`; migrates `PWAInstallButton.tsx` off legacy `React.FC`; and updates `bg-gradient-to-br` to Tailwind v4 `bg-linear-to-br` in `ImportExportHubScreen.tsx`.',
    files: [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'index.html',
      'src/engine/binaryEncoding.ts',
      'src/domain/__tests__/binaryEncoding.test.ts',
      'src/storage/storageProtection.ts',
      'src/components/PWAInstallButton.tsx',
      'src/components/ImportExportHubScreen.tsx',
    ],
    invariants: [
      {
        filePath: 'package.json',
        requiredSubstrings: ['"@types/sql.js"'],
        forbiddenSubstrings: ['"autoprefixer"'],
      },
      {
        filePath: 'tsconfig.json',
        requiredSubstrings: ['"target": "ES2018"', '"jsx": "react-jsx"'],
        forbiddenSubstrings: ['"experimentalDecorators"', '"allowJs"'],
      },
      {
        filePath: 'vite.config.ts',
        requiredSubstrings: ["import path from 'node:path';"],
      },
      {
        filePath: 'index.html',
        requiredSubstrings: ['<meta name="mobile-web-app-capable" content="yes" />'],
      },
      {
        filePath: 'src/engine/binaryEncoding.ts',
        requiredSubstrings: ['RFC 3629 UTF-8 fallback'],
        forbiddenSubstrings: ['unescape(', 'escape(raw)'],
      },
      {
        filePath: 'src/components/PWAInstallButton.tsx',
        requiredSubstrings: ['export function PWAInstallButton(', 'export function OfflineIndicator()'],
        forbiddenSubstrings: ['React.FC'],
      },
    ],
    restorePlaybook: [
      'Keep `autoprefixer` removed from `package.json` and `@types/sql.js` in `devDependencies`.',
      'Keep `experimentalDecorators`, `useDefineForClassFields`, and `allowJs` out of `tsconfig.json`, and keep `node:path` in `vite.config.ts`.',
      'Keep `<meta name="mobile-web-app-capable" content="yes" />` in `index.html`.',
      'Preserve pure RFC 3629 UTF-8 fallback in `src/engine/binaryEncoding.ts` (no `escape`/`unescape`), `userAgentData?.platform` check in `src/storage/storageProtection.ts`, React 19 function components in `src/components/PWAInstallButton.tsx`, and `bg-linear-to-br` in `src/components/ImportExportHubScreen.tsx`.',
    ],
  },
  {
    id: 'IMP-076',
    title: 'Older-Browser Performance, Zero-Dep ES2018+ Shims & Graceful CSS/API Fallbacks',
    category: 'stability-pwa',
    source: 'session',
    release: 'alpha-3',
    userIntent:
      'Improve performance and runtime compatibility in older ES2018-era browsers while preserving memory management, strict modularity, and graceful degradation when APIs or CSS features are unavailable.',
    summary:
      'Extends zero-dependency `src/utils/es2018Shims.ts` with non-enumerable, frozen-host-safe shims for `queueMicrotask`, `Object.hasOwn`, `String.prototype.replaceAll`, `Array.prototype.at`, and `String.prototype.at` (covered in `es2018AndPwaUpdate.test.ts`); guards `AbortController` and timeout cleanup in `src/storage/weatherForecast.ts` so older browsers without `AbortController` degrade gracefully; adds `flex-basis` and `@supports not (height: 1dvh)` viewport fallbacks plus `html.pedigree-low-power` / `prefers-reduced-transparency` / `prefers-reduced-motion` GPU compositing reductions in `src/index.css` wired via `useDeviceCapability` with unmount cleanup in `src/storage/deviceCapabilityDetector.ts` (preserving boot-locked `src/App.tsx`); and adds `loading="lazy" decoding="async"` to list/gallery thumbnails in `HerdScreen.tsx`, `SpeciesDashboardScreen.tsx`, `FeedLedgerScreen.tsx`, and `AnimalPhotoGallery.tsx`.',
    files: [
      'src/utils/es2018Shims.ts',
      'src/storage/weatherForecast.ts',
      'src/storage/deviceCapabilityDetector.ts',
      'src/index.css',
      'src/components/HerdScreen.tsx',
      'src/components/SpeciesDashboardScreen.tsx',
      'src/components/FeedLedgerScreen.tsx',
      'src/components/AnimalPhotoGallery.tsx',
      'src/storage/__tests__/es2018AndPwaUpdate.test.ts',
    ],
    invariants: [
      {
        filePath: 'src/utils/es2018Shims.ts',
        requiredSubstrings: [
          'queueMicrotaskShim',
          'objectHasOwnShim',
          'stringReplaceAllShim',
          'arrayAtShim',
          'stringAtShim',
        ],
      },
      {
        filePath: 'src/storage/weatherForecast.ts',
        requiredSubstrings: [
          "typeof AbortController === 'function' ? new AbortController() : null",
          'if (timer !== null) clearTimeout(timer);',
        ],
      },
      {
        filePath: 'src/index.css',
        requiredSubstrings: [
          '@supports not (height: 1dvh)',
          'html.pedigree-low-power',
          'prefers-reduced-transparency: reduce',
          'prefers-reduced-motion: reduce',
        ],
      },
      {
        filePath: 'src/storage/deviceCapabilityDetector.ts',
        requiredSubstrings: [
          'isLegacyOrLowPowerDevice',
          "classList.toggle('pedigree-low-power'",
          "classList.remove('pedigree-low-power')",
        ],
      },
    ],
    restorePlaybook: [
      'Keep `queueMicrotask`, `Object.hasOwn`, `String.prototype.replaceAll`, `Array.prototype.at`, and `String.prototype.at` shims in `src/utils/es2018Shims.ts`.',
      'Keep guarded `AbortController` and `if (timer !== null) clearTimeout(timer)` in `src/storage/weatherForecast.ts`.',
      'Keep `@supports not (height: 1dvh)` and `html.pedigree-low-power` / reduced-motion rules in `src/index.css` and the cleanup `useEffect` in `src/storage/deviceCapabilityDetector.ts`.',
      'Keep `loading="lazy" decoding="async"` on list/gallery thumbnail `<img>` tags.',
    ],
  },
  {
    id: 'IMP-077',
    title: 'Settings Consolidation, Collapsible Subunits, Open All Control & Jump Navigation',
    category: 'workflow-polish',
    source: 'session',
    release: 'alpha-3',
    userIntent:
      'Merge overlapping items into unified units/subsections, simplify Settings navigation, make every subunit collapsible with all subunits collapsed by default except the top unit closest to the title, and add an Open All button near the title.',
    summary:
      'Consolidates duplicated Quick Launchers (Backup Hub, Health Library, Help Guides, Developer, About, Prompts) into a single unified bar inside the Top Unit of `SettingsAndSyncScreen.tsx`, merges `Species & Workspace Setup` with `Units, Currency & Pedigree Standards`, and merges `Backup, Sync & Installation` with `Keyboard Navigation Shortcuts`; adds a "Jump to Settings Section" navigation strip that auto-expands and scrolls to each subunit; makes all subunits (including the Top Overview subunit) collapsible via `subunitOpen` state (`top_overview: true` by default, all 6 configuration subunits `false` by default); and adds an `Open All` / `Collapse All` button directly beside the title.',
    files: ['src/components/SettingsAndSyncScreen.tsx'],
    invariants: [
      {
        filePath: 'src/components/SettingsAndSyncScreen.tsx',
        requiredSubstrings: [
          'createDefaultSubunitOpenMap',
          'handleToggleOpenAll',
          'Open All',
          'Collapse All',
          'jumpToSection',
          'Species, Workspace &amp; Pedigree Standards',
          'Backup, Sync, Install &amp; Shortcuts',
        ],
      },
    ],
    restorePlaybook: [
      'Keep `createDefaultSubunitOpenMap()` with `top_overview: true` and all 6 settings subunits `false` by default in `src/components/SettingsAndSyncScreen.tsx`.',
      'Keep `handleToggleOpenAll` (`Open All` / `Collapse All`) in the top header beside `Settings &amp; Preferences` and `jumpToSection` navigation inside the top overview panel.',
      'Keep consolidated `Species, Workspace &amp; Pedigree Standards` and `Backup, Sync, Install &amp; Shortcuts` subunits without duplicating top-bar launcher cards.',
    ],
  },
  {
    id: 'IMP-078',
    title: 'Multi-Platform & Multi-Model Agent Rules, NO PENDING WORK Notice & Preflight Tooling Repair',
    category: 'ci-tooling',
    source: 'session',
    release: 'alpha-3',
    userIntent:
      'Optimize repository rules, prompt workflows, and preflight tooling for broad compatibility across coding platforms and models, and change the no-pending notice to NO PENDING WORK.',
    summary:
      'Updates `GEMINI.md` Startup Check notice from `NO PENDING PLANS OR HANDOFFS` to `NO PENDING WORK` with explicit cross-model/read-only applicability; reconciles `AGENTS.md`, `ROADMAP.md`, and `prompts/master_system_prompt.md` around model-agnostic `BOOT_ENTRY_LOCK_CHECKSUMS`, full three-layer boundaries (`engine/`, `features/`, `domain/`, `app/`), and CLI fallbacks; expands `CLAUDE.md`, `.cursor/rules/project.mdc`, `.windsurfrules`, and `.github/copilot-instructions.md` with inline non-negotiable guardrails and adds `.clinerules`, `.roorules`, `.aider.conf.yml`, and path-scoped `.cursor/rules/*` + `.github/instructions/*` synced in `.github/structure.txt`; fixes stale `src/core/` and AI Studio-only references in `/prompts/`; repairs invalid JSON, stray characters, JS syntax errors, missing `preflight-run-context.mjs`, and `.github/workflows/preflight.yml` in `prompts/preflight/`; and adds a unified `npm run verify` script plus `tsconfig.json` excludes.',
    files: [
      'GEMINI.md',
      'AGENTS.md',
      'ROADMAP.md',
      'prompts/master_system_prompt.md',
      'CLAUDE.md',
      '.cursor/rules/project.mdc',
      '.windsurfrules',
      '.github/copilot-instructions.md',
      '.clinerules',
      '.roorules',
      '.aider.conf.yml',
      '.github/structure.txt',
      'prompts/start_new_backlog_prompt.md',
      'prompts/resume_backlog_plan_prompt.md',
      'prompts/fix_error_log_prompt.md',
      'prompts/preflight/preflight.config.json',
      'prompts/preflight/handoff-state.schema.json',
      'prompts/preflight/manifest/preflight.manifest.json',
      'prompts/preflight/scripts/preflight-lint.mjs',
      'prompts/preflight/scripts/preflight-log.mjs',
      'prompts/preflight/scripts/gen-preflight.mjs',
      'prompts/preflight/scripts/preflight-run-context.mjs',
      'prompts/preflight/pf-launcher-uni.md',
      '.github/workflows/preflight.yml',
      'package.json',
      'tsconfig.json',
    ],
    invariants: [
      {
        filePath: 'GEMINI.md',
        requiredSubstrings: ['NO PENDING WORK', 'Startup Check: Incomplete Plan / Work Notice'],
        forbiddenSubstrings: ['NO PENDING PLANS OR HANDOFFS'],
      },
      {
        filePath: 'prompts/master_system_prompt.md',
        requiredSubstrings: ['NO PENDING WORK', 'engine/', 'npm run verify'],
      },
      {
        filePath: 'package.json',
        requiredSubstrings: ['"verify":', '"preflight:lint": "node prompts/preflight/scripts/preflight-lint.mjs"'],
      },
      {
        filePath: 'prompts/start_new_backlog_prompt.md',
        requiredSubstrings: ['src/domain/improvementRegistry.ts'],
        forbiddenSubstrings: ['src/core/improvementRegistry.ts'],
      },
    ],
    restorePlaybook: [
      'Keep `NO PENDING WORK` in `GEMINI.md`, `AGENTS.md`, and `prompts/master_system_prompt.md`.',
      'Keep inline non-negotiable summaries and adapters across `CLAUDE.md`, `.cursor/rules/*`, `.windsurfrules`, `.github/copilot-instructions.md`, `.clinerules`, `.roorules`, and `.aider.conf.yml`.',
      'Keep valid JSON and zero-dependency `prompts/preflight/scripts/*.mjs` plus `"verify"` in `package.json`.',
    ],
  },
  {
    id: 'IMP-079',
    title: 'Reusable Modularity Check & Reusability Check Prompts + Two-Pass Boundary & Utility Consolidation',
    category: 'ci-tooling',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Provide project-agnostic reusable modularity and reusability evaluation/remediation prompts in /prompts/, improve both prompts, and apply two passes of modularity and reusability improvements across the codebase.',
    summary:
      'Adds reusable, protected `prompts/modularity_check_prompt.md` (`Modularity Check`) and `prompts/reusability_check_prompt.md` (`Reusability Check`) registered in `src/domain/promptsCatalog.ts`; expands `scripts/audit-layers.ts` to audit `hooks/` and `components/`, block `node:*` imports in browser source with comment/string-literal-safe import parsing, and verifies zero upward leaks by moving `PendingGoogleCalendarSync` from `CalendarIntegrationModals.tsx` to `src/domain/calendarExport.ts`; consolidates duplicated slugifiers, `escapeRegExp`, `escapeHtml`, `dataUrlToBinary`, and `fnv1a32Base36` onto `@engine/primitives/sanitization`, `@engine/binaryEncoding`, and `@engine/primitives/crypto`; exports `resetLazyRouteDefaults`, `resetWebFileConfiguration`, and `resetGoogleCalendarClientConfiguration` singleton reset hooks; and expands cycle/bridge test coverage in `modularLayerArchitecture.test.ts` with accurate `@engine/*` alias resolution.',
    files: [
      'prompts/modularity_check_prompt.md',
      'prompts/reusability_check_prompt.md',
      'src/domain/promptsCatalog.ts',
      'scripts/audit-layers.ts',
      'src/engine/primitives/sanitization.ts',
      'src/engine/primitives/crypto.ts',
      'src/domain/calendarExport.ts',
      'src/hooks/useBarnStore.ts',
      'src/utils/webPdfActions.ts',
      'src/utils/lazyRoute.tsx',
      'src/utils/webFileActions.ts',
      'src/utils/googleCalendarClient.ts',
      'src/domain/__tests__/modularLayerArchitecture.test.ts',
    ],
    invariants: [
      {
        filePath: 'prompts/modularity_check_prompt.md',
        requiredSubstrings: [
          '# Modularity Check',
          'Prompt Reusability:',
          'DO_NOT_REMOVE_WITHOUT_CONFIRMATION',
        ],
      },
      {
        filePath: 'prompts/reusability_check_prompt.md',
        requiredSubstrings: [
          '# Reusability Check',
          'Prompt Reusability:',
          'DO_NOT_REMOVE_WITHOUT_CONFIRMATION',
        ],
      },
      {
        filePath: 'scripts/audit-layers.ts',
        requiredSubstrings: ['hooks:', 'components:', 'extractSpecifiers', 'withoutComments'],
      },
      {
        filePath: 'src/engine/primitives/crypto.ts',
        requiredSubstrings: ['export function fnv1a32Base36'],
      },
      {
        filePath: 'src/engine/primitives/sanitization.ts',
        requiredSubstrings: ['export function escapeRegExp', 'export function slugifySegment'],
      },
      {
        filePath: 'src/utils/lazyRoute.tsx',
        requiredSubstrings: ['export function resetLazyRouteDefaults'],
      },
      {
        filePath: 'src/utils/webFileActions.ts',
        requiredSubstrings: ['export function resetWebFileConfiguration'],
      },
      {
        filePath: 'src/utils/googleCalendarClient.ts',
        requiredSubstrings: ['export function resetGoogleCalendarClientConfiguration'],
      },
    ],
    restorePlaybook: [
      'Keep `prompts/modularity_check_prompt.md` and `prompts/reusability_check_prompt.md` registered in `src/domain/promptsCatalog.ts`.',
      'Keep `hooks/` and `components/` coverage plus comment/string-safe scanning in `scripts/audit-layers.ts` and keep `PendingGoogleCalendarSync` in `src/domain/calendarExport.ts`.',
      'Keep shared `escapeRegExp`, `slugifySegment`, `fnv1a32Base36`, and `dataUrlToBinary` reuse across domain and utils modules, plus `resetLazyRouteDefaults`, `resetWebFileConfiguration`, and `resetGoogleCalendarClientConfiguration`.',
    ],
  },
  {
    id: 'IMP-080',
    title: 'Dev Lucide ESM Resolution, Boot Graph Decoupling & Parallel SQLite Startup Hydration',
    category: 'stability-pwa',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Diagnose and eliminate extreme dev/first-load latency and shrink the initial boot bundle and startup SQLite/IndexedDB waterfall.',
    summary:
      'Fixes `devLucideDirectImportPlugin()` in `vite.config.ts` to read `lucide-react/dist/esm/lucide-react.mjs` (instead of missing `.js`), eliminating a 2,100+ HTTP module waterfall during Vite dev startup; relocates `CURRENT_BACKUP_SCHEMA_VERSION`, `APP_SCHEMA_BUILD_TAG`, `buildEmptyFallbackSettings`, `buildEmptyShellSnapshot`, `isSampleTestingId`, species testing record counters, and `reconcileCarrierTraitLists` into `src/domain/models.ts` (with backwards-compatible facade re-exports in `backupVault.ts`, `sampleData.ts`, and `carrierGenetics.ts`); switches `barnJournal.ts`, `judgeNotebook.ts`, `mileageTaxLog.ts`, `calendarExport.ts`, `icsBuilder.ts`, `capturedIdeasStore.ts`, `pwaUpdateManager.ts`, `upgradeGate.ts`, `archiveInspector.ts`, `backupStatus.ts`, `storageProtection.ts`, `opfsStorage.ts`, `pedigreeAppWiring.ts`, and `useBarnStore.ts` to lightweight `@engine/*`/`models` imports and dynamic `import(...)` on heavy feature paths (`backupVault`, `syncAndExports`, `barnBinder`, `geneticsEngine`, `sampleData`, `pdfDocumentExtractor`); and parallelizes `initSqlJs(...)` WASM compilation with IndexedDB reads in `webSqliteAdapter.ts`.',
    files: [
      'vite.config.ts',
      'src/domain/models.ts',
      'src/domain/backupVault.ts',
      'src/domain/sampleData.ts',
      'src/domain/carrierGenetics.ts',
      'src/domain/calendarExport.ts',
      'src/domain/barnJournal.ts',
      'src/domain/judgeNotebook.ts',
      'src/domain/mileageTaxLog.ts',
      'src/domain/backupStatus.ts',
      'src/domain/upgradeGate.ts',
      'src/domain/archiveInspector.ts',
      'src/features/ics-calendar/icsBuilder.ts',
      'src/storage/pwaUpdateManager.ts',
      'src/storage/capturedIdeasStore.ts',
      'src/storage/storageProtection.ts',
      'src/storage/opfsStorage.ts',
      'src/storage/webSqliteAdapter.ts',
      'src/app/pedigreeAppWiring.ts',
      'src/hooks/useBarnStore.ts',
    ],
    invariants: [
      {
        filePath: 'vite.config.ts',
        requiredSubstrings: ['lucide-react.mjs'],
      },
      {
        filePath: 'src/domain/models.ts',
        requiredSubstrings: [
          'export const CURRENT_BACKUP_SCHEMA_VERSION',
          'export function isSampleTestingId',
          'export function reconcileCarrierTraitLists',
        ],
      },
      {
        filePath: 'src/storage/webSqliteAdapter.ts',
        requiredSubstrings: ['Promise.all([', "import('../domain/sampleData')"],
      },
      {
        filePath: 'src/storage/opfsStorage.ts',
        requiredSubstrings: ["import('../domain/backupVault')"],
      },
      {
        filePath: 'src/domain/barnJournal.ts',
        requiredSubstrings: ['@engine/codecs/textFormats'],
      },
      {
        filePath: 'src/domain/calendarExport.ts',
        requiredSubstrings: ['@engine/primitives/crypto'],
      },
    ],
    restorePlaybook: [
      'Keep `lucide-react.mjs` fallback order inside `loadLucideIconMap()` in `vite.config.ts`.',
      'Keep lightweight schema/sample/carrier helpers in `src/domain/models.ts` and dynamic imports for heavy domain modules in `webSqliteAdapter.ts`, `opfsStorage.ts`, `pedigreeAppWiring.ts`, and `useBarnStore.ts`.',
      'Keep direct `@engine/*` subpath imports in `calendarExport.ts`, `barnJournal.ts`, `judgeNotebook.ts`, `mileageTaxLog.ts`, and `icsBuilder.ts`.',
    ],
  },
  {
    id: 'IMP-081',
    title: 'Prompt Changelog Registry, Core Hygiene/PII Prompt & Split Module Catalog System',
    category: 'ci-tooling',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Audit core files for content-specific names (preserving domain modules like useBarnStore.ts), track prompt changes with recovery invariants, add an optimized core-naming + PII audit prompt, and provide a live Core/Non-Content vs Content-Specific module listing system.',
    summary:
      'Confirms `src/hooks/useBarnStore.ts` is content-specific and verifies zero content-specific filenames across `src/engine/`, `src/features/`, and `src/utils/`; adds protected reusable `prompts/core_hygiene.md` (registered in `src/domain/promptsCatalog.ts`) to audit & fix content-specific core names and human/contact PII; introduces `src/domain/promptRegistry.ts` + `PROMPT_CHANGES.md` + `scripts/verify-prompts.ts` (`npm run verify:prompts`) mirroring `improvementRegistry.ts` for `/prompts/*` recovery; and introduces `src/domain/moduleCatalog.ts` + `MODULES.md` + `scripts/list-modules.ts` (`npm run list:modules`, `npm run verify:modules`) wired into `npm run verify`.',
    files: [
      'prompts/core_hygiene.md',
      'PROMPT_CHANGES.md',
      'MODULES.md',
      'package.json',
      'src/domain/promptsCatalog.ts',
      'src/domain/promptRegistry.ts',
      'src/domain/moduleCatalog.ts',
      'scripts/verify-prompts.ts',
      'scripts/list-modules.ts',
      'src/domain/__tests__/promptsCatalog.test.ts',
      'src/domain/__tests__/promptRegistry.test.ts',
      'src/domain/__tests__/moduleCatalog.test.ts',
    ],
    invariants: [
      {
        filePath: 'prompts/core_hygiene.md',
        requiredSubstrings: [
          '<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->',
          '# Core Hygiene & PII Check',
          'Track B: Personal Identifiable Information (PII) & Human Contact Scan',
        ],
      },
      {
        filePath: 'src/domain/promptRegistry.ts',
        requiredSubstrings: [
          'export const PROMPT_CHANGES_REGISTRY',
          'export function evaluatePromptInvariants',
          'export function formatPromptChangelogMarkdown',
        ],
      },
      {
        filePath: 'src/domain/moduleCatalog.ts',
        requiredSubstrings: [
          'export function classifyModulePath',
          'export function buildModuleCatalog',
          'export function verifyNoContentNamesInCoreModules',
        ],
      },
      {
        filePath: 'package.json',
        requiredSubstrings: ['verify:prompts', 'list:modules', 'verify:modules'],
      },
    ],
    restorePlaybook: [
      'Keep `prompts/core_hygiene.md` registered in `src/domain/promptsCatalog.ts` and tracked in `src/domain/promptRegistry.ts` (`PRM-008`).',
      'Keep `PROMPT_CHANGES.md` synced from `src/domain/promptRegistry.ts` and `MODULES.md` synced via `npx tsx scripts/list-modules.ts --write`.',
      'Keep `verify:prompts` and `verify:modules` chained into `npm run verify` in `package.json`.',
    ],
  },
  {
    id: 'IMP-082',
    title: 'Three-Phase Full-Sweep Routine, Catalog/Inventory Sync & Typed Memory Probe',
    category: 'ci-tooling',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Define one comprehensive full-sweep verification routine and clear every issue it surfaced: stale MODULES.md, missing EXTRACTION_INVENTORY coverage for the split SQLite row mapper/writer modules, and untyped performance.memory access in useBarnStore.',
    summary:
      'Records the three-phase full-sweep contract in `AGENTS.md` (repo gates, Git/CI environment, live browser runtime checks ending in a report artifact); resynchronizes `MODULES.md` with `src/` via `scripts/list-modules.ts --write`; classifies `src/storage/sqliteRowMappers.ts` and `src/storage/sqliteRowWriters.ts` as `pedigree-domain` in `EXTRACTION_INVENTORY.md` so the 100% coverage invariant passes; replaces both `as any` casts in `useBarnStore.ts` with a typed Chromium `performance.memory` interface; and commits `package-lock.json` so installs resolve deterministically.',
    files: [
      'AGENTS.md',
      'MODULES.md',
      'EXTRACTION_INVENTORY.md',
      'src/hooks/useBarnStore.ts',
      'package-lock.json',
      'IMPROVEMENTS.md',
    ],
    invariants: [
      {
        filePath: 'EXTRACTION_INVENTORY.md',
        requiredSubstrings: [
          '`src/storage/sqliteRowMappers.ts` — `pedigree-domain`',
          '`src/storage/sqliteRowWriters.ts` — `pedigree-domain`',
        ],
      },
      {
        filePath: 'MODULES.md',
        requiredSubstrings: ['sqliteRowMappers.ts', 'sqliteRowWriters.ts', 'useBarnStore.ts'],
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ['interface PerformanceMemory', 'memory?: PerformanceMemory'],
        forbiddenSubstrings: ['as any'],
      },
      {
        filePath: 'AGENTS.md',
        requiredSubstrings: [
          "### Phase 1 — The repo's own gates",
          '### Phase 2 — Repo & Git environment',
          '### Phase 3 — Agent environment',
          'Trigger: full sweep',
        ],
      },
    ],
    restorePlaybook: [
      'Regenerate `MODULES.md` with `npx tsx scripts/list-modules.ts --write` and re-run `npm run verify:modules`.',
      'Keep `src/storage/sqliteRowMappers.ts` and `src/storage/sqliteRowWriters.ts` classified as `pedigree-domain` in `EXTRACTION_INVENTORY.md`.',
      'Keep the typed `PerformanceMemory` interface in `src/hooks/useBarnStore.ts` instead of `as any`, and keep `package-lock.json` committed for deterministic installs.',
    ],
  },
  {
    id: 'IMP-083',
    title: 'Complete Gradle Wrapper, Static Android Gate & Remote APK Dispatch',
    category: 'ci-tooling',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Fix the Android wrapper issues that do not require a multi-gigabyte SDK install, document what the full build needs, and make the GitHub APK build callable from a local agent.',
    summary:
      'Completes the half-installed Gradle wrapper (adds `gradlew`, `gradlew.bat` and `gradle-wrapper.jar` pinned to 8.13, matching CI), recreates the tracked `assets/www/.gitkeep` asset root, adds `android-wrapper/scripts/stage-web-assets.sh` plus `syncWebAssets`/`verifyWebAssets` Gradle tasks so a bare assemble fails fast instead of packaging an empty shell, adds `scripts/verify-android.ts` (`npm run verify:android`, 16 static checks: wrapper completeness, Gradle/CI pin agreement, four-way release version alignment, manifest security flags, SDK levels, staging guards, dependency policy and native bridge-name agreement) wired into `npm run verify`, adds `scripts/android-build-remote.mjs` to dispatch `.github/workflows/build-android-apk.yml` through the GitHub API with a dry-run and explicit token error, and documents the JDK 17 + Android SDK (~3-4 GB) requirement in `android-wrapper/README.md`.',
    files: [
      'android-wrapper/gradlew',
      'android-wrapper/gradlew.bat',
      'android-wrapper/gradle/wrapper/gradle-wrapper.jar',
      'android-wrapper/app/src/main/assets/www/.gitkeep',
      'android-wrapper/scripts/stage-web-assets.sh',
      'android-wrapper/app/build.gradle.kts',
      'android-wrapper/README.md',
      'scripts/verify-android.ts',
      'scripts/android-build-remote.mjs',
      'package.json',
      'IMPROVEMENTS.md',
    ],
    invariants: [
      {
        filePath: 'android-wrapper/gradle/wrapper/gradle-wrapper.properties',
        requiredSubstrings: ['gradle-8.13-bin.zip'],
      },
      {
        filePath: 'android-wrapper/app/build.gradle.kts',
        requiredSubstrings: ['tasks.register<Copy>("syncWebAssets")', 'verifyWebAssets', 'dependsOn("verifyWebAssets")'],
      },
      {
        filePath: 'scripts/verify-android.ts',
        requiredSubstrings: ['[verify:android] PASS', 'Gradle wrapper is complete', 'Release version is aligned across manifests'],
      },
      {
        filePath: 'package.json',
        requiredSubstrings: ['verify:android'],
      },
      {
        filePath: 'android-wrapper/README.md',
        requiredSubstrings: ['./gradlew', 'stage-web-assets.sh', 'JDK 17'],
      },
    ],
    restorePlaybook: [
      'Keep `gradlew`, `gradlew.bat` and `gradle/wrapper/gradle-wrapper.jar` committed and pinned to Gradle 8.13; regenerate with `gradle wrapper --gradle-version 8.13` if lost.',
      'Keep `npm run verify:android` chained into `npm run verify` and run it before touching `android-wrapper/`.',
      'Keep `assets/www/.gitkeep` tracked and stage assets with `android-wrapper/scripts/stage-web-assets.sh` or `./gradlew syncWebAssets`.',
    ],
  },
  {
    id: 'IMP-084',
    title: 'Preflight Workflow Validation Fix (Never-Starting CI Job)',
    category: 'ci-tooling',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Find out why the preflight workflow had never passed and make it actually run, now that CI results are readable from the public API.',
    summary:
      'Preflight.yml had failed on all seven pushes since the repository first commit, producing zero jobs and no check-runs — GitHub rendering the workflow name as the file path, which is what it does for a definition it rejects. The `workflow_dispatch` `branch` input used `${{ github.ref_name }}` as its default, an expression GitHub does not evaluate in that position. The default is now empty and the step-level `github.event.inputs.branch || github.ref_name` fallback supplies the branch; the workflow runs all eight steps green for the first time. A forbidden-substring invariant prevents an expression default from returning.',
    files: ['.github/workflows/preflight.yml', 'IMPROVEMENTS.md'],
    invariants: [
      {
        filePath: '.github/workflows/preflight.yml',
        requiredSubstrings: [
          'name: Preflight CI',
          'workflow_dispatch',
          'npm run preflight:lint',
          'github.event.inputs.branch || github.ref_name',
        ],
        forbiddenSubstrings: ['default: "${{'],
      },
      {
        filePath: 'package.json',
        requiredSubstrings: ['preflight:lint', 'preflight'],
      },
    ],
    restorePlaybook: [
      'Keep the `branch` input default a literal empty string; resolve the branch with `${{ github.event.inputs.branch || github.ref_name }}` inside the step env instead.',
      'If the preflight run shows zero jobs and its name is the file path, the workflow definition was rejected — check `on.workflow_dispatch.inputs.*.default` first.',
    ],
  },
  {
    id: 'IMP-085',
    title: 'CI Honesty: Pages Deploy Guard & Dependency Audit Trigger Fix',
    category: 'ci-tooling',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Stop a deploy workflow from reporting failures for conditions it cannot control, and make the dependency audit actually re-run when the npm lockfile changes.',
    summary:
      'deploy-pages.yml failed on every push because `actions/configure-pages` cannot configure a site that is served from a branch, or one that does not exist in this copy of the repository. A `guard` job now asks the Pages API (with the workflow token) for the site and its `build_type`: deployment proceeds only when Pages reports `workflow`; otherwise the run ends green with a step-summary notice naming the exact Settings change, and an unreadable response falls through to the real deploy rather than blocking it. Branch triggers, Bun tooling and the SEO artifact assertions are untouched. Separately, security-audit.yml watched `bun.lock`, a file this npm project does not have, so dependency changes never triggered the audit; it now watches `package-lock.json`.',
    files: ['.github/workflows/deploy-pages.yml', '.github/workflows/security-audit.yml', 'IMPROVEMENTS.md'],
    invariants: [
      {
        filePath: '.github/workflows/deploy-pages.yml',
        requiredSubstrings: [
          'oven-sh/setup-bun',
          'bun run build --base=',
          '- main',
          '- release',
          'dist/robots.txt',
          'dist/sitemap.xml',
          'build_type',
          'needs.guard.outputs.deploy',
        ],
      },
      {
        filePath: '.github/workflows/security-audit.yml',
        requiredSubstrings: ['package-lock.json', 'android-wrapper/app/build.gradle.kts'],
        forbiddenSubstrings: ['bun.lock'],
      },
    ],
    restorePlaybook: [
      'Keep the `guard` job first and both `if: needs.guard.outputs.deploy == \'true\'` conditions on `build` and `deploy`; removing them restores the permanent red failure.',
      'Treat an unreadable Pages API response as "proceed", so a token-scope change can never silently stop real deployments.',
      'Never point the security audit at a lockfile the project does not ship.',
    ],
  },
  {
    id: 'IMP-086',
    title: 'Registry Maintainability: Five Part Modules & On-Demand Rationale Prose',
    category: 'ci-tooling',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Make the improvement registry reviewable and stop shipping explanatory prose that only the markdown/JSON export ever reads.',
    summary:
      'Splits the 85 entries out of a 6,428-line improvementRegistry.ts into five part modules (IMP-001–017 through IMP-069–085) assembled by the unchanged public surface, with shared types in improvements/types.ts so parts never import the registry that owns them. The 484 invariant rationale strings move to improvements/rationales.ts keyed entryId#filePath#ordinal and are resolved by resolveEntryRationales only for markdown export, recovery JSON and verifier messages, which the diagnostics panel loads on demand. The registry chunk drops from 287 KB to 225 KB raw (76 KB to 58.5 KB gzipped) and IMPROVEMENTS.md regenerates byte-identically; a test asserts every invariant still resolves to non-empty prose.',
    files: [
      'src/domain/improvementRegistry.ts',
      'src/domain/improvements/types.ts',
      'src/domain/improvements/rationales.ts',
      'scripts/audit-layers.ts',
    ],
    invariants: [
      {
        filePath: 'src/domain/improvementRegistry.ts',
        requiredSubstrings: [
          'export const IMPROVEMENTS_REGISTRY',
          'resolveEntryRationales',
          'formatImprovementsMarkdown',
          'buildImprovementsRecoveryJson',
        ],
        rationale:
          'The registry must keep one public surface even though its entries are split across part modules and its prose lives elsewhere.',
      },
      {
        filePath: 'vite.config.ts',
        requiredSubstrings: ['improvement-registry', 'registry-part-'],
        rationale:
          'The facade and its entry parts must stay in one chunk; splitting them produced a circular chunk pair that threw "not iterable" when the improvements panel opened.',
      },
      {
        filePath: 'src/domain/improvements/types.ts',
        requiredSubstrings: ['ImprovementRationaleMap', 'rationale?: string'],
        rationale:
          'Shared types must stay available so part modules can be typed without importing the registry, and rationale must stay optional for entries that carry it inline.',
      },
    ],
    restorePlaybook: [
      'Keep the five import and spread lines in improvementRegistry.ts; concatenating entries inline again reintroduces the 6,428-line file.',
      'When adding an entry, add its rationale to improvements/rationales.ts under entryId#filePath#ordinal — the resolution test fails if you forget.',
      'The part data files and rationales.ts are exempt from the DOM/Node text scans in scripts/audit-layers.ts because their content is prose, not code.',
      'Keep the `improvement-registry` codeSplitting group matching `improvements/registry-part-*.ts` as well as the facade — separating them reintroduces the circular chunk that broke the panel in production while dev looked fine.',
    ],
  },
  {
    id: 'IMP-087',
    title: 'Production Chunk-Cycle Gate (Dev-Passes/Prod-Breaks Guard)',
    category: 'ci-tooling',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Stop a bundling split that works in dev from shipping a production build that throws on first use.',
    summary:
      'Adds `npm run verify:chunks` (scripts/verify-chunk-graph.ts), which walks the static import edges of every emitted chunk in dist/assets and fails when two chunks import each other. Cycles that already exist in the graph are frozen in scripts/chunk-cycle-allowlist.json — a ratchet keyed by hash-stripped chunk names, so content-hash churn does not create phantom entries — and stale entries must be removed. CI runs it after the production build. This is the gate that would have caught the registry split, whose parts chunk and facade chunk imported each other and left the parts undefined at init while dev hid the problem completely.',
    files: [
      'scripts/verify-chunk-graph.ts',
      'scripts/chunk-cycle-allowlist.json',
      'package.json',
      '.github/workflows/ci.yml',
    ],
    invariants: [
      {
        filePath: 'scripts/verify-chunk-graph.ts',
        requiredSubstrings: ['chunk-cycle-allowlist', 'no new circular chunk imports', 'STATIC_IMPORT_RE'],
        rationale:
          'The gate must exist, keep its ratchet file, and keep ignoring dynamic imports while inspecting static ones.',
      },
      {
        filePath: 'package.json',
        requiredSubstrings: ['"verify:chunks"'],
        rationale: 'The gate needs a stable npm entry point for CI and the sweep.',
      },
      {
        filePath: '.github/workflows/ci.yml',
        requiredSubstrings: ['npm run verify:chunks'],
        rationale:
          'CI must run the chunk gate on the real build output; running it locally without a fresh dist proves nothing.',
      },
      {
        filePath: '.github/workflows/deploy-pages.yml',
        requiredSubstrings: ['verify:chunks'],
        rationale:
          'The Pages workflow can deploy without CI, so it must run the chunk gate on the bundle it is about to publish.',
      },
    ],
    restorePlaybook: [
      'Keep `npm run verify:chunks` in CI after `npm run build`; the check needs the emitted bundles, not the source.',
      'When it reports a new cycle, group the members in one `codeSplitting` chunk (see the improvement-registry group) instead of adding an allowlist entry.',
      'Only regenerate scripts/chunk-cycle-allowlist.json with `tsx scripts/verify-chunk-graph.ts --write-allowlist` for cycles that already predate the gate.',
    ],
  },
  {
    id: 'IMP-088',
    title: 'Diagnostics Chunks Stay Precached (Offline-First Beats Install Size)',
    category: 'stability-pwa',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Keep every reachable feature working on a first run with no network, without paying for it with a panel that only fails offline.',
    summary:
      'Excluding the lazily-imported improvement registry (`improvement-registry-*.js`) and its rationale prose (`rationales-*.js`) from the Workbox precache was measured and rejected: it trimmed install weight from 113 files / 4.64 MB to 111 / 4.35 MB, but it also meant a device that opened the developer diagnostics panel for the first time while offline got a load error there. In an offline-first app every reachable screen must work with no network, so both chunks stay in `globPatterns` and the exclusion/runtime-cache pair was removed. If install weight ever needs to shrink again, shrink the registry data itself — never the offline capability.',
    files: ['vite.config.ts'],
    invariants: [
      {
        filePath: 'vite.config.ts',
        requiredSubstrings: ['globPatterns: ['],
        forbiddenSubstrings: ['**/improvement-registry-*.js', '**/rationales-*.js', 'diagnostics-chunks'],
        rationale:
          'The diagnostics chunks must stay in the precache manifest: excluding them (or re-adding a dedicated runtime cache as a substitute) reintroduces the first-offline-open failure this entry exists to prevent.',
      },
    ],
    restorePlaybook: [
      'Do not exclude `improvement-registry-*.js` or `rationales-*.js` from `globPatterns`; a lazy import is still reachable, and reachable means precached.',
      'Before any future precache trim, test the screen offline on a device that has never visited it — the online path hides this class of bug completely.',
      'Genuine offline-safe savings must come from smaller registry data, not from dropping a feature out of the precache.',
    ],
  },
  {
    id: 'IMP-089',
    title: 'Barn Store Surface Contract (Prerequisite for the Slice Decomposition)',
    category: 'ci-tooling',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Make it impossible to lose or rename a store action while `useBarnStore` is split up, without a DOM test harness the project does not have.',
    summary:
      'The store returns 200 keys through a single context value consumed by every screen, and the repo has no jsdom/testing-library renderer, so no runtime test could catch a dropped action. `barnStoreContract.test.ts` parses the hook\'s returned object literal straight from source and compares its keys against `barnStoreContract.keys.json`. Adding a key is a normal snapshot update; removing or renaming one fails by name until the snapshot and consumers move in the same commit. The parser rejects spread and computed keys so the contract cannot be silently bypassed, and a `MIN_EXPECTED_KEYS` floor stops a parser regression from passing by finding nothing. Proven against a real edit: deleting `deviceId` from the literal fails the test naming `deviceId`. `export type BarnStore = ReturnType<typeof useBarnStore>` gives the same guarantee at the type level.',
    files: [
      'src/hooks/useBarnStore.ts',
      'src/hooks/__tests__/barnStoreContract.test.ts',
      'src/hooks/__tests__/barnStoreContract.keys.json',
    ],
    invariants: [
      {
        filePath: 'src/hooks/__tests__/barnStoreContract.test.ts',
        requiredSubstrings: ['barnStoreContract.keys.json', 'MIN_EXPECTED_KEYS', 'computed key is not allowed'],
        rationale:
          'The contract must keep comparing against its snapshot, keep its sanity floor, and keep refusing spread/computed keys.',
      },
      {
        filePath: 'src/hooks/__tests__/barnStoreContract.keys.json',
        requiredSubstrings: ['"deviceId"', '"isLoading"'],
        rationale:
          'The snapshot is the record of the public surface; deleting it or trimming it to a stub would let a decomposition drop actions unnoticed.',
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ['export type BarnStore = ReturnType<typeof useBarnStore>'],
        rationale:
          'Consumers and slices must be able to type against the exported store shape rather than re-deriving it.',
      },
    ],
    restorePlaybook: [
      'When splitting the store, carry the returned keys over unchanged and update `barnStoreContract.keys.json` only in the same commit that changes a consumer.',
      'Never satisfy this contract by adding spread (`...slice`) or computed keys: the parser rejects both on purpose.',
      'Extend this file into the per-slice contract as slices land; the snapshot stays the single source of truth for the public surface.',
    ],
  },
  {
    id: 'IMP-090',
    title: 'Barn Store Decomposition Begins: Pure Policy Leaves First',
    category: 'ci-tooling',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Start shrinking the 9.5k-line store without changing behaviour, one provably pure slice at a time.',
    summary:
      'First slice of the `useBarnStore` decomposition: `getPhotoCacheBudgetForTier` moved to `src/hooks/barnStore/photoCacheBudget.ts` with a `PhotoCacheBudget` type and its first direct unit tests (tier floors, caps, monotonicity, non-finite probes). The hook keeps all state and wiring and simply imports the policy. Extraction was made behaviour-neutral on purpose: a non-finite tier still falls through to the largest budget because that is what the inline version did, and the test now pins that as intentional rather than letting a refactor quietly change cache sizing. The `src/hooks/barnStore/*` folder is the destination for later slices; `MODULES.md` was regenerated for the new module.',
    files: [
      'src/hooks/barnStore/photoCacheBudget.ts',
      'src/hooks/__tests__/photoCacheBudget.test.ts',
      'src/hooks/useBarnStore.ts',
      'MODULES.md',
    ],
    invariants: [
      {
        filePath: 'src/hooks/barnStore/photoCacheBudget.ts',
        requiredSubstrings: ['export function getPhotoCacheBudgetForTier', 'export interface PhotoCacheBudget'],
        rationale:
          'The extracted slice must keep its public surface so the hook and any future slice share one policy.',
      },
      {
        filePath: 'src/hooks/barnStore/usePhotoCache.ts',
        requiredSubstrings: ["from './photoCacheBudget'"],
        rationale:
          'The photo-cache slice must consume the extracted budget policy rather than re-deriving cache sizes, which would let the two drift.',
      },
      {
        filePath: 'src/hooks/__tests__/photoCacheBudget.test.ts',
        requiredSubstrings: ['never shrinks as the tier rises', 'non-finite tiers'],
        rationale:
          'The slice keeps the guard rails that made it safe to move: monotonic sizing and the preserved non-finite behaviour.',
      },
    ],
    restorePlaybook: [
      'Every later slice follows this shape: pure policy to `src/hooks/barnStore/*`, state and wiring stay in the hook, tests land with the move.',
      'Never change behaviour inside a move. Pin the old quirk in a test first (as with non-finite tiers) or leave it in place.',
      'Run `npm test`, `npm run verify` and `npx tsx scripts/list-modules.ts --write` for each slice; the contract snapshot must stay untouched unless a key truly changes.',
    ],
  },
  {
    id: 'IMP-091',
    title: 'Backup-Reminder Policy Extracted From the Barn Store',
    category: 'backup-safety',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Keep the reminder logic testable and out of the monolith, without changing when or how the app nags about backups.',
    summary:
      'Second barn-store slice: the reminder persistence and snooze policy moved to `src/hooks/barnStore/backupReminder.ts`. Four inline `localStorage` blocks in the hook (state initialisers, reset, export recording, snooze) became named helpers with an injected `ReminderStorage` seam, so they are now unit-tested with fakes and a throwing storage. Behaviour is unchanged: unparsable values still read as "not snoozed", snapshot settings still win over the local mirror via `??` (an explicit stored `0` is respected, not treated as absent), snooze deadlines still use the skew-adjusted clock, and blocked storage still degrades to a no-op. The 200-key contract snapshot did not change.',
    files: [
      'src/hooks/barnStore/backupReminder.ts',
      'src/hooks/__tests__/backupReminder.test.ts',
      'src/hooks/useBarnStore.ts',
      'MODULES.md',
    ],
    invariants: [
      {
        filePath: 'src/hooks/barnStore/backupReminder.ts',
        requiredSubstrings: [
          'pedigree.backupReminderSnoozedUntil.v1',
          'pedigree.lastBackupMeta.v1',
          'resolveEffectiveSnoozedUntilMs',
          'computeSnoozedUntilMs',
        ],
        rationale:
          'The storage keys and both policy functions live only here now; losing either key would silently reset reminders for existing installs.',
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ["from './barnStore/backupReminder'"],
        forbiddenSubstrings: ['pedigree.lastBackupMeta.v1', 'pedigree.backupReminderSnoozedUntil.v1'],
        rationale:
          'The hook must consume the slice rather than re-inline storage keys, which is how the four duplicated blocks appeared in the first place.',
      },
      {
        filePath: 'src/hooks/__tests__/backupReminder.test.ts',
        requiredSubstrings: ['never throws when storage is blocked', 'explicit zero', "treats missing, empty or unparsable snooze values as \"not snoozed\""],
        rationale:
          'These three cases encode the behaviour a future refactor is most likely to break: blocked storage, explicit zero versus absent, and corrupt values.',
      },
    ],
    restorePlaybook: [
      'Reminder storage belongs to `barnStore/backupReminder.ts`; pass a `ReminderStorage` fake in tests instead of touching global `localStorage`.',
      'Keep `resolveEffectiveSnoozedUntilMs` on `??`: a stored `0` means "not snoozed" and must not fall back to the local mirror.',
      'Do not change the two storage key strings — they are the only link to reminders already snoozed on users\' devices.',
    ],
  },
  {
    id: 'IMP-092',
    title: 'Backup-Reminder Callbacks Moved Into a Sub-Hook',
    category: 'backup-safety',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Make the store actually smaller by moving the reminder actions out, not just their inline expressions.',
    summary:
      'Third barn-store slice: `recordBackupExport` and `snoozeBackupReminder` now live in `src/hooks/barnStore/useBackupReminderActions.ts`, which takes exactly the wiring it needs — `enqueueStoreMutation`, `updateSettingsInternal`, `snapshotRef`, and the two local setters. Their bodies are plain exported functions (`recordBackupExportAction`, `snoozeBackupReminderAction`) so the real logic is unit-tested without a renderer; `useBackupReminderActions` only adds `useCallback` identity with the same dependency list the inline versions had. Behaviour is unchanged: export metadata still uses the adjusted UTC clock, the snooze is cleared on export, a 24-hour default is kept, settings writes stay wrapped in the write queue and marked silent, and nothing is written to settings before a snapshot exists. `useBarnStore.ts` dropped from 9,530 to 9,498 lines and the 200-key contract snapshot is untouched.',
    files: [
      'src/hooks/barnStore/useBackupReminderActions.ts',
      'src/hooks/__tests__/backupReminderActions.test.ts',
      'src/hooks/useBarnStore.ts',
      'MODULES.md',
    ],
    invariants: [
      {
        filePath: 'src/hooks/barnStore/useBackupReminderActions.ts',
        requiredSubstrings: [
          'export function useBackupReminderActions',
          'recordBackupExportAction',
          'snoozeBackupReminderAction',
          'Deps',
        ],
        rationale:
          'The actions and their dependency contract must stay in this slice; the plain bodies are what make the behaviour testable.',
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ["from './barnStore/useBackupReminderActions'"],
        forbiddenSubstrings: ['const recordBackupExport = useCallback(', 'const snoozeBackupReminder = useCallback('],
        rationale:
          'Re-inlining either callback would undo the extraction and split the ownership of reminder behaviour again.',
      },
      {
        filePath: 'src/hooks/__tests__/backupReminderActions.test.ts',
        requiredSubstrings: ['defaults to a 24 hour snooze', 'no snapshot is loaded yet'],
        rationale:
          'The two easy-to-break behaviours: the default snooze length and skipping settings writes when no snapshot is loaded.',
      },
    ],
    restorePlaybook: [
      'Reminder actions live in `useBackupReminderActions`; extend the deps object rather than reaching back into the store for new wiring.',
      'Keep the plain `*Action` bodies exported and tested — they are the only place reminder behaviour can be verified without a DOM harness.',
      'Preserve `{ silent: true }` on these settings writes; they must not fire the "Barn preferences saved" toast after an export or snooze.',
    ],
  },
  {
    id: 'IMP-093',
    title: 'Photo Cache Cluster Moved Into a Sub-Hook',
    category: 'stability-pwa',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Get the photo cache and its four loaders out of the monolith while keeping the memory behaviour and lookup order identical.',
    summary:
      'Fourth barn-store slice: `src/hooks/barnStore/usePhotoCache.ts` now creates the bounded LRU (sized from the device capability tier) and owns the four loaders for animal photos, animal photo batches, feed-batch tags and ledger receipts. The sub-hook takes only `adapterRef`, `snapshotRef` and the live `snapshot`, and returns the cache ref plus the loaders, so the thirty-odd imperative `photoCacheRef` touch points elsewhere in the store keep working unchanged. Lookup order is unchanged and now testable: cache, snapshot data URL, storage adapter, snapshot thumbnail, with the batch loader deduping, capping at 60 ids and falling back to thumbnails when the adapter throws. Every remaining set/delete/clear in the store now goes through `rememberPhoto`, `forgetPhoto` and `clearPhotoCache` — 25 call sites, with only the read passed to `hydrateSnapshotWithPhotoDataUrls` still touching the ref directly. `useBarnStore.ts` dropped from 9,498 to 9,386 lines; the memory-pressure effect moved two statements down but still clears the same cache every five seconds above 80% heap. The 200-key contract snapshot is untouched.',
    files: [
      'src/hooks/barnStore/usePhotoCache.ts',
      'src/hooks/__tests__/photoCache.test.ts',
      'src/hooks/useBarnStore.ts',
      'MODULES.md',
    ],
    invariants: [
      {
        filePath: 'src/hooks/barnStore/usePhotoCache.ts',
        requiredSubstrings: [
          'export function usePhotoCache',
          'createBudgetedPhotoCache',
          'loadAnimalPhotoDataUrlWith',
          'loadFeedBatchTagPhotoDataUrlWith',
          'loadLedgerEntryReceiptPhotoDataUrlWith',
          'rememberPhoto',
          'forgetPhoto',
          'clearPhotoCache',
        ],
        rationale:
          'The loaders and the budgeted cache construction must stay in this slice; the plain `*With` bodies are the only testable record of the lookup order.',
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ["from './barnStore/usePhotoCache'"],
        forbiddenSubstrings: ['const loadAnimalPhotoDataUrl = useCallback('],
        rationale:
          'Re-inlining a loader would fork the cache lookup order and reopen the drift this extraction closed.',
      },
      {
        filePath: 'src/hooks/__tests__/photoCache.test.ts',
        requiredSubstrings: ['survives a failing adapter batch', 'namespaced cache key'],
        rationale:
          'The two behaviours most likely to regress: adapter failures must not break print preview, and feed/ledger keys must not collide with animal photo ids.',
      },
    ],
    restorePlaybook: [
      'Photo cache policy lives in `barnStore/usePhotoCache.ts`; the store keeps the ref only for imperative clear/set/delete calls.',
      'Keep the key prefixes (`feed-tag:`, `ledger-receipt:`) — dropping them lets a batch or entry id overwrite an animal photo.',
      'The cache is transient and rebuildable: never persist it, and keep the memory-pressure clear wired to the same ref the loaders use.',
    ],
  },
  {
    id: 'IMP-094',
    title: 'Task & Memo Alert Dismissals Moved Into a Sub-Hook',
    category: 'alerts-home',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Shrink the barn store again with the smallest remaining cluster, without changing when an ignored task or dismissed memo alert returns.',
    summary:
      'Fifth barn-store slice: `src/hooks/barnStore/useAlertDismissals.ts` now owns the three settings-only dismissal actions (permanent task-alert ignore, clearing one species overdue-alert group, dismissing a species memo alert). The sub-hook takes `enqueueStoreMutation`, `updateSettingsInternal`, `snapshotRef` and `notify`; the store keeps revisions, the outbox and the settings writer. The map merges are plain exported functions (`mergeIgnoredTaskIds`, `buildDismissedTaskGroupKeys`, `buildDismissedMemoAlertSignatures`) with a shared `normalizeAlertSpeciesKey`, so the persistence decisions are pinned by tests instead of hidden in callbacks: blank or empty-array signatures record nothing, other species are preserved, task ids dedupe against existing entries, and only the task-ignore and group-clear paths toast. Toast strings, silent writes, empty-input early returns and the no-snapshot guard are unchanged. `useBarnStore.ts` dropped from 9,391 to 9,347 lines and the 200-key contract snapshot is untouched.',
    files: [
      'src/hooks/barnStore/useAlertDismissals.ts',
      'src/hooks/__tests__/alertDismissals.test.ts',
      'src/hooks/useBarnStore.ts',
      'docs/plans/handoff-modularity-reusability.yaml',
      'MODULES.md',
    ],
    invariants: [
      {
        filePath: 'src/hooks/barnStore/useAlertDismissals.ts',
        requiredSubstrings: [
          'export function useAlertDismissals',
          'mergeIgnoredTaskIds',
          'buildDismissedTaskGroupKeys',
          'buildDismissedMemoAlertSignatures',
          'normalizeAlertSpeciesKey',
        ],
        rationale:
          'The three merges and the species-key normaliser are the only record of which dismissal survives and under which key; inlining them again would hide the rule inside a callback.',
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ["from './barnStore/useAlertDismissals'"],
        forbiddenSubstrings: ['const clearTaskAlertGroup = useCallback('],
        rationale:
          'Re-inlining a dismissal callback forks the map merge and silently changes when the alert returns.',
      },
      {
        filePath: 'src/hooks/__tests__/alertDismissals.test.ts',
        requiredSubstrings: ['Dismissed 2 task alert(s) permanently.', 'ignores a blank signature'],
        rationale:
          'The count-toasted message and the blank-signature no-op are the two behaviours most likely to drift; both are user-visible.',
      },
    ],
    restorePlaybook: [
      'Alert dismissals live in `barnStore/useAlertDismissals.ts`; the store only wires the queue, settings writer, ref and notifier.',
      'Keep `normalizeAlertSpeciesKey` shared by all three maps — divergent keys make a dismissal appear not to stick.',
      'Only the task-ignore and group-clear paths toast; memo dismissal is deliberately silent, and empty input must never write settings.',
    ],
  },
  {
    id: 'IMP-095',
    title: 'Cloud-Sync Settings & PKCE Actions Moved Into a Sub-Hook',
    category: 'diagnostics-sync',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Move the cloud app-folder settings and sign-in controls out of the store so the OAuth hand-off and its toasts are readable and testable in one place.',
    summary:
      'Sixth barn-store slice: `src/hooks/barnStore/useCloudSyncActions.ts` owns the four cloud-sync controls — persist a settings patch, adopt a hand-entered access token, disconnect, and start the OAuth PKCE redirect. Each mirrors the client-state module result into React state, so the slice takes `setCloudSyncState` and `notify`; the client-state module is reached through `CLOUD_SYNC_CLIENT_PORT`, which tests replace with fakes and production leaves unset. Behaviour is unchanged: a rejected token keeps the previously persisted `enabled` flag, persists `provider` anyway and stays silent; an accepted one forces `enabled: true` and toasts the provider label; disconnect always toasts and clears either one provider or all of them; PKCE persists `provider`, `customOAuthClientId` and `enabled` before the redirect and lets a redirect failure reject to the caller. The store keeps the sync run, background schedule and busy flag. `useBarnStore.ts` dropped from 9,347 to 9,302 lines; the 200-key contract snapshot is untouched.',
    files: [
      'src/hooks/barnStore/useCloudSyncActions.ts',
      'src/hooks/__tests__/cloudSyncActions.test.ts',
      'src/hooks/useBarnStore.ts',
      'docs/plans/handoff-modularity-reusability.yaml',
      'MODULES.md',
    ],
    invariants: [
      {
        filePath: 'src/hooks/barnStore/useCloudSyncActions.ts',
        requiredSubstrings: [
          'export function useCloudSyncActions',
          'CLOUD_SYNC_CLIENT_PORT',
          'cloudSyncProviderLabel',
          'startCloudSyncPkceAction',
        ],
        rationale:
          'The provider label and the injectable client port are what keep the four actions testable; recreating the label inline is how OneDrive and Drive toasts drift apart.',
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ["from './barnStore/useCloudSyncActions'"],
        forbiddenSubstrings: ['const startCloudSyncPkce = useCallback('],
        rationale:
          'Re-inlining an auth control would split the settings write from the state mirror and can strand a token without an enabled provider.',
      },
      {
        filePath: 'src/hooks/__tests__/cloudSyncActions.test.ts',
        requiredSubstrings: [
          'held in memory only',
          'persists provider, client id and enabled before redirecting',
        ],
        rationale:
          'Memory-only tokens are a privacy promise, and persisting settings before redirecting is what lets the OAuth callback find its provider.',
      },
    ],
    restorePlaybook: [
      'Cloud-sync controls live in `barnStore/useCloudSyncActions.ts`; the store supplies `setCloudSyncState` and `notify` and keeps the actual sync run.',
      'Never persist an access token — only settings and the custom client id may be written; tokens stay in memory by design.',
      'Persist the provider and client id before starting the PKCE redirect, or the callback cannot resolve which provider it belongs to.',
    ],
  },
  {
    id: 'IMP-096',
    title: 'OPFS Vault Save/Describe/Delete/Restore Moved Into a Sub-Hook',
    category: 'backup-safety',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Keep the vault restore path — the one operation that overwrites a live barn — in a small, tested module instead of a 9k-line hook.',
    summary:
      'Seventh barn-store slice: `src/hooks/barnStore/useOpfsVaultActions.ts` owns the four vault operations — save a manual snapshot, describe a backup by key or file name, download it, delete it, and restore it by key. The restore keeps the exact order that makes it safe to interrupt (safety snapshot → photo-cache clear → snapshot replace → sync-state clear → species reset → reload) and still runs inside `enqueueStoreMutation`; the wiped-recovery path calls the unqueued variant so it never waits on a lock it already holds. Save still mirrors to the native vault and still falls back to the rolling IndexedDB vault when OPFS is missing, with the same toasts. Storage primitives are an injectable `OPFS_VAULT_STORAGE_PORT`, so tests drive every branch without OPFS or IndexedDB. `useBarnStore.ts` dropped from 9,302 to 9,199 lines; the 200-key contract snapshot is untouched.',
    files: [
      'src/hooks/barnStore/useOpfsVaultActions.ts',
      'src/hooks/__tests__/opfsVaultActions.test.ts',
      'src/hooks/useBarnStore.ts',
      'docs/plans/handoff-modularity-reusability.yaml',
      'MODULES.md',
    ],
    invariants: [
      {
        filePath: 'src/hooks/barnStore/useOpfsVaultActions.ts',
        requiredSubstrings: [
          'export function useOpfsVaultActions',
          'OPFS_VAULT_STORAGE_PORT',
          'describeOpfsVaultBackup',
          'restoreOpfsVaultBackupUnqueued',
        ],
        rationale:
          'The injected storage port is what lets the restore path be tested without a real OPFS; the unqueued restore is what keeps the wiped-recovery path from deadlocking on the mutation lock.',
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ["from './barnStore/useOpfsVaultActions'"],
        forbiddenSubstrings: ['const restoreOpfsVaultBackupInternal = useCallback('],
        rationale:
          'Re-inlining restore would separate the safety snapshot from the replace, which is the one ordering that prevents a failed restore from destroying the only copy of a barn.',
      },
      {
        filePath: 'src/hooks/__tests__/opfsVaultActions.test.ts',
        requiredSubstrings: [
          'runs inside the mutation queue in safety order',
          'skips the safety snapshot after a wiped-storage recovery',
        ],
        rationale:
          'Those two tests are the guard rails for the restore: the order of side effects, and the deliberate exception after storage was wiped (there is nothing left to back up).',
      },
    ],
    restorePlaybook: [
      'Vault operations live in `barnStore/useOpfsVaultActions.ts`; the store supplies the snapshot refs, adapter replace and listing.',
      'Restore order is the safety contract: safety snapshot, clear photo cache, replace snapshot, clear sync/reminder state, reset species, reload — then toast.',
      'Call `restoreOpfsVaultBackupUnqueued` only from code that already runs inside `enqueueStoreMutation`, never from UI handlers.',
    ],
  },
  {
    id: 'IMP-097',
    title: 'Sync-Conflict Dismissal Moved Into a Sub-Hook',
    category: 'diagnostics-sync',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Make the two ways a sync conflict is cleared share one definition of “resolved”, so dismissing and resolving can never disagree about what the settled record looks like.',
    summary:
      'Eighth barn-store slice: `src/hooks/barnStore/useSyncConflictDismissal.ts` owns dismissing a sync conflict — find it, mark a resolved copy, persist it, replace it in the React list — and exports the two pure helpers (`buildResolvedSyncConflict`, `markSyncConflictResolved`) that `resolveSyncConflict` now also uses instead of rebuilding the same `{ ...conflict, resolved: true }` mapping inline. Behaviour is unchanged: an unknown conflict id stays a silent no-op with no IndexedDB write, dismissal applies no delta operation and toasts nothing (the toast belongs to resolve), and a failed write propagates without touching the list. The store keeps `syncConflicts` state, `resolveSyncConflict` and the sync runs. `useBarnStore.ts` dropped from 9,199 to 9,195 lines; the 200-key contract snapshot is untouched.',
    files: [
      'src/hooks/barnStore/useSyncConflictDismissal.ts',
      'src/hooks/__tests__/syncConflictDismissal.test.ts',
      'src/hooks/useBarnStore.ts',
      'docs/plans/handoff-modularity-reusability.yaml',
      'MODULES.md',
    ],
    invariants: [
      {
        filePath: 'src/hooks/barnStore/useSyncConflictDismissal.ts',
        requiredSubstrings: [
          'export function useSyncConflictDismissal',
          'buildResolvedSyncConflict',
          'markSyncConflictResolved',
        ],
        rationale:
          'Both cleared-conflict paths must build the same resolved record; a local `resolved: true` guess in either caller is how the list and IndexedDB drift apart.',
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ["from './barnStore/useSyncConflictDismissal'"],
        forbiddenSubstrings: ['const dismissSyncConflict = useCallback('],
        rationale:
          'Dismissal is the quiet path: it must not grow a delta operation or a toast of its own, which is exactly what re-inlining it next to resolve invites.',
      },
      {
        filePath: 'src/hooks/__tests__/syncConflictDismissal.test.ts',
        requiredSubstrings: [
          'persists the resolved copy before updating the list',
          'leaves the barn-data fields alone',
        ],
        rationale:
          'Dismissal must write before it mutates UI state, and it must never touch winning/losing values — those two facts are what make it a dismissal rather than a resolution.',
      },
    ],
    restorePlaybook: [
      'Conflict dismissal lives in `barnStore/useSyncConflictDismissal.ts`; the store supplies the list, its setter and the IndexedDB write.',
      'Dismissal is silent by design — no toast, no delta operation, no barn write. Only `resolveSyncConflict` applies a chosen value.',
      'Use `buildResolvedSyncConflict` + `markSyncConflictResolved` for any new cleared-conflict path instead of rebuilding the mapping.',
    ],
  },
  {
    id: 'IMP-098',
    title: 'Sync-Conflict Resolution Moved Into a Sub-Hook',
    category: 'diagnostics-sync',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Make “apply the winning/losing value” a single reviewed path, since it is the only conflict action that rewrites both the barn snapshot and the operation log.',
    summary:
      'Ninth barn-store slice: `src/hooks/barnStore/useSyncConflictResolution.ts` owns resolving a sync conflict — build the outbox operation for the chosen side, merge it into the snapshot and op log, reindex revisions, mark the conflict resolved, reload and toast. It runs inside `enqueueStoreMutation`, loads the op log only when it is not hydrated yet (and then deliberately leaves React state alone), and shares the resolved-marking helpers with dismissal. The pure sync engine is a port (`SYNC_RESOLUTION_ENGINE`), so tests assert the exact operation parameters without running a real merge. Behaviour is unchanged, including swallowing failures into `reportPersistenceFailure` and skipping unknown ids or an unloaded snapshot. The 200-key contract snapshot is untouched.',
    files: [
      'src/hooks/barnStore/useSyncConflictResolution.ts',
      'src/hooks/__tests__/syncConflictResolution.test.ts',
      'src/hooks/useBarnStore.ts',
    ],
    invariants: [
      {
        filePath: 'src/hooks/barnStore/useSyncConflictResolution.ts',
        requiredSubstrings: [
          'export function useSyncConflictResolution',
          'SYNC_RESOLUTION_ENGINE',
          'syncOperationsHydratedRef',
        ],
        rationale:
          'The hydrated check is what stops resolution from replacing the in-memory op log with a stale reloaded one; removing it silently drops operations from the sync index.',
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ["from './barnStore/useSyncConflictResolution'"],
        forbiddenSubstrings: ['const resolveSyncConflict = useCallback('],
        rationale:
          'Resolution rewrites snapshot and op log together; re-inlining it invites a caller that does only one of the two.',
      },
      {
        filePath: 'src/hooks/__tests__/syncConflictResolution.test.ts',
        requiredSubstrings: [
          'loads the operation log when it is not hydrated yet',
          'reports a failure without marking the conflict resolved',
        ],
        rationale:
          'Those are the two ways this path can corrupt sync state: stale op-log replacement and a half-applied resolution marked clean.',
      },
    ],
    restorePlaybook: [
      'Conflict resolution lives in `barnStore/useSyncConflictResolution.ts`; the store supplies the sync refs, revision index and adapter.',
      'Only resolve rewrites the barn; dismissal never applies a value.',
      'When the op log is not hydrated, use the freshly loaded operations and do not mirror the merge into React state.',
    ],
  },
  {
    id: 'IMP-099',
    title: 'Rolling IndexedDB Backup Actions Moved Into a Sub-Hook',
    category: 'backup-safety',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Give the always-available rolling vault the same tested restore ordering as the OPFS vault, instead of a second hand-copied sequence.',
    summary:
      'Tenth barn-store slice: `src/hooks/barnStore/useRollingBackupActions.ts` owns restoring and deleting rolling IndexedDB snapshots. Restore keeps the safety order (safety snapshot → photo-cache clear → replace with bookkeeping stripped → sync/reminder clear → reload → toast) inside `enqueueStoreMutation`, and intentionally differs from the OPFS restore in one way: it does not switch the active species, because the rolling snapshot came from this same app instance and the current selection is still valid. Both restore paths now share `stripRestoredBackupBookkeeping`. Storage primitives are an injectable `ROLLING_BACKUP_STORAGE_PORT`. The 200-key contract snapshot is untouched.',
    files: [
      'src/hooks/barnStore/useRollingBackupActions.ts',
      'src/hooks/__tests__/rollingBackupActions.test.ts',
      'src/hooks/useBarnStore.ts',
    ],
    invariants: [
      {
        filePath: 'src/hooks/barnStore/useRollingBackupActions.ts',
        requiredSubstrings: [
          'export function useRollingBackupActions',
          'ROLLING_BACKUP_STORAGE_PORT',
          'runDestructiveRestore',
        ],
        rationale:
          'Both restore paths must strip `lastBackupMeta` and the reminder snooze; a local copy of that cleaning step is how a restored backup immediately triggers “backup overdue” again.',
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ["from './barnStore/useRollingBackupActions'"],
        forbiddenSubstrings: ['const restoreRollingBackupByKey = useCallback('],
        rationale:
          'Re-inlining the rolling restore would let it drift from the OPFS ordering, which is the pair users rely on when one storage backend fails.',
      },
      {
        filePath: 'src/hooks/__tests__/rollingBackupActions.test.ts',
        requiredSubstrings: [
          'restores in safety order inside the mutation queue',
          'keeps the selected species',
        ],
        rationale:
          'Order is the safety contract, and the species difference from the OPFS path is deliberate — asserting it stops a future “unify these two” edit from changing behaviour.',
      },
    ],
    restorePlaybook: [
      'Rolling restore lives in `barnStore/useRollingBackupActions.ts`; the store supplies the refs, adapter replace and vault refresh.',
      'Keep restore inside the mutation queue, and keep the safety snapshot before replacing anything.',
      'Do not add a species switch here — the rolling snapshot belongs to the current session.',
    ],
  },
  {
    id: 'IMP-100',
    title: 'OPFS /archives Offload Moved Into a Sub-Hook',
    category: 'backup-safety',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Keep the archive offload — the operation that removes animals from the live barn — in a tested module that always reads the authoritative snapshot.',
    summary:
      'Eleventh and final planned barn-store slice: `src/hooks/barnStore/useOpfsArchiveOffload.ts` owns moving animals out of the active database into a zipped OPFS archive bundle: read the adapter snapshot (never React state, so a post-save offload cannot archive a stale barn), hydrate photos, build the bundle, save it, replace the snapshot with the stubs-only one, clear photo cache, drop selections pointing at animals that left, reload and toast. Empty selections, unsupported OPFS, nothing-eligible and build failures all keep their original silent-or-toast behaviour. `backupVault` stays a dynamic import so its chunk is unchanged; tests inject the builder instead of running the ZIP pipeline. The unqueued variant is exposed for callers that already hold `enqueueStoreMutation`. `useBarnStore.ts` dropped from 9,130 to 9,075 lines; the 200-key contract snapshot is untouched.',
    files: [
      'src/hooks/barnStore/useOpfsArchiveOffload.ts',
      'src/hooks/__tests__/opfsArchiveOffload.test.ts',
      'src/hooks/useBarnStore.ts',
    ],
    invariants: [
      {
        filePath: 'src/hooks/barnStore/useOpfsArchiveOffload.ts',
        requiredSubstrings: [
          'export function useOpfsArchiveOffload',
          'OPFS_ARCHIVE_STORAGE_PORT',
          'loadBundleBuilder',
        ],
        rationale:
          'The lazy bundle builder keeps `backupVault` and its ZIP code out of the main chunk; a static import here would silently undo that split.',
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ["from './barnStore/useOpfsArchiveOffload'"],
        forbiddenSubstrings: ['const offloadAnimalsToOpfsArchiveInternal = useCallback('],
        rationale:
          'Offload deletes live animals; re-inlining it next to snapshot state invites reading React state instead of the adapter and archiving the wrong barn.',
      },
      {
        filePath: 'src/hooks/__tests__/opfsArchiveOffload.test.ts',
        requiredSubstrings: [
          'drops stale selections',
          'stays disabled with a toast when OPFS archives are unavailable',
        ],
        rationale:
          'Selections must not survive an offload that removed their animal, and a browser without OPFS must keep the animals in the Archived tab rather than pretending to offload.',
      },
    ],
    restorePlaybook: [
      'Offload lives in `barnStore/useOpfsArchiveOffload.ts`; the store supplies the adapter read/replace and selection setters.',
      'Always build from `loadFreshSnapshot`, never from React state.',
      'Keep the `backupVault` dynamic import; `verify:chunks` guards the split.',
    ],
  },
  {
    id: 'IMP-101',
    title: 'Typed Facades Over the Barn Store Surface',
    category: 'workflow-polish',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Let a screen import only the part of the store it needs, without changing the flat return object that the 200-key contract pins.',
    summary:
      'Adds `src/hooks/barnStore/storeFacades.ts`: nine `Pick<BarnStore, ...>` facades (shell, animal, photo, backup, sync, species, calendar, husbandry, data) plus identity selectors, so consumers can name the slice they use and a domain-crossing call becomes visible in review. Nothing is added to the store object: the runtime surface, key order and `barnStoreContract.keys.json` are unchanged. `BarnStoreFacadeCoverage` is a compile-time `AssertNever<Exclude<keyof BarnStore, BarnStoreFacadeKeys>>`, so a new store key that no facade claims fails the typecheck instead of drifting. Typecheck and the 3-test contract gate pass unchanged.',
    files: [
      'src/hooks/barnStore/storeFacades.ts',
      'src/hooks/__tests__/barnStoreContract.keys.json',
    ],
    invariants: [
      {
        filePath: 'src/hooks/barnStore/storeFacades.ts',
        requiredSubstrings: [
          'export type BarnStoreFacadeCoverage',
          'BarnStoreUnfacetedKeys',
          'selectAnimalFacade',
          'export type BarnStoreBackupFacade',
        ],
        rationale:
          'The coverage assertion is the whole point: without it the facades silently fall behind the store and stop describing the surface.',
      },
      {
        filePath: 'src/hooks/__tests__/barnStoreContract.keys.json',
        requiredSubstrings: ['addOptimizedAnimalPhotos'],
        rationale:
          'The contract snapshot must stay byte-identical through facade work — facades are type-level and may never add, rename or reorder a key.',
      },
    ],
    restorePlaybook: [
      'Facades are type-only `Pick`s plus identity selectors; never add runtime keys to the store for them.',
      'When the store gains a key, claim it in exactly one facade or the build fails by design.',
    ],
  },
  {
    id: 'IMP-102',
    title: 'Animal CRUD Moved Into `useAnimalsCrud`',
    category: 'workflow-polish',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Keep the four actions that write or remove animal rows together, so the revision and outbox rules are written once instead of four times.',
    summary:
      'Extracts `saveAnimal`, `archiveAnimals`, `deleteAnimalsBatch` and `deleteAnimal` into `src/hooks/barnStore/useAnimalsCrud.ts` (~348 lines out of the store). Behaviour is unchanged: saves still reconcile carriers, parse genotypes lazily, merge concurrent edits and refuse with `ConcurrentEditConflictError`; archives still auto-offload retired stock when OPFS is available; deletes still write a safety snapshot first, unlink offspring sire/dam references before removing rows, forget cached photos, clear stale selections and emit a `__delete__` outbox operation per animal. The store passes a stable adapter facade memoised once, so the returned callbacks keep their identity across renders. `useBarnStore.ts` 9,075 → 8,727 lines; 12 new unit tests; the 200-key contract snapshot is untouched.',
    files: [
      'src/hooks/barnStore/useAnimalsCrud.ts',
      'src/hooks/__tests__/animalsCrud.test.ts',
      'src/hooks/useBarnStore.ts',
    ],
    invariants: [
      {
        filePath: 'src/hooks/barnStore/useAnimalsCrud.ts',
        requiredSubstrings: [
          'export function useAnimalsCrud',
          'saveAnimalAction',
          'deleteAnimalsBatchAction',
          'ConcurrentEditConflictError',
        ],
        rationale:
          'A concurrent edit must keep rejecting the save rather than silently overwrite a remote change; that check lives in the save action and nowhere else.',
      },
      {
        filePath: 'src/hooks/useBarnStore.ts',
        requiredSubstrings: ["from './barnStore/useAnimalsCrud'"],
        forbiddenSubstrings: ['const saveAnimal = useCallback('],
        rationale:
          'Re-inlining save would separate the `_rev` bump from the outbox diff, which is how rows and sync operations drift apart.',
      },
      {
        filePath: 'src/hooks/__tests__/animalsCrud.test.ts',
        requiredSubstrings: [
          'takes a safety snapshot, unlinks offspring and forgets photos',
          'hands retired stock to the offloader and stops when it succeeds',
        ],
        rationale:
          'Those two tests pin the destructive-delete ordering and the archive-to-offload hand-off, the two paths where a regression loses user data.',
      },
    ],
    restorePlaybook: [
      'Animal mutations live in `barnStore/useAnimalsCrud.ts`; the store supplies a memoised adapter facade and the refs.',
      'Every animal row write needs a matching `diffEntityFieldsToOperations` call with the same `_rev` and timestamp.',
      'Deletes take a safety rolling snapshot before any unlink or removal.',
    ],
  },
  {
    id: 'IMP-103',
    title: 'One Destructive-Restore Orchestrator With Verified Rollback',
    category: 'backup-safety',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Make it impossible for a restore path to skip the safety snapshot or reorder the steps that protect a live barn.',
    summary:
      'Adds `src/hooks/barnStore/restoreOrchestrator.ts` and points both the OPFS vault and rolling IndexedDB restores at it. The orchestrator owns the order once — load and refuse, safety snapshot (skipped after a wiped recovery or with an empty barn), photo-cache clear, replace with backup bookkeeping stripped, sync-state clear, recovery-context clear, source hook, verification, reload, toast. It also adds the step every path lacked: after the replace it re-reads the committed snapshot and compares animal and photo counts with the file; on a mismatch it puts the safety snapshot back, toasts what was expected versus found, and fails the restore instead of leaving a half-loaded barn. `stripRestoredBackupBookkeeping` now lives with the orchestrator, so the two slices no longer import each other. Recorded as ADR `docs/decisions/0001-destructive-restore.md`; 9 orchestrator tests cover ordering, both safety-snapshot skips, verification match, rollback and write failure.',
    files: [
      'src/hooks/barnStore/restoreOrchestrator.ts',
      'src/hooks/__tests__/restoreOrchestrator.test.ts',
      'src/hooks/barnStore/useOpfsVaultActions.ts',
      'src/hooks/barnStore/useRollingBackupActions.ts',
      'docs/decisions/0001-destructive-restore.md',
    ],
    invariants: [
      {
        filePath: 'src/hooks/barnStore/restoreOrchestrator.ts',
        requiredSubstrings: [
          'export async function runDestructiveRestore',
          'verifyRowCounts',
          'Your previous barn was put back.',
        ],
        rationale:
          'Verification without a rollback is worse than none: it detects a bad restore and still leaves the user with it.',
      },
      {
        filePath: 'src/hooks/barnStore/useOpfsVaultActions.ts',
        requiredSubstrings: ['runDestructiveRestore'],
        forbiddenSubstrings: ['const cleanedVaultSnap'],
        rationale:
          'The OPFS path must not clean and replace on its own again — that is how the two restore paths drifted apart the first time.',
      },
      {
        filePath: 'docs/decisions/0001-destructive-restore.md',
        requiredSubstrings: ['Every destructive restore goes through one orchestrator', 'verify the committed row counts'],
        rationale:
          'The ordering is a contract, and an ADR is what stops a future path from quietly doing it differently.',
      },
    ],
    restorePlaybook: [
      'All restores go through `runDestructiveRestore`; callers only decode their format and add source-specific steps.',
      'Keep the safety snapshot before the replace and keep the count verification plus rollback after it.',
      'A new restore source gets the net for free — do not copy the sequence.',
    ],
  },
  {
    id: 'IMP-104',
    title: 'Sweep Hardening: Quota Tests, Import A11y, No Blanket Host Allow',
    category: 'ci-tooling',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Close the small, concrete gaps the full sweep found instead of leaving them as report findings.',
    summary:
      'Three sweep fixes. (1) Quota-failure coverage: new tests drive `QuotaExceededError` through animal save, batch delete and archive offload, asserting the failure is reported and that no success toast or reload happens. (2) Accessibility: the hidden backup file input in `WipedStorageRecoveryModal` now has `aria-label="Choose a backup file to recover from"`, so strict audits and automation see a named control. (3) Dev-server exposure: `vite.config.ts` no longer uses `allowedHosts: true`; localhost is allowed by default and preview hostnames come from `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` for the process that needs them, so the blanket any-Host acceptance is gone.',
    files: [
      'src/hooks/__tests__/animalsCrud.test.ts',
      'src/hooks/__tests__/opfsArchiveOffload.test.ts',
      'src/components/WipedStorageRecoveryModal.tsx',
      'vite.config.ts',
    ],
    invariants: [
      {
        filePath: 'vite.config.ts',
        requiredSubstrings: ['__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS'],
        forbiddenSubstrings: ['allowedHosts: true'],
        rationale:
          'A blanket host allow lets any hostname reach the dev server; the env allowlist is the supported way to admit a preview origin.',
      },
      {
        filePath: 'src/components/WipedStorageRecoveryModal.tsx',
        requiredSubstrings: ['aria-label="Choose a backup file to recover from"'],
        rationale:
          'The input is visually hidden, so the label is the only thing that names it for assistive tech.',
      },
      {
        filePath: 'src/hooks/__tests__/animalsCrud.test.ts',
        requiredSubstrings: ['surfaces a quota failure instead of claiming the animal was saved'],
        rationale:
          'Storage-full is a normal state on a phone; the save path must report it rather than toast success over a failed write.',
      },
    ],
    restorePlaybook: [
      'Preview hostnames are per-process: start the dev server with `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=<host>`, never by re-enabling blanket host acceptance.',
      'Hidden inputs still need accessible names.',
      'Quota paths must report and stay silent, never toast success.',
    ],
  },
  {
    id: 'IMP-105',
    title: 'Backlog Workflow Gate Now Covers Open Handoffs, Not Just Plans',
    category: 'workflow-polish',
    release: 'alpha-3',
    source: 'session',
    userIntent:
      'Stop a new backlog item from starting while an unfinished handoff still owns the work — the gate only looked for plans and silently ignored handoffs.',
    summary:
      'Both backlog prompts now treat an open `handoff-*.yaml` as work in progress. `start_new_backlog_prompt.md` prechecks for active plans *and* handoffs whose `status:` still contains `[WIP]`/`[TODO]`, and refuses to pick a new entry until the handoff is finished; `resume_backlog_plan_prompt.md` now continues an open handoff when no active plan exists, instead of jumping straight to a new backlog item. `docs/plans/suggestions-backlog.md` records the gate in its header note and states plainly that the file is the owner’s scratch pad, worked one entry at a time and deliberately kept near-empty between releases. PRM-003/PRM-004 gained `handoff-*.yaml` invariants so the check cannot be dropped again.',
    files: [
      'prompts/start_new_backlog_prompt.md',
      'prompts/resume_backlog_plan_prompt.md',
      'docs/plans/suggestions-backlog.md',
      'src/domain/promptRegistry.ts',
      'src/domain/promptsCatalog.ts',
    ],
    invariants: [
      {
        filePath: 'prompts/start_new_backlog_prompt.md',
        requiredSubstrings: ['handoff-*.yaml', 'open handoff'],
        rationale:
          'Without the handoff branch the precheck only guards plans, which is exactly how an unfinished handoff got abandoned for a fresh backlog item.',
      },
      {
        filePath: 'prompts/resume_backlog_plan_prompt.md',
        requiredSubstrings: ['handoff-*.yaml'],
        rationale:
          'The resume path is the one that decides what to work on when no plan exists; it must see handoffs before falling through to the starter.',
      },
      {
        filePath: 'docs/plans/suggestions-backlog.md',
        requiredSubstrings: ['no open plan and no open handoff', 'scratch pad'],
        rationale:
          'The backlog file itself has to say that it is a one-at-a-time scratch pad behind an open-work gate, or the next reader treats an empty list as an invitation.',
      },
    ],
    restorePlaybook: [
      'Both backlog prompts gate on open handoffs: continue `handoff-*.yaml` work with `[WIP]`/`[TODO]` before starting a new backlog entry.',
      'The backlog is a scratch pad, not a queue — keep the header gate note and the one-at-a-time rule intact.',
    ],
  },
];
