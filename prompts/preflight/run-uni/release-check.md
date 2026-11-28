# Release Sanity Check (Phase A And Phase B Halves)

**Last Updated:** November 28, 2026, 2:30 AM CST **Execution & Standalone Mode:** phase-routed halves of the launcher; runnable standalone.

- **Step IDs:** `release-check-p1` (Phase A), `release-check-p2` (Phase B)
- **Phase & Lifecycle:** \[REUSABLE\] in both phases - read only the half for the phase you are in
- **Allowed Diff Scope:** none - this is a read-only gate report
- **Companion Readme:** `prompts/preflight/run-uni/read/release-check-readme.md`
- **Log Entry:** `{ "step_id": "<release-check-p1|release-check-p2>", "branch": "<branch-name>", "version": "<version-tag>", "head_sha": "<HEAD|sandbox-uncommitted>", "platform": "<ai-studio|antigravity>", "status": "completed", "completed_at": "<YYYY-MM-DDTHH:MM:SSZ>", "touched_files": [] }`

<!-- PHASE_A_START -->

# Phase A: Sandbox-Safe Release Check

- **Version alignment:** `package.json`, `public/version.json` `appVersion`, `CURRENT_APP_VERSION` in `src/domain/upgradeGate.ts`, `versionName` in `android-wrapper/app/build.gradle.kts`, and the Fastlane changelog file must agree. Report the five values verbatim.
- **Release notes:** `public/version.json` `releaseNotes` describes this release (20-280 chars) and matches what you intend to publish.
- **State:** `docs/handoff-state.json` validates against the schema, `last_error` is `null`, and the branch/version match this run.
- **Scope:** list `git diff --stat` against the merge base and confirm every changed file belongs to this release; no scratch files, no `docs/plans/` edits made by the preflight run itself.
- **Hygiene:** no local absolute paths (`/Users/`, `/home/`, `C:\\Users\\`) and no personal legal names in tracked files; no `as any` / `@ts-ignore` / `@ts-expect-error` added.
- **Gates available in a sandbox:** `npm run -s preflight:lint` and `npm run -s verify:contract`. Anything requiring a build belongs to Phase B.

<!-- PHASE_A_END -->

<!-- PHASE_B_START -->

# Phase B: Local CLI Release Check

- **Phase A freshness:** `node prompts/preflight/scripts/preflight-run-context.mjs --branch <branch-name> --version <version-tag>` reports `ai_studio_status: completed`, no Phase A-scope delta, and under `stale_hours`.
- **Full gate:** `npm run verify` (includes `lint`, `test`, `verify:improvements`, `verify:prompts`, `verify:modules`, `verify:layers`, `verify:engine`, `verify:extraction`, `verify:android`, `verify:contract`, `verify:coverage`) must exit 0. Report the exact failing gate and its first error line; never report a gate as passing that you did not run.
- **Build and chunk graph:** `npm run build` then `npm run verify:chunks` - a new circular chunk import is a release blocker, not a warning.
- **Pages subpath build:** `npm run build -- --base="/<repo-name>/"`, assert `dist/robots.txt`, `dist/sitemap.xml`, `dist/404.html`, and subpath asset/manifest references; then rebuild at root so `dist/` is left in root form.
- **Bundle sanity:** compare `dist/` size and precache entry count against the previous release; call out any jump above ~10%.
- **Tag mechanics:** the tag must be exactly `v<package.json version>`; the Android `versionCode` must be greater than the last shipped APK's; a `deploy-pages.yml` failure caused by the target repository having no Pages site configured is a hosting setting, not a code failure.
- **Post-merge smoke (human-assisted):** fresh incognito load of the live URL, version string visible, zero console errors, offline reload after airplane mode.

<!-- PHASE_B_END -->

# Exit Contract

- Emit `OK [<step_id>] files=0` with a one-line verdict per bullet above, or `STEP_BLOCKED [<step_id>]: <1-2 line reason> | Reverted: <files> | Resume: fix issue and re-run launcher.`
