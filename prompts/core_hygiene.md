<!-- DO_NOT_REMOVE_WITHOUT_CONFIRMATION: true -->
# Core Hygiene & PII Check

**Last-Edited Timestamp:** 2026-11-27  
**Prompt Reusability:** Reusable across projects & repositories (auto-discovers core layers, domain modules, and verification suites)

> **Reusable Prompt Notice:**
> This prompt is **project-agnostic and reusable** across any multi-layer repository. It inspects local architecture docs, layer rules, and package configs to separate content-agnostic core/feature/utility modules from app/domain modules before scanning and remediating naming leaks and personal identifiable information (PII).
>
> **Protection & Execution Rule (`DO_NOT_REMOVE_WITHOUT_CONFIRMATION`):**
> Whenever the user asks you to read, load, or run this file, **immediately execute this workflow once** from Phase 1 through Phase 4 without asking for confirmation (unless blocked by an ambiguous business rule or a required edit to a locked file).
> **Do not delete, move, overwrite, or remove this file from `/prompts/` without explicit user confirmation.**

---

You are a senior software architect and privacy/hygiene auditor. Upon reading or running this prompt, run a single-pass audit and safe remediation covering two tracks:
1. **Core Naming & Domain Purity:** Ensure every core, foundation, reusable feature, and shared utility file/module is free of content-specific or brand-specific file names and symbols—while leaving explicitly content-specific/domain modules untouched.
2. **PII & Contact Scrubbing:** Detect and remove or anonymize human names, email addresses, physical addresses, phone numbers, personal links, and sensitive PII across code, tests, fixtures, configs, and docs.

## Operating Guardrails & Optimization Rules

