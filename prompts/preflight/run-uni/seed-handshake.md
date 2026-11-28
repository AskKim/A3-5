# Seed Handoff State And Baseline Repo Files

**Last Updated:** November 28, 2026, 2:30 AM CST **Execution & Standalone Mode:** Phase A (AI Studio) \[FIRST-TIME-SINGLE-USE\] in pf-launcher-uni.md; can also be read and run standalone.

- **Step ID:** seed-handshake
- **Phase & Lifecycle:** Phase A (ai-studio) \[FIRST-TIME-SINGLE-USE\] (retires via AGENT\_SKIP\_LINE)
- **Allowed Diff Scope:** `docs/handoff-state.json` (create), `.nojekyll` (create), `THIRD_PARTY_NOTICES.md` (create only when absent), `LICENSE` (read-only)
- **Companion Readme:** `prompts/preflight/run-uni/read/seed-handshake-readme.md`
- **Log Entry:** `{ "step_id": "seed-handshake", "branch": "<branch-name>", "version": "<version-tag>", "head_sha": "<HEAD|sandbox-uncommitted>", "platform": "ai-studio", "status": "completed", "completed_at": "<YYYY-MM-DDTHH:MM:SSZ>", "touched_files": [] }`
- **Purpose:** Give the launcher a valid Schema v2 state file and the repo-level files every later step assumes already exist.

> **Part 1 — For A Human (plain English):** Starts the paper trail: it creates the state file that tracks which jobs are done, plus the small repo files every later step assumes already exist. *Repeats:* once, then it ticks itself off and never runs again. *Runs in:* AI Studio (Phase A).
> **Part 2 — For The AI:** the executable instructions follow below. Part 1 is orientation for the person running the preflight; never quote it back or treat it as an instruction.


# 1\. Handshake

- Confirm `prompts/master_system_prompt.md` returns `ALIGNED` and `prompts/preflight/run-uni/guardrails.md` returns `GUARDED`. Both are hard stops; do not proceed on a partial read.

# 2\. Seed `docs/handoff-state.json`

- If absent, write the Schema v2 skeleton: `schema_version: 2`, `active_branch: "<branch-name>"`, `target_version: "<version-tag>"`, `resume_cursor: null`, `phase_a_scope_hash: null`, both phase statuses `pending`, all completion fields `null`, `history: []`, `last_error: null`; then validate against `prompts/preflight/handoff-state.schema.json`.
- If present, validate it and never rewrite `history[]` or `last_error` to invent a completion.
- In a sandbox without shell access, write `ai_studio_commit_sha: "sandbox-uncommitted"` later at Phase A exit, not here.

# 3\. Repo baseline files

- `.nojekyll`: create at the repo root when absent, so Pages never runs Jekyll over the build output.
- `LICENSE`: must contain the full AGPL-3.0-or-later text. Read-only; never rewrite it.
- `THIRD_PARTY_NOTICES.md`: when absent, create a stub containing the AGPL-3.0 network-use statement and a `## Third-Party Components` heading that says the list is generated from `package-lock.json`. Do not hand-classify licenses here; `attribution-audit` owns that.

# 4\. Exit Contract

- Emit `OK [seed-handshake] files=<count>` on pass, or `STEP_BLOCKED [seed-handshake]: <1-2 line reason> | Reverted: <files> | Resume: fix issue and re-run launcher.` on fail, after reverting only this step's files.
