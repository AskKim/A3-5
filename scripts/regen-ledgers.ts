/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Ledger Regeneration CLI (`npm run regen:ledgers`).
 *
 * `IMPROVEMENTS.md` and `PROMPT_CHANGES.md` are generated files: their whole content is a render of
 * their registries, so a new entry means a registry entry plus this command. The verifiers compare
 * the file with the same render, so writing here is always what `npm run verify` expects.
 *
 * Usage:
 *   npx tsx scripts/regen-ledgers.ts           # dry run: report drift, exit 1 when stale
 *   npx tsx scripts/regen-ledgers.ts --write   # rewrite both ledgers (`npm run regen:ledgers`)
 */

import fs from 'node:fs';
import path from 'node:path';
import { formatImprovementsMarkdown } from '../src/domain/improvementRegistry';
import { INVARIANT_RATIONALES } from '../src/domain/improvements/rationales';
import { formatPromptChangelogMarkdown } from '../src/domain/promptRegistry';
import { evaluateLedgerFreshness } from '../src/domain/ledgerContract';

const ROOT = path.resolve(import.meta.dirname, '..');
const WRITE = process.argv.includes('--write');

interface LedgerTarget {
  file: string;
  render: () => string;
}

const TARGETS: readonly LedgerTarget[] = [
  {
    file: 'IMPROVEMENTS.md',
    render: () => formatImprovementsMarkdown(undefined, INVARIANT_RATIONALES),
  },
  {
    file: 'PROMPT_CHANGES.md',
    render: () => formatPromptChangelogMarkdown(),
  },
];

let staleCount = 0;

for (const target of TARGETS) {
  const filePath = path.join(ROOT, target.file);
  const onDisk = fs.readFileSync(filePath, 'utf8');
  const regenerated = target.render();
  const drift = evaluateLedgerFreshness(onDisk, regenerated);

  if (drift.length === 0) {
    console.log(`[regen:ledgers] ${target.file} — generated region matches the registry.`);
    continue;
  }

  staleCount += 1;
  if (!WRITE) {
    console.error(`[regen:ledgers] ${target.file} — stale generated region:`);
    for (const violation of drift) {
      console.error(`  - ${violation.heading}: ${violation.issue}`);
    }
    continue;
  }

  fs.writeFileSync(filePath, regenerated, 'utf8');
  console.log(`[regen:ledgers] ${target.file} — rewrote from the registry.`);
}

if (staleCount > 0 && !WRITE) {
  console.error('[regen:ledgers] FAIL — ledgers are stale. Run `npm run regen:ledgers`.');
  process.exit(1);
}

console.log('[regen:ledgers] Done.');
