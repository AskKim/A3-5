/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
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
import { formatLedgerHeader, type LedgerEntryStatus } from './ledgerContract';

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
   * Append-only ledger contract (`src/domain/ledgerContract.ts`). When `decidedOn`, `version`,
   * `commitShaOrTag`, and `supersedes` are all set, the formatter emits the documented
   * `## <prompt-name> <version> — summary` block instead of the legacy `### PRM-0NN:` block.
   * Entries missing them stay legacy and are never rewritten.
   */
  decidedOn?: string;
  version?: string;
  commitShaOrTag?: string;
  supersedes?: string;
  status?: LedgerEntryStatus;
  /** The alternative tried and why it lost; omit when there was none. */
  rejected?: string;
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
    lastEdited: '2026-11-27',
    intent:
      'Maintain one canonical, compact rulebook governing alignment checks, React PWA lock, three-layer boundaries, strict TypeScript, and mandatory improvement logging.',
    changeSummary:
      'Evolved from v1/v2/v4 into the unified `prompts/master_system_prompt.md` aligned with `GEMINI.md` and `AGENTS.md`: adds `DO_NOT_REMOVE_WITHOUT_CONFIRMATION`, `ALIGNED` + single-line pending status output rules, three-layer isolation (`@engine/*`, `@features/*`, `@domain/*`, `@app/*`), plan cleanup, and mandatory `improvementRegistry.ts` logging.',
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
    promptFile: 'prompts/modularity_check_prompt.md',
    title: 'Reusable 4-Phase Modularity Check Prompt',
    category: 'architecture-audit',
    lifecycle: 'active',
    lastEdited: '2026-11-27',
    intent:
      'Provide a concise, project-agnostic modularity evaluation and remediation prompt covering layer direction, shared types, sibling isolation, cycles, and inventory sync.',
    changeSummary:
      'Added protected reusable `modularity_check_prompt.md` and refined Phase 2–4 to enforce comment/string-safe scanning, `hooks/` & `components/` coverage, shared type placement out of UI components, all-layer cycle detection, and final `Estimated Modularity` percentage reporting.',
    trackedFiles: ['prompts/modularity_check_prompt.md', 'src/domain/promptsCatalog.ts'],
    invariants: [
      {
        filePath: 'prompts/modularity_check_prompt.md',
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
      'Restore `prompts/modularity_check_prompt.md` and verify its entry in `src/domain/promptsCatalog.ts`.',
    ],
  },
  {
    id: 'PRM-007',
    promptFile: 'prompts/reusability_check_prompt.md',
    title: 'Reusable 4-Phase Reusability Check Prompt',
    category: 'architecture-audit',
    lifecycle: 'active',
    lastEdited: '2026-11-27',
    intent:
      'Provide a concise, project-agnostic reusability evaluation and refactoring prompt covering domain leakage, duplicated micro-utilities, rigid signatures, singleton teardown, and lifecycle hygiene.',
    changeSummary:
      'Added protected reusable `reusability_check_prompt.md` and hardened Phase 2–4 to require micro-utility consolidation without transitive heavy dependency leaks, singleton `reset*` hooks, non-default test fixtures proving reusability, and final `Estimated Reusability` percentage reporting.',
    trackedFiles: ['prompts/reusability_check_prompt.md', 'src/domain/promptsCatalog.ts'],
    invariants: [
      {
        filePath: 'prompts/reusability_check_prompt.md',
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
      'Restore `prompts/reusability_check_prompt.md` and verify its entry in `src/domain/promptsCatalog.ts`.',
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
    if (entry.decidedOn && entry.version && entry.commitShaOrTag && entry.supersedes) {
      const promptName = entry.promptFile.replace(/^.*\//, '').replace(/\.md$/, '');
      lines.push(`## ${promptName} ${entry.version} — ${entry.title}`);
      lines.push(`Prompt:     ${entry.promptFile} @ ${entry.commitShaOrTag}`);
      lines.push(`Why:        ${entry.intent}`);
      lines.push(`Changed:    ${entry.changeSummary}`);
      if (entry.rejected) {
        lines.push(`Rejected:   ${entry.rejected}`);
      }
      lines.push(`Supersedes: ${entry.supersedes}`);
      lines.push(`Status:     ${entry.status ?? 'active'}`);
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
