/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Contract-change gate.
 *
 * `barnStoreContract.test.ts` freezes the store's key set, but it only knows the snapshot, not why it
 * changed. This gate makes the reason compulsory: the documented key count and snapshot hash must
 * match the actual file, and the changelog must record at least one entry. Any silent edit to the
 * snapshot — even one that keeps the tests green — fails here until the reason is written down.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SNAPSHOT = path.join(ROOT, 'src/hooks/__tests__/barnStoreContract.keys.json');
const DOC = path.join(ROOT, 'docs/contracts/barn-store-contract.md');

const problems: string[] = [];

if (!fs.existsSync(SNAPSHOT)) problems.push(`missing snapshot: ${SNAPSHOT}`);
if (!fs.existsSync(DOC)) problems.push(`missing contract doc: ${DOC}`);

if (problems.length === 0) {
  const bytes = fs.readFileSync(SNAPSHOT);
  const keys = JSON.parse(bytes.toString('utf8')) as string[];
  const hash = createHash('sha256').update(bytes).digest('hex');
  const doc = fs.readFileSync(DOC, 'utf8');

  if (!/^## Changelog$/m.test(doc)) problems.push('contract doc has no `## Changelog` section');
  const entries = doc.split('\n').filter((line) => /^- \d{4}-\d{2}-\d{2} · /.test(line.trim()));
  if (entries.length === 0) {
    problems.push('contract changelog has no entries — record why the key set changed');
  }

  const declaredKeys = doc.match(/^- Keys: (\d+)$/m);
  if (!declaredKeys) problems.push('contract doc has no `- Keys: <n>` line');
  else if (Number(declaredKeys[1]) !== keys.length) {
    problems.push(
      `contract doc declares ${declaredKeys[1]} keys but the snapshot has ${keys.length} — update the doc and add a changelog line`
    );
  }

  const declaredHash = doc.match(/^- SHA-256: ([0-9a-f]{64})$/m);
  if (!declaredHash) problems.push('contract doc has no `- SHA-256: <hash>` line');
  else if (declaredHash[1] !== hash) {
    problems.push(
      `contract doc hash ${declaredHash[1].slice(0, 12)}… does not match the snapshot ${hash.slice(0, 12)}… — add the changelog line, then update both`
    );
  }
}

if (problems.length > 0) {
  console.error(`[verify:contract] FAIL — ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('[verify:contract] PASS — store contract snapshot matches its documented changelog.');
