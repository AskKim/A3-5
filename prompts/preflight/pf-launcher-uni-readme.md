# pf-launcher-uni.md Readme

**Last Updated:** November 28, 2026

This readme is a **dual-audience** breakdown, the same shape as `docs/ARCHITECTURE_GUIDE.md`: **Part 1** explains the preflight in plain English for whoever is running a release; **Part 2** is the technical reference for an AI agent or developer changing it. Read only the part that fits you.

---

## Part 1: Plain-English Guide (No Coding Needed)

### 1. What The Preflight Is

The preflight is a release checklist that runs itself. Instead of you ticking boxes by hand, you hand one file - `pf-launcher-uni.md` - to an AI assistant, and it works through the jobs in a fixed order and ticks each one off as it finishes.

The jobs come in two blocks:
- **Block A** - setup and audits that only need the files (connect the repo, accessibility, crawl metadata, modularity).
- **Block B** - checks that need a real machine: a build, the CI results, a backup that was really taken.

The sweep now finishes on its own, every time. The release-only jobs - the version bump, the licence audit, the release checks and the sign-off - live in a separate file, `pf-release-uni.md`, and you only open that when you are actually cutting a release.

### 2. What You Actually Do

1. **Hand the launcher to AI Studio.** It does Block A, then prints a line telling you where to go next.
2. **Hand the same file to Anti-Gravity** for Block B. If you are using **Freebuff**, skip the hand-off entirely: it is named in both blocks, so it runs straight through without stopping in between.
3. **When you are cutting a release,** open `pf-release-uni.md`. It carries the version bump, the licence audit, the release checks and the sign-off, and it stops for you exactly where a signature is required. It will not start until the sweep has finished.
4. **If a job did not finish,** do not edit the file yourself. Tell the AI *"re-arm the `<job-name>` step"*. It knows how, and the checklist stays honest.

### 3. Before You Copy This To Another Repo Or Branch

Ticking a box writes a "done" mark into the launcher. Those marks travel with the file, so a copy taken to a new repository - or pushed from dev to `main` or `release` - arrives already ticked, and the new environment silently skips the setup it never did.

So before any copy, ask the AI to **reset to stock**, or run:

```bash
node prompts/preflight/scripts/gen-preflight.mjs --write   # refresh the clean copy first
node prompts/preflight/scripts/preflight-reset.mjs --full  # then reset the launcher and its state
```

The launcher prints the same reminder as its very last line after `COMPLETE`, so it is hard to miss.

---

## Part 2: AI & Developer Technical Reference

### What This File Is

`prompts/preflight/pf-launcher-uni.md` is a pure token-lean executable modular two-platform release and setup launcher (**Phase A: AI Studio \-\> Phase B: Anti-Gravity**) paired with its wiring architecture doc (`prompts/preflight/pf-launcher-uni-wiring.md`). It is backed by `prompts/preflight/preflight.config.json` (static repo parameters), `prompts/preflight/handoff-state.schema.json` (Schema v2), `prompts/preflight/templates/pf-launcher-uni-clean.md` (pristine copy-ready template), and 6 zero-dependency Node.js helper scripts under `prompts/preflight/scripts/` (`preflight-run-context.mjs`, `preflight-state.mjs`, `preflight-log.mjs`, `preflight-rollback.mjs`, `preflight-lint.mjs`, `preflight-reset.mjs`). It defines standard Exit Banners (`ALIGNED | GUARDED | PHASE_A_COMPLETE | STALE_BLOCKED | STEP_BLOCKED | COMPLETE`) and supports Execution Flags (`--dry-run | --force-rerun <step_id>`). It features two distinct file-edit setups: permanent `AGENT_SKIP_LINE` retirement of completed single-use prompts in the launcher (never applied to reusable prompts), plus per-step state and timestamp logging in `docs/handoff-state.json` supporting cascade-start freshness checks and resume-on-restart behavior. Every prompt and guide module sits in `prompts/preflight/run-uni/`, while its matching `*-readme.md` mate sits in `prompts/preflight/run-uni/read/` (18 modules, 18 mates: 13 in the sweep, 5 in the release runner; `prompts/preflight/scripts/preflight-lint.mjs` fails on any manifest step whose prompt file or mate readme is missing).

