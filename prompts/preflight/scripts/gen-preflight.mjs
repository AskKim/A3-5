#!/usr/bin/env node
// SPDX-FileCopyrightText: 2024-2026 AskKim
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// prompts/preflight/scripts/gen-preflight.mjs — the preflight generator.
//
// `prompts/preflight/manifest/preflight.manifest.json` is the single source of truth for which
// steps exist, which prompt file each one runs, which phase owns it, and whether it runs once or
// stays reusable. Everything else that lists steps is rendered from it here:
//
//   - the launcher's two step blocks (retired once-only lines are preserved verbatim by step_id)
//   - the launcher's module summary line
//   - pf-launcher-uni-wiring.md
//   - templates/pf-launcher-uni-clean.md (the launcher with every once-only step re-armed)
//
// Nothing else may list steps by hand. `--check` fails when a generated file has drifted, which is
// what used to happen silently when the launcher and the manifest were edited separately.
//
// Zero dependencies: node built-ins only, on purpose (it must run inside a sandboxed AI Studio).

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = 'prompts/preflight';
const MANIFEST = `${ROOT}/manifest/preflight.manifest.json`;
const WIRING = `${ROOT}/pf-launcher-uni-wiring.md`;
const LAUNCHER = `${ROOT}/pf-launcher-uni.md`;
const TEMPLATE = `${ROOT}/templates/pf-launcher-uni-clean.md`;
const RELEASE = `${ROOT}/pf-release-uni.md`;

export const PHASES = ['A', 'B'];
// Ordered runner brackets per phase: the first entry is the preferred agent, and `freebuff` appears
// in both because it has a shell (so it can run Phase B work) at zero marginal cost (so it is an
// acceptable Phase A runner too). Order is a cost/preference decision the owners made, not a probe.
export const RUNNERS = new Set(['ai-studio', 'antigravity', 'freebuff']);
// Exactly two step types. "Once per release" is not a third type: the duplicate guard in
// docs/handoff-state.json already skips a REUSABLE step completed for the same branch + version +
// HEAD, so a separate PER_RELEASE class only forced every consumer to branch on a third case.
export const TYPES = new Set(['FIRST_TIME', 'REUSABLE']);
// Two tracks. `preflight` is the sweep that runs for any piece of work and must always be able to
// finish on its own; `release` is the tail that only runs when cutting a release, because it ends
// in decisions only the owner can make. Keeping them in one manifest means neither can drift from
// the other, and a step still cannot be listed by hand anywhere.
export const TRACKS = new Set(['preflight', 'release']);
export const trackOf = (step) => step.track ?? 'preflight';

/** An applied retirement marker on a step line, capturing its `step_id`. */
export const RETIRED = /^\s*-\s*\[SINGLE-USE-COMPLETED:[^\]\n]*\|\s*step_id:\s*([a-z0-9-]+)\s*\|/;

const LABEL = { FIRST_TIME: 'FIRST-TIME-SINGLE-USE', REUSABLE: 'REUSABLE' };

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

export function validateManifest(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.steps)) {
    return ['manifest must be an object with a `steps` array'];
  }
  const errors = [];
  const seen = new Set();
  data.steps.forEach((step, idx) => {
    if (!step || typeof step !== 'object') {
      errors.push(`steps[${idx}] must be an object`);
      return;
    }
    for (const key of ['id', 'file', 'type', 'phase', 'instruction', 'description']) {
      if (typeof step[key] !== 'string' || !step[key].trim()) {
        errors.push(`steps[${idx}].${key} must be a non-empty string`);
      }
    }
    if (!Array.isArray(step.runners) || step.runners.length === 0) {
      errors.push(`steps[${idx}].runners must be a non-empty array`);
    } else {
      for (const runner of step.runners) {
        if (!RUNNERS.has(runner)) {
          errors.push(`steps[${idx}].runners has unknown runner "${runner}" (${[...RUNNERS].join(' | ')})`);
        }
      }
      // Phase A must be runnable without a shell, so it can never list antigravity alone; Phase B
      // needs one, so it can never list ai-studio.
      if (step.phase === 'A' && step.runners.includes('antigravity') && !step.runners.includes('ai-studio')) {
        errors.push(`steps[${idx}] is Phase A but only offers antigravity`);
      }
      if (step.phase === 'B' && step.runners.includes('ai-studio')) {
        errors.push(`steps[${idx}] is Phase B but offers ai-studio, which has no shell or git`);
      }
    }
    if (typeof step.type === 'string' && !TYPES.has(step.type)) {
      errors.push(`steps[${idx}].type "${step.type}" must be ${[...TYPES].join(' | ')}`);
    }
    if (step.track !== undefined && !TRACKS.has(step.track)) {
      errors.push(`steps[${idx}].track "${step.track}" must be ${[...TRACKS].join(' | ')}`);
    }
    // A human gate in the sweep would block every ordinary run, which is the exact problem the
    // split exists to fix, so it is only legal in the release track.
    if (step.human_signoff === true && trackOf(step) !== 'release') {
      errors.push(`steps[${idx}] declares human_signoff but is not in the release track`);
    }
    if (typeof step.phase === 'string' && !PHASES.includes(step.phase)) {
      errors.push(`steps[${idx}].phase "${step.phase}" must be A | B`);
    }
    if (typeof step.id === 'string') {
      if (seen.has(step.id)) errors.push(`duplicate step id: ${step.id}`);
      seen.add(step.id);
    }
  });
  return errors;
}

