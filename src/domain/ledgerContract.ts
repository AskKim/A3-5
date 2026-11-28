/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Append-only engineering-ledger contract (`src/domain/ledgerContract.ts`).
 *
 * `IMPROVEMENTS.md` and `PROMPT_CHANGES.md` are produced from their registries, so the header
 * contract and the entry shape live here once: `formatImprovementsMarkdown` and
 * `formatPromptChangelogMarkdown` emit them, and `scripts/verify-improvements.ts` /
 * `scripts/verify-prompts.ts` re-check the files on disk against them. Regenerating a ledger can no
 * longer silently drop the header, and a malformed new entry fails the gate instead of landing.
 *
 * Existing entries predate the contract (they use the legacy `### IMP-0NN:` / `### PRM-0NN:`
 * blocks and carry no Status/Rejected) and are grandfathered: only entries that opt into the
 * contract shape are validated, so nothing is backfilled or rewritten.
 *
 * CROSS-PLATFORM MIGRATION GUARDRAIL:
 *   100% pure TypeScript with zero browser DOM (`window`, `document`) or Node (`fs`, `path`)
 *   imports. Disk reads stay in `scripts/`.
 */

export type LedgerKind = 'improvements' | 'prompt-changes';

export type LedgerEntryStatus = 'active' | 'reverted' | 'superseded';

/** Day the header contract landed. Entries dated earlier predate Status/Rejected. */
export const LEDGER_FORMAT_UPDATED = '2026-11-28';

export const LEDGER_DECISIONS_DIR = 'docs/decisions';

export interface LedgerContractViolation {
  /** Entry heading (or `header`) the violation belongs to. */
  heading: string;
  issue: string;
}

export interface LedgerContractReport {
  kind: LedgerKind;
  /** Every entry heading found, legacy and contract-shaped. */
  totalEntries: number;
  /** Entries using the contract shape (the only ones validated field-by-field). */
  contractEntries: number;
  violations: LedgerContractViolation[];
  ok: boolean;
}

/** The documented shape block per ledger, also published in the header so it is self-describing. */
const SHAPE_BLOCK: Record<LedgerKind, readonly string[]> = {
  improvements: [
    '#   ## YYYY-MM-DD — short imperative title',
    '#   Why:        the problem this solved',
    '#   Changed:    path(s), with @ <commit-sha> where the state matters',
    '#   Rejected:   the alternative considered and why it lost (omit if none)',
    '#   Status:     active | reverted | superseded by <entry>',
  ],
  'prompt-changes': [
    '#   ## <prompt-name> <version> — one-line summary',
    '#   Prompt:     path/to/prompt.md @ <commit-sha or tag>',
    '#   Why:        what was wrong with the previous version',
    '#   Changed:    what this edit did',
    '#   Rejected:   what else was tried and why it lost',
    '#   Supersedes: <previous version> — why it was replaced',
    '#   Status:     active | reverted | superseded',
  ],
};

/**
 * The header contract prepended to a ledger by its formatter. Ordering matches the ledgers as they
 * are actually written (oldest first, `IMP-001` upward), so appending never rewrites an entry.
 */
export function formatLedgerHeader(kind: LedgerKind): string[] {
  const lines: string[] = [
    '# append-only, oldest first. Never rewrite past entries.',
    '# Agents: read this before starting work; append an entry when you finish.',
  ];
  if (kind === 'prompt-changes') {
    lines.push('# One entry per KEPT version; experiments go in SCRATCH.');
  }
  lines.push(
    `# Format updated ${LEDGER_FORMAT_UPDATED}. Entries below predate Status/Rejected; do not backfill them.`
  );
  lines.push(
    '# New entries are generated from the registry — add the entry, then run `npm run regen:ledgers` —'
  );
  lines.push('# and land at the bottom, after the last existing entry, in this shape:');
  lines.push('#');
  lines.push(...SHAPE_BLOCK[kind]);
  lines.push('#');
  lines.push('# Escalation: if Rejected needs more than two lines, promote that entry to');
  lines.push(
    `#   ${LEDGER_DECISIONS_DIR}/NNNN-slug.md (Context / Decision / Alternatives / Consequences)`
  );
  return lines;
}

