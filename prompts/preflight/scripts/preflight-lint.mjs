#!/usr/bin/env node
// prompts/preflight/scripts/preflight-lint.mjs — Zero-dependency preflight integrity, mate-link & prefix linter
// Last Updated: 2026-11-27T08:32:00-08:00

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root = 'prompts/preflight';
const runDir = join(root, 'run-uni');
const readDir = join(runDir, 'read');
const cleanTemplate = join(root, 'templates', 'pf-launcher-uni-clean.md');
const launcher = join(root, 'pf-launcher-uni.md');
const checkPrefix = process.argv.includes('--check-prefix');
const MAX_FILE_SIZE = 262144; // 256 KB
const errors = [];

const forbidden = [
  /PF-launcher\.md/,
  /run-uni\/docs\//,
  /run-uni\/tokens\.md/,
  /run-uni\/wiring\.md/,
  /\[ONE-TIME-SETUP\]/,
  /\[PER-RELEASE SINGLE-USE\]/,
  /master_launcher_clean\.md/,
];

const allFiles = [];
function walk(dir) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.name !== e.name.toLowerCase()) errors.push(`Uppercase name: ${full}`);
    if (e.isDirectory()) walk(full);
    else allFiles.push(full);
  }
}

walk(root);

for (const f of allFiles) {
  if (statSync(f).size > MAX_FILE_SIZE) continue;
  if (f.endsWith('.json')) {
    try {
      JSON.parse(readFileSync(f, 'utf8'));
    } catch (err) {
      errors.push(`Invalid JSON in ${f}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (f.endsWith('.md') && !f.includes('feedback')) {
    const txt = readFileSync(f, 'utf8');
    for (const rx of forbidden) {
      if (rx.test(txt)) errors.push(`Forbidden legacy pattern ${rx} in ${f}`);
    }
  }
}

if (existsSync(launcher) && statSync(launcher).size <= MAX_FILE_SIZE) {
  const lTxt = readFileSync(launcher, 'utf8');
  const cStart = lTxt.indexOf('=== CONSTRAINTS ===');
  const cEnd = lTxt.indexOf('===================', cStart);
  const cBlock = cStart !== -1 && cEnd !== -1 ? lTxt.slice(cStart, cEnd) : lTxt;
  const matches = cBlock.match(/^(\d+)\./gm) || [];
  const seen = new Set();
  for (const m of matches) {
    if (seen.has(m)) errors.push(`Duplicate constraint numbering in ${launcher}: ${m}`);
    seen.add(m);
  }
}

if (existsSync(runDir) && existsSync(readDir)) {
  const prompts = readdirSync(runDir).filter((f) => f.endsWith('.md'));
  const readmes = readdirSync(readDir).filter((f) => f.endsWith('-readme.md'));
  const promptSet = new Set(prompts);
  const readmeSet = new Set(readmes);
  for (const file of prompts) {
    const mate = file.replace(/\.md$/, '-readme.md');
    if (!readmeSet.has(mate)) {
      errors.push(`Missing mate readme for ${file}: expected ${mate}`);
      continue;
    }
    const pPath = join(runDir, file);
    const rPath = join(readDir, mate);
    if (statSync(pPath).size <= MAX_FILE_SIZE && statSync(rPath).size <= MAX_FILE_SIZE) {
      const pTxt = readFileSync(pPath, 'utf8');
      const rTxt = readFileSync(rPath, 'utf8');
      if (!pTxt.includes(`prompts/preflight/run-uni/read/${mate}`)) {
        errors.push(`Missing mate link in ${file} -> ${mate}`);
      }
      if (!rTxt.includes(`prompts/preflight/run-uni/${file}`)) {
        errors.push(`Missing mate link in ${mate} -> ${file}`);
      }
    }
  }
  for (const r of readmes) {
    const mate = r.replace(/-readme\.md$/, '.md');
    if (!promptSet.has(mate)) errors.push(`Orphaned readme with no prompt mate: ${r}`);
  }
}

const rcPath = join(runDir, 'release-check.md');
if (existsSync(rcPath) && statSync(rcPath).size <= MAX_FILE_SIZE) {
  const rc = readFileSync(rcPath, 'utf8');
  for (const tag of [
    '<!-- PHASE_A_START -->',
    '<!-- PHASE_A_END -->',
    '<!-- PHASE_B_START -->',
    '<!-- PHASE_B_END -->',
  ]) {
    if (!rc.includes(tag)) errors.push(`Missing anchor ${tag} in release-check.md`);
  }
}

if (existsSync(cleanTemplate) && statSync(cleanTemplate).size <= MAX_FILE_SIZE) {
  const ct = readFileSync(cleanTemplate, 'utf8');
  // Only an applied marker (a step line already retired) belongs in the check; the marker format
  // itself appears in every launcher's static AGENT_EXCLUSION_PROTOCOL block, prefix-hashed and
  // therefore required in the pristine template too.
  const appliedRetirement = /^\s*-\s*\[SINGLE-USE-COMPLETED:/m;
  if (appliedRetirement.test(ct)) {
    errors.push('Pristine template contains retired SINGLE-USE-COMPLETED marker');
  }
}

if (checkPrefix && existsSync(launcher) && existsSync(cleanTemplate)) {
  const getPrefix = (p) => {
    if (statSync(p).size > MAX_FILE_SIZE) return '';
    const t = readFileSync(p, 'utf8');
    const idx = t.indexOf('===================');
    return idx === -1
      ? ''
      : createHash('sha256').update(t.slice(t.indexOf('# Reusable Modular'), idx)).digest('hex');
  };
  if (getPrefix(launcher) !== getPrefix(cleanTemplate)) {
    errors.push(
      'Prompt-cache prefix mismatch between pf-launcher-uni.md and templates/pf-launcher-uni-clean.md'
    );
  }
}

// Privacy/path-leak check for docs/handoff-state.json
const handoffPath = join('docs', 'handoff-state.json');
if (existsSync(handoffPath) && statSync(handoffPath).size <= MAX_FILE_SIZE) {
  try {
    const state = JSON.parse(readFileSync(handoffPath, 'utf8'));
    const leakPattern = /\/Users\/|\/home\/|C:\\Users\\/;
    if (state.last_error && leakPattern.test(state.last_error)) {
      errors.push('Local path leak detected in docs/handoff-state.json last_error');
    }
    if (Array.isArray(state.history)) {
      for (let i = 0; i < state.history.length; i++) {
        if (state.history[i]?.error && leakPattern.test(state.history[i].error)) {
          errors.push(`Local path leak detected in docs/handoff-state.json history[${i}].error`);
        }
      }
    }
  } catch (err) {
    errors.push(`Invalid JSON in ${handoffPath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Manifest integrity: every scheduled step must have a prompt file and a mate readme on disk.
// These are hard failures on purpose - a manifest pointing at a file nobody has is exactly how
// this scaffolding rotted silently before (14 of 16 steps had no prompt file while lint said OK).
const manifestPath = join(root, 'manifest', 'preflight.manifest.json');
if (!existsSync(manifestPath)) {
  errors.push(`Missing ${manifestPath}`);
} else if (statSync(manifestPath).size <= MAX_FILE_SIZE) {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const steps = Array.isArray(manifest.steps) ? manifest.steps : [];
    if (steps.length === 0) errors.push(`No steps declared in ${manifestPath}`);
    const seenIds = new Set();
    for (const step of steps) {
      if (!step || typeof step.id !== 'string' || typeof step.file !== 'string') {
        errors.push(`Manifest entry without string id/file in ${manifestPath}: ${JSON.stringify(step)}`);
        continue;
      }
      if (seenIds.has(step.id)) errors.push(`Duplicate manifest step id: ${step.id}`);
      seenIds.add(step.id);
      const stepPath = join(root, step.file);
      if (!existsSync(stepPath)) {
        errors.push(`Manifest step "${step.id}" points at missing prompt file ${stepPath}`);
        continue;
      }
      const mateName = step.file.split('/').pop().replace(/\.md$/, '-readme.md');
      const matePath = join(readDir, mateName);
      if (!existsSync(matePath)) {
        errors.push(`Manifest step "${step.id}" is missing mate readme ${matePath}`);
      }
    }
  } catch (err) {
    errors.push(`Invalid JSON in ${manifestPath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Static config must be filled in before a run: an angle-bracket placeholder is not a value.
const configPath = join(root, 'preflight.config.json');
if (!existsSync(configPath)) {
  errors.push(`Missing ${configPath}`);
} else if (statSync(configPath).size <= MAX_FILE_SIZE) {
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const placeholders = [];
    const scanValues = (value, keyPath) => {
      if (typeof value === 'string') {
        if (/<[A-Za-z][^<>]*>/.test(value)) placeholders.push(`${keyPath}=${value}`);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item, idx) => scanValues(item, `${keyPath}[${idx}]`));
        return;
      }
      if (value && typeof value === 'object') {
        for (const [key, inner] of Object.entries(value)) {
          if (key === '_comment') continue;
          scanValues(inner, `${keyPath}.${key}`);
        }
      }
    };
    for (const [key, value] of Object.entries(config)) {
      if (key === '_comment') continue;
      scanValues(value, key);
    }
    if (placeholders.length > 0) {
      errors.push(`preflight.config.json still holds placeholder values: ${placeholders.join(', ')}`);
    }
  } catch (err) {
    errors.push(`Invalid JSON in ${configPath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (errors.length > 0) {
  console.error(`PREFLIGHT_LINT_FAILED (${errors.length} issues):`);
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log(
  'PREFLIGHT_LINT_OK: lowercase names, 1-to-1 mate links, JSON schemas, anchors, and clean paths verified.'
);