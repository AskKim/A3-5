# Accessibility Check

This readme is **dual-audience**: **Part 1** explains the step in plain English for whoever is running the preflight; **Part 2** is the technical record for an AI agent or developer.

---

## Part 1: Plain-English Guide

**In plain terms:** Re-runs the accessibility audit before a release and fixes only what genuinely regressed, so the app stays usable by keyboard and screen reader.

- **You need this step when:** every release, scoped to the changed UI files.
- **How often:** every release.
- **Which assistant runs it:** AI Studio (Phase A).
- **How you know it worked:** `OK [a11y-check] files=<count>`.

---

## Part 2: Technical Reference

- **Prompt:** `prompts/preflight/run-uni/a11y-check.md`
- **Step ID:** a11y-check - **Type:** REUSABLE - **Phase:** A (ai-studio)
- **Run it when:** every release, scoped to the changed UI files.
- **Reads:** `git diff` hunks for components, CSS, and HTML only.
- **Writes:** nothing unless the step is given an explicit fix scope; a regression is reported, not silently patched.
- **Pass signal:** `OK [a11y-check] files=<count>`.
- **Fail signal:** `STEP_BLOCKED [a11y-check]: ...`.
- **Notes:** In a sandbox without a live URL, inspect source and defer viewport/zoom checks to Phase B (`release-check-p2`, `release-plan`).
