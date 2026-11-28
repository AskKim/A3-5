# AI Baseline

This readme is **dual-audience**: **Part 1** explains the step in plain English for whoever is running the preflight; **Part 2** is the technical record for an AI agent or developer.

---

## Part 1: Plain-English Guide

**In plain terms:** Records what this machine can actually do - which tools are installed and which are missing - so later steps know what can be verified here and what must wait for CI.

- **You need this step when:** the first run in a sandbox, to fix the platform classification once.
- **How often:** once, then it ticks itself off and never runs again.
- **Which assistant runs it:** Anti-Gravity or Freebuff (Phase B).
- **How you know it worked:** `OK [ai-baseline] files=0` plus a one-line environment summary.

---

## Part 2: Technical Reference

- **Prompt:** `prompts/preflight/run-uni/ai.md`
- **Step ID:** ai-baseline - **Type:** FIRST_TIME - **Phase:** B (antigravity)
- **Run it when:** the first run in a sandbox, to fix the platform classification once.
- **Reads:** `package.json`, `.env.example`, dev-server behaviour for `/import/` and `/old/`.
- **Writes:** `docs/handoff-state.json` (platform classification, `last_error: null`).
- **Pass signal:** `OK [ai-baseline] files=0` plus a one-line environment summary.
- **Fail signal:** `STEP_BLOCKED [ai-baseline]: ...`.
- **Notes:** The app needs no environment variables and no backend; a missing env var is never the explanation for a failure here. Record failing checks instead of fixing them in this step.