/** A human-gated step says so on its own line, generated rather than repeated in the manifest. */
function gateSuffix(step) {
  return step.human_signoff
    ? ' **HUMAN GATE** — logs `awaiting_human` unless a person confirms it with `--human-signoff`.'
    : '';
}

function renderStep(step) {
  const file = `prompts/preflight/${step.file}`;
  const head = `- [ ] \`[${LABEL[step.type]}]\` \`[${step.runners.join(' | ')}]\` \`step_id: ${step.id}\` — \`${file}\``;
  if (step.type !== 'FIRST_TIME') return `${head} (${step.instruction}).${gateSuffix(step)}`;
  const retired = `[SINGLE-USE-COMPLETED: <YYYY-MM-DD> | step_id: ${step.id} | AGENT_SKIP_LINE: DO NOT READ OR CALL THIS PROMPT FILE]`;
  return `${head} (${step.instruction})${gateSuffix(step)} -> Rewrite to \`${retired}\`.`;
}

function renderModuleSummary(data) {
  const sweep = data.steps.filter((s) => trackOf(s) === 'preflight');
  const release = data.steps.filter((s) => trackOf(s) === 'release');
  const phaseA = sweep.filter((s) => s.phase === 'A').length;
  const phaseB = sweep.filter((s) => s.phase === 'B').length;
  return (
    `- **All ${sweep.length + 1} Paired Modules (\`prompts/preflight/run-uni/\` <-> \`prompts/preflight/run-uni/read/*-readme.md\`):** ` +
    `1 shared guardrail (\`guardrails.md\`) + ${sweep.length} sweep steps (${phaseA} Phase A, ${phaseB} Phase B). ` +
    `${release.length} further step(s) belong to the release track and live in \`pf-release-uni.md\`. ` +
    'The authoritative table is generated into `prompts/preflight/pf-launcher-uni-wiring.md`; never list steps by hand here.'
  );
}

function collectRetired(text) {
  const retired = new Map();
  for (const line of text.split('\n')) {
    const match = line.match(RETIRED);
    if (match) retired.set(match[1], line);
  }
  return retired;
}

function replaceRegion(text, start, end, body) {
  const startIdx = text.indexOf(start);
  if (startIdx === -1) throw new Error(`launcher is missing the ${start} marker`);
  const endIdx = text.indexOf(end, startIdx + start.length);
  if (endIdx === -1) throw new Error(`launcher is missing the ${end} marker`);
  return `${text.slice(0, startIdx + start.length)}\n${body}\n${text.slice(endIdx)}`;
}

export function renderLauncher(text, data) {
  const retired = collectRetired(text);
  let out = text;
  for (const phase of PHASES) {
    const body = data.steps
      .filter((step) => trackOf(step) === 'preflight' && step.phase === phase)
      .map((step) =>
        step.type === 'FIRST_TIME' && retired.has(step.id) ? retired.get(step.id) : renderStep(step)
      )
      .join('\n');
    out = replaceRegion(
      out,
      `<!-- PHASE_${phase}_STEPS_START -->`,
      `<!-- PHASE_${phase}_STEPS_END -->`,
      body
    );
  }
  // A one-shot token replacement silently stops updating once the token is consumed (that is how
  // the summary kept stale 8/10 counts after the phases moved), so the summary is a region too.
  return replaceRegion(
    out,
    '<!-- MODULE_SUMMARY_START -->',
    '<!-- MODULE_SUMMARY_END -->',
    renderModuleSummary(data)
  );
}

