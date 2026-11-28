# Seed Handshake - Step Readme

- **Prompt:** `prompts/preflight/run-uni/seed-handshake.md`
- **Step ID:** seed-handshake - **Type:** FIRST_TIME - **Phase:** A (ai-studio)
- **Run it when:** the first preflight run in a repository, or after `preflight-reset.mjs --full`.
- **Reads:** `LICENSE`, `docs/handoff-state.json` (if present), `prompts/preflight/handoff-state.schema.json`.
- **Writes:** `docs/handoff-state.json` (create/validate only), `.nojekyll`, `THIRD_PARTY_NOTICES.md` (stub only when absent).
- **Pass signal:** `OK [seed-handshake] files=<count>`.
- **Fail signal:** `STEP_BLOCKED [seed-handshake]: ...`.
- **Notes:** Never rewrite `history[]` and never invent a completion timestamp. The notices stub is deliberately unopinionated; `attribution-audit` classifies licenses per release.
