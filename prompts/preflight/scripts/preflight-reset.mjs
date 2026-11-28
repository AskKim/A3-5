#!/usr/bin/env node
// prompts/preflight/scripts/preflight-reset.mjs — Launcher & Schema v2 state reset helper
// Last Updated: 2026-11-28T08:30:00-08:00
//
// Usage:
//   node prompts/preflight/scripts/preflight-reset.mjs --full [--dry-run]
//   node prompts/preflight/scripts/preflight-reset.mjs --init --branch <name> --version <tag>
//   node prompts/preflight/scripts/preflight-reset.mjs --branch <name> --version <tag>
//   node prompts/preflight/scripts/preflight-reset.mjs --clear-error
//   node prompts/preflight/scripts/preflight-reset.mjs --rearm <step_id> [--dry-run]
//
// Branch-local resets preserve history[] and never edit the launcher's AGENT_SKIP_LINE markers.
// --full restores the launcher from the pristine template and deletes the state log.

import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';

const LAUNCHER = 'prompts/preflight/pf-launcher-uni.md';
const TEMPLATE = 'prompts/preflight/templates/pf-launcher-uni-clean.md';
const CONFIG = 'prompts/preflight/preflight.config.json';
const STATE_PATH = 'docs/handoff-state.json';
function rollbackRecordPaths() {
  const paths = [];
  try {
    const gitPath = execFileSync('git', ['rev-parse', '--git-path', 'preflight-rollback.json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (gitPath) paths.push(gitPath);
  } catch {
    // git unavailable; only the temporary location can hold a record.
  }
  paths.push('/tmp/preflight-rollback.json');
  return [...new Set(paths)];
}

const RECORD_CANDIDATES = rollbackRecordPaths();

const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};
const dryRun = args.includes('--dry-run');
const branchArg = getArg('--branch');
const versionArg = getArg('--version');
const rearmId = getArg('--rearm');

const DEFAULT_STATE = {
  schema_version: 2,
  active_branch: 'unknown',
  target_version: 'unknown',
  resume_cursor: null,
  phase_a_scope_hash: null,
  ai_studio_status: 'pending',
  ai_studio_completed_at: null,
  ai_studio_commit_sha: null,
  improvement_log_anchor: null,
  antigravity_status: 'pending',
  antigravity_completed_at: null,
  history: [],
  last_error: null,
};

const RESETTABLE = [
  'resume_cursor',
  'phase_a_scope_hash',
  'ai_studio_completed_at',
  'ai_studio_commit_sha',
  'improvement_log_anchor',
  'antigravity_completed_at',
];
const RESETTABLE_STATUS = ['ai_studio_status', 'antigravity_status'];

function fail(message) {
  console.error(`STEP_BLOCKED: ${message}`);
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readConfigDefaults() {
  if (!existsSync(CONFIG)) return { branch: null, version: null };
  try {
    const config = readJson(CONFIG);
    return {
      branch: typeof config.dev_branch === 'string' && !config.dev_branch.startsWith('<') ? config.dev_branch : null,
      version: null,
    };
  } catch {
    return { branch: null, version: null };
  }
}

function writeState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(`${STATE_PATH}.tmp`, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  renameSync(`${STATE_PATH}.tmp`, STATE_PATH);
}

function clearRollbackRecord() {
  for (const path of RECORD_CANDIDATES) {
    if (existsSync(path)) {
      if (!dryRun) unlinkSync(path);
      console.log(`cleared rollback record: ${path}`);
    }
  }
}

if (args.includes('--full')) {
  if (!existsSync(TEMPLATE)) fail(`${TEMPLATE} is missing; cannot perform a full reset.`);
  const backup = `/tmp/pf-launcher-uni.${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
  if (!dryRun) {
    if (existsSync(LAUNCHER)) copyFileSync(LAUNCHER, backup);
    copyFileSync(TEMPLATE, LAUNCHER);
    if (existsSync(STATE_PATH)) unlinkSync(STATE_PATH);
  }
  clearRollbackRecord();
  console.log(
    JSON.stringify(
      { ok: true, mode: 'full', launcher_restored_from: TEMPLATE, launcher_backup: existsSync(backup) ? backup : null, state_removed: existsSync(STATE_PATH) ? 'pending' : true, dry_run: dryRun },
      null,
      2
    )
  );
  process.exit(0);
}

if (rearmId) {
  if (!existsSync(TEMPLATE)) fail(`${TEMPLATE} is missing; cannot rearm "${rearmId}" from the pristine template.`);
  if (!existsSync(LAUNCHER)) fail(`${LAUNCHER} is missing.`);
  const launcherLines = readFileSync(LAUNCHER, 'utf8').split('\n');
  const templateLines = readFileSync(TEMPLATE, 'utf8').split('\n');
  const matches = (line) => line.includes(`step_id: ${rearmId}`);
  const launcherIndex = launcherLines.findIndex(matches);
  const templateIndex = templateLines.findIndex(matches);
  if (launcherIndex === -1 || templateIndex === -1) fail(`step "${rearmId}" was not found in both launcher and template.`);
  // An active step line mentions the marker inside its "-> Rewrite to ..." instruction, so only an
  // applied marker at the start of the line counts as retired.
  const appliedRetirement = /^\s*-\s*\[SINGLE-USE-COMPLETED:/.test(launcherLines[launcherIndex]);
  if (!appliedRetirement) {
    console.log(JSON.stringify({ ok: true, mode: 'rearm', step_id: rearmId, changed: false, note: 'Step is already active.' }, null, 2));
    process.exit(0);
  }
  launcherLines[launcherIndex] = templateLines[templateIndex];
  if (!dryRun) writeFileSync(LAUNCHER, `${launcherLines.join('\n')}`, 'utf8');
  console.log(
    JSON.stringify({ ok: true, mode: 'rearm', step_id: rearmId, changed: true, restored_line: templateLines[templateIndex].slice(0, 120), dry_run: dryRun }, null, 2)
  );
  process.exit(0);
}

const stateExists = existsSync(STATE_PATH);

if (args.includes('--init')) {
  if (stateExists) fail(`${STATE_PATH} already exists; use --branch/--version for a branch-local reset.`);
  const defaults = readConfigDefaults();
  const state = {
    ...DEFAULT_STATE,
    active_branch: branchArg ?? defaults.branch ?? 'unknown',
    target_version: versionArg ?? defaults.version ?? 'unknown',
  };
  if (!dryRun) writeState(state);
  console.log(JSON.stringify({ ok: true, mode: 'init', path: STATE_PATH, active_branch: state.active_branch, target_version: state.target_version, dry_run: dryRun }, null, 2));
  process.exit(0);
}

if (!stateExists) fail(`${STATE_PATH} is missing; run --init (or the seed-handshake step) first.`);
const state = readJson(STATE_PATH);
state.history = Array.isArray(state.history) ? state.history : [];

if (args.includes('--clear-error')) {
  if (!dryRun) writeState({ ...state, last_error: null });
  console.log(JSON.stringify({ ok: true, mode: 'clear-error', previous: state.last_error ?? null, dry_run: dryRun }, null, 2));
  process.exit(0);
}

if (!branchArg && !versionArg) {
  console.error(
    'Usage: preflight-reset.mjs --full | --init --branch <name> --version <tag> | --branch <name> --version <tag> | --clear-error | --rearm <step_id> [--dry-run]'
  );
  process.exit(1);
}

const defaults = readConfigDefaults();
const nextBranch = branchArg ?? (defaults.branch && defaults.branch !== state.active_branch ? defaults.branch : state.active_branch);
const nextVersion = versionArg ?? state.target_version;
const unchanged = nextBranch === state.active_branch && nextVersion === state.target_version;

if (unchanged) {
  console.log(
    JSON.stringify({ ok: true, mode: 'branch-reset', changed: false, active_branch: nextBranch, target_version: nextVersion, note: 'Branch and version already match; history preserved.' }, null, 2)
  );
  process.exit(0);
}

const next = { ...state, active_branch: nextBranch, target_version: nextVersion };
for (const key of RESETTABLE) next[key] = null;
for (const key of RESETTABLE_STATUS) next[key] = 'pending';
next.last_error = null;
next.schema_version = 2;

if (!dryRun) writeState(next);
console.log(
  JSON.stringify(
    {
      ok: true,
      mode: 'branch-reset',
      changed: true,
      active_branch: next.active_branch,
      target_version: next.target_version,
      history_entries_preserved: next.history.length,
      phase_a_scoped_hash_cleared: true,
      dry_run: dryRun,
    },
    null,
    2
  )
);
