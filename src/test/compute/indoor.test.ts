// ============================================================
// src/test/compute/indoor.test.ts
// Room sizing, filter maths, clearance decay and the
// inversion-aware ventilation scheduler.
// ============================================================

import { describe, expect, it } from 'vitest';
import {
  clearanceTimeMinutes,
  equivalentAch,
  formatClock,
  recommendedAch,
  requiredCadr,
  requiredFilterAirflow,
  riskLabel,
  roomVolume,
  ventilationAdvice,
} from '@/lib/compute/indoor';
import { CURVE, DIRTY_CURVE, makeHours } from '../fixtures';

describe('roomVolume', () => {
  it('multiplies floor area by ceiling height', () => {
    expect(roomVolume(5, 4, 2.8)).toBe(56);
    expect(roomVolume(3, 3, 3)).toBe(27);
  });

  it('rejects non-positive dimensions', () => {
    expect(() => roomVolume(0, 4, 2.8)).toThrow(RangeError);
    expect(() => roomVolume(5, -1, 2.8)).toThrow(RangeError);
    expect(() => roomVolume(5, 4, 0)).toThrow(RangeError);
  });
});

describe('filter sizing', () => {
  it('requiredCadr is volume times target air changes', () => {
    expect(requiredCadr(56, 4)).toBe(224);
    expect(requiredCadr(30, 2)).toBe(60);
  });

  it('requiredFilterAirflow divides by capture efficiency', () => {
    // 224 CADR at 85% media efficiency needs 263.5 m³/h of raw airflow.
    expect(requiredFilterAirflow(56, 4, 0.85)).toBe(263.5);
  });

  it('equivalentAch converts CADR back to air changes', () => {
    expect(equivalentAch(56, 400)).toBeCloseTo(7.14, 2);
    expect(equivalentAch(30, 60)).toBe(2);
  });

  it('rejects impossible geometry and efficiency', () => {
    expect(() => requiredCadr(0, 4)).toThrow(RangeError);
    expect(() => requiredCadr(56, 0)).toThrow(RangeError);
    expect(() => requiredFilterAirflow(56, 4, 0)).toThrow(RangeError);
    expect(() => equivalentAch(56, 0)).toThrow(RangeError);
  });
});

describe('clearanceTimeMinutes', () => {
  it('matches the single-compartment decay formula', () => {
    // t = −ln(0.2) × V / (Q·η) × 60 = 1.6094 × 30 / 340 × 60 ≈ 8.5 min
    const minutes = clearanceTimeMinutes({
      volumeM3: 30,
      airflowM3h: 400,
      efficiency: 0.85,
    });
    expect(minutes).toBeCloseTo(8.5, 1);
  });

  it('takes longer to reach a lower residual', () => {
    const common = { volumeM3: 30, airflowM3h: 400, efficiency: 0.85 };
    const toTenPercent = clearanceTimeMinutes({ ...common, targetFraction: 0.1 });
    const toTwentyPercent = clearanceTimeMinutes({ ...common, targetFraction: 0.2 });
    expect(toTenPercent).toBeGreaterThan(toTwentyPercent);
  });

  it('takes longer in a bigger room', () => {
    const small = clearanceTimeMinutes({ volumeM3: 20, airflowM3h: 400, efficiency: 0.85 });
    const large = clearanceTimeMinutes({ volumeM3: 60, airflowM3h: 400, efficiency: 0.85 });
    // Both sides are rounded to one decimal, so allow a whole-unit tolerance.
    expect(large).toBeCloseTo(small * 3, 0);
  });

  it('rejects an impossible target fraction', () => {
    expect(() =>
      clearanceTimeMinutes({ volumeM3: 30, airflowM3h: 400, efficiency: 0.85, targetFraction: 1 }),
    ).toThrow(RangeError);
    expect(() =>
      clearanceTimeMinutes({ volumeM3: 30, airflowM3h: 400, efficiency: 0.85, targetFraction: 0 }),
    ).toThrow(RangeError);
  });
});

describe('recommendedAch', () => {
  it('raises the target as the air gets dirtier', () => {
    expect(recommendedAch('good')).toBe(0.5);
    expect(recommendedAch('moderate')).toBe(1);
    expect(recommendedAch('unhealthy_sensitive')).toBe(2);
    expect(recommendedAch('unhealthy')).toBe(4);
    expect(recommendedAch('very_unhealthy')).toBe(5);
    expect(recommendedAch('hazardous')).toBe(6);
  });
});

describe('ventilationAdvice', () => {
  const cleanHours = makeHours(CURVE.map(() => 60));

  it('refuses to ventilate with no forecast at all', () => {
    const advice = ventilationAdvice([], 9, 100);
    expect(advice.shouldOpen).toBe(false);
    expect(advice.window).toBeNull();
    expect(advice.reason).toContain('No forecast available');
  });

  it('suggests opening when outdoor air beats the indoor estimate', () => {
    const advice = ventilationAdvice(cleanHours, 9, 150);
    expect(advice.shouldOpen).toBe(true);
    expect(advice.recommendedHours.length).toBeGreaterThan(0);
    expect(advice.reason).toContain('AQI');
  });

  it('keeps windows shut when outdoor air is dirtier than indoors', () => {
    const advice = ventilationAdvice(makeHours(DIRTY_CURVE), 0, 50);
    expect(advice.shouldOpen).toBe(false);
    expect(advice.window).toBeNull();
    expect(advice.reason).toContain('never beats');
  });

  it('skips hours already past when choosing a window', () => {
    const advice = ventilationAdvice(cleanHours, 20, 150);
    expect(advice.recommendedHours.every((hour) => hour >= 20)).toBe(true);
  });
});

describe('formatClock / riskLabel', () => {
  it('formats hours as a 24-hour clock with wrapping', () => {
    expect(formatClock(7)).toBe('07:00');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(25)).toBe('01:00');
    expect(formatClock(-1)).toBe('23:00');
  });

  it('labels every risk band', () => {
    expect(riskLabel('ideal')).toBe('Clean');
    expect(riskLabel('acceptable')).toBe('OK');
    expect(riskLabel('poor')).toBe('Poor');
    expect(riskLabel('avoid')).toBe('Avoid');
  });
});
