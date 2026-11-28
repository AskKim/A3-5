# `src/domain/improvements/` — Improvement Registry

`IMPROVEMENTS.md` is generated. Its entire content is a render of the entries in this folder, so
logging work means adding an entry here and regenerating — never editing the ledger.

## Files

| File | Holds |
| --- | --- |
| `registry-part-01.ts` … `registry-part-05.ts` | The entries, in id order. `registry-part-05.ts` is the append target for new work. |
| `types.ts` | `ImprovementEntry`, `ImprovementInvariant`, `ImprovementCategory`, ledger-field types. Shared so part modules do not import the assembling registry (a type-only cycle is still a cycle to the analyser). |
| `rationales.ts` | Prose for each invariant, keyed `${entryId}#${filePath}#${ordinalForThatFile}`. Loaded only when explanations are displayed, so the registry chunk stays lean. |

`src/domain/improvementRegistry.ts` is still the public surface: it assembles the parts, evaluates
invariants, exports markdown/JSON, and owns `BOOT_ENTRY_LOCK_CHECKSUMS`.

## Logging a change

1. Append an entry to `registry-part-05.ts` with the next free `IMP-NNN` id.
2. Required fields: `id`, `title`, `category`, `source`, `summary`, `userIntent`, `files`,
   `invariants`, `restorePlaybook`.
3. Ledger fields (what makes a new entry render in the documented shape):
   `decidedOn: 'YYYY-MM-DD'` always; `status` only when not `active`; `supersededBy` when
   `superseded`; `rejected` when an alternative lost; `commitSha` when the files already landed.
4. Each invariant names a `filePath` plus `requiredSubstrings` (and optional `forbiddenSubstrings`).
   Append new invariants at the **end** of an entry's list — a mid-list insert shifts rationale
   ordinals and fails `verify:improvements`.
5. Run `npm run regen:ledgers` (rewrites `IMPROVEMENTS.md` and `PROMPT_CHANGES.md`), then
   `npm run verify:improvements`.

## Rules

- **Append, never renumber.** Ids and ledger headings are anchors; `docs/handoff-state.json` records
  the newest `CHANGELOG.md` heading, and existing entries are never rewritten.
- **Every invariant is executable.** If `verify:improvements` cannot check it from disk, it is not an
  invariant — keep it in `summary` prose instead.
- **Guard the guard.** When you add a gate, register an invariant that requires the gate's command in
  `package.json` and its file in `scripts/`, so it cannot be quietly deleted later.
- **Boot lock stays read-only.** `src/main.tsx`, `src/App.tsx` and `index.html` checksums live in
  `improvementRegistry.ts`; changing one needs explicit approval and a checksum update in the same
  change.
