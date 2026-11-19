// ============================================================
// src/test/server/cache.test.ts
// TTL + LRU cache used for upstream responses and generated text.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TtlCache, hashPayload } from '@/../server/cache';

describe('TtlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-19T09:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and returns values', () => {
    const cache = new TtlCache<string>(10, 1000);
    cache.set('a', 'alpha');
    expect(cache.get('a')).toBe('alpha');
    expect(cache.size).toBe(1);
  });

  it('returns undefined for a missing key', () => {
    const cache = new TtlCache<string>();
    expect(cache.get('nope')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('expires entries after the TTL', () => {
    const cache = new TtlCache<string>(10, 1000);
    cache.set('a', 'alpha');
    vi.advanceTimersByTime(999);
    expect(cache.get('a')).toBe('alpha');
    vi.advanceTimersByTime(2);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('accepts a per-entry TTL override', () => {
    const cache = new TtlCache<string>(10, 60_000);
    cache.set('short', 'value', 500);
    vi.advanceTimersByTime(600);
    expect(cache.get('short')).toBeUndefined();
  });

  it('evicts the least recently used entry when full', () => {
    const cache = new TtlCache<string>(2, 60_000);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.get('a'); // refresh "a" so "b" becomes the LRU entry
    cache.set('c', '3');

    expect(cache.get('a')).toBe('1');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe('3');
    expect(cache.size).toBe(2);
  });

  it('overwrites an existing key without growing', () => {
    const cache = new TtlCache<string>(5, 60_000);
    cache.set('a', '1');
    cache.set('a', '2');
    expect(cache.get('a')).toBe('2');
    expect(cache.size).toBe(1);
  });

  it('prunes expired entries and clears everything', () => {
    const cache = new TtlCache<string>(10, 1000);
    cache.set('a', '1');
    cache.set('b', '2', 10_000);
    vi.advanceTimersByTime(1100);
    cache.prune();
    expect(cache.size).toBe(1);
    expect(cache.get('b')).toBe('2');

    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('rejects a non-positive capacity', () => {
    expect(() => new TtlCache(0, 1000)).toThrow(RangeError);
  });
});

describe('hashPayload', () => {
  it('is stable for the same payload', () => {
    expect(hashPayload({ a: 1, b: 'two' })).toBe(hashPayload({ a: 1, b: 'two' }));
  });

  it('differs for different payloads', () => {
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
    expect(hashPayload('plan')).not.toBe(hashPayload('advisory'));
  });

  it('produces a short opaque hex key', () => {
    const key = hashPayload({ secret: 'value' });
    expect(key).toMatch(/^[0-9a-f]{16}$/);
    expect(key).not.toContain('secret');
  });

  it('tolerates null and undefined payloads', () => {
    expect(() => hashPayload(null)).not.toThrow();
    expect(() => hashPayload(undefined)).not.toThrow();
    expect(hashPayload(null)).toBe(hashPayload(undefined));
  });
});
