/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Engine Extraction Rehearsal (`npm run verify:extraction`).
 *
 * Copies `src/engine`, `src/features`, `src/utils`, `tsconfig.json`, and `tsconfig.engine.json`
 * into an isolated temporary directory (without `src/domain`, `src/app`, `src/storage`,
 * `src/hooks`, or `src/components`) and runs `tsc -p tsconfig.engine.json --noEmit` to prove
 * the framework layers compile standalone before any future `/engine` repo extraction.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIRS_TO_COPY = ['src/engine', 'src/features', 'src/utils'];
const FILES_TO_COPY = ['tsconfig.json', 'tsconfig.engine.json'];
const FORBIDDEN_LAYER_RE = /^src\/(domain|app|storage|hooks|components)\//;

/**
 * Files in the extracted layers that name a layer that will not travel with them. `tsc` already
 * proves the sources compile alone, but it skips `__tests__`, so a framework test could still reach
 * back into a component or storage singleton and only fail after the package is split out.
 */
function collectForeignImports(dirRel: string, out: string[]): void {
  const dir = path.join(ROOT, dirRel);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = `${dirRel}/${entry.name}`;
    if (entry.isDirectory()) {
      collectForeignImports(relPath, out);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    out.push(...foreignImportsInFile(relPath));
  }
}

function foreignImportsInFile(relPath: string): string[] {
  const text = fs
    .readFileSync(path.join(ROOT, relPath), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const specs: string[] = [];
  const staticRe = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\bfrom\s+)?['"]([^'"]+)['"]/g;
  const dynamicRe = /(?:^|[^'"`])\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const re of [staticRe, dynamicRe]) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) specs.push(match[1]);
  }
  const foreign: string[] = [];
  for (const spec of specs) {
    if (!spec.startsWith('.')) continue;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(relPath), spec));
    if (FORBIDDEN_LAYER_RE.test(target)) foreign.push(`${relPath} -> ${target}`);
  }
  return foreign;
}

const foreignImports = DIRS_TO_COPY.flatMap((dirRel) => {
  const found: string[] = [];
  collectForeignImports(dirRel, found);
  return found;
});

if (foreignImports.length > 0) {
  console.error(
    `[verify:extraction] FAIL — ${foreignImports.length} import(s) from the extracted layers point at code that would not travel with them:`
  );
  for (const entry of foreignImports.sort()) console.error(`  + ${entry}`);
  process.exit(1);
}

function copyDirRecursive(srcDir: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-extraction-rehearsal-'));

try {
  for (const relDir of DIRS_TO_COPY) {
    copyDirRecursive(path.join(ROOT, relDir), path.join(tempRoot, relDir));
  }
  for (const relFile of FILES_TO_COPY) {
    fs.copyFileSync(path.join(ROOT, relFile), path.join(tempRoot, relFile));
  }

  const nodeModulesSrc = path.join(ROOT, 'node_modules');
  const nodeModulesDest = path.join(tempRoot, 'node_modules');
  if (fs.existsSync(nodeModulesSrc)) {
    fs.symlinkSync(nodeModulesSrc, nodeModulesDest, 'dir');
  }

  const tscBin = path.join(ROOT, 'node_modules', '.bin', 'tsc');
  execFileSync(tscBin, ['-p', 'tsconfig.engine.json', '--noEmit'], {
    cwd: tempRoot,
    stdio: 'inherit',
  });

  console.log('[verify:extraction] PASS — isolated engine + features + utils compiled with zero domain/app/storage files.');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
