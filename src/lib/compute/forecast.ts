// ============================================================
// src/lib/compute/forecast.ts
// Stagnation / inversion heuristic and small series utilities.
// Uses only surface observations the app already has: wind speed,
// relative humidity and the shape of the day's AQI curve.
// ============================================================

import type { HourlyForecast, StagnationAssessment, WeatherSnapshot } from '@/types';
import { maxOf, minOf, round1 } from './guards';

export interface StagnationInput {
  readonly weather: WeatherSnapshot;
  readonly hours: readonly HourlyForecast[];
}

/**
 * Scores how likely the air is to sit still and accumulate.
 * Calm air (≤5 km/h) is the dominant term because without wind the
 * boundary layer cannot export what the traffic and industry emit.
 */
export function assessStagnation({ weather, hours }: StagnationInput): StagnationAssessment {
  const reasons: string[] = [];
  let score = 0;

  const wind = weather.windSpeedKmh;
  if (wind !== null && Number.isFinite(wind)) {
    if (wind <= 5) {
      score += 3;
      reasons.push(`Wind is nearly calm at ${round1(wind)} km/h, so exhaust has nowhere to disperse.`);
    } else if (wind <= 8) {
      score += 2;
      reasons.push(`Light wind of ${round1(wind)} km/h limits vertical mixing over the city.`);
    } else if (wind <= 12) {
      score += 1;
      reasons.push(`Moderate wind of ${round1(wind)} km/h only partly flushes the street canyon.`);
    }
  }

  const humidity = weather.humidityPct;
  if (humidity !== null && Number.isFinite(humidity)) {
    if (humidity >= 85) {
      score += 2;
      reasons.push(`Humidity at ${Math.round(humidity)}% speeds secondary particle formation.`);
    } else if (humidity >= 70) {
      score += 1;
      reasons.push(`Humidity of ${Math.round(humidity)}% allows some aerosol growth.`);
    }
  }

  if (hours.length > 0) {
    score += scoreFromDiurnalShape(hours, reasons);
  }

  const level: StagnationAssessment['level'] = score >= 4 ? 'severe' : score >= 1 ? 'moderate' : 'none';
  if (reasons.length === 0) {
    reasons.push('Wind, humidity and the daily curve all indicate the air is dispersing normally.');
  }
  return { level, score, reasons };
}

/** Contributes the curve-shape terms (daily swing + morning buildup). */
function scoreFromDiurnalShape(hours: readonly HourlyForecast[], reasons: string[]): number {
  let score = 0;
  const values = hours.map((entry) => entry.aqi);
  const peak = maxOf(values);
  const trough = minOf(values);

  if (peak > 0) {
    const amplitude = (peak - trough) / peak;
    if (amplitude >= 0.5) {
      score += 2;
      reasons.push(`The day swings ${Math.round(amplitude * 100)}% between clean and dirty hours — a classic accumulation cycle.`);
    } else if (amplitude >= 0.3) {
      score += 1;
      reasons.push(`A ${Math.round(amplitude * 100)}% daily swing suggests partial overnight trapping.`);
    }
  }

  const morning = hours.filter((entry) => entry.hour >= 5 && entry.hour <= 9);
  if (morning.length > 0 && trough > 0) {
    const morningPeak = maxOf(morning.map((entry) => entry.aqi));
    const ratio = morningPeak / trough;
    if (ratio >= 1.5) {
      score += 2;
      reasons.push(`Morning AQI runs ${round1(ratio)}× the cleanest hour, pointing to a dawn inversion cap.`);
    } else if (ratio >= 1.25) {
      score += 1;
      reasons.push(`Morning AQI is ${round1(ratio)}× the cleanest hour, so early hours are comparatively dirtier.`);
    }
  }

  return score;
}

/**
 * Centred moving average that keeps the series the same length.
 * Out-of-range windows use the nearest available neighbour.
 */
export function smoothSeries(values: readonly number[], windowSize = 3): number[] {
  if (values.length === 0) return [];
  if (windowSize < 1 || !Number.isInteger(windowSize)) {
    throw new RangeError(`windowSize must be a positive integer. Received: ${windowSize}`);
  }
  const half = Math.floor(windowSize / 2);

  return values.map((_, index) => {
    const start = Math.max(0, index - half);
    const end = Math.min(values.length - 1, index + half);
    const slice = values.slice(start, end + 1);
    return round1(slice.reduce((sum, value) => sum + value, 0) / slice.length);
  });
}

/** Peak-to-trough swing of a series as a fraction of its peak. */
export function diurnalAmplitude(values: readonly number[]): number {
  if (values.length === 0) {
    throw new RangeError('diurnalAmplitude() requires at least one value.');
  }
  const peak = maxOf(values);
  if (peak === 0) return 0;
  return round1((peak - minOf(values)) / peak);
}
