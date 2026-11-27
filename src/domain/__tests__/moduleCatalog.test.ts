/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildModuleCatalog,
  classifyModulePath,
  formatModuleCatalogMarkdown,
  verifyNoContentNamesInCoreModules,
} from '../moduleCatalog';

function collectNonTestSrcPaths(dir: string, rootDir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      collectNonTestSrcPaths(fullPath, rootDir, out);
    } else if (/\.(ts|tsx|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(path.relative(rootDir, fullPath).split(path.sep).join('/'));
    }
  }
  return out;
}

describe('moduleCatalog — Core/Non-Content vs Content-Specific split', () => {
  it('classifies useBarnStore.ts as content-specific and core/features/utils as core-non-content', () => {
    const storeEntry = classifyModulePath('src/hooks/useBarnStore.ts');
    expect(storeEntry.bucket).toBe('content-specific');
    expect(storeEntry.subCategory).toBe('state-hook');
    expect(storeEntry.extractable).toBe(false);

    const bridgeEntry = classifyModulePath('src/native/pedigreeBridge.ts');
    expect(bridgeEntry.bucket).toBe('content-specific');
    expect(bridgeEntry.subCategory).toBe('native-wrapper');

    const engineEntry = classifyModulePath('src/engine/primitives/crypto.ts');
    expect(engineEntry.bucket).toBe('core-non-content');
    expect(engineEntry.subCategory).toBe('core-foundation');
    expect(engineEntry.extractable).toBe(true);

    const featureEntry = classifyModulePath('src/features/ics-calendar/icsBuilder.ts');
    expect(featureEntry.bucket).toBe('core-non-content');
    expect(featureEntry.subCategory).toBe('non-content-feature');

    const utilEntry = classifyModulePath('src/utils/lazyRoute.tsx');
    expect(utilEntry.bucket).toBe('core-non-content');
    expect(utilEntry.subCategory).toBe('reusable-utility');
  });

  it('splits live workspace src/ files with zero content-specific names in core modules', () => {
    const rootDir = process.cwd();
    const srcDir = path.join(rootDir, 'src');
    const paths = collectNonTestSrcPaths(srcDir, rootDir);
    const catalog = buildModuleCatalog(paths, {}, '2026-11-27T00:00:00.000Z');

    expect(catalog.totalModules).toBe(paths.length);
    expect(catalog.coreNonContentCount).toBeGreaterThan(40);
    expect(catalog.contentSpecificCount).toBeGreaterThan(50);
    expect(catalog.coreNonContentCount + catalog.contentSpecificCount).toBe(catalog.totalModules);
    expect(verifyNoContentNamesInCoreModules(catalog)).toEqual([]);

    const md = formatModuleCatalogMarkdown(catalog);
    expect(md).toContain('## 1. Core / Foundation / Non-Content-Specific Modules');
    expect(md).toContain('## 2. Content-Specific Modules');
    expect(md).toContain('`src/hooks/useBarnStore.ts`');
    expect(md).toContain('`src/engine/primitives/crypto.ts`');
  });

  it('flags synthetic content-specific core filenames cleanly', () => {
    const badCatalog = buildModuleCatalog([
      'src/engine/primitives/barnCache.ts',
      'src/features/rabbit-export/exporter.ts',
    ]);
    const violations = verifyNoContentNamesInCoreModules(badCatalog);
    expect(violations).toHaveLength(2);
    expect(violations[0]).toContain('barnCache.ts');
    expect(violations[1]).toContain('rabbit');
  });
});
