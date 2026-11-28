# append-only, oldest first. Never rewrite past entries.
# Agents: read this before starting work; append an entry when you finish.
# One entry per KEPT version; experiments go in SCRATCH.
# Format updated 2026-11-28. Entries below predate Status/Rejected; do not backfill them.
# New entries are generated from the registry — add the entry, then run `npm run regen:ledgers` —
# and land at the bottom, after the last existing entry, in this shape:
#
#   ## <prompt-name> <version> — one-line summary
#   Prompt:     path/to/prompt.md @ <commit-sha or tag>
#   Why:        what was wrong with the previous version
#   Changed:    what this edit did
#   Rejected:   what else was tried and why it lost
#   Supersedes: <previous version> — why it was replaced (omit for a first version)
#   Status:     active | reverted | superseded
#
# Escalation: if Rejected needs more than two lines, promote that entry to
#   docs/decisions/NNNN-slug.md (Context / Decision / Alternatives / Consequences)

# Prompt Changes & Recovery Log

This document is synchronized with `src/domain/promptRegistry.ts` and verified automatically
by `npm run verify:prompts`. Whenever a prompt in `/prompts/` is added, refined, archived, or
accidentally overwritten, run the verifier to pinpoint any lost directives or protection flags
and follow the restoration playbook below.

- **Active Prompt Trackers:** 11
- **Archived Snapshot Trackers:** 1

## Quick Verification Commands

```bash
# Check all /prompts/* invariants and protection flags on disk
npm run verify:prompts

# Run full project verification suite (includes prompt registry tests)
npm run verify
```

---

## Logged Prompt Revisions (12)

### PRM-001: Active Master System Prompt Governance, Alignment & Registry Mandates

- **Prompt File:** `prompts/master_system_prompt.md`
- **Lifecycle:** `active`
- **Category:** Master Governance & Rules (`system-governance`)
- **Last Edited:** 2026-11-28
- **Intent:** Maintain one canonical, compact rulebook governing alignment checks, React PWA lock, three-layer boundaries, strict TypeScript, and mandatory improvement logging.
- **Change Summary:** Evolved from v1/v2/v4 into the unified `prompts/master_system_prompt.md` aligned with `GEMINI.md` and `AGENTS.md`: adds `DO_NOT_REMOVE_WITHOUT_CONFIRMATION`, `ALIGNED` + single-line pending status output rules, three-layer isolation (`@engine/*`, `@features/*`, `@domain/*`, `@app/*`), plan cleanup, and mandatory `improvementRegistry.ts` logging. The logging mandate now covers `src/domain/promptRegistry.ts` and `PROMPT_CHANGES.md` alongside the app registry, and states that both ledgers are generated (`npm run regen:ledgers`, never hand-edited) and gated by `verify:improvements` / `verify:prompts`.
- **Tracked Files:** `prompts/master_system_prompt.md`, `GEMINI.md`, `AGENTS.md`

**Protected Invariants:**
- `prompts/master_system_prompt.md` must contain `<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->`, `<SYSTEM_RULES_DIRECTIVE>`, `Never Convert PWA Away From React`, `Mandatory Improvement Logging` — *Active master prompt must stay protected and preserve React-core, alignment, and improvement logging mandates.*

**Recovery Playbook if Broken or Overwritten:**
1. Restore `prompts/master_system_prompt.md` from git or archived v4 + alignment/modularity rules in `GEMINI.md`/`AGENTS.md`.
2. Ensure `<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->` stays on line 1.

### PRM-002: Archived Historical Master System Prompt Snapshots (v1, v2, v4)

- **Prompt File:** `prompts/master_system_prompt_old_v1.md`
- **Lifecycle:** `archived`
- **Category:** Archived Prompt Snapshots (`historical-archive`)
- **Last Edited:** 2026-11-18
- **Intent:** Preserve earlier editions of the master system prompt strictly for diff audit and historical provenance.
- **Change Summary:** Moved superseded editions to `_old_v1`, `_old_v2`, and `_old_v4` with explicit `ARCHIVED — STRICTLY FOR REFERENCE ONLY` banners and protection flags.
- **Tracked Files:** `prompts/master_system_prompt_old_v1.md`, `prompts/master_system_prompt_old_v2.md`, `prompts/master_system_prompt_old_v4.md`

