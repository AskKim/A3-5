# Backup Setup

This readme is **dual-audience**: **Part 1** explains the step in plain English for whoever is running the preflight; **Part 2** is the technical record for an AI agent or developer.

---

## Part 1: Plain-English Guide

**In plain terms:** Sets up the backup habit: where snapshots are kept and how to take one before touching anything risky.

- **You need this step when:** the first local run before any release step is allowed to edit files.
- **How often:** once, then it ticks itself off and never runs again.
- **Which assistant runs it:** Anti-Gravity or Freebuff (Phase B).
- **How you know it worked:** `OK [backup-setup] files=0` with snapshot path, verify result, and restore command.

---

## Part 2: Technical Reference

- **Prompt:** `prompts/preflight/run-uni/backup-setup.md`
- **Step ID:** backup-setup - **Type:** FIRST_TIME - **Phase:** B (antigravity)
- **Run it when:** the first local run before any release step is allowed to edit files.
- **Reads:** git state (`HEAD`, branch, `git status -s`).
- **Writes:** nothing inside the repository - the snapshot is written outside it (for example `/tmp/`).
- **Pass signal:** `OK [backup-setup] files=0` with snapshot path, verify result, and restore command.
- **Fail signal:** `STEP_BLOCKED [backup-setup]: ...`.
- **Notes:** An unverified snapshot does not count as a backup. Unrelated uncommitted work at the start of the step is a hard stop; ask before continuing.
