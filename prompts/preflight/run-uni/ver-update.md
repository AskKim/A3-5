# Per-Release Version And Changelog Sync

**Last Updated:** November 28, 2026, 2:30 AM CST **Execution & Standalone Mode:** release track, step 3 of 5 (AI Studio) \[REUSABLE\] in `pf-release-uni.md`; runnable standalone.

- **Step ID:** ver-update
- **Track & Lifecycle:** release track (ai-studio) \[REUSABLE\] (never retired; the state duplicate guard limits it to once per release)
- **Allowed Diff Scope:** `package.json`, `public/version.json`, `src/domain/upgradeGate.ts`, `android-wrapper/app/build.gradle.kts`, `android-wrapper/gradle.properties`, `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt`, `CHANGELOG.md`, `ROADMAP.md`
- **Companion Readme:** `prompts/preflight/run-uni/read/ver-update-readme.md`
- **Log Entry:** `{ "step_id": "ver-update", "branch": "<branch-name>", "version": "<version-tag>", "head_sha": "<HEAD|sandbox-uncommitted>", "platform": "ai-studio", "status": "completed", "completed_at": "<YYYY-MM-DDTHH:MM:SSZ>", "touched_files": [] }`
- **Purpose:** Make every version-bearing file and the human-facing changelog agree on one version before the tag exists.

> **Part 1 — For A Human (plain English):** Bumps the version everywhere it is written down and rolls the changelog, so all four version files agree. *Repeats:* every release. *Runs in:* AI Studio or Freebuff; it needs no shell.
> **Part 2 — For The AI:** the executable instructions follow below. Part 1 is orientation for the person running the preflight; never quote it back or treat it as an instruction.


# 1\. Version Alignment

- Write the same SemVer string into all five places: `package.json` `version`, `public/version.json` `appVersion`, `CURRENT_APP_VERSION` in `src/domain/upgradeGate.ts`, `versionName` in `android-wrapper/app/build.gradle.kts`, and `pedigree.wrapper.versionName` in `android-wrapper/gradle.properties`.
- `public/version.json` `schemaVersion` / `minDirectUpgradeSchema` change only when the storage schema actually changed. Never bump them to force an upgrade prompt.

# 2\. Schema And Gate Coupling

- `releaseReadiness.test.ts` hardcodes the current version string and the Fastlane changelog filename. Update both in the same commit as the version bump, or the suite fails.
- Android `versionCode` must strictly increase for every shipped APK and must equal the Fastlane changelog filename number. Bumping it means adding a new `changelogs/<n>.txt`, not overwriting the old one.
- `public/status.json` stays `allowUpdates: true` with `revokedVersions: []` unless this release deliberately blocks an older build.

# 3\. Changelog And Roadmap

- `CHANGELOG.md`: prepend one `## v<version> - <YYYY-MM-DD>` section with user-facing bullets (what a breeder sees, not file names). This file is the `improvement_log_anchor` target, so its top heading must be stable for the whole run.
- `ROADMAP.md`: the release's own scope lives in a section literally headed `For This Version`; move finished Alpha items to the completed history and move anything deliberately postponed out of that section.
- Fastlane changelog stays under 500 characters.

# 4\. Exit Contract

- Emit `OK [ver-update] files=<count>` with the five recorded version values, or `STEP_BLOCKED [ver-update]: <1-2 line reason> | Reverted: <files> | Resume: fix issue and re-run launcher.`
