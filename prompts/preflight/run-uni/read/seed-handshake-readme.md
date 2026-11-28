# Seed Handshake

This readme is **dual-audience**: **Part 1** explains the step in plain English for whoever is running the preflight; **Part 2** is the technical record for an AI agent or developer.

---

## Part 1: Plain-English Guide

**In plain terms:** Starts the paper trail: it creates the state file that tracks which jobs are done, plus the small repo files every later step assumes already exist.

- **You need this step when:** the first preflight run in a repository, or after `preflight-reset.mjs --full`.
- **How often:** once, then it ticks itself off and never runs again.
- **Which assistant runs it:** AI Studio (Phase A).
- **How you know it worked:** `OK [seed-handshake] files=<count>`.

---

## Part 2: Technical Reference

- **Prompt:** `prompts/preflight/run-uni/seed-handshake.md`
- **Step ID:** seed-handshake - **Type:** FIRST_TIME - **Phase:** A (ai-studio)
- **Run it when:** the first preflight run in a repository, or after `preflight-reset.mjs --full`.
- **Reads:** `LICENSE`, `docs/handoff-state.json` (if present), `prompts/preflight/handoff-state.schema.json`.
- **Writes:** `docs/handoff-state.json` (create/validate only), `.nojekyll`, `THIRD_PARTY_NOTICES.md` (stub only when absent).
- **Pass signal:** `OK [seed-handshake] files=<count>`.
- **Fail signal:** `STEP_BLOCKED [seed-handshake]: ...`.
- **Notes:** Never rewrite `history[]` and never invent a completion timestamp. The notices stub is deliberately unopinionated; `attribution-audit` classifies licenses per release.
