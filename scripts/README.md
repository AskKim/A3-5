# `scripts/` — Verification Gates and Tooling

Every script here is a gate or a generator. Gates read the repo and exit non-zero on drift; they never
edit source. Only two commands write, and both are explicit: `list-modules.ts --write` and
`regen-ledgers.ts --write`.

Run the whole set with `npm run verify`. The umbrella deliberately excludes the two build-dependent
gates (`verify:chunks`, `verify:site-identity`), so a full local pass is:

```bash
npm run verify
npm run build
npm run verify:chunks
npm run build -- --base="/<repo-name>/" && npm run verify:site-identity -- --base="/<repo-name>/"
npm run build          # leave dist/ in root form again
```

## Gates

| Command | File | What it fails on |
| --- | --- | --- |
| `npm test` | `src/**/__tests__` | Any failing Vitest suite, including the layer-architecture and barn-store contract tests. |
| `npm run lint` | `tsconfig.json` | Any TypeScript error in the app (`tsc --noEmit`). |
| `npm run verify:engine` | `tsconfig.engine.json` | Engine/feature/util code that stops compiling in isolation, or grew a domain dependency. |
| `npm run verify:extraction` | `rehearse-engine-extraction.ts` | A real extraction rehearsal: copies the extractable layers into a temp dir without `src/domain`, `src/app`, `src/storage`, `src/hooks` or `src/components` and compiles them. |
| `npm run verify:layers` | `audit-layers.ts` | An import that points the wrong way between layers, a cross-feature sibling import, or a DOM global in pure code. Allowlist: `layer-allowlist.json` (must stay `[]`). |
| `npm run verify:improvements` | `verify-improvements.ts` | A registry invariant that no longer holds, or a ledger that drifts from its registry. |
| `npm run verify:prompts` | `verify-prompts.ts` | A governed prompt/governance file that was moved, rewritten or dropped against `src/domain/promptRegistry.ts`. |
| `npm run verify:modules` | `list-modules.ts --check` | `MODULES.md` disagreeing with the live `src/` tree, or a content-named module in the core layer. |
| `npm run verify:android` | `verify-android.ts` | Static Android wrapper drift: missing files, version mismatch, unsafe manifest flags, forbidden dependency. A real APK build needs the SDK; this is the stand-in. |
| `npm run verify:contract` | `verify-contract-changelog.ts` | A change to `barnStoreContract.keys.json` without an updated key count, SHA-256 and dated changelog line in `docs/contracts/barn-store-contract.md`. |
| `npm run verify:coverage` | `vitest.config.ts` | Coverage below the ratcheted floor, or source files excluded from the floor. |
| `npm run verify:chunks` | `verify-chunk-graph.ts` | A new circular import between two build chunks. **Run after `npm run build`.** Ratchet: `chunk-cycle-allowlist.json`. |
| `npm run verify:site-identity` | `verify-site-identity.ts` | A finished subpath build whose canonical link, `robots.txt`, `sitemap.xml` or `404.html` disagrees with `--base`. Run it on the subpath build, before rebuilding for root. |

`siteIdentity.ts` is the shared resolver behind both the build and `verify:site-identity`; the public
location is authored once, in `package.json#homepage`, and reaches the build as `%SITE_URL%`,
`%SITE_BASE%` and `%SITE_LASTMOD%` tokens.

## Generators

| Command | File | Writes |
| --- | --- | --- |
| `npm run list:modules` | `list-modules.ts` | Nothing; prints the live split. |
| `npx tsx scripts/list-modules.ts --write` | `list-modules.ts` | `MODULES.md`. |
| `npm run regen:ledgers` | `regen-ledgers.ts` | `IMPROVEMENTS.md` and `PROMPT_CHANGES.md` from their registries. |

## Remote tooling

| Command | File | Needs |
| --- | --- | --- |
| `node scripts/android-build-remote.mjs --ref <branch>` | `android-build-remote.mjs` | A `GH_TOKEN` with `actions:write`. Dispatches `build-android-apk.yml` and reports the conclusion, because the SDK cannot be installed here. |

## Adding a gate

1. Put the logic in a `scripts/verify-*.ts` with a `@license` header and a one-paragraph comment that
   says what it protects and how it fails.
2. Add the npm script and wire it into `npm run verify` — or into `ci.yml` when it needs a build
   artifact.
3. Register the invariant in `src/domain/improvements/registry-part-*.ts` so the gate itself is
   protected from silent removal, then run `npm run regen:ledgers`.
