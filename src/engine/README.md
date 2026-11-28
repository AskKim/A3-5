# `src/engine/` — Content-Agnostic Core (`@engine/*`)

Layer 1 of the three-layer split. This folder must be extractable into a standalone package without
touching a single line: no livestock, breed, litter, pedigree, herd, ear tag or barn-chore term, and
no import that points up at `@features/*`, `@domain/*`, `@app/*`, `src/components`, `src/hooks` or
`src/storage`.

Called "engine" on purpose. "Core" is reserved for the upcoming Core Pedigree release name.

## Layout

| Path | Contains |
| --- | --- |
| `binaryEncoding.ts` | Pure byte, UTF-8 and base64 encode/decode helpers. |
| `primitives/` | `crypto` (FNV-1a, SHA-256, PBKDF2/AES-GCM), `sanitization` (payload limits, prototype-safe keys, zip-slip/zip-bomb guards, CSV/HTML escaping), `qrCodec` (ISO 18004 matrix + SVG), `genericSync` (operation log, LWW comparator, field diffing, P2P wire codec), `genericRegistries` (exporter/importer catalogs), `deviceCapabilityCore` (hardware tiers and storage policy), `themeColor`, `pdfDocumentExtractor`, `boundedCache`. |
| `codecs/` | `archiveAndCsvUtils` (ZIP/CSV primitives) and `textFormats` (RFC 4180 cells, RFC 5545 ICS lines). |
| `storage/` | The storage contract and its adapters: `storageAdapter.interface`, `browserStorageAdapters` (memory/IndexedDB), `sqliteWasmStorageAdapter`, `nativeBridgeStorageAdapter`, `resilientStorageAdapter`, `opfsStream`, `browserProbes`, `crossTabSync`, `lifecycleCoordinator`, `lanWebRtcTransport`. |
| `bridge/` | `platformBridge.interface` (`IPlatformBridge`), `platformBridge` (capability detection, back-handler stack, correlated native storage replies) and `desktopBridgeAdapter` (Electron/Tauri). |
| `sync/` | Sync/integrity barrel re-exporting `genericSync` and `crypto`. |
| `index.ts` | The `@engine` entry surface. |

## Rules

- **No domain terms.** `npm run verify:layers` and `src/domain/__tests__/modularLayerArchitecture.test.ts`
  scan for them. If a helper needs to know what a "litter" is, it belongs in `@domain/*` instead.
- **No upward imports.** `@engine/*` may import `@engine/*`. Nothing else.
- **DOM access only where the contract requires it.** Only `bridge/` and `storage/` touch `window`,
  `navigator`, `document` or Web APIs; everything else is pure and worker-safe.
- **Types over instances.** Anything swappable (storage, bridges, codecs) is defined as an interface
  here and implemented by the caller.

## Verification

```bash
npm run verify:engine      # isolated typecheck via tsconfig.engine.json
npm run verify:extraction  # compiles the extractable layers in a temp dir with no domain present
npm run verify:layers      # import direction, sibling imports, DOM globals
```

All three run inside `npm run verify`.

## Adding a module

1. Place it under the narrowest folder that fits (`primitives`, `codecs`, `storage`, `bridge`, `sync`).
2. Give the file a `@license` header explaining what it is and the invariant it upholds.
3. Export it through the folder's `index.ts`, and through `src/engine/index.ts` only when it belongs
   in the top-level surface.
4. Add a unit test under `src/engine/__tests__/` when it has branching logic.
5. Re-check extraction: a new import of `zod`, `react` or a Node built-in will fail `verify:extraction`
   even when the app compiles.
