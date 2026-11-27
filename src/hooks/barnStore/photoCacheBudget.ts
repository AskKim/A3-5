/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Photo cache budget policy, split out of `useBarnStore`.
 *
 * This is the shape every later slice follows: pure, testable policy moves to
 * `src/hooks/barnStore/*`, while the hook keeps state and wiring.
 */

export interface PhotoCacheBudget {
  maxEntries: number;
  maxBytes: number;
}

const MIB = 1024 * 1024;

/**
 * Bounds how many compressed animal photos the cache may hold for a device capability tier.
 *
 * Tiers at or below 1 get the smallest cache. A non-finite probe (`NaN`) matches no comparison and
 * therefore falls through to the largest budget — that is the behaviour this code had inside the
 * hook, kept as-is here so the extraction stayed behaviour-neutral.
 */
export function getPhotoCacheBudgetForTier(tier: number): PhotoCacheBudget {
  if (tier <= 1) return { maxEntries: 6, maxBytes: 2 * MIB };
  if (tier === 2) return { maxEntries: 10, maxBytes: 4 * MIB };
  if (tier === 3) return { maxEntries: 16, maxBytes: 8 * MIB };
  return { maxEntries: 24, maxBytes: 16 * MIB };
}
