/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Contract gate for `useBarnStore`'s public surface.
 *
 * The store is being decomposed into slices; every screen reaches it through one context value, so a
 * dropped or renamed key is a silent runtime break with no DOM test to catch it. This freezes the set
 * of keys the hook returns. Adding a key is fine — update the snapshot in the same commit. Removing or
 * renaming one fails until the snapshot says so, which forces the consumer update into the same change.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HOOK_SOURCE = path.resolve(import.meta.dirname, '..', 'useBarnStore.ts');
const SNAPSHOT = path.resolve(import.meta.dirname, 'barnStoreContract.keys.json');

/** Guards against a parser regression silently "passing" by finding almost nothing. */
const MIN_EXPECTED_KEYS = 150;

interface Extraction {
  keys: string[];
  problems: string[];
}

function extractReturnedKeys(source: string): Extraction {
  const problems: string[] = [];
  const hookStart = source.indexOf('export function useBarnStore(');
  const returnStart = hookStart < 0 ? -1 : source.indexOf('\n  return {', hookStart);
  const returnEnd = returnStart < 0 ? -1 : source.indexOf('\n  };\n', returnStart);

  if (hookStart < 0) problems.push('could not locate `export function useBarnStore(`');
  if (returnStart < 0) problems.push('could not locate the hook\'s `return {` literal');
  if (returnEnd < 0) problems.push('could not locate the closing `};` of the returned literal');
  if (problems.length > 0) return { keys: [], problems };

  const keys: string[] = [];
  for (const line of source.slice(returnStart, returnEnd).split('\n')) {
    if (/^    \.\.\./.test(line)) problems.push(`spread key is not allowed: ${line.trim()}`);
    if (/^    \[/.test(line)) problems.push(`computed key is not allowed: ${line.trim()}`);
    const match = line.match(/^    ([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::|,)/);
    if (match) keys.push(match[1]);
  }
  return { keys, problems };
}

const source = fs.readFileSync(HOOK_SOURCE, 'utf8');
const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')) as string[];
const { keys, problems } = extractReturnedKeys(source);

describe('useBarnStore public surface', () => {
  it('parses the returned object literal', () => {
    expect(problems).toEqual([]);
    expect(keys.length).toBeGreaterThanOrEqual(MIN_EXPECTED_KEYS);
  });

  it('returns unique keys', () => {
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
    expect(duplicates).toEqual([]);
  });

  it('matches the committed contract snapshot', () => {
    const snapshotKeys = new Set(snapshot);
    const returned = new Set(keys);
    const added = keys.filter((key) => !snapshotKeys.has(key)).sort();
    const removed = snapshot.filter((key) => !returned.has(key)).sort();
    expect(
      { added, removed },
      'Update barnStoreContract.keys.json in the same commit as the store change: "removed" means a consumer will break.'
    ).toEqual({ added: [], removed: [] });
  });
});
