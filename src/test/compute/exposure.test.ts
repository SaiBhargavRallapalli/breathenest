// ============================================================
// src/test/compute/exposure.test.ts
// Inhaled-dose model and indoor penetration estimates.
// ============================================================

import { describe, expect, it } from 'vitest';
import {
  BREATHING_RATES,
  INFILTRATION_RATIOS,
  REFERENCE_DAILY_DOSE_UG,
  WHO_DAILY_GUIDELINE,
  assessDailyDose,
  inhaledDose,
  indoorAqi,
} from '@/lib/compute/exposure';

describe('breathing rates', () => {
  it('increases with activity intensity', () => {
    expect(BREATHING_RATES.rest).toBeLessThan(BREATHING_RATES.light);
    expect(BREATHING_RATES.light).toBeLessThan(BREATHING_RATES.moderate);
    expect(BREATHING_RATES.moderate).toBeLessThan(BREATHING_RATES.vigorous);
  });

  it('matches published adult ventilation rates', () => {
    expect(BREATHING_RATES.rest).toBe(0.36);
    expect(BREATHING_RATES.vigorous).toBe(2.4);
  });
});

describe('inhaledDose', () => {
  it('multiplies concentration, time and ventilation', () => {
    // 15 µg/m³ for 1 h at 12 L/min → 15 × 1 × 0.72 = 10.8 µg
    expect(
      inhaledDose({ concentrationUgM3: 15, durationHours: 1, activity: 'light' }),
    ).toBe(10.8);
  });

  it('scales linearly with duration', () => {
    const oneHour = inhaledDose({ concentrationUgM3: 50, durationHours: 1, activity: 'rest' });
    const fourHours = inhaledDose({ concentrationUgM3: 50, durationHours: 4, activity: 'rest' });
    expect(fourHours).toBeCloseTo(oneHour * 4, 5);
  });

  it('applies protection as a fractional reduction', () => {
    const bare = inhaledDose({ concentrationUgM3: 100, durationHours: 1, activity: 'rest' });
    const masked = inhaledDose({
      concentrationUgM3: 100,
      durationHours: 1,
      activity: 'rest',
      protection: 0.5,
    });
    expect(masked).toBeCloseTo(bare / 2, 5);
  });

  it('rejects negative inputs and out-of-range protection', () => {
    expect(() =>
      inhaledDose({ concentrationUgM3: -1, durationHours: 1, activity: 'rest' }),
    ).toThrow(RangeError);
    expect(() =>
      inhaledDose({ concentrationUgM3: 10, durationHours: 1, activity: 'rest', protection: 1.5 }),
    ).toThrow(RangeError);
  });
});

describe('assessDailyDose', () => {
  it('derives the reference dose from the WHO guideline', () => {
    expect(REFERENCE_DAILY_DOSE_UG).toBeCloseTo(WHO_DAILY_GUIDELINE * 24 * 0.83, 1);
  });

  it('accepts a day that stays inside the budget', () => {
    const assessment = assessDailyDose([
      { label: 'sleep', concentrationUgM3: 15, durationHours: 24, activity: 'rest' },
    ]);
    expect(assessment.withinBudget).toBe(true);
    expect(assessment.ratio).toBeLessThan(1);
    expect(assessment.message).toContain('stays at');
  });

  it('flags a day that blows the budget', () => {
    const assessment = assessDailyDose([
      { label: 'hard ride', concentrationUgM3: 150, durationHours: 24, activity: 'vigorous' },
    ]);
    expect(assessment.withinBudget).toBe(false);
    expect(assessment.ratio).toBeGreaterThan(1);
    expect(assessment.message).toContain('trim outdoor effort');
  });

  it('sums several segments', () => {
    const a = assessDailyDose([
      { label: 'a', concentrationUgM3: 10, durationHours: 2, activity: 'rest' },
    ]);
    const b = assessDailyDose([
      { label: 'a', concentrationUgM3: 10, durationHours: 2, activity: 'rest' },
      { label: 'b', concentrationUgM3: 10, durationHours: 2, activity: 'rest' },
    ]);
    expect(b.totalUg).toBeCloseTo(a.totalUg * 2, 5);
    expect(b.referenceUg).toBe(a.referenceUg);
  });
});

describe('indoorAqi', () => {
  it('penetrates less as filtration improves', () => {
    const open = indoorAqi(200, 'openWindows');
    const unfiltered = indoorAqi(200, 'closedUnfiltered');
    const diy = indoorAqi(200, 'closedDiyFilter');
    const hepa = indoorAqi(200, 'closedHepa');
    expect(open).toBeGreaterThan(unfiltered);
    expect(unfiltered).toBeGreaterThan(diy);
    expect(diy).toBeGreaterThan(hepa);
    expect(hepa).toBe(40);
  });

  it('matches the published infiltration ratios', () => {
    expect(indoorAqi(100, 'openWindows')).toBe(85);
    expect(indoorAqi(100, 'closedUnfiltered')).toBe(60);
    expect(indoorAqi(100, 'closedDiyFilter')).toBe(40);
    expect(INFILTRATION_RATIOS.closedHepa).toBe(0.2);
  });

  it('stacks an extra reduction on top of the mode', () => {
    const base = indoorAqi(200, 'closedHepa');
    const boosted = indoorAqi(200, 'closedHepa', 0.5);
    expect(boosted).toBe(Math.round(base * 0.5));
  });

  it('rejects invalid inputs', () => {
    expect(() => indoorAqi(-1, 'closedHepa')).toThrow(RangeError);
    expect(() => indoorAqi(100, 'closedHepa', 1.2)).toThrow(RangeError);
  });
});
