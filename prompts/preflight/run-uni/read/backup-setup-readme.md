# Backup Setup - Step Readme

- **Prompt:** `prompts/preflight/run-uni/backup-setup.md`
- **Step ID:** backup-setup - **Type:** FIRST_TIME - **Phase:** B (antigravity)
- **Run it when:** the first local run before any release step is allowed to edit files.
- **Reads:** git state (`HEAD`, branch, `git status -s`).
- **Writes:** nothing inside the repository - the snapshot is written outside it (for example `/tmp/`).
- **Pass signal:** `OK [backup-setup] files=0` with snapshot path, verify result, and restore command.
- **Fail signal:** `STEP_BLOCKED [backup-setup]: ...`.
- **Notes:** An unverified snapshot does not count as a backup. Unrelated uncommitted work at the start of the step is a hard stop; ask before continuing.
