# Crawl Setup

This readme is **dual-audience**: **Part 1** explains the step in plain English for whoever is running the preflight; **Part 2** is the technical record for an AI agent or developer.

---

## Part 1: Plain-English Guide

**In plain terms:** Creates the files search engines look for - robots.txt, sitemap.xml and the canonical site identity - so a new site can actually be found and indexed.

- **You need this step when:** the repository has never been published, or the live URL changed.
- **How often:** once, then it ticks itself off and never runs again.
- **Which assistant runs it:** AI Studio (Phase A).
- **How you know it worked:** `OK [crawl-setup] files=<count>`.

---

## Part 2: Technical Reference

- **Prompt:** `prompts/preflight/run-uni/crawl-setup.md`
- **Step ID:** crawl-setup - **Type:** FIRST_TIME - **Phase:** A (ai-studio)
- **Run it when:** the repository has never been published, or the live URL changed.
- **Reads:** `public/robots.txt`, `public/sitemap.xml`, `public/404.html`, `index.html`, `vite.config.ts` (manifest block).
- **Writes:** `public/robots.txt`, `public/sitemap.xml`, `public/404.html`; `index.html` head only, and only with human approval because it is boot-locked.
- **Pass signal:** `OK [crawl-setup] files=<count>`.
- **Fail signal:** `STEP_BLOCKED [crawl-setup]: ...`.
- **Human-only:** Search Console / Bing verification, sitemap submission, "Request Indexing".
- **Notes:** Absolute URLs only - the Pages subpath breaks relative ones. Manifest `id`/`scope`/`start_url` stay `./`.