**Protected Invariants:**
- `prompts/master_system_prompt_old_v1.md` must contain `DO_NOT_REMOVE_WITHOUT_CONFIRMATION`, `ARCHIVED — STRICTLY FOR REFERENCE ONLY` — *Archived v1 snapshot must retain its archive banner and protection flag.*
- `prompts/master_system_prompt_old_v2.md` must contain `DO_NOT_REMOVE_WITHOUT_CONFIRMATION`, `ARCHIVED — STRICTLY FOR REFERENCE ONLY` — *Archived v2 snapshot must retain its archive banner and protection flag.*
- `prompts/master_system_prompt_old_v4.md` must contain `DO_NOT_REMOVE_WITHOUT_CONFIRMATION`, `ARCHIVED — STRICTLY FOR REFERENCE ONLY` — *Archived v4 snapshot must retain its archive banner and protection flag.*

**Recovery Playbook if Broken or Overwritten:**
1. Restore missing archived snapshots from git history and keep `ARCHIVED — STRICTLY FOR REFERENCE ONLY` banners intact.

### PRM-003: Start New Backlog Item & Plan-Precheck Workflow

- **Prompt File:** `prompts/start_new_backlog_prompt.md`
- **Lifecycle:** `active`
- **Category:** Backlog & Handoff Workflows (`backlog-workflow`)
- **Last Edited:** 2026-11-28
- **Intent:** Pick the top item from `docs/plans/suggestions-backlog.md` and drive end-to-end implementation without clobbering active plans or open handoffs.
- **Change Summary:** Precheck now covers open handoffs as well as active plans: an unfinished `handoff-*.yaml` is continued before any new backlog item is started, and only when neither exists does the workflow pick an entry. Still redirects to `resume_backlog_plan_prompt.md` for active plans and enforces full audit/build verification.
- **Tracked Files:** `prompts/start_new_backlog_prompt.md`

**Protected Invariants:**
- `prompts/start_new_backlog_prompt.md` must contain `<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->`, `suggestions-backlog.md`, `resume_backlog_plan_prompt.md`, `handoff-*.yaml` — *Backlog starter prompt must stay protected and check for both active plans and open handoffs before starting a new item.*

**Recovery Playbook if Broken or Overwritten:**
1. Restore `prompts/start_new_backlog_prompt.md` with the open-handoff precheck and the redirect to `prompts/resume_backlog_plan_prompt.md`.

### PRM-004: Resume Active Backlog Plan Continuation Workflow

- **Prompt File:** `prompts/resume_backlog_plan_prompt.md`
- **Lifecycle:** `active`
- **Category:** Backlog & Handoff Workflows (`backlog-workflow`)
- **Last Edited:** 2026-11-28
- **Intent:** Resume in-progress multi-step implementation plans or open handoffs safely after loading master governance.
- **Change Summary:** Loads `prompts/master_system_prompt.md`, continues pending milestones in `docs/plans/`, resumes an open `handoff-*.yaml` when no active plan exists, and treats a milestone closure as a checkpoint, not a turn boundary, so one run continues milestone-to-milestone until the list is empty or the budget runs out. Runs full verification and removes finished temporary plan files.
- **Tracked Files:** `prompts/resume_backlog_plan_prompt.md`

**Protected Invariants:**
- `prompts/resume_backlog_plan_prompt.md` must contain `<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->`, `prompts/master_system_prompt.md`, `handoff-*.yaml`, `checkpoint, not a turn boundary` — *Resume prompt must stay protected, load `prompts/master_system_prompt.md` first, treat an open handoff as work to continue rather than work to replace, and keep the continuity rule that stops a green checkpoint from ending the run.*

**Recovery Playbook if Broken or Overwritten:**
1. Restore `prompts/resume_backlog_plan_prompt.md` with phase-by-phase plan continuation, open-handoff continuation and delete-on-wrapup cleanup.

### PRM-005: Automated Crash Diagnostic & Code Remediation Prompt

