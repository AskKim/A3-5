/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Dual-Audience Header Verifier (`scripts/verify-dual-audience.ts`).
 *
 * Every `src/**` module carries the same two-part header the docs use: a plain-English
 * Part 1 for someone who does not read code, then the technical Part 2. That convention
 * existed only in memory before, so it decayed into single-audience files.
 *
 * It is a ratchet now, not a flag day: a newly added module must comply immediately, and
 * `scripts/dual-audience-allowlist.json` records the existing backlog. A file that gains
 * its header must leave the allowlist in the same change, and the gate fails if it does
 * not - so the list can only ever shrink.
 *
 * Run `--write-allowlist` to re-record the backlog after converting a batch.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = 'src';
const ALLOWLIST_PATH = 'scripts/dual-audience-allowlist.json';
const PART1_MARKER = /^ \* PART 1 — FOR HUMANS: \S/m;
const PART2_MARKER = ' * PART 2 — FOR AI / DEVELOPERS:';

/**
 * Boot/entry files are SHA-256 locked by `BOOT_ENTRY_LOCK_CHECKSUMS` in
 * `src/domain/improvementRegistry.ts`. Editing their header would break that lock, and the
 * lock exists to stop exactly this kind of drive-by edit, so they are exempt by design.
 */
const EXEMPT = new Set(['src/main.tsx', 'src/App.tsx']);

interface Allowlist {
  _comment?: string;
  files: string[];
}

function walk(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function isSourceModule(path: string): boolean {
  if (!/\.tsx?$/.test(path)) return false;
  if (/\.test\.tsx?$/.test(path)) return false;
  if (path.includes('__tests__')) return false;
  return true;
}

function readAllowlist(): Allowlist {
  if (!existsSync(ALLOWLIST_PATH)) return { files: [] };
  const raw: unknown = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
  if (typeof raw !== 'object' || raw === null) return { files: [] };
  const files = (raw as { files?: unknown }).files;
  if (!Array.isArray(files)) return { files: [] };
  return { files: files.filter((file): file is string => typeof file === 'string') };
}

function writeAllowlist(backlog: string[]): void {
  const body: Allowlist = {
    _comment:
      'Modules that predate the dual-audience header and still lack it. The gate fails if a file ' +
      'gains its header but stays listed here, so this list only ever shrinks. Regenerate with ' +
      '`npx tsx scripts/verify-dual-audience.ts --write-allowlist`.',
    files: backlog,
  };
  writeFileSync(ALLOWLIST_PATH, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
}

function hasHeader(text: string): { part1: number; part2: number } {
  const part1 = text.search(PART1_MARKER);
  const part2 = text.indexOf(PART2_MARKER);
  return { part1, part2 };
}

function main(): void {
  const modules = walk(SRC_ROOT)
    .filter(isSourceModule)
    .map((path) => path.replace(/\\/g, '/'))
    .sort();

  const allowlist = readAllowlist();
  const allowed = new Set(allowlist.files);
  const writeMode = process.argv.includes('--write-allowlist');
  const errors: string[] = [];
  const backlog: string[] = [];
  let converted = 0;

  for (const path of modules) {
    const exempt = EXEMPT.has(path);
    const { part1, part2 } = hasHeader(readFileSync(path, 'utf8'));
    const complete = part1 !== -1 && part2 !== -1;

    if (complete) {
      converted += 1;
      if (allowed.has(path)) {
        errors.push(
          `${path} has its dual-audience header but is still in ${ALLOWLIST_PATH}; remove it (the list may only shrink)`
        );
      }
      if (part1 > part2) {
        errors.push(`${path} has Part 2 above Part 1; the plain-English block must come first`);
      }
      continue;
    }

    if (exempt) continue;
    if (writeMode) {
      backlog.push(path);
      continue;
    }
    if (allowed.has(path)) continue;

    const missing = part1 === -1 ? 'PART 1 — FOR HUMANS' : 'PART 2 — FOR AI / DEVELOPERS';
    errors.push(`${path} is missing ${missing} in its header block`);
  }

  for (const path of allowlist.files) {
    if (!modules.includes(path)) {
      errors.push(`${ALLOWLIST_PATH} lists ${path}, which is not a source module on disk`);
      continue;
    }
    if (EXEMPT.has(path)) {
      errors.push(`${ALLOWLIST_PATH} lists ${path}, which is exempt (boot-entry lock)`);
    }
  }

  if (writeMode) {
    writeAllowlist(backlog);
    console.log(`Dual-audience allowlist recorded: ${backlog.length} module(s) still to convert.`);
    return;
  }

  if (errors.length > 0) {
    console.error(`DUAL_AUDIENCE_FAILED (${errors.length} issue(s)):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(
    `OK dual-audience: converted=${converted} allowlisted=${allowlist.files.length} exempt=${EXEMPT.size}`
  );
}

main();
