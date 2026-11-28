/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Pure TypeScript Improvement Registry & GitHub-Overwrite Drift Verifier (`src/domain/improvementRegistry.ts`).
 *
 * Purpose:
 *   Tracks every intentional behavioral, safety, UX, and stability improvement in Community Pedigree
 *   alongside concrete code invariants and step-by-step restoration playbooks. If an external sync
 *   or merge accidentally overwrites modified files, running `npm run verify:improvements` (or CI)
 *   pinpoints exactly what regressed and how to put it back.
 *
 * CROSS-PLATFORM MIGRATION GUARDRAIL:
 *   100% pure TypeScript with zero browser DOM (`window`, `document`) or Node (`fs`, `path`) imports.
 *   Node file loading lives in `scripts/verify-improvements.ts`.
 */

import { nowIsoUtc } from './models';
import { formatLedgerHeader } from './ledgerContract';
import { REGISTRY_PART_01 } from './improvements/registry-part-01';
import { REGISTRY_PART_02 } from './improvements/registry-part-02';
import { REGISTRY_PART_03 } from './improvements/registry-part-03';
import { REGISTRY_PART_04 } from './improvements/registry-part-04';
import { REGISTRY_PART_05 } from './improvements/registry-part-05';

import type {
  ImprovementCategory,
  ImprovementEntry,
  ImprovementInvariant,
  ImprovementRationaleMap,
  ImprovementRelease,
} from './improvements/types';

export type {
  ImprovementCategory,
  ImprovementEntry,
  ImprovementInvariant,
  ImprovementRelease,
} from './improvements/types';

export const ALPHA_2_FINAL_IMP_ID = 'IMP-064';
export const ALPHA_2_RELEASE: ImprovementRelease = 'alpha-2';
export const ALPHA_3_RELEASE: ImprovementRelease = 'alpha-3';

export const IMPROVEMENT_RELEASE_LABELS: Record<string, string> = {
  'alpha-2': 'Alpha 2',
  'alpha-3': 'Alpha 3',
};

export interface ImprovementDriftViolation {
  entryId: string;
  title: string;
  filePath: string;
  issue: string;
  restorePlaybook: string[];
}

export interface ImprovementDriftReport {
  checkedAtIso: string;
  totalEntries: number;
  totalFilesChecked: number;
  passedCount: number;
  violations: ImprovementDriftViolation[];
  ok: boolean;
}

export const IMPROVEMENT_CATEGORY_LABELS: Record<ImprovementCategory, string> = {
  'backup-safety': 'Backups & Safety',
  'alerts-home': 'Home & Alerts',
  'species-ux': 'Species & Herd UX',
  'stability-pwa': 'Stability & Mobile PWA',
  'ci-tooling': 'CI & Tooling',
  'diagnostics-sync': 'Diagnostics & Sync',
  'workflow-polish': 'Workflow & UI Polish',
};

export const IMPROVEMENTS_REGISTRY: ImprovementEntry[] = [
  ...REGISTRY_PART_01,
  ...REGISTRY_PART_02,
  ...REGISTRY_PART_03,
  ...REGISTRY_PART_04,
  ...REGISTRY_PART_05,
];

/**
 * Immutable SHA-256 baseline checksums for boot/entry files locked during NEON Phases 1–2
 * to prevent accidental boot/initialization regressions during modular extraction.
 */
export const BOOT_ENTRY_LOCK_CHECKSUMS: Readonly<Record<string, string>> = {
  'src/main.tsx': 'b77239b90e2ab0ca96469ccd8692531d17fddc73267cc9aab3a3638a49a663dc',
  'src/App.tsx': '90bd02a04c2a401642c0fd41dd3b33e3527e5d8d3fcab6f8abad9cd2ce70ee32',
  'index.html': 'eb33934974173a0d046a33d41f4584420d9d2886e9bbac5707b80611dc12066d',
};

/**
 * Evaluates all `IMPROVEMENTS_REGISTRY` code invariants against an in-memory map of file contents.
 * Keys may be POSIX relative paths (`src/domain/models.ts`) with or without a leading `/`.
 */
/**
 * Resolves the explanatory prose for every invariant of an entry, in declaration order.
 * Entries may still carry an inline `rationale`; otherwise it is read from the supplied map
 * (see `improvements/rationales.ts`) and an empty string is returned when neither has it.
 */
export function resolveEntryRationales(
  entry: ImprovementEntry,
  rationales?: ImprovementRationaleMap
): string[] {
  const seenPerFile = new Map<string, number>();
  return entry.invariants.map((inv) => {
    const ordinal = (seenPerFile.get(inv.filePath) ?? 0) + 1;
    seenPerFile.set(inv.filePath, ordinal);
    return inv.rationale ?? rationales?.[`${entry.id}#${inv.filePath}#${ordinal}`] ?? '';
  });
}

