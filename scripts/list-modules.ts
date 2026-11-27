/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Live Workspace Module Listing & Split CLI (`npm run list:modules`).
 *
 * Walks `src/` (excluding `__tests__/` and `*.test.ts*`), classifies every file into
 * Core / Foundation / Non-Content-Specific vs. Content-Specific via `src/domain/moduleCatalog.ts`,
 * and optionally writes or verifies `MODULES.md`.
 *
 * Flags:
 *   --json   Print structured JSON report
 *   --write  Regenerate MODULES.md on disk
 *   --check  Verify zero core content-name leaks and MODULES.md freshness
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  buildModuleCatalog,
  formatModuleCatalogMarkdown,
  MODULE_SUBCATEGORY_LABELS,
  type ModuleSubCategory,
  verifyNoContentNamesInCoreModules,
} from '../src/domain/moduleCatalog';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const MODULES_MD_PATH = path.join(ROOT, 'MODULES.md');

function walkSourceModules(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      walkSourceModules(fullPath, out);
    } else if (/\.(ts|tsx|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      const rel = path.relative(ROOT, fullPath).split(path.sep).join('/');
      out.push(rel);
    }
  }
  return out;
}

const modulePaths = walkSourceModules(SRC_DIR);
const catalog = buildModuleCatalog(modulePaths);
const coreNameViolations = verifyNoContentNamesInCoreModules(catalog);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ catalog, coreNameViolations }, null, 2));
  process.exit(coreNameViolations.length > 0 ? 1 : 0);
}

const markdown = formatModuleCatalogMarkdown(catalog);

if (process.argv.includes('--write')) {
  fs.writeFileSync(MODULES_MD_PATH, markdown, 'utf8');
  console.log(
    `[list:modules] Wrote MODULES.md (${catalog.coreNonContentCount} core/non-content, ${catalog.contentSpecificCount} content-specific, ${catalog.totalModules} total).`
  );
  if (coreNameViolations.length > 0) {
    console.error('[list:modules] Core filename violations:', coreNameViolations);
    process.exit(1);
  }
  process.exit(0);
}

if (process.argv.includes('--check')) {
  if (coreNameViolations.length > 0) {
    console.error('[list:modules] FAIL — content-specific names found in core modules:');
    for (const v of coreNameViolations) console.error(`  - ${v}`);
    process.exit(1);
  }
  if (!fs.existsSync(MODULES_MD_PATH)) {
    console.error('[list:modules] FAIL — MODULES.md does not exist. Run `npx tsx scripts/list-modules.ts --write`.');
    process.exit(1);
  }
  const onDisk = fs.readFileSync(MODULES_MD_PATH, 'utf8');
  if (onDisk !== markdown) {
    console.error('[list:modules] FAIL — MODULES.md is out of sync with src/. Run `npx tsx scripts/list-modules.ts --write`.');
    process.exit(1);
  }
  console.log(
    `[list:modules] PASS — ${catalog.coreNonContentCount} core/non-content + ${catalog.contentSpecificCount} content-specific modules verified and synced.`
  );
  process.exit(0);
}

// Default human-readable terminal view
console.log('=== CURRENT MODULES SPLIT ===');
console.log(
  `Total: ${catalog.totalModules} | Core / Foundation / Non-Content-Specific: ${catalog.coreNonContentCount} | Content-Specific: ${catalog.contentSpecificCount}`
);
console.log('\n[1] CORE / FOUNDATION / NON-CONTENT-SPECIFIC');
for (const sub of ['core-foundation', 'non-content-feature', 'reusable-utility'] as ModuleSubCategory[]) {
  const list = catalog.coreNonContentModules.filter((m) => m.subCategory === sub);
  console.log(`\n  ${MODULE_SUBCATEGORY_LABELS[sub]} (${list.length}):`);
  for (const m of list) console.log(`    - ${m.path}`);
}

console.log('\n[2] CONTENT-SPECIFIC MODULES');
for (const sub of [
  'domain-engine',
  'app-wiring',
  'storage-adapter',
  'native-wrapper',
  'state-hook',
  'ui-component',
  'app-entry',
] as ModuleSubCategory[]) {
  const list = catalog.contentSpecificModules.filter((m) => m.subCategory === sub);
  console.log(`\n  ${MODULE_SUBCATEGORY_LABELS[sub]} (${list.length}):`);
  for (const m of list) console.log(`    - ${m.path}`);
}
