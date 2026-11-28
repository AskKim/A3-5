# Accessibility Check - Step Readme

- **Prompt:** `prompts/preflight/run-uni/a11y-check.md`
- **Step ID:** a11y-check - **Type:** REUSABLE - **Phase:** A (ai-studio)
- **Run it when:** every release, scoped to the changed UI files.
- **Reads:** `git diff` hunks for components, CSS, and HTML only.
- **Writes:** nothing unless the step is given an explicit fix scope; a regression is reported, not silently patched.
- **Pass signal:** `OK [a11y-check] files=<count>`.
- **Fail signal:** `STEP_BLOCKED [a11y-check]: ...`.
- **Notes:** In a sandbox without a live URL, inspect source and defer viewport/zoom checks to Phase B (`release-check-p2`, `release-plan`).