export function evaluateImprovementInvariants(
  filesByPath: Record<string, string | undefined>,
  entries: ImprovementEntry[] = IMPROVEMENTS_REGISTRY,
  rationales?: ImprovementRationaleMap
): ImprovementDriftReport {
  const normalizedMap = new Map<string, string>();
  for (const [k, v] of Object.entries(filesByPath)) {
    if (typeof v === 'string') {
      normalizedMap.set(k.replace(/^\/+/, ''), v);
    }
  }

  const violations: ImprovementDriftViolation[] = [];
  const checkedFiles = new Set<string>();
  let passedCount = 0;

  for (const entry of entries) {
    let entryPassed = true;
    const why = resolveEntryRationales(entry, rationales);

    for (const [invIdx, inv] of entry.invariants.entries()) {
      const cleanPath = inv.filePath.replace(/^\/+/, '');
      checkedFiles.add(cleanPath);
      const content = normalizedMap.get(cleanPath);

      if (content === undefined) {
        entryPassed = false;
        violations.push({
          entryId: entry.id,
          title: entry.title,
          filePath: cleanPath,
          issue: `Missing tracked file "${cleanPath}" (${why[invIdx]})`,
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
            issue: `Missing expected token "${req}" in ${cleanPath} — ${why[invIdx]}`,
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
            issue: `Detected regression pattern "${forbidden}" in ${cleanPath} — ${why[invIdx]}`,
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
 * Determines the release milestone for an improvement entry.
 * If explicitly specified on the entry (`entry.release`), uses that value.
 * Otherwise, entries up to and including IMP-064 default to 'alpha-2',
 * and entries from IMP-065 onwards default to 'alpha-3'.
 */
export function getImprovementRelease(entry: {
  id: string;
  release?: ImprovementRelease;
}): ImprovementRelease {
  if (entry.release) {
    return entry.release;
  }
  const match = entry.id.match(/^IMP-(\d+)$/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num <= 64) {
      return ALPHA_2_RELEASE;
    }
  }
  return ALPHA_3_RELEASE;
}

/**
 * Checks if an improvement was implemented during the Alpha 2 release cycle.
 */
export function isAlpha2Improvement(entry: { id: string; release?: ImprovementRelease }): boolean {
  return getImprovementRelease(entry) === ALPHA_2_RELEASE;
}

/**
 * Checks if an improvement belongs to the Alpha 3 release cycle.
 */
export function isAlpha3Improvement(entry: { id: string; release?: ImprovementRelease }): boolean {
  return getImprovementRelease(entry) === ALPHA_3_RELEASE;
}

/**
 * Filters improvement entries by release milestone ('alpha-2' or 'alpha-3').
 */
export function getImprovementsByRelease(
  release: ImprovementRelease,
  entries: ImprovementEntry[] = IMPROVEMENTS_REGISTRY
): ImprovementEntry[] {
  return entries.filter((e) => getImprovementRelease(e) === release);
}

/**
 * Renders one entry's automated invariants (shared by the legacy and contract-shaped blocks).
 */
function pushInvariantLines(
  lines: string[],
  entry: ImprovementEntry,
  why: readonly string[]
): void {
  lines.push('**Automated Invariants Checked:**');
  for (const [invIdx, inv] of entry.invariants.entries()) {
    const reqList = inv.requiredSubstrings.map((s) => `\`${s}\``).join(', ');
    const suffix = why[invIdx] ? ` — *${why[invIdx]}*` : '';
    lines.push(`- \`${inv.filePath}\` must contain ${reqList}${suffix}`);
    if (inv.forbiddenSubstrings && inv.forbiddenSubstrings.length > 0) {
      const forbList = inv.forbiddenSubstrings.map((s) => `\`${s}\``).join(', ');
      lines.push(`  - Forbidden regression: ${forbList}`);
    }
  }
}

/**
 * `Changed:` value for a contract-shaped entry: paths, each tagged with the commit when known.
 */
function formatChangedPaths(entry: ImprovementEntry): string {
  return entry.files
    .map((file) => (entry.commitSha ? `\`${file}\` @ ${entry.commitSha}` : `\`${file}\``))
    .join(', ');
}

/**
 * Generates a clean, self-contained Markdown improvements & GitHub-overwrite recovery manual.
 *
 * Starts with the append-only ledger contract (`formatLedgerHeader`) so regenerating the manual
 * cannot drop it, and renders entries that opt in via `decidedOn` in the documented
 * Why/Changed/Rejected/Status shape. Legacy entries keep their existing block untouched.
 */
export function formatImprovementsMarkdown(
  entries: ImprovementEntry[] = IMPROVEMENTS_REGISTRY,
  rationales?: ImprovementRationaleMap
): string {
  const alpha2Count = entries.filter(isAlpha2Improvement).length;
  const alpha3Count = entries.filter(isAlpha3Improvement).length;

  const lines: string[] = [
    ...formatLedgerHeader('improvements'),
    '',
    '# Community Pedigree — App Improvements & GitHub-Overwrite Recovery Log',
    '',
    'This document is synchronized with `src/domain/improvementRegistry.ts` and verified automatically',
    'by `npm run verify:improvements` (and GitHub Actions CI). If an upstream GitHub pull or AI Studio',
    'sync overwrites customized files, run the verifier to pinpoint exactly which improvements were wiped',
    'and follow the restoration playbook below.',
    '',
    '## Release Milestone Classification',
    '',
    `- **Alpha 2 (v0.1.0-alpha.2 — Released Baseline):** \`IMP-001\` through \`IMP-064\` (${alpha2Count} improvements).`,
    `- **Alpha 3 (v0.1.0-alpha.3 — Active Deliverables):** \`IMP-065\` onwards (${alpha3Count} improvements).`,
    '',
    '## Quick Verification & Recovery Commands',
    '',
    '```bash',
    '# 1. Check all tracked improvement invariants against files on disk',
    'npm run verify:improvements',
    '',
    '# 2. Run domain unit tests (includes improvementRegistry drift checks)',
    'npm test',
    '',
    '# 3. Typecheck and build',
    'npm run lint && npm run build',
    '```',
    '',
    '---',
    '',
    `## Logged Improvements (${entries.length})`,
    '',
  ];

  for (const entry of entries) {
    if (entry.decidedOn) {
      const status = entry.status ?? 'active';
      lines.push(`## ${entry.decidedOn} — ${entry.title}`);
      lines.push(`Why:        ${entry.userIntent}`);
      lines.push(`Changed:    ${formatChangedPaths(entry)}`);
      if (entry.rejected) {
        lines.push(`Rejected:   ${entry.rejected}`);
      }
      lines.push(
        `Status:     ${
          status === 'superseded' && entry.supersededBy
            ? `superseded by ${entry.supersededBy}`
            : status
        }`
      );
      lines.push('');
      pushInvariantLines(lines, entry, resolveEntryRationales(entry, rationales));
      lines.push('');
      lines.push('**Restoration Playbook if Overwritten:**');
      entry.restorePlaybook.forEach((step, idx) => {
        lines.push(`${idx + 1}. ${step}`);
      });
      lines.push('');
      continue;
    }

    const rel = getImprovementRelease(entry);
    const relLabel = IMPROVEMENT_RELEASE_LABELS[rel] ?? rel;
    const sourceBadge =
      entry.source === 'github-preserved' ? 'Preserved Upstream Feature' : 'Session Improvement';
    lines.push(`### ${entry.id}: ${entry.title}`);
    lines.push('');
    lines.push(`- **Release Milestone:** ${relLabel} (\`${rel}\`)`);
    lines.push(
      `- **Category:** ${IMPROVEMENT_CATEGORY_LABELS[entry.category]} (\`${entry.category}\`)`
    );
    lines.push(`- **Origin:** ${sourceBadge}`);
    lines.push(`- **User Goal:** ${entry.userIntent}`);
    lines.push(`- **Summary:** ${entry.summary}`);
    lines.push(`- **Tracked Files:** ${entry.files.map((f) => `\`${f}\``).join(', ')}`);
    lines.push('');
    pushInvariantLines(lines, entry, resolveEntryRationales(entry, rationales));
    lines.push('');
    lines.push('**Restoration Playbook if Overwritten:**');
    entry.restorePlaybook.forEach((step, idx) => {
      lines.push(`${idx + 1}. ${step}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Serializes the full improvement registry into a structured JSON recovery bundle
 * downloadable directly from Settings -> Diagnostics & Support.
 */
export function buildImprovementsRecoveryJson(
  entries: ImprovementEntry[] = IMPROVEMENTS_REGISTRY,
  rationales?: ImprovementRationaleMap
): string {
  const entriesWithRelease = entries.map((e) => {
    const why = resolveEntryRationales(e, rationales);
    return {
      ...e,
      release: getImprovementRelease(e),
      invariants: e.invariants.map((inv, idx) => ({ ...inv, rationale: why[idx] })),
    };
  });
  return JSON.stringify(
    {
      format: 'community-pedigree-improvements-log',
      package: 'Pedigree',
      version: 1,
      exportedAtIsoUtc: nowIsoUtc(),
      verifyCommand: 'npm run verify:improvements',
      totalEntries: entries.length,
      alpha2Total: entries.filter(isAlpha2Improvement).length,
      alpha3Total: entries.filter(isAlpha3Improvement).length,
      entries: entriesWithRelease,
    },
    null,
    2
  );
}
