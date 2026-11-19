// ============================================================
// src/test/storage.test.ts
// Local persistence must survive corrupted, missing and blocked
// storage without ever throwing into the UI.
// ============================================================

import { describe, expect, it, vi } from 'vitest';
import {
  STORAGE_KEYS,
  loadEnum,
  loadJson,
  saveJson,
  safeParse,
} from '@/services/storage';

describe('safeParse', () => {
  it('parses valid JSON', () => {
    expect(safeParse('{"a":1}', { a: 0 })).toEqual({ a: 1 });
    expect(safeParse('[1,2,3]', [])).toEqual([1, 2, 3]);
    expect(safeParse('"text"', '')).toBe('text');
  });

  it('falls back on malformed JSON', () => {
    expect(safeParse('{not json', { ok: true })).toEqual({ ok: true });
    expect(safeParse('', { ok: true })).toEqual({ ok: true });
  });

  it('falls back on null input and JSON null', () => {
    expect(safeParse(null, 'fallback')).toBe('fallback');
    expect(safeParse('null', 'fallback')).toBe('fallback');
    expect(safeParse('undefined', 'fallback')).toBe('fallback');
  });
});

describe('loadJson / saveJson', () => {
  it('round-trips a value', () => {
    saveJson('test:key', { hello: 'world', n: 3 });
    expect(loadJson('test:key', null)).toEqual({ hello: 'world', n: 3 });
  });

  it('returns the fallback when the key is absent', () => {
    expect(loadJson('test:missing', 42)).toBe(42);
  });

  it('returns the fallback for corrupted stored JSON', () => {
    window.localStorage.setItem('test:corrupt', '{broken');
    expect(loadJson('test:corrupt', 'safe')).toBe('safe');
  });

  it('ignores storage that throws (private mode / quota)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveJson('test:quota', { big: true })).not.toThrow();
    spy.mockRestore();
  });

  it('ignores reads when localStorage itself throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(loadJson('test:denied', 'fallback')).toBe('fallback');
    spy.mockRestore();
  });

  it('exposes namespaced keys so apps cannot collide', () => {
    expect(STORAGE_KEYS.profile).toContain('breathenest');
    expect(STORAGE_KEYS.language).toContain('breathenest');
    expect(STORAGE_KEYS.swaps).toContain('breathenest');
    expect(STORAGE_KEYS.pledges).toContain('breathenest');
  });
});

describe('loadEnum', () => {
  it('accepts a whitelisted value', () => {
    saveJson('test:lang', 'hi');
    expect(loadEnum('test:lang', ['en', 'hi', 'ar'] as const, 'en')).toBe('hi');
  });

  it('rejects a value outside the whitelist', () => {
    saveJson('test:lang', 'xx');
    expect(loadEnum('test:lang', ['en', 'hi'] as const, 'en')).toBe('en');
  });

  it('falls back when nothing is stored', () => {
    expect(loadEnum('test:absent', ['en', 'hi'] as const, 'en')).toBe('en');
  });

  it('rejects non-string stored values', () => {
    saveJson('test:lang', { nested: true });
    expect(loadEnum('test:lang', ['en', 'hi'] as const, 'en')).toBe('en');
  });
});
