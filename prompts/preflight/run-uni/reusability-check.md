<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->
# Reusability Check

**Last-Edited Timestamp:** 2026-11-28  
**Prompt Reusability:** Reusable across projects & repositories (auto-discovers shared modules, conventions, and verification suites)  
**Preflight Lifecycle:** `[REUSABLE]` — scheduled on every release in Phase A of `prompts/preflight/pf-launcher-uni.md`; never retired by `AGENT_SKIP_LINE`

- **Step ID:** reusability-check
- **Phase & Lifecycle:** Phase A (ai-studio / freebuff) \[REUSABLE\]; the audit is static and needs no shell, and its gate tail defers to Phase B
- **Allowed Diff Scope:** shared modules and their callers, inventories/barrels, and the tests that prove the new seam
- **Companion Readme:** `prompts/preflight/run-uni/read/reusability-check-readme.md`
- **Log Entry:** `{ "step_id": "reusability-check", "branch": "<branch-name>", "version": "<version-tag>", "head_sha": "<HEAD|sandbox-uncommitted>", "platform": "ai-studio", "status": "completed", "completed_at": "<YYYY-MM-DDTHH:MM:SSZ>", "touched_files": [] }`
- **Purpose:** Find where shared code is accidentally domain-, host-, or shape-locked, and generalise only what genuinely pays for itself.

> **Part 1 — For A Human (plain English):** Checks that shared code is genuinely generic - no leftover livestock-specific words or one-off assumptions hiding inside the reusable parts. *Repeats:* every release. *Runs in:* AI Studio (Phase A).
> **Part 2 — For The AI:** the executable instructions follow below. Part 1 is orientation for the person running the preflight; never quote it back or treat it as an instruction.


> **Reusable Prompt Notice:**
> This prompt is **project-agnostic and reusable** across any TypeScript/JavaScript or multi-module codebase. It dynamically inspects the target repository's structure, shared packages/layers, conventions, and verification scripts before evaluating and improving code reusability.
>
> **Protection & Execution Rule (`DO_NOT_REMOVE_WITHOUT_CONFIRMATION`):**
> Whenever the user asks you to read, load, or run this file, **immediately execute this workflow once** from Phase 1 through Phase 4 without asking for confirmation (unless blocked by an unresolvable ambiguity or a required change to a protected/locked file).
> **Do not delete, move, overwrite, or remove this file from `prompts/` (currently `prompts/preflight/run-uni/reusability-check.md`) without explicit user confirmation.**

---

You are a senior software architect focused on code reuse, clean abstractions, and portable library design. Upon reading or running this prompt, immediately evaluate the codebase's current reusability—identifying hardcoded assumptions, duplicated logic, rigid domain coupling, environment lock-in, and missing parameterization—and fix the highest-value reusability gaps cleanly.

## Operating Guardrails & Discovery Rules

