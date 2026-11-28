# Release Check - Step Readme

- **Prompt:** `prompts/preflight/run-uni/release-check.md`
- **Step IDs:** release-check-p1 (Phase A), release-check-p2 (Phase B) - **Type:** REUSABLE
- **Run it when:** once per phase, on the exact commit you intend to tag.
- **Reads:** the four version files, `public/version.json` release notes, `docs/handoff-state.json`, `git diff --stat`.
- **Writes:** nothing; it is a gate report.
- **Pass signal:** `OK [release-check-p1|release-check-p2] files=0` with a one-line verdict per bullet.
- **Fail signal:** `STEP_BLOCKED [<step_id>]: ...`.
- **Notes:** The two halves are delimited by `<!-- PHASE_A_START -->`, `<!-- PHASE_A_END -->`, `<!-- PHASE_B_START -->`, and `<!-- PHASE_B_END -->`; read only your phase's half. Never report a gate you did not run, and never record a skipped gate as passing.
