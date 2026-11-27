#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Triggers the real Android APK build on GitHub and waits for the result.
 *
 * This exists because the APK cannot be compiled here: it needs JDK 17 plus the
 * Android SDK (~3–4 GB). GitHub already builds it on every push; this script lets an
 * agent or developer dispatch that same workflow on demand and read the outcome.
 *
 * Usage:
 *   node scripts/android-build-remote.mjs --dry-run            # show the API call only
 *   GH_TOKEN=... node scripts/android-build-remote.mjs --ref main
 *   GH_TOKEN=... node scripts/android-build-remote.mjs --ref main --artifacts
 *
 * Token: GH_TOKEN or GITHUB_TOKEN with `actions:write` (and `repo` for private repos).
 * Equivalent without this script: gh workflow run build-android-apk.yml --ref main
 */

import { execFileSync } from 'node:child_process';

const WORKFLOW_FILE = 'build-android-apk.yml';
const API = 'https://api.github.com';
const POLL_INTERVAL_MS = 15_000;

const argv = process.argv.slice(2);
const getArg = (flag, fallback = null) => {
  const index = argv.indexOf(flag);
  return index !== -1 && argv[index + 1] ? argv[index + 1] : fallback;
};
const hasFlag = (flag) => argv.includes(flag);

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function detectRepo() {
  const explicit = getArg('--repo');
  if (explicit) return explicit;
  const remote = git(['remote', 'get-url', 'origin']);
  const match = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  return match ? `${match[1]}/${match[2]}` : null;
}

const repo = detectRepo();
if (!repo) {
  console.error('Cannot determine the GitHub repo. Pass --repo <owner/name>.');
  process.exit(2);
}

const ref = getArg('--ref', git(['rev-parse', '--abbrev-ref', 'HEAD']) || 'main');
const dispatchUrl = `${API}/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
const headers = {
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'pedigree-android-build-remote',
};

if (hasFlag('--dry-run')) {
  console.log(
    JSON.stringify(
      {
        would: 'POST',
        url: dispatchUrl,
        body: { ref },
        then: `poll ${API}/repos/${repo}/actions/runs until completed`,
        note: 'Dry run: nothing was sent. A real dispatch needs GH_TOKEN with actions:write.',
      },
      null,
      2
    )
  );
  process.exit(0);
}

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
if (!token) {
  console.error('No GitHub token found.');
  console.error('Set GH_TOKEN (actions:write) or run: gh workflow run ' + WORKFLOW_FILE + ' --ref ' + ref);
  process.exit(2);
}

const authedHeaders = { ...headers, Authorization: `Bearer ${token}` };
const startedAt = Date.now();

async function dispatchRun() {
  const response = await fetch(dispatchUrl, {
    method: 'POST',
    headers: authedHeaders,
    body: JSON.stringify({ ref }),
  });
  if (response.status !== 204) {
    console.error(`Dispatch failed: HTTP ${response.status} — ${(await response.text()).slice(0, 400)}`);
    process.exit(1);
  }
  console.log(`Dispatched ${WORKFLOW_FILE} on ${repo}@${ref}.`);
}

async function findRun() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await fetch(
      `${API}/repos/${repo}/actions/runs?event=workflow_dispatch&branch=${encodeURIComponent(ref)}&per_page=10`,
      { headers: authedHeaders }
    );
    if (!response.ok) {
      console.error(`Cannot list runs: HTTP ${response.status}`);
      process.exit(1);
    }
    const body = await response.json();
    const match = (body.workflow_runs ?? []).find(
      (run) => run.path?.endsWith(WORKFLOW_FILE) && Date.parse(run.created_at) >= startedAt - 60_000
    );
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  console.error('Dispatched, but no matching run appeared within a minute.');
  process.exit(1);
}

async function waitForRun(runId) {
  const deadline = startedAt + Number.parseInt(getArg('--timeout', '25'), 10) * 60_000;
  for (;;) {
    const response = await fetch(`${API}/repos/${repo}/actions/runs/${runId}`, { headers: authedHeaders });
    if (!response.ok) {
      console.error(`Cannot read run ${runId}: HTTP ${response.status}`);
      process.exit(1);
    }
    const run = await response.json();
    if (run.status === 'completed') return run;
    if (Date.now() > deadline) {
      console.error(`Timed out waiting for ${run.html_url} (last status: ${run.status}).`);
      process.exit(1);
    }
    console.log(`  ${run.status} — ${run.html_url}`);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function listArtifacts(runId) {
  const response = await fetch(`${API}/repos/${repo}/actions/runs/${runId}/artifacts`, { headers: authedHeaders });
  if (!response.ok) {
    console.error(`Cannot list artifacts: HTTP ${response.status}`);
    return;
  }
  const body = await response.json();
  if (!body.artifacts?.length) {
    console.log('No artifacts attached to this run.');
    return;
  }
  for (const artifact of body.artifacts) {
    console.log(`  artifact: ${artifact.name} (${artifact.size_in_bytes} bytes, expired=${artifact.expired})`);
    console.log(`    download: ${artifact.archive_download_url}`);
  }
}

await dispatchRun();
const run = await findRun();
const finished = await waitForRun(run.id);

console.log(`Run ${finished.conclusion}: ${finished.html_url}`);
if (hasFlag('--artifacts')) await listArtifacts(finished.id);
process.exit(finished.conclusion === 'success' ? 0 : 1);
