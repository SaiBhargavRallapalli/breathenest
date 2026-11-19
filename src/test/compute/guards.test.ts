// ============================================================
// src/test/compute/guards.test.ts
// Numeric guard rails for the pure compute layer.
// ============================================================

import { describe, expect, it } from 'vitest';
import {
  assertFinite,
  assertInRange,
  assertNonNegative,
  assertPositive,
  clamp,
  maxOf,
  mean,
  minOf,
  round1,
  round2,
  roundTo,
} from '@/lib/compute/guards';

describe('assertFinite', () => {
  it('accepts finite numbers', () => {
    expect(() => assertFinite(42, 'value')).not.toThrow();
    expect(() => assertFinite(-0.5, 'value')).not.toThrow();
  });

  it('rejects NaN, Infinity and non-numbers', () => {
    expect(() => assertFinite(Number.NaN, 'value')).toThrow(TypeError);
    expect(() => assertFinite(Number.POSITIVE_INFINITY, 'value')).toThrow(TypeError);
    expect(() => assertFinite('7' as unknown as number, 'value')).toThrow(TypeError);
  });

  it('names the offending field in the message', () => {
    expect(() => assertFinite(Number.NaN, 'aqi')).toThrow(/aqi/);
  });
});

describe('assertPositive / assertNonNegative / assertInRange', () => {
  it('assertPositive rejects zero and negatives', () => {
    expect(() => assertPositive(1, 'n')).not.toThrow();
    expect(() => assertPositive(0, 'n')).toThrow(RangeError);
    expect(() => assertPositive(-3, 'n')).toThrow(RangeError);
  });

  it('assertNonNegative allows zero but rejects negatives', () => {
    expect(() => assertNonNegative(0, 'n')).not.toThrow();
    expect(() => assertNonNegative(-0.01, 'n')).toThrow(RangeError);
  });

  it('assertInRange enforces both bounds inclusively', () => {
    expect(() => assertInRange(5, 0, 10, 'n')).not.toThrow();
    expect(() => assertInRange(0, 0, 10, 'n')).not.toThrow();
    expect(() => assertInRange(10, 0, 10, 'n')).not.toThrow();
    expect(() => assertInRange(11, 0, 10, 'n')).toThrow(RangeError);
    expect(() => assertInRange(-1, 0, 10, 'n')).toThrow(RangeError);
  });
});

describe('clamp / rounding', () => {
  it('clamp keeps values inside the window', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });

  it('clamp rejects non-finite input', () => {
    expect(() => clamp(Number.NaN, 0, 10)).toThrow(TypeError);
  });

  it('roundTo rounds to the requested precision', () => {
    expect(roundTo(3.14159, 2)).toBe(3.14);
    expect(roundTo(1.005, 2)).toBeGreaterThanOrEqual(1);
    expect(roundTo(2, 0)).toBe(2);
  });

  it('round1 and round2 are shorthand precisions', () => {
    expect(round1(8.54)).toBe(8.5);
    expect(round2(8.556)).toBe(8.56);
  });
});

describe('aggregates', () => {
  it('mean averages the series', () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([10])).toBe(10);
  });

  it('mean rejects an empty series', () => {
    expect(() => mean([])).toThrow(RangeError);
  });

  it('maxOf and minOf find the extremes', () => {
    expect(maxOf([3, 9, 4])).toBe(9);
    expect(minOf([3, 9, 4])).toBe(3);
  });

  it('maxOf and minOf reject empty input', () => {
    expect(() => maxOf([])).toThrow(RangeError);
    expect(() => minOf([])).toThrow(RangeError);
  });

  it('rejects non-finite members', () => {
    expect(() => mean([1, Number.NaN])).toThrow(TypeError);
    expect(() => maxOf([1, Number.POSITIVE_INFINITY])).toThrow(TypeError);
    expect(() => minOf([1, Number.NaN])).toThrow(TypeError);
  });
});