/** Contract fragments that must survive in the header block (checked against the file). */
const HEADER_FRAGMENTS: Record<LedgerKind, readonly string[]> = {
  improvements: [
    'append-only, oldest first',
    'Never rewrite past entries',
    'Agents: read this before starting work; append an entry when you finish',
    `Format updated ${LEDGER_FORMAT_UPDATED}`,
    'do not backfill them',
    'npm run regen:ledgers',
    '## YYYY-MM-DD — short imperative title',
    'Rejected:   the alternative considered and why it lost',
    'Status:     active | reverted | superseded by <entry>',
    `${LEDGER_DECISIONS_DIR}/NNNN-slug.md`,
    'Context / Decision / Alternatives / Consequences',
  ],
  'prompt-changes': [
    'append-only, oldest first',
    'Never rewrite past entries',
    'Agents: read this before starting work; append an entry when you finish',
    'One entry per KEPT version; experiments go in SCRATCH',
    `Format updated ${LEDGER_FORMAT_UPDATED}`,
    'do not backfill them',
    'npm run regen:ledgers',
    '## <prompt-name> <version> — one-line summary',
    'Supersedes: <previous version> — why it was replaced',
    `${LEDGER_DECISIONS_DIR}/NNNN-slug.md`,
    'Context / Decision / Alternatives / Consequences',
  ],
};

const REQUIRED_FIELDS: Record<LedgerKind, readonly string[]> = {
  improvements: ['Why', 'Changed', 'Status'],
  'prompt-changes': ['Prompt', 'Why', 'Changed', 'Supersedes', 'Status'],
};

/** Contract headings: `## 2026-11-28 — title` / `## core_hygiene v3 — summary`. */
const ENTRY_HEADING: Record<LedgerKind, RegExp> = {
  improvements: /^## (\d{4}-\d{2}-\d{2}) — (\S.*)$/,
  'prompt-changes': /^## ([A-Za-z0-9][A-Za-z0-9._-]*) ((?:v?\d)[A-Za-z0-9._-]*) — (\S.*)$/,
};

/** Legacy entries: `### IMP-001: ...`, `### PRM-008: ...`. Grandfathered, never validated. */
const LEGACY_ENTRY_HEADING = /^### [A-Z]{2,4}-\d{3}:/;

const ADMIN_SECTION_HEADING = /^## (?:Logged|Release|Quick|Decision)\b/;

const FIELD_LINE = /^(Prompt|Why|Changed|Rejected|Supersedes|Status):[ \t]*(.*)$/;

const STATUS_PATTERN: Record<LedgerKind, RegExp> = {
  improvements: /^(?:active|reverted|superseded by \S.*)$/,
  'prompt-changes': /^(?:active|reverted|superseded)$/,
};

/** A ledger value that names at least one file with an extension. */
const PATH_TOKEN = /[\w@./-]+\.(?:tsx?|md|json|ya?ml|kts?|css|html|sh)\b/;

const ADR_PATH = /docs\/decisions\/\d{4}-[A-Za-z0-9._-]+\.md/;

interface ParsedLedgerEntry {
  heading: string;
  index: number;
  date?: string;
  fields: Map<string, string[]>;
  fieldOrder: string[];
}

