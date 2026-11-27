/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Automated Prompt Drift & Recovery Verifier (`scripts/verify-prompts.ts`).
 *
 * Reads all tracked `/prompts/*` and governance files from disk and runs
 * `evaluatePromptInvariants` from `src/domain/promptRegistry.ts`.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  evaluatePromptInvariants,
  PROMPT_CHANGES_REGISTRY,
} from '../src/domain/promptRegistry';

async function main() {
  const rootDir = process.cwd();
  const uniquePaths = new Set<string>();

  for (const entry of PROMPT_CHANGES_REGISTRY) {
    for (const inv of entry.invariants) {
      uniquePaths.add(inv.filePath.replace(/^\/+/, ''));
    }
  }

  const filesByPath: Record<string, string | undefined> = {};

  await Promise.all(
    Array.from(uniquePaths).map(async (relPath) => {
      try {
        filesByPath[relPath] = await readFile(resolve(rootDir, relPath), 'utf8');
      } catch {
        filesByPath[relPath] = undefined;
      }
    })
  );

  const report = evaluatePromptInvariants(filesByPath, PROMPT_CHANGES_REGISTRY);

  console.log(
    `[verify:prompts] Checked ${report.totalEntries} prompt revisions across ${report.totalFilesChecked} files.`
  );

  if (report.ok) {
    console.log(
      `[verify:prompts] PASS — all ${report.passedCount}/${report.totalEntries} prompt invariants are intact.`
    );
    process.exit(0);
  }

  console.error(
    `[verify:prompts] FAIL — detected ${report.violations.length} prompt drift violation(s):`
  );
  for (const v of report.violations) {
    console.error(`\n  [${v.entryId}] ${v.title}`);
    console.error(`    File: ${v.filePath}`);
    console.error(`    Issue: ${v.issue}`);
    console.error('    Recovery Playbook:');
    v.restorePlaybook.forEach((step, idx) => {
      console.error(`      ${idx + 1}. ${step}`);
    });
  }

  process.exit(1);
}

void main();
