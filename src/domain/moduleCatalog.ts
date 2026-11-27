/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Pure TypeScript Module Classification & Split Catalog (`src/domain/moduleCatalog.ts`).
 *
 * Purpose:
 *   Provides a deterministic classifier and formatter that splits all non-test source modules
 *   into two clear groups:
 *   1. Core / Foundation / Non-Content-Specific Modules (`src/engine/`, `src/features/`, `src/utils/`)
 *   2. Content-Specific Modules (`src/domain/`, `src/app/`, `src/storage/`, `src/native/`,
 *      `src/hooks/`, `src/components/`, and app entry files)
 *
 *   Also exposes `verifyNoContentNamesInCoreModules()` so CI checks can verify no core/feature/util
 *   filename embeds content-specific terminology (e.g., `barn`, `pedigree`, `animal`, `rabbit`).
 *
 * CROSS-PLATFORM MIGRATION GUARDRAIL:
 *   100% pure TypeScript with zero browser DOM (`window`, `document`) or Node (`fs`, `path`) imports.
 *   Filesystem walking and CLI reporting live in `scripts/list-modules.ts`.
 */

import { nowIsoUtc } from './models';

export type ModulePrimaryBucket = 'core-non-content' | 'content-specific';

export type ModuleSubCategory =
  | 'core-foundation'
  | 'non-content-feature'
  | 'reusable-utility'
  | 'domain-engine'
  | 'app-wiring'
  | 'storage-adapter'
  | 'native-wrapper'
  | 'state-hook'
  | 'ui-component'
  | 'app-entry';

export interface ModuleClassificationEntry {
  path: string;
  name: string;
  bucket: ModulePrimaryBucket;
  subCategory: ModuleSubCategory;
  layerDir: string;
  extractable: boolean;
  summary: string;
}

export interface ModuleCatalogReport {
  generatedAtIso: string;
  totalModules: number;
  coreNonContentCount: number;
  contentSpecificCount: number;
  coreNonContentModules: ModuleClassificationEntry[];
  contentSpecificModules: ModuleClassificationEntry[];
  subCategoryCounts: Record<ModuleSubCategory, number>;
}

export const MODULE_SUBCATEGORY_LABELS: Record<ModuleSubCategory, string> = {
  'core-foundation': 'Core Engine / Foundation (`src/engine/`, `@engine/*`)',
  'non-content-feature': 'Non-Content-Specific Feature Modules (`src/features/`, `@features/*`)',
  'reusable-utility': 'Reusable Content-Free UI & Runtime Utilities (`src/utils/`)',
  'domain-engine': 'Domain Engines & Compatibility Facades (`src/domain/`)',
  'app-wiring': 'Application Composition & Configs (`src/app/`, `@app/*`)',
  'storage-adapter': 'Content-Bound Storage Adapters & Workers (`src/storage/`)',
  'native-wrapper': 'Content-Specific Native Shell Bridge (`src/native/`)',
  'state-hook': 'Content-Specific State Controller Hook (`src/hooks/`)',
  'ui-component': 'Content-Specific UI Screens & Modals (`src/components/`)',
  'app-entry': 'Application Entry & Root Styles (`src/*`)',
};

const CONTENT_FILENAME_TOKEN_REGEX =
  /\b(barn|pedigree|animal|rabbit|herd|breed|breeding|livestock|litter|cage|wool|feed|judge|vet|show|flock|stud|hutch|kindling|tattooing?|eartag)\b/i;

const MODULE_SUMMARY_NOTES: Record<string, string> = {
  'src/hooks/useBarnStore.ts':
    'Content-specific Zustand/React barn state store orchestrating species isolation, breeding chore cascades, and persistence.',
  'src/native/pedigreeBridge.ts':
    'Content-specific native Android/iOS WebView container bridge (`pedigreeNative`), consumed via `@engine/bridge` contracts.',
  'src/app/pedigreeAppWiring.ts':
    'Sole composition root wiring content-agnostic `@engine/*` + `@features/*` to Community Pedigree domain modules.',
};

