# CI Setup

This readme is **dual-audience**: **Part 1** explains the step in plain English for whoever is running the preflight; **Part 2** is the technical record for an AI agent or developer.

---

## Part 1: Plain-English Guide

**In plain terms:** Writes the GitHub Actions pipelines that run the checks automatically on every push, so a gate cannot be skipped by forgetting to run it.

- **You need this step when:** the first local run, to align CI with the documented local gates.
- **How often:** once, then it ticks itself off and never runs again.
- **Which assistant runs it:** AI Studio (Phase A).
- **How you know it worked:** `OK [ci-setup] files=<count>` with the parity table.

---

## Part 2: Technical Reference

- **Prompt:** `prompts/preflight/run-uni/ci-setup.md`
- **Step ID:** ci-setup - **Type:** FIRST_TIME - **Phase:** A (ai-studio)
- **Run it when:** the first local run, to align CI with the documented local gates.
- **Reads:** `.github/workflows/*.yml`, `package.json` scripts.
- **Writes:** `.github/workflows/` only when a confirmed gate gap needs wiring.
- **Pass signal:** `OK [ci-setup] files=<count>` with the parity table.
- **Fail signal:** `STEP_BLOCKED [ci-setup]: ...`.
- **Notes:** Gates CI currently omits: `verify:prompts`, `verify:modules`, `verify:android`, `verify:contract`, `verify:coverage`. Wire each one or state why it is safe to leave out. `deploy-pages.yml` cannot succeed where no Pages site exists; that is a hosting setting, not a code defect.
