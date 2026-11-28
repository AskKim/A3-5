# Reusable Pre-Merge Backup Verification

**Last Updated:** November 28, 2026, 2:30 AM CST **Execution & Standalone Mode:** Phase B (Anti-Gravity / local CLI) \[REUSABLE\] in pf-launcher-uni.md; runnable standalone.

- **Step ID:** backup-check
- **Phase & Lifecycle:** Phase B (antigravity) \[REUSABLE\]
- **Allowed Diff Scope:** none - verification and reporting only
- **Companion Readme:** `prompts/preflight/run-uni/read/backup-check-readme.md`
- **Log Entry:** `{ "step_id": "backup-check", "branch": "<branch-name>", "version": "<version-tag>", "head_sha": "<HEAD|sandbox-uncommitted>", "platform": "antigravity", "status": "completed", "completed_at": "<YYYY-MM-DDTHH:MM:SSZ>", "touched_files": [] }`
- **Purpose:** Prove that a breeder's data survives this release before the release is allowed to merge.

# 1\. Repository Snapshot Freshness

- A snapshot from `backup-setup` exists for the current `HEAD`, or a new one is created now; stale snapshots (a different `HEAD`) do not count.
- `git bundle verify` (or the stash entry) passes, and the recorded byte size is non-zero.

# 2\. Application Round Trip

- Export a full backup archive from the running app, then import it back, and confirm animal count, photos, breeding records, and barn tasks survive with no quota or permission error.
- Export a CSV and re-import it through the importer preview; confirm zero unexplained conflicts.
- Exercise one destructive path end to end on a scratch copy: rolling snapshot restore through `restoreOrchestrator` (safety snapshot written, row counts verified, no partial barn).

# 3\. Recovery Route

- Confirm the OPFS vault lists, downloads, and restores, and that an encrypted archive still decrypts with the same passphrase.
- Confirm the app's wiped-storage detection and export canary behave after a simulated storage clear.

# 4\. Exit Contract

- Emit `OK [backup-check] files=0` with counts before/after for each round trip, or `STEP_BLOCKED [backup-check]: <1-2 line reason> | Reverted: <files> | Resume: fix issue and re-run launcher.`
