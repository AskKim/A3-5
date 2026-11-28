# Accessibility Setup

This readme is **dual-audience**: **Part 1** explains the step in plain English for whoever is running the preflight; **Part 2** is the technical record for an AI agent or developer.

---

## Part 1: Plain-English Guide

**In plain terms:** Turns on the accessibility checks: it inspects the app as a screen reader and a keyboard would, and records today as the baseline every later release is measured against.

- **You need this step when:** the first release run, or after a full UI rewrite; it establishes structure once.
- **How often:** once, then it ticks itself off and never runs again.
- **Which assistant runs it:** AI Studio (Phase A).
- **How you know it worked:** `OK [a11y-setup] files=<count>`.

---

## Part 2: Technical Reference

- **Prompt:** `prompts/preflight/run-uni/a11y.md`
- **Step ID:** a11y-setup - **Type:** FIRST_TIME - **Phase:** A (ai-studio)
- **Run it when:** the first release run, or after a full UI rewrite; it establishes structure once.
- **Reads:** `index.html`, `src/components/`, `src/index.css`.
- **Writes:** accessibility markup and CSS in those files only.
- **Pass signal:** `OK [a11y-setup] files=<count>`.
- **Fail signal:** `STEP_BLOCKED [a11y-setup]: ...`.
- **Notes:** `index.html` is boot-locked; any edit there needs explicit approval in the same run. Later releases only re-run `a11y-check`.
