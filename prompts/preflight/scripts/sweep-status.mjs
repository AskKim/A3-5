#!/usr/bin/env node
// prompts/preflight/scripts/sweep-status.mjs — the one definition of "the sweep is finished"
//
// Three places need this answer: the release guard in preflight-log.mjs, the `--require-sweep`
// self-check in preflight-state.mjs, and the test that covers both. It lives here, small and pure,
// so the answer comes from one place instead of copies that quietly disagree.

/** A step belongs to the sweep unless it opted into the release track. */
export const trackOf = (step) => step.track ?? 'preflight';

/**
 * Sweep completeness for the branch and version recorded in `state`.
 *
 * Keyed on branch + version, deliberately not HEAD: the sweep commits its own doc changes, so a
 * HEAD-pinned rule would fail the moment it finished. That trade is what lets a sweep finished at an
 * older commit satisfy the release precondition, and it is stated on the release runner's face.
 *
 * `missing` is the ordered list of sweep step ids with no `completed` entry for this branch and
 * version. An `awaiting_human` entry is not `completed`, so it counts as missing here too.
 */
export function sweepStatus(state, steps) {
  const sweep = (steps ?? []).filter((step) => trackOf(step) === 'preflight');
  const done = new Set(
    (state?.history ?? [])
      .filter(
        (entry) =>
          entry &&
          entry.status === 'completed' &&
          entry.branch === state.active_branch &&
          entry.version === state.target_version
      )
      .map((entry) => entry.step_id)
  );
  const missing = sweep.filter((step) => !done.has(step.id)).map((step) => step.id);
  return { total: sweep.length, completed: sweep.length - missing.length, missing };
}
