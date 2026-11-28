# Per-Release Attribution And Licensing Audit

**Last Updated:** November 28, 2026, 2:30 AM CST **Execution & Standalone Mode:** Phase B (Anti-Gravity / local CLI) \[PER-RELEASE\] in pf-launcher-uni.md; runnable standalone.

- **Step ID:** attribution-audit
- **Phase & Lifecycle:** Phase B (antigravity) \[PER-RELEASE\] (never retired by AGENT\_SKIP\_LINE)
- **Allowed Diff Scope:** `THIRD_PARTY_NOTICES.md`, `public/THIRD_PARTY_NOTICES.txt`, `LICENSE` (only to restore missing text), `README.md` source-disclosure link
- **Companion Readme:** `prompts/preflight/run-uni/read/audit-readme.md`
- **Log Entry:** `{ "step_id": "attribution-audit", "branch": "<branch-name>", "version": "<version-tag>", "head_sha": "<HEAD|sandbox-uncommitted>", "platform": "antigravity", "status": "completed", "completed_at": "<YYYY-MM-DDTHH:MM:SSZ>", "touched_files": [] }`
- **Purpose:** Discharge the AGPL-3.0 network-use obligation every time a new build is published, not just at the first release.

# 1\. Project License

- `LICENSE` contains the full AGPL-3.0-or-later text and `package.json` `license` stays `AGPL-3.0-or-later`.
- The app's About/footer links to the public source repository, because AGPL-3.0 requires offering source to network users. Missing link is a blocker, not a nice-to-have.

# 2\. Third-Party Inventory

- Regenerate the dependency list from `package-lock.json` (production dependencies at minimum, full tree preferred) and diff it against `THIRD_PARTY_NOTICES.md`.
- Every new or removed package must appear or disappear in the notices file. Flag anything whose license is not MIT/BSD/ISC/Apache-2.0/CC0/CC-BY/AFL/BlueOak/0BSD/Unlicense/AGPL for human review - do not guess a compatible license.
- Note the bundled runtime assets that are not npm packages: the sql.js WASM build, Tesseract worker assets, the bundled icon set, and any Google Fonts usage (loaded at runtime, not redistributed).
- If `public/THIRD_PARTY_NOTICES.txt` exists, keep it byte-identical to the tracked Markdown copy's content minus Markdown syntax.

# 3\. Hygiene And Provenance

- No personal legal names, private email addresses, local filesystem paths, or machine names in tracked files, release notes, or the notices file.
- New source files carry an SPDX header matching the repo convention; workflows keep `SPDX-FileCopyrightText` / `SPDX-License-Identifier` headers.
- No vendored code of unknown origin, no minified blob checked in without a source pointer, no dependency added "just for the build" inside `src/`.

# 4\. Exit Contract

- Emit `OK [attribution-audit] files=<count>` with the package count and any flagged licenses, or `STEP_BLOCKED [attribution-audit]: <1-2 line reason> | Reverted: <files> | Resume: fix issue and re-run launcher.`
