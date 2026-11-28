/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Finished-plan gate.
 *
 * `GEMINI.md` says a handoff/plan file is deleted in the run that finishes it, and one found already
 * finished at startup is deleted then. Nothing enforced that, so a completed handoff could sit in
 * `docs/plans/` and reappear on every startup as a standing `EXISTING INCOMPLETE:` notice. This gate
 * fails on any `handoff-*.yaml` / `plan-*.yaml` that has no `[WIP]`/`[TODO]` step left and prints the
 * one-line fix.
 */
import fs from 'node:fs';
import path from 'node:path';

const PLANS_DIR = path.join(process.cwd(), 'docs/plans');
const PLAN_FILE = /^(?:handoff|plan)(?:-[^/]*)?\.yaml$/;
const OPEN_STEP = /^\s*-\s*\[(?:WIP|TODO)\]/m;

const problems: string[] = [];
const open: string[] = [];

if (!fs.existsSync(PLANS_DIR)) {
  problems.push('missing directory: docs/plans');
} else {
  const files = fs
    .readdirSync(PLANS_DIR)
    .filter((file) => PLAN_FILE.test(file))
    .sort();

  for (const file of files) {
    const text = fs.readFileSync(path.join(PLANS_DIR, file), 'utf8');
    if (OPEN_STEP.test(text)) open.push(file);
    else problems.push(`${file} has no open steps — finished files are deleted: git rm docs/plans/${file}`);
  }
}

if (problems.length > 0) {
  console.error(`[verify:plans] FAIL — ${problems.length} finished plan file(s) left in docs/plans:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  open.length > 0
    ? `[verify:plans] PASS — ${open.length} open plan file(s): ${open.join(', ')}.`
    : '[verify:plans] PASS — docs/plans holds no handoff or plan files.'
);
