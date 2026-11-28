# Scripts And Lint Setup

This readme is **dual-audience**: **Part 1** explains the step in plain English for whoever is running the preflight; **Part 2** is the technical record for an AI agent or developer.

---

## Part 1: Plain-English Guide

**In plain terms:** Confirms the preflight helper scripts themselves run correctly on this machine, before you rely on them.

- **You need this step when:** the first local-CLI run on a repository or branch.
- **How often:** once, then it ticks itself off and never runs again.
- **Which assistant runs it:** Anti-Gravity or Freebuff (Phase B).
- **How you know it worked:** `OK [scripts-lint-setup] files=<count>`.

---

## Part 2: Technical Reference

- **Prompt:** `prompts/preflight/run-uni/scripts-lint-setup.md`
- **Step ID:** scripts-lint-setup - **Type:** FIRST_TIME - **Phase:** B (antigravity)
- **Run it when:** the first local-CLI run on a repository or branch.
- **Reads:** `prompts/preflight/scripts/`, `prompts/preflight/preflight.manifest.json`, `prompts/preflight/run-uni/`, `prompts/preflight/preflight.config.json`.
- **Writes:** nothing.
- **Pass signal:** `OK [scripts-lint-setup] files=<count>`.
- **Fail signal:** `STEP_BLOCKED [scripts-lint-setup]: ...`.
- **Notes:** The linter skips its mate-link check when `run-uni/read/` is absent and its prefix check when `templates/pf-launcher-uni-clean.md` is absent - both still print `PREFLIGHT_LINT_OK`. Treat a silent skip as a failure and say which input was missing.
