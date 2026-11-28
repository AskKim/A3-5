# Attribution Audit - Step Readme

- **Prompt:** `prompts/preflight/run-uni/audit.md`
- **Step ID:** attribution-audit - **Type:** PER_RELEASE - **Phase:** B (antigravity)
- **Run it when:** every release, after dependencies are installed and before signing off.
- **Reads:** `package-lock.json`, `THIRD_PARTY_NOTICES.md`, `LICENSE`, `README.md`, `package.json`.
- **Writes:** `THIRD_PARTY_NOTICES.md`, `public/THIRD_PARTY_NOTICES.txt` (when present), and the source-disclosure link.
- **Pass signal:** `OK [attribution-audit] files=<count>` with the package count and flagged licenses.
- **Fail signal:** `STEP_BLOCKED [attribution-audit]: ...`.
- **Human-only:** legal sign-off on any non-standard license.
- **Notes:** AGPL-3.0 requires offering source to network users, so a missing public-source link blocks the release. Never guess that a license is compatible.