- **Prompt File:** `prompts/fix_error_log_prompt.md`
- **Lifecycle:** `active`
- **Category:** Crash Diagnostics & Repair (`diagnostics-debug`)
- **Last Edited:** 2026-11-24
- **Intent:** Diagnose and fix application crashes or error logs using root-cause patches and regression tests.
- **Change Summary:** Updated architectural constraints to reference `src/engine/`, `src/domain/`, `src/app/`, `src/storage/`, and `prompts/master_system_prompt.md` offline/memory invariants.
- **Tracked Files:** `prompts/fix_error_log_prompt.md`

**Protected Invariants:**
- `prompts/fix_error_log_prompt.md` must contain `<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->`, `prompts/master_system_prompt.md`, `src/engine/` — *Crash diagnostic prompt must stay protected and reference `src/engine/` & `src/domain/` rather than retired `src/core/`.*
  - Forbidden regression: `src/core/`

**Recovery Playbook if Broken or Overwritten:**
1. Restore `prompts/fix_error_log_prompt.md` referencing `src/engine/` and `src/domain/` invariants.

### PRM-006: Reusable 4-Phase Modularity Check Prompt

- **Prompt File:** `prompts/preflight/run-uni/modularity-check.md`
- **Lifecycle:** `active`
- **Category:** Modularity & Reusability Audits (`architecture-audit`)
- **Last Edited:** 2026-11-28
- **Intent:** Provide a concise, project-agnostic modularity evaluation and remediation prompt covering layer direction, shared types, sibling isolation, cycles, and inventory sync.
- **Change Summary:** Added protected reusable `modularity-check.md` and refined Phase 2–4 to enforce comment/string-safe scanning, `hooks/` & `components/` coverage, shared type placement out of UI components, all-layer cycle detection, gate-honesty reporting (no silent skips), and final `Estimated Modularity` percentage reporting; relocated from `/prompts/` into `prompts/preflight/run-uni/` and wired as a `[REUSABLE]` Phase B preflight step.
- **Tracked Files:** `prompts/preflight/run-uni/modularity-check.md`, `prompts/preflight/manifest/preflight.manifest.json`, `prompts/preflight/pf-launcher-uni.md`

**Protected Invariants:**
- `prompts/preflight/run-uni/modularity-check.md` must contain `<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->`, `# Modularity Check`, `Prompt Reusability:`, `Sibling Isolation:`, `Estimated Modularity:` — *Modularity prompt must stay protected, project-agnostic, include all-layer cycle/sibling isolation checks, and report Estimated Modularity percentage.*

**Recovery Playbook if Broken or Overwritten:**
1. Restore `prompts/preflight/run-uni/modularity-check.md` (protected `DO_NOT_REMOVE_WITHOUT_CONFIRMATION` line 1, `Prompt Reusability:`, `Sibling Isolation:`, `Estimated Modularity:`) and keep it wired as the `modularity-check` `[REUSABLE]` step in `prompts/preflight/manifest/preflight.manifest.json` and `prompts/preflight/pf-launcher-uni.md`.

### PRM-007: Reusable 4-Phase Reusability Check Prompt

- **Prompt File:** `prompts/preflight/run-uni/reusability-check.md`
- **Lifecycle:** `active`
- **Category:** Modularity & Reusability Audits (`architecture-audit`)
- **Last Edited:** 2026-11-28
- **Intent:** Provide a concise, project-agnostic reusability evaluation and refactoring prompt covering domain leakage, duplicated micro-utilities, rigid signatures, singleton teardown, and lifecycle hygiene.
- **Change Summary:** Added protected reusable `reusability-check.md` and hardened Phase 2–4 to require micro-utility consolidation onto an existing canonical owner without transitive heavy dependency leaks, singleton `reset*` hooks, non-default test fixtures proving reusability, measurable duplication counts, and final `Estimated Reusability` percentage reporting; relocated from `/prompts/` into `prompts/preflight/run-uni/` and wired as a `[REUSABLE]` Phase B preflight step.
- **Tracked Files:** `prompts/preflight/run-uni/reusability-check.md`, `prompts/preflight/manifest/preflight.manifest.json`, `prompts/preflight/pf-launcher-uni.md`

**Protected Invariants:**
- `prompts/preflight/run-uni/reusability-check.md` must contain `<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->`, `# Reusability Check`, `Prompt Reusability:`, `Domain & Brand Leakage in Shared Code:`, `Estimated Reusability:` — *Reusability prompt must stay protected, project-agnostic, guard against bundle bloat/singleton lock-in, and report Estimated Reusability percentage.*

