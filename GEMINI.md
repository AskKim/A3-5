# Project & Handoff Rules

> Applies to **all** coding assistants, models, and platforms (Gemini, Claude, Codex, Copilot, Cursor, Windsurf, Cline, Roo, Aider, etc.) when working in this repository.

## Token Discipline (Required)
Edit existing files with targeted diffs (`str_replace` / patch), never whole-file rewrites. Report `git diff`, not full file contents. Read only the line window you need, batch independent tool calls, keep scratch files in `/tmp`, and never re-save an account skill just to test read-back. Full rules: `AGENTS.md` §6.

## Live Hosting: Never Without A Request
- `release` — and any other branch a live Pages site, app-store build or installer actually serves — is live infrastructure in active use, possibly in a different repo or dev copy. Never push to it, rebase it, force-push it, port fixes into it, or delete it.
- The Pages/release deploy workflows (`deploy-pages.yml`, `release.yml`), the Pages source setting, the custom domain and the `404.html` / site-identity wiring are equally live: never delete, disable, rename, retarget or "tidy up" them to make a local check pass. Report a live-side problem instead of repairing it by editing the workflow.
- Change any of this only when the current request names it ("update release", "change the Pages source", "edit deploy-pages.yml"). Working in a dev copy is not permission to clean up the live path. Development branches stay unrestricted, and a commit there is not live until the owner republishes the live branch.

## Startup Check: Incomplete Plan / Work Notice
Whenever project rules (`GEMINI.md`, `AGENTS.md`, or `prompts/master_system_prompt.md`) are loaded for a coding task (omit on standalone make-handoff-only requests, read-only Q&A/inline completions, or import-only fast-boot checks) — emit this status **at most once per response** right after `ALIGNED` (never repeat it at the end):
- Check `docs/plans/` (excluding `suggestions-backlog.md`) for `handoff-*.yaml`, `plan-*.yaml`, `handoff.yaml`, or an active `*.md` plan with `[WIP]`/`[TODO]` or uncompleted steps.
- Output **names only** — no `docs/plans/` prefix, no extension, no goal text — one comma-separated line per status right after `ALIGNED` (never at the end), with a name for **every** open file:
  - files with open steps — `PENDING: handoff-<topic>, plan-<topic>`
  - files present with no open steps — `EXISTING INCOMPLETE: handoff-<topic>, plan-<topic>`
- Never name just one: after scanning **all** `handoff-*.yaml` files, finishing the one you are working in says nothing about the rest.
- Every name on the `EXISTING INCOMPLETE:` line is finished work sitting in the tree: delete that file in the same run (report `Cleared: <file>`) instead of listing it again next time. Keep one only when the owner explicitly said to keep it.
- Only when `docs/plans/` holds no `handoff-*`/`plan-*` file at all, output ONE compact line right after `ALIGNED`:
  `NO PENDING WORK`
- Example: `ALIGNED` / `PENDING: handoff-modularity-reusability` / `EXISTING INCOMPLETE: handoff-barn-store-improvements`.

