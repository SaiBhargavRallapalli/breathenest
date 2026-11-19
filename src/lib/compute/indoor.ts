// ============================================================
// src/lib/compute/indoor.ts
// Indoor air-quality maths: room volumes, filter sizing, first-order
// clearance decay, and an inversion-aware ventilation scheduler.
// ============================================================

import type { AqiCategory, HourPoint, RiskLevel, TimeWindow } from '@/types';
import { assertInRange, assertPositive, mean, round1, round2 } from './guards';
import { findBestWindows } from './windows';

/** Usable floor area × ceiling height. */
export function roomVolume(lengthM: number, widthM: number, heightM: number): number {
  assertPositive(lengthM, 'lengthM');
  assertPositive(widthM, 'widthM');
  assertPositive(heightM, 'heightM');
  return round1(lengthM * widthM * heightM);
}

/** Clean Air Delivery Rate needed to hit a target air-change rate. */
export function requiredCadr(volumeM3: number, targetAch: number): number {
  assertPositive(volumeM3, 'volumeM3');
  assertPositive(targetAch, 'targetAch');
  return round1(volumeM3 * targetAch);
}

/**
 * Raw airflow a filter must move to deliver the target CADR,
 * accounting for the media's capture efficiency (CADR = Q × η).
 */
export function requiredFilterAirflow(
  volumeM3: number,
  targetAch: number,
  efficiency: number,
): number {
  assertPositive(volumeM3, 'volumeM3');
  assertPositive(targetAch, 'targetAch');
  assertInRange(efficiency, 0.01, 1, 'efficiency');
  return round1((volumeM3 * targetAch) / efficiency);
}

/** Achieved air-change rate from a known CADR. */
export function equivalentAch(volumeM3: number, cadr: number): number {
  assertPositive(volumeM3, 'volumeM3');
  assertPositive(cadr, 'cadr');
  return round2(cadr / volumeM3);
}

export interface ClearanceInput {
  readonly volumeM3: number;
  /** Raw fan airflow through the filter media, m³/h. */
  readonly airflowM3h: number;
  /** Media capture efficiency, 0–1. */
  readonly efficiency: number;
  /** Fraction of the starting concentration to reach (default 0.2 = 80% cleared). */
  readonly targetFraction?: number;
}

/**
 * Time for a sealed room to fall to a target fraction of its starting
 * concentration. Single-compartment decay: t = −ln(f) · V / (Q·η) · 60.
 */
export function clearanceTimeMinutes(input: ClearanceInput): number {
  const { volumeM3, airflowM3h, efficiency } = input;
  const targetFraction = input.targetFraction ?? 0.2;

  assertPositive(volumeM3, 'volumeM3');
  assertPositive(airflowM3h, 'airflowM3h');
  assertInRange(efficiency, 0.01, 1, 'efficiency');
  assertInRange(targetFraction, 0.001, 0.999, 'targetFraction');

  const cleanAirRate = airflowM3h * efficiency;
  const hours = -Math.log(targetFraction) * (volumeM3 / cleanAirRate);
  return round1(hours * 60);
}

/** Design target for equivalent ACH, scaled to how dirty the air is. */
export function recommendedAch(category: AqiCategory): number {
  switch (category) {
    case 'good':
      return 0.5;
    case 'moderate':
      return 1;
    case 'unhealthy_sensitive':
      return 2;
    case 'unhealthy':
      return 4;
    case 'very_unhealthy':
      return 5;
    case 'hazardous':
      return 6;
  }
}

export interface VentilationAdvice {
  readonly shouldOpen: boolean;
  readonly reason: string;
  /** Cleanest contiguous stretch still ahead today, if one exists. */
  readonly window: TimeWindow | null;
  readonly recommendedHours: readonly number[];
}

/**
 * Decides whether opening the windows will help.
 * Opening only helps when outdoor air is both cleaner than indoors and
 * itself acceptable — otherwise it imports the smog.
 */
export function ventilationAdvice(
  hours: readonly HourPoint[],
  currentHour: number,
  estimatedIndoorAqi: number,
): VentilationAdvice {
  if (hours.length === 0) {
    return {
      shouldOpen: false,
      reason: 'No forecast available — keep windows closed and run filtration as a precaution.',
      window: null,
      recommendedHours: [],
    };
  }

  const upcoming = hours.filter((entry) => entry.hour >= currentHour);
  const pool = upcoming.length > 0 ? upcoming : hours;
  const indoor = Math.max(0, estimatedIndoorAqi);

  const usable = pool.filter((entry) => entry.aqi < indoor && entry.aqi <= 100);
  if (usable.length === 0) {
    const outdoorPeak = Math.round(Math.max(...pool.map((entry) => entry.aqi)));
    return {
      shouldOpen: false,
      reason: `Outdoor air (AQI ${outdoorPeak}) never beats today's indoor estimate (AQI ${indoor}). Keep windows shut and run your filter.`,
      window: null,
      recommendedHours: [],
    };
  }

  const window = findBestWindows(usable, { durationHours: 1, limit: 1, maxPeakAqi: 100 })[0] ?? null;
  const start = window?.startHour ?? usable[0]?.hour ?? currentHour;
  const recommendedHours = usable.map((entry) => entry.hour);
  const meanOutdoor = Math.round(mean(usable.map((entry) => entry.aqi)));

  return {
    shouldOpen: true,
    reason: `Outdoor air falls to about AQI ${meanOutdoor} from ${formatClock(start)} onward — vent then, and close up before the evening peak.`,
    window,
    recommendedHours,
  };
}

/** Renders an hour number as a 24-hour clock label. */
export function formatClock(hour: number): string {
  const normalised = ((Math.round(hour) % 24) + 24) % 24;
  return `${String(normalised).padStart(2, '0')}:00`;
}

/** Human label for an activity risk band. */
export function riskLabel(risk: RiskLevel): string {
  switch (risk) {
    case 'ideal':
      return 'Clean';
    case 'acceptable':
      return 'OK';
    case 'poor':
      return 'Poor';
    case 'avoid':
      return 'Avoid';
  }
}
