# Contributing to Community Pedigree

Thank you for your interest in contributing to the Community Pedigree Project!

## Contributor Licensing Terms

By submitting a pull request or other contribution to the Community Pedigree Project, you agree to the following:

1. **Original Work:** You represent that your contribution is your own original work (or that you have the legal right to submit it) and that it does not infringe on any third-party copyrights or patents.
2. **Dual-Licensed Inbound:** While this repository is currently distributed under the AGPL-3.0, you grant the project maintainer a perpetual, worldwide, royalty-free license to use, modify, and redistribute your contribution under **both** the **AGPL-3.0** and the **Apache License 2.0** (including for distribution of official builds on platforms such as the Apple App Store).
3. **Permissive Dependencies Only:** To preserve compatibility with Apache 2.0 and mobile app store distribution, any new third-party dependencies introduced to the shared codebase must use permissive licenses (such as MIT, Apache 2.0, BSD, or ISC).
4. **Attribution:** You retain the copyright to your contributions, and attribution will be maintained in the project's version control history and contributor records.

---

## Development & Verification Workflow

### Local Setup
```bash
npm install
npm run dev
```

### Required Pre-PR Checks
Run the full verification suite before opening a Pull Request:
```bash
npm test                     # Unit & architecture boundary tests (Vitest)
npm run lint                 # Strict TypeScript check (tsc --noEmit)
npm run verify:improvements  # Anti-wipeout improvement registry invariants
npm run verify:layers        # Three-layer import & DOM-isolation ratchet
npm run verify:engine        # Isolated @engine/@features/@utils typecheck
npm run verify:extraction    # Standalone temp-dir framework compilation check
npm run build                # Production Vite PWA build
```

### Engineering Guardrails
- **React PWA Only:** The core app (`src/`) must always remain React + Vite + TypeScript; `android-wrapper/` is strictly a thin Kotlin WebView shell.
- **Strict Types:** Do not suppress TypeScript errors with `as any`, `@ts-ignore`, or `@ts-expect-error`.
- **Three-Layer Boundaries:** Keep `src/engine/` free of livestock/pedigree terms, avoid cross-feature sibling imports in `src/features/`, and never import from `/import/` or `/old/`.
- **Improvement Logging:** Register significant functional, boot, storage, memory, or packaging changes in both `src/domain/improvementRegistry.ts` and `IMPROVEMENTS.md`.
- **Pull Requests:** Complete the contributor license checkbox in [`.github/pull_request_template.md`](./.github/pull_request_template.md).
