# Project & Handoff Rules

> Applies to **all** coding assistants, models, and platforms (Gemini, Claude, Codex, Copilot, Cursor, Windsurf, Cline, Roo, Aider, etc.) when working in this repository.

## Token Discipline (Required)
Edit existing files with targeted diffs (`str_replace` / patch), never whole-file rewrites. Report `git diff`, not full file contents. Read only the line window you need, batch independent tool calls, keep scratch files in `/tmp`, and never re-save an account skill just to test read-back. Full rules: `AGENTS.md` §6.

## Startup Check: Incomplete Plan / Work Notice
Whenever project rules (`GEMINI.md`, `AGENTS.md`, or `prompts/master_system_prompt.md`) are loaded for a coding task (omit on standalone make-handoff-only requests, read-only Q&A/inline completions, or import-only fast-boot checks) — emit this status **at most once per response** right after `ALIGNED` (never repeat it at the end):
- Check `docs/plans/` (excluding `suggestions-backlog.md`) for any existing incomplete plan or handoff file (`handoff-*.yaml`, `handoff.yaml`, `*.yaml`, or active `*.md` plan with `[WIP]`/`[TODO]` or uncompleted steps).
- If found, output ONE compact line right after `ALIGNED`:
  `PENDING HANDOFF: <file_path> — <1-line goal/feature>` (or `PENDING PLAN: <file_path> — <1-line goal/feature>`).
- If neither exists, output ONE compact line right after `ALIGNED`:
  `NO PENDING WORK`

## Auto-Handoff for Complex Features & "Write and Build a Handoff"
Trigger when filesystem write tools are available and asked to build/change a non-trivial feature spanning `>= 3 files` or `>= 3 steps`, OR asked to "write and build a handoff to do X" / "create and build a handoff for X" (skip in read-only/ask/PR-review modes, and skip for trivial single-feature + unit-test pairs unless requested):
- Do NOT write a verbose prose plan, do NOT output the handoff YAML to screen, and do NOT stop after saving the handoff.
- Save/update `docs/plans/handoff-<topic>.yaml` (kebab-case topic slug) internally using the compact YAML schema below, then immediately begin implementing the requested feature.
- **Same-topic collision:** If `docs/plans/handoff-<topic>.yaml` already exists, merge and preserve `[DONE]` items if it shares the same goal; if the goal is distinct, save as `handoff-<topic>-2.yaml` (incrementing as needed).
- **Per-step checkpointing:** Update `docs/plans/handoff-<topic>.yaml` immediately after each step finishes (`[WIP]` -> `[DONE]`, updating `next_action` and `verified`) *before* starting the next step so mid-turn token cutoffs never lose progress.
- **Registry milestone:** Include `src/domain/improvementRegistry.ts` & `IMPROVEMENTS.md` (`IMP-XXX`) + `npm run verify:improvements` as the final `[TODO]` item on significant feature changes, and include a `constraints:` warning if a task touches boot-locked files (`src/App.tsx`, `src/main.tsx`, `index.html` in `BOOT_ENTRY_LOCK_CHECKSUMS`).
- Delete `docs/plans/handoff-<topic>.yaml` once all tasks and verification checks pass.
- After building/responding, if any OTHER incomplete plan or handoff exists in `docs/plans/` (excluding `suggestions-backlog.md`), append one compact notice line per existing item:
  `EXISTING INCOMPLETE: <file_path> — <1-line goal/feature>`

## Internal-Only Handoff Protocol
When asked ONLY to "write a handoff" (or "handoff for X") with no build instruction:
- Save/update `docs/plans/handoff-<topic>.yaml` (kebab-case topic slug; apply the same-topic collision rule above) internally and NEVER print the YAML block to screen.
- Reply with `Saved: docs/plans/handoff-<topic>.yaml`, and if any OTHER incomplete plan or handoff exists in `docs/plans/` (excluding `suggestions-backlog.md`), append one compact notice line per existing item:
  `EXISTING INCOMPLETE: <file_path> — <1-line goal/feature>`
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
- **Resume** ("resume handoff" or "resume <filename>"): Read the matching `docs/plans/handoff-*.yaml` (or the sole existing handoff if unspecified; if multiple exist and none is named, ask which topic to resume). To conserve tokens, read only the files named in `status:` / `next_action:` (skip `ARCHITECTURE.md`, `ROADMAP.md`, and `docs/archive/` unless needed). Run `git status -s` (when git is available) and inspect any `[WIP]` file to catch mid-file token cutoffs, then execute from the first `[WIP]` or `[TODO]` item, checkpoint `docs/plans/handoff-*.yaml` after each step, and delete it once all tasks and verification checks pass.
- **Drop / Clear** ("drop handoff <topic>" or "clear handoffs"): Delete the specified `docs/plans/handoff-<topic>.yaml` (or all `docs/plans/handoff-*.yaml` when clearing all), never deleting `docs/plans/suggestions-backlog.md`, and reply with `Cleared: <deleted files>`.
