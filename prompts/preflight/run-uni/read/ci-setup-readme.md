# CI Setup - Step Readme

- **Prompt:** `prompts/preflight/run-uni/ci-setup.md`
- **Step ID:** ci-setup - **Type:** FIRST_TIME - **Phase:** B (antigravity)
- **Run it when:** the first local run, to align CI with the documented local gates.
- **Reads:** `.github/workflows/*.yml`, `package.json` scripts.
- **Writes:** `.github/workflows/` only when a confirmed gate gap needs wiring.
- **Pass signal:** `OK [ci-setup] files=<count>` with the parity table.
- **Fail signal:** `STEP_BLOCKED [ci-setup]: ...`.
- **Notes:** Gates CI currently omits: `verify:prompts`, `verify:modules`, `verify:android`, `verify:contract`, `verify:coverage`. Wire each one or state why it is safe to leave out. `deploy-pages.yml` cannot succeed where no Pages site exists; that is a hosting setting, not a code defect.