export function renderTemplate(launcherText, data) {
  return launcherText
    .split('\n')
    .map((line) => {
      const match = line.match(RETIRED);
      if (!match) return line;
      const step = data.steps.find((entry) => entry.id === match[1]);
      return step && step.type === 'FIRST_TIME' ? renderStep(step) : line;
    })
    .join('\n');
}

export function renderWiring(data) {
  const rows = data.steps
    .map(
      (step) =>
        `| ${step.id} | ${trackOf(step)} | \`${step.file}\` | ${step.type} | ${step.phase} | ${step.runners.join(' → ')} |`
    )
    .join('\n');
  return [
    '<!-- SPDX-FileCopyrightText: 2024-2026 AskKim -->',
    '<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->',
    '',
    '# Preflight Launcher Wiring Guide',
    '',
    '> Generated by `prompts/preflight/scripts/gen-preflight.mjs` from',
    '> `prompts/preflight/manifest/preflight.manifest.json`. Do not edit by hand: run',
    '> `npm run preflight:gen -- --write`, and `npm run preflight:lint` fails on drift.',
    '',
    '| Step ID | Track | Prompt File | Type | Phase | Runners (preferred first) |',
    '|---|---|---|---|---|---|',
    rows,
    '',
    '## The Two Step Types',
    '',
    '- **FIRST_TIME** runs once. When it completes cleanly the launcher rewrites its own line with',
    '  an `AGENT_SKIP_LINE` marker, so no model re-reads that prompt on a later run.',
    '- **REUSABLE** never retires: it runs again every time the launcher reaches it.',
    '',
    'There is no third class for work that happens once per release. That is a `REUSABLE` step',
    'whose duplicate guard finds a `completed` entry in `docs/handoff-state.json` for the same',
    'branch + version + HEAD and skips it with the completion timestamp.',
    '',
    '## The Two Tracks',
    '',
    '- **preflight** — the sweep in `pf-launcher-uni.md`. It runs for any piece of work, and it has',
    '  no human gates, so it always reaches the end.',
    '- **release** — the tail in `pf-release-uni.md`. It only runs when cutting a release, because',
    '  it ends in decisions a person has to make. A step in this track may declare',
    '  `human_signoff`, which `preflight-log.mjs` turns into `awaiting_human` unless',
    '  `--human-signoff "<who/how>"` is supplied. The generator rejects a human gate on a',
    '  `preflight` step, because that would block every ordinary run.',
    '',
    '## Phase Routing And Runner Brackets',
    '',
    'The phase is decided by the **minimum environment a step needs**, never by who is cheapest:',
    '',
    '- **Phase A** needs no environment access at all: no git, no `npm`, no `dist/`, no device.',
    '  Only file reads and file edits. A sandboxed browser AI can run it.',
    '- **Phase B** needs some of it: git history, installs, build output, CI status, the native',
    '  wrapper, or the running app.',
    '',
    'Each step then carries an ordered **runner bracket**. First listed is preferred, and the order',
    'is the front-loading rule: put the work on the cheapest runner that can finish it.',
    '',
    '- `ai-studio | freebuff` — the sandbox tier. AI Studio is preferred because it is the cheapest;',
    '  `freebuff` is the fallback when a sandbox cannot finish the step.',
    '- `antigravity | freebuff` — the local tier. Antigravity is preferred where the device, the',
    '  native SDK, or the owner\'s own data is required; `freebuff` may run the shell/git/build',
    '  subset and must defer anything on-device.',
    '',
    '`freebuff` is named in both brackets because it is a shell-capable cloud runner at no marginal',
    'cost: able to take Phase B work, acceptable for Phase A, and never allowed to claim a step it',
    'cannot finish end to end.',
    '',
  ].join('\n');
}

/**
 * The release runner. Generated rather than hand-written so the release tail cannot drift from the
 * manifest either, and so the step list here can never disagree with the one the state writer
 * reads when it decides whether a step carries a human gate.
 */
