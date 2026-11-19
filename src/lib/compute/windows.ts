// ============================================================
// src/lib/compute/windows.ts
// Temporal exposure optimiser.
// Instead of asking "which route is cleanest" this asks "which hours
// are cleanest" — a sliding-window search over a 24-hour forecast.
// ============================================================

import type { HourPoint, RiskLevel, TimeWindow } from '@/types';
import { assertPositive, maxOf, mean, minOf, round1 } from './guards';

/** AQI → activity risk band. Thresholds follow the EPA category edges. */
export function classifyRisk(aqi: number): RiskLevel {
  if (aqi <= 50) return 'ideal';
  if (aqi <= 100) return 'acceptable';
  if (aqi <= 150) return 'poor';
  return 'avoid';
}

export interface WindowOptions {
  /** Length of the candidate slot in whole hours (default 2). */
  readonly durationHours?: number;
  /** How many slots to return (default 3). */
  readonly limit?: number;
  /** Reject any slot whose peak AQI exceeds this (default 150). */
  readonly maxPeakAqi?: number;
  /** Only consider hours from this index onwards (default 0). */
  readonly fromHour?: number;
}

const DEFAULTS: Required<WindowOptions> = {
  durationHours: 2,
  limit: 3,
  maxPeakAqi: 150,
  fromHour: 0,
};

/**
 * Finds the cleanest contiguous slots in a day.
 * Slots are ranked by average AQI, but classified by their peak so a
 * single bad hour can never hide inside an otherwise clean average.
 */
export function findBestWindows(
  hours: readonly HourPoint[],
  options: WindowOptions = {},
): TimeWindow[] {
  const { durationHours, limit, maxPeakAqi, fromHour } = { ...DEFAULTS, ...options };
  assertPositive(durationHours, 'durationHours');
  if (!Number.isInteger(durationHours)) {
    throw new RangeError(`durationHours must be a whole number. Received: ${durationHours}`);
  }
  if (limit < 1) {
    throw new RangeError(`limit must be at least 1. Received: ${limit}`);
  }

  const startAt = Math.max(0, Math.min(fromHour, hours.length));
  const lastStart = hours.length - durationHours;
  if (lastStart < startAt) return [];

  const candidates: TimeWindow[] = [];
  for (let start = startAt; start <= lastStart; start += 1) {
    const slice = hours.slice(start, start + durationHours);
    if (slice.length === 0) continue;

    const concentrations = slice.map((entry) => entry.aqi);
    const peak = maxOf(concentrations);
    if (peak > maxPeakAqi) continue;

    const first = slice[0];
    const last = slice[slice.length - 1];
    if (first === undefined || last === undefined) continue;

    candidates.push({
      startHour: first.hour,
      endHour: last.hour + 1,
      peakAqi: Math.round(peak),
      averageAqi: Math.round(mean(concentrations)),
      risk: classifyRisk(peak),
    });
  }

  return candidates
    .sort((a, b) => a.averageAqi - b.averageAqi || a.peakAqi - b.peakAqi)
    .slice(0, limit);
}

/** The single cleanest slot, or null when nothing clears the threshold. */
export function bestWindow(
  hours: readonly HourPoint[],
  options: WindowOptions = {},
): TimeWindow | null {
  return findBestWindows(hours, { ...options, limit: 1 })[0] ?? null;
}

/** The dirtiest contiguous slot — used to warn about peak commuting hours. */
export function worstWindow(
  hours: readonly HourPoint[],
  durationHours = 2,
): TimeWindow | null {
  assertPositive(durationHours, 'durationHours');
  const lastStart = hours.length - durationHours;
  if (lastStart < 0) return null;

  let worst: TimeWindow | null = null;
  for (let start = 0; start <= lastStart; start += 1) {
    const slice = hours.slice(start, start + durationHours);
    const concentrations = slice.map((entry) => entry.aqi);
    const first = slice[0];
    const last = slice[slice.length - 1];
    if (first === undefined || last === undefined) continue;

    const candidate: TimeWindow = {
      startHour: first.hour,
      endHour: last.hour + 1,
      peakAqi: Math.round(maxOf(concentrations)),
      averageAqi: Math.round(mean(concentrations)),
      risk: classifyRisk(maxOf(concentrations)),
    };
    if (worst === null || candidate.averageAqi > worst.averageAqi) {
      worst = candidate;
    }
  }
  return worst;
}

/** Summary statistics for a day's forecast, used by the dashboard header. */
export interface DayStats {
  readonly minAqi: number;
  readonly maxAqi: number;
  readonly averageAqi: number;
  readonly cleanestHour: number;
  readonly dirtiestHour: number;
}

export function dayStats(hours: readonly HourPoint[]): DayStats {
  if (hours.length === 0) {
    throw new RangeError('dayStats() requires at least one hourly reading.');
  }
  const values = hours.map((entry) => entry.aqi);
  const min = minOf(values);
  const max = maxOf(values);

  const cleanest = hours.find((entry) => entry.aqi === min);
  const dirtiest = hours.find((entry) => entry.aqi === max);

  return {
    minAqi: Math.round(min),
    maxAqi: Math.round(max),
    averageAqi: round1(mean(values)),
    cleanestHour: cleanest?.hour ?? 0,
    dirtiestHour: dirtiest?.hour ?? 0,
  };
}
