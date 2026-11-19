// ============================================================
// src/test/compute/forecast.test.ts
// Stagnation / inversion heuristic and series utilities.
// ============================================================

import { describe, expect, it } from 'vitest';
import { assessStagnation, diurnalAmplitude, smoothSeries } from '@/lib/compute/forecast';
import { CURVE, makeHours } from '../fixtures';

const calm = { windSpeedKmh: 4, temperatureC: 10, humidityPct: 90 };
const breezy = { windSpeedKmh: 18, temperatureC: 22, humidityPct: 45 };

describe('assessStagnation', () => {
  it('scores a calm, humid, strongly swinging day as severe', () => {
    const result = assessStagnation({ weather: calm, hours: makeHours(CURVE) });
    expect(result.level).toBe('severe');
    expect(result.score).toBeGreaterThanOrEqual(4);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
    expect(result.reasons.join(' ')).toContain('calm');
    expect(result.reasons.join(' ')).toContain('Humidity');
  });

  it('scores a windy, dry, flat day as none', () => {
    const flat = makeHours(Array.from({ length: 24 }, () => 80));
    const result = assessStagnation({ weather: breezy, hours: flat });
    expect(result.level).toBe('none');
    expect(result.score).toBe(0);
    expect(result.reasons.join(' ')).toContain('dispersing normally');
  });

  it('lands in the middle for moderate conditions', () => {
    const moderate = { windSpeedKmh: 10, temperatureC: 18, humidityPct: 75 };
    const flat = makeHours(Array.from({ length: 24 }, () => 90));
    const result = assessStagnation({ weather: moderate, hours: flat });
    expect(result.level).toBe('moderate');
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThan(4);
  });

  it('tolerates missing weather readings', () => {
    const result = assessStagnation({
      weather: { windSpeedKmh: null, temperatureC: null, humidityPct: null },
      hours: makeHours(CURVE),
    });
    // Only the curve-shape terms apply.
    expect(result.level).toBe('severe');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('gives no trapping reasons when there are no hours either', () => {
    const result = assessStagnation({
      weather: { windSpeedKmh: null, temperatureC: null, humidityPct: null },
      hours: [],
    });
    expect(result.level).toBe('none');
    expect(result.reasons).toHaveLength(1);
  });

  it('separates light wind from moderate wind', () => {
    const light = assessStagnation({
      weather: { windSpeedKmh: 7, temperatureC: 15, humidityPct: 40 },
      hours: [],
    });
    const moderate = assessStagnation({
      weather: { windSpeedKmh: 11, temperatureC: 15, humidityPct: 40 },
      hours: [],
    });
    expect(light.score).toBeGreaterThan(moderate.score);
    expect(moderate.score).toBeGreaterThan(0);
  });
});

describe('smoothSeries', () => {
  it('keeps the series length and softens spikes', () => {
    const smoothed = smoothSeries([1, 100, 1], 3);
    expect(smoothed).toHaveLength(3);
    expect(smoothed[1]).toBeCloseTo(34, 1);
    expect(smoothed[0]).toBeCloseTo(50.5, 1);
  });

  it('uses nearest neighbours at the edges', () => {
    expect(smoothSeries([10, 20, 30], 3)).toEqual([15, 20, 25]);
  });

  it('returns an empty array for an empty series', () => {
    expect(smoothSeries([], 3)).toEqual([]);
  });

  it('passes through with a window of one', () => {
    expect(smoothSeries([4.44, 5.55], 1)).toEqual([4.4, 5.6]);
  });

  it('rejects a non-positive window', () => {
    expect(() => smoothSeries([1], 0)).toThrow(RangeError);
    expect(() => smoothSeries([1], 2.5)).toThrow(RangeError);
  });
});

describe('diurnalAmplitude', () => {
  it('expresses the swing as a fraction of the peak', () => {
    expect(diurnalAmplitude([100, 50])).toBe(0.5);
    expect(diurnalAmplitude([200, 100, 150])).toBe(0.5);
  });

  it('is zero for a flat or all-zero series', () => {
    expect(diurnalAmplitude([80, 80])).toBe(0);
    expect(diurnalAmplitude([0, 0])).toBe(0);
  });

  it('rejects an empty series', () => {
    expect(() => diurnalAmplitude([])).toThrow(RangeError);
  });
});
