# Version Update

This readme is **dual-audience**: **Part 1** explains the step in plain English for whoever is running the preflight; **Part 2** is the technical record for an AI agent or developer.

---

## Part 1: Plain-English Guide

**In plain terms:** Bumps the version everywhere it is written down and rolls the changelog, so all four version files agree.

- **You need this step when:** once per release, before any tag exists.
- **How often:** every release.
- **Which assistant runs it:** AI Studio or Freebuff (release step 3 of 5).
- **How you know it worked:** `OK [ver-update] files=<count>` with the five recorded values.

---

## Part 2: Technical Reference

- **Prompt:** `prompts/preflight/run-uni/ver-update.md`
- **Step ID:** ver-update - **Type:** REUSABLE (once per release via the duplicate guard) - **Phase:** A (ai-studio)
- **Run it when:** once per release, before any tag exists.
- **Reads:** `package.json`, `public/version.json`, `public/status.json`, `src/domain/upgradeGate.ts`, `android-wrapper/app/build.gradle.kts`, `android-wrapper/gradle.properties`, `fastlane/metadata/android/en-US/changelogs/`.
- **Writes:** the five version strings, `CHANGELOG.md`, the Fastlane changelog for the new `versionCode`, and the `ROADMAP.md` release section.
- **Pass signal:** `OK [ver-update] files=<count>` with the five recorded values.
- **Fail signal:** `STEP_BLOCKED [ver-update]: ...`.
- **Notes:** `releaseReadiness.test.ts` hardcodes the current version string and the newest `changelogs/<versionCode>.txt` filename, so a bump is a test edit too. `schemaVersion` / `minDirectUpgradeSchema` move only on a real storage-schema change.