**Recovery Playbook if Broken or Overwritten:**
1. Restore `prompts/preflight/run-uni/reusability-check.md` (protected `DO_NOT_REMOVE_WITHOUT_CONFIRMATION` line 1, `Prompt Reusability:`, `Domain & Brand Leakage in Shared Code:`, `Estimated Reusability:`) and keep it wired as the `reusability-check` `[REUSABLE]` step in `prompts/preflight/manifest/preflight.manifest.json` and `prompts/preflight/pf-launcher-uni.md`.

### PRM-008: Core Hygiene & PII Check Prompt (Core Content-Free Naming + Human/Contact PII Scrub)

- **Prompt File:** `prompts/core_hygiene.md`
- **Lifecycle:** `active`
- **Category:** Core Naming Hygiene & PII Scrubbing (`hygiene-privacy`)
- **Last Edited:** 2026-11-27
- **Intent:** Audit and fix content-specific filenames and symbols strictly in core/feature/utility layers (exempting content-specific domain modules) and scan/scrub human names, emails, physical addresses, phone numbers, and other PII.
- **Change Summary:** Created short-named, reusable `prompts/core_hygiene.md` with context-aware identifier tokenization, explicit domain-module exemption checks, single-pass linkage updates, and extended RFC-2606-safe PII/contact scanning and redaction rules; registered in `src/domain/promptsCatalog.ts`.
- **Tracked Files:** `prompts/core_hygiene.md`, `src/domain/promptsCatalog.ts`

**Protected Invariants:**
- `prompts/core_hygiene.md` must contain `<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->`, `# Core Hygiene & PII Check`, `Track A: Content-Specific Names & Symbols in Core/Reusable Modules`, `Track B: Personal Identifiable Information (PII) & Human Contact Scan`, `Prompt Reusability:` — *Core hygiene prompt must remain protected and cover both core naming purity (with domain exemptions) and PII scrubbing.*

**Recovery Playbook if Broken or Overwritten:**
1. Restore `prompts/core_hygiene.md` and keep it registered in `CURATED_PROMPT_DESCRIPTIONS` in `src/domain/promptsCatalog.ts`.

## start_new_backlog_prompt 2026-11-28 — Start New Backlog Prompt — Open-Handoff Precheck Revision
Prompt:     prompts/start_new_backlog_prompt.md @ 7a57c35
Why:        A new backlog item could start while an unfinished handoff was still open, so the workflow picked fresh work over work already in flight.
Changed:    The precheck now covers open handoffs as well as active plans: an unfinished `handoff-*.yaml` is continued before any new backlog item is started, and only when neither exists does the workflow pick an entry.
Status:     active

**Protected Invariants:**
- `prompts/start_new_backlog_prompt.md` must contain `<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->`, `suggestions-backlog.md`, `resume_backlog_plan_prompt.md`, `handoff-*.yaml` — *Backlog starter prompt must stay protected and check for both active plans and open handoffs before starting a new item.*

**Recovery Playbook if Broken or Overwritten:**
1. Restore `prompts/start_new_backlog_prompt.md` with the open-handoff precheck and the redirect to `prompts/resume_backlog_plan_prompt.md`.

## resume_backlog_plan_prompt 2026-11-28 — Resume Backlog Plan Prompt — All-Handoff Scan Revision
Prompt:     prompts/resume_backlog_plan_prompt.md @ 170a49d
Why:        A run ended with `NO PENDING WORK` after closing one handoff, while `docs/plans/handoff-modularity-reusability.yaml` still had seven open steps: the run-end rule only looked at the handoff it was reading.
Changed:    The run now ends only when **every** open handoff and plan in `docs/plans/` is empty. Closing a `handoff-*.yaml` is explicitly not completion: the step-2 check lists every open `handoff-*.yaml` before picking one, names the single-file read as the failure mode, and re-scans the directory after each closure to continue the next open handoff.
Status:     active

