---
applyTo: "src/engine/**,src/features/**,src/utils/**"
---
- `src/engine/` (`@engine/*`): Zero livestock or pedigree domain terms; zero imports from `@features/*`, `@domain/*`, `@app/*`, `src/storage/*`, `src/hooks/*`, or `src/components/*`; zero DOM globals outside `src/engine/bridge/` and `src/engine/storage/`.
- `src/features/` (`@features/*`): May import `@engine/*` only; zero cross-feature sibling imports and zero DOM globals.
- `src/utils/`: Content-agnostic utilities; may import `@engine/*` only (never `src/domain/*`, `src/storage/*`, or `src/native/pedigreeBridge`).
- Run `npm run verify:engine`, `npm run verify:layers`, and `npm run verify:extraction` after edits.
