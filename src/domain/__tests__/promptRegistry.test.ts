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
  findLedgerPinViolations,
  formatPromptChangelogMarkdown,
  LEGACY_PROMPT_ENTRY_IDS,
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
      PROMPT_CHANGES_REGISTRY.find((entry) => entry.id === 'PRM-001')!,
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

    // A brand-new entry cannot be logged in the legacy shape by omitting every ledger field.
    const newLegacy = findLedgerOptInViolations([{ ...base, id: 'PRM-904' }]);
    expect(newLegacy).toHaveLength(1);
    expect(newLegacy[0].issue).toContain('LEGACY_PROMPT_ENTRY_IDS');

    expect(findLedgerOptInViolations()).toEqual([]);
    expect(findLedgerPinViolations()).toEqual([]);
  });

  it('keeps the pinned legacy prompt IDs honest against the registry', () => {
    expect(LEGACY_PROMPT_ENTRY_IDS).toHaveLength(8);

    const stalePin = findLedgerPinViolations([
      PROMPT_CHANGES_REGISTRY.find((entry) => entry.id === 'PRM-001')!,
    ]);
    expect(stalePin.some((violation) => violation.issue.includes('no longer in the registry'))).toBe(
      true
    );

    const optedIn = findLedgerPinViolations([
      {
        ...PROMPT_CHANGES_REGISTRY.find((entry) => entry.id === 'PRM-001')!,
        decidedOn: '2026-11-28',
        version: 'v9',
        commitShaOrTag: 'abc1234',
      },
    ]);
    expect(
      optedIn.some((violation) => violation.issue.includes('now opts into the contract'))
    ).toBe(true);
  });

  it('ratchets the pinned legacy prompt IDs so the exemption list can never grow', () => {
    // Pinning an ID is the only way past the opt-in gate, so a longer list is a quiet bypass: a new
    // revision could be logged in the legacy shape by appending its ID here. The snapshot is a
    // literal on purpose — adding a pin must also edit this expectation in a reviewable diff.
    const pinnedSnapshot = [
      'PRM-001',
      'PRM-002',
      'PRM-003',
      'PRM-004',
      'PRM-005',
      'PRM-006',
      'PRM-007',
      'PRM-008',
    ];
    expect([...LEGACY_PROMPT_ENTRY_IDS]).toEqual(pinnedSnapshot);
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
        PROMPT_CHANGES_REGISTRY.find((entry) => entry.id === 'PRM-003')!,
        { ...base, id: 'PRM-906', ...opted, status: 'superseded', supersededBy: 'PRM-003' },
      ])
    ).toEqual([]);
  });

  it('rejects an impossible decidedOn and a supersededBy that names no entry', () => {
    const base = PROMPT_CHANGES_REGISTRY[0];
    const opted = {
      decidedOn: '2026-11-28',
      version: 'v5',
      commitShaOrTag: 'abc1234',
    } as const;

    const impossibleMonth = findLedgerOptInViolations([
      { ...base, id: 'PRM-907', ...opted, decidedOn: '2026-13-45' },
    ]);
    expect(impossibleMonth).toHaveLength(1);
    expect(impossibleMonth[0].issue).toContain('real calendar date');

    // Shaped like a date, but February never had 30 days.
    expect(
      findLedgerOptInViolations([{ ...base, id: 'PRM-908', ...opted, decidedOn: '2026-02-30' }])[0]
        .issue
    ).toContain('real calendar date');

    // A real leap day is a valid entry date.
    expect(
      findLedgerOptInViolations([{ ...base, id: 'PRM-909', ...opted, decidedOn: '2028-02-29' }])
    ).toEqual([]);

    const dangling = findLedgerOptInViolations([
      { ...base, id: 'PRM-910', ...opted, status: 'superseded', supersededBy: 'PRM-999' },
    ]);
    expect(dangling).toHaveLength(1);
    expect(dangling[0].issue).toContain('PRM-999');

    // The replacement resolves only when it is actually in the registry.
    expect(
      findLedgerOptInViolations([
        { ...base, id: 'PRM-911', ...opted },
        { ...base, id: 'PRM-912', ...opted, status: 'superseded', supersededBy: 'PRM-911' },
      ])
    ).toEqual([]);
  });
});
