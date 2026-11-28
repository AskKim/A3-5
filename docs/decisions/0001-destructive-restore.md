# ADR 0001 — Every destructive restore goes through one orchestrator

- **Status:** accepted (2026-11-27)
- **Context:** `useBarnStore` grew three separate restore paths (OPFS vault, rolling IndexedDB,
  JSON/archive import). Each had its own copy of the same order, and only some of them took a
  safety snapshot first. A restore replaces the live barn, so a missing or reordered step is a
  data-loss bug, not a cosmetic one.

## Decision

`src/hooks/barnStore/restoreOrchestrator.ts` owns the sequence:

1. load the source and refuse (with a toast) if it is unreadable;
2. write a safety rolling snapshot — unless storage was just wiped or the barn is empty;
3. clear the photo cache;
4. replace the snapshot **with backup bookkeeping stripped**;
5. clear local sync + backup-reminder state;
6. clear the wiped-recovery context;
7. run source-specific work (the OPFS path switches species here);
8. verify the committed row counts against the loaded file, rolling the safety snapshot back on
   mismatch;
9. reload the store and toast success.

Callers still own three things: serialising through `enqueueStoreMutation`, decoding their own file
format, and their source-specific step. They may not re-implement the order.

## Consequences

- A new restore source (JSON, encrypted archive, native vault) gets the safety net for free.
- Restores now cost one extra read (`loadSnapshot`) to verify; that read is cheap compared with a
  silent bad restore.
- The OPFS and rolling slices no longer import each other; `stripRestoredBackupBookkeeping` lives in
  the orchestrator and is re-exported for the existing tests.
- Verification is count-based. Checksum-verified payloads (OPFS) already fail earlier at load time,
  so this catches "written but not committed", not corruption.

## Alternatives considered

- **Per-path copies with a shared helper for the safety snapshot.** Rejected: the ordering is the
  contract, not just the backup.
- **Verify by hashing the committed snapshot.** Rejected for now: the adapter exposes rows, not raw
  bytes, and a snapshot hash would need the same serialisation the backup format uses.
