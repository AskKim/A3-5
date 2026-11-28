/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Release-track guard tests: a release step may not be logged unless the sweep is finished for the
 * same branch and version, and the self-check the release runner points at must answer that same
 * question. Both drive the real scripts against a temporary state file, because the guard's whole
 * value is that it runs in the CLI a person actually calls.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const LOG = join(ROOT, 'prompts/preflight/scripts/preflight-log.mjs');
const STATE = join(ROOT, 'prompts/preflight/scripts/preflight-state.mjs');
const MANIFEST_REL = 'prompts/preflight/manifest/preflight.manifest.json';
const STATE_REL = 'docs/handoff-state.json';
const BRANCH = 'test-branch';
const VERSION = '0.0.0-test';
const NOW = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

const manifest = JSON.parse(readFileSync(join(ROOT, MANIFEST_REL), 'utf8')) as {
  steps: { id: string; track?: string }[];
};
const sweepIds = manifest.steps
  .filter((step) => (step.track ?? 'preflight') === 'preflight')
  .map((step) => step.id);

/** A throwaway workspace whose sweep is complete except for `missing`. */
function fixture(missing: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), 'pf-release-guard-'));
  mkdirSync(join(dir, 'prompts/preflight/manifest'), { recursive: true });
  mkdirSync(join(dir, 'docs'), { recursive: true });
  writeFileSync(join(dir, MANIFEST_REL), JSON.stringify(manifest, null, 2));
  const history = sweepIds
    .filter((id) => !missing.includes(id))
    .map((id) => ({
      step_id: id,
      branch: BRANCH,
      version: VERSION,
      head_sha: 'sandbox-uncommitted',
      platform: 'freebuff',
      status: 'completed',
      completed_at: NOW,
      touched_files: [],
    }));
  writeFileSync(
    join(dir, STATE_REL),
    JSON.stringify(
      {
        schema_version: 2,
        active_branch: BRANCH,
        target_version: VERSION,
        resume_cursor: null,
        phase_a_scope_hash: null,
        ai_studio_status: 'completed',
        ai_studio_completed_at: NOW,
        ai_studio_commit_sha: null,
        improvement_log_anchor: null,
        antigravity_status: 'completed',
        antigravity_completed_at: NOW,
        history,
        last_error: null,
      },
      null,
      2
    )
  );
  return dir;
}

const run = (dir: string, script: string, args: string[]) =>
  spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8' });

const historyLength = (dir: string) =>
  (JSON.parse(readFileSync(join(dir, STATE_REL), 'utf8')) as { history: unknown[] }).history.length;

describe('release track precondition', () => {
  it('refuses a release step while a sweep step is unfinished, and writes nothing', () => {
    const dir = fixture(['modularity-check']);
    const before = historyLength(dir);

    const res = run(dir, LOG, [
      '--step',
      'release-plan',
      '--status',
      'failed',
      '--platform',
      'freebuff',
      '--error',
      'fixture',
    ]);

    expect(res.status).toBe(1);
    expect(res.stderr).toContain('RELEASE_BLOCKED');
    expect(res.stderr).toContain('modularity-check');
    expect(historyLength(dir)).toBe(before);
    // The refusal happens before the lock is taken, so it cannot block the next honest run.
    expect(existsSync(join(dir, 'docs/.handoff.lock'))).toBe(false);
  });

  it('accepts a release step once the sweep is complete', () => {
    const dir = fixture();
    const before = historyLength(dir);

    const res = run(dir, LOG, [
      '--step',
      'release-plan',
      '--status',
      'failed',
      '--platform',
      'freebuff',
      '--error',
      'fixture',
    ]);

    expect(res.status).toBe(0);
    expect(historyLength(dir)).toBe(before + 1);
  });

  it('does not block a sweep step: the precondition belongs to the release track only', () => {
    const dir = fixture(['modularity-check']);
    const res = run(dir, LOG, [
      '--step',
      'ci-guide',
      '--status',
      'failed',
      '--platform',
      'freebuff',
      '--error',
      'fixture',
    ]);
    expect(res.status).toBe(0);
  });
});

describe('preflight-state --require-sweep self-check', () => {
  it('exits 1 with sweep_incomplete when the sweep is unfinished', () => {
    const dir = fixture(['backup-check']);
    const res = run(dir, STATE, ['--require-sweep']);

    expect(res.status).toBe(1);
    const summary = JSON.parse(res.stdout) as {
      sweep: { missing: string[] };
      blocked_reasons: string[];
    };
    expect(summary.blocked_reasons).toContain('sweep_incomplete');
    expect(summary.sweep.missing).toEqual(['backup-check']);
  });

  it('exits 0 when the sweep is complete', () => {
    const dir = fixture();
    const res = run(dir, STATE, ['--require-sweep']);

    expect(res.status).toBe(0);
    const summary = JSON.parse(res.stdout) as { sweep: { missing: string[] } };
    expect(summary.sweep.missing).toEqual([]);
  });
});
