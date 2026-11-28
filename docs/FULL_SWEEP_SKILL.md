SPDX-FileCopyrightText: 2024-2026 AskKim
SPDX-License-Identifier: AGPL-3.0-or-later

# Full Sweep — portable skill (canonical mirror)

This file is the **source of truth** for the account-level `full-sweep` skill. Edit it here.

**Why it exists:** `cloud_manage_skills` has no patch API. Every save replaces the whole
skill and asks the owner to approve the replacement, so a one-line wording change in a
sweep costs an approval prompt. Repo-local sweep refinements therefore go into this file
and `AGENTS.md`; the account skill is only re-published when the owner explicitly asks
("publish the skill", "update the skill") or when the portable text genuinely changes for
every project.

**Publish procedure (on explicit request only):**

1. Read this file.
2. Call `cloud_manage_skills` with `action: "save"`, `name: "full-sweep"`, the description
   from the `Description` line below, and the text between the `BEGIN SKILL` and
   `END SKILL` markers as `instructions`.
3. Confirm with `cloud_manage_skills` `action: "read"` **once**, and never re-save to verify.

**Description:** Detect and run any project's typecheck, tests, build and runtime checks, then report warts in plain language plus what this environment could not run

<!-- BEGIN SKILL -->

Trigger: "full sweep" or "use the full-sweep skill".

Goal: one request produces the most comprehensive report the current environment can
actually support, for whatever project you are in. Detect what exists, run what is
real, and state briefly what was not available and what would unblock it. Report only:
no code changes, no auto-fixes, no commits or pushes, never upgrade dependencies,
never weaken a gate.

0. DETECT BEFORE RUNNING
- Project rules: read AGENTS.md, CLAUDE.md, GEMINI.md, CONTRIBUTING.md if present. If the
  repo defines its own sweep/verify routine, follow it exactly and add only the generic
  phases below that it does not already cover. Repo rules win over this skill.
- Package manager from the lockfile: package-lock.json -> npm ci, pnpm-lock.yaml -> pnpm
  install --frozen-lockfile, yarn.lock -> yarn install --frozen-lockfile, bun.lock* -> bun
  install --frozen-lockfile, uv.lock/poetry.lock -> python, go.sum -> go mod download,
  Cargo.lock -> cargo fetch, Gemfile.lock -> bundle install. No lockfile: use the
  manifest's install command and say the install is not reproducible.
- Commands by intent, from scripts/targets/Makefile/justfile/taskfile only:
  typecheck, lint, unit tests, integration/e2e tests, build, dev/serve. Also collect any
  verify:*/check:*/audit:* style gates the project defines. Never invent a command; if a
  gate does not exist, say "not defined" rather than substituting something else.
- Repository access: detect visibility from the remote and an unauthenticated host API
  probe. A private repository returns 404 for CI runs, job logs, check runs and hosting
  settings, so remote CI verification is impossible without credentials. Record that as
  a blocker with the change required (see step 5), never as a code failure.
- Hosting topology: the branch you are on is often not the one users see. Find the site
  URL (package.json homepage, repo homepage, README badge, custom domain), probe it, then
  list branches and recent runs to learn which repository and branch actually serve it.
  A copy of a repository usually has no hosting site of its own, so a deploy workflow there
  can never succeed. Note whether Pages is deployed by a branch or by Actions — the
  configure-pages/deploy-pages pair only works with the Actions source.
- Tools available here: shell, git, network, browser automation, artifact/doc output.
  Record what is missing instead of assuming it exists.

1. VERIFY PHASE (in order, continue after a failure so one run reports everything)
   install -> typecheck -> lint -> unit tests -> extra invariant/verify gates -> build ->
   docs or generated-file drift checks. Capture exit codes. Keep installs lockfile-based.
   Every check in this phase gets one status, whether or not its tool exists on this
   machine: RAN (with exit code), FAILED (with the first failing line), or BLOCKED (missing
   tool, permission or SDK -> what unblocks it). Never drop a check because a tool is
   absent, never report RAN without running it, and never report BLOCKED for a check whose
   tool is present.

2. ENVIRONMENT PHASE
   git status and unpushed/uncommitted work; pending plan or handoff files; CI parity
   (compare .github/workflows, .gitlab-ci.yml, etc. against what ran locally); CI results
   when readable; per-branch CI health, including the branch that serves the live site and
   any long-lived backup or personal branches; dependency audit at high/critical severity
   and an outdated listing (advisory only, never audit fix); code inventory (source/test
   counts, largest files); hygiene (TODO/FIXME markers, type escapes, secrets or keystores
   tracked in git).

3. RUNTIME PHASE
   If the project has a dev/serve command: start it on 0.0.0.0, probe over HTTP, report the
   port. If browser automation is available: load it, confirm the app actually rendered
   (root populated, visible text, main heading, control count) and capture console errors,
   failed requests, accessibility basics, load timing and service-worker state. If there is
   no dev server or no browser, say so in one line instead of approximating it.

4. REPORT
   Publish a "Full Sweep Report — <project> (<date>)" Doc artifact when artifact output is
   available; otherwise answer in chat. Keep the chat summary short and link the artifact.
   Per finding: which check prompted it, what that check actually does, the wart concretely,
   and one plain sentence prefixed "Explain it like I'm 5:".
   Always end with an AVAILABILITY table, one line per check that did not run, e.g.
   "Android APK — needs JDK 17 + Android SDK (~3-4 GB); not installed here",
   "Coverage — no coverage provider in the project; would need a new dependency",
   "Browser runtime — no browser tool in this environment".
   Never report an unavailable or skipped check as verified.

5. BLOCKERS THE USER CAN CLEAR
   When a check is blocked by something the user can change, do not stop at "unavailable".
   Name the exact change and what becomes verifiable after it:
   - Private repository: unauthenticated CI reads (workflow conclusions, run status, check
     runs, hosting settings, Pages state) return 404. Local gates still count as evidence,
     but remote CI cannot be confirmed. Required change, either: make the repository public,
     or supply a token — GH_TOKEN / GITHUB_TOKEN with actions:read (plus repo scope for a
     private repo) — then read runs with e.g.
     `GH_TOKEN=... node scripts/android-build-remote.mjs --ref <branch>` or `gh run list`.
   - CI job logs: `/actions/runs/{id}/logs` returns 403 even on public repositories, so
     logs always need a token; job names, steps and conclusions do not.
   - Hosting served from another branch (or another repository): commits on the current
     branch are not live, so a "deployed" check has to name the branch that is. Say which
     branch must be updated, and that branch-sourced Pages can never be deployed by an
     Actions configure-pages/deploy-pages workflow.
   - Repository settings (for example no hosting site at all on this copy, or a disabled
     workflow): no code change can fix it — name the setting and where to flip it, or note
     that the workflow only makes sense in the repository that owns the site.
   - Missing toolchain or SDK: name the package and approximate download size; note which
     CI job covers that check instead.
   - Missing local dependency that the project does not ship: say it would require a new
     dependency and that the sweep will not add one.
   Format each of these as: check — blocker — exact change needed — what it unblocks.

Keep the whole run proportionate: detect first, then run the smallest set of real commands
that covers the phases above, batching independent calls.

<!-- END SKILL -->
