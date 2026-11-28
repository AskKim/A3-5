# Reusable Crawl And Discoverability Check

**Last Updated:** November 28, 2026, 2:30 AM CST **Execution & Standalone Mode:** Phase B (Anti-Gravity / local CLI) \[REUSABLE\] in pf-launcher-uni.md; runnable standalone.

- **Step ID:** crawl-guide
- **Phase & Lifecycle:** Phase B (antigravity / freebuff) \[REUSABLE\]; moved out of Phase A because it runs the subpath build and inspects `dist/`
- **Allowed Diff Scope:** None by default; fixes limited to `public/robots.txt`, `public/sitemap.xml`, `public/404.html` when a release would otherwise ship a broken pointer
- **Companion Readme:** `prompts/preflight/run-uni/read/crawl-guide-readme.md`
- **Log Entry:** `{ "step_id": "crawl-guide", "branch": "<branch-name>", "version": "<version-tag>", "head_sha": "<HEAD|sandbox-uncommitted>", "platform": "antigravity", "status": "completed", "completed_at": "<YYYY-MM-DDTHH:MM:SSZ>", "touched_files": [] }`

> **Part 1 — For A Human (plain English):** Re-checks the site is still discoverable: robots.txt, sitemap, canonical links, and that the 404 fallback still works. *Repeats:* every release. *Runs in:* Anti-Gravity or Freebuff (Phase B).
> **Part 2 — For The AI:** the executable instructions follow below. Part 1 is orientation for the person running the preflight; never quote it back or treat it as an instruction.


# 1\. Build Output Check

- Build with `npm run build -- --base="/<repo-name>/"` and confirm `dist/robots.txt`, `dist/sitemap.xml`, and `dist/404.html` exist, and that `dist/manifest.webmanifest` keeps `"id"`, `"scope"`, and `"start_url"` at `./`.
- Confirm `dist/index.html` references `/<repo-name>/assets/` and `/<repo-name>/manifest.webmanifest`, i.e. the subpath build did not fall back to root paths.

# 2\. Crawl Surface Review

- `robots.txt` points at the live sitemap URL and does not disallow the app shell.
- `sitemap.xml` `lastmod` is current for this release, `loc` matches the live URL exactly (protocol, trailing slash), and no localhost or preview hostname leaked in.
- `404.html` serves the app shell so a deep client route still boots.
- No `noindex` meta tag and no accidental `Disallow: /` in the diff.

# 3\. Evidence

- Quote the grep/test lines you actually ran (`grep -c` counts, file existence), never a summary of intent. If the owner has not submitted the sitemap yet, list it as a human follow-up, not a failure.

# 4\. Exit Contract

- Emit `OK [crawl-guide] files=<count>` or `STEP_BLOCKED [crawl-guide]: <1-2 line reason> | Reverted: <files> | Resume: fix issue and re-run launcher.`