function normalizeRelPath(rawPath: string): string {
  return rawPath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function fileBasename(relPath: string): string {
  const idx = relPath.lastIndexOf('/');
  return idx >= 0 ? relPath.slice(idx + 1) : relPath;
}

function tokenizeFilename(filename: string): string[] {
  const stem = filename.replace(/\.[^.]+$/, '');
  return stem
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

function defaultSummaryForSubCategory(relPath: string, subCategory: ModuleSubCategory): string {
  if (MODULE_SUMMARY_NOTES[relPath]) {
    return MODULE_SUMMARY_NOTES[relPath];
  }
  switch (subCategory) {
    case 'core-foundation':
      return 'Content-agnostic core primitive, codec, bridge, or storage foundation module.';
    case 'non-content-feature':
      return 'Isolated, content-agnostic reusable feature module (`IFeatureModule` / decoupled service).';
    case 'reusable-utility':
      return 'Content-free browser/React helper or hook extractable alongside core packages.';
    case 'domain-engine':
      return 'Domain-specific business logic, catalog, or Alpha 2 compatibility facade.';
    case 'app-wiring':
      return 'Application-level species/domain configuration or dependency-injection wiring.';
    case 'storage-adapter':
      return 'Legacy Pedigree-bound browser storage, sync, OCR, or worker adapter (Phase 3 target).';
    case 'native-wrapper':
      return 'App-specific native wrapper bridge adapter.';
    case 'state-hook':
      return 'Content-specific application state hook.';
    case 'ui-component':
      return 'Content-specific React screen, panel, or modal component.';
    case 'app-entry':
      return 'Application root entry point or global stylesheet.';
  }
}

/**
 * Classifies a single workspace-relative `src/` module path into its primary bucket
 * (`core-non-content` vs `content-specific`) and architectural sub-category.
 */
export function classifyModulePath(
  rawRelPath: string,
  customSummary?: string
): ModuleClassificationEntry {
  const relPath = normalizeRelPath(rawRelPath);
  const name = fileBasename(relPath);
  const segMatch = /^src\/([^/]+)\//.exec(relPath);
  const layerDir = segMatch ? `src/${segMatch[1]}` : 'src';

  let subCategory: ModuleSubCategory = 'app-entry';
  let bucket: ModulePrimaryBucket = 'content-specific';
  let extractable = false;

  if (relPath.startsWith('src/engine/')) {
    subCategory = 'core-foundation';
    bucket = 'core-non-content';
    extractable = true;
  } else if (relPath.startsWith('src/features/')) {
    subCategory = 'non-content-feature';
    bucket = 'core-non-content';
    extractable = true;
  } else if (relPath.startsWith('src/utils/')) {
    subCategory = 'reusable-utility';
    bucket = 'core-non-content';
    extractable = true;
  } else if (relPath.startsWith('src/domain/')) {
    subCategory = 'domain-engine';
  } else if (relPath.startsWith('src/app/')) {
    subCategory = 'app-wiring';
  } else if (relPath.startsWith('src/storage/')) {
    subCategory = 'storage-adapter';
  } else if (relPath.startsWith('src/native/')) {
    subCategory = 'native-wrapper';
  } else if (relPath.startsWith('src/hooks/')) {
    subCategory = 'state-hook';
  } else if (relPath.startsWith('src/components/')) {
    subCategory = 'ui-component';
  }

  return {
    path: relPath,
    name,
    bucket,
    subCategory,
    layerDir,
    extractable,
    summary: customSummary ?? defaultSummaryForSubCategory(relPath, subCategory),
  };
}

/**
 * Builds a complete split catalog from a list of non-test `src/` file paths.
 */
export function buildModuleCatalog(
  modulePaths: readonly string[],
  customSummaries: Readonly<Record<string, string>> = {},
  generatedAtIso: string = nowIsoUtc()
): ModuleCatalogReport {
  const deduped = Array.from(new Set(modulePaths.map(normalizeRelPath)))
    .filter((p) => p.startsWith('src/'))
    .sort((a, b) => a.localeCompare(b));

  const coreNonContentModules: ModuleClassificationEntry[] = [];
  const contentSpecificModules: ModuleClassificationEntry[] = [];

  const subCategoryCounts: Record<ModuleSubCategory, number> = {
    'core-foundation': 0,
    'non-content-feature': 0,
    'reusable-utility': 0,
    'domain-engine': 0,
    'app-wiring': 0,
    'storage-adapter': 0,
    'native-wrapper': 0,
    'state-hook': 0,
    'ui-component': 0,
    'app-entry': 0,
  };

  for (const relPath of deduped) {
    const entry = classifyModulePath(relPath, customSummaries[relPath]);
    subCategoryCounts[entry.subCategory] += 1;
    if (entry.bucket === 'core-non-content') {
      coreNonContentModules.push(entry);
    } else {
      contentSpecificModules.push(entry);
    }
  }

  return {
    generatedAtIso,
    totalModules: deduped.length,
    coreNonContentCount: coreNonContentModules.length,
    contentSpecificCount: contentSpecificModules.length,
    coreNonContentModules,
    contentSpecificModules,
    subCategoryCounts,
  };
}

/**
 * Verifies that zero modules in the Core / Foundation / Non-Content-Specific bucket
 * have filenames containing content-specific domain tokens.
 */
export function verifyNoContentNamesInCoreModules(catalog: ModuleCatalogReport): string[] {
  const violations: string[] = [];
  for (const mod of catalog.coreNonContentModules) {
    const subpath = mod.path.startsWith(`${mod.layerDir}/`)
      ? mod.path.slice(mod.layerDir.length + 1)
      : mod.name;
    const segments = subpath.split('/');
    const tokens = segments.flatMap((seg, idx) =>
      tokenizeFilename(idx === segments.length - 1 ? seg : `${seg}.ts`)
    );
    const matched = tokens.find((token) => CONTENT_FILENAME_TOKEN_REGEX.test(token));
    if (matched) {
      violations.push(`${mod.path} (content token "${matched}" in ${mod.subCategory})`);
    }
  }
  return violations;
}

function appendSubCategorySection(
  lines: string[],
  modules: readonly ModuleClassificationEntry[],
  order: readonly ModuleSubCategory[]
): void {
  for (const sub of order) {
    const subset = modules.filter((m) => m.subCategory === sub);
    if (subset.length === 0) continue;
    lines.push(`### ${MODULE_SUBCATEGORY_LABELS[sub]} (${subset.length})`);
    lines.push('');
    lines.push('| Module Path | Purpose / Notes |');
    lines.push('| --- | --- |');
    for (const mod of subset) {
      lines.push(`| \`${mod.path}\` | ${mod.summary} |`);
    }
    lines.push('');
  }
}

/**
 * Formats the split module catalog as Markdown (`MODULES.md`).
 */
export function formatModuleCatalogMarkdown(catalog: ModuleCatalogReport): string {
  const corePct =
    catalog.totalModules > 0
      ? ((catalog.coreNonContentCount / catalog.totalModules) * 100).toFixed(1)
      : '0.0';
  const contentPct =
    catalog.totalModules > 0
      ? ((catalog.contentSpecificCount / catalog.totalModules) * 100).toFixed(1)
      : '0.0';

  const lines: string[] = [
    '# Current Modules Split: Core / Foundation / Non-Content-Specific vs. Content-Specific',
    '',
    'Generated dynamically from `src/` via `npm run list:modules` (`src/domain/moduleCatalog.ts`).',
    'Excludes `*.test.ts*` and `__tests__/` files.',
    '',
    '## Summary',
    '',
    `- **Total Non-Test Source Modules:** ${catalog.totalModules}`,
    `- **Core / Foundation / Non-Content-Specific Features & Utilities:** ${catalog.coreNonContentCount} (${corePct}%)`,
    `  - Core Foundation (\`src/engine/\`): ${catalog.subCategoryCounts['core-foundation']}`,
    `  - Non-Content Features (\`src/features/\`): ${catalog.subCategoryCounts['non-content-feature']}`,
    `  - Reusable Utilities (\`src/utils/\`): ${catalog.subCategoryCounts['reusable-utility']}`,
    `- **Content-Specific Modules:** ${catalog.contentSpecificCount} (${contentPct}%)`,
    `  - Domain Engines (\`src/domain/\`): ${catalog.subCategoryCounts['domain-engine']}`,
    `  - App Composition & Configs (\`src/app/\`): ${catalog.subCategoryCounts['app-wiring']}`,
    `  - Storage Adapters & Workers (\`src/storage/\`): ${catalog.subCategoryCounts['storage-adapter']}`,
    `  - Native Bridge (\`src/native/\`): ${catalog.subCategoryCounts['native-wrapper']}`,
    `  - State Store Hook (\`src/hooks/\`): ${catalog.subCategoryCounts['state-hook']}`,
    `  - UI Screens & Modals (\`src/components/\`): ${catalog.subCategoryCounts['ui-component']}`,
    `  - Root Entry & Styles (\`src/\`): ${catalog.subCategoryCounts['app-entry']}`,
    '',
    '```bash',
    '# Print live split module listing',
    'npm run list:modules',
    '',
    '# Regenerate MODULES.md from live src/ directory',
    'npx tsx scripts/list-modules.ts --write',
    '',
    '# Check zero content-named core modules & MODULES.md sync',
    'npx tsx scripts/list-modules.ts --check',
    '```',
    '',
    '---',
    '',
    `## 1. Core / Foundation / Non-Content-Specific Modules (${catalog.coreNonContentCount})`,
    '',
  ];

  appendSubCategorySection(lines, catalog.coreNonContentModules, [
    'core-foundation',
    'non-content-feature',
    'reusable-utility',
  ]);

  lines.push('---');
  lines.push('');
  lines.push(`## 2. Content-Specific Modules (${catalog.contentSpecificCount})`);
  lines.push('');

  appendSubCategorySection(lines, catalog.contentSpecificModules, [
    'domain-engine',
    'app-wiring',
    'storage-adapter',
    'native-wrapper',
    'state-hook',
    'ui-component',
    'app-entry',
  ]);

  return lines.join('\n');
}
