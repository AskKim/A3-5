# Per-Release Plan, Cut And Sign-Off

**Last Updated:** November 28, 2026, 2:30 AM CST **Execution & Standalone Mode:** Phase B (Anti-Gravity / local CLI) \[PER-RELEASE\] in pf-launcher-uni.md; runnable standalone.

- **Step ID:** release-plan
- **Phase & Lifecycle:** Phase B (antigravity) \[PER-RELEASE\] (never retired by AGENT\_SKIP\_LINE)
- **Allowed Diff Scope:** `ROADMAP.md` (release section only), `CHANGELOG.md` (final wording only); everything else read-only
- **Companion Readme:** `prompts/preflight/run-uni/read/release-plan-readme.md`
- **Log Entry:** `{ "step_id": "release-plan", "branch": "<branch-name>", "version": "<version-tag>", "head_sha": "<HEAD|sandbox-uncommitted>", "platform": "antigravity", "status": "completed", "completed_at": "<YYYY-MM-DDTHH:MM:SSZ>", "touched_files": [] }`
- **Purpose:** Turn every prior step's evidence into one ordered cut plan, then hand the irreversible parts to the human.

# 1\. Preconditions For The Cut

- Every earlier step is `completed` in `docs/handoff-state.json` for this branch, version, and `HEAD`; `last_error` is `null`; `verify` and `build` + `verify:chunks` are green on exactly this commit.
- `git status -s` is clean apart from files this run intentionally changed; no scratch files, no `/tmp` output, no `dist/` staged.

# 2\. The Cut Plan (agent-executable)

- Merge order comes from `prompts/preflight/preflight.config.json`: the working branch merges into `dev_branch`, and only the owner promotes `dev_branch` into `release_branch` (the branch that serves the live site). Never push to `release_branch` unless the owner asked for "update release".
- Tag name is exactly `v<package.json version>`; a tag that does not match the four version files fails `release.yml` by design.
- Confirm the release notes body and pre-release flag before publishing; `release.yml` marks `-alpha`/`-beta`/`-rc` as pre-release automatically.

# 3\. Human-Only Sign-Off (list, never perform)

- Real-device install and smoke test (touch targets, offline reload in airplane mode, backup export/import, print/PDF output).
- GitHub About box, branch protection, and stale branch cleanup.
- Legal/licensing sign-off on `THIRD_PARTY_NOTICES.md`, and Search Console submission when the sitemap changed.
- Final go/no-go on publishing the GitHub Release and updating the live site.

# 4\. Exit Contract

- Emit `OK [release-plan] files=<count>` with the ordered cut plan, the blocked-or-waiting human items, and the exact tag name; or `STEP_BLOCKED [release-plan]: <1-2 line reason> | Reverted: <files> | Resume: fix issue and re-run launcher.`
- After a clean Phase B, print `COMPLETE` plus a three-line summary (steps skipped, steps executed, next action: human sign-off).
