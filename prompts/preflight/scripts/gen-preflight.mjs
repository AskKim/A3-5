#!/usr/bin/env node
// SPDX-FileCopyrightText: 2024-2026 AskKim
// SPDX-License-Identifier: AGPL-3.0-or-later
// Zero-dependency preflight wiring & TOC generator (replaces missing ajv runtime import).

import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve('prompts/preflight/manifest/preflight.manifest.json');
const wiringPath = path.resolve('prompts/preflight/pf-launcher-uni-wiring.md');
const launcherPath = path.resolve('prompts/preflight/pf-launcher-uni.md');
const tocStart = '<!-- MANIFEST_TOC -->';
const tocEnd = '<!-- MANIFEST_TOC_END -->';
const VALID_TYPES = new Set(['FIRST_TIME', 'REUSABLE', 'PER_RELEASE']);

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function validate() {
  const data = loadJSON(manifestPath);
  if (!data || typeof data !== 'object' || !Array.isArray(data.steps)) {
    console.error('Manifest validation error: expected { steps: [...] }');
    process.exit(1);
  }
  const errors = [];
  data.steps.forEach((step, idx) => {
    if (!step || typeof step !== 'object') {
      errors.push(`steps[${idx}] must be an object`);
      return;
    }
    for (const key of ['id', 'file', 'type', 'description']) {
      if (typeof step[key] !== 'string' || !step[key].trim()) {
        errors.push(`steps[${idx}].${key} must be a non-empty string`);
      }
    }
    if (step.type && !VALID_TYPES.has(step.type)) {
      errors.push(`steps[${idx}].type "${step.type}" must be FIRST_TIME | REUSABLE | PER_RELEASE`);
    }
  });
  if (errors.length > 0) {
    console.error('Manifest validation errors:', errors);
    process.exit(1);
  }
  return data;
}

function generateWiring(data) {
  const rows = data.steps.map((s) => `| ${s.id} | \`${s.file}\` | ${s.type} |`).join('\n');
  const content = [
    '<!-- SPDX-FileCopyrightText: 2024-2026 AskKim -->',
    '<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->',
    '',
    '# Preflight Launcher Wiring Guide',
    '',
    '| Step ID | Prompt File | Type |',
    '|---|---|---|',
    rows,
    '',
  ].join('\n');
  fs.writeFileSync(wiringPath, content, 'utf8');
}

function generateTOC(data) {
  if (!fs.existsSync(launcherPath)) return;
  const tocLines = data.steps.map((s) => `- [${s.id}](${s.file}) — ${s.type}`).join('\n');
  const launcher = fs.readFileSync(launcherPath, 'utf8');
  const startIdx = launcher.indexOf(tocStart);
  if (startIdx === -1) return;

  const replacement = `${tocStart}\n\n## Table of Contents\n${tocLines}\n${tocEnd}`;
  const endIdx = launcher.indexOf(tocEnd, startIdx + tocStart.length);
  const newContent =
    endIdx !== -1
      ? launcher.slice(0, startIdx) + replacement + launcher.slice(endIdx + tocEnd.length)
      : launcher.slice(0, startIdx) + replacement + launcher.slice(startIdx + tocStart.length);

  fs.writeFileSync(launcherPath, newContent, 'utf8');
}

function main() {
  const data = validate();
  if (process.argv.includes('--write-wiring')) {
    generateWiring(data);
    generateTOC(data);
  }
  console.log(`Preflight manifest validated (${data.steps.length} steps).`);
}

main();