## Auto-Handoff for Complex Features & "Write and Build a Handoff"
Trigger when filesystem write tools are available and asked to build/change a non-trivial feature spanning `>= 3 files` or `>= 3 steps`, OR asked to "write and build a handoff to do X" / "create and build a handoff for X" (skip in read-only/ask/PR-review modes, and skip for trivial single-feature + unit-test pairs unless requested):
- Do NOT write a verbose prose plan, do NOT output the handoff YAML to screen, and do NOT stop after saving the handoff.
- Save/update `docs/plans/handoff-<topic>.yaml` (kebab-case topic slug) internally using the compact YAML schema below, then immediately begin implementing the requested feature.
- **Same-topic collision:** If `docs/plans/handoff-<topic>.yaml` already exists, merge and preserve `[DONE]` items if it shares the same goal; if the goal is distinct, save as `handoff-<topic>-2.yaml` (incrementing as needed).
- **Per-step checkpointing:** Update `docs/plans/handoff-<topic>.yaml` immediately after each step finishes (`[WIP]` -> `[DONE]`, updating `next_action` and `verified`) *before* starting the next step so mid-turn token cutoffs never lose progress.
- **Execution policy:** a milestone closure is a checkpoint, not a turn boundary — register, verify and commit, then continue straight into the next milestone in the same run. Only an empty remaining list or an exhausted budget ends the run, and a budget stop is reported as budget with what landed and what remains. A handoff may restate this in an `execution_policy:` block, but the rule lives here because the finished handoff is deleted.
- **Registry milestone:** Log the change as a registry entry (`IMP-XXX`) in `src/domain/improvements/registry-part-*.ts` with the ledger fields (`decidedOn`, and where they apply `status`/`rejected`/`supersededBy`/`commitSha`), then run `npm run regen:ledgers` to rewrite `IMPROVEMENTS.md` — never hand-edit its generated region — and `npm run verify:improvements` as the final `[TODO]` item on significant feature changes. A prompt revision goes in `src/domain/promptRegistry.ts` instead, opting in with `decidedOn` + `version` + `commitShaOrTag` (`supersedes` is optional; `supersededBy` is required when `status` is `superseded`), regenerated the same way and gated by `npm run verify:prompts` (both ledger gates run in CI), which rejects half-opted-in entries, a `superseded` entry with no `supersededBy`, and any new entry outside the pinned `LEGACY_*_ENTRY_IDS` lists that omits the ledger fields; they also reject a `decidedOn` that is not a real calendar date and a `supersededBy` that names no registry entry. Include a `constraints:` warning if a task touches boot-locked files (`src/App.tsx`, `src/main.tsx`, `index.html` in `BOOT_ENTRY_LOCK_CHECKSUMS`).
- Delete `docs/plans/handoff-<topic>.yaml` (or `plan-<topic>.yaml`) as soon as all tasks and verification checks pass: deletion is the default, the finished file is never left behind for a later report, and a finished file found at startup is deleted then. Keep one only when the owner explicitly says to.
- After building/responding, if any OTHER incomplete plan or handoff exists in `docs/plans/` (excluding `suggestions-backlog.md`), append one compact notice line per existing item:
  `EXISTING INCOMPLETE: handoff-<topic>, plan-<topic>` (names only, comma-separated)

## Internal-Only Handoff Protocol
When asked ONLY to "write a handoff" (or "handoff for X") with no build instruction:
- Save/update `docs/plans/handoff-<topic>.yaml` (kebab-case topic slug; apply the same-topic collision rule above) internally and NEVER print the YAML block to screen.
- Reply with `Saved: docs/plans/handoff-<topic>.yaml`, and if any OTHER incomplete plan or handoff exists in `docs/plans/` (excluding `suggestions-backlog.md`), append one compact notice line per existing item:
  `EXISTING INCOMPLETE: handoff-<topic>, plan-<topic>` (names only, comma-separated)
- Use this exact schema inside `docs/plans/handoff-<topic>.yaml` (keep `status` to `<= 8` concise milestones):
  goal: <1-line objective>
  status:
    - [DONE] <file_path> | <symbol/change>
    - [WIP]  <file_path> | <symbol/change>
    - [TODO] <file_path> | <symbol/change>
  constraints:
    - <critical rule or architectural constraint>
  decisions: <optional 1-line settled design choices; omit if none>
  verified: tsc=<pass|pending|fail> | test=<pass|pending|fail> | build=<pass|pending|fail>
  blocker: <optional 1-line failing error/test; omit if unblocked>
  next_action: <exact starting point to resume>

## Resume & Cleanup Protocols
- **Resume** ("resume handoff" or "resume <filename>"): Read the matching `docs/plans/handoff-*.yaml` (or the sole existing handoff if unspecified; if multiple exist and none is named, ask which topic to resume). Closing one handoff is not a wrap-up: re-scan `docs/plans/handoff-*.yaml` before claiming there is nothing pending, because another open file is still open work. To conserve tokens, read only the files named in `status:` / `next_action:` (skip `ARCHITECTURE.md`, `ROADMAP.md`, and `docs/archive/` unless needed). Run `git status -s` (when git is available) and inspect any `[WIP]` file to catch mid-file token cutoffs, then execute from the first `[WIP]` or `[TODO]` item, checkpoint `docs/plans/handoff-*.yaml` after each step, and delete it once all tasks and verification checks pass.
- **Drop / Clear** ("drop handoff <topic>" or "clear handoffs"): Delete the specified `docs/plans/handoff-<topic>.yaml` or `plan-<topic>.yaml` (or all `handoff-*`/`plan-*` files when clearing all), never deleting `docs/plans/suggestions-backlog.md`, and reply with `Cleared: <deleted files>`. The same single-file deletion happens automatically for any finished file found at startup.
