# CI Guide - Step Readme

- **Prompt:** `prompts/preflight/run-uni/ci-guide.md`
- **Step ID:** ci-guide - **Type:** REUSABLE - **Phase:** B (antigravity)
- **Run it when:** every release, against the exact commit being tagged.
- **Reads:** GitHub Actions conclusions for that commit, `dist/` after a build.
- **Writes:** nothing - report only.
- **Pass signal:** `OK [ci-guide] files=0` with a per-workflow conclusion table.
- **Fail signal:** `STEP_BLOCKED [ci-guide]: ...`.
- **Notes:** Without a token or on a private repository, say the remote status could not be read rather than inferring it. Only files directly inside `prompts/` are published into the app; `prompts/preflight/` must never appear in `dist/`.
