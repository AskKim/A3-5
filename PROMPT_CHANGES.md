# Prompt Changes & Recovery Log

This document is synchronized with `src/domain/promptRegistry.ts` and verified automatically
by `npm run verify:prompts`. Whenever a prompt in `/prompts/` is added, refined, archived, or
accidentally overwritten, run the verifier to pinpoint any lost directives or protection flags
and follow the restoration playbook below.

- **Active Prompt Trackers:** 7
- **Archived Snapshot Trackers:** 1

## Quick Verification Commands

```bash
# Check all /prompts/* invariants and protection flags on disk
npm run verify:prompts

# Run full project verification suite (includes prompt registry tests)
npm run verify
```

---

## Logged Prompt Revisions (8)

### PRM-001: Active Master System Prompt Governance, Alignment & Registry Mandates

- **Prompt File:** `prompts/master_system_prompt.md`
- **Lifecycle:** `active`
- **Category:** Master Governance & Rules (`system-governance`)
- **Last Edited:** 2026-11-27
- **Intent:** Maintain one canonical, compact rulebook governing alignment checks, React PWA lock, three-layer boundaries, strict TypeScript, and mandatory improvement logging.
- **Change Summary:** Evolved from v1/v2/v4 into the unified `prompts/master_system_prompt.md` aligned with `GEMINI.md` and `AGENTS.md`: adds `DO_NOT_REMOVE_WITHOUT_CONFIRMATION`, `ALIGNED` + single-line pending status output rules, three-layer isolation (`@engine/*`, `@features/*`, `@domain/*`, `@app/*`), plan cleanup, and mandatory `improvementRegistry.ts` logging.
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
- **Last Edited:** 2026-11-24
- **Intent:** Pick the top item from `docs/plans/suggestions-backlog.md` and drive end-to-end implementation without clobbering active plans.
- **Change Summary:** Redirects immediately to `resume_backlog_plan_prompt.md` if an active plan already exists, enforces full audit/build verification, and marks completed suggestions cleanly.
- **Tracked Files:** `prompts/start_new_backlog_prompt.md`

**Protected Invariants:**
- `prompts/start_new_backlog_prompt.md` must contain `<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->`, `suggestions-backlog.md`, `resume_backlog_plan_prompt.md` — *Backlog starter prompt must stay protected and check for active plans before starting a new item.*

**Recovery Playbook if Broken or Overwritten:**
1. Restore `prompts/start_new_backlog_prompt.md` with precheck redirect to `prompts/resume_backlog_plan_prompt.md`.

### PRM-004: Resume Active Backlog Plan Continuation Workflow

- **Prompt File:** `prompts/resume_backlog_plan_prompt.md`
- **Lifecycle:** `active`
- **Category:** Backlog & Handoff Workflows (`backlog-workflow`)
- **Last Edited:** 2026-11-24
- **Intent:** Resume in-progress multi-step implementation plans safely after loading master governance.
- **Change Summary:** Loads `prompts/master_system_prompt.md`, continues pending milestones in `docs/plans/`, runs full verification, and removes finished temporary plan files.
- **Tracked Files:** `prompts/resume_backlog_plan_prompt.md`

**Protected Invariants:**
- `prompts/resume_backlog_plan_prompt.md` must contain `<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->`, `prompts/master_system_prompt.md` — *Resume prompt must stay protected and always load `prompts/master_system_prompt.md` first.*

**Recovery Playbook if Broken or Overwritten:**
1. Restore `prompts/resume_backlog_plan_prompt.md` with phase-by-phase plan continuation and delete-on-wrapup cleanup.

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

- **Prompt File:** `prompts/modularity_check_prompt.md`
- **Lifecycle:** `active`
- **Category:** Modularity & Reusability Audits (`architecture-audit`)
- **Last Edited:** 2026-11-27
- **Intent:** Provide a concise, project-agnostic modularity evaluation and remediation prompt covering layer direction, shared types, sibling isolation, cycles, and inventory sync.
- **Change Summary:** Added protected reusable `modularity_check_prompt.md` and refined Phase 2–4 to enforce comment/string-safe scanning, `hooks/` & `components/` coverage, shared type placement out of UI components, all-layer cycle detection, and final `Estimated Modularity` percentage reporting.
- **Tracked Files:** `prompts/modularity_check_prompt.md`, `src/domain/promptsCatalog.ts`

**Protected Invariants:**
- `prompts/modularity_check_prompt.md` must contain `<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->`, `# Modularity Check`, `Prompt Reusability:`, `Sibling Isolation:`, `Estimated Modularity:` — *Modularity prompt must stay protected, project-agnostic, include all-layer cycle/sibling isolation checks, and report Estimated Modularity percentage.*

**Recovery Playbook if Broken or Overwritten:**
1. Restore `prompts/modularity_check_prompt.md` and verify its entry in `src/domain/promptsCatalog.ts`.

### PRM-007: Reusable 4-Phase Reusability Check Prompt

- **Prompt File:** `prompts/reusability_check_prompt.md`
- **Lifecycle:** `active`
- **Category:** Modularity & Reusability Audits (`architecture-audit`)
- **Last Edited:** 2026-11-27
- **Intent:** Provide a concise, project-agnostic reusability evaluation and refactoring prompt covering domain leakage, duplicated micro-utilities, rigid signatures, singleton teardown, and lifecycle hygiene.
- **Change Summary:** Added protected reusable `reusability_check_prompt.md` and hardened Phase 2–4 to require micro-utility consolidation without transitive heavy dependency leaks, singleton `reset*` hooks, non-default test fixtures proving reusability, and final `Estimated Reusability` percentage reporting.
- **Tracked Files:** `prompts/reusability_check_prompt.md`, `src/domain/promptsCatalog.ts`

**Protected Invariants:**
- `prompts/reusability_check_prompt.md` must contain `<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->`, `# Reusability Check`, `Prompt Reusability:`, `Domain & Brand Leakage in Shared Code:`, `Estimated Reusability:` — *Reusability prompt must stay protected, project-agnostic, guard against bundle bloat/singleton lock-in, and report Estimated Reusability percentage.*

**Recovery Playbook if Broken or Overwritten:**
1. Restore `prompts/reusability_check_prompt.md` and verify its entry in `src/domain/promptsCatalog.ts`.

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
