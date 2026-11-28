/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Shared registry types. These live apart from `improvementRegistry.ts` so the entry part modules
 * can be typed without importing the registry that assembles them — a type-only cycle is still a
 * cycle to the layer analyser, and this module breaks it for real.
 */

export type ImprovementCategory =
  | 'backup-safety'
  | 'alerts-home'
  | 'species-ux'
  | 'stability-pwa'
  | 'ci-tooling'
  | 'diagnostics-sync'
  | 'workflow-polish';

export interface ImprovementInvariant {
  /** Workspace-relative POSIX path, e.g. `src/domain/models.ts` */
  filePath: string;
  /** Identifiers, functions, or critical guards that must remain present in this file */
  requiredSubstrings: string[];
  /** Anti-patterns or regressions that must NOT reappear in this file */
  forbiddenSubstrings?: string[];
  /**
   * Short explanation of why this check exists. Usually omitted from entries: the prose lives in
   * `improvements/rationales.ts` and is resolved through `resolveEntryRationales` only where it is
   * displayed, so the registry chunk stays lean.
   */
  rationale?: string;
}

/** Rationale prose keyed `${entryId}#${filePath}#${ordinalForThatFile}`, see `improvements/rationales.ts`. */
export type ImprovementRationaleMap = Readonly<Record<string, string>>;

export type ImprovementRelease = 'alpha-2' | 'alpha-3' | (string & {});

export interface ImprovementEntry {
  id: string;
  title: string;
  category: ImprovementCategory;
  release?: ImprovementRelease;
  source: 'session' | 'github-preserved';
  summary: string;
  userIntent: string;
  files: string[];
  invariants: ImprovementInvariant[];
  restorePlaybook: string[];
  /**
   * Append-only ledger contract (`src/domain/ledgerContract.ts`). Setting `decidedOn` opts the entry
   * into the contract shape (`## YYYY-MM-DD — title` plus Why/Changed/Rejected/Status) instead of the
   * legacy `### IMP-0NN:` block, so a newly logged improvement renders exactly the documented shape.
   * Entries without it are legacy and are never rewritten.
   */
  decidedOn?: string;
  /** Ledger status; omitted means `active`. Ignored by the legacy rendering. */
  status?: 'active' | 'reverted' | 'superseded';
  /** Rendered as `superseded by <entry>` when `status` is `superseded`. */
  supersededBy?: string;
  /** The alternative considered and why it lost; omit when there was none. */
  rejected?: string;
  /** Commit the tracked files were in when the entry landed (rendered after each path). */
  commitSha?: string;
}
