# Reusable Crawl And Discoverability Check

**Last Updated:** November 28, 2026, 2:30 AM CST **Execution & Standalone Mode:** Phase A (AI Studio) \[REUSABLE\] in pf-launcher-uni.md; runnable standalone.

- **Step ID:** crawl-guide
- **Phase & Lifecycle:** Phase A (ai-studio) \[REUSABLE\]
- **Allowed Diff Scope:** None by default; fixes limited to `public/robots.txt`, `public/sitemap.xml`, `public/404.html` when a release would otherwise ship a broken pointer
- **Companion Readme:** `prompts/preflight/run-uni/read/crawl-guide-readme.md`
- **Log Entry:** `{ "step_id": "crawl-guide", "branch": "<branch-name>", "version": "<version-tag>", "head_sha": "<HEAD|sandbox-uncommitted>", "platform": "ai-studio", "status": "completed", "completed_at": "<YYYY-MM-DDTHH:MM:SSZ>", "touched_files": [] }`

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
