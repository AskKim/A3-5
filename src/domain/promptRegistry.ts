/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The changelog of prompt revisions, kept so an earlier version can be recovered.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Pure TypeScript Prompt Changelog & Recovery Registry (`src/domain/promptRegistry.ts`).
 *
 * Purpose:
 *   Mirrors `improvementRegistry.ts` specifically for `/prompts/*` files so every intentional
 *   prompt creation, revision, archival, or guardrail update is recorded with machine-checkable
 *   invariants and step-by-step restoration playbooks. Running `npm run verify:prompts` catches
 *   accidental prompt deletion, protection-flag stripping, or sync overwrites.
 *
 * CROSS-PLATFORM MIGRATION GUARDRAIL:
 *   100% pure TypeScript with zero browser DOM (`window`, `document`) or Node (`fs`, `path`) imports.
 *   Node disk scanning lives in `scripts/verify-prompts.ts`.
 */

import { nowIsoUtc } from './models';
import { formatLedgerHeader, isRealCalendarDate, type LedgerEntryStatus } from './ledgerContract';

export type PromptChangeCategory =
  | 'system-governance'
  | 'backlog-workflow'
  | 'diagnostics-debug'
  | 'architecture-audit'
  | 'hygiene-privacy'
  | 'historical-archive';

export type PromptLifecycleState = 'active' | 'archived';

export interface PromptInvariant {
  /** Workspace-relative POSIX path, e.g. `prompts/master_system_prompt.md` */
  filePath: string;
  /** Critical directives, flags, or sections that must remain present in this prompt file */
  requiredSubstrings: string[];
  /** Anti-patterns or stale directives that must NOT reappear in this file */
  forbiddenSubstrings?: string[];
  /** Short explanation of why this prompt invariant exists */
  rationale: string;
}

export interface PromptChangeEntry {
  id: string;
  promptFile: string;
  title: string;
  category: PromptChangeCategory;
  lifecycle: PromptLifecycleState;
  lastEdited: string;
  intent: string;
  changeSummary: string;
  trackedFiles: string[];
  invariants: PromptInvariant[];
  restorePlaybook: string[];
  /**
   * Append-only ledger contract (`src/domain/ledgerContract.ts`). When `decidedOn`, `version` and
   * `commitShaOrTag` are all set, the formatter emits the documented
   * `## <prompt-name> <version> — summary` block instead of the legacy `### PRM-0NN:` block.
   * `supersedes` is optional because a first kept version has nothing to replace. Entries missing
   * the three opt-in fields stay legacy and are never rewritten.
   */
  decidedOn?: string;
  version?: string;
  commitShaOrTag?: string;
  supersedes?: string;
  status?: LedgerEntryStatus;
  /** Rendered as `superseded by <entry>` when `status` is `superseded`. */
  supersededBy?: string;
  /** The alternative tried and why it lost; omit when there was none. */
  rejected?: string;
}

export interface PromptLedgerOptInViolation {
  entryId: string;
  title: string;
  issue: string;
}

/** Ledger fields that the formatter only renders for a contract-shaped entry. */
const LEDGER_ENTRY_FIELDS = [
  'decidedOn',
  'version',
  'commitShaOrTag',
  'supersedes',
  'supersededBy',
  'status',
  'rejected',
] as const;

const LEDGER_OPT_IN_FIELDS = ['decidedOn', 'version', 'commitShaOrTag'] as const;

/**
 * Prompt entries that predate the ledger contract and keep the legacy `### PRM-0NN:` shape.
 *
 * Pinned by ID on purpose: an entry outside this list must carry the full three-field opt-in, so a
 * new revision cannot be logged in the old shape by simply omitting every ledger field. Prune an ID
 * once that entry opts in — the pin drift gate reports both a stale pin and a pinned entry that now
 * uses the contract shape.
 */
export const LEGACY_PROMPT_ENTRY_IDS: readonly string[] = [
  'PRM-001',
  'PRM-002',
  'PRM-003',
  'PRM-004',
  'PRM-005',
  'PRM-006',
  'PRM-007',
  'PRM-008',
];

/**
 * Rejects entries that would not be logged in the documented shape: a pinned legacy entry that
 * half-opts-in, any entry outside `LEGACY_PROMPT_ENTRY_IDS` that is missing all or part of
 * `decidedOn` + `version` + `commitShaOrTag`, and a `status: superseded` entry with no
 * `supersededBy`. `formatPromptChangelogMarkdown` silently falls back to the legacy `### PRM-0NN:`
 * block, so without this gate an author could believe a change was logged when only part of it
 * was — or when none of it was.
 */
