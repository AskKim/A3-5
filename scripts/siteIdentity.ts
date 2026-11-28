/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Build-Time Site Identity (`scripts/siteIdentity.ts`).
 *
 * The public GitHub Pages location is authored exactly once, in `package.json#homepage`.
 * This module resolves it into `%SITE_URL%`, `%SITE_BASE%` and `%SITE_LASTMOD%` tokens that
 * `vite.config.ts` substitutes into `index.html` and into the
 * `public/robots.txt`, `public/sitemap.xml` and `public/404.html` templates at build time,
 * so the same source deploys unchanged from any repository name or Pages subpath.
 *
 * Base path precedence: an explicit `--base` flag (what `.github/workflows/deploy-pages.yml`
 * passes, `/` included), then `GITHUB_REPOSITORY` in CI, then the path in
 * `package.json#homepage`.
 */

import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';

/** `public/` files Vite copies verbatim and `siteIdentityPlugin` rewrites inside `dist/`. */
const SITE_IDENTITY_PUBLIC_FILES = ['robots.txt', 'sitemap.xml', '404.html'] as const;

export interface SiteIdentity {
  /** Absolute public site URL with a trailing slash, e.g. `https://askkim.github.io/Pedigree/`. */
  url: string;
  /** Deployment path with leading and trailing slash, e.g. `/Pedigree/` or `/`. */
  base: string;
  /** Build date (`YYYY-MM-DD`) written into the sitemap `lastmod` entry. */
  lastModified: string;
}

export interface ResolveSiteIdentityOptions {
  rootDir?: string;
  base?: string;
}

type EnvBag = Record<string, string | undefined>;

function readProcessEnv(): EnvBag {
  const runtime = globalThis as unknown as { process?: { env?: EnvBag } };
  return runtime.process?.env ?? {};
}

function readProcessArgv(): string[] {
  const runtime = globalThis as unknown as { process?: { argv?: string[] } };
  return runtime.process?.argv ?? [];
}

/** Reads an `--base <path>` / `--base=<path>` CLI flag; Vite's own `/` default is not a flag. */
function readCliBase(): string | undefined {
  const argv = readProcessArgv();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--base') return argv[index + 1];
    if (arg.startsWith('--base=')) return arg.slice('--base='.length);
  }
  return undefined;
}

function normalizeBasePath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '.' || trimmed === './') return '/';
  const stripped = trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
  return stripped ? `/${stripped}/` : '/';
}

function readHomepageUrl(rootDir: string): string {
  try {
    const raw = readFileSync(path.resolve(rootDir, 'package.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'homepage' in parsed) {
      const value = (parsed as { homepage?: unknown }).homepage;
      return typeof value === 'string' ? value : '';
    }
  } catch {
    // A missing or unparsable package.json simply leaves the homepage URL empty.
  }
  return '';
}

function splitHomepageUrl(homepageUrl: string): { origin: string; base: string } {
  if (!homepageUrl) return { origin: '', base: '/' };
  try {
    const parsed = new URL(homepageUrl);
    return { origin: parsed.origin, base: normalizeBasePath(parsed.pathname) };
  } catch {
    return { origin: '', base: '/' };
  }
}

function identityFromRepositorySlug(repositorySlug: string | undefined): {
  origin: string;
  base: string;
} | null {
  const slug = (repositorySlug ?? '').trim();
  const separator = slug.indexOf('/');
  if (separator <= 0 || separator === slug.length - 1) return null;
  const owner = slug.slice(0, separator);
  const repository = slug.slice(separator + 1);
  const ownerHost = `${owner.toLowerCase()}.github.io`;
  // A `<owner>.github.io` repository is a user site served from the domain root.
  const isUserSite = repository.toLowerCase() === ownerHost;
  return {
    origin: `https://${ownerHost}`,
    base: isUserSite ? '/' : normalizeBasePath(`/${repository}/`),
  };
}

/** Resolves every public URL the build emits from `package.json#homepage` plus the build base. */
export function resolveSiteIdentity(options: ResolveSiteIdentityOptions = {}): SiteIdentity {
  const rootDir = options.rootDir ?? '.';
  const lastModified = new Date().toISOString().slice(0, 10);

  const homepage = splitHomepageUrl(readHomepageUrl(rootDir));
  const fromRepository = identityFromRepositorySlug(readProcessEnv().GITHUB_REPOSITORY);
  const explicitBase = options.base === undefined ? undefined : normalizeBasePath(options.base);

  const origin = fromRepository?.origin || homepage.origin;
  // An explicit `--base=/` is a real deployment target (root or custom domain), not a default.
  const base = explicitBase ?? fromRepository?.base ?? homepage.base;

  return {
    url: origin ? `${origin}${base}` : base,
    base,
    lastModified,
  };
}

/** Replaces every `%SITE_*%` token in a source or emitted file with the resolved value. */
function applySiteIdentity(text: string, identity: SiteIdentity): string {
  return text
    .split('%SITE_URL%')
    .join(identity.url)
    .split('%SITE_BASE%')
    .join(identity.base)
    .split('%SITE_LASTMOD%')
    .join(identity.lastModified);
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

/**
 * Fills the site identity tokens during the HTML transform (dev, build and preview) and again
 * in `dist/` for the `public/` files, which Vite copies verbatim and never transforms.
 */
export function siteIdentityPlugin(): Plugin {
  let identity = resolveSiteIdentity();
  let outDir = path.resolve('dist');

  return {
    name: 'site-identity-tokens',
    configResolved(config) {
      // Vite resolves base to `/` when nothing was passed, so only a CLI flag (or a non-root
      // configured base) counts as an explicitly chosen deployment base.
      const explicitBase = readCliBase() ?? (config.base === '/' ? undefined : config.base);
      identity = resolveSiteIdentity({ rootDir: config.root, base: explicitBase });
      outDir = path.resolve(config.root, config.build.outDir);
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => applySiteIdentity(html, identity),
    },
    async closeBundle() {
      for (const fileName of SITE_IDENTITY_PUBLIC_FILES) {
        const filePath = path.join(outDir, fileName);
        let source: string;
        try {
          source = await fs.readFile(filePath, 'utf8');
        } catch (error) {
          if (isMissingFileError(error)) continue;
          throw error;
        }
        const resolved = applySiteIdentity(source, identity);
        if (resolved !== source) {
          await fs.writeFile(filePath, resolved, 'utf8');
        }
      }
    },
  };
}