### How The Step List Stays Honest

There is exactly one step list: `prompts/preflight/manifest/preflight.manifest.json` (described by `prompts/preflight/manifest/manifest.schema.json`). `prompts/preflight/scripts/gen-preflight.mjs` renders every step-shaped thing in this folder from it — the launcher's two `PHASE_*_STEPS` blocks (keeping any already-retired `AGENT_SKIP_LINE` line verbatim by `step_id`), the module summary, the wiring table, and the pristine template — and `--check` (also wired into `preflight-lint.mjs`) fails the moment one drifts. The same run renders `pf-release-uni.md`, so the release tail cannot drift from the manifest either. Hand-editing a step line is pointless now: the next `npm run preflight:gen -- --write` overwrites it.

Steps come in exactly **two** types. `FIRST_TIME` runs once and then retires itself via `AGENT_SKIP_LINE`. `REUSABLE` never retires. A step that should happen once per release is `REUSABLE`: the duplicate guard in `docs/handoff-state.json` already skips it when `history[]` holds a `completed` entry for the same branch + version + HEAD, so a separate per-release type only forced every consumer to branch on a third case.

Each step is also sorted by the **minimum environment it needs** — never by cost — and then carries an ordered **runner bracket**: `[ai-studio | freebuff]` in Phase A (no shell, git, build or device needed) or `[antigravity | freebuff]` in Phase B (one of those *is* needed). First listed is preferred; that position is the front-loading rule, so the cheapest capable runner takes the step. `freebuff` appears in both brackets because it has a shell and no marginal cost.

### How to Use It

1. Copy `prompts/preflight/templates/pf-launcher-uni-clean.md` into `prompts/preflight/pf-launcher-uni.md` in a target repository and optionally populate static configuration parameters in `prompts/preflight/preflight.config.json` (or fill inline parameters: `<repo-url>`, `<live-url>`, `<subpath>`, `<dev-branch>`, `<release-branch>`, `<branch-name>`, and `<version-tag>`). Uses `--dry-run` and `--force-rerun <step_id>` flags when needed.  
2. Ensure `prompts/master_system_prompt.md` (`aligned`) and `prompts/preflight/run-uni/guardrails.md` (`guarded`) are in place to allow the pre-payload handshake to run.  
3. Hand the launcher to **AI Studio** first to execute Phase A; AI Studio auto-seeds `docs/handoff-state.json`, retires completed single-use steps, logs each step, and marks Phase A complete with a timestamp. It then either prints a notice to move to the next runner or continues straight on, depending on whether its bracket names it in Phase B - a runner named in both brackets (such as `freebuff`) never stops between the blocks. If AI Studio ran in a sandbox without Git CLI (logging "sandbox-uncommitted"), copy the modified files into your local repo so Anti-Gravity can perform the automatic hash handoff and step retirement.  
4. Hand the launcher to **Anti-Gravity** to execute Phase B; Anti-Gravity skips Phase A, verifies Phase A is complete and not stale (by timestamp, commit delta, or version change), automatically runs `node prompts/preflight/scripts/preflight-state.mjs --write-hash` and retires `scripts-lint-setup` via `AGENT_SKIP_LINE` on the first Phase B run if "sandbox-uncommitted" was logged, and runs Phase B—automatically resuming at any previously failed or incomplete step if prior work is still fresh.

### The Two Runners: Sweep And Release

`pf-launcher-uni.md` is the sweep. It runs for any piece of work - a refactor, a docs change, an ordinary merge - and it always reaches the end, because nothing in it needs a decision only the owner can make.

`pf-release-uni.md` is the release tail, rendered from the same manifest. It holds the five steps that only make sense when publishing: `release-check-p1`, `attribution-audit`, `ver-update`, `release-check-p2` and `release-plan`. Two of those declare `human_signoff`, so `preflight-log.mjs` records `awaiting_human` rather than `completed` unless a person passes `--human-signoff "<who/how>"`.