export function findLedgerOptInViolations(
  entries: readonly PromptChangeEntry[] = PROMPT_CHANGES_REGISTRY
): PromptLedgerOptInViolation[] {
  const violations: PromptLedgerOptInViolation[] = [];
  const pinned = new Set(LEGACY_PROMPT_ENTRY_IDS);
  const knownIds = new Set(entries.map((entry) => entry.id));

  for (const entry of entries) {
    if (entry.status === 'superseded' && !entry.supersededBy) {
      violations.push({
        entryId: entry.id,
        title: entry.title,
        issue:
          'sets `status: superseded` without `supersededBy` — the replacing entry would be lost; name it, or use active/reverted',
      });
    }

    if (entry.decidedOn && !isRealCalendarDate(entry.decidedOn)) {
      violations.push({
        entryId: entry.id,
        title: entry.title,
        issue: `sets decidedOn "${entry.decidedOn}", which is not a real calendar date — use YYYY-MM-DD; the ledger heading is rendered from it`,
      });
    }

    if (entry.supersededBy && !knownIds.has(entry.supersededBy)) {
      violations.push({
        entryId: entry.id,
        title: entry.title,
        issue: `names ${entry.supersededBy} in supersededBy, which is not a registry entry — point it at the entry that actually replaced this one`,
      });
    }

    const present = LEDGER_ENTRY_FIELDS.filter((field) => entry[field] !== undefined);
    if (present.length === 0 && pinned.has(entry.id)) continue;

    const missing = LEDGER_OPT_IN_FIELDS.filter((field) => entry[field] === undefined);
    if (missing.length === 0) continue;

    violations.push({
      entryId: entry.id,
      title: entry.title,
      issue: pinned.has(entry.id)
        ? `sets ${present.join(', ')} but is missing ${missing.join(
            ', '
          )} — the formatter would silently render the legacy block; set all of decidedOn, version and commitShaOrTag, or none`
        : `is not in LEGACY_PROMPT_ENTRY_IDS and is missing ${missing.join(
            ', '
          )} — a new prompt revision must opt in with decidedOn, version and commitShaOrTag, or the formatter renders the legacy block`,
    });
  }

  return violations;
}

/**
 * Keeps `LEGACY_PROMPT_ENTRY_IDS` honest in both directions: every pin must still name a registry
 * entry, and that entry must still be legacy. Without this, the exemption could outlive the entries
 * it was written for and quietly cover a future one.
 */
export function findLedgerPinViolations(
  entries: readonly PromptChangeEntry[] = PROMPT_CHANGES_REGISTRY
): PromptLedgerOptInViolation[] {
  const violations: PromptLedgerOptInViolation[] = [];

  for (const id of LEGACY_PROMPT_ENTRY_IDS) {
    const pinned = entries.find((entry) => entry.id === id);
    if (!pinned) {
      violations.push({
        entryId: id,
        title: 'LEGACY_PROMPT_ENTRY_IDS',
        issue: `pins ${id}, which is no longer in the registry — prune it from LEGACY_PROMPT_ENTRY_IDS`,
      });
    } else if (pinned.decidedOn) {
      violations.push({
        entryId: id,
        title: pinned.title,
        issue:
          'is pinned as a grandfathered legacy entry but now opts into the contract — remove it from LEGACY_PROMPT_ENTRY_IDS',
      });
    }
  }

  return violations;
}

export interface PromptDriftViolation {
  entryId: string;
  title: string;
  filePath: string;
  issue: string;
  restorePlaybook: string[];
}

export interface PromptDriftReport {
  checkedAtIso: string;
  totalEntries: number;
  totalFilesChecked: number;
  passedCount: number;
  violations: PromptDriftViolation[];
  ok: boolean;
}

export const PROMPT_CATEGORY_LABELS: Record<PromptChangeCategory, string> = {
  'system-governance': 'Master Governance & Rules',
  'backlog-workflow': 'Backlog & Handoff Workflows',
  'diagnostics-debug': 'Crash Diagnostics & Repair',
  'architecture-audit': 'Modularity & Reusability Audits',
  'hygiene-privacy': 'Core Naming Hygiene & PII Scrubbing',
  'historical-archive': 'Archived Prompt Snapshots',
};

