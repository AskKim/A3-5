# Release Check

This readme is **dual-audience**: **Part 1** explains the step in plain English for whoever is running the preflight; **Part 2** is the technical record for an AI agent or developer.

---

## Part 1: Plain-English Guide

**In plain terms:** The release sanity pass: proves the version numbers, notices, docs and build all agree with each other before anything is published.

- **You need this step when:** once per phase, on the exact commit you intend to tag.
- **How often:** every release.
- **Which assistant runs it:** either assistant (both phases).
- **How you know it worked:** `OK [release-check-p1|release-check-p2] files=0` with a one-line verdict per bullet.

---

## Part 2: Technical Reference

- **Prompt:** `prompts/preflight/run-uni/release-check.md`
- **Step IDs:** release-check-p1 (first half), release-check-p2 (second half) - **Type:** REUSABLE
- **Run it when:** once per phase, on the exact commit you intend to tag.
- **Reads:** the four version files, `public/version.json` release notes, `docs/handoff-state.json`, `git diff --stat`.
- **Writes:** nothing; it is a gate report.
- **Pass signal:** `OK [release-check-p1|release-check-p2] files=0` with a one-line verdict per bullet.
- **Fail signal:** `STEP_BLOCKED [<step_id>]: ...`.
- **Notes:** The two halves are delimited by `<!-- RELEASE_CHECK_1_START -->`, `<!-- RELEASE_CHECK_1_END -->`, `<!-- RELEASE_CHECK_2_START -->`, and `<!-- RELEASE_CHECK_2_END -->`; read only the half for the step you were handed, and never read the other half as well. Never report a gate you did not run, and never record a skipped gate as passing.
