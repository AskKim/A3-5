#!/usr/bin/env node
// prompts/preflight/scripts/preflight-run-context.mjs — Zero-dependency preflight context & readiness inspector
// Last Updated: 2026-11-27T08:32:00-08:00

import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};

const branchArg = getArg('--branch');
const versionArg = getArg('--version');
const dryRun = args.includes('--dry-run');

function readJsonSafe(relPath) {
  const abs = path.resolve(relPath);
  if (!existsSync(abs)) return { ok: false, exists: false, data: null, error: 'missing' };
  try {
    return { ok: true, exists: true, data: JSON.parse(readFileSync(abs, 'utf8')), error: null };
  } catch (err) {
    return {
      ok: false,
      exists: true,
      data: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

let gitHead = 'sandbox-uncommitted';
let gitAvailable = false;
try {
  gitHead = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  gitAvailable = Boolean(gitHead);
} catch {
  gitAvailable = false;
}

const pkg = readJsonSafe('package.json');
const config = readJsonSafe('prompts/preflight/preflight.config.json');
const manifest = readJsonSafe('prompts/preflight/manifest/preflight.manifest.json');
const schema = readJsonSafe('prompts/preflight/handoff-state.schema.json');
const state = readJsonSafe('docs/handoff-state.json');

const validationErrors = [];
for (const [label, res] of [
  ['prompts/preflight/preflight.config.json', config],
  ['prompts/preflight/manifest/preflight.manifest.json', manifest],
  ['prompts/preflight/handoff-state.schema.json', schema],
]) {
  if (!res.ok) {
    validationErrors.push(`${label}: ${res.error}`);
  }
}

const summary = {
  ok: validationErrors.length === 0,
  dry_run: dryRun,
  environment: gitAvailable ? 'local-cli' : 'sandbox',
  git_available: gitAvailable,
  head_sha: gitHead,
  branch: branchArg ?? state.data?.active_branch ?? 'unknown',
  target_version: versionArg ?? state.data?.target_version ?? pkg.data?.version ?? 'unknown',
  handoff_state_present: state.exists,
  ai_studio_status: state.data?.ai_studio_status ?? 'pending',
  antigravity_status: state.data?.antigravity_status ?? 'pending',
  resume_cursor: state.data?.resume_cursor ?? null,
  manifest_steps: Array.isArray(manifest.data?.steps) ? manifest.data.steps.length : 0,
  validation_errors: validationErrors,
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) {
  process.exit(1);
}