export function renderReleaseLauncher(data) {
  const releaseSteps = data.steps.filter((step) => trackOf(step) === 'release');
  const phaseA = releaseSteps.filter((step) => step.phase === 'A').length;
  const phaseB = releaseSteps.length - phaseA;
  return [
    '<!-- SPDX-FileCopyrightText: 2024-2026 AskKim -->',
    '<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->',
    '',
    '# PreFlight Release Runner',
    '',
    '> Generated by `prompts/preflight/scripts/gen-preflight.mjs` from',
    '> `prompts/preflight/manifest/preflight.manifest.json`. Do not edit by hand: run',
    '> `npm run preflight:gen -- --write`, and `npm run preflight:lint` fails on drift.',
    '',
    '> **Part 1 — For A Human (plain English):** This is the release tail that used to sit at the end',
    '> of the sweep and stop every run for a signature. The sweep now finishes on its own; open this',
    '> file only when you are actually cutting a release.',
    '',
    '## When To Run This',
    '',
    '- Only for a release: a version bump, a tag, an APK, or a Pages publish.',
    '- Never as part of ordinary work. `pf-launcher-uni.md` is the sweep for that, and it runs to the',
    '  end without a human gate.',
    '- **After the sweep, never instead of it.** The precondition below is enforced by the logger.',
    `- ${releaseSteps.length} steps (${phaseA} needing no local environment, ${phaseB} needing one).`,
    '',
    '## Precondition: A Finished Sweep',
    '',
    'This file runs only on top of a sweep that finished. Before any step here is accepted,',
    '`preflight-log.mjs` checks that every sweep step in the manifest carries a `completed` entry',
    'for the same branch and version, and refuses with `RELEASE_BLOCKED` plus the missing step ids',
    'if not. A release is not the place to discover an unfinished sweep, and a release step recorded',
    'over one is exactly the false completion this split exists to prevent.',
    '',
    '- Check it yourself: `node prompts/preflight/scripts/preflight-state.mjs` (exit 1 means do not',
    '  start), or read `history[]` in `docs/handoff-state.json` for this branch and version.',
    '- Recovery: run `pf-launcher-uni.md` to the end for this branch and version, then come back.',
    '- A sweep finished at an older commit still counts, but if `src/` changed since, run the sweep',
    '  again: the release is being cut from the new commit, not the one that was checked.',
    '',
    '## Steps',
    '',
    ...releaseSteps.map((step) => renderStep(step)),
    '',
    '## Human Gates',
    '',
    'A step marked **HUMAN GATE** cannot be closed by the runner that did the machine work.',
    '`preflight-log.mjs` writes `awaiting_human` for it unless `--human-signoff "<who/how>"` is',
    'passed, and it holds the resume cursor on that step rather than advancing. Only the owner can',
    'clear one, and the release is not cut until they do.',
    '',
    '## Exit Contract',
    '',
    '- Every step `completed`, each human gate carrying a `signed_off_by`, or the release is not cut.',
    '- `npm run preflight:lint` and `node prompts/preflight/scripts/gen-preflight.mjs --check` stay green.',
    '',
  ].join('\n');
}

/** Render every derived file, keyed by workspace-relative path. */
export function renderAll() {
  const data = JSON.parse(read(MANIFEST));
  const errors = validateManifest(data);
  if (errors.length > 0) throw new Error(`manifest validation failed: ${errors.join('; ')}`);
  const launcher = renderLauncher(read(LAUNCHER), data);
  return new Map([
    [LAUNCHER, launcher],
    [TEMPLATE, renderTemplate(launcher, data)],
    [WIRING, renderWiring(data)],
    [RELEASE, renderReleaseLauncher(data)],
  ]);
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write') || args.includes('--write-wiring');
  const check = args.includes('--check');

  let rendered;
  try {
    rendered = renderAll();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const drift = [];
  for (const [file, expected] of rendered) {
    const actual = fs.existsSync(file) ? read(file) : null;
    if (actual === expected) continue;
    drift.push(`${file} (${actual === null ? 'missing' : 'stale'})`);
    if (write) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, expected, 'utf8');
    }
  }

  const steps = JSON.parse(read(MANIFEST)).steps;
  if (check && drift.length > 0) {
    console.error(`PREFLIGHT_GEN_STALE:\n${drift.map((d) => `- ${d}`).join('\n')}`);
    process.exit(1);
  }
  if (write) {
    console.log(`Preflight generated ${drift.length} file(s) from ${steps.length} manifest steps.`);
    return;
  }
  console.log(
    drift.length === 0
      ? `Preflight manifest valid (${steps.length} steps); generated files in sync.`
      : `Preflight manifest valid (${steps.length} steps); drifted: ${drift.join(', ')}. Run with --write.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
