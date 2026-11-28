/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Layer boundary audit (`npm run verify:layers`).
 *
 * Enforces import direction between `src/engine`, `src/features`, `src/domain`, `src/utils`,
 * `src/app` and the rest, plus zero DOM globals in pure engine/feature code.
 * Known legacy violations live in `scripts/layer-allowlist.json` (a ratchet): new violations
 * fail, and allowlist entries that no longer occur must be removed.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const ALLOWLIST_PATH = path.join(ROOT, 'scripts', 'layer-allowlist.json');
/**
 * Burn-down ledger for the UI decoupling milestone: components that still load a storage module at
 * runtime. Unlike the layer allowlist this is not a permanent exemption list — the set may only
 * shrink. A new edge fails the audit; a cleared edge must be pruned in the same change.
 */
const UI_COUPLING_BUDGET_PATH = path.join(ROOT, 'scripts', 'ui-storage-coupling-budget.json');

type Layer =
  | 'engine'
  | 'features'
  | 'domain'
  | 'utils'
  | 'app'
  | 'storage'
  | 'native'
  | 'hooks'
  | 'components'
  | 'root';

const ALIASES: Record<string, string> = {
  '@engine': 'src/engine',
  '@features': 'src/features',
  '@domain': 'src/domain',
  '@app': 'src/app',
};

/** Layers each layer may import from (itself is always allowed). */
const ALLOWED: Record<string, readonly Layer[]> = {
  engine: [],
  features: ['engine'],
  domain: ['engine'],
  utils: ['engine'],
  native: ['engine', 'utils'],
  storage: ['engine', 'domain', 'utils'],
  app: ['engine', 'features', 'domain', 'utils', 'storage', 'native'],
  hooks: ['engine', 'domain', 'utils', 'app', 'storage'],
  components: ['engine', 'features', 'domain', 'utils', 'app', 'storage', 'hooks'],
};

/** Files exempt from DOM-global checks (host-facing adapters). */
const DOM_EXEMPT = /^src\/engine\/(bridge|storage)\//;
const DOM_PATTERN = /\b(window|document|localStorage|sessionStorage|navigator|indexedDB)\.[A-Za-z]/;
const DOMAIN_DOM_EXEMPT = /^src\/domain\/(improvementRegistry|breederShowcase)\.ts$/;
const DOMAIN_DOM_PATTERN = /\b(window|document|localStorage|sessionStorage)\.[A-Za-z]/;

function layerOf(relPath: string): Layer {
  const m = relPath.match(/^src\/([^/]+)/);
  const top = m ? m[1] : '';
  switch (top) {
    case 'engine':
    case 'features':
    case 'domain':
    case 'utils':
    case 'app':
    case 'storage':
    case 'native':
    case 'hooks':
    case 'components':
      return top;
    default:
      return 'root';
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function extractSpecifiers(text: string): string[] {
  const specs: string[] = [];
  // Strip block and line comments first so commented-out examples don't trigger false positives.
  const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  // Match real ES module import/export statements at line starts (single or multi-line).
  const staticRe =
    /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\bfrom\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = staticRe.exec(withoutComments)) !== null) {
    specs.push(match[1]);
  }
  // Match dynamic import('...') calls not immediately preceded by quotes.
  const dynamicRe = /(?:^|[^'"`])\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicRe.exec(withoutComments)) !== null) {
    specs.push(match[1]);
  }
  return specs;
}

/**
 * Import/export statements that load a module at runtime. Bare `import type` statements are erased at
 * compile time, so a component may name a storage type without acquiring a runtime dependency on it.
 */
function extractRuntimeSpecifiers(text: string): string[] {
  const specs: string[] = [];
  const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const staticRe =
    /(?:^|\n)\s*(?:import|export)\s+(?!type\s)(?:[\s\S]*?\bfrom\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = staticRe.exec(withoutComments)) !== null) {
    specs.push(match[1]);
  }
  const dynamicRe = /(?:^|[^'"`])\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicRe.exec(withoutComments)) !== null) {
    specs.push(match[1]);
  }
  return specs;
}

function resolveSpecifier(fromRel: string, spec: string): string | null {
  if (spec.startsWith('.')) {
    return path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
  }
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (spec === alias || spec.startsWith(`${alias}/`)) return spec.replace(alias, target);
  }
  if (spec.startsWith('@/')) return spec.slice(2);
  return null;
}

