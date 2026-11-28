# Modularity Check - Step Readme

- **Prompt:** `prompts/preflight/run-uni/modularity-check.md`
- **Step ID:** modularity-check - **Type:** REUSABLE - **Phase:** B (antigravity)
- **Run it when:** every release candidate, and after any refactor that moves modules across layers.
- **Reads:** `package.json` scripts, `tsconfig*.json`, `vite.config.ts`, `scripts/layer-allowlist.json`, `EXTRACTION_INVENTORY.md`, `MODULES.md`.
- **Writes:** only source files needed to fix a confirmed violation; no speculative restructuring.
- **Pass signal:** `OK [modularity-check] files=<count>` with the scorecard and `Estimated Modularity: <n>%`.
- **Fail signal:** `STEP_BLOCKED [modularity-check]: ...`.
- **Notes:** It is project-agnostic: it discovers the target repository's layers and audit scripts instead of assuming this one's names. Report any audit that silently skipped its checks (a gate guarded by an `existsSync` on a missing input) as a finding, not as a pass - that is the failure mode this step exists to catch.
