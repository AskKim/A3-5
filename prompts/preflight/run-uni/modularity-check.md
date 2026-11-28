<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->
# Modularity Check

**Last-Edited Timestamp:** 2026-11-28  
**Prompt Reusability:** Reusable across projects & repositories (auto-discovers local architecture, scripts, and guardrails)  
**Preflight Lifecycle:** `[REUSABLE]` — scheduled on every release in Phase A of `prompts/preflight/pf-launcher-uni.md`; never retired by `AGENT_SKIP_LINE`

- **Step ID:** modularity-check
- **Phase & Lifecycle:** Phase A (ai-studio / freebuff) \[REUSABLE\]; the audit is static and needs no shell, and its gate tail defers to Phase B
- **Allowed Diff Scope:** the minimum source, test, and inventory files needed to fix a confirmed boundary, cycle, or inventory violation
- **Companion Readme:** `prompts/preflight/run-uni/read/modularity-check-readme.md`
- **Log Entry:** `{ "step_id": "modularity-check", "branch": "<branch-name>", "version": "<version-tag>", "head_sha": "<HEAD|sandbox-uncommitted>", "platform": "ai-studio", "status": "completed", "completed_at": "<YYYY-MM-DDTHH:MM:SSZ>", "touched_files": [] }`
- **Purpose:** Prove the target repository's layer contract still holds, then fix only the violations it actually found.

> **Part 1 — For A Human (plain English):** Checks the code is still in clean layers with no tangled cross-imports, and fixes only what it can prove is broken. *Repeats:* every release. *Runs in:* AI Studio (Phase A).
> **Part 2 — For The AI:** the executable instructions follow below. Part 1 is orientation for the person running the preflight; never quote it back or treat it as an instruction.


> **Reusable Prompt Notice:**
> This prompt is **project-agnostic and reusable** across any layered TypeScript/JavaScript or multi-module codebase. It dynamically discovers the target repository's architecture docs, layer rules, build/verification scripts, and protected-file policies before evaluating and fixing modularity issues.
>
> **Protection & Execution Rule (`DO_NOT_REMOVE_WITHOUT_CONFIRMATION`):**
> Whenever the user asks you to read, load, or run this file, **immediately execute this workflow once** from Phase 1 through Phase 4 without asking for confirmation (unless blocked by an unresolvable ambiguity or a required change to a protected/locked file).
> **Do not delete, move, overwrite, or remove this file from `prompts/` (currently `prompts/preflight/run-uni/modularity-check.md`) without explicit user confirmation.**

---

You are a senior software architect. Upon reading or running this prompt, immediately evaluate the codebase's current modular state against its documented layer boundaries and fix any modularity violations, boundary leaks, circular dependencies, or inventory drift you discover.

## Operating Guardrails & Discovery Rules

