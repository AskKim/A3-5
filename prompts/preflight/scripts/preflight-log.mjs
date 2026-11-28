#!/usr/bin/env node
// prompts/preflight/scripts/preflight-log.mjs — Atomic Schema v2 state writer with lockfile guard
// Last Updated: 2026-11-28T09:50:00-08:00

import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  statSync,
} from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};

const stepId = getArg('--step');
const status = getArg('--status') ?? 'completed';
// No default: guessing the runner is how a Freebuff run used to be filed as `antigravity`.
const PLATFORMS = ['ai-studio', 'antigravity', 'freebuff'];
const platform = getArg('--platform');
const filesCsv = getArg('--files') ?? '';
// Gates this step could not run (no shell, no toolchain) are recorded, not forgotten: Phase B's
// ci-guide reads them back out of history and runs them where a shell exists.
const deferredCsv = getArg('--deferred-gates') ?? '';
const errorMsg = getArg('--error');

const cleanError = errorMsg
  ? errorMsg.replace(/(\/Users\/|\/home\/|[A-Za-z]:\\Users\\)[^\s"'`]+/g, '<local-path>')
  : null;
const nextStep = getArg('--next');
// Phase comes from the manifest, never from a platform guess: freebuff legitimately runs both.
function manifestPhase(id) {
  try {
    const manifest = JSON.parse(readFileSync('prompts/preflight/manifest/preflight.manifest.json', 'utf8'));
    return manifest.steps?.find((step) => step.id === id)?.phase ?? null;
  } catch {
    return null;
  }
}
const phase = getArg('--phase') ?? manifestPhase(stepId);

if (!stepId || !['completed', 'failed', 'skipped'].includes(status) || !PLATFORMS.includes(platform)) {
  console.error(
    'Usage: node prompts/preflight/scripts/preflight-log.mjs --step <id> --status completed|failed|skipped --platform ai-studio|antigravity|freebuff [--files a,b] [--error "<msg>"] [--next <id>] [--deferred-gates verify:layers,npm-test]'
  );
  process.exit(1);
}

const statePath = 'docs/handoff-state.json';
const lockPath = 'docs/.handoff.lock';
mkdirSync(dirname(statePath), { recursive: true });

if (existsSync(lockPath)) {
  const ageMs = Date.now() - statSync(lockPath).mtimeMs;
  if (ageMs < 60_000) {
    console.error('STEP_BLOCKED: Concurrent session lock active at docs/.handoff.lock.');
    process.exit(1);
  }
  unlinkSync(lockPath);
}

writeFileSync(lockPath, String(process.pid), 'utf8');
try {
  let head = 'sandbox-uncommitted';
  try {
    head = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // Ignore when git is unavailable
  }
  const nowUtc = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const touched = filesCsv
    ? filesCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const state = existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, 'utf8'))
    : {
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

  const entry = {
    step_id: stepId,
    branch: state.active_branch,
    version: state.target_version,
    head_sha: head,
    platform,
    status,
    completed_at: nowUtc,
    touched_files: touched,
  };

  if (cleanError) entry.error = cleanError;
  if (deferredCsv) {
    entry.deferred_gates = deferredCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  state.history = Array.isArray(state.history) ? state.history : [];
  state.history.push(entry);

  state.last_error = status === 'failed' ? (cleanError ?? `Step ${stepId} failed`) : null;
  if (nextStep) state.resume_cursor = { phase, next_step_id: nextStep };

  writeFileSync(`${statePath}.tmp`, JSON.stringify(state, null, 2) + '\n', 'utf8');
  renameSync(`${statePath}.tmp`, statePath);
  console.log(`OK [${stepId}] status=${status} files=${touched.length}`);
} finally {
  if (existsSync(lockPath)) unlinkSync(lockPath);
}