It also will not accept a step at all until the sweep has finished for the same branch and version: the logger checks every sweep step for a `completed` entry and refuses with `RELEASE_BLOCKED`, naming the ones still missing.

A `human_signoff` step in the sweep is a manifest validation error, not a style preference: that is exactly what used to stop every run for a signature.

### Resetting The Launcher (Agent Runbook)

> **If an agent is asked to "reset the launcher", "rearm `<step_id>`", "clear the flags", "reopen Phase A" or "start fresh for a new repo", work from this section and nothing else.** All commands are zero-dependency Node scripts in `prompts/preflight/scripts/`; run them from the repository root.

**Never do these, whatever the request sounds like:**
- Never hand-edit a step line in `prompts/preflight/pf-launcher-uni.md`. Those lines are *generated*; the next `gen-preflight.mjs --write` overwrites them. Change `prompts/preflight/manifest/preflight.manifest.json` and regenerate.
- Never use `git checkout -- .`, `git reset --hard` or `git clean` to "reset" anything. Rollback is step-scoped through `preflight-rollback.mjs`.
- Never copy the tree to another repo or branch with a stale template (refresh first, below).
- Never delete a `history[]` entry by hand and call the step re-armed. Launcher flags and state are two separate mechanisms - see the table.

**Step 1 - refresh the template (always, before any copy):** `node prompts/preflight/scripts/gen-preflight.mjs --write`, then `--check`, which must print `generated files in sync`. The pristine template is generated from the launcher, so a copy taken without this carries older prose and a later `--full` silently restores that older wording.

**Step 2 - pick exactly one row of the table.** They are not interchangeable, and the last column is the one that loses data.

| What the human asked for | Command | Launcher flags | `docs/handoff-state.json` |
|---|---|---|---|
| "start fresh", "new repo", "reset everything" | `preflight-reset.mjs --full` | all re-armed | **file deleted**, copied to `/tmp/pf-handoff-state.<ts>.json` first |
| "let me run `<step_id>` again", "rearm a step" | `preflight-reset.mjs --rearm <step_id>` | that one line only | untouched |
| "reopen Phase A / B so it runs again" | `preflight-reset.mjs --reopen-phase A` (or `B`) | untouched | that phase's status and timestamps, keeps `history[]` |
| "clear the last error" | `preflight-reset.mjs --clear-error` | untouched | `last_error` only |
| "this is a different branch or version now" | `preflight-reset.mjs --branch <b> --version <v>` | untouched | active fields; `history[]` kept |
| "there is no state file yet" | `preflight-reset.mjs --init --branch <b> --version <v>` | untouched | creates it |

Two traps: `--branch`/`--version` is a **no-op when the values already match** (it prints `changed: false`), so use the reopen-phase row instead. And `--full` is the only operation that discards the working state, by deleting the file - it copies the state and the launcher to `/tmp` first and reports both paths as `state_backup` and `launcher_backup`, so quote them rather than assuming nothing was kept.

**Step 3 - read the current flags, do not guess them.**
Retired line: `- [SINGLE-USE-COMPLETED: <YYYY-MM-DD> | step_id: <id> | AGENT_SKIP_LINE: ...]`
Active line: `` - [ ] `[REUSABLE]` `[ai-studio | freebuff]` `step_id: <id>` - `prompts/preflight/run-uni/...md` ``
Audit both with: `grep -c "SINGLE-USE-COMPLETED: 20" prompts/preflight/pf-launcher-uni.md`

**Step 4 - verify before reporting success.**
- `node prompts/preflight/scripts/gen-preflight.mjs --check` → `generated files in sync`
- `node prompts/preflight/scripts/preflight-lint.mjs` → `PREFLIGHT_LINT_OK`
- `node prompts/preflight/scripts/preflight-run-context.mjs --branch <b> --version <v> --dry-run` → `resume_step_id` is where the next run starts. If `ai_studio_status` reads `completed` while Phase A steps are still unretired, the next run will skip them: report that instead of calling the reset clean.

