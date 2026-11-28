# Reusability Check

This readme is **dual-audience**: **Part 1** explains the step in plain English for whoever is running the preflight; **Part 2** is the technical record for an AI agent or developer.

---

## Part 1: Plain-English Guide

**In plain terms:** Checks that shared code is genuinely generic - no leftover livestock-specific words or one-off assumptions hiding inside the reusable parts.

- **You need this step when:** every release candidate, and before any extraction into a shared package.
- **How often:** every release.
- **Which assistant runs it:** AI Studio (Phase A).
- **How you know it worked:** `OK [reusability-check] files=<count>` with the scorecard, duplication counts, and `Estimated Reusability: <n>%`.

---

## Part 2: Technical Reference

- **Prompt:** `prompts/preflight/run-uni/reusability-check.md`
- **Step ID:** reusability-check - **Type:** REUSABLE - **Phase:** A (ai-studio)
- **Run it when:** every release candidate, and before any extraction into a shared package.
- **Reads:** shared layers (`src/engine/`, `src/features/`, `src/utils/`), barrel exports, `configure*`/`reset*` seams, `package.json`.
- **Writes:** shared modules, their callers, inventories, and tests - no speculative wrappers around one-off code.
- **Pass signal:** `OK [reusability-check] files=<count>` with the scorecard, duplication counts, and `Estimated Reusability: <n>%`.
- **Fail signal:** `STEP_BLOCKED [reusability-check]: ...`.
- **Notes:** Consolidation must target an existing canonical owner (`@engine/primitives/*`, `@engine/binaryEncoding`, feature modules) rather than creating a second home for the same helper. Heavy optional libraries (ZIP, OCR, SQLite) stay out of startup primitives.
