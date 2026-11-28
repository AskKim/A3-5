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
  findLedgerOptInViolations,
  formatPromptChangelogMarkdown,
  PROMPT_CHANGES_REGISTRY,
} from '../src/domain/promptRegistry';
import { evaluateLedgerContract, evaluateLedgerFreshness } from '../src/domain/ledgerContract';

const LEDGER_PATH = 'PROMPT_CHANGES.md';

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
  const optInViolations = findLedgerOptInViolations(PROMPT_CHANGES_REGISTRY);

  console.log(
    `[verify:prompts] Checked ${report.totalEntries} prompt revisions across ${report.totalFilesChecked} files.`
  );

  let ledgerMarkdown: string | undefined;
  try {
    ledgerMarkdown = await readFile(resolve(rootDir, LEDGER_PATH), 'utf8');
  } catch {
    ledgerMarkdown = undefined;
  }
  const ledgerReport = evaluateLedgerContract(ledgerMarkdown ?? '', 'prompt-changes');
  const ledgerViolations = [
    ...(ledgerMarkdown === undefined
      ? [{ heading: LEDGER_PATH, issue: `ledger file is missing from ${rootDir}` }]
      : []),
    ...ledgerReport.violations,
  ];

  const freshnessViolations =
    ledgerMarkdown === undefined
      ? []
      : evaluateLedgerFreshness(ledgerMarkdown, formatPromptChangelogMarkdown());

  if (
    report.ok &&
    ledgerViolations.length === 0 &&
    optInViolations.length === 0 &&
    freshnessViolations.length === 0
  ) {
    console.log(
      `[verify:prompts] PASS — all ${report.passedCount}/${report.totalEntries} prompt invariants are intact.`
    );
    console.log(
      `[verify:prompts] Ledger contract: ${LEDGER_PATH} header intact, ${ledgerReport.contractEntries} contract-shaped entr${
        ledgerReport.contractEntries === 1 ? 'y' : 'ies'
      }, ${ledgerReport.totalEntries - ledgerReport.contractEntries} grandfathered.`
    );
    console.log(
      `[verify:prompts] Ledger freshness: ${LEDGER_PATH} matches a fresh render of src/domain/promptRegistry.ts (${ledgerReport.totalEntries} entries).`
    );
    console.log(
      '[verify:prompts] Ledger opt-in: every prompt entry is either fully legacy or fully contract-shaped.'
    );
    process.exit(0);
  }

  if (report.violations.length > 0) {
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
  }

  if (ledgerViolations.length > 0) {
    console.error(
      `[verify:prompts] FAIL — ${ledgerViolations.length} append-only ledger contract violation(s) in ${LEDGER_PATH}:`
    );
    for (const v of ledgerViolations) {
      console.error(`  - ${v.heading}: ${v.issue}`);
    }
    console.error(
      '    Restore the header from `formatLedgerHeader(\'prompt-changes\')` in src/domain/ledgerContract.ts and shape new entries as documented there.'
    );
  }

  if (optInViolations.length > 0) {
    console.error(
      `[verify:prompts] FAIL — ${optInViolations.length} half-opted-in prompt entr${
        optInViolations.length === 1 ? 'y' : 'ies'
      } in src/domain/promptRegistry.ts:`
    );
    for (const v of optInViolations) {
      console.error(`  - [${v.entryId}] ${v.title}: ${v.issue}`);
    }
    console.error(
      '    Fix: set all of decidedOn, version and commitShaOrTag, or remove them and stay legacy.'
    );
  }

  if (freshnessViolations.length > 0) {
    console.error(
      `[verify:prompts] FAIL — ${freshnessViolations.length} freshness drift(s) between ${LEDGER_PATH} and src/domain/promptRegistry.ts:`
    );
    for (const v of freshnessViolations) {
      console.error(`  - ${v.heading}: ${v.issue}`);
    }
    console.error(
      '    Fix: `npm run regen:ledgers` — the registry is the source of truth; appended entries are preserved.'
    );
  }

  process.exit(1);
}

void main();
