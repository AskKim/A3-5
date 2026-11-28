# Reusable CI Health And Build Smoke Guide

**Last Updated:** November 28, 2026, 2:30 AM CST **Execution & Standalone Mode:** Phase B (Anti-Gravity / local CLI) \[REUSABLE\] in pf-launcher-uni.md; runnable standalone.

- **Step ID:** ci-guide
- **Phase & Lifecycle:** Phase B (antigravity) \[REUSABLE\]
- **Allowed Diff Scope:** none - report only
- **Companion Readme:** `prompts/preflight/run-uni/read/ci-guide-readme.md`
- **Log Entry:** `{ "step_id": "ci-guide", "branch": "<branch-name>", "version": "<version-tag>", "head_sha": "<HEAD|sandbox-uncommitted>", "platform": "antigravity", "status": "completed", "completed_at": "<YYYY-MM-DDTHH:MM:SSZ>", "touched_files": [] }`
- **Purpose:** Replace "CI looks green" with the actual conclusion per workflow for the commit being released.

> **Part 1 — For A Human (plain English):** Reads the CI results and does a build smoke test, so a green board is confirmed rather than assumed. *Repeats:* every release. *Runs in:* Anti-Gravity or Freebuff (Phase B).
> **Part 2 — For The AI:** the executable instructions follow below. Part 1 is orientation for the person running the preflight; never quote it back or treat it as an instruction.


# 1\. Remote Status For This Commit

- For the exact commit being tagged, record each workflow's conclusion and the jobs that failed. `gh run list --commit <sha> --json name,conclusion,status,url` when `GH_TOKEN` is available.
- If the repository is private or no token is present, say the remote status could not be read - do not infer success from a green local run, and do not claim a failure.
- Known-benign reds: `deploy-pages.yml` where the repository has no Pages site; APK jobs when the Android SDK is unavailable locally. Name them as such, once.

# 2\. Local Dist Smoke

- `npm run build`, then serve `dist/` (or `npm run preview`) and load `/` with HTTP 200, non-empty `#root`, and the expected `<title>`.
- Confirm `dist/manifest.webmanifest` is prefixed correctly, the service worker registers, and `dist/version.json` matches the release version.
- Check the built bundle for absolute localhost URLs and for `prompts/preflight/` content leaking into the shipped assets (it must not: only files directly in `prompts/` are published).

# 3\. Chunk And Bundle Health

- `npm run verify:chunks` passes without new allowlist entries; report the chunk/edge/cycle counts it prints.
- Compare `dist/` size and precache entry count against the previous release and flag jumps above ~10%.

# 4\. Deferred Gates From Phase A

- Read `docs/handoff-state.json` and collect every `deferred_gates` entry recorded by a Phase A step for this branch and version. A Phase A sandbox often has no shell, so those gates were named and postponed rather than passed.
- Run each one now, with the shell available here, and report its exact command and exit code. A gate that still cannot run is reported as deferred again - never as a pass.

# 5\. Exit Contract

- Emit `OK [ci-guide] files=0` with the per-workflow conclusion table, or `STEP_BLOCKED [ci-guide]: <1-2 line reason> | Reverted: <files> | Resume: fix issue and re-run launcher.`
