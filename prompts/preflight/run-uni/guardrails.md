# Shared Preflight Guardrails

**Last Updated:** November 28, 2026, 2:30 AM CST **Execution & Standalone Mode:** Both phases; read before any step, in every run.

- **Step ID:** guardrails (handshake, not a manifest entry)
- **Phase & Lifecycle:** Phase A + Phase B, every run (never retired)
- **Allowed Diff Scope:** none - this file is read-only policy
- **Companion Readme:** `prompts/preflight/run-uni/read/guardrails-readme.md`
- **Purpose:** One hard-stop list the launcher hands to the executing model so a release run cannot quietly damage the Alpha 2 baseline, the storage engine, or a gate.

# 1\. Architecture Hard Stops

- Core PWA stays **React + Vite + TypeScript**. Never convert, rewrite, or migrate `/src/`, `/index.html`, `/vite.config.ts`, or `/package.json` to Kotlin, Compose, or plain HTML/JS, and never move app logic into `android-wrapper/`.
- Preserve the three-layer direction: `@engine/*` (zero livestock terms, zero DOM) -> `@features/*` (no sibling imports) -> `@domain/*` -> `@app/*`. Never add an import that runs against that direction.
- `src/main.tsx`, `src/App.tsx`, and `index.html` are boot-locked by `BOOT_ENTRY_LOCK_CHECKSUMS`. Do not edit them unless the human explicitly asked in this run.
- No type escapes: zero `as any`, `@ts-ignore`, or `@ts-expect-error`. Fix the root type or stop.

# 2\. Data-Safety Hard Stops

- Never call a `*Unqueued` store variant from a UI handler; go through `enqueueStoreMutation`.
- Never add a restore path that skips the pre-replace safety snapshot or the row-count verification in `restoreOrchestrator.ts`.
- Never edit schema/version constants (`public/version.json` `schemaVersion`, `minDirectUpgradeSchema`) during a preflight run.
- Never weaken a passing gate to make a failing one pass: no skipped tests, no lowered coverage thresholds, no new chunk-cycle allowlist entries, no relaxed contract snapshot.

# 3\. Scope & Git Hard Stops

- Touch only the files the active step names. `docs/plans/` handoffs belong to the owner; read them, never edit or delete them during preflight.
- `/import/` and `/old/` are read-only: never execute, bundle, import, or serve them.
- No force-push, no branch deletion, no rewrite of published history, and no push to `release` in the repository that serves the live site unless the human said "update release".
- Stop and ask if `git status -s` shows unrelated uncommitted work at the start of a step; never blanket-revert (`git checkout -- .`).

# 4\. Evidence & Token Hard Stops

- Every claim in a step report must come from a command you actually ran in this session, with its exit status. Never report a check you did not run as a pass.
- Missing tooling (Android SDK, JDK, browser, token) is reported as a limitation, never used to stop the run and never simulated.
- Bounded reads only: never dump trees, full files over 256 KB, or CI logs. Keep every report to a few lines plus the concrete failures.
- Abort with `STEP_BLOCKED` on a second identical failure of the same command rather than retrying a third time.

# 5\. Exit Contract

- Print `GUARDED` when all five sections are loaded and accepted.
- Print `STEP_BLOCKED [<step_id>]: <1-2 line reason> | Reverted: <files> | Resume: fix issue and re-run launcher.` when a guardrail is violated, after reverting only that step's files.
