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
});
