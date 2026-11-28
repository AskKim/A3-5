# CI Guide

This readme is **dual-audience**: **Part 1** explains the step in plain English for whoever is running the preflight; **Part 2** is the technical record for an AI agent or developer.

---

## Part 1: Plain-English Guide

**In plain terms:** Reads the CI results and does a build smoke test, so a green board is confirmed rather than assumed.

- **You need this step when:** every release, against the exact commit being tagged.
- **How often:** every release.
- **Which assistant runs it:** Anti-Gravity or Freebuff (Phase B).
- **How you know it worked:** `OK [ci-guide] files=0` with a per-workflow conclusion table.

---

## Part 2: Technical Reference

- **Prompt:** `prompts/preflight/run-uni/ci-guide.md`
- **Step ID:** ci-guide - **Type:** REUSABLE - **Phase:** B (antigravity)
- **Run it when:** every release, against the exact commit being tagged.
- **Reads:** GitHub Actions conclusions for that commit, `dist/` after a build.
- **Writes:** nothing - report only.
- **Pass signal:** `OK [ci-guide] files=0` with a per-workflow conclusion table.
- **Fail signal:** `STEP_BLOCKED [ci-guide]: ...`.
- **Notes:** Without a token or on a private repository, say the remote status could not be read rather than inferring it. Only files directly inside `prompts/` are published into the app; `prompts/preflight/` must never appear in `dist/`.