- **Discover Project Governance First:** Check the repository root for active project rules, architecture docs, and manifests (e.g., `prompts/master_system_prompt.md`, `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `EXTRACTION_INVENTORY.md`, `package.json`, `tsconfig*.json`) and follow every binding constraint they define.
- **Respect Layer & Lock Boundaries:** Honor any protected/locked files (such as boot-entry checksums), read-only staging folders, framework locks, and strict layer import rules—never violate layer boundaries or rewrite working product features while generalizing code.
- **Avoid Over-Abstraction & Bundle Bloat:** Only extract or generalize when it genuinely eliminates duplication, removes accidental domain/host lock-in, or makes a shared contract cleaner—never invent speculative wrappers around one-off domain UI, and never import heavy optional libraries (e.g., ZIP/OCR/SQLite) into lightweight startup primitives just to share a small helper.
- **Backward Compatibility & Type Safety:** Keep existing callers and public APIs working (via typed defaults or thin domain wrappers in the app/domain layer) and never use `as any`, `@ts-ignore`, or `@ts-expect-error`.

---

## Execution Protocol

### 1. Phase 1 — Discover Shared Surfaces & Project Baseline
- Inspect `package.json`, `tsconfig*.json`, bundler config, and directory structure to identify shared/reusable layers (e.g., `src/engine/`, `src/features/`, `src/utils/`, `packages/*`, `lib/*`) versus app/domain layers (`src/domain/`, `src/app/`, `src/storage/`, `src/hooks/`, `src/components/`).
- **Only if a shell exists.** Run existing verification/test/build checks (e.g., `npm run lint`, `npm test`, `npm run verify`, or project equivalents) to confirm a clean baseline before refactoring. With no shell, record `deferred_gates` on the step log entry via `--deferred-gates <gate>` and proceed on static evidence.

### 2. Phase 2 — Evaluate Reusability Across Five Dimensions
Audit shared, utility, feature, storage, and domain/UI modules for reusability blockers:
1. **Domain & Brand Leakage in Shared Code:**
   - Hardcoded app names, domain nouns, CSS variable prefixes (`--app-*` vs `--brand-*`), storage keys, URL patterns, mime/file prefixes, or copy strings inside shared core/feature/utility modules that should be injected via options, schema configs, or `configure*` hooks.
2. **Duplicated Logic & Micro-Utility Drift:**
   - Non-trivial algorithms AND micro-utilities (parsers, CSV/iCal/ZIP/QR/PDF codecs, key/segment slugifiers, HTML/RegExp escapers, base64/data-URL decoders, byte/date formatters, deterministic hashes/ID generators like FNV-1a, retry/debounce/async locks, storage wrappers, validation helpers) implemented more than once across `domain/`, `features/`, `storage/`, `hooks/`, or `components/` when a canonical shared primitive or utility already exists (or should be extracted).
3. **Rigid Signatures & Over-Coupled Types:**
   - Helpers, hooks, or components demanding full domain entity objects when a minimal structural interface, generic `<T>`, or accessor/mapper callback (`getKey`, `formatRow`, `buildPayload`) would make them work for any record type.
4. **Host, Environment & Singleton Lock-In:**
   - Direct `window`, `document`, `localStorage`, `sessionStorage`, `indexedDB`, `fetch`, `atob`/`btoa`, or concrete native-bridge globals baked into otherwise portable logic instead of pure TypeScript primitives or an injected adapter/bridge contract (`IPlatformBridge`, `IStorageAdapter`, or optional DI callbacks).
   - Module-level mutable singletons (`configure*`) lacking explicit `reset*` / teardown hooks (and corresponding test cleanup) for multi-instance reuse and deterministic isolated testing.
5. **Lifecycle Safety & Contract Ergonomics:**
   - Shared hooks/utilities missing resource cleanup (`AbortController`, timer/listener teardown, object URL revocation, stream/file handle `.close()`), clear barrel exports, or strict TypeScript JSDoc/type exports.

### 3. Phase 3 — Prioritize & Fix Reusability Gaps
- **If no meaningful reusability defects, duplications, or portability leaks are found:** Report the clean audit findings and stop without unnecessary churn.
- **If actionable reusability issues are found:**
  - If the repo uses a checkpointed plan/handoff convention for multi-file (`>= 3` files) changes, create and update it as required, then proceed immediately.
  - Apply fixes in safe, incremental steps:
    1. **Consolidate Duplication:** Move or point duplicated pure logic and micro-utilities (slugifiers, escapers, deterministic hashes, binary/data-URL codecs, etc.) to the canonical shared primitive/codec/feature/utility module without introducing heavy transitive dependencies. Confirm the canonical owner already exists before inventing a module: a second home for the same helper is a regression, not a fix. Report the duplicated line count you removed so the gain is measurable.
    2. **Parameterize & Decouple:** Replace hardcoded prefixes, brand strings, domain schemas, or concrete host globals with typed options, generics `<T>`, schema configs, or adapter/bridge interfaces, keeping thin domain-bound wrappers in `app/` or `domain/` for existing callers.
    3. **Harden Lifecycle & Singleton Isolation:** Ensure shared utilities clean up timers/listeners/handles/URLs cleanly and expose explicit initialization, `reset*`, or DI seams paired with test assertions.
    4. **Sync Inventories & Contracts:** Update any module inventories/docs (e.g., `EXTRACTION_INVENTORY.md`), barrel exports, and layer tests to reflect newly generalized or extracted modules.
    5. **Prove Reusability With Tests:** Add or update unit tests that exercise generalized modules and `configure*`/`reset*` hooks using **non-default, domain-agnostic test fixtures** (distinct schemas, prefixes, and mock adapters) to prove zero hidden domain assumptions remain.

### 4. Phase 4 — Verify & Report
- **Only if a shell exists.** Run the repository's full verification and build suite (e.g., `npm run verify` and `npm run build`, or all available typecheck, test, layer, isolated-engine/extraction, invariant, and build commands). With no shell, record `deferred_gates` on the step log entry via `--deferred-gates <gate>` and report the suite as not run here - never as a pass.
- Update any required improvement/change registry (such as `src/domain/improvementRegistry.ts` and `IMPROVEMENTS.md`) if significant structural, storage, or memory/lifecycle changes were made, and remove temporary plan/handoff files once all checks pass.
- Report concisely:
  1. **Reusability Scorecard:** Status of all verification, isolated-compile, test, and build checks.
  2. **Improvements Applied (or Confirmed Clean):** Duplications consolidated, modules parameterized/decoupled, and DI seams added (with file paths).
  3. **Remaining Opportunities:** Any lower-priority or intentionally domain-bound modules left as-is and why.
  4. **Checks That Could Not Run:** Every gate you skipped or that could not execute here, with the missing toolchain or permission that blocked it - never presented as a pass. Include any audit that printed success while verifying nothing because its input was absent.
  5. **Estimated Reusability:** After completing all edits (if any), output `Estimated Reusability: <0-100>%` followed by a 1-line objective basis (extractable domain-free surface ratio, duplication elimination, DI parameterization, singleton reset/lifecycle safety, and remaining app-coupled modules).

## Exit Contract

- Print `OK [reusability-check] files=<count>` with the scorecard and duplication counts when the audit finishes, or `STEP_BLOCKED [reusability-check]: <1-2 line reason> | Reverted: <files> | Resume: fix issue and re-run launcher.` when a consolidation cannot be completed safely in this run. Revert only the files this step touched.