**Protected Invariants:**
- `prompts/resume_backlog_plan_prompt.md` must contain `<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->`, `prompts/master_system_prompt.md`, `handoff-*.yaml`, `checkpoint, not a turn boundary`, `re-scan `docs/plans/handoff-*.yaml` after every closure`, `List **every** open `handoff-*.yaml`` — *The resume path decides when a run is finished, so both the all-files scan and the post-closure re-scan have to live there and cannot be edited away silently.*

**Recovery Playbook if Broken or Overwritten:**
1. Restore the all-handoff run-end rule and the per-closure re-scan sentence; a single-file check is the regression this entry prevents.
2. Keep the redirect to `prompts/start_new_backlog_prompt.md` for the case where no handoff and no plan is open.

## start_new_backlog_prompt 2026-11-28 — Start New Backlog Prompt — Every-Handoff Precheck Revision
Prompt:     prompts/start_new_backlog_prompt.md @ 170a49d
Why:        The precheck stopped at the first handoff it found, so a second open handoff could sit untouched while the workflow moved on to a new backlog entry.
Changed:    The precheck now says to scan every `handoff-*.yaml`, not just the first, continues the first open handoff and then re-scans for the next, states plainly that a finished file is not a finished directory, and allows a new backlog entry only when no active plan and no open step in any handoff exists.
Status:     active

**Protected Invariants:**
- `prompts/start_new_backlog_prompt.md` must contain `<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->`, `suggestions-backlog.md`, `resume_backlog_plan_prompt.md`, `handoff-*.yaml`, `scan every `handoff-*.yaml`, not just the first`, `a finished file is not a finished directory` — *The backlog gate is the other place that can start unrelated work while a handoff is still open; the all-files scan and its reason must both survive.*

**Recovery Playbook if Broken or Overwritten:**
1. Restore the all-handoff precheck and the "finished file is not a finished directory" rule, then keep the redirect to the resume prompt for active plans.

## pf-launcher-uni 2026-11-28 — Preflight Launcher — Single Manifest, Generated Step Lists, Two Step Types
Prompt:     prompts/preflight/pf-launcher-uni.md @ cd72d34
Why:        The preflight launcher had grown four hand-maintained copies of one step list (its own lines, a byte-identical second manifest, the wiring table and a module roster) plus a third step type that nothing enforced, so the copies disagreed and had to be re-synced by hand.
Changed:    `prompts/preflight/manifest/preflight.manifest.json` is now the only place a step is declared. `scripts/gen-preflight.mjs` renders the launcher step blocks (preserving retired `AGENT_SKIP_LINE` lines by `step_id`), the module summary, `pf-launcher-uni-wiring.md` and the pristine template, and `--check` plus `preflight-lint.mjs` fail on drift. Steps are sorted by the minimum environment they need: Phase A (10 steps) is file read/edit only, Phase B (8 steps) needs git, a shell, a build, CI or the device, and each step carries an ordered runner bracket such as `[ai-studio | freebuff]` or `[antigravity | freebuff]` where first listed is preferred. `modularity-check`, `reusability-check`, `ci-setup` and `attribution-audit` moved to Phase A with their gate tails deferred to `ci-guide`; `ai-baseline` and `crawl-guide` moved to Phase B because they run `npm` and the subpath build. The duplicate root manifest, the two Google Drive export scripts and the third step type are gone, `freebuff` is now a legal ledger platform, and `preflight-state.mjs` takes the resume phase from the manifest instead of a second hardcoded list.
Status:     active

**Protected Invariants:**
- `prompts/preflight/pf-launcher-uni.md` must contain `AGENT_SKIP_LINE`, `=== CONSTRAINTS ===`, `<!-- PHASE_A_STEPS_START -->`, `<!-- PHASE_B_STEPS_START -->`, `prompts/preflight/manifest/preflight.manifest.json` — *The launcher is generated around its two step blocks, so those markers and the pointer to the single manifest have to survive every regeneration; losing them would quietly stop the retirement machinery and let the launcher and manifest disagree again.*

**Recovery Playbook if Broken or Overwritten:**
1. Restore the launcher from the pristine template (`node prompts/preflight/scripts/preflight-reset.mjs --full`), then re-render it with `npm run preflight:gen -- --write`.
2. Restore `prompts/preflight/manifest/preflight.manifest.json` as the only step list; never reintroduce a second manifest copy or a third step type.