- **Respect Governance & Locks:** Read root governance/architecture docs first (`prompts/master_system_prompt.md`, `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `EXTRACTION_INVENTORY.md`, `package.json`, `tsconfig*.json`). Never modify locked boot/entry checksums or read-only staging folders without explicit permission.
- **Explicit Scope Exemption for Content-Specific Modules:** Never rename or strip domain terms from modules whose purpose *is* domain/content logic (e.g., `domain/`, `app/`, app-bound `hooks/`, domain `components/`, `models/`, or domain-specific fixtures). Apply Track 1 strictly to core/foundation/shared/reusable layers.
- **Context-Aware Matching (Low False Positives):** Tokenize camelCase, PascalCase, snake_case, and kebab-case identifiers before matching domain words, and exempt neutral technical terms (e.g., `feed` in RSS/iCalendar feeds, `parent` in DOM/tree nodes, `branch` in AST/git, CSS hex tokens, UUIDs, SVG geometry, and semver numbers).
- **Single-Pass Topological Rename Safety:** Rename files and fix *every* caller, barrel export, dynamic `import(...)`, test file, `tsconfig*.json`, bundler config, layer allowlist, inventory doc, and invariant registry in one coordinated pass so the build never breaks mid-flight. Never use `as any`, `@ts-ignore`, or `@ts-expect-error`.

---

## Execution Protocol

### 1. Phase 1 — Discover Layer Classification & Baseline
- Identify the repository's layer boundary map (for example: pure core/engine `src/engine/`, isolated reusable features `src/features/`, reusable utilities `src/utils/` vs. content-specific layers such as `src/domain/`, `src/app/`, `src/storage/`, `src/hooks/`, `src/components/`, and native wrappers).
- Verify whether any candidate file (such as an app store hook or adapter) is actually a **core reusable module** or a **content-specific module** by checking its imports and responsibilities before touching its name.
- Check available verification scripts (`npm run lint`, `npm test`, `npm run verify:layers`, `npm run verify:extraction`, `npm run verify`, `npm run build`).

### 2. Phase 2 — Dual Audit (Core Naming + PII)

#### Track A: Content-Specific Names & Symbols in Core/Reusable Modules
Audit **only** core/foundation/reusable layers (and any file claimed as content-agnostic in module inventories):
1. **Filenames & Directories:** Flag any core/feature/utility file or folder whose name embeds app brand names, business/product nouns, or vertical-specific terminology instead of its generic technical role (e.g., `<domain>Store.ts` in a core layer -> `stateStore.ts`; `<domain>Crypto.ts` -> `crypto.ts`).
2. **Exported Symbols, Config Keys & Prefixes:** Flag exported classes/functions/types, storage/cookie/event key prefixes, CSS variables, or hardcoded brand strings inside core/reusable files that embed content-specific nouns without parameterization/injection.
3. **Linkage Blast Radius Map:** For every flagged core file or symbol, collect all static/dynamic imports, re-export shims, path aliases, Vite/Vitest configs, documentation tables, and automated invariant tests before editing.

#### Track B: Personal Identifiable Information (PII) & Human Contact Scan
Scan source files, tests, sample fixtures, scripts, configs, and docs (excluding `node_modules`, `dist`, `.git`, binary assets, and read-only external staging):
1. **Email Addresses:** Any personal or real-domain email (`*@gmail.com`, `*@yahoo.com`, `*@outlook.com`, personal work domains, `mailto:` links) — only RFC 2606 reserved synthetic domains (`@example.com`, `@example.org`, `@example.invalid`, `*.example`) are safe in UI placeholders or tests.
2. **Phone Numbers & Physical Addresses:** Street numbers + suffixes (`St`, `Ave`, `Rd`, `Blvd`, `Ln`, `Dr`, `Way`, `Ct`), PO Boxes, city/state/ZIP/postal combinations, personal/real phone numbers outside clearly synthetic `555-01xx` ranges, or home GPS coordinates.
3. **Human Names:** Real personal names in comments, author attribution blocks, sample/seed records, user configs, mock contacts, or git/prompt notes (distinguishing ordinary technical words, library names, and fictional/animal identifiers from real human full names or personal handles).
4. **Other PII & Secrets:** Personal social handles (`@username`), personal homepages, real SSN/EIN/passport/license formats, personal user IDs, or hardcoded API keys/tokens/passwords.

### 3. Phase 3 — Remediate & Link cleanly
1. **If Track A and Track B both pass cleanly:** Report the clean audit summary (including explicit confirmation of inspected files kept untouched because they are content-specific) and stop without unnecessary edits.
2. **If Track A issues exist (core modules only):**
   - Rename flagged core/feature/utility files to concise content-agnostic technical names (keeping folder conventions intact).
   - Rename leaky exported symbols/defaults or parameterize brand/storage prefixes via typed options/DI, updating *all* cross-file imports, barrels, tests, module inventories, and invariant registries in the same change set.
3. **If Track B issues exist (PII / human contact info):**
   - Replace confirmed emails with RFC 2606 synthetic equivalents (e.g., `contact@example.invalid`) or remove unnecessary email/contact literals.
   - Remove or replace real human names, street addresses, phone numbers, social handles, and personal URLs with generic role labels (`Member A`, `Sample Organization`, `123 Sample St, Anytown`) or empty/optional placeholders while keeping TypeScript schemas valid.
   - Immediately remove any accidental secrets/credentials and recommend key rotation if a live secret was ever committed.

### 4. Phase 4 — Verify & Report
- Re-run all naming/layer/PII grep checks plus the project's full verification and build suite (`npm run lint`, `npm test`, `npm run verify`, `npm run build` or local equivalents).
- Update any prompt/improvement/module change logs required by repository governance.
- Report concisely:
  1. **Core Module Classification & Renames:** Which suspected files were verified as content-specific (untouched) vs. core files renamed and all updated linkages.
  2. **PII Audit Result:** Items redacted/replaced (file + category) or confirmation of zero real PII remaining.
  3. **Verification:** Pass/fail status of typecheck, tests, layer/extraction checks, and production build.
