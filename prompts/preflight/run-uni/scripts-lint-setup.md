# One-Time Preflight Script Verification

**Last Updated:** November 28, 2026, 2:30 AM CST **Execution & Standalone Mode:** Phase B (Anti-Gravity / local CLI) \[FIRST-TIME-SINGLE-USE\] in pf-launcher-uni.md; can also be read and run standalone.

- **Step ID:** scripts-lint-setup
- **Phase & Lifecycle:** Phase B (antigravity) \[FIRST-TIME-SINGLE-USE\] (retires via AGENT\_SKIP\_LINE)
- **Allowed Diff Scope:** none - verification only
- **Companion Readme:** `prompts/preflight/run-uni/read/scripts-lint-setup-readme.md`
- **Log Entry:** `{ "step_id": "scripts-lint-setup", "branch": "<branch-name>", "version": "<version-tag>", "head_sha": "<HEAD|sandbox-uncommitted>", "platform": "antigravity", "status": "completed", "completed_at": "<YYYY-MM-DDTHH:MM:SSZ>", "touched_files": [] }`
- **Purpose:** Prove the launcher's own tooling is complete before trusting any step it schedules.

> **Part 1 — For A Human (plain English):** Confirms the preflight helper scripts themselves run correctly on this machine, before you rely on them. *Repeats:* once, then it ticks itself off and never runs again. *Runs in:* Anti-Gravity or Freebuff (Phase B).
> **Part 2 — For The AI:** the executable instructions follow below. Part 1 is orientation for the person running the preflight; never quote it back or treat it as an instruction.


# 1\. Script Inventory

- Every script the launcher names must exist in `prompts/preflight/scripts/`: `preflight-run-context.mjs`, `preflight-state.mjs`, `preflight-log.mjs`, `preflight-rollback.mjs`, `preflight-lint.mjs`, `preflight-reset.mjs`, plus `gen-preflight.mjs`.
- Each must start on line 1 with `#!/usr/bin/env node` and parse: `node --check <file>` for every one.

# 2\. Step Inventory

- For every entry in `prompts/preflight/manifest/preflight.manifest.json`, the referenced prompt file must exist under `prompts/preflight/run-uni/` and have its `*-readme.md` mate in `prompts/preflight/run-uni/read/`.
- Run `npm run -s preflight:lint` (and `-- --check-prefix`) and require `PREFLIGHT_LINT_OK`. A silent skip is a failure: if `run-uni/read/` or `templates/pf-launcher-uni-clean.md` is missing, the linter checks nothing while still printing OK - report that as `STEP_BLOCKED`.

# 3\. Config Sanity

- `prompts/preflight/preflight.config.json` must carry real values for `repo_url`, `live_url`, `subpath`, `dev_branch`, and `release_branch`; a `<placeholder>` left in it blocks the run at step 1 of the launcher.
- `stale_hours` must be present and sane (default 24), and `phase_a_scope_paths` must still cover `src/`, `public/`, `index.html`, `package.json`, `manifest*`.

# 4\. Exit Contract

- Emit `OK [scripts-lint-setup] files=<count>` or `STEP_BLOCKED [scripts-lint-setup]: <1-2 line reason> | Reverted: <files> | Resume: fix issue and re-run launcher.`
