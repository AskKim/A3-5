/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * CI Site-Identity Gate (`scripts/verify-site-identity.ts`).
 *
 * Fails a finished build whose public URLs stopped matching the `--base` it was built with:
 * the canonical link, the `robots.txt` sitemap URL and the `sitemap.xml` location must all
 * agree with each other and land under the deployment subpath, and `404.html` - the one
 * artifact with the base baked into a client-side redirect - must send visitors there too.
 *
 * Runs against `dist/`, so it is not part of `npm run verify` — call it after a build:
 *   tsx scripts/verify-site-identity.ts --base=/Pedigree/ [--dist=dist]
 *
 * Without `--base` it re-resolves the base exactly as the build would (explicit flag,
 * `GITHUB_REPOSITORY`, then `package.json#homepage`), so a plain `npm run build` is checked
 * against the base it actually used instead of assuming the domain root.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveSiteIdentity } from './siteIdentity';

interface Failure {
  artifact: string;
  detail: string;
}

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

function normalizeBase(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '.' || trimmed === './') return '/';
  const stripped = trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
  return stripped ? `/${stripped}/` : '/';
}

function readArtifact(distDir: string, fileName: string): string | null {
  try {
    return readFileSync(path.resolve(distDir, fileName), 'utf8');
  } catch {
    return null;
  }
}

function extractCanonicalUrl(html: string): string | null {
  const tag = /<link\b[^>]*rel="canonical"[^>]*>/i.exec(html)?.[0];
  return tag ? (/href="([^"]+)"/i.exec(tag)?.[1] ?? null) : null;
}

function extractSitemapUrl(robotsTxt: string): string | null {
  return /^\s*Sitemap:\s*(\S+)\s*$/im.exec(robotsTxt)?.[1] ?? null;
}

function extractSitemapLocation(sitemapXml: string): string | null {
  return /<loc>\s*([^<\s]+)\s*<\/loc>/i.exec(sitemapXml)?.[1] ?? null;
}

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

interface RedirectTarget {
  label: string;
  value: string;
}

/** Every way `404.html` sends a visitor onward: meta refresh, script redirect and fallback link. */
function extractRedirectTargets(html: string): RedirectTarget[] {
  const targets: RedirectTarget[] = [];

  const refreshTag = /<meta\b[^>]*http-equiv="refresh"[^>]*>/i.exec(html)?.[0];
  const refreshTarget = refreshTag ? /url=([^"\s;]+)/i.exec(refreshTag)?.[1] : undefined;
  if (refreshTarget) targets.push({ label: 'meta refresh', value: refreshTarget });

  const scriptTarget = /window\.location\.replace\(\s*'([^']+)'/.exec(html)?.[1];
  if (scriptTarget) targets.push({ label: 'script redirect', value: scriptTarget });

  const linkTarget = /<a\b[^>]*href="([^"]+)"[^>]*>\s*click here/i.exec(html)?.[1];
  if (linkTarget) targets.push({ label: 'fallback link', value: linkTarget });

  return targets;
}

/** The path a redirect target points at, whether it was authored as a path or an absolute URL. */
function redirectPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return parseUrl(trimmed)?.pathname ?? null;
  if (!trimmed.startsWith('/')) return null;
  return trimmed.split(/[?#]/)[0];
}

function main(): void {
  // `--base` wins, otherwise mirror the build's own resolution rather than assuming `/`.
  const explicitBase = readArg('base');
  const expectedBase = normalizeBase(explicitBase ?? resolveSiteIdentity().base);
  const distDir = readArg('dist') ?? 'dist';
  const failures: Failure[] = [];

  const artifacts = {
    'index.html': readArtifact(distDir, 'index.html'),
    'robots.txt': readArtifact(distDir, 'robots.txt'),
    'sitemap.xml': readArtifact(distDir, 'sitemap.xml'),
    '404.html': readArtifact(distDir, '404.html'),
  } as const;

  for (const [fileName, content] of Object.entries(artifacts)) {
    if (content === null) {
      failures.push({ artifact: fileName, detail: `missing from ${distDir}/` });
      continue;
    }
    const unresolved = content.match(/%SITE_[A-Z]+%/g);
    if (unresolved) {
      failures.push({
        artifact: fileName,
        detail: `unresolved build token(s): ${[...new Set(unresolved)].join(', ')}`,
      });
    }
  }

  const indexHtml = artifacts['index.html'];
  const robotsTxt = artifacts['robots.txt'];
  const sitemapXml = artifacts['sitemap.xml'];

  const canonicalUrl = indexHtml ? extractCanonicalUrl(indexHtml) : null;
  const canonical = canonicalUrl ? parseUrl(canonicalUrl) : null;

  if (!canonicalUrl) {
    failures.push({ artifact: 'index.html', detail: 'no <link rel="canonical"> found' });
  } else if (!canonical) {
    failures.push({
      artifact: 'index.html',
      detail: `canonical href is not an absolute URL: ${canonicalUrl}`,
    });
  } else if (canonical.pathname !== expectedBase) {
    failures.push({
      artifact: 'index.html',
      detail: `canonical path "${canonical.pathname}" does not match build base "${expectedBase}"`,
    });
  }

  const expectedSitemapUrl = canonical ? `${canonicalUrl}sitemap.xml` : null;
  const robotsSitemapUrl = robotsTxt ? extractSitemapUrl(robotsTxt) : null;

  if (robotsTxt && !robotsSitemapUrl) {
    failures.push({ artifact: 'robots.txt', detail: 'no "Sitemap:" line found' });
  } else if (robotsSitemapUrl && expectedSitemapUrl && robotsSitemapUrl !== expectedSitemapUrl) {
    failures.push({
      artifact: 'robots.txt',
      detail: `sitemap URL "${robotsSitemapUrl}" does not match canonical "${expectedSitemapUrl}"`,
    });
  }

  const sitemapLocation = sitemapXml ? extractSitemapLocation(sitemapXml) : null;

  if (sitemapXml && !sitemapLocation) {
    failures.push({ artifact: 'sitemap.xml', detail: 'no <loc> entry found' });
  } else if (sitemapLocation && canonicalUrl && sitemapLocation !== canonicalUrl) {
    failures.push({
      artifact: 'sitemap.xml',
      detail: `<loc> "${sitemapLocation}" does not match canonical "${canonicalUrl}"`,
    });
  }

  const notFoundHtml = artifacts['404.html'];

  if (notFoundHtml) {
    const targets = extractRedirectTargets(notFoundHtml);
    if (targets.length === 0) {
      failures.push({
        artifact: '404.html',
        detail: 'no redirect target found (meta refresh, script redirect or fallback link)',
      });
    }
    for (const target of targets) {
      const targetPath = redirectPath(target.value);
      if (targetPath === null) {
        failures.push({
          artifact: '404.html',
          detail: `${target.label} target is neither an absolute path nor an absolute URL: ${target.value}`,
        });
      } else if (targetPath !== expectedBase) {
        failures.push({
          artifact: '404.html',
          detail: `${target.label} sends visitors to "${targetPath}" instead of build base "${expectedBase}"`,
        });
      }
    }
  }

  if (failures.length > 0) {
    console.error(
      `[verify:site-identity] FAIL — ${failures.length} artifact(s) disagree with build base "${expectedBase}":`
    );
    for (const failure of failures) {
      console.error(`  ${failure.artifact}: ${failure.detail}`);
    }
    process.exit(1);
  }

  console.log(
    `[verify:site-identity] PASS — canonical, robots.txt, sitemap.xml and the 404.html redirect all agree on ${canonicalUrl} (base "${expectedBase}").`
  );
}

main();