**Step 5 - quote what the command actually printed.** `--full` returns `mode`, `launcher_restored_from`, `launcher_backup`, `state_removed`, `dry_run`; `--rearm` returns `mode`, `step_id`, `changed` (`false` means the step was already active), `restored_line`; `--init`, `--clear-error` and the branch reset return `mode` plus the fields they changed. Use `--dry-run` wherever the script documents it, especially when the human has not clearly authorised a destructive step.

**Manual fallback (no scripts available).** `--full` is exactly "copy the pristine template over the launcher, then remove `docs/handoff-state.json`", so the older by-hand instructions still hold:

**Full Reset (Copying To A Different Website Or Repository):**

0. **Refresh To Stock Before The Copy (do this first):** the pristine template at `prompts/preflight/templates/pf-launcher-uni-clean.md` is *generated* from the launcher, so it only learns about prose or constraint changes when you regenerate. Before copying this tree to another repository, or promoting `dev` → `main` / `main` → `release`, run `node prompts/preflight/scripts/gen-preflight.mjs --write` and require `gen-preflight.mjs --check` to pass. Copying with a stale template means a later `--full` silently restores older wording. The launcher prints the same reminder as its final line after `COMPLETE`.

1. **1-Command Helper:** Run `node prompts/preflight/scripts/preflight-reset.mjs --full` (or with `--init`, `--clear-error`, or `--rearm <step_id>`) to perform a full reset from the pristine template.  
2. **Manual Fallback:** Start from the pristine template in `prompts/preflight/templates/pf-launcher-uni-clean.md`; if copying from an already-used repo copy, revert every `[SINGLE-USE-COMPLETED: ... | AGENT_SKIP_LINE: ...]` line back to its original prompt call.  
3. Replace `<repo-url>`, `<live-url>`, `<subpath>`, `<dev-branch>`, `<release-branch>`, `<branch-name>`, and `<version-tag>` with the new site's values (or update `prompts/preflight/preflight.config.json`).  
4. Delete or omit any prior `docs/handoff-state.json` so the first Phase A (AI Studio) run auto-seeds a clean state log.

**Branch-Local Reset (Copying Or Working Inside An Editable Branch):**

1. **1-Command Helper:** Run `node prompts/preflight/scripts/preflight-reset.mjs --branch <branch-name> --version <version-tag>` to reset active fields while preserving `history[]` and retired `AGENT_SKIP_LINE` markers.  
2. **Manual Fallback:** Keep existing `AGENT_SKIP_LINE` markers intact in `prompts/preflight/pf-launcher-uni.md` unless a specific one-time setup must be re-run on that branch (in which case revert only that line). Commit your branch edits first so `HEAD` advances cleanly, then reset only the active checkpoint fields in `docs/handoff-state.json` (`active_branch`, `target_version`, `ai_studio_status: "pending"`, `ai_studio_completed_at: null`, `ai_studio_commit_sha: null`, `improvement_log_anchor: null`, `antigravity_status: "pending"`, `antigravity_completed_at: null`, `last_error: null`) while preserving `history[]`.

### Related Files

- `prompts/preflight/pf-launcher-uni.md`  
- `prompts/preflight/pf-launcher-uni-wiring.md`  
- `prompts/preflight/templates/pf-launcher-uni-clean.md`  
- `prompts/preflight/manifest/preflight.manifest.json` (single source of truth; edit this, then regenerate)  
- `prompts/preflight/manifest/manifest.schema.json`  
- `prompts/preflight/preflight.config.json`  
- `prompts/preflight/handoff-state.schema.json`  
- `prompts/preflight/scripts/` (`preflight-run-context.mjs`, `preflight-state.mjs`, `preflight-log.mjs`, `preflight-rollback.mjs`, `preflight-lint.mjs`, `preflight-reset.mjs`)  
- `prompts/preflight/run-uni/` and `prompts/preflight/run-uni/read/` (18 paired modules: 13 sweep steps and 5 release steps)