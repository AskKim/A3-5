# `src/hooks/barnStore/` — Barn Store Slices

`useBarnStore.ts` is one flat store with a 200-key public surface that every screen consumes. It was
split by concern, not by feature: each file below owns one policy or one group of mutations, and the
store keeps ownership of state, persistence and wiring.

The return shape is a contract. `src/hooks/__tests__/barnStoreContract.keys.json` freezes the key set,
`docs/contracts/barn-store-contract.md` records why it changes, and `npm run verify:contract` fails
when the two disagree.

## Map

### Policy (pure, testable, no React)

| File | Owns |
| --- | --- |
| `photoCacheBudget.ts` | Per-device-tier photo cache budgets. |
| `backupReminder.ts` | Last-export and snooze state, read from local storage. |

### Orchestration

| File | Owns |
| --- | --- |
| `restoreOrchestrator.ts` | The only destructive-restore sequence: load and refuse, safety snapshot, photo-cache clear, replace without backup bookkeeping, sync-state clear, source hook, row-count verification, rollback on mismatch, reload. See ADR `docs/decisions/0001-destructive-restore.md`. |

### Selectors

| File | Owns |
| --- | --- |
| `speciesSelectors.ts` | Rev-keyed, memoised per-collection species lists. The cache key is FNV-1a over `id:rev` plus a dataset epoch; call `invalidateSpeciesSelectorCache()` after any wholesale dataset replacement (restore, import, archive restore). |

### Contracts and ports

| File | Owns |
| --- | --- |
| `storeFacades.ts` | Nine `Pick` facades over the store (shell, animal, photo, backup, sync, species, calendar, husbandry, data) plus a compile-time proof that together they cover every key. |
| `storePorts.ts` | `createStorePorts()` — the React-free bundle of write queue, monotonic revision allocation, logical counter and snapshot ref that the mutation slices and non-component callers share. |

### Context slices

| File | Owns |
| --- | --- |
| `syncConflictSlice.tsx` | Conflict-review context, so the Import/Export hub stops receiving the whole store. |
| `vaultSlice.tsx` | Vault collections and vault actions context. |
| `syncStateSlice.tsx` | Outbox, backup status and storage-protection status context. |

### Sub-hooks (state stays in the store, mutations move here)

| File | Actions |
| --- | --- |
| `useAnimalsCrud.ts` | Create, update, archive, delete (single and batch), species migration, conflict dismissal. |
| `usePhotoMutations.ts` | Add optimized photos, set primary, retitle, delete, and photo-storage maintenance. |
| `useBreeding.ts` | Log breeding with chore cascade, outcomes, recalculations, deletion. |
| `useSpeciesProfileActions.ts` | Save a species profile; a rename moves every species-addressed record in one snapshot replace. |
| `useAlertDismissals.ts` | Ignore task ids, clear one species' alert group, dismiss the species memo. |
| `useCloudSyncActions.ts` | Cloud app-folder settings patch, token adoption, disconnect, PKCE start. |
| `useOpfsVaultActions.ts` | Save, describe, download, delete, restore-by-key. |
| `useRollingBackupActions.ts` | Rolling IndexedDB snapshot restore and delete. |
| `useOpfsArchiveOffload.ts` | Move animals out of the live barn into a zipped archive bundle, and back. |
| `useSyncConflictResolution.ts` | Apply the chosen side, merge operations, mark resolved (single or whole queue). |
| `useSyncConflictDismissal.ts` | Quiet sibling of resolve: mark resolved without changing data. |
| `usePhotoCache.ts` | The bounded LRU photo cache, its four loaders and ref helpers. |
| `useBackupReminderActions.ts` | Record a successful export, snooze the reminder. |

## Rules

1. **Never add a restore path.** New restore sources call `runDestructiveRestore` and supply only
   their own decode and source-specific step. Restores go through `enqueueStoreMutation`.
2. **Never call an `*Unqueued` variant from UI.** They exist for the queue itself and for tests.
3. **Keep the key set stable.** Facades may be regrouped; keys may be added; renaming or removing one
   is a breaking change that needs a contract changelog entry.
4. **Invalidate selectors on replacement.** Anything that swaps the whole snapshot must call
   `invalidateSpeciesSelectorCache()` before the replacement is visible.
5. **No type escapes.** No `as any`, `@ts-ignore` or `@ts-expect-error`; the facades are meant to
   catch a stale key at compile time.
6. **No new React dependency in policy modules.** If it does not need hooks, it belongs in a plain
   `.ts` file like `photoCacheBudget.ts`.
7. **`backupVault` stays on its dynamic import.** Making it static reintroduces the chunk cycle that
   `verify:chunks` catches.

## Verification

```bash
npm run verify:contract   # key count + snapshot hash match the contract doc
npm test -- src/hooks/__tests__   # contract, CRUD, restore ordering, quota and property tests
npm run verify                     # full set, including layers and chunks
```

## Adding a sub-hook

1. Copy the shape of the smallest existing slice: a `@license` header that names the rule it protects,
   a `deps` parameter for shared ports, plain action functions, and no direct state ownership.
2. Wire it in `useBarnStore.ts` and expose the same action names — the contract test will tell you if
   a key disappeared.
3. Add a facade key to the owning `Pick` if it is a genuinely new key.
4. Default the new behaviour on: add a test beside `src/hooks/__tests__/` covering the happy path and
   one rejected write (the queue must survive it).
