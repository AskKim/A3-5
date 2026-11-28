# Version Update - Step Readme

- **Prompt:** `prompts/preflight/run-uni/ver-update.md`
- **Step ID:** ver-update - **Type:** PER_RELEASE - **Phase:** A (ai-studio)
- **Run it when:** once per release, before any tag exists.
- **Reads:** `package.json`, `public/version.json`, `public/status.json`, `src/domain/upgradeGate.ts`, `android-wrapper/app/build.gradle.kts`, `android-wrapper/gradle.properties`, `fastlane/metadata/android/en-US/changelogs/`.
- **Writes:** the five version strings, `CHANGELOG.md`, the Fastlane changelog for the new `versionCode`, and the `ROADMAP.md` release section.
- **Pass signal:** `OK [ver-update] files=<count>` with the five recorded values.
- **Fail signal:** `STEP_BLOCKED [ver-update]: ...`.
- **Notes:** `releaseReadiness.test.ts` hardcodes the current version string and the newest `changelogs/<versionCode>.txt` filename, so a bump is a test edit too. `schemaVersion` / `minDirectUpgradeSchema` move only on a real storage-schema change.
