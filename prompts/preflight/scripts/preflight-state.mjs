#!/usr/bin/env node
// prompts/preflight/scripts/preflight-state.mjs — Schema v2 state evaluator, freshness check & Phase A-scope hashing
// Last Updated: 2026-11-28T08:30:00-08:00
//
// Usage:
//   node prompts/preflight/scripts/preflight-state.mjs [--branch <name>] [--version <tag>]
//   node prompts/preflight/scripts/preflight-state.mjs --write-hash
//
// Prints one JSON object to stdout. Exit 0 = state readable and Phase A acceptable for Phase B,
// exit 1 = missing/invalid state or a hard stop (stale, delta, branch/version mismatch).

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const STATE_PATH = 'docs/handoff-state.json';
const CONFIG_PATH = 'prompts/preflight/preflight.config.json';
const MANIFEST_PATH = 'prompts/preflight/manifest/preflight.manifest.json';
const ANCHOR_FILE = 'CHANGELOG.md';
const DEFAULT_SCOPE = ['src/', 'public/', 'index.html', 'package.json', 'manifest*'];
const DEFAULT_STALE_HOURS = 24;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

const PHASE_A_STEPS = new Set([
  'seed-handshake',
  'ai-baseline',
  'a11y-setup',
  'crawl-setup',
  'a11y-check',
  'crawl-guide',
  'release-check-p1',
  'ver-update',
]);

const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};

