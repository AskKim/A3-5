# Release Plan - Step Readme

- **Prompt:** `prompts/preflight/run-uni/release-plan.md`
- **Step ID:** release-plan - **Type:** PER_RELEASE - **Phase:** B (antigravity)
- **Run it when:** last, once every other step is `completed` for this branch and version.
- **Reads:** `docs/handoff-state.json`, `package.json`, `CHANGELOG.md`, `ROADMAP.md`, git state.
- **Writes:** `ROADMAP.md` release section and final `CHANGELOG.md` wording only.
- **Pass signal:** `OK [release-plan] files=<count>` plus the ordered cut plan and the exact tag name; then `COMPLETE`.
- **Fail signal:** `STEP_BLOCKED [release-plan]: ...`.
- **Human-only:** device smoke test, GitHub About/branch protection, legal sign-off, publishing the release and updating the live site.
- **Notes:** Tag must be `v<package.json version>` or `release.yml` rejects it. Never push to the branch that serves the live site unless the owner asked for "update release".
