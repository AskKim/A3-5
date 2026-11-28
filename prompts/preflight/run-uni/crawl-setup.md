# One-Time Crawl And Discoverability Setup

**Last Updated:** November 28, 2026, 2:30 AM CST **Execution & Standalone Mode:** Phase A (AI Studio) \[FIRST-TIME-SINGLE-USE\] in pf-launcher-uni.md; can also be read and run standalone.

- **Step ID:** crawl-setup
- **Phase & Lifecycle:** Phase A (ai-studio) \[FIRST-TIME-SINGLE-USE\] (retires via AGENT\_SKIP\_LINE)
- **Allowed Diff Scope:** `public/robots.txt`, `public/sitemap.xml`, `index.html` (head/meta only), `public/404.html`
- **Companion Readme:** `prompts/preflight/run-uni/read/crawl-setup-readme.md`
- **Log Entry:** `{ "step_id": "crawl-setup", "branch": "<branch-name>", "version": "<version-tag>", "head_sha": "<HEAD|sandbox-uncommitted>", "platform": "ai-studio", "status": "completed", "completed_at": "<YYYY-MM-DDTHH:MM:SSZ>", "touched_files": [] }`
- **Purpose:** Make the deployed site discoverable and shareable exactly once per repository, so the per-release crawl check only has to confirm it.

# 1\. Static Discoverability Files

- `public/robots.txt`: allow crawling and point at `<live-url>sitemap.xml` with an absolute URL.
- `public/sitemap.xml`: one `<loc>` for `<live-url>`, with `<lastmod>` in `YYYY-MM-DD`; absolute URLs only because the Pages subpath breaks relative ones.
- `public/404.html`: must exist and serve the app shell, since Pages has no rewrite rules for client routes.

# 2\. Document Head And Manifest

- `index.html`: `<html lang>`, a non-empty `<title>`, `<meta name="description">`, a canonical `<link rel="canonical" href="<live-url>">`, and the Search Console verification meta tag when the owner supplied one. `index.html` is boot-locked: if a change is needed, report it and let the human approve rather than editing it mid-run.
- `vite.config.ts` manifest: `id`, `scope`, and `start_url` must all stay `./` so the subpath build keeps working. Read-only during this step.
- Confirm the app is fully static: no backend, no required env var, so indexing cannot leak private data.

# 3\. Human-Only Handoff

- Search Console / Bing verification, sitemap submission, and "Request Indexing" are human steps. List them in the step report; never claim they were done.

# 4\. Exit Contract

- Emit `OK [crawl-setup] files=<count>` or `STEP_BLOCKED [crawl-setup]: <1-2 line reason> | Reverted: <files> | Resume: fix issue and re-run launcher.`
