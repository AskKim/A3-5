# AI Baseline - Step Readme

- **Prompt:** `prompts/preflight/run-uni/ai.md`
- **Step ID:** ai-baseline - **Type:** FIRST_TIME - **Phase:** A (ai-studio)
- **Run it when:** the first run in a sandbox, to fix the platform classification once.
- **Reads:** `package.json`, `.env.example`, dev-server behaviour for `/import/` and `/old/`.
- **Writes:** `docs/handoff-state.json` (platform classification, `last_error: null`).
- **Pass signal:** `OK [ai-baseline] files=0` plus a one-line environment summary.
- **Fail signal:** `STEP_BLOCKED [ai-baseline]: ...`.
- **Notes:** The app needs no environment variables and no backend; a missing env var is never the explanation for a failure here. Record failing checks instead of fixing them in this step.
