/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateLedgerContract,
  evaluateLedgerFreshness,
  formatLedgerHeader,
  LEDGER_FORMAT_UPDATED,
} from '../ledgerContract';
import { formatImprovementsMarkdown } from '../improvementRegistry';
import { INVARIANT_RATIONALES } from '../improvements/rationales';
import { formatPromptChangelogMarkdown } from '../promptRegistry';
import type { ImprovementEntry } from '../improvements/types';
import type { PromptChangeEntry } from '../promptRegistry';

const rootDir = process.cwd();

function readLedger(fileName: string): string {
  return fs.readFileSync(path.resolve(rootDir, fileName), 'utf8');
}

function headerOf(markdown: string, kind: 'improvements' | 'prompt-changes'): string {
  const lines = markdown.split('\n');
  const expected = formatLedgerHeader(kind).length;
  return lines.slice(0, expected).join('\n');
}

const contractImprovement: ImprovementEntry = {
  id: 'IMP-117',
  title: 'Teach the ledgers their own header',
  category: 'ci-tooling',
  source: 'session',
  summary: 'The improvement ledger header survives regeneration and validates new entries.',
  userIntent: 'Regenerating the ledger silently dropped the append-only header.',
  files: ['IMPROVEMENTS.md', 'src/domain/ledgerContract.ts'],
  invariants: [{ filePath: 'IMPROVEMENTS.md', requiredSubstrings: ['append-only'] }],
  restorePlaybook: ['Keep `formatLedgerHeader` in `src/domain/ledgerContract.ts`.'],
  decidedOn: '2026-11-28',
  status: 'active',
  rejected: 'HTML comment header, which no longer greps as the documented `#` contract.',
  commitSha: 'abc1234',
};

const contractPrompt: PromptChangeEntry = {
  id: 'PRM-009',
  promptFile: 'prompts/core_hygiene.md',
  title: 'Kept prompt versions carry the ledger contract',
  category: 'hygiene-privacy',
  lifecycle: 'active',
  lastEdited: '2026-11-28',
  intent: 'The generated changelog dropped its header on every regeneration.',
  changeSummary: 'Formatter now emits the contract header and the Prompt/Why/Status shape.',
  trackedFiles: ['PROMPT_CHANGES.md'],
  invariants: [
    {
      filePath: 'prompts/core_hygiene.md',
      requiredSubstrings: ['# Core Hygiene & PII Check'],
      rationale: 'Placeholder invariant for the formatting test.',
    },
  ],
  restorePlaybook: ['Regenerate from `src/domain/promptRegistry.ts`.'],
  decidedOn: '2026-11-28',
  version: 'v4',
  commitShaOrTag: 'abc1234',
  supersedes: 'v3 — v3 predated the ledger contract',
  status: 'active',
};

function withContractEntry(body: string): string {
  return [
    ...formatLedgerHeader('improvements'),
    '',
    '### IMP-001: Legacy entry',
    '',
    '- **Summary:** grandfathered, never rewritten',
    '',
    body,
    '',
  ].join('\n');
}

