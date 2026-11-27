/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Pure Content-Agnostic Bounded String LRU Cache & Object-URL Cleanup
 * (`@engine/primitives/boundedCache.ts`).
 *
 * Zero DOM globals, zero Node built-ins, zero domain terminology.
 */

export class BoundedStringLruCache {
  private maxEntries: number;
  private maxBytes: number;
  private totalBytes = 0;
  private readonly entries = new Map<string, string>();

  constructor(maxEntries = 16, maxBytes = Number.POSITIVE_INFINITY) {
    this.maxEntries = Math.max(1, Math.floor(maxEntries));
    this.maxBytes =
      Number.isFinite(maxBytes) && maxBytes > 0
        ? Math.floor(maxBytes)
        : Number.POSITIVE_INFINITY;
  }

  private evictToLimits(): void {
    while (
      this.entries.size > this.maxEntries ||
      (this.entries.size > 0 && this.totalBytes > this.maxBytes)
    ) {
      const oldest = this.entries.entries().next().value;
      if (!oldest) break;
      this.entries.delete(oldest[0]);
      this.totalBytes = Math.max(0, this.totalBytes - oldest[1].length);
    }
  }

  get(key: string): string | undefined {
    const hit = this.entries.get(key);
    if (hit === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, hit);
    return hit;
  }

  set(key: string, value: string): void {
    if (!key || !value) return;
    const prev = this.entries.get(key);
    if (prev !== undefined) {
      this.totalBytes = Math.max(0, this.totalBytes - prev.length);
      this.entries.delete(key);
    }
    this.entries.set(key, value);
    this.totalBytes += value.length;
    this.evictToLimits();
  }

  delete(key: string): void {
    const prev = this.entries.get(key);
    if (prev !== undefined) {
      this.totalBytes = Math.max(0, this.totalBytes - prev.length);
      this.entries.delete(key);
    }
  }

  clear(): void {
    this.entries.clear();
    this.totalBytes = 0;
  }

  resize(nextMaxEntries: number, nextMaxBytes?: number): void {
    this.maxEntries = Math.max(1, Math.floor(nextMaxEntries));
    if (nextMaxBytes !== undefined) {
      this.maxBytes =
        Number.isFinite(nextMaxBytes) && nextMaxBytes > 0
          ? Math.floor(nextMaxBytes)
          : Number.POSITIVE_INFINITY;
    }
    this.evictToLimits();
  }

  trimTo(maxEntries: number, maxBytes?: number): void {
    const prevEntries = this.maxEntries;
    const prevBytes = this.maxBytes;
    this.maxEntries = Math.max(0, Math.floor(maxEntries));
    if (maxBytes !== undefined) {
      this.maxBytes = Number.isFinite(maxBytes) && maxBytes >= 0 ? Math.floor(maxBytes) : prevBytes;
    }
    this.evictToLimits();
    this.maxEntries = prevEntries;
    this.maxBytes = prevBytes;
  }

  size(): number {
    return this.entries.size;
  }

  byteSize(): number {
    return this.totalBytes;
  }
}

export function revokeBlobUrlSafe(url: string | null | undefined): void {
  if (!url || !url.startsWith('blob:')) return;
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore already-revoked or invalid object URL errors
    }
  }
}
