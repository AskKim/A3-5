# Release Plan

This readme is **dual-audience**: **Part 1** explains the step in plain English for whoever is running the preflight; **Part 2** is the technical record for an AI agent or developer.

---

## Part 1: Plain-English Guide

**In plain terms:** Turns everything the earlier steps proved into one ordered cut plan, then hands the irreversible parts - publishing, the live site, legal sign-off - to you.

- **You need this step when:** last, once every other step is `completed` for this branch and version.
- **How often:** every release.
- **Which assistant runs it:** Anti-Gravity or Freebuff (Phase B).
- **How you know it worked:** `OK [release-plan] files=<count>` plus the ordered cut plan and the exact tag name; then `COMPLETE`.

---

## Part 2: Technical Reference

- **Prompt:** `prompts/preflight/run-uni/release-plan.md`
- **Step ID:** release-plan - **Type:** REUSABLE (once per release via the duplicate guard) - **Phase:** B (antigravity)
- **Run it when:** last, once every other step is `completed` for this branch and version.
- **Reads:** `docs/handoff-state.json`, `package.json`, `CHANGELOG.md`, `ROADMAP.md`, git state.
- **Writes:** `ROADMAP.md` release section and final `CHANGELOG.md` wording only.
- **Pass signal:** `OK [release-plan] files=<count>` plus the ordered cut plan and the exact tag name; then `COMPLETE`.
- **Fail signal:** `STEP_BLOCKED [release-plan]: ...`.
- **Human-only:** device smoke test, GitHub About/branch protection, legal sign-off, publishing the release and updating the live site.
- **Notes:** Tag must be `v<package.json version>` or `release.yml` rejects it. Never push to the branch that serves the live site unless the owner asked for "update release".
