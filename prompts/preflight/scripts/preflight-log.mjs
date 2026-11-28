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
import { sweepStatus } from './sweep-status.mjs';

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
function manifestStep(id) {
  try {
    const manifest = JSON.parse(readFileSync('prompts/preflight/manifest/preflight.manifest.json', 'utf8'));
    return manifest.steps?.find((step) => step.id === id) ?? null;
  } catch {
    return null;
  }
}
const step = manifestStep(stepId);
const phase = getArg('--phase') ?? step?.phase ?? null;
// A step that carries a human gate cannot be closed by the runner that did the machine work.
// Logging it `completed` without --human-signoff records `awaiting_human` instead, which the
// state reader does not count as done, so the phase (and the release) stays open until a person
// actually confirms it. This exists because release-check-p2 was once filed complete with its
// human-assisted post-merge smoke never performed.
const humanSignoff = getArg('--human-signoff');
let effectiveStatus = status;
if (status === 'completed' && step?.human_signoff && !humanSignoff) {
  effectiveStatus = 'awaiting_human';
  console.log(
    `AWAITING_HUMAN [${stepId}]: this step declares a human gate. Nothing was marked complete. ` +
      'Re-run with --human-signoff "<who/how>" once a person has done it.'
  );
}

if (!stepId || !['completed', 'failed', 'skipped'].includes(status) || !PLATFORMS.includes(platform)) {
  console.error(
    'Usage: node prompts/preflight/scripts/preflight-log.mjs --step <id> --status completed|failed|skipped --platform ai-studio|antigravity|freebuff [--files a,b] [--error "<msg>"] [--next <id>] [--deferred-gates verify:layers,npm-test] [--human-signoff "<who/how>"]'
  );
  process.exit(1);
}

const statePath = 'docs/handoff-state.json';
const lockPath = 'docs/.handoff.lock';
mkdirSync(dirname(statePath), { recursive: true });

// The release track is a tail, not a second sweep: it only runs on top of a sweep that finished
// for this branch and version. Filing a release step over an unfinished sweep is how a release
// gets cut on evidence nobody gathered, so this refuses before touching the lock or the state.
function sweepGap() {
  try {
    if (!existsSync(statePath)) return ['<docs/handoff-state.json missing>'];
    const current = JSON.parse(readFileSync(statePath, 'utf8'));
    const manifest = JSON.parse(
      readFileSync('prompts/preflight/manifest/preflight.manifest.json', 'utf8')
    );
    return sweepStatus(current, manifest.steps).missing;
  } catch (err) {
    return [`<state unreadable: ${err instanceof Error ? err.message : String(err)}>`];
  }
}

if (step?.track === 'release') {
  const gap = sweepGap();
  if (gap.length > 0) {
    console.error(
      `RELEASE_BLOCKED [${stepId}]: the sweep is not complete for this branch and version. ` +
        `Missing: ${gap.join(', ')}. Run pf-launcher-uni.md to the end first; a release is not ` +
        'the place to discover an unfinished sweep.'
    );
    process.exit(1);
  }
}

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
    status: effectiveStatus,
    completed_at: nowUtc,
    touched_files: touched,
  };

  if (humanSignoff) entry.signed_off_by = humanSignoff;
  if (cleanError) entry.error = cleanError;
  if (deferredCsv) {
    entry.deferred_gates = deferredCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  state.history = Array.isArray(state.history) ? state.history : [];
  state.history.push(entry);

  state.last_error = effectiveStatus === 'failed' ? (cleanError ?? `Step ${stepId} failed`) : null;
  if (effectiveStatus === 'awaiting_human') {
    // Never advance past an open human gate: the cursor points back at this step.
    state.resume_cursor = { phase, next_step_id: stepId };
  } else if (nextStep) {
    state.resume_cursor = { phase, next_step_id: nextStep };
  }

  writeFileSync(`${statePath}.tmp`, JSON.stringify(state, null, 2) + '\n', 'utf8');
  renameSync(`${statePath}.tmp`, statePath);
  console.log(`OK [${stepId}] status=${effectiveStatus} files=${touched.length}`);
} finally {
  if (existsSync(lockPath)) unlinkSync(lockPath);
}