// ============================================================
// src/lib/compute/guards.ts
// Shared numeric guards for the pure compute layer.
// Every public compute entry point validates before it calculates,
// so malformed upstream data can never produce a confident wrong answer.
// ============================================================

/** Throws unless the value is a finite (non-NaN, non-Infinite) number. */
export function assertFinite(value: number, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number. Received: ${String(value)}`);
  }
}

/** Throws unless the value is a finite number greater than zero. */
export function assertPositive(value: number, name: string): void {
  assertFinite(value, name);
  if (value <= 0) {
    throw new RangeError(`${name} must be greater than 0. Received: ${value}`);
  }
}

/** Throws unless the value is a finite number of at least zero. */
export function assertNonNegative(value: number, name: string): void {
  assertFinite(value, name);
  if (value < 0) {
    throw new RangeError(`${name} cannot be negative. Received: ${value}`);
  }
}

/** Throws unless `min <= value <= max`. */
export function assertInRange(value: number, min: number, max: number, name: string): void {
  assertFinite(value, name);
  if (value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}. Received: ${value}`);
  }
}

/** Clamps a finite value into [min, max] without throwing. */
export function clamp(value: number, min: number, max: number): number {
  assertFinite(value, 'value');
  return Math.min(Math.max(value, min), max);
}

/** Rounds to a fixed number of decimals, avoiding binary float drift. */
export function roundTo(value: number, decimals: number): number {
  assertFinite(value, 'value');
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Rounds to one decimal place — the display precision used across the app. */
export function round1(value: number): number {
  return roundTo(value, 1);
}

/** Rounds to two decimal places — used for currency-style figures. */
export function round2(value: number): number {
  return roundTo(value, 2);
}

/** Arithmetic mean of a non-empty list of finite numbers. */
export function mean(values: readonly number[]): number {
  if (values.length === 0) {
    throw new RangeError('mean() requires at least one value.');
  }
  let total = 0;
  for (const value of values) {
    assertFinite(value, 'value');
    total += value;
  }
  return total / values.length;
}

/** Largest value in a non-empty list of finite numbers. */
export function maxOf(values: readonly number[]): number {
  if (values.length === 0) {
    throw new RangeError('maxOf() requires at least one value.');
  }
  let best = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    assertFinite(value, 'value');
    if (value > best) best = value;
  }
  return best;
}

/** Smallest value in a non-empty list of finite numbers. */
export function minOf(values: readonly number[]): number {
  if (values.length === 0) {
    throw new RangeError('minOf() requires at least one value.');
  }
  let best = Number.POSITIVE_INFINITY;
  for (const value of values) {
    assertFinite(value, 'value');
    if (value < best) best = value;
  }
  return best;
}