describe('ledgerContract — append-only header and entry shape', () => {
  it('accepts both live ledgers as written', () => {
    const improvements = evaluateLedgerContract(readLedger('IMPROVEMENTS.md'), 'improvements');
    expect(improvements.violations).toEqual([]);
    expect(improvements.ok).toBe(true);
    expect(improvements.totalEntries).toBe(117);
    expect(improvements.contractEntries).toBe(1);

    const prompts = evaluateLedgerContract(readLedger('PROMPT_CHANGES.md'), 'prompt-changes');
    expect(prompts.violations).toEqual([]);
    expect(prompts.ok).toBe(true);
    expect(prompts.totalEntries).toBe(8);
  });

  it('keeps the on-disk header byte-identical to what the formatter emits', () => {
    expect(headerOf(readLedger('IMPROVEMENTS.md'), 'improvements')).toBe(
      formatLedgerHeader('improvements').join('\n')
    );
    expect(headerOf(readLedger('PROMPT_CHANGES.md'), 'prompt-changes')).toBe(
      formatLedgerHeader('prompt-changes').join('\n')
    );
  });

  it('prepends the header when either ledger is regenerated from its registry', () => {
    const improvements = formatImprovementsMarkdown();
    expect(headerOf(improvements, 'improvements')).toBe(formatLedgerHeader('improvements').join('\n'));
    expect(improvements).toContain('# Community Pedigree — App Improvements');

    const prompts = formatPromptChangelogMarkdown();
    expect(headerOf(prompts, 'prompt-changes')).toBe(formatLedgerHeader('prompt-changes').join('\n'));
    expect(prompts).toContain('# Prompt Changes & Recovery Log');
  });

  it('fails when the header contract is stripped, renamed, or loses the escalation rule', () => {
    const stripped = readLedger('IMPROVEMENTS.md').replace(formatLedgerHeader('improvements').join('\n'), '');
    const report = evaluateLedgerContract(stripped, 'improvements');
    expect(report.ok).toBe(false);
    expect(report.violations.some((v) => v.heading === 'header')).toBe(true);

    const renamed = readLedger('PROMPT_CHANGES.md').replace(
      'append-only, oldest first',
      'append-only, newest first'
    );
    expect(
      evaluateLedgerContract(renamed, 'prompt-changes').violations.some((v) =>
        v.issue.includes('append-only, oldest first')
      )
    ).toBe(true);

    const noEscalation = readLedger('IMPROVEMENTS.md').replace(
      'docs/decisions/NNNN-slug.md',
      'somewhere else'
    );
    expect(
      evaluateLedgerContract(noEscalation, 'improvements').violations.some((v) =>
        v.issue.includes('docs/decisions/NNNN-slug.md')
      )
    ).toBe(true);
  });

  it('accepts a well-formed new entry and renders one from an opted-in registry entry', () => {
    const generated = formatImprovementsMarkdown([contractImprovement]);
    expect(generated).toContain('## 2026-11-28 — Teach the ledgers their own header');
    expect(generated).toContain('Why:        Regenerating the ledger silently dropped');
    expect(generated).toContain('Changed:    `IMPROVEMENTS.md` @ abc1234');
    expect(generated).toContain('Status:     active');

    const report = evaluateLedgerContract(generated, 'improvements');
    expect(report.violations).toEqual([]);
    expect(report.contractEntries).toBe(1);

    const generatedPrompts = formatPromptChangelogMarkdown([contractPrompt]);
    expect(generatedPrompts).toContain(
      '## core_hygiene v4 — Kept prompt versions carry the ledger contract'
    );
    expect(generatedPrompts).toContain('Prompt:     prompts/core_hygiene.md @ abc1234');
    expect(generatedPrompts).toContain('Supersedes: v3 — v3 predated the ledger contract');
    expect(evaluateLedgerContract(generatedPrompts, 'prompt-changes').ok).toBe(true);
  });

  it('rejects new entries that miss fields, misuse Status, or break the documented order', () => {
    const missingStatus = evaluateLedgerContract(
      withContractEntry(
        '## 2026-11-29 — Land a change\nWhy:        x\nChanged:    src/domain/models.ts'
      ),
      'improvements'
    );
    expect(missingStatus.ok).toBe(false);
    expect(missingStatus.violations.some((v) => v.issue.includes('missing required "Status:"'))).toBe(
      true
    );

    const badStatus = evaluateLedgerContract(
      withContractEntry(
        '## 2026-11-29 — Land a change\nWhy:        x\nChanged:    src/domain/models.ts\nStatus:     done'
      ),
      'improvements'
    );
    expect(badStatus.violations.some((v) => v.issue.includes('invalid Status "done"'))).toBe(true);

    const badOrder = evaluateLedgerContract(
      withContractEntry(
        '## 2026-11-29 — Land a change\nChanged:    src/domain/models.ts\nWhy:        x\nStatus:     active'
      ),
      'improvements'
    );
    expect(badOrder.violations.some((v) => v.issue.includes('out of order'))).toBe(true);

    const noPath = evaluateLedgerContract(
      withContractEntry('## 2026-11-29 — Land a change\nWhy:        x\nChanged:    it felt slow\nStatus:     active'),
      'improvements'
    );
    expect(noPath.violations.some((v) => v.issue.includes('must name at least one path'))).toBe(true);
  });

  it('forces an ADR when Rejected needs more than two lines', () => {
    const longRejected = withContractEntry(
      [
        '## 2026-11-29 — Land a change',
        'Why:        x',
        'Changed:    src/domain/models.ts',
        'Rejected:   the first alternative lost because',
        '  it moved the check into the verifier',
        '  and doubled every ledger diff',
        'Status:     active',
      ].join('\n')
    );
    const report = evaluateLedgerContract(longRejected, 'improvements');
    expect(report.ok).toBe(false);
    expect(report.violations.some((v) => v.issue.includes('promote it to docs/decisions'))).toBe(true);

    const withAdr = longRejected.replace(
      'and doubled every ledger diff',
      'and doubled every ledger diff; see docs/decisions/0002-ledger-gate.md'
    );
    expect(evaluateLedgerContract(withAdr, 'improvements').ok).toBe(true);
  });

  it('rejects out-of-order, backdated, and legacy-styled new entries', () => {
    const outOfOrder = withContractEntry(
      [
        `## ${LEDGER_FORMAT_UPDATED} — Newer lands first`,
        'Why:        x',
        'Changed:    src/domain/models.ts',
        'Status:     active',
        '',
        '## 2026-01-04 — Older lands below',
        'Why:        x',
        'Changed:    src/domain/models.ts',
        'Status:     active',
      ].join('\n')
    );
    expect(
      evaluateLedgerContract(outOfOrder, 'improvements').violations.some((v) =>
        v.issue.includes('oldest-first')
      )
    ).toBe(true);

    const backdated = withContractEntry(
      '## 2026-01-04 — Backdated contract entry\nWhy:        x\nChanged:    src/domain/models.ts\nStatus:     active'
    );
    expect(
      evaluateLedgerContract(backdated, 'improvements').violations.some((v) =>
        v.issue.includes(`dated before ${LEDGER_FORMAT_UPDATED}`)
      )
    ).toBe(true);

    const legacyStyled = withContractEntry(
      '## 2026-11-29  Land a change\nWhy:        x\nChanged:    src/domain/models.ts\nStatus:     active'
    );
    expect(
      evaluateLedgerContract(legacyStyled, 'improvements').violations.some((v) =>
        v.issue.includes('does not match the documented shape')
      )
    ).toBe(true);
  });

  it('validates the prompt-specific Prompt and Supersedes fields', () => {
    const header = formatLedgerHeader('prompt-changes').join('\n');
    const badPromptLine = [
      header,
      '',
      '## core_hygiene v5 — Summary',
      'Prompt:     prompts/core_hygiene.md',
      'Why:        x',
      'Changed:    y',
      'Supersedes: v4 — stale',
      'Status:     active',
      '',
    ].join('\n');
    expect(
      evaluateLedgerContract(badPromptLine, 'prompt-changes').violations.some((v) =>
        v.issue.includes('<path/to/prompt.md> @ <commit-sha or tag>')
      )
    ).toBe(true);

    const goodPromptLine = badPromptLine.replace(
      'Prompt:     prompts/core_hygiene.md',
      'Prompt:     prompts/core_hygiene.md @ v4.1',
    );
    expect(evaluateLedgerContract(goodPromptLine, 'prompt-changes').ok).toBe(true);
  });
});

