// ============================================================
// src/lib/compute/aqi.ts
// US EPA Air Quality Index engine.
// Multi-pollutant: all six criteria pollutants are converted from
// their ambient units, converted to a sub-index, then the highest
// sub-index becomes the reported AQI (EPA "worst pollutant" rule).
// ============================================================

import { BREAKPOINTS, POLLUTANT_ORDER, type Breakpoint } from '@/constants/pollutants';
import type { AqiCategory, PollutantKey } from '@/types';
import { assertFinite, assertNonNegative, roundTo } from './guards';

/** Result of evaluating every pollutant present in an observation. */
export interface AqiResult {
  /** Overall AQI = highest sub-index (EPA convention). */
  readonly aqi: number;
  /** Pollutant that set the overall AQI, or null when no data was given. */
  readonly dominant: PollutantKey | null;
  /** Per-pollutant sub-indices, rounded to whole AQI points. */
  readonly subIndices: Readonly<Partial<Record<PollutantKey, number>>>;
}

/** Decimal places each pollutant is rounded to before interpolation (EPA). */
const ROUNDING: Readonly<Record<PollutantKey, number>> = {
  pm25: 1,
  pm10: 0,
  o3: 0,
  no2: 0,
  so2: 0,
  co: 1,
};

/** Piecewise-linear interpolation of a concentration inside one band. */
export function interpolateSubIndex(concentration: number, band: Breakpoint): number {
  assertFinite(concentration, 'concentration');
  const span = band.high - band.low;
  if (span <= 0) {
    throw new RangeError(`Breakpoint span must be positive. Received: ${span}`);
  }
  if (concentration < band.low || concentration > band.high) {
    throw new RangeError(
      `Concentration ${concentration} falls outside band [${band.low}, ${band.high}].`,
    );
  }
  const ratio = (concentration - band.low) / span;
  return band.aqiLow + ratio * (band.aqiHigh - band.aqiLow);
}

/**
 * Converts a raw concentration into its 0–500 AQI sub-index.
 * Concentrations above the top breakpoint saturate at 500.
 */
export function subIndex(key: PollutantKey, concentration: number): number {
  assertNonNegative(concentration, `${key} concentration`);
  const table = BREAKPOINTS[key];
  const rounded = roundTo(concentration, ROUNDING[key]);

  const top = table[table.length - 1];
  if (top === undefined) {
    throw new RangeError(`No breakpoint table registered for ${key}.`);
  }
  if (rounded > top.high) return top.aqiHigh;

  for (const band of table) {
    if (rounded <= band.high) {
      // Clamp into the band: rounding can land a hair below `low` on float drift.
      const clamped = Math.min(Math.max(rounded, band.low), band.high);
      return Math.round(interpolateSubIndex(clamped, band));
    }
  }
  return top.aqiHigh;
}

/** Maps an AQI value onto one of the six EPA health bands. */
export function classifyAqi(aqi: number): AqiCategory {
  assertFinite(aqi, 'aqi');
  assertNonNegative(aqi, 'aqi');
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 150) return 'unhealthy_sensitive';
  if (aqi <= 200) return 'unhealthy';
  if (aqi <= 300) return 'very_unhealthy';
  return 'hazardous';
}

/**
 * Evaluates every supplied pollutant and returns the overall AQI.
 * Throws when no usable pollutant is present — an empty observation
 * must never be reported as "Good".
 */
export function computeAqi(
  concentrations: Partial<Record<PollutantKey, number>>,
): AqiResult {
  const subIndices: Partial<Record<PollutantKey, number>> = {};
  let bestKey: PollutantKey | null = null;
  let bestValue = -1;

  for (const key of POLLUTANT_ORDER) {
    const raw = concentrations[key];
    if (raw === undefined || raw === null) continue;
    const index = subIndex(key, raw);
    subIndices[key] = index;
    if (index > bestValue) {
      bestValue = index;
      bestKey = key;
    }
  }

  if (bestKey === null) {
    throw new RangeError('computeAqi() needs at least one pollutant concentration.');
  }

  return { aqi: bestValue, dominant: bestKey, subIndices };
}

/** Reverse lookup: the PM2.5 concentration that produces a target AQI. */
export function concentrationForSubIndex(key: PollutantKey, targetAqi: number): number {
  assertFinite(targetAqi, 'targetAqi');
  if (targetAqi < 0) {
    throw new RangeError(`targetAqi cannot be negative. Received: ${targetAqi}`);
  }
  const table = BREAKPOINTS[key];
  const capped = Math.min(targetAqi, 500);

  for (const band of table) {
    if (capped <= band.aqiHigh) {
      const ratio = (capped - band.aqiLow) / (band.aqiHigh - band.aqiLow);
      const value = band.low + ratio * (band.high - band.low);
      return roundTo(value, ROUNDING[key]);
    }
  }
  const last = table[table.length - 1];
  if (last === undefined) {
    throw new RangeError(`No breakpoint table registered for ${key}.`);
  }
  return last.high;
}