function parseContractEntries(
  lines: readonly string[],
  kind: LedgerKind
): ParsedLedgerEntry[] {
  const entries: ParsedLedgerEntry[] = [];
  const headingPattern = ENTRY_HEADING[kind];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith('## ')) continue;
    const match = line.match(headingPattern);
    if (!match) continue;

    const fields = new Map<string, string[]>();
    const fieldOrder: string[] = [];
    let current: string | null = null;

    for (let j = i + 1; j < lines.length; j += 1) {
      const row = lines[j];
      if (row.startsWith('## ') || row.startsWith('### ')) break;
      const fieldMatch = row.match(FIELD_LINE);
      if (fieldMatch) {
        current = fieldMatch[1];
        fieldOrder.push(current);
        fields.set(current, [fieldMatch[2].trim()]);
        continue;
      }
      if (row.trim().length === 0) {
        current = null;
        continue;
      }
      // Wrapped field bodies continue until the next field, heading, or blank line.
      if (current && !row.startsWith('**')) {
        fields.get(current)!.push(row.trim());
      }
    }

    entries.push({
      heading: line.trim(),
      index: i,
      date: kind === 'improvements' ? match[1] : undefined,
      fields,
      fieldOrder,
    });
  }

  return entries;
}

/**
 * Checks a ledger's on-disk markdown against the header contract and the documented entry shape.
 * Legacy entries are skipped by design; contract-shaped entries must be complete, correctly
 * ordered, correctly valued, oldest-first, and honest about any rejected alternative worth an ADR.
 */