export const PROMPT_CHANGES_REGISTRY: PromptChangeEntry[] = [
  {
    id: 'PRM-001',
    promptFile: 'prompts/master_system_prompt.md',
    title: 'Active Master System Prompt Governance, Alignment & Registry Mandates',
    category: 'system-governance',
    lifecycle: 'active',
    lastEdited: '2026-11-28',
    intent:
      'Maintain one canonical, compact rulebook governing alignment checks, React PWA lock, three-layer boundaries, strict TypeScript, and mandatory improvement logging.',
    changeSummary:
      'Evolved from v1/v2/v4 into the unified `prompts/master_system_prompt.md` aligned with `GEMINI.md` and `AGENTS.md`: adds `DO_NOT_REMOVE_WITHOUT_CONFIRMATION`, `ALIGNED` + single-line pending status output rules, three-layer isolation (`@engine/*`, `@features/*`, `@domain/*`, `@app/*`), plan cleanup, and mandatory `improvementRegistry.ts` logging. The logging mandate now covers `src/domain/promptRegistry.ts` and `PROMPT_CHANGES.md` alongside the app registry, and states that both ledgers are generated (`npm run regen:ledgers`, never hand-edited) and gated by `verify:improvements` / `verify:prompts`.',
    trackedFiles: ['prompts/master_system_prompt.md', 'GEMINI.md', 'AGENTS.md'],
    invariants: [
      {
        filePath: 'prompts/master_system_prompt.md',
        requiredSubstrings: [
          '<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->',
          '<SYSTEM_RULES_DIRECTIVE>',
          'Never Convert PWA Away From React',
          'Mandatory Improvement Logging',
        ],
        rationale:
          'Active master prompt must stay protected and preserve React-core, alignment, and improvement logging mandates.',
      },
    ],
    restorePlaybook: [
      'Restore `prompts/master_system_prompt.md` from git or archived v4 + alignment/modularity rules in `GEMINI.md`/`AGENTS.md`.',
      'Ensure `<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->` stays on line 1.',
    ],
  },
  {
    id: 'PRM-002',
    promptFile: 'prompts/master_system_prompt_old_v1.md',
    title: 'Archived Historical Master System Prompt Snapshots (v1, v2, v4)',
    category: 'historical-archive',
    lifecycle: 'archived',
    lastEdited: '2026-11-18',
    intent:
      'Preserve earlier editions of the master system prompt strictly for diff audit and historical provenance.',
    changeSummary:
      'Moved superseded editions to `_old_v1`, `_old_v2`, and `_old_v4` with explicit `ARCHIVED — STRICTLY FOR REFERENCE ONLY` banners and protection flags.',
    trackedFiles: [
      'prompts/master_system_prompt_old_v1.md',
      'prompts/master_system_prompt_old_v2.md',
      'prompts/master_system_prompt_old_v4.md',
    ],
    invariants: [
      {
        filePath: 'prompts/master_system_prompt_old_v1.md',
        requiredSubstrings: [
          'DO_NOT_REMOVE_WITHOUT_CONFIRMATION',
          'ARCHIVED — STRICTLY FOR REFERENCE ONLY',
        ],
        rationale: 'Archived v1 snapshot must retain its archive banner and protection flag.',
      },
      {
        filePath: 'prompts/master_system_prompt_old_v2.md',
        requiredSubstrings: [
          'DO_NOT_REMOVE_WITHOUT_CONFIRMATION',
          'ARCHIVED — STRICTLY FOR REFERENCE ONLY',
        ],
        rationale: 'Archived v2 snapshot must retain its archive banner and protection flag.',
      },
      {
        filePath: 'prompts/master_system_prompt_old_v4.md',
        requiredSubstrings: [
          'DO_NOT_REMOVE_WITHOUT_CONFIRMATION',
          'ARCHIVED — STRICTLY FOR REFERENCE ONLY',
        ],
        rationale: 'Archived v4 snapshot must retain its archive banner and protection flag.',
      },
    ],
    restorePlaybook: [
      'Restore missing archived snapshots from git history and keep `ARCHIVED — STRICTLY FOR REFERENCE ONLY` banners intact.',
    ],
  },
  {
    id: 'PRM-003',
    promptFile: 'prompts/start_new_backlog_prompt.md',
    title: 'Start New Backlog Item & Plan-Precheck Workflow',
    category: 'backlog-workflow',
    lifecycle: 'active',
    lastEdited: '2026-11-28',
    intent:
      'Pick the top item from `docs/plans/suggestions-backlog.md` and drive end-to-end implementation without clobbering active plans or open handoffs.',
    changeSummary:
      'Precheck now covers open handoffs as well as active plans: an unfinished `handoff-*.yaml` is continued before any new backlog item is started, and only when neither exists does the workflow pick an entry. Still redirects to `resume_backlog_plan_prompt.md` for active plans and enforces full audit/build verification.',
    trackedFiles: ['prompts/start_new_backlog_prompt.md'],
    invariants: [
      {
        filePath: 'prompts/start_new_backlog_prompt.md',
        requiredSubstrings: [
          '<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->',
          'suggestions-backlog.md',
          'resume_backlog_plan_prompt.md',
          'handoff-*.yaml',
        ],
        rationale:
          'Backlog starter prompt must stay protected and check for both active plans and open handoffs before starting a new item.',
      },
    ],
    restorePlaybook: [
      'Restore `prompts/start_new_backlog_prompt.md` with the open-handoff precheck and the redirect to `prompts/resume_backlog_plan_prompt.md`.',
    ],
  },
  {
    id: 'PRM-004',
    promptFile: 'prompts/resume_backlog_plan_prompt.md',
    title: 'Resume Active Backlog Plan Continuation Workflow',
    category: 'backlog-workflow',
    lifecycle: 'active',
    lastEdited: '2026-11-28',
    intent:
      'Resume in-progress multi-step implementation plans or open handoffs safely after loading master governance.',
    changeSummary:
      'Loads `prompts/master_system_prompt.md`, continues pending milestones in `docs/plans/`, resumes an open `handoff-*.yaml` when no active plan exists, and treats a milestone closure as a checkpoint, not a turn boundary, so one run continues milestone-to-milestone until the list is empty or the budget runs out. Runs full verification and removes finished temporary plan files.',
    trackedFiles: ['prompts/resume_backlog_plan_prompt.md'],
    invariants: [
      {
        filePath: 'prompts/resume_backlog_plan_prompt.md',
        requiredSubstrings: [
          '<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->',
          'prompts/master_system_prompt.md',
          'handoff-*.yaml',
          'checkpoint, not a turn boundary',
        ],
        rationale:
          'Resume prompt must stay protected, load `prompts/master_system_prompt.md` first, treat an open handoff as work to continue rather than work to replace, and keep the continuity rule that stops a green checkpoint from ending the run.',
      },
    ],
    restorePlaybook: [
      'Restore `prompts/resume_backlog_plan_prompt.md` with phase-by-phase plan continuation, open-handoff continuation and delete-on-wrapup cleanup.',
    ],
  },
  {
    id: 'PRM-005',
    promptFile: 'prompts/fix_error_log_prompt.md',
    title: 'Automated Crash Diagnostic & Code Remediation Prompt',
    category: 'diagnostics-debug',
    lifecycle: 'active',
    lastEdited: '2026-11-24',
    intent:
      'Diagnose and fix application crashes or error logs using root-cause patches and regression tests.',
    changeSummary:
      'Updated architectural constraints to reference `src/engine/`, `src/domain/`, `src/app/`, `src/storage/`, and `prompts/master_system_prompt.md` offline/memory invariants.',
    trackedFiles: ['prompts/fix_error_log_prompt.md'],
    invariants: [
      {
        filePath: 'prompts/fix_error_log_prompt.md',
        requiredSubstrings: [
          '<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->',
          'prompts/master_system_prompt.md',
          'src/engine/',
        ],
        forbiddenSubstrings: ['src/core/'],
        rationale:
          'Crash diagnostic prompt must stay protected and reference `src/engine/` & `src/domain/` rather than retired `src/core/`.',
      },
    ],
    restorePlaybook: [
      'Restore `prompts/fix_error_log_prompt.md` referencing `src/engine/` and `src/domain/` invariants.',
    ],
  },
  {
    id: 'PRM-006',
    promptFile: 'prompts/preflight/run-uni/modularity-check.md',
    title: 'Reusable 4-Phase Modularity Check Prompt',
    category: 'architecture-audit',
    lifecycle: 'active',
    lastEdited: '2026-11-28',
    intent:
      'Provide a concise, project-agnostic modularity evaluation and remediation prompt covering layer direction, shared types, sibling isolation, cycles, and inventory sync.',
    changeSummary:
      'Added protected reusable `modularity-check.md` and refined Phase 2–4 to enforce comment/string-safe scanning, `hooks/` & `components/` coverage, shared type placement out of UI components, all-layer cycle detection, gate-honesty reporting (no silent skips), and final `Estimated Modularity` percentage reporting; relocated from `/prompts/` into `prompts/preflight/run-uni/` and wired as a `[REUSABLE]` Phase B preflight step.',
    trackedFiles: [
      'prompts/preflight/run-uni/modularity-check.md',
      'prompts/preflight/manifest/preflight.manifest.json',
      'prompts/preflight/pf-launcher-uni.md',
    ],
    invariants: [
      {
        filePath: 'prompts/preflight/run-uni/modularity-check.md',
        requiredSubstrings: [
          '<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->',
          '# Modularity Check',
          'Prompt Reusability:',
          'Sibling Isolation:',
          'Estimated Modularity:',
        ],
        rationale:
          'Modularity prompt must stay protected, project-agnostic, include all-layer cycle/sibling isolation checks, and report Estimated Modularity percentage.',
      },
    ],
    restorePlaybook: [
      'Restore `prompts/preflight/run-uni/modularity-check.md` (protected `DO_NOT_REMOVE_WITHOUT_CONFIRMATION` line 1, `Prompt Reusability:`, `Sibling Isolation:`, `Estimated Modularity:`) and keep it wired as the `modularity-check` `[REUSABLE]` step in `prompts/preflight/manifest/preflight.manifest.json` and `prompts/preflight/pf-launcher-uni.md`.',
    ],
  },
  {
    id: 'PRM-007',
    promptFile: 'prompts/preflight/run-uni/reusability-check.md',
    title: 'Reusable 4-Phase Reusability Check Prompt',
    category: 'architecture-audit',
    lifecycle: 'active',
    lastEdited: '2026-11-28',
    intent:
      'Provide a concise, project-agnostic reusability evaluation and refactoring prompt covering domain leakage, duplicated micro-utilities, rigid signatures, singleton teardown, and lifecycle hygiene.',
    changeSummary:
      'Added protected reusable `reusability-check.md` and hardened Phase 2–4 to require micro-utility consolidation onto an existing canonical owner without transitive heavy dependency leaks, singleton `reset*` hooks, non-default test fixtures proving reusability, measurable duplication counts, and final `Estimated Reusability` percentage reporting; relocated from `/prompts/` into `prompts/preflight/run-uni/` and wired as a `[REUSABLE]` Phase B preflight step.',
    trackedFiles: [
      'prompts/preflight/run-uni/reusability-check.md',
      'prompts/preflight/manifest/preflight.manifest.json',
      'prompts/preflight/pf-launcher-uni.md',
    ],
    invariants: [
      {
        filePath: 'prompts/preflight/run-uni/reusability-check.md',
        requiredSubstrings: [
          '<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->',
          '# Reusability Check',
          'Prompt Reusability:',
          'Domain & Brand Leakage in Shared Code:',
          'Estimated Reusability:',
        ],
        rationale:
          'Reusability prompt must stay protected, project-agnostic, guard against bundle bloat/singleton lock-in, and report Estimated Reusability percentage.',
      },
    ],
    restorePlaybook: [
      'Restore `prompts/preflight/run-uni/reusability-check.md` (protected `DO_NOT_REMOVE_WITHOUT_CONFIRMATION` line 1, `Prompt Reusability:`, `Domain & Brand Leakage in Shared Code:`, `Estimated Reusability:`) and keep it wired as the `reusability-check` `[REUSABLE]` step in `prompts/preflight/manifest/preflight.manifest.json` and `prompts/preflight/pf-launcher-uni.md`.',
    ],
  },
  {
    id: 'PRM-008',
    promptFile: 'prompts/core_hygiene.md',
    title: 'Core Hygiene & PII Check Prompt (Core Content-Free Naming + Human/Contact PII Scrub)',
    category: 'hygiene-privacy',
    lifecycle: 'active',
    lastEdited: '2026-11-27',
    intent:
      'Audit and fix content-specific filenames and symbols strictly in core/feature/utility layers (exempting content-specific domain modules) and scan/scrub human names, emails, physical addresses, phone numbers, and other PII.',
    changeSummary:
      'Created short-named, reusable `prompts/core_hygiene.md` with context-aware identifier tokenization, explicit domain-module exemption checks, single-pass linkage updates, and extended RFC-2606-safe PII/contact scanning and redaction rules; registered in `src/domain/promptsCatalog.ts`.',
    trackedFiles: ['prompts/core_hygiene.md', 'src/domain/promptsCatalog.ts'],
    invariants: [
      {
        filePath: 'prompts/core_hygiene.md',
        requiredSubstrings: [
          '<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->',
          '# Core Hygiene & PII Check',
          'Track A: Content-Specific Names & Symbols in Core/Reusable Modules',
          'Track B: Personal Identifiable Information (PII) & Human Contact Scan',
          'Prompt Reusability:',
        ],
        rationale:
          'Core hygiene prompt must remain protected and cover both core naming purity (with domain exemptions) and PII scrubbing.',
      },
    ],
    restorePlaybook: [
      'Restore `prompts/core_hygiene.md` and keep it registered in `CURATED_PROMPT_DESCRIPTIONS` in `src/domain/promptsCatalog.ts`.',
    ],
  },
  {
    id: 'PRM-009',
    promptFile: 'prompts/start_new_backlog_prompt.md',
    title: 'Start New Backlog Prompt — Open-Handoff Precheck Revision',
    category: 'backlog-workflow',
    lifecycle: 'active',
    lastEdited: '2026-11-28',
    intent:
      'A new backlog item could start while an unfinished handoff was still open, so the workflow picked fresh work over work already in flight.',
    changeSummary:
      'The precheck now covers open handoffs as well as active plans: an unfinished `handoff-*.yaml` is continued before any new backlog item is started, and only when neither exists does the workflow pick an entry.',
    trackedFiles: ['prompts/start_new_backlog_prompt.md'],
    invariants: [
      {
        filePath: 'prompts/start_new_backlog_prompt.md',
        requiredSubstrings: [
          '<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->',
          'suggestions-backlog.md',
          'resume_backlog_plan_prompt.md',
          'handoff-*.yaml',
        ],
        rationale:
          'Backlog starter prompt must stay protected and check for both active plans and open handoffs before starting a new item.',
      },
    ],
    restorePlaybook: [
      'Restore `prompts/start_new_backlog_prompt.md` with the open-handoff precheck and the redirect to `prompts/resume_backlog_plan_prompt.md`.',
    ],
    decidedOn: '2026-11-28',
    version: '2026-11-28',
    commitShaOrTag: '7a57c35',
    status: 'active',
  },
  {
    id: 'PRM-010',
    promptFile: 'prompts/resume_backlog_plan_prompt.md',
    title: 'Resume Backlog Plan Prompt — All-Handoff Scan Revision',
    category: 'backlog-workflow',
    lifecycle: 'active',
    lastEdited: '2026-11-28',
    intent:
      'A run ended with `NO PENDING WORK` after closing one handoff, while `docs/plans/handoff-modularity-reusability.yaml` still had seven open steps: the run-end rule only looked at the handoff it was reading.',
    changeSummary:
      'The run now ends only when **every** open handoff and plan in `docs/plans/` is empty. Closing a `handoff-*.yaml` is explicitly not completion: the step-2 check lists every open `handoff-*.yaml` before picking one, names the single-file read as the failure mode, and re-scans the directory after each closure to continue the next open handoff.',
    trackedFiles: ['prompts/resume_backlog_plan_prompt.md'],
    invariants: [
      {
        filePath: 'prompts/resume_backlog_plan_prompt.md',
        requiredSubstrings: [
          '<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->',
          'prompts/master_system_prompt.md',
          'handoff-*.yaml',
          'checkpoint, not a turn boundary',
          're-scan `docs/plans/handoff-*.yaml` after every closure',
          'List **every** open `handoff-*.yaml`',
        ],
        rationale:
          'The resume path decides when a run is finished, so both the all-files scan and the post-closure re-scan have to live there and cannot be edited away silently.',
      },
    ],
    restorePlaybook: [
      'Restore the all-handoff run-end rule and the per-closure re-scan sentence; a single-file check is the regression this entry prevents.',
      'Keep the redirect to `prompts/start_new_backlog_prompt.md` for the case where no handoff and no plan is open.',
    ],
    decidedOn: '2026-11-28',
    version: '2026-11-28',
    commitShaOrTag: '170a49d',
    status: 'active',
  },
  {
    id: 'PRM-011',
    promptFile: 'prompts/start_new_backlog_prompt.md',
    title: 'Start New Backlog Prompt — Every-Handoff Precheck Revision',
    category: 'backlog-workflow',
    lifecycle: 'active',
    lastEdited: '2026-11-28',
    intent:
      'The precheck stopped at the first handoff it found, so a second open handoff could sit untouched while the workflow moved on to a new backlog entry.',
    changeSummary:
      'The precheck now says to scan every `handoff-*.yaml`, not just the first, continues the first open handoff and then re-scans for the next, states plainly that a finished file is not a finished directory, and allows a new backlog entry only when no active plan and no open step in any handoff exists.',
    trackedFiles: ['prompts/start_new_backlog_prompt.md'],
    invariants: [
      {
        filePath: 'prompts/start_new_backlog_prompt.md',
        requiredSubstrings: [
          '<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->',
          'suggestions-backlog.md',
          'resume_backlog_plan_prompt.md',
          'handoff-*.yaml',
          'scan every `handoff-*.yaml`, not just the first',
          'a finished file is not a finished directory',
        ],
        rationale:
          'The backlog gate is the other place that can start unrelated work while a handoff is still open; the all-files scan and its reason must both survive.',
      },
    ],
    restorePlaybook: [
      'Restore the all-handoff precheck and the "finished file is not a finished directory" rule, then keep the redirect to the resume prompt for active plans.',
    ],
    decidedOn: '2026-11-28',
    version: '2026-11-28',
    commitShaOrTag: '170a49d',
    status: 'active',
  },
  {
    id: 'PRM-012',
    promptFile: 'prompts/preflight/pf-launcher-uni.md',
    title: 'Preflight Launcher — Single Manifest, Generated Step Lists, Two Step Types',
    category: 'architecture-audit',
    lifecycle: 'active',
    lastEdited: '2026-11-28',
    intent:
      'The preflight launcher had grown four hand-maintained copies of one step list (its own lines, a byte-identical second manifest, the wiring table and a module roster) plus a third step type that nothing enforced, so the copies disagreed and had to be re-synced by hand.',
    changeSummary:
      '`prompts/preflight/manifest/preflight.manifest.json` is now the only place a step is declared. `scripts/gen-preflight.mjs` renders the launcher step blocks (preserving retired `AGENT_SKIP_LINE` lines by `step_id`), the module summary, `pf-launcher-uni-wiring.md` and the pristine template, and `--check` plus `preflight-lint.mjs` fail on drift. Steps are sorted by the minimum environment they need: Phase A (10 steps) is file read/edit only, Phase B (8 steps) needs git, a shell, a build, CI or the device, and each step carries an ordered runner bracket such as `[ai-studio | freebuff]` or `[antigravity | freebuff]` where first listed is preferred. `modularity-check`, `reusability-check`, `ci-setup` and `attribution-audit` moved to Phase A with their gate tails deferred to `ci-guide`; `ai-baseline` and `crawl-guide` moved to Phase B because they run `npm` and the subpath build. The duplicate root manifest, the two Google Drive export scripts and the third step type are gone, `freebuff` is now a legal ledger platform, and `preflight-state.mjs` takes the resume phase from the manifest instead of a second hardcoded list.',
    trackedFiles: [
      'prompts/preflight/pf-launcher-uni.md',
      'prompts/preflight/manifest/preflight.manifest.json',
      'prompts/preflight/manifest/manifest.schema.json',
      'prompts/preflight/scripts/gen-preflight.mjs',
      'prompts/preflight/scripts/preflight-lint.mjs',
    ],
    invariants: [
      {
        filePath: 'prompts/preflight/pf-launcher-uni.md',
        requiredSubstrings: [
          'AGENT_SKIP_LINE',
          '=== CONSTRAINTS ===',
          '<!-- PHASE_A_STEPS_START -->',
          '<!-- PHASE_B_STEPS_START -->',
          'prompts/preflight/manifest/preflight.manifest.json',
        ],
        rationale:
          'The launcher is generated around its two step blocks, so those markers and the pointer to the single manifest have to survive every regeneration; losing them would quietly stop the retirement machinery and let the launcher and manifest disagree again.',
      },
    ],
    restorePlaybook: [
      'Restore the launcher from the pristine template (`node prompts/preflight/scripts/preflight-reset.mjs --full`), then re-render it with `npm run preflight:gen -- --write`.',
      'Restore `prompts/preflight/manifest/preflight.manifest.json` as the only step list; never reintroduce a second manifest copy or a third step type.',
    ],
    decidedOn: '2026-11-28',
    version: '2026-11-28',
    commitShaOrTag: 'cd72d34',
    status: 'active',
  },
  {
    id: 'PRM-013',
    promptFile: 'prompts/preflight/pf-release-uni.md',
    title: 'Preflight Release Runner — Release Tail Split From The Sweep',
    category: 'architecture-audit',
    lifecycle: 'active',
    lastEdited: '2026-11-28',
    intent:
      'The sweep is run for any piece of work, but it ended in a version bump, an AGPL audit, the release checklist and a sign-off only a person can give, so every ordinary run stopped at work that did not apply to it - and one of those steps was once filed complete without its human-assisted smoke test ever running.',
    changeSummary:
      'Steps now carry a `track`: `preflight` (13 steps, 7 Phase A and 6 Phase B) renders into `pf-launcher-uni.md` and always reaches the end, while `release` (5 steps: `release-check-p1`, `attribution-audit`, `ver-update`, `release-check-p2`, `release-plan`) renders into the new `pf-release-uni.md` from the same manifest. The generator rejects `human_signoff` on a preflight step, and `preflight-log.mjs` records `awaiting_human` instead of `completed` for a gated step unless `--human-signoff "<who/how>"` is passed. A release step is additionally refused outright (`RELEASE_BLOCKED`) unless every sweep step has a `completed` entry for the same branch and version, so a release can never be filed on top of an unfinished or failed sweep. That rule lives once in `sweep-status.mjs`, shared by the guard and by the `preflight-state.mjs --require-sweep` self-check the runner tells a person to run (exit 1 with `sweep_incomplete` and the missing ids), and both paths are covered by `npm test`.',
    trackedFiles: [
      'prompts/preflight/pf-release-uni.md',
      'prompts/preflight/pf-launcher-uni.md',
      'prompts/preflight/manifest/preflight.manifest.json',
      'prompts/preflight/scripts/gen-preflight.mjs',
      'prompts/preflight/scripts/preflight-log.mjs',
      'prompts/preflight/scripts/preflight-state.mjs',
      'prompts/preflight/scripts/sweep-status.mjs',
      'prompts/preflight/handoff-state.schema.json',
      'src/domain/__tests__/preflightReleaseGuard.test.ts',
    ],
    invariants: [
      {
        filePath: 'prompts/preflight/pf-release-uni.md',
        requiredSubstrings: [
          '# PreFlight Release Runner',
          '## Precondition: A Finished Sweep',
          'RELEASE_BLOCKED',
          'HUMAN GATE',
          '--human-signoff',
        ],
        rationale:
          'The release runner is generated, so the precondition and the human-gate contract live on its face; losing either would let a release run without a finished sweep or let a gate be closed by the runner that did the machine work.',
      },
    ],
    restorePlaybook: [
      'Re-render both runners with `npm run preflight:gen -- --write`; never hand-edit `pf-launcher-uni.md` or `pf-release-uni.md`.',
      'Keep `human_signoff` legal only on `release` steps and keep the `RELEASE_BLOCKED` precondition in `preflight-log.mjs`; both are what stop a false completion.',
      'Keep `sweep-status.mjs` as the only definition of a finished sweep, shared by the writer and the `--require-sweep` self-check, and keep `preflightReleaseGuard.test.ts` passing: a manual probe does not survive a refactor.',
    ],
    decidedOn: '2026-11-28',
    version: '2026-11-28',
    commitShaOrTag: '64db14b',
    status: 'active',
  },
];

