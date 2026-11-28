# Documentation Index

Where to read and where to write. The top-level `README.md` is the front door; this page is the map
for everything behind it.

## Read this first

| Document | What it answers |
| --- | --- |
| [`../README.md`](../README.md) | What the app is, how to run it, the verification commands, the workflow list. |
| [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | The three-layer boundaries, the hybrid wrapper rule, and the domain guardrails. |
| [`ARCHITECTURE_GUIDE.md`](./ARCHITECTURE_GUIDE.md) | The same architecture in plain English, plus the storage routing matrix. |
| [`../AGENTS.md`](../AGENTS.md) | Binding rules for every assistant, including the full-sweep routine. |
| [`../ROADMAP.md`](../ROADMAP.md) | Milestones, the current release scope, and the extraction strategy. |
| [`../EXTRACTION_INVENTORY.md`](../EXTRACTION_INVENTORY.md) | File-by-file classification of what is content-agnostic and what is pedigree domain. |
| [`../MODULES.md`](../MODULES.md) | Generated module split: every non-test source file, classified. |

## Working documents

### Contracts

- [`contracts/barn-store-contract.md`](./contracts/barn-store-contract.md) — the `useBarnStore`
  public surface, its 200-key snapshot and the required changelog. `npm run verify:contract` fails
  when the snapshot and this file disagree.

### Decisions (ADRs)

- [`decisions/0001-destructive-restore.md`](./decisions/0001-destructive-restore.md) — every
  destructive restore goes through one orchestrator, in one order.

### Plans and handoffs

- [`plans/suggestions-backlog.md`](./plans/suggestions-backlog.md) — the owner's scratch pad of
  unimplemented suggestions, worked one entry at a time.
- `plans/handoff-<topic>.yaml` — an in-progress feature. Its `status:` list is the checkpoint; a
  handoff is deleted once every item and every verification check passes. Do not start new backlog
  work while one is open.

### Release and operations

- [`HOW_TO_CREATE_A_RELEASE.md`](./HOW_TO_CREATE_A_RELEASE.md) — cutting a version.
- [`HOW_TO_UPDATE_RELEASE_FROM_MAIN.md`](./HOW_TO_UPDATE_RELEASE_FROM_MAIN.md) — promoting `main`
  to the frozen `release` presentation branch.
- [`FULL_SWEEP_SKILL.md`](./FULL_SWEEP_SKILL.md) — the portable audit routine mirrored by
  `AGENTS.md` §"Full sweep".

## Generated files: never hand-edit

| File | Regenerate with |
| --- | --- |
| `../MODULES.md` | `npx tsx scripts/list-modules.ts --write` |
| `../IMPROVEMENTS.md`, `../PROMPT_CHANGES.md` | `npm run regen:ledgers` |
| `../dist/robots.txt`, `../dist/sitemap.xml` | `npm run build` (values come from `package.json#homepage`) |

`npm run verify` re-renders the ledgers from their registries and reports every line that drifts, so a
hand edit cannot survive a gate run. Log work by adding a registry entry instead — see
`src/domain/improvements/README.md` and `src/domain/promptsCatalog.ts`.

## Module-level documentation

The layer and folder READMEs describe the code inside them:

- [`../src/engine/README.md`](../src/engine/README.md) — content-agnostic engine rules and map.
- [`../src/features/README.md`](../src/features/README.md) — reusable feature modules.
- [`../src/storage/README.md`](../src/storage/README.md) — browser storage, SQLite split, workers.
- [`../src/hooks/barnStore/README.md`](../src/hooks/barnStore/README.md) — the barn-store slices.
- [`../scripts/README.md`](../scripts/README.md) — what each verification gate does.

## Archive

[`archive/`](./archive/) holds superseded material (AI Studio export dumps, screenshots) kept for
history only. Nothing in the archive is build input; `npm run verify` does not read it.
