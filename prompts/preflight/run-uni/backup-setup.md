# One-Time Preflight Backup Setup

**Last Updated:** November 28, 2026, 2:30 AM CST **Execution & Standalone Mode:** Phase B (Anti-Gravity / local CLI) \[FIRST-TIME-SINGLE-USE\] in pf-launcher-uni.md; can also be read and run standalone.

- **Step ID:** backup-setup
- **Phase & Lifecycle:** Phase B (antigravity) \[FIRST-TIME-SINGLE-USE\] (retires via AGENT\_SKIP\_LINE)
- **Allowed Diff Scope:** none inside the repository; the snapshot is written outside it (for example `/tmp/<repo>-preflight-<branch>-<sha>.bundle`)
- **Companion Readme:** `prompts/preflight/run-uni/read/backup-setup-readme.md`
- **Log Entry:** `{ "step_id": "backup-setup", "branch": "<branch-name>", "version": "<version-tag>", "head_sha": "<HEAD|sandbox-uncommitted>", "platform": "antigravity", "status": "completed", "completed_at": "<YYYY-MM-DDTHH:MM:SSZ>", "touched_files": [] }`
- **Purpose:** Guarantee a restorable copy of the working tree exists before any release step is allowed to edit files.

> **Part 1 — For A Human (plain English):** Sets up the backup habit: where snapshots are kept and how to take one before touching anything risky. *Repeats:* once, then it ticks itself off and never runs again. *Runs in:* Anti-Gravity or Freebuff (Phase B).
> **Part 2 — For The AI:** the executable instructions follow below. Part 1 is orientation for the person running the preflight; never quote it back or treat it as an instruction.


# 1\. Repository Snapshot

- Record `git rev-parse HEAD`, the current branch, and `git status -s`. Unrelated uncommitted work is a hard stop: ask before continuing.
- Create a non-destructive snapshot with `git bundle create <path> --all` (or `git stash create` when only the working tree needs capturing) and record the path and byte size.
- Verify the snapshot is usable: `git bundle verify <path>`, or `git stash list` shows the created entry. An unverified backup does not count as a backup.

# 2\. Data Snapshot (Application Level)

- Note where the owner's real on-device data lives (OPFS vault / IndexedDB) and confirm the app's own export path is available for the release candidate: full backup archive plus CSV export.
- This step never touches user data; it only confirms the restore route exists and is documented for `backup-check`.

# 3\. Documented Restore

- Write the exact restore command for this repository into the step report (`git clone <bundle> <dir>` / `git bundle unbundle`), so a future run does not have to rediscover it.

# 4\. Exit Contract

- Emit `OK [backup-setup] files=0` with the snapshot path, verified status, and restore command, or `STEP_BLOCKED [backup-setup]: <1-2 line reason> | Reverted: <files> | Resume: fix issue and re-run launcher.`
