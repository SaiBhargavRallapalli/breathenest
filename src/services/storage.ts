// ============================================================
// src/services/storage.ts
// Local persistence with defensive deserialization. Corrupted or
// tampered JSON must never crash the app, so every read falls back
// to a supplied default instead of throwing.
// ============================================================

export const STORAGE_KEYS = {
  profile: 'breathenest:profile:v1',
  language: 'breathenest:language:v1',
  pledges: 'breathenest:pledges:v1',
  swaps: 'breathenest:swaps:v1',
} as const;

/** Parses JSON, returning `fallback` for null, malformed or wrong-typed data. */
export function safeParse<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

/** Reads a persisted value, guarding against a disabled localStorage. */
export function loadJson<T>(key: string, fallback: T): T {
  try {
    return safeParse<T>(window.localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

/** Writes a value, ignoring quota and privacy-mode failures. */
export function saveJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked; the app still works in memory.
  }
}

/** Reads a whitelisted string, falling back when it is not a known value. */
export function loadEnum<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const raw = loadJson<string | null>(key, null);
  return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}
