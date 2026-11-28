# `src/features/` — Reusable Feature Modules (`@features/*`)

Layer 2. Each folder is a self-contained engine with a small public entry point, usable without the
pedigree domain. They may import `@engine/*` and their own files, and nothing else.

## Catalog

| Feature | Entry | What it does |
| --- | --- | --- |
| `csv-importer` | `csvImporter.ts`, `csvParser.ts`, `types.ts` | Schema-driven tabular import: header normalization, column mapping, type inference, preview rows, conflict-ready values. |
| `csv-exporter` | `csvExporter.ts`, `types.ts` | RFC 4180 serialization with formula-injection escaping. |
| `backup-vault` | `portableVault.ts` | Portable vault archive framing with SHA-256 payload verification. |
| `document-export` | `htmlPrintPackage.ts` | Builds a self-contained HTML print package and hands it to a platform print bridge. |
| `ics-calendar` | `icsBuilder.ts` | RFC 5545 event stream builder, including all-day entries. |
| `ocr-parser` | `ocrTextPipeline.ts` | 2D line grouping and rule-based field extraction over OCR text. |

`featureModule.interface.ts` defines the optional `IFeatureModule` lifecycle (`metadata`,
`initialize`, `dispose`, `getStateSnapshot`) for features that need one.

## Rules

- **No sibling imports.** `@features/csv-importer` must never import `@features/csv-exporter`.
  Cross-feature work is composed in `@app/*` or mediated through an `@engine/*` contract. The layer
  audit and `modularLayerArchitecture.test.ts` both enforce this, including relative-path imports.
- **No domain terms.** A feature takes its vocabulary from the caller: pass in column definitions,
  terminology and schemas rather than importing `@domain/*`.
- **No React.** These are pure TypeScript engines. UI lives in `src/components/`, wiring in `src/app/`.
- **One public entry per feature.** `index.ts` is the surface; keep internals unexported so the
  feature can be extracted later.

## Verification

`npm run verify:engine` typechecks these modules in isolation, and `npm run verify:extraction`
compiles them in a temp directory with no `src/domain` or `src/app` present.

## Adding a feature

1. Create `src/features/<kebab-name>/` with `index.ts` plus the implementation files.
2. Give every file a `@license` header and a sentence saying what the module guarantees.
3. Export the feature from `src/features/index.ts`.
4. Add tests next to it (`*.test.ts`) — they run in the normal `npm test` suite.
5. If the feature needs a capability the platform may not have, declare it in `FeatureMetadata`
   rather than sniffing the environment itself.