function featureOf(rel: string): string | null {
  // Root-level contract files (featureModule.interface, index barrel) are shared, not features.
  const m = rel.match(/^src\/features\/([^/]+)\//);
  return m ? m[1] : null;
}

const violations = new Set<string>();
const uiStorageEdges = new Set<string>();

for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const layer = layerOf(rel);
  const text = fs.readFileSync(file, 'utf8');

  // Registry part modules are 85 human-written entries: prose that *mentions* `node:path` or a DOM
  // global is data, not an import or a call. The same exemption the single registry file always had
  // is scoped here to these five data files only — import-direction rules below still apply.
  const isRegistryData = /^src\/domain\/improvements\/(registry-part-\d+|rationales)\.ts$/.test(rel);

  const specs = extractSpecifiers(text);
  for (const spec of specs) {
    if (!isRegistryData && spec.startsWith('node:')) {
      violations.add(`${rel} -> ${spec} [Node built-in forbidden in browser PWA source]`);
    }
  }

  const rules = ALLOWED[layer];
  if (rules) {
    for (const spec of specs) {
      const target = resolveSpecifier(rel, spec);
      if (!target) continue;
      const targetLayer = layerOf(target);
      if (targetLayer !== layer && !rules.includes(targetLayer)) {
        violations.add(`${rel} -> ${target} [${layer} must not import ${targetLayer}]`);
      }
      if (layer === 'features') {
        const from = featureOf(rel);
        const to = /\.[a-z]+$/.test(target) ? featureOf(target) : featureOf(`${target}/`);
        if (from && to && from !== to) {
          violations.add(`${rel} -> ${target} [sibling feature import]`);
        }
      }
    }
  }

  // UI components talk to storage through `src/app` ports (an injected capability with a browser
  // implementation) instead of importing the singleton modules directly. Type-only imports are
  // fine: they are erased and create no runtime dependency.
  if (layer === 'components') {
    for (const spec of extractRuntimeSpecifiers(text)) {
      const target = resolveSpecifier(rel, spec);
      if (!target) continue;
      if (layerOf(target) === 'storage') {
        uiStorageEdges.add(
          `${rel} -> ${target} [components must not import storage singletons; inject an @app port]`
        );
      }
    }
  }

  if ((layer === 'engine' || layer === 'features') && !DOM_EXEMPT.test(rel)) {
    const code = text
      .split('\n')
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join('\n');
    if (DOM_PATTERN.test(code)) violations.add(`${rel} [DOM global in pure ${layer} code]`);
  }
  if (layer === 'domain' && !DOMAIN_DOM_EXEMPT.test(rel) && !isRegistryData) {
    const code = text
      .split('\n')
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join('\n');
    if (DOMAIN_DOM_PATTERN.test(code)) violations.add(`${rel} [DOM global in pure domain code]`);
  }
}

const allowlist = new Set<string>(
  fs.existsSync(ALLOWLIST_PATH) ? (JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8')) as string[]) : []
);

if (process.argv.includes('--write-allowlist')) {
  fs.writeFileSync(ALLOWLIST_PATH, `${JSON.stringify([...violations].sort(), null, 2)}\n`);
  console.log(`[verify:layers] Wrote ${violations.size} allowlisted violations.`);
  process.exit(0);
}

if (process.argv.includes('--write-ui-budget')) {
  fs.writeFileSync(
    UI_COUPLING_BUDGET_PATH,
    `${JSON.stringify([...uiStorageEdges].sort(), null, 2)}\n`
  );
  console.log(`[verify:layers] Wrote ${uiStorageEdges.size} component→storage coupling edge(s).`);
  process.exit(0);
}

const couplingBudget = new Set<string>(
  fs.existsSync(UI_COUPLING_BUDGET_PATH)
    ? (JSON.parse(fs.readFileSync(UI_COUPLING_BUDGET_PATH, 'utf8')) as string[])
    : []
);
const couplingGrowth = [...uiStorageEdges].filter((v) => !couplingBudget.has(v)).sort();
const couplingCleared = [...couplingBudget].filter((v) => !uiStorageEdges.has(v)).sort();

if (couplingGrowth.length > 0) {
  console.error(
    `[verify:layers] FAIL — ${couplingGrowth.length} new component→storage coupling(s); add an @app port instead:`
  );
  for (const v of couplingGrowth) console.error(`  + ${v}`);
}
if (couplingCleared.length > 0) {
  console.error(
    `[verify:layers] FAIL — ${couplingCleared.length} burn-down edge(s) cleared; prune scripts/ui-storage-coupling-budget.json (--write-ui-budget):`
  );
  for (const v of couplingCleared) console.error(`  - ${v}`);
}
if (couplingGrowth.length > 0 || couplingCleared.length > 0) process.exit(1);

const fresh = [...violations].filter((v) => !allowlist.has(v)).sort();
const stale = [...allowlist].filter((v) => !violations.has(v)).sort();

if (fresh.length > 0) {
  console.error(`[verify:layers] FAIL — ${fresh.length} new layer violation(s):`);
  for (const v of fresh) console.error(`  + ${v}`);
}
if (stale.length > 0) {
  console.error(`[verify:layers] FAIL — ${stale.length} stale allowlist entr(ies); remove them:`);
  for (const v of stale) console.error(`  - ${v}`);
}
if (fresh.length > 0 || stale.length > 0) process.exit(1);

console.log(
  `[verify:layers] PASS — ${violations.size} allowlisted legacy violation(s), 0 new; component→storage coupling ${uiStorageEdges.size}/${couplingBudget.size} (burn-down only).`
);