describe('ledgerContract — registry freshness gate', () => {
  it('reports no drift for the committed ledgers and catches a hand-edited generated line', () => {
    expect(
      evaluateLedgerFreshness(
        readLedger('IMPROVEMENTS.md'),
        formatImprovementsMarkdown(undefined, INVARIANT_RATIONALES)
      )
    ).toEqual([]);

    const promptsDisk = readLedger('PROMPT_CHANGES.md');
    expect(evaluateLedgerFreshness(promptsDisk, formatPromptChangelogMarkdown())).toEqual([]);

    const handEdited = promptsDisk.replace(
      '- **Last Edited:** 2026-11-28',
      '- **Last Edited:** 2026-11-24'
    );
    const drift = evaluateLedgerFreshness(handEdited, formatPromptChangelogMarkdown());
    expect(drift.length).toBeGreaterThan(0);
    expect(drift[0].issue).toContain('registry renders');
  });

  it('flags a hand-appended entry as drift, because appends now go through the registry', () => {
    const promptsDisk = readLedger('PROMPT_CHANGES.md');
    const appended = [
      '## core_hygiene v5 — Hand-appended kept version',
      'Prompt:     prompts/core_hygiene.md @ abc1234',
      'Why:        the generated changelog was stale',
      'Changed:    refreshed the prompt changelog entry',
      'Supersedes: v4 — v4 missed the PII scan',
      'Status:     active',
      '',
    ].join('\n');
    const withEntry = `${promptsDisk.trimEnd()}\n\n${appended}\n`;

    // The shape gate accepts it (it is a well-formed contract entry)…
    expect(evaluateLedgerContract(withEntry, 'prompt-changes').ok).toBe(true);
    // …but the ledger is a registry render, so hand-appended text is drift wherever it sits.
    const drift = evaluateLedgerFreshness(withEntry, formatPromptChangelogMarkdown());
    expect(drift.length).toBeGreaterThan(0);
    expect(drift[0].issue).toContain('regen:ledgers');
  });
});