/**
 * Evaluates all `PROMPT_CHANGES_REGISTRY` invariants against an in-memory map of file contents.
 */
export function evaluatePromptInvariants(
  filesByPath: Record<string, string | undefined>,
  entries: readonly PromptChangeEntry[] = PROMPT_CHANGES_REGISTRY
): PromptDriftReport {
  const normalizedMap = new Map<string, string>();
  for (const [k, v] of Object.entries(filesByPath)) {
    if (typeof v === 'string') {
      normalizedMap.set(k.replace(/^\/+/, ''), v);
    }
  }

  const violations: PromptDriftViolation[] = [];
  const checkedFiles = new Set<string>();
  let passedCount = 0;

  for (const entry of entries) {
    let entryPassed = true;

    for (const inv of entry.invariants) {
      const cleanPath = inv.filePath.replace(/^\/+/, '');
      checkedFiles.add(cleanPath);
      const content = normalizedMap.get(cleanPath);

      if (content === undefined) {
        entryPassed = false;
        violations.push({
          entryId: entry.id,
          title: entry.title,
          filePath: cleanPath,
          issue: `Missing prompt file "${cleanPath}" (${inv.rationale})`,
          restorePlaybook: entry.restorePlaybook,
        });
        continue;
      }

      for (const req of inv.requiredSubstrings) {
        if (!content.includes(req)) {
          entryPassed = false;
          violations.push({
            entryId: entry.id,
            title: entry.title,
            filePath: cleanPath,
            issue: `Missing expected directive "${req}" in ${cleanPath} — ${inv.rationale}`,
            restorePlaybook: entry.restorePlaybook,
          });
        }
      }

      for (const forbidden of inv.forbiddenSubstrings ?? []) {
        if (content.includes(forbidden)) {
          entryPassed = false;
          violations.push({
            entryId: entry.id,
            title: entry.title,
            filePath: cleanPath,
            issue: `Detected regression "${forbidden}" in ${cleanPath} — ${inv.rationale}`,
            restorePlaybook: entry.restorePlaybook,
          });
        }
      }
    }

    if (entryPassed) {
      passedCount += 1;
    }
  }

  return {
    checkedAtIso: nowIsoUtc(),
    totalEntries: entries.length,
    totalFilesChecked: checkedFiles.size,
    passedCount,
    violations,
    ok: violations.length === 0,
  };
}

