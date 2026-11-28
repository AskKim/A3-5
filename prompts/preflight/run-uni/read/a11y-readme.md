# Accessibility Setup - Step Readme

- **Prompt:** `prompts/preflight/run-uni/a11y.md`
- **Step ID:** a11y-setup - **Type:** FIRST_TIME - **Phase:** A (ai-studio)
- **Run it when:** the first release run, or after a full UI rewrite; it establishes structure once.
- **Reads:** `index.html`, `src/components/`, `src/index.css`.
- **Writes:** accessibility markup and CSS in those files only.
- **Pass signal:** `OK [a11y-setup] files=<count>`.
- **Fail signal:** `STEP_BLOCKED [a11y-setup]: ...`.
- **Notes:** `index.html` is boot-locked; any edit there needs explicit approval in the same run. Later releases only re-run `a11y-check`.
