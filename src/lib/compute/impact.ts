// ============================================================
// src/lib/compute/impact.ts
// Converts a household's choices into numbers a person can feel:
// kilograms of CO2 per year, micrograms of fine particles no longer
// inhaled each day, money kept, plus relatable equivalents.
// ============================================================

import type { CommunityTotals, Equivalent, ImpactDelta, ImpactLedger, Pledge } from '@/types';
import { assertFinite, assertNonNegative, round1, round2 } from './guards';

/**
 * Publicly used emission, absorption and price factors.
 * Every figure shown in the UI traces back to one of these constants.
 */
export const IMPACT_FACTORS = {
  /** kg CO2 per km — average petrol passenger car. */
  carKgPerKm: 0.171,
  /** Litres of petrol burned per km — average passenger car. */
  carLitresPerKm: 0.07,
  /** Pump price per litre used for the money estimate. */
  fuelPricePerLitre: 1.7,
  /** kg CO2 absorbed by one mature tree in one year. */
  treeKgPerYear: 21,
  /** kg CO2 per kWh of grid electricity (global average). */
  gridKgPerKwh: 0.42,
  /** kWh used by an average household per day. */
  homeKwhPerDay: 28.8,
  /** Weeks in a year, used to annualise weekly pledges. */
  weeksPerYear: 52,
} as const;

/** Currency used for money estimates unless a caller overrides it. */
export const DEFAULT_CURRENCY = 'USD';

/** Breaks a CO2 saving into quantities people can picture. */
export function co2Equivalents(co2Kg: number): Equivalent[] {
  assertNonNegative(co2Kg, 'co2Kg');
  const { carKgPerKm, treeKgPerYear, gridKgPerKwh, homeKwhPerDay } = IMPACT_FACTORS;

  return [
    { label: 'Kilometres in an average petrol car', value: round1(co2Kg / carKgPerKm), unit: 'km' },
    { label: 'Mature trees grown for a year', value: round1(co2Kg / treeKgPerYear), unit: 'trees' },
    {
      label: 'Days of an average home’s electricity',
      value: round1(co2Kg / (homeKwhPerDay * gridKgPerKwh)),
      unit: 'days',
    },
  ];
}

/** Adds a batch of yearly deltas into one ledger with equivalents. */
export function aggregateImpact(
  deltas: readonly ImpactDelta[],
  currency: string = DEFAULT_CURRENCY,
): ImpactLedger {
  let co2Kg = 0;
  let inhaled = 0;
  let money = 0;

  for (const delta of deltas) {
    assertNonNegative(delta.co2KgPerYear, 'co2KgPerYear');
    assertNonNegative(delta.moneySavedPerYear, 'moneySavedPerYear');
    // `inhaledPm25UgPerDay` may be negative: some choices (cycling on a
    // dirty day) trade lower emissions for a higher personal dose.
    assertFinite(delta.inhaledPm25UgPerDay, 'inhaledPm25UgPerDay');
    co2Kg += delta.co2KgPerYear;
    inhaled += delta.inhaledPm25UgPerDay;
    money += delta.moneySavedPerYear;
  }

  const roundedCo2 = round2(co2Kg);
  return {
    co2KgPerYear: roundedCo2,
    inhaledPm25UgPerDay: round1(inhaled),
    moneyPerYear: round2(money),
    currency,
    equivalents: co2Equivalents(roundedCo2),
  };
}

/** Annualises a set of weekly neighbourhood pledges for N participants. */
export function communityAnnualTotals(
  pledges: readonly Pledge[],
  members: number,
): CommunityTotals {
  assertNonNegative(members, 'members');
  const { weeksPerYear } = IMPACT_FACTORS;

  let co2PerWeek = 0;
  let pm25GramsPerWeek = 0;
  for (const pledge of pledges) {
    assertNonNegative(pledge.co2KgPerWeek, 'co2KgPerWeek');
    assertNonNegative(pledge.pm25GramsPerWeek, 'pm25GramsPerWeek');
    co2PerWeek += pledge.co2KgPerWeek;
    pm25GramsPerWeek += pledge.pm25GramsPerWeek;
  }

  return {
    co2KgPerYear: round2(co2PerWeek * weeksPerYear * members),
    pm25GramsPerYear: round1(pm25GramsPerWeek * weeksPerYear * members),
    members,
  };
}

/** CO2 and fuel cost avoided by driving fewer kilometres in a year. */
export function drivingSavings(distanceKmPerYear: number): ImpactDelta {
  assertNonNegative(distanceKmPerYear, 'distanceKmPerYear');
  const co2 = distanceKmPerYear * IMPACT_FACTORS.carKgPerKm;
  const litres = distanceKmPerYear * IMPACT_FACTORS.carLitresPerKm;
  const money = litres * IMPACT_FACTORS.fuelPricePerLitre;

  return {
    co2KgPerYear: round2(co2),
    inhaledPm25UgPerDay: 0,
    moneySavedPerYear: round2(money),
    currency: DEFAULT_CURRENCY,
  };
}