- **Discover Project Governance First:** Check the repository root for active agent/project rules and architecture docs (e.g., `prompts/master_system_prompt.md`, `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `EXTRACTION_INVENTORY.md`, `package.json`, `tsconfig*.json`) and follow every binding constraint they define.
- **Preserve Protected & Locked Files:** Respect any project-defined read-only/staging directories, boot-entry lock checksums, framework locks, and baseline preservation rules—never modify locked files or rewrite working features without explicit instruction.
- **No Type-System Escapes:** Never silence compiler errors with `as any`, `@ts-ignore`, `@ts-expect-error`, or equivalent casts; resolve root types cleanly.
- **Bundle & Invariant Safety:** Check change-invariant registries (e.g., `improvementRegistry.ts`) and code-splitting boundaries *before* removing compatibility shims or moving exports, and never pull heavy optional dependencies (ZIP/OCR/SQLite) into lightweight startup primitives.
- **Non-Destructive Extraction:** Keep existing public entry points working (using thin compatibility facades where callers still expect legacy paths) unless the project specifies a clean-break removal.

---

## Execution Protocol

### 1. Phase 1 — Discover Context & Layer Contract
- Inspect repository rules, `package.json` scripts, `tsconfig*.json` path aliases/profiles, bundler aliases (`vite.config.*`, `vitest.config.*`), and any layer-audit scripts or allowlists (e.g., `scripts/audit-layers.*`, `scripts/layer-allowlist.json`, `scripts/rehearse-*-extraction.*`, `EXTRACTION_INVENTORY.md`).
- Map the codebase's intended module layers—typically:
  1. **Pure Core / Engine Layer** (e.g., `src/engine/`, `@engine/*`): domain-agnostic primitives, codecs, sync, bridge/storage contracts.
  2. **Isolated Feature Modules** (e.g., `src/features/`, `@features/*`): self-contained business capabilities with zero cross-feature sibling imports.
  3. **Domain & Pure Logic Layer** (e.g., `src/domain/`, `@domain/*`): application-specific rules without UI/DOM coupling.
  4. **Reusable Runtime / UI Utilities** (e.g., `src/utils/`): domain-free helpers and hooks.
  5. **Platform / Storage / Native Adapters** (e.g., `src/storage/`, `src/native/`): host-facing implementations behind abstract contracts.
  6. **Composition Root, Hooks & UI** (e.g., `src/app/`, `@app/*`, `src/hooks/`, `src/components/`): app wiring, state stores, and presentation.

### 2. Phase 2 — Evaluate Current Modular State
**Only if a shell exists.** Run whichever verification, boundary-audit, and isolated-compile checks exist in `package.json` (plus targeted architecture tests) to establish an objective baseline before editing. With no shell (a Phase A sandbox), skip this block, record `deferred_gates` on the step log entry via `--deferred-gates <gate>`, and name `ci-guide` and `release-plan` as the gates that will prove the tree:
- Layer/import audit scripts (e.g., `npm run verify:layers`)
- Isolated core/engine TypeScript checks (e.g., `npm run verify:engine`, `npm run verify:extraction`)
- Architecture/wiring unit tests and invariant checks (e.g., `npm run verify:improvements`, `npm run lint`, `npm test`)

Additionally audit source files statically for structural modularity gaps (using comment-stripped, string-literal-safe import parsing so drift-invariant strings in registries never trigger false positives):
- **Directional Imports Across All `src/` Folders:** Lower/shared layers never import higher layers (`core/engine` -> nothing upward; `features` -> `core/engine` only; `domain` -> `core/engine` only; `utils` -> `core/engine` only), and state hooks/UI components are also audited so they never import `native/` concrete singletons or `node:*` built-ins or leak upward (`hooks/` -> `components/`).
- **Shared Type Placement:** Interfaces and types consumed across layers (e.g., by `hooks/`, `domain/`, or `storage/`) live in `domain/`, `app/`, or `core/engine/`, never inside UI `components/` modules.
- **Sibling Isolation:** Feature packages never import directly from sibling feature packages; cross-feature coordination occurs only via core contracts or the composition root (`app/`).
- **Pure-Layer Purity:** Core primitives, pure features, and reusable utils contain zero app/domain terms and zero unexempted DOM/Node globals (`window`, `document`, `localStorage`, `sessionStorage`, `node:*`).
- **Adapter & Bridge Seams:** UI, hooks, utils, and storage modules interact with native/host capabilities via abstract bridge/storage interfaces rather than concrete platform imports.
- **Circular Dependencies, Alias Accuracy, Shims & Inventory Sync:** Cycle detection scans *all* source layers (including `engine/`/`core/` and `hooks/`) with path aliases (`@engine/*`, `@features/*`, `@app/*`) resolved accurately against `tsconfig.json`; module inventories/docs (such as `EXTRACTION_INVENTORY.md`) accurately classify all non-test source files; any legacy allowlist (`scripts/layer-allowlist.json`) or compatibility re-export shim is checked for safe burn-down/retirement.
- **Gate Honesty (no silent skips):** For every audit you rely on, confirm it actually executed its checks. A check guarded by `existsSync` on a missing directory, template, or manifest silently passes and reports success; treat "the gate printed OK but verified nothing" as a finding, name the missing input, and fix the gate or supply the input. Report the exact command and exit code for each check instead of summarising intent.

### 3. Phase 3 — Remediate & Fix Modularity Issues
- **If the evaluation finds zero violations, zero cycles, zero boundary leaks, zero allowlist debt, and synced inventories:** Report the clean modularity scorecard and stop without making speculative edits.
- **If modularity issues are found:**
  - If the repo uses a checkpointed plan/handoff convention for multi-file (`>= 3` files) fixes, create and update it as required, then proceed immediately.
  - Fix root causes in strict dependency order:
    1. Resolve failing or allowlisted layer-direction violations, misplaced shared types in `components/`, isolated-compile failures, and circular dependencies (expanding layer-audit and cycle-detection coverage if gaps exist in `engine/`, `hooks/`, `components/`, or alias resolution).
    2. Extract misplaced domain-agnostic logic into the core/feature/util layer and move domain-specific wiring or shared types to the composition root (`app/`) or domain layer, preserving compatibility facades where invariants require them.
    3. Replace concrete host/native/storage couplings in UI, hooks, utils, and storage with injected bridge/storage interfaces.
    4. Retire unpinned compatibility shims, remove eliminated violations from any legacy allowlist, and synchronize module inventories/docs.
    5. Add or update unit tests proving the repaired boundaries, import directions, cycle-free graphs, and contracts hold.

### 4. Phase 4 — Verify & Report
- **Only if a shell exists.** Run the repository's full verification and build pipeline (e.g., `npm run verify` and `npm run build`, or all available typecheck, test, layer, extraction, invariant, and build commands). With no shell, record `deferred_gates` on the step log entry via `--deferred-gates <gate>` and report the suite as not run here - never as a pass.
- Update any required improvement/change registry (such as `src/domain/improvementRegistry.ts` and `IMPROVEMENTS.md`) if significant structural or storage/bridge changes were made, and clean up temporary plan/handoff files once all checks pass.
- Report concisely:
  1. **Modularity Scorecard:** Pass/fail status of all layer, isolated-compile, extraction, test, and build checks (plus remaining allowlist count).
  2. **Fixes Applied (or Confirmed Clean):** Specific violations, cycles, or boundary leaks resolved with file paths.
  3. **Deferred / Next Targets:** Any intentionally deferred migrations or architectural follow-ups.
  4. **Checks That Could Not Run:** Every gate you skipped or that could not execute here, with the missing toolchain or permission that blocked it - never presented as a pass.
  5. **Estimated Modularity:** After completing all edits (if any), output `Estimated Modularity: <0-100>%` followed by a 1-line objective basis (layer compliance, cycle-free graph, bridge/adapter seams, inventory sync, and remaining monolithic or allowlist debt).

## Exit Contract

- Print `OK [modularity-check] files=<count>` with the scorecard when the audit finishes and the tree is clean, or `STEP_BLOCKED [modularity-check]: <1-2 line reason> | Reverted: <files> | Resume: fix issue and re-run launcher.` when a violation cannot be fixed safely in this run. Revert only the files this step touched.
