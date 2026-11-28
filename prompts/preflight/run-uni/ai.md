# One-Time AI Studio Baseline

**Last Updated:** November 28, 2026, 2:30 AM CST **Execution & Standalone Mode:** Phase A (AI Studio) \[FIRST-TIME-SINGLE-USE\] in pf-launcher-uni.md; can also be read and run standalone.

- **Step ID:** ai-baseline
- **Phase & Lifecycle:** Phase A (ai-studio) \[FIRST-TIME-SINGLE-USE\] (retires via AGENT\_SKIP\_LINE)
- **Allowed Diff Scope:** none - environment verification, `docs/handoff-state.json` logging only
- **Companion Readme:** `prompts/preflight/run-uni/read/ai-readme.md`
- **Log Entry:** `{ "step_id": "ai-baseline", "branch": "<branch-name>", "version": "<version-tag>", "head_sha": "<HEAD|sandbox-uncommitted>", "platform": "ai-studio", "status": "completed", "completed_at": "<YYYY-MM-DDTHH:MM:SSZ>", "touched_files": [] }`
- **Purpose:** Establish once what the AI Studio sandbox can and cannot do, so later steps route correctly instead of guessing.

# 1\. Platform Classification

- Record whether local Git CLI, Node, and `npm` are available. Git + shell available means Phase B (`antigravity` / `local-cli`); otherwise Phase A (`ai-studio` / sandbox). Write the result to `docs/handoff-state.json`; never re-detect mid-run.

# 2\. Baseline Checks (read-only)

- `npm --version` and `node --version` answer; if `node_modules/` is missing, run `npm ci` and note the exit status.
- `npm run -s preflight:lint` prints `PREFLIGHT_LINT_OK`.
- `npm run -s lint` (`tsc --noEmit`) exits 0 in the current tree; record failures instead of fixing them in this step.
- Confirm `.env.example` exists and still says no required environment variables; there is no backend and no required secret.
- Confirm `/import/` and `/old/` are unreachable: the dev server returns 403 for both paths, and no `src/` file imports them.

# 3\. Recording

- Update `docs/handoff-state.json` with the platform classification and clear `last_error`. Do not edit application code in this step; if a check fails, log the exact command and the first failure line.

# 4\. Exit Contract

- Emit `OK [ai-baseline] files=0` plus a one-line environment summary, or `STEP_BLOCKED [ai-baseline]: <1-2 line reason> | Reverted: <files> | Resume: fix issue and re-run launcher.`