export function evaluateLedgerContract(
  markdown: string,
  kind: LedgerKind
): LedgerContractReport {
  const violations: LedgerContractViolation[] = [];
  const lines = markdown.split('\n');

  let headerEnd = 0;
  while (headerEnd < lines.length && lines[headerEnd].startsWith('#')) {
    headerEnd += 1;
  }
  const headerBlock = lines.slice(0, headerEnd).join('\n');
  for (const fragment of HEADER_FRAGMENTS[kind]) {
    if (!headerBlock.includes(fragment)) {
      violations.push({
        heading: 'header',
        issue: `missing header contract text "${fragment}"`,
      });
    }
  }

  let lastLegacyIndex = -1;
  let legacyCount = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (LEGACY_ENTRY_HEADING.test(lines[i])) {
      lastLegacyIndex = i;
      legacyCount += 1;
    }
  }

  const entries = parseContractEntries(lines, kind);
  const required = REQUIRED_FIELDS[kind];
  const statusPattern = STATUS_PATTERN[kind];
  let previousDate = '';

  for (const entry of entries) {
    if (lastLegacyIndex >= 0 && entry.index < lastLegacyIndex) {
      violations.push({
        heading: entry.heading,
        issue: 'contract-shaped entries are appended below the existing entries, not above them',
      });
    }

    for (const field of required) {
      const values = entry.fields.get(field);
      if (!values) {
        violations.push({ heading: entry.heading, issue: `missing required "${field}:" line` });
      } else if (values.join(' ').trim().length === 0) {
        violations.push({ heading: entry.heading, issue: `empty "${field}:" value` });
      }
    }

    const presentRequired = entry.fieldOrder.filter((f) => required.includes(f));
    const expectedOrder = required.filter((f) => entry.fields.has(f));
    if (presentRequired.join('>') !== expectedOrder.join('>')) {
      violations.push({
        heading: entry.heading,
        issue: `fields are out of order — expected ${expectedOrder.join(' → ')}`,
      });
    }

    if (entry.fields.has('Rejected')) {
      const changedAt = entry.fieldOrder.indexOf('Changed');
      const rejectedAt = entry.fieldOrder.indexOf('Rejected');
      const statusAt = entry.fieldOrder.indexOf('Status');
      if (!(changedAt >= 0 && rejectedAt > changedAt && statusAt > rejectedAt)) {
        violations.push({
          heading: entry.heading,
          issue: '`Rejected:` sits between `Changed:` and `Status:`',
        });
      }
    }

    const status = entry.fields.get('Status')?.join(' ').trim() ?? '';
    if (status && !statusPattern.test(status)) {
      violations.push({
        heading: entry.heading,
        issue: `invalid Status "${status}" — expected ${
          kind === 'improvements'
            ? 'active | reverted | superseded by <entry>'
            : 'active | reverted | superseded'
        }`,
      });
    }

    if (kind === 'improvements') {
      const changed = entry.fields.get('Changed')?.join(' ') ?? '';
      if (changed && !PATH_TOKEN.test(changed)) {
        violations.push({
          heading: entry.heading,
          issue: '`Changed:` must name at least one path',
        });
      }
      if (entry.date) {
        if (entry.date < LEDGER_FORMAT_UPDATED) {
          violations.push({
            heading: entry.heading,
            issue: `dated before ${LEDGER_FORMAT_UPDATED}; entries that predate the contract keep the legacy ### shape rather than claiming Status/Rejected`,
          });
        }
        if (previousDate && entry.date < previousDate) {
          violations.push({
            heading: entry.heading,
            issue: `dated ${entry.date}, before the entry above it (${previousDate}) — this ledger is oldest-first`,
          });
        }
        previousDate = entry.date;
      }
    } else {
      const promptLine = entry.fields.get('Prompt')?.join(' ').trim() ?? '';
      if (promptLine && !/^\S+\.md @ \S+$/.test(promptLine)) {
        violations.push({
          heading: entry.heading,
          issue: '`Prompt:` must read "<path/to/prompt.md> @ <commit-sha or tag>"',
        });
      }
      const supersedes = entry.fields.get('Supersedes')?.join(' ').trim() ?? '';
      if (supersedes && !/\S+ — \S/.test(supersedes)) {
        violations.push({
          heading: entry.heading,
          issue: '`Supersedes:` must read "<previous version> — why it was replaced"',
        });
      }
      if (entry.fields.has('Supersedes') && !supersedes) {
        violations.push({
          heading: entry.heading,
          issue: '`Supersedes:` must name the version this entry replaces',
        });
      }
    }

    const rejected = (entry.fields.get('Rejected') ?? []).filter((l) => l.length > 0);
    if (rejected.length > 2 && !ADR_PATH.test(rejected.join(' '))) {
      violations.push({
        heading: entry.heading,
        issue: `Rejected: spans ${rejected.length} lines — promote it to ${LEDGER_DECISIONS_DIR}/NNNN-slug.md (Context / Decision / Alternatives / Consequences)`,
      });
    }
  }

  // A heading after the last legacy entry that is not the documented shape is a malformed new entry.
  if (lastLegacyIndex >= 0) {
    for (let i = lastLegacyIndex + 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.startsWith('## ')) continue;
      if (ENTRY_HEADING[kind].test(line)) continue;
      if (ADMIN_SECTION_HEADING.test(line)) continue;
      violations.push({
        heading: line.trim(),
        issue: `new entry heading does not match the documented shape (${
          kind === 'improvements' ? '## YYYY-MM-DD — title' : '## <prompt-name> <version> — summary'
        })`,
      });
    }
  }

  return {
    kind,
    totalEntries: entries.length + legacyCount,
    contractEntries: entries.length,
    violations,
    ok: violations.length === 0,
  };
}

function previewLedgerLine(line: string | undefined): string {
  if (line === undefined) return '<missing line>';
  const clipped = line.length > 110 ? `${line.slice(0, 107)}…` : line;
  return JSON.stringify(clipped);
}

/**
 * Compares a ledger with a fresh render of its registry.
 *
 * Each ledger is a generated file — its whole content is that render — so any difference is drift:
 * a hand-edited line, a stale entry, or a registry entry that was never regenerated into the file.
 * Returns at most three violations, each naming the first drifting line so the fix is obvious.
 */
export function evaluateLedgerFreshness(
  onDisk: string,
  regenerated: string
): LedgerContractViolation[] {
  const disk = onDisk.split('\n');
  const expected = regenerated.split('\n');
  const violations: LedgerContractViolation[] = [];
  const lineCount = Math.max(disk.length, expected.length);

  for (let i = 0; i < lineCount && violations.length < 3; i += 1) {
    if (disk[i] === expected[i]) continue;
    violations.push({
      heading: 'ledger',
      issue: `line ${i + 1} does not match the registry — on disk ${previewLedgerLine(
        disk[i]
      )}, registry renders ${previewLedgerLine(expected[i])}; run \`npm run regen:ledgers\``,
    });
  }

  return violations;
}
