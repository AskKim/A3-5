# Preflight Generation - Step Readme

- **Prompt:** `prompts/preflight/run-uni/preflight-gen.md`
- **Step ID:** not scheduled by the manifest; helper prompt for maintainers.
- **Run it when:** the manifest changed and the wiring table or launcher TOC must be regenerated.
- **Reads:** `prompts/preflight/manifest/preflight.manifest.json`.
- **Writes:** `prompts/preflight/pf-launcher-uni-wiring.md` and the launcher TOC - only with `--write-wiring`; without the flag the script validates and prints the step count.
- **Pass signal:** `Preflight manifest validated (<n> steps).`
- **Fail signal:** `Manifest validation errors: ...`, non-zero exit.
- **Notes:** The launcher's static header and `=== CONSTRAINTS ===` block must stay byte-identical (prompt-cache prefix), so review the diff before committing a regeneration.
