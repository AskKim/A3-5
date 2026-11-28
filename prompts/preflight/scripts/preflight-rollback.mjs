#!/usr/bin/env node
// prompts/preflight/scripts/preflight-rollback.mjs — Step-scoped, non-destructive rollback references
// Last Updated: 2026-11-28T08:30:00-08:00
//
// Usage:
//   node prompts/preflight/scripts/preflight-rollback.mjs --capture --step <id>
//   node prompts/preflight/scripts/preflight-rollback.mjs --restore --step <id> [--dry-run] [--force]
//   node prompts/preflight/scripts/preflight-rollback.mjs --list
//   node prompts/preflight/scripts/preflight-rollback.mjs --clean
//
// Never runs `git checkout -- .`, `git reset --hard`, or `git clean`. It reverts only the paths
// that became dirty after the capture, and it never touches docs/handoff-state.json.

import { existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// `.git` can be a plain file in a linked worktree, so let git resolve its own private path.
function resolveRecordPath() {
  try {
    const gitPath = execFileSync('git', ['rev-parse', '--git-path', 'preflight-rollback.json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (gitPath) return gitPath;
  } catch {
    // Fall through to the temporary location.
  }
  return '/tmp/preflight-rollback.json';
}

const RECORD_PATH = resolveRecordPath();
const PROTECTED = ['docs/handoff-state.json'];
const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};
const stepId = getArg('--step');
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

const mode = args.includes('--capture')
  ? 'capture'
  : args.includes('--restore')
    ? 'restore'
    : args.includes('--list')
      ? 'list'
      : args.includes('--clean')
        ? 'clean'
        : null;

function git(argv) {
  try {
    return execFileSync('git', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function readRecord() {
  if (!existsSync(RECORD_PATH)) return null;
  try {
    return JSON.parse(readFileSync(RECORD_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function gitList(argv) {
  try {
    return execFileSync('git', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

// Three explicit listings beat parsing `status --porcelain` field offsets.
function dirtyPaths() {
  const tracked = gitList(['diff', '--name-only']);
  const staged = gitList(['diff', '--cached', '--name-only']);
  const untracked = gitList(['ls-files', '--others', '--exclude-standard']);
  if (tracked === null || staged === null || untracked === null) return null;
  return [...new Set([...tracked, ...staged, ...untracked])].sort();
}

function isTracked(path) {
  return git(['ls-files', '--error-unmatch', '--', path]) !== null;
}

function writeRecord(record) {
  // The resolved record path's directory always exists; never mkdir here.
  writeFileSync(RECORD_PATH, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
}

if (!mode) {
  console.error(
    'Usage: preflight-rollback.mjs --capture --step <id> | --restore --step <id> [--dry-run] [--force] | --list | --clean'
  );
  process.exit(1);
}

if (git(['rev-parse', 'HEAD']) === null) {
  console.error('STEP_BLOCKED: git is unavailable; rollback references require a local Git CLI.');
  process.exit(1);
}

if (mode === 'list') {
  const record = readRecord();
  console.log(JSON.stringify(record ?? { record: null }, null, 2));
  process.exit(0);
}

if (mode === 'clean') {
  if (existsSync(RECORD_PATH) && !dryRun) unlinkSync(RECORD_PATH);
  console.log(JSON.stringify({ ok: true, removed: dryRun ? null : RECORD_PATH }, null, 2));
  process.exit(0);
}

if (!stepId) {
  console.error('STEP_BLOCKED: --step <id> is required.');
  process.exit(1);
}

if (mode === 'capture') {
  const before = dirtyPaths();
  if (before === null) {
    console.error('STEP_BLOCKED: could not read git status.');
    process.exit(1);
  }
  const stashRef = git(['stash', 'create']) || null;
  const record = {
    step_id: stepId,
    captured_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    head_sha: git(['rev-parse', 'HEAD']),
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
    stash_ref: stashRef,
    dirty_before: before,
  };
  writeRecord(record);
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: 'capture',
        record_path: RECORD_PATH,
        step_id: stepId,
        head_sha: record.head_sha,
        dirty_before: before,
        stash_ref: stashRef,
        note: stashRef
          ? 'Non-destructive stash object created; recover with `git stash apply <ref>` if needed.'
          : 'Working tree was clean; only newly created files can be rolled back.',
      },
      null,
      2
    )
  );
  process.exit(0);
}

// restore
const record = readRecord();
if (!record) {
  console.error(`STEP_BLOCKED: no rollback capture at ${RECORD_PATH}. Run --capture --step <id> first.`);
  process.exit(1);
}
if (record.step_id !== stepId && !force) {
  console.error(
    `STEP_BLOCKED: capture belongs to step "${record.step_id}", not "${stepId}". Re-run with --force only if that is intended.`
  );
  process.exit(1);
}

const before = new Set(Array.isArray(record.dirty_before) ? record.dirty_before : []);
const now = dirtyPaths();
if (now === null) {
  console.error('STEP_BLOCKED: could not read git status.');
  process.exit(1);
}

const candidates = now.filter((path) => !before.has(path));
const protectedHits = candidates.filter((path) => PROTECTED.includes(path));
const targets = candidates.filter((path) => !PROTECTED.includes(path));

if (dryRun) {
  console.log(
    JSON.stringify(
      { ok: true, mode: 'restore', dry_run: true, step_id: record.step_id, would_revert: targets, protected_skipped: protectedHits },
      null,
      2
    )
  );
  process.exit(0);
}

const reverted = [];
const failed = [];
for (const path of targets) {
  try {
    if (isTracked(path)) {
      execFileSync('git', ['checkout', '--', path], { stdio: 'ignore' });
    } else if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true });
    }
    reverted.push(path);
  } catch {
    failed.push(path);
  }
}

console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      mode: 'restore',
      step_id: record.step_id,
      reverted,
      protected_skipped: protectedHits,
      failed,
      next_action:
        failed.length === 0
          ? 'Fix the reported issue and re-run the launcher; the handoff log was left untouched.'
          : 'Revert the failed paths by hand; they could not be restored automatically.',
    },
    null,
    2
  )
);
process.exit(failed.length === 0 ? 0 : 1);
