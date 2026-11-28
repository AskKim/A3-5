# `useBarnStore` Public Contract

Every screen reaches the store through one context value, so a dropped or renamed key is a silent
runtime break. `src/hooks/__tests__/barnStoreContract.test.ts` freezes the key set;
`src/hooks/__tests__/barnStoreContract.keys.json` is the snapshot it compares against.

## Rules

- Adding a key is allowed. Removing or renaming one is a breaking change for consumers.
- **Any change to the snapshot needs a changelog line below, plus an updated key count and hash.**
  `npm run verify:contract` fails when the snapshot and this file disagree, so a key change cannot
  land without a recorded reason.
- The hash is SHA-256 of the snapshot file's exact bytes, computed in the repo root with
  `node -e "const fs=require('fs'),c=require('crypto');console.log(c.createHash('sha256').update(fs.readFileSync('src/hooks/__tests__/barnStoreContract.keys.json')).digest('hex'))"`.

## Current

- Keys: 200
- SHA-256: 8d128741738e6cbf275e3110f1d4d6f94e8d937188826debde5b0a84b49d88d0

## Changelog

- 2026-11-27 · 200 keys · Initial freeze of the return surface before the facade refactor (IMP-101).
- 2026-11-28 · 200 keys · Key set unchanged. `resolveSyncConflict` now also accepts a list of ids so the Field Collision Review Log can clear a whole queue in one merge (IMP-111, IMP-113); recorded because the consumer-facing signature widened.