/**
 * Generates the Markdown prompt changelog & recovery manual (`PROMPT_CHANGES.md`).
 *
 * Starts with the append-only ledger contract (`formatLedgerHeader`) so regenerating the manual
 * cannot drop it, and renders entries that opt into the ledger fields in the documented
 * Prompt/Why/Changed/Rejected/Supersedes/Status shape. Legacy entries keep their block untouched.
 */
export function formatPromptChangelogMarkdown(
  entries: readonly PromptChangeEntry[] = PROMPT_CHANGES_REGISTRY
): string {
  const activeCount = entries.filter((e) => e.lifecycle === 'active').length;
  const archivedCount = entries.filter((e) => e.lifecycle === 'archived').length;

  const lines: string[] = [
    ...formatLedgerHeader('prompt-changes'),
    '',
    '# Prompt Changes & Recovery Log',
    '',
    'This document is synchronized with `src/domain/promptRegistry.ts` and verified automatically',
    'by `npm run verify:prompts`. Whenever a prompt in `/prompts/` is added, refined, archived, or',
    'accidentally overwritten, run the verifier to pinpoint any lost directives or protection flags',
    'and follow the restoration playbook below.',
    '',
    `- **Active Prompt Trackers:** ${activeCount}`,
    `- **Archived Snapshot Trackers:** ${archivedCount}`,
    '',
    '## Quick Verification Commands',
    '',
    '```bash',
    '# Check all /prompts/* invariants and protection flags on disk',
    'npm run verify:prompts',
    '',
    '# Run full project verification suite (includes prompt registry tests)',
    'npm run verify',
    '```',
    '',
    '---',
    '',
    `## Logged Prompt Revisions (${entries.length})`,
    '',
  ];

  for (const entry of entries) {
    if (entry.decidedOn && entry.version && entry.commitShaOrTag) {
      const promptName = entry.promptFile.replace(/^.*\//, '').replace(/\.md$/, '');
      const status = entry.status ?? 'active';
      lines.push(`## ${promptName} ${entry.version} — ${entry.title}`);
      lines.push(`Prompt:     ${entry.promptFile} @ ${entry.commitShaOrTag}`);
      lines.push(`Why:        ${entry.intent}`);
      lines.push(`Changed:    ${entry.changeSummary}`);
      if (entry.rejected) {
        lines.push(`Rejected:   ${entry.rejected}`);
      }
      if (entry.supersedes) {
        lines.push(`Supersedes: ${entry.supersedes}`);
      }
      lines.push(
        `Status:     ${
          status === 'superseded' && entry.supersededBy
            ? `superseded by ${entry.supersededBy}`
            : status
        }`
      );
      lines.push('');
      lines.push('**Protected Invariants:**');
      for (const inv of entry.invariants) {
        const reqList = inv.requiredSubstrings.map((s) => `\`${s}\``).join(', ');
        lines.push(`- \`${inv.filePath}\` must contain ${reqList} — *${inv.rationale}*`);
        if (inv.forbiddenSubstrings && inv.forbiddenSubstrings.length > 0) {
          const forbList = inv.forbiddenSubstrings.map((s) => `\`${s}\``).join(', ');
          lines.push(`  - Forbidden regression: ${forbList}`);
        }
      }
      lines.push('');
      lines.push('**Recovery Playbook if Broken or Overwritten:**');
      entry.restorePlaybook.forEach((step, idx) => {
        lines.push(`${idx + 1}. ${step}`);
      });
      lines.push('');
      continue;
    }

    const catLabel = PROMPT_CATEGORY_LABELS[entry.category] ?? entry.category;
    lines.push(`### ${entry.id}: ${entry.title}`);
    lines.push('');
    lines.push(`- **Prompt File:** \`${entry.promptFile}\``);
    lines.push(`- **Lifecycle:** \`${entry.lifecycle}\``);
    lines.push(`- **Category:** ${catLabel} (\`${entry.category}\`)`);
    lines.push(`- **Last Edited:** ${entry.lastEdited}`);
    lines.push(`- **Intent:** ${entry.intent}`);
    lines.push(`- **Change Summary:** ${entry.changeSummary}`);
    lines.push(`- **Tracked Files:** ${entry.trackedFiles.map((f) => `\`${f}\``).join(', ')}`);
    lines.push('');
    lines.push('**Protected Invariants:**');
    for (const inv of entry.invariants) {
      const reqList = inv.requiredSubstrings.map((s) => `\`${s}\``).join(', ');
      lines.push(`- \`${inv.filePath}\` must contain ${reqList} — *${inv.rationale}*`);
      if (inv.forbiddenSubstrings && inv.forbiddenSubstrings.length > 0) {
        const forbList = inv.forbiddenSubstrings.map((s) => `\`${s}\``).join(', ');
        lines.push(`  - Forbidden regression: ${forbList}`);
      }
    }
    lines.push('');
    lines.push('**Recovery Playbook if Broken or Overwritten:**');
    entry.restorePlaybook.forEach((step, idx) => {
      lines.push(`${idx + 1}. ${step}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Serializes the prompt change registry into a structured JSON recovery bundle.
 */
export function buildPromptRecoveryJson(
  entries: readonly PromptChangeEntry[] = PROMPT_CHANGES_REGISTRY
): string {
  return JSON.stringify(
    {
      format: 'community-pedigree-prompt-changelog',
      version: 1,
      exportedAtIsoUtc: nowIsoUtc(),
      verifyCommand: 'npm run verify:prompts',
      totalEntries: entries.length,
      entries,
    },
    null,
    2
  );
}
