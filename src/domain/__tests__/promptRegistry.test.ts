/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildPromptRecoveryJson,
  evaluatePromptInvariants,
  findLedgerOptInViolations,
  formatPromptChangelogMarkdown,
  PROMPT_CHANGES_REGISTRY,
} from '../promptRegistry';

describe('promptRegistry — /prompts/ changelog, invariants & recovery playbooks', () => {
  it('passes all registered prompt invariants against live repository files', () => {
    const rootDir = process.cwd();
    const filesByPath: Record<string, string | undefined> = {};

    for (const entry of PROMPT_CHANGES_REGISTRY) {
      for (const inv of entry.invariants) {
        const rel = inv.filePath.replace(/^\/+/, '');
        if (!(rel in filesByPath)) {
          const fullPath = path.resolve(rootDir, rel);
          filesByPath[rel] = fs.existsSync(fullPath)
            ? fs.readFileSync(fullPath, 'utf8')
            : undefined;
        }
      }
    }

    const report = evaluatePromptInvariants(filesByPath, PROMPT_CHANGES_REGISTRY);
    expect(report.violations).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.passedCount).toBe(PROMPT_CHANGES_REGISTRY.length);
  });

  it('detects missing protection directives or regressions and surfaces restore playbooks', () => {
    const report = evaluatePromptInvariants(
      {
        'prompts/core_hygiene.md': '# Broken prompt without protection flag',
      },
      [PROMPT_CHANGES_REGISTRY.find((e) => e.id === 'PRM-008')!]
    );

    expect(report.ok).toBe(false);
    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.violations[0].restorePlaybook.length).toBeGreaterThan(0);
  });

  it('formats PROMPT_CHANGES.md markdown and JSON recovery bundle cleanly', () => {
    const md = formatPromptChangelogMarkdown();
    expect(md).toContain('# Prompt Changes & Recovery Log');
    expect(md).toContain('PRM-008');
    expect(md).toContain('prompts/core_hygiene.md');

    const json = buildPromptRecoveryJson();
    const parsed = JSON.parse(json) as { format: string; totalEntries: number };
    expect(parsed.format).toBe('community-pedigree-prompt-changelog');
    expect(parsed.totalEntries).toBe(PROMPT_CHANGES_REGISTRY.length);
  });

  it('rejects a half-opted-in entry instead of silently rendering it as legacy', () => {
    const base = PROMPT_CHANGES_REGISTRY[0];

    const halfOpted = findLedgerOptInViolations([
      { ...base, id: 'PRM-901', decidedOn: '2026-11-28', version: 'v5' },
    ]);
    expect(halfOpted).toHaveLength(1);
    expect(halfOpted[0].issue).toContain('commitShaOrTag');

    const ledgerFieldsOnly = findLedgerOptInViolations([
      { ...base, id: 'PRM-902', status: 'superseded', supersededBy: 'PRM-001' },
    ]);
    expect(ledgerFieldsOnly).toHaveLength(1);
    expect(ledgerFieldsOnly[0].issue).toContain('decidedOn');

    expect(
      findLedgerOptInViolations([
        {
          ...base,
          id: 'PRM-903',
          decidedOn: '2026-11-28',
          version: 'v5',
          commitShaOrTag: 'abc1234',
        },
      ])
    ).toEqual([]);

    expect(findLedgerOptInViolations([{ ...base, id: 'PRM-904' }])).toEqual([]);
    expect(findLedgerOptInViolations()).toEqual([]);
  });

  it('rejects `superseded` without naming the replacing entry', () => {
    const base = PROMPT_CHANGES_REGISTRY[0];
    const opted = {
      decidedOn: '2026-11-28',
      version: 'v5',
      commitShaOrTag: 'abc1234',
    } as const;

    const orphaned = findLedgerOptInViolations([
      { ...base, id: 'PRM-905', ...opted, status: 'superseded' },
    ]);
    expect(orphaned).toHaveLength(1);
    expect(orphaned[0].issue).toContain('supersededBy');

    expect(
      findLedgerOptInViolations([
        { ...base, id: 'PRM-906', ...opted, status: 'superseded', supersededBy: 'PRM-003' },
      ])
    ).toEqual([]);
  });
});
