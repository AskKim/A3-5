# Backup Check

This readme is **dual-audience**: **Part 1** explains the step in plain English for whoever is running the preflight; **Part 2** is the technical record for an AI agent or developer.

---

## Part 1: Plain-English Guide

**In plain terms:** Takes the pre-merge backup and proves it can be restored, before the risky part of a release rather than after it.

- **You need this step when:** before merging a release candidate, on the release commit.
- **How often:** every release.
- **Which assistant runs it:** Anti-Gravity or Freebuff (Phase B).
- **How you know it worked:** `OK [backup-check] files=0` with before/after counts per round trip.

---

## Part 2: Technical Reference

- **Prompt:** `prompts/preflight/run-uni/backup-check.md`
- **Step ID:** backup-check - **Type:** REUSABLE - **Phase:** B (antigravity)
- **Run it when:** before merging a release candidate, on the release commit.
- **Reads:** the snapshot from `backup-setup`, the running app's export/import paths.
- **Writes:** nothing in the repository.
- **Pass signal:** `OK [backup-check] files=0` with before/after counts per round trip.
- **Fail signal:** `STEP_BLOCKED [backup-check]: ...`.
- **Notes:** Exercise the destructive path on a scratch copy only. A snapshot taken at a different `HEAD` is stale and does not satisfy this step.
