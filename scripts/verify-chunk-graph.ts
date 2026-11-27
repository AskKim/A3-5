/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Build-output chunk graph check (`npm run verify:chunks`).
 *
 * Two chunks that import each other leave one side undefined at initialisation. Dev never shows
 * it — Vite serves modules individually — and the registry split shipped exactly this bug once
 * (parts chunk <-> facade chunk, "not iterable" the moment the improvements panel opened).
 *
 * Cycles that already exist in the bundle graph are frozen in `scripts/chunk-cycle-allowlist.json`
 * (a ratchet, same idea as `layer-allowlist.json`): new cycles fail, and entries that no longer
 * occur must be removed. Keys use chunk base names, so a content hash change does not churn them.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ASSETS = path.join(ROOT, 'dist', 'assets');
const ALLOWLIST = path.join(ROOT, 'scripts', 'chunk-cycle-allowlist.json');

if (!fs.existsSync(ASSETS)) {
  console.error('[verify:chunks] FAIL — no dist/assets. Run `npm run build` first.');
  process.exit(1);
}

const files = fs
  .readdirSync(ASSETS)
  .filter((f) => f.endsWith('.js'))
  .sort();

/** Warn (never fail) when the bundles predate the source they came from: a stale dist proves nothing. */
const newestMtime = (dir: string) => {
  let newest = 0;
  for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    newest = Math.max(newest, fs.statSync(path.join(entry.parentPath, entry.name)).mtimeMs);
  }
  return newest;
};
if (newestMtime(ASSETS) < newestMtime(path.join(ROOT, 'src'))) {
  console.warn('[verify:chunks] WARNING — dist/assets is older than src/; rebuild before trusting this result.');
}

/** Static `import ... from './x.js'` and side-effect `import './x.js'`. Dynamic `import()` is lazy by design. */
const STATIC_IMPORT_RE = /\bimport\s*(?:[\w*{}\s,$]+?\s*from\s*)?["'](\.\/[^"']+\.js)["']/g;

const baseName = (file: string) => file.replace(/-[A-Za-z0-9_-]{8}\.js$/, '');

const edges = new Map<string, string[]>();
for (const file of files) {
  const text = fs.readFileSync(path.join(ASSETS, file), 'utf8');
  const targets = new Set<string>();
  for (const match of text.matchAll(STATIC_IMPORT_RE)) targets.add(path.basename(match[1]));
  edges.set(file, [...targets].filter((t) => files.includes(t)));
}

const cycles: string[][] = [];
const state = new Map<string, 'visiting' | 'done'>();

for (const start of files) {
  if (state.get(start)) continue;
  const stack: Array<{ node: string; next: number }> = [{ node: start, next: 0 }];
  const trail: string[] = [start];
  state.set(start, 'visiting');

  while (stack.length) {
    const frame = stack[stack.length - 1];
    const neighbours = edges.get(frame.node) ?? [];
    if (frame.next >= neighbours.length) {
      state.set(frame.node, 'done');
      stack.pop();
      trail.pop();
      continue;
    }
    const target = neighbours[frame.next];
    frame.next += 1;
    const seen = state.get(target);
    if (seen === 'visiting') {
      const at = trail.indexOf(target);
      cycles.push([...trail.slice(at === -1 ? 0 : at), target]);
      continue;
    }
    if (seen === 'done') continue;
    state.set(target, 'visiting');
    trail.push(target);
    stack.push({ node: target, next: 0 });
  }
}

/** Order-independent key: the set of chunk names involved, hashes stripped. */
const keyOf = (cycle: string[]) =>
  [...new Set(cycle.map(baseName))].sort().join(' <-> ');

const found = new Map<string, string[]>();
for (const cycle of cycles) found.set(keyOf(cycle), cycle);

const edgeCount = [...edges.values()].reduce((sum, list) => sum + list.length, 0);
console.log(
  `[verify:chunks] ${files.length} chunks, ${edgeCount} static edges, ${found.size} distinct cycle(s)`
);

if (process.argv.includes('--write-allowlist')) {
  fs.writeFileSync(ALLOWLIST, `${JSON.stringify([...found.keys()].sort(), null, 2)}\n`);
  console.log(`[verify:chunks] Wrote ${found.size} baseline cycle(s) to scripts/chunk-cycle-allowlist.json`);
  process.exit(0);
}

const allowlist = new Set<string>(
  fs.existsSync(ALLOWLIST) ? (JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8')) as string[]) : []
);

const fresh = [...found.keys()].filter((key) => !allowlist.has(key)).sort();
const stale = [...allowlist].filter((key) => !found.has(key)).sort();

if (fresh.length > 0) {
  console.error(`[verify:chunks] FAIL — ${fresh.length} new circular static chunk import(s):`);
  for (const key of fresh) {
    console.error(`  + ${key}`);
    console.error(`    path: ${(found.get(key) ?? []).join(' -> ')}`);
  }
  console.error(
    '[verify:chunks] Group the cycle members into one chunk (see the `improvement-registry` group in vite.config.ts) rather than allowlisting it.'
  );
}
if (stale.length > 0) {
  console.error(`[verify:chunks] FAIL — ${stale.length} stale allowlist entr(ies); remove them:`);
  for (const key of stale) console.error(`  - ${key}`);
}
if (fresh.length > 0 || stale.length > 0) process.exit(1);

console.log('[verify:chunks] PASS — no new circular chunk imports.');