function readJsonSafe(path) {
  if (!existsSync(path)) return { ok: false, error: 'missing', data: null };
  try {
    return { ok: true, error: null, data: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (err) {
    return { ok: false, error: `invalid JSON: ${err instanceof Error ? err.message : String(err)}`, data: null };
  }
}

function git(argv) {
  try {
    return execFileSync('git', argv, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function validateState(state) {
  const errors = [];
  if (!state || typeof state !== 'object') return ['state is not an object'];
  const required = [
    'schema_version',
    'active_branch',
    'target_version',
    'resume_cursor',
    'phase_a_scope_hash',
    'ai_studio_status',
    'ai_studio_completed_at',
    'ai_studio_commit_sha',
    'improvement_log_anchor',
    'antigravity_status',
    'antigravity_completed_at',
    'history',
    'last_error',
  ];
  for (const key of required) {
    if (!(key in state)) errors.push(`missing required field: ${key}`);
  }
  if (state.schema_version !== 2) errors.push(`schema_version must be 2, found ${String(state.schema_version)}`);
  for (const key of ['ai_studio_status', 'antigravity_status']) {
    if (key in state && !['pending', 'in_progress', 'completed'].includes(state[key])) {
      errors.push(`${key} must be pending|in_progress|completed`);
    }
  }
  for (const key of ['ai_studio_completed_at', 'antigravity_completed_at']) {
    const value = state[key];
    if (value !== null && value !== undefined && !ISO_UTC.test(String(value))) {
      errors.push(`${key} must be UTC ISO-8601 (YYYY-MM-DDTHH:MM:SSZ) or null`);
    }
  }
  if (!Array.isArray(state.history)) errors.push('history must be an array');
  return errors;
}

function phaseAStatus(headSha) {
  const tree = git(['ls-tree', '-r', 'HEAD']);
  if (tree === null) return null;
  const lines = tree
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [meta, filePath] = line.split('\t');
      const sha = meta.split(/\s+/)[2] ?? '';
      return `${sha} ${filePath}`;
    })
    .sort();
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

function changedPathsInScope(baseSha, scope) {
  if (!baseSha || baseSha === 'sandbox-uncommitted') return null;
  const out = git(['diff', '--name-only', `${baseSha}..HEAD`, '--', ...scope]);
  if (out === null) return null;
  return out ? out.split('\n').filter(Boolean) : [];
}

function anchorSummary(file) {
  if (!existsSync(file)) return null;
  const lines = readFileSync(file, 'utf8').split('\n');
  const heading = lines.find((line) => /^#{1,2}\s+/.test(line));
  return { file, top_heading: heading ? heading.trim() : '', line_count: lines.length };
}

const stateResult = readJsonSafe(STATE_PATH);
const configResult = readJsonSafe(CONFIG_PATH);
const manifestResult = readJsonSafe(MANIFEST_PATH);

if (!stateResult.ok) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        state_present: existsSync(STATE_PATH),
        error: `${STATE_PATH}: ${stateResult.error}`,
        next_action: 'Run the seed-handshake step to create the Schema v2 state file.',
      },
      null,
      2
    )
  );
  process.exit(1);
}

const state = stateResult.data;
const config = configResult.ok && configResult.data ? configResult.data : {};
const manifestSteps = Array.isArray(manifestResult.data?.steps) ? manifestResult.data.steps : [];
const scope = Array.isArray(config.phase_a_scope_paths) && config.phase_a_scope_paths.length
  ? config.phase_a_scope_paths
  : DEFAULT_SCOPE;
const staleHours = Number.isFinite(Number(config.stale_hours)) ? Number(config.stale_hours) : DEFAULT_STALE_HOURS;

const validationErrors = validateState(state);
const gitAvailable = git(['rev-parse', 'HEAD']) !== null;
const headSha = git(['rev-parse', 'HEAD']) ?? 'sandbox-uncommitted';
const branchArg = getArg('--branch');
const versionArg = getArg('--version');

if (args.includes('--write-hash')) {
  const hash = phaseAStatus(headSha);
  if (!hash) {
    console.log(JSON.stringify({ ok: false, error: 'git unavailable; cannot compute phase_a_scope_hash' }, null, 2));
    process.exit(1);
  }
  state.phase_a_scope_hash = hash;
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(`${STATE_PATH}.tmp`, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  renameSync(`${STATE_PATH}.tmp`, STATE_PATH);
  console.log(JSON.stringify({ ok: true, wrote: 'phase_a_scope_hash', hash, head_sha: headSha }, null, 2));
  process.exit(0);
}

const completedAt = state.ai_studio_completed_at;
const elapsedHours = completedAt ? (Date.now() - Date.parse(completedAt)) / 3_600_000 : null;
const delta = changedPathsInScope(state.ai_studio_commit_sha, scope);
const currentAnchor = anchorSummary(ANCHOR_FILE);
const storedAnchor = state.improvement_log_anchor ?? null;

const reasons = [];
if (validationErrors.length > 0) reasons.push('state_invalid');
if (state.ai_studio_status !== 'completed') reasons.push('phase_a_incomplete');
if (elapsedHours === null) reasons.push('phase_a_timestamp_missing');
else if (elapsedHours > staleHours) reasons.push('phase_a_stale');
if (Array.isArray(delta) && delta.length > 0) reasons.push('phase_a_scope_delta');
if (branchArg && branchArg !== state.active_branch) reasons.push('branch_mismatch');
if (versionArg && versionArg !== state.target_version) reasons.push('version_mismatch');
if (
  storedAnchor &&
  currentAnchor &&
  (storedAnchor.top_heading !== currentAnchor.top_heading || storedAnchor.line_count !== currentAnchor.line_count)
) {
  reasons.push('improvement_log_anchor_changed');
}

const completedForRun = new Set(
  (Array.isArray(state.history) ? state.history : [])
    .filter(
      (entry) =>
        entry &&
        entry.status === 'completed' &&
        entry.branch === state.active_branch &&
        entry.version === state.target_version &&
        (entry.head_sha === headSha || entry.head_sha === 'sandbox-uncommitted')
    )
    .map((entry) => entry.step_id)
);

const nextStep = manifestSteps.find((step) => !completedForRun.has(step.id));

const summary = {
  ok: reasons.length === 0,
  state_present: true,
  git_available: gitAvailable,
  head_sha: headSha,
  active_branch: state.active_branch,
  target_version: state.target_version,
  ai_studio_status: state.ai_studio_status,
  antigravity_status: state.antigravity_status,
  ai_studio_completed_at: completedAt ?? null,
  elapsed_hours: elapsedHours === null ? null : Number(elapsedHours.toFixed(2)),
  stale_hours: staleHours,
  phase_a_scope_hash: state.phase_a_scope_hash ?? null,
  phase_a_scope_delta: delta,
  improvement_log_anchor: currentAnchor,
  resume_cursor: state.resume_cursor ?? null,
  resume_step_id: nextStep ? nextStep.id : null,
  resume_phase: nextStep ? (PHASE_A_STEPS.has(nextStep.id) ? 'A' : 'B') : null,
  last_error: state.last_error ?? null,
  validation_errors: validationErrors,
  blocked_reasons: reasons,
  next_action: nextStep
    ? `Run step ${nextStep.id} (${nextStep.file}).`
    : reasons.length === 0
      ? 'All manifest steps completed for this branch, version and HEAD; proceed to release-plan sign-off.'
      : 'Resolve blocked_reasons, run --write-hash after copying sandbox edits, then resume.',
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) process.exit(1);
