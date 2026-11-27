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
  /** Short explanation of why this check exists */
  rationale: string;
}

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
}
