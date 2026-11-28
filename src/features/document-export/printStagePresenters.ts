/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The pure document-composition rules behind the print preview.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Print-stage presenters shared by every printable surface: CSS scoping into the caller's print-stage selector,
 * `@page`/orientation detection, executable-markup stripping, and the abort/error wording for a
 * failed download, share or PDF export. None of this touches the DOM or the domain model, so it
 * lives with the document-export feature instead of inside `PrintPreviewModal`.
 */

const MIN_PREVIEW_ZOOM = 0.2;
const MAX_PREVIEW_ZOOM = 2.5;

export function clampPreviewZoom(value: number): number {
  return Math.min(MAX_PREVIEW_ZOOM, Math.max(MIN_PREVIEW_ZOOM, value));
}

export function scopePrintSelectorList(selectorText: string, stageSelector: string): string {
  return selectorText
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((sel) => {
      if (/^(html|body)$/i.test(sel)) return stageSelector;
      if (/^(html|body)\s+/i.test(sel)) {
        return `${stageSelector} ${sel.replace(/^(html|body)\s+/i, '')}`;
      }
      return `${stageSelector} ${sel}`;
    })
    .join(', ');
}

export function extractScopedPrintCssFromRules(
  rules: ArrayLike<CSSRule>,
  pageRules: string[],
  scopedRules: string[],
  stageSelector: string
): void {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule) continue;
    const trimmed =
      typeof rule.cssText === 'string' ? rule.cssText.replace(/^\s+/, '') : '';
    if (rule.type === 6 || trimmed.startsWith('@page')) {
      pageRules.push(rule.cssText);
    } else if (rule.type === 1) {
      const styleRule = rule as CSSStyleRule;
      const scoped = scopePrintSelectorList(styleRule.selectorText, stageSelector);
      if (scoped) {
        scopedRules.push(`${scoped} { ${styleRule.style.cssText} }`);
      }
    } else if (rule.type === 4) {
      const mediaRule = rule as CSSMediaRule;
      const mediaText = (mediaRule.media?.mediaText || '').trim().toLowerCase();
      if (mediaText === 'screen' || /\bonly\s+screen\b/.test(mediaText)) {
        continue;
      }
      const childScoped: string[] = [];
      if (mediaRule.cssRules) {
        extractScopedPrintCssFromRules(mediaRule.cssRules, pageRules, childScoped, stageSelector);
      }
      if (childScoped.length > 0) {
        if (!mediaText || mediaText === 'print' || mediaText === 'all') {
          scopedRules.push(...childScoped);
        } else {
          const cleanMedia = mediaRule.media.mediaText.replace(/\bscreen\b/gi, 'print');
          scopedRules.push(`@media ${cleanMedia} {\n${childScoped.join('\n')}\n}`);
        }
      }
    }
  }
}

function findMatchingBrace(text: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function extractScopedPrintCssFromRawCss(
  rawCss: string,
  stageSelector: string
): {
  pageRules: string[];
  scopedRules: string[];
} {
  const pageRules: string[] = [];
  const remainingParts: string[] = [];
  let cursor = 0;
  const atRuleRe = /@(page|media)\b([^\{]*)\{/gi;

  while (cursor < rawCss.length) {
    atRuleRe.lastIndex = cursor;
    const match = atRuleRe.exec(rawCss);
    if (!match) {
      remainingParts.push(rawCss.slice(cursor));
      break;
    }
    if (match.index > cursor) {
      remainingParts.push(rawCss.slice(cursor, match.index));
    }
    const openBrace = match.index + match[0].length - 1;
    const closeBrace = findMatchingBrace(rawCss, openBrace);
    if (closeBrace < 0) {
      remainingParts.push(rawCss.slice(match.index));
      break;
    }
    const kind = match[1].toLowerCase();
    const prelude = match[2].trim();
    const inner = rawCss.slice(openBrace + 1, closeBrace);
    if (kind === 'page') {
      pageRules.push(rawCss.slice(match.index, closeBrace + 1));
    } else if (kind === 'media') {
      const lowerPrelude = prelude.toLowerCase();
      if (lowerPrelude !== 'screen' && !/\bonly\s+screen\b/.test(lowerPrelude)) {
        const nested = extractScopedPrintCssFromRawCss(inner, stageSelector);
        pageRules.push(...nested.pageRules);
        remainingParts.push(nested.scopedRules.join('\n'));
      }
    }
    cursor = closeBrace + 1;
  }

  const rewritten = remainingParts
    .join('\n')
    .replace(/(^|[\s,}])(html|body)(?=[\s,{])/gi, `$1${stageSelector}`)
    .trim();

  return {
    pageRules,
    scopedRules: rewritten ? [rewritten] : [],
  };
}

export function detectDocumentPrintOrientation(
  pageRules: readonly string[],
  htmlContent: string
): 'landscape' | 'portrait' {
  const combined = `${pageRules.join('\n')}\n${htmlContent}`;
  return /@page[^}]*\blandscape\b/i.test(combined) ? 'landscape' : 'portrait';
}

const PRINT_STAGE_FORBIDDEN_PAIRED_TAGS_RE =
  /<\s*(script|iframe|object|applet|noscript)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const PRINT_STAGE_FORBIDDEN_SINGLE_TAGS_RE =
  /<\s*\/?\s*(script|iframe|object|embed|applet|base|meta)\b[^>]*>/gi;
const PRINT_STAGE_INLINE_HANDLER_RE =
  /\s+on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const PRINT_STAGE_DANGEROUS_URL_ATTR_RE =
  /\s+(href|src|action|formaction|xlink:href)\s*=\s*(?:"\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^"]*"|'\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^']*'|(?:javascript|vbscript):[^\s>]+)/gi;

/**
 * Strips executable markup (`<script>`, `<iframe>`, `<object>`, `<embed>`, `<base>`, `<meta>`,
 * inline `on*` handlers, and `javascript:`/`vbscript:`/`data:text/html` URLs) before mounting
 * printable document bodies into the caller's print stage on the main app origin.
 */
export function sanitizePrintStageHtml(rawBodyHtml: string): string {
  if (!rawBodyHtml) return '';
  return rawBodyHtml
    .replace(PRINT_STAGE_FORBIDDEN_PAIRED_TAGS_RE, '')
    .replace(PRINT_STAGE_FORBIDDEN_SINGLE_TAGS_RE, '')
    .replace(PRINT_STAGE_INLINE_HANDLER_RE, '')
    .replace(PRINT_STAGE_DANGEROUS_URL_ATTR_RE, '');
}

export function isPrintPreviewAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  return (err as { name?: unknown }).name === 'AbortError';
}
