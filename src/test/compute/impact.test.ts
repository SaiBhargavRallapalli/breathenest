// ============================================================
// src/test/compute/impact.test.ts
// Emission aggregation, relatable equivalents, community
// annualisation and driving savings.
// ============================================================

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CURRENCY,
  IMPACT_FACTORS,
  aggregateImpact,
  co2Equivalents,
  communityAnnualTotals,
  drivingSavings,
} from '@/lib/compute/impact';
import { PLEDGES } from '@/constants/pledges';
import type { ImpactDelta } from '@/types';

const delta = (overrides: Partial<ImpactDelta> = {}): ImpactDelta => ({
  co2KgPerYear: 100,
  inhaledPm25UgPerDay: 10,
  moneySavedPerYear: 50,
  currency: 'USD',
  ...overrides,
});

describe('co2Equivalents', () => {
  it('translates a saving into pictureable quantities', () => {
    const equivalents = co2Equivalents(IMPACT_FACTORS.treeKgPerYear); // 21 kg
    const trees = equivalents.find((entry) => entry.unit === 'trees');
    expect(trees?.value).toBe(1);

    const km = equivalents.find((entry) => entry.unit === 'km');
    expect(km?.value).toBeCloseTo(21 / 0.171, 1);
  });

  it('returns three equivalents with finite numbers', () => {
    const equivalents = co2Equivalents(500);
    expect(equivalents).toHaveLength(3);
    for (const entry of equivalents) {
      expect(Number.isFinite(entry.value)).toBe(true);
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it('handles zero and rejects negatives', () => {
    expect(co2Equivalents(0).every((entry) => entry.value === 0)).toBe(true);
    expect(() => co2Equivalents(-1)).toThrow(RangeError);
  });
});

describe('aggregateImpact', () => {
  it('sums a batch of deltas', () => {
    const ledger = aggregateImpact([delta(), delta({ co2KgPerYear: 50 })]);
    expect(ledger.co2KgPerYear).toBe(150);
    expect(ledger.inhaledPm25UgPerDay).toBe(20);
    expect(ledger.moneyPerYear).toBe(100);
    expect(ledger.currency).toBe(DEFAULT_CURRENCY);
    expect(ledger.equivalents).toHaveLength(3);
  });

  it('returns a zeroed ledger for an empty selection', () => {
    const ledger = aggregateImpact([]);
    expect(ledger.co2KgPerYear).toBe(0);
    expect(ledger.inhaledPm25UgPerDay).toBe(0);
    expect(ledger.moneyPerYear).toBe(0);
  });

  it('allows a negative inhaled-dose delta (cycling on dirty days)', () => {
    const ledger = aggregateImpact([
      delta({ inhaledPm25UgPerDay: -8 }),
      delta({ inhaledPm25UgPerDay: 20 }),
    ]);
    expect(ledger.inhaledPm25UgPerDay).toBe(12);
  });

  it('rejects negative CO2 or money', () => {
    expect(() => aggregateImpact([delta({ co2KgPerYear: -1 })])).toThrow(RangeError);
    expect(() => aggregateImpact([delta({ moneySavedPerYear: -1 })])).toThrow(RangeError);
  });

  it('honours a caller-supplied currency', () => {
    expect(aggregateImpact([delta()], 'INR').currency).toBe('INR');
  });
});

describe('communityAnnualTotals', () => {
  it('annualises weekly pledges across all participants', () => {
    const totals = communityAnnualTotals(PLEDGES, 10);
    const weeklyCo2 = PLEDGES.reduce((sum, pledge) => sum + pledge.co2KgPerWeek, 0);
    expect(totals.co2KgPerYear).toBeCloseTo(weeklyCo2 * 52 * 10, 2);
    expect(totals.members).toBe(10);
  });

  it('returns zeros when nobody has joined', () => {
    const totals = communityAnnualTotals([], 0);
    expect(totals.co2KgPerYear).toBe(0);
    expect(totals.pm25GramsPerYear).toBe(0);
    expect(totals.members).toBe(0);
  });

  it('scales linearly with membership', () => {
    const one = communityAnnualTotals(PLEDGES, 1);
    const twenty = communityAnnualTotals(PLEDGES, 20);
    expect(twenty.co2KgPerYear).toBeCloseTo(one.co2KgPerYear * 20, 1);
  });

  it('rejects a negative membership count', () => {
    expect(() => communityAnnualTotals(PLEDGES, -1)).toThrow(RangeError);
  });
});

describe('drivingSavings', () => {
  it('prices CO2 and fuel for a year of driving', () => {
    const savings = drivingSavings(1000);
    expect(savings.co2KgPerYear).toBeCloseTo(171, 2);
    expect(savings.moneySavedPerYear).toBeCloseTo(70 * 1.7, 2);
    expect(savings.inhaledPm25UgPerDay).toBe(0);
  });

  it('scales linearly with distance', () => {
    const half = drivingSavings(500);
    const full = drivingSavings(1000);
    expect(full.co2KgPerYear).toBeCloseTo(half.co2KgPerYear * 2, 2);
  });

  it('rejects negative distance', () => {
    expect(() => drivingSavings(-1)).toThrow(RangeError);
  });
});
