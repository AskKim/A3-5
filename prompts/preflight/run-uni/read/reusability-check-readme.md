# Reusability Check - Step Readme

- **Prompt:** `prompts/preflight/run-uni/reusability-check.md`
- **Step ID:** reusability-check - **Type:** REUSABLE - **Phase:** B (antigravity)
- **Run it when:** every release candidate, and before any extraction into a shared package.
- **Reads:** shared layers (`src/engine/`, `src/features/`, `src/utils/`), barrel exports, `configure*`/`reset*` seams, `package.json`.
- **Writes:** shared modules, their callers, inventories, and tests - no speculative wrappers around one-off code.
- **Pass signal:** `OK [reusability-check] files=<count>` with the scorecard, duplication counts, and `Estimated Reusability: <n>%`.
- **Fail signal:** `STEP_BLOCKED [reusability-check]: ...`.
- **Notes:** Consolidation must target an existing canonical owner (`@engine/primitives/*`, `@engine/binaryEncoding`, feature modules) rather than creating a second home for the same helper. Heavy optional libraries (ZIP, OCR, SQLite) stay out of startup primitives.
