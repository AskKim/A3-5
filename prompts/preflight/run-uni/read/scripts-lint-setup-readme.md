# Scripts And Lint Setup - Step Readme

- **Prompt:** `prompts/preflight/run-uni/scripts-lint-setup.md`
- **Step ID:** scripts-lint-setup - **Type:** FIRST_TIME - **Phase:** B (antigravity)
- **Run it when:** the first local-CLI run on a repository or branch.
- **Reads:** `prompts/preflight/scripts/`, `prompts/preflight/preflight.manifest.json`, `prompts/preflight/run-uni/`, `prompts/preflight/preflight.config.json`.
- **Writes:** nothing.
- **Pass signal:** `OK [scripts-lint-setup] files=<count>`.
- **Fail signal:** `STEP_BLOCKED [scripts-lint-setup]: ...`.
- **Notes:** The linter skips its mate-link check when `run-uni/read/` is absent and its prefix check when `templates/pf-launcher-uni-clean.md` is absent - both still print `PREFLIGHT_LINT_OK`. Treat a silent skip as a failure and say which input was missing.
