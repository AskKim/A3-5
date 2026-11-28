import { describe, expect, it } from 'vitest';
import {
  ALPHA_2_FINAL_IMP_ID,
  ALPHA_2_RELEASE,
  ALPHA_3_RELEASE,
  buildImprovementsRecoveryJson,
  evaluateImprovementInvariants,
  formatImprovementsMarkdown,
  getImprovementRelease,
  getImprovementsByRelease,
  IMPROVEMENTS_REGISTRY,
  resolveEntryRationales,
  isAlpha2Improvement,
  isAlpha3Improvement,
  findImprovementLedgerOptInViolations,
  findImprovementLedgerPinViolations,
  LEGACY_IMPROVEMENT_ENTRY_IDS,
} from '../improvementRegistry';
import { INVARIANT_RATIONALES } from '../improvements/rationales';

describe('improvementRegistry — anti-wipeout tracking & drift verification', () => {
  it('defines unique IDs, non-empty tracked files, invariants, and restoration playbooks for every entry', () => {
    const ids = new Set<string>();
    for (const entry of IMPROVEMENTS_REGISTRY) {
      expect(entry.id).toMatch(/^IMP-\d{3}$/);
      expect(ids.has(entry.id)).toBe(false);
      ids.add(entry.id);

      expect(entry.title.trim().length).toBeGreaterThan(5);
      expect(entry.files.length).toBeGreaterThan(0);
      expect(entry.invariants.length).toBeGreaterThan(0);
      expect(entry.restorePlaybook.length).toBeGreaterThan(0);
      for (const inv of entry.invariants) {
        expect(inv.requiredSubstrings.length).toBeGreaterThan(0);
      }
    }
  });

  it('passes when all required tokens are present and flags missing or forbidden drift accurately', () => {
    const mockDisk: Record<string, string> = {};
    for (const entry of IMPROVEMENTS_REGISTRY) {
      for (const inv of entry.invariants) {
        mockDisk[inv.filePath] = [
          mockDisk[inv.filePath] ?? '',
          ...inv.requiredSubstrings,
        ].join('\n');
      }
    }

    const cleanReport = evaluateImprovementInvariants(mockDisk, IMPROVEMENTS_REGISTRY, INVARIANT_RATIONALES);
    expect(cleanReport.ok).toBe(true);
    expect(cleanReport.violations).toHaveLength(0);
    expect(cleanReport.passedCount).toBe(IMPROVEMENTS_REGISTRY.length);

    // Simulate a GitHub overwrite wiping a critical helper in syncAndExports.ts and re-enabling devOptions SW
    const driftedDisk: Record<string, string> = {
      ...mockDisk,
      'src/domain/syncAndExports.ts': 'export function exportBarnBackupJson() {}',
      'vite.config.ts': `${mockDisk['vite.config.ts']}\ndevOptions: {\n      enabled: true`,
    };

    const driftedReport = evaluateImprovementInvariants(driftedDisk, IMPROVEMENTS_REGISTRY, INVARIANT_RATIONALES);
    expect(driftedReport.ok).toBe(false);
    expect(driftedReport.violations.some((v) => v.entryId === 'IMP-001')).toBe(true);
    expect(driftedReport.violations.some((v) => v.entryId === 'IMP-007')).toBe(true);
    expect(
      driftedReport.violations.some((v) => v.issue.includes('Detected regression pattern'))
    ).toBe(true);
  });

  it('generates readable Markdown documentation and valid JSON recovery bundles', () => {
    const md = formatImprovementsMarkdown(IMPROVEMENTS_REGISTRY, INVARIANT_RATIONALES);
    expect(md).toContain('# Community Pedigree — App Improvements & GitHub-Overwrite Recovery Log');
    expect(md).toContain('npm run verify:improvements');
    expect(md).toContain('IMP-001');
    expect(md).toContain('IMP-011');
    expect(md).toContain('IMP-014');
    expect(md).toContain('IMP-015');
    expect(md).toContain('IMP-016');
    expect(md).toContain('IMP-017');
    expect(md).toContain('IMP-021');
    expect(md).toContain('IMP-022');
    expect(md).toContain('IMP-023');
    expect(md).toContain('IMP-029');
    expect(md).toContain('IMP-030');
    expect(md).toContain('IMP-031');
    expect(md).toContain('IMP-032');
    expect(md).toContain('IMP-034');
    expect(md).toContain('IMP-035');
    expect(md).toContain('IMP-036');
    expect(md).toContain('IMP-037');
    expect(md).toContain('IMP-038');
    expect(md).toContain('IMP-039');
    expect(md).toContain('IMP-040');
    expect(md).toContain('IMP-041');
    expect(md).toContain('IMP-042');
    expect(md).toContain('IMP-043');
    expect(md).toContain('IMP-044');
    expect(md).toContain('IMP-045');
    expect(md).toContain('IMP-046');
    expect(md).toContain('IMP-047');
    expect(md).toContain('IMP-048');
    expect(md).toContain('IMP-049');
    expect(md).toContain('IMP-050');
    expect(md).toContain('IMP-051');
    expect(md).toContain('IMP-052');
    expect(md).toContain('IMP-053');
    expect(md).toContain('IMP-054');
    expect(md).toContain('IMP-055');
    expect(md).toContain('IMP-056');
    expect(md).toContain('IMP-057');
    expect(md).toContain('IMP-058');
    expect(md).toContain('IMP-059');
    expect(md).toContain('IMP-060');
    expect(md).toContain('IMP-061');

    const jsonText = buildImprovementsRecoveryJson(IMPROVEMENTS_REGISTRY, INVARIANT_RATIONALES);
    const parsed = JSON.parse(jsonText);
    expect(parsed.format).toBe('community-pedigree-improvements-log');
    expect(parsed.totalEntries).toBe(IMPROVEMENTS_REGISTRY.length);
    expect(Array.isArray(parsed.entries)).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-017')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-021')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-022')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-023')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-029')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-030')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-031')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-032')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-034')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-035')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-036')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-037')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-038')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-039')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-040')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-041')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-042')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-043')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-044')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-045')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-046')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-047')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-048')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-049')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-050')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-051')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-052')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-053')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-054')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-055')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-056')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-057')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-058')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-059')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-060')).toBe(true);
    expect(parsed.entries.some((e: { id: string }) => e.id === 'IMP-061')).toBe(true);
  });

  it('correctly classifies IMP-001 to IMP-064 as Alpha 2 and IMP-065 onwards as Alpha 3', () => {
    expect(ALPHA_2_FINAL_IMP_ID).toBe('IMP-064');
    expect(ALPHA_2_RELEASE).toBe('alpha-2');
    expect(ALPHA_3_RELEASE).toBe('alpha-3');

    const alpha2List = getImprovementsByRelease('alpha-2');
    expect(alpha2List.length).toBe(64);
    for (const entry of alpha2List) {
      expect(isAlpha2Improvement(entry)).toBe(true);
      expect(isAlpha3Improvement(entry)).toBe(false);
      expect(getImprovementRelease(entry)).toBe('alpha-2');
    }

    const alpha3List = getImprovementsByRelease('alpha-3');
    expect(alpha3List.length).toBeGreaterThanOrEqual(5);
    expect(alpha3List[0].id).toBe('IMP-065');
    expect(alpha3List[1].id).toBe('IMP-066');
    expect(alpha3List[2].id).toBe('IMP-067');
    expect(alpha3List[3].id).toBe('IMP-068');
    expect(alpha3List[4].id).toBe('IMP-069');
    expect(alpha3List[5].id).toBe('IMP-070');
    expect(isAlpha2Improvement(alpha3List[0])).toBe(false);
    expect(isAlpha3Improvement(alpha3List[0])).toBe(true);
    expect(getImprovementRelease(alpha3List[0])).toBe('alpha-3');

    // Any improvement starting at IMP-065 or higher defaults to Alpha 3
    const nextEntry = { id: 'IMP-071', title: 'Next improvement', summary: 'Future feature' };
    expect(isAlpha2Improvement(nextEntry)).toBe(false);
    expect(isAlpha3Improvement(nextEntry)).toBe(true);
    expect(getImprovementRelease(nextEntry)).toBe('alpha-3');

    // Explicit release property is honored
    expect(getImprovementRelease({ id: 'IMP-010', release: 'alpha-3' })).toBe('alpha-3');
    expect(getImprovementRelease({ id: 'IMP-099', release: 'alpha-2' })).toBe('alpha-2');

    // Recovery bundle JSON reflects Alpha 2 and Alpha 3 counts
    const json = JSON.parse(buildImprovementsRecoveryJson(IMPROVEMENTS_REGISTRY, INVARIANT_RATIONALES));
    expect(json.alpha2Total).toBe(64);
    expect(json.alpha3Total).toBeGreaterThanOrEqual(6);

    // Markdown documentation reflects classification header
    const md = formatImprovementsMarkdown(IMPROVEMENTS_REGISTRY, INVARIANT_RATIONALES);
    expect(md).toContain('## Release Milestone Classification');
    expect(md).toContain('- **Alpha 2 (v0.1.0-alpha.2 — Released Baseline):** `IMP-001` through `IMP-064` (64 improvements).');
    expect(md).toContain(
      `- **Alpha 3 (v0.1.0-alpha.3 — Active Deliverables):** \`IMP-065\` onwards (${alpha3List.length} improvements).`
    );
    expect(md).toContain('### IMP-068:');
    expect(md).toContain('### IMP-069:');
    expect(md).toContain('### IMP-070:');
    expect(md).toContain('- **Release Milestone:** Alpha 2 (`alpha-2`)');
    expect(md).toContain('- **Release Milestone:** Alpha 3 (`alpha-3`)');
  });

  it('rejects a new improvement that never opts into the ledger contract', () => {
    const base = IMPROVEMENTS_REGISTRY[0];

    const newLegacy = findImprovementLedgerOptInViolations([{ ...base, id: 'IMP-931' }]);
    expect(newLegacy).toHaveLength(1);
    expect(newLegacy[0].issue).toContain('decidedOn');

    expect(
      findImprovementLedgerOptInViolations([{ ...base, id: 'IMP-932', decidedOn: '2026-11-28' }])
    ).toEqual([]);
    expect(findImprovementLedgerOptInViolations()).toEqual([]);
    expect(findImprovementLedgerPinViolations()).toEqual([]);
  });

  it('rejects an impossible decidedOn and a supersededBy that names no entry', () => {
    const base = IMPROVEMENTS_REGISTRY[0];
    const opted = { decidedOn: '2026-11-28' } as const;

    const impossibleMonth = findImprovementLedgerOptInViolations([
      { ...base, id: 'IMP-933', ...opted, decidedOn: '2026-13-45' },
    ]);
    expect(impossibleMonth).toHaveLength(1);
    expect(impossibleMonth[0].issue).toContain('real calendar date');

    // Shaped like a date, but February never had 30 days.
    expect(
      findImprovementLedgerOptInViolations([
        { ...base, id: 'IMP-934', ...opted, decidedOn: '2026-02-30' },
      ])[0].issue
    ).toContain('real calendar date');

    // A real leap day is a valid entry date.
    expect(
      findImprovementLedgerOptInViolations([
        { ...base, id: 'IMP-935', ...opted, decidedOn: '2028-02-29' },
      ])
    ).toEqual([]);

    const dangling = findImprovementLedgerOptInViolations([
      { ...base, id: 'IMP-936', ...opted, status: 'superseded', supersededBy: 'IMP-999' },
    ]);
    expect(dangling).toHaveLength(1);
    expect(dangling[0].issue).toContain('IMP-999');

    // The replacement resolves only when it is actually in the registry.
    expect(
      findImprovementLedgerOptInViolations([
        { ...base, id: 'IMP-937', ...opted },
        { ...base, id: 'IMP-938', ...opted, status: 'superseded', supersededBy: 'IMP-937' },
      ])
    ).toEqual([]);
  });

  it('keeps the pinned legacy improvement IDs honest against the registry', () => {
    expect(LEGACY_IMPROVEMENT_ENTRY_IDS).toHaveLength(121);

    const stalePin = findImprovementLedgerPinViolations([IMPROVEMENTS_REGISTRY[0]]);
    expect(stalePin.some((violation) => violation.issue.includes('no longer in the registry'))).toBe(
      true
    );
  });

  it('ratchets the pinned legacy improvement IDs so the exemption list can never grow', () => {
    // A `decidedOn`-less entry passes only because its ID is pinned, so growing this list is a
    // quiet bypass. This snapshot is a second, independent bound: extending the list fails here
    // until the range below is edited deliberately in the same change.
    const pinnedSnapshot = Array.from(
      { length: 121 },
      (_, index) => `IMP-${String(index + 1).padStart(3, '0')}`
    );
    expect([...LEGACY_IMPROVEMENT_ENTRY_IDS]).toEqual(pinnedSnapshot);
  });

  it('resolves an explanation for every invariant from the rationale map', () => {
    // The prose lives outside the entries (improvements/rationales.ts). If an entry is added or a
    // file path changes without a matching key, the markdown export silently loses that sentence —
    // so every invariant must resolve to non-empty text.
    const missing: string[] = [];
    for (const entry of IMPROVEMENTS_REGISTRY) {
      const resolved = resolveEntryRationales(entry, INVARIANT_RATIONALES);
      entry.invariants.forEach((inv, idx) => {
        if (!resolved[idx] || resolved[idx].trim().length === 0) {
          missing.push(`${entry.id} -> ${inv.filePath} (#${idx + 1})`);
        }
      });
    }
    expect(missing).toEqual([]);
  });
});
