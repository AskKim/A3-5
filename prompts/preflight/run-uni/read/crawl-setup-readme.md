# Crawl Setup - Step Readme

- **Prompt:** `prompts/preflight/run-uni/crawl-setup.md`
- **Step ID:** crawl-setup - **Type:** FIRST_TIME - **Phase:** A (ai-studio)
- **Run it when:** the repository has never been published, or the live URL changed.
- **Reads:** `public/robots.txt`, `public/sitemap.xml`, `public/404.html`, `index.html`, `vite.config.ts` (manifest block).
- **Writes:** `public/robots.txt`, `public/sitemap.xml`, `public/404.html`; `index.html` head only, and only with human approval because it is boot-locked.
- **Pass signal:** `OK [crawl-setup] files=<count>`.
- **Fail signal:** `STEP_BLOCKED [crawl-setup]: ...`.
- **Human-only:** Search Console / Bing verification, sitemap submission, "Request Indexing".
- **Notes:** Absolute URLs only - the Pages subpath breaks relative ones. Manifest `id`/`scope`/`start_url` stay `./`.
