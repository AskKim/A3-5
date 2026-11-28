# Crawl Guide

This readme is **dual-audience**: **Part 1** explains the step in plain English for whoever is running the preflight; **Part 2** is the technical record for an AI agent or developer.

---

## Part 1: Plain-English Guide

**In plain terms:** Re-checks the site is still discoverable: robots.txt, sitemap, canonical links, and that the 404 fallback still works.

- **You need this step when:** every release, after the subpath build exists.
- **How often:** every release.
- **Which assistant runs it:** Anti-Gravity or Freebuff (Phase B).
- **How you know it worked:** `OK [crawl-guide] files=<count>`.

---

## Part 2: Technical Reference

- **Prompt:** `prompts/preflight/run-uni/crawl-guide.md`
- **Step ID:** crawl-guide - **Type:** REUSABLE - **Phase:** B (antigravity)
- **Run it when:** every release, after the subpath build exists.
- **Reads:** `dist/robots.txt`, `dist/sitemap.xml`, `dist/404.html`, `dist/manifest.webmanifest`, `dist/index.html`.
- **Writes:** nothing by default; a broken pointer may be fixed in the three `public/` static files.
- **Pass signal:** `OK [crawl-guide] files=<count>`.
- **Fail signal:** `STEP_BLOCKED [crawl-guide]: ...`.
- **Human-only:** submitting an updated sitemap to Search Console.
- **Notes:** Quote the grep counts you ran. A missing sitemap submission is a follow-up, not a failed step.
