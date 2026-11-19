// ============================================================
// server/cache.ts
// TTL + LRU cache used for both upstream air-quality responses and
// generated AI text. Hashing keeps keys short and opaque, and the
// eviction rule keeps memory bounded no matter how long we run.
// ============================================================

import { createHash } from 'node:crypto';

interface Entry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

/** Bounded key-value store with per-entry expiry and LRU eviction. */
export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();

  constructor(
    private readonly maxEntries = 250,
    private readonly defaultTtlMs = 600_000,
  ) {
    if (maxEntries < 1) {
      throw new RangeError(`maxEntries must be at least 1. Received: ${maxEntries}`);
    }
  }

  /** Number of live (unexpired) entries. */
  get size(): number {
    this.prune();
    return this.store.size;
  }

  /** Returns the stored value, or undefined when missing or expired. */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // Refresh recency so hot keys survive eviction.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  /** Stores a value, evicting the least recently used entry when full. */
  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    if (this.store.has(key)) this.store.delete(key);
    while (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Drops every expired entry. Called on writes to keep the map tidy. */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }

  /** Empties the cache entirely (used between test cases). */
  clear(): void {
    this.store.clear();
  }
}

/** Stable, opaque cache key: first 16 hex chars of a SHA-256 digest. */
export function hashPayload(payload: unknown): string {
  const canonical = JSON.stringify(payload ?? null);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}
