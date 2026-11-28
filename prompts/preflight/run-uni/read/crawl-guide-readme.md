# Crawl Guide - Step Readme

- **Prompt:** `prompts/preflight/run-uni/crawl-guide.md`
- **Step ID:** crawl-guide - **Type:** REUSABLE - **Phase:** A (ai-studio)
- **Run it when:** every release, after the subpath build exists.
- **Reads:** `dist/robots.txt`, `dist/sitemap.xml`, `dist/404.html`, `dist/manifest.webmanifest`, `dist/index.html`.
- **Writes:** nothing by default; a broken pointer may be fixed in the three `public/` static files.
- **Pass signal:** `OK [crawl-guide] files=<count>`.
- **Fail signal:** `STEP_BLOCKED [crawl-guide]: ...`.
- **Human-only:** submitting an updated sitemap to Search Console.
- **Notes:** Quote the grep counts you ran. A missing sitemap submission is a follow-up, not a failed step.
