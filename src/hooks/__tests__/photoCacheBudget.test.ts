import { describe, expect, it } from 'vitest';
import { getPhotoCacheBudgetForTier } from '../barnStore/photoCacheBudget';

const MIB = 1024 * 1024;

describe('getPhotoCacheBudgetForTier', () => {
  it('gives the smallest cache to tier 1 and below', () => {
    for (const tier of [0, 1, -3]) {
      expect(getPhotoCacheBudgetForTier(tier)).toEqual({ maxEntries: 6, maxBytes: 2 * MIB });
    }
  });

  it('scales through the known tiers', () => {
    expect(getPhotoCacheBudgetForTier(2)).toEqual({ maxEntries: 10, maxBytes: 4 * MIB });
    expect(getPhotoCacheBudgetForTier(3)).toEqual({ maxEntries: 16, maxBytes: 8 * MIB });
    expect(getPhotoCacheBudgetForTier(4)).toEqual({ maxEntries: 24, maxBytes: 16 * MIB });
  });

  it('caps anything above tier 3 at the largest budget', () => {
    expect(getPhotoCacheBudgetForTier(5)).toEqual(getPhotoCacheBudgetForTier(4));
    expect(getPhotoCacheBudgetForTier(99)).toEqual(getPhotoCacheBudgetForTier(4));
  });

  it('keeps the pre-split behaviour for non-finite tiers', () => {
    // `NaN` matches no comparison, so it falls through to the largest budget, as it did inside the hook.
    expect(getPhotoCacheBudgetForTier(Number.NaN)).toEqual(getPhotoCacheBudgetForTier(4));
    expect(getPhotoCacheBudgetForTier(Number.POSITIVE_INFINITY)).toEqual(getPhotoCacheBudgetForTier(4));
  });

  it('never shrinks as the tier rises', () => {
    let previous = getPhotoCacheBudgetForTier(0);
    for (let tier = 1; tier <= 6; tier += 1) {
      const current = getPhotoCacheBudgetForTier(tier);
      expect(current.maxEntries).toBeGreaterThanOrEqual(previous.maxEntries);
      expect(current.maxBytes).toBeGreaterThanOrEqual(previous.maxBytes);
      previous = current;
    }
  });
});
