/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Automated CLI Drift Verifier (`scripts/verify-improvements.ts`).
 *
 * Reads all tracked files from disk and runs `evaluateImprovementInvariants` from
 * `src/domain/improvementRegistry.ts`. Exits non-zero if a GitHub sync or merge
 * accidentally removed or reverted any logged improvement.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  evaluateImprovementInvariants,
  findImprovementLedgerOptInViolations,
  findImprovementLedgerPinViolations,
  formatImprovementsMarkdown,
  IMPROVEMENTS_REGISTRY,
} from '../src/domain/improvementRegistry';
import { INVARIANT_RATIONALES } from '../src/domain/improvements/rationales';
import { evaluateLedgerContract, evaluateLedgerFreshness } from '../src/domain/ledgerContract';

const LEDGER_PATH = 'IMPROVEMENTS.md';

async function main() {
  const rootDir = process.cwd();
  const uniquePaths = new Set<string>();

  for (const entry of IMPROVEMENTS_REGISTRY) {
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

  const report = evaluateImprovementInvariants(filesByPath, IMPROVEMENTS_REGISTRY, INVARIANT_RATIONALES);
  const optInViolations = [
    ...findImprovementLedgerOptInViolations(IMPROVEMENTS_REGISTRY),
    ...findImprovementLedgerPinViolations(IMPROVEMENTS_REGISTRY),
  ];

  console.log(
    `[verify:improvements] Checked ${report.totalEntries} improvements across ${report.totalFilesChecked} files.`
  );

  let ledgerMarkdown: string | undefined;
  try {
    ledgerMarkdown = await readFile(resolve(rootDir, LEDGER_PATH), 'utf8');
  } catch {
    ledgerMarkdown = undefined;
  }
  const ledgerReport = evaluateLedgerContract(ledgerMarkdown ?? '', 'improvements');
  const ledgerViolations = [
    ...(ledgerMarkdown === undefined
      ? [{ heading: LEDGER_PATH, issue: `ledger file is missing from ${rootDir}` }]
      : []),
    ...ledgerReport.violations,
  ];

  const freshnessViolations =
    ledgerMarkdown === undefined
      ? []
      : evaluateLedgerFreshness(
          ledgerMarkdown,
          formatImprovementsMarkdown(undefined, INVARIANT_RATIONALES)
        );

  if (
    report.ok &&
    ledgerViolations.length === 0 &&
    optInViolations.length === 0 &&
    freshnessViolations.length === 0
  ) {
    console.log(
      `[verify:improvements] PASS — all ${report.passedCount}/${report.totalEntries} tracked improvements are intact.`
    );
    console.log(
      `[verify:improvements] Ledger contract: ${LEDGER_PATH} header intact, ${ledgerReport.contractEntries} contract-shaped entr${
        ledgerReport.contractEntries === 1 ? 'y' : 'ies'
      }, ${ledgerReport.totalEntries - ledgerReport.contractEntries} grandfathered.`
    );
    console.log(
      `[verify:improvements] Ledger freshness: ${LEDGER_PATH} matches a fresh render of src/domain/improvementRegistry.ts (${ledgerReport.totalEntries} entries).`
    );
    process.exit(0);
  }

  if (report.violations.length > 0) {
    console.error(
      `[verify:improvements] FAIL — detected ${report.violations.length} drift violation(s):`
    );
    for (const v of report.violations) {
      console.error(`\n  [${v.entryId}] ${v.title}`);
      console.error(`    File: ${v.filePath}`);
      console.error(`    Issue: ${v.issue}`);
      console.error('    Restore Playbook:');
      v.restorePlaybook.forEach((step, idx) => {
        console.error(`      ${idx + 1}. ${step}`);
      });
    }
  }

  if (ledgerViolations.length > 0) {
    console.error(
      `[verify:improvements] FAIL — ${ledgerViolations.length} append-only ledger contract violation(s) in ${LEDGER_PATH}:`
    );
    for (const v of ledgerViolations) {
      console.error(`  - ${v.heading}: ${v.issue}`);
    }
    console.error(
      '    Restore the header from `formatLedgerHeader(\'improvements\')` in src/domain/ledgerContract.ts and shape new entries as documented there.'
    );
  }

  if (optInViolations.length > 0) {
    console.error(
      `[verify:improvements] FAIL — ${optInViolations.length} improvement ledger opt-in violation${
        optInViolations.length === 1 ? '' : 's'
      } (unpinned legacy, or an invalid ledger value) in src/domain/improvementRegistry.ts:`
    );
    for (const v of optInViolations) {
      console.error(`  - [${v.entryId}] ${v.title}: ${v.issue}`);
    }
    console.error(
      '    Fix: a new entry sets `decidedOn` (plus `status`/`rejected` where relevant); only LEGACY_IMPROVEMENT_ENTRY_IDS may stay legacy. `decidedOn` must be a real YYYY-MM-DD calendar date, and `supersededBy` must name an existing entry.'
    );
  }

  if (freshnessViolations.length > 0) {
    console.error(
      `[verify:improvements] FAIL — ${freshnessViolations.length} freshness drift(s) between ${LEDGER_PATH} and src/domain/improvementRegistry.ts:`
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
