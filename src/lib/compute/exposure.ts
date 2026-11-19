// ============================================================
// src/lib/compute/exposure.ts
// Inhaled-dose model.
// Dose (µg) = concentration (µg/m³) × time (h) × ventilation (m³/h)
//             × (1 − protection)
// Ventilation rates follow standard adult resting/work rates;
// protection is a 0–1 filtration efficiency for masks or cabin filters.
// ============================================================

import type { ActivityLevel } from '@/types';
import { assertInRange, assertNonNegative, round1 } from './guards';

/** Adult minute ventilation converted to m³ per hour, by activity. */
export const BREATHING_RATES: Readonly<Record<ActivityLevel, number>> = {
  rest: 0.36, // 6 L/min — seated or sleeping
  light: 0.72, // 12 L/min — slow walking, light chores
  moderate: 1.44, // 24 L/min — brisk walking, cycling at pace
  vigorous: 2.4, // 40 L/min — running, hard cycling, heavy manual work
};

/** WHO 24-hour mean guideline for PM2.5 (µg/m³). */
export const WHO_DAILY_GUIDELINE = 15;

/**
 * Reference daily inhaled dose implied by the WHO guideline for an
 * average adult (15 µg/m³ × 24 h × 0.83 m³/h ≈ 299 µg).
 */
export const REFERENCE_DAILY_DOSE_UG = round1(WHO_DAILY_GUIDELINE * 24 * 0.83);

export interface DoseInput {
  /** Ambient PM2.5 concentration in µg/m³. */
  readonly concentrationUgM3: number;
  /** Exposure duration in hours. */
  readonly durationHours: number;
  /** Activity determining the ventilation rate. */
  readonly activity: ActivityLevel;
  /** Filtration efficiency between 0 (none) and 1 (perfect). */
  readonly protection?: number;
}

/** Inhaled PM2.5 dose for a single exposure segment, in micrograms. */
export function inhaledDose(input: DoseInput): number {
  const { concentrationUgM3, durationHours, activity } = input;
  const protection = input.protection ?? 0;

  assertNonNegative(concentrationUgM3, 'concentrationUgM3');
  assertNonNegative(durationHours, 'durationHours');
  assertInRange(protection, 0, 1, 'protection');

  const ventilation = BREATHING_RATES[activity];
  const dose = concentrationUgM3 * durationHours * ventilation * (1 - protection);
  return round1(dose);
}

export interface DoseSegment extends DoseInput {
  readonly label: string;
}

/** Result of comparing a planned day against the WHO reference dose. */
export interface DoseAssessment {
  readonly totalUg: number;
  readonly referenceUg: number;
  /** total ÷ reference; below 1 means within the guideline-derived budget. */
  readonly ratio: number;
  readonly withinBudget: boolean;
  readonly message: string;
}

/** Sums every segment of a day and scores it against the reference dose. */
export function assessDailyDose(segments: readonly DoseSegment[]): DoseAssessment {
  let total = 0;
  for (const segment of segments) {
    total += inhaledDose(segment);
  }
  const roundedTotal = round1(total);
  const ratio = round1(roundedTotal / REFERENCE_DAILY_DOSE_UG);
  const withinBudget = roundedTotal <= REFERENCE_DAILY_DOSE_UG;

  return {
    totalUg: roundedTotal,
    referenceUg: REFERENCE_DAILY_DOSE_UG,
    ratio,
    withinBudget,
    message: withinBudget
      ? `Your planned day stays at ${ratio}× the WHO-derived daily reference dose.`
      : `Your planned day reaches ${ratio}× the WHO-derived daily reference dose — trim outdoor effort or add filtration.`,
  };
}

/**
 * Fraction of outdoor concentration that penetrates indoors.
 * Values are design estimates for a sealed room with the given setup.
 */
export const INFILTRATION_RATIOS = {
  /** Windows open — indoor tracks outdoor closely. */
  openWindows: 0.85,
  /** Closed home, no filtration (typical leaky building). */
  closedUnfiltered: 0.6,
  /** Closed home with a DIY box-fan filter running. */
  closedDiyFilter: 0.4,
  /** Closed home with a sealed HEPA purifier running. */
  closedHepa: 0.2,
} as const;

export type InfiltrationMode = keyof typeof INFILTRATION_RATIOS;

/** Estimated indoor AQI given outdoor AQI and the home's filtration state. */
export function indoorAqi(
  outdoorAqi: number,
  mode: InfiltrationMode,
  extraReduction = 0,
): number {
  assertNonNegative(outdoorAqi, 'outdoorAqi');
  assertInRange(extraReduction, 0, 1, 'extraReduction');
  const ratio = INFILTRATION_RATIOS[mode] * (1 - extraReduction);
  return Math.round(outdoorAqi * ratio);
}
