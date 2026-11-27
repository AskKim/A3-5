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
    ],
    restorePlaybook: [
      'Keep `npm run verify:chunks` in CI after `npm run build`; the check needs the emitted bundles, not the source.',
      'When it reports a new cycle, group the members in one `codeSplitting` chunk (see the improvement-registry group) instead of adding an allowlist entry.',
      'Only regenerate scripts/chunk-cycle-allowlist.json with `tsx scripts/verify-chunk-graph.ts --write-allowlist` for cycles that already predate the gate.',
    ],
  },
];
