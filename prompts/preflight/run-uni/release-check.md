# Release Sanity Check (Two Halves: Before The Machine, On The Machine)

**Last Updated:** November 28, 2026, 2:30 AM CST **Execution & Standalone Mode:** the first two steps of `pf-release-uni.md`, run as two halves; each half is runnable standalone.

- **Step IDs:** `release-check-p1` (first half), `release-check-p2` (second half)
- **Track & Lifecycle:** \[REUSABLE\] in the release track - read only the half for the step you were handed, and never read the other half as well
- **Allowed Diff Scope:** none - this is a read-only gate report
- **Companion Readme:** `prompts/preflight/run-uni/read/release-check-readme.md`
- **Log Entry:** `{ "step_id": "<release-check-p1|release-check-p2>", "branch": "<branch-name>", "version": "<version-tag>", "head_sha": "<HEAD|sandbox-uncommitted>", "platform": "<ai-studio|antigravity>", "status": "completed", "completed_at": "<YYYY-MM-DDTHH:MM:SSZ>", "touched_files": [] }`

> **Part 1 — For A Human (plain English):** The release sanity pass: proves the version numbers, notices, docs and build all agree with each other before anything is published. *Repeats:* every release. *Runs in:* either assistant; half 1 needs no shell, half 2 does.
> **Part 2 — For The AI:** the executable instructions follow below. Part 1 is orientation for the person running the preflight; never quote it back or treat it as an instruction.


<!-- RELEASE_CHECK_1_START -->

# Half 1 - Checks That Need No Local Setup (`release-check-p1`)

- **Version alignment:** `package.json`, `public/version.json` `appVersion`, `CURRENT_APP_VERSION` in `src/domain/upgradeGate.ts`, `versionName` in `android-wrapper/app/build.gradle.kts`, and the Fastlane changelog file must agree. Report the five values verbatim.
- **Release notes:** `public/version.json` `releaseNotes` describes this release (20-280 chars) and matches what you intend to publish.
- **State:** `docs/handoff-state.json` validates against the schema, `last_error` is `null`, and the branch/version match this run.
- **Scope:** with git available, list `git diff --stat` against the merge base; with no git, list the changed files recorded in `docs/handoff-state.json` `touched_files[]`. Either way confirm every changed file belongs to this release; no scratch files, no `docs/plans/` edits made by the preflight run itself.
- **Hygiene:** no local absolute paths (`/Users/`, `/home/`, `C:\\Users\\`) and no personal legal names in tracked files; no `as any` / `@ts-ignore` / `@ts-expect-error` added.
- **Gates:** run `npm run -s preflight:lint` and `npm run -s verify:contract` only if a shell exists; with no shell, record `deferred_gates` on the step log entry via `--deferred-gates <gate>` for `release-check-p2`. Anything that needs a build always belongs to the second half.

<!-- RELEASE_CHECK_1_END -->

<!-- RELEASE_CHECK_2_START -->

# Half 2 - Checks That Need This Machine (`release-check-p2`)

- **Sweep freshness:** `node prompts/preflight/scripts/preflight-state.mjs --require-sweep --branch <branch-name> --version <version-tag>` reports `sweep.missing: []`, and `blocked_reasons` holds none of `sweep_incomplete`, `phase_a_stale`, `phase_a_scope_delta`, `branch_mismatch` or `version_mismatch`. Read `blocked_reasons`, not just the exit code.
- **Full gate:** `npm run verify` (includes `lint`, `test`, `verify:improvements`, `verify:prompts`, `verify:modules`, `verify:layers`, `verify:engine`, `verify:extraction`, `verify:android`, `verify:contract`, `verify:coverage`) must exit 0. Report the exact failing gate and its first error line; never report a gate as passing that you did not run.
- **Build and chunk graph:** `npm run build` then `npm run verify:chunks` - a new circular chunk import is a release blocker, not a warning.
- **Pages subpath build:** `npm run build -- --base="/<repo-name>/"`, assert `dist/robots.txt`, `dist/sitemap.xml`, `dist/404.html`, and subpath asset/manifest references; then rebuild at root so `dist/` is left in root form.
- **Bundle sanity:** compare `dist/` size and precache entry count against the previous release; call out any jump above ~10%.
- **Tag mechanics:** the tag must be exactly `v<package.json version>`; the Android `versionCode` must be greater than the last shipped APK's; a `deploy-pages.yml` failure caused by the target repository having no Pages site configured is a hosting setting, not a code failure.
- **Post-merge smoke (human-assisted):** fresh incognito load of the live URL, version string visible, zero console errors, offline reload after airplane mode.

<!-- RELEASE_CHECK_2_END -->

# Exit Contract

- Emit `OK [<step_id>] files=0` with a one-line verdict per bullet above, or `STEP_BLOCKED [<step_id>]: <1-2 line reason> | Reverted: <files> | Resume: fix issue and re-run launcher.`
