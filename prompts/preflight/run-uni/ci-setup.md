# One-Time CI Pipeline Setup

**Last Updated:** November 28, 2026, 2:30 AM CST **Execution & Standalone Mode:** Phase B (Anti-Gravity / local CLI) \[FIRST-TIME-SINGLE-USE\] in pf-launcher-uni.md; can also be read and run standalone.

- **Step ID:** ci-setup
- **Phase & Lifecycle:** Phase B (antigravity) \[FIRST-TIME-SINGLE-USE\] (retires via AGENT\_SKIP\_LINE)
- **Allowed Diff Scope:** `.github/workflows/` only, and only when a real gate gap is confirmed
- **Companion Readme:** `prompts/preflight/run-uni/read/ci-setup-readme.md`
- **Log Entry:** `{ "step_id": "ci-setup", "branch": "<branch-name>", "version": "<version-tag>", "head_sha": "<HEAD|sandbox-uncommitted>", "platform": "antigravity", "status": "completed", "completed_at": "<YYYY-MM-DDTHH:MM:SSZ>", "touched_files": [] }`
- **Purpose:** Make CI run the same gates the human is told to run locally, once, so "green CI" and "green release" mean the same thing.

# 1\. Workflow Inventory

- List every workflow and what it actually runs. Expect: `ci.yml` (tests, improvements, layers, engine, extraction, lint, build, chunks, subpath build), `guardrails.yml` (workflow YAML, protected folders, isolation, allowlist), `preflight.yml` (preflight lint + manifest + context), `security-audit.yml`, `release.yml` (version alignment, bundle, APK, release), `build-android-apk.yml`, `deploy-pages.yml`.

# 2\. Gate Parity Check

- Compare CI against `npm run verify`. Gates CI currently does not run: `verify:prompts`, `verify:modules`, `verify:android`, `verify:contract`, `verify:coverage`. Decide per gate: wire it into `ci.yml`, or state in the step report why it is safe to leave out. Do not silently drop one.
- `verify:chunks` needs a preceding `npm run build`; keep that order.
- Explain any workflow that cannot succeed in the target repository (for example `deploy-pages.yml` when that repository has no Pages site configured) as a hosting setting, not a code defect, and do not "fix" it by deleting the workflow.

# 3\. Secrets And Permissions

- Expected optional secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Their absence must degrade to an unsigned APK, never fail the run.
- Confirm no workflow writes `NODE_ENV=production` onto `npm ci` and no secret is echoed.
- `permissions:` stays least-privilege (`contents: write` only for release).

# 4\. Exit Contract

- Emit `OK [ci-setup] files=<count>` with the parity table, or `STEP_BLOCKED [ci-setup]: <1-2 line reason> | Reverted: <files> | Resume: fix issue and re-run launcher.`
