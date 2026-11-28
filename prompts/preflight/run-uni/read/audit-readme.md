# Attribution Audit

This readme is **dual-audience**: **Part 1** explains the step in plain English for whoever is running the preflight; **Part 2** is the technical record for an AI agent or developer.

---

## Part 1: Plain-English Guide

**In plain terms:** Audits third-party licences and attribution, then writes the notices file, so the project stays legally clean as dependencies change.

- **You need this step when:** every release, after dependencies are installed and before signing off.
- **How often:** every release.
- **Which assistant runs it:** AI Studio or Freebuff (release step 2 of 5).
- **How you know it worked:** `OK [attribution-audit] files=<count>` with the package count and flagged licenses.

---

## Part 2: Technical Reference

- **Prompt:** `prompts/preflight/run-uni/audit.md`
- **Step ID:** attribution-audit - **Type:** REUSABLE (once per release via the duplicate guard) - **Phase:** A (ai-studio)
- **Run it when:** every release, after dependencies are installed and before signing off.
- **Reads:** `package-lock.json`, `THIRD_PARTY_NOTICES.md`, `LICENSE`, `README.md`, `package.json`.
- **Writes:** `THIRD_PARTY_NOTICES.md`, `public/THIRD_PARTY_NOTICES.txt` (when present), and the source-disclosure link.
- **Pass signal:** `OK [attribution-audit] files=<count>` with the package count and flagged licenses.
- **Fail signal:** `STEP_BLOCKED [attribution-audit]: ...`.
- **Human-only:** legal sign-off on any non-standard license.
- **Notes:** AGPL-3.0 requires offering source to network users, so a missing public-source link blocks the release. Never guess that a license is compatible.
