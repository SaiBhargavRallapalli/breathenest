// ============================================================
// src/test/compute/aqi.test.ts
// US EPA AQI engine: interpolation, band classification, the
// worst-pollutant rule and reverse lookups.
// ============================================================

import { describe, expect, it } from 'vitest';
import {
  classifyAqi,
  computeAqi,
  concentrationForSubIndex,
  interpolateSubIndex,
  subIndex,
} from '@/lib/compute/aqi';

describe('interpolateSubIndex', () => {
  it('maps band endpoints exactly', () => {
    const band = { low: 0, high: 12, aqiLow: 0, aqiHigh: 50 };
    expect(interpolateSubIndex(0, band)).toBe(0);
    expect(interpolateSubIndex(12, band)).toBe(50);
  });

  it('interpolates inside the band', () => {
    const band = { low: 12.1, high: 35.4, aqiLow: 51, aqiHigh: 100 };
    const mid = interpolateSubIndex((12.1 + 35.4) / 2, band);
    expect(mid).toBeCloseTo(75.5, 5);
  });

  it('rejects a concentration outside the band', () => {
    const band = { low: 0, high: 12, aqiLow: 0, aqiHigh: 50 };
    expect(() => interpolateSubIndex(13, band)).toThrow(RangeError);
    expect(() => interpolateSubIndex(-1, band)).toThrow(RangeError);
  });

  it('rejects a degenerate band', () => {
    expect(() =>
      interpolateSubIndex(5, { low: 5, high: 5, aqiLow: 0, aqiHigh: 50 }),
    ).toThrow(RangeError);
  });
});

describe('subIndex', () => {
  it('places PM2.5 breakpoints at their published values', () => {
    expect(subIndex('pm25', 0)).toBe(0);
    expect(subIndex('pm25', 12)).toBe(50);
    expect(subIndex('pm25', 12.1)).toBe(51);
    expect(subIndex('pm25', 35.4)).toBe(100);
    expect(subIndex('pm25', 55.4)).toBe(150);
    expect(subIndex('pm25', 150.4)).toBe(200);
    expect(subIndex('pm25', 250.4)).toBe(300);
    expect(subIndex('pm25', 350.4)).toBe(400);
    expect(subIndex('pm25', 500.4)).toBe(500);
  });

  it('saturates above the top breakpoint', () => {
    expect(subIndex('pm25', 900)).toBe(500);
    expect(subIndex('co', 99)).toBe(500);
  });

  it('places PM10 breakpoints at their published values', () => {
    expect(subIndex('pm10', 54)).toBe(50);
    expect(subIndex('pm10', 55)).toBe(51);
    expect(subIndex('pm10', 154)).toBe(100);
    expect(subIndex('pm10', 604)).toBe(500);
  });

  it('places ozone and NO2 breakpoints correctly', () => {
    expect(subIndex('o3', 54)).toBe(50);
    expect(subIndex('o3', 71)).toBe(101);
    expect(subIndex('no2', 53)).toBe(50);
    expect(subIndex('no2', 101)).toBe(101);
    expect(subIndex('no2', 2049)).toBe(500);
  });

  it('rejects negative concentrations', () => {
    expect(() => subIndex('pm25', -1)).toThrow(RangeError);
  });

  it('rejects NaN', () => {
    expect(() => subIndex('pm25', Number.NaN)).toThrow(TypeError);
  });
});

describe('classifyAqi', () => {
  it('follows the six EPA band edges', () => {
    expect(classifyAqi(0)).toBe('good');
    expect(classifyAqi(50)).toBe('good');
    expect(classifyAqi(51)).toBe('moderate');
    expect(classifyAqi(100)).toBe('moderate');
    expect(classifyAqi(101)).toBe('unhealthy_sensitive');
    expect(classifyAqi(150)).toBe('unhealthy_sensitive');
    expect(classifyAqi(151)).toBe('unhealthy');
    expect(classifyAqi(200)).toBe('unhealthy');
    expect(classifyAqi(201)).toBe('very_unhealthy');
    expect(classifyAqi(300)).toBe('very_unhealthy');
    expect(classifyAqi(301)).toBe('hazardous');
    expect(classifyAqi(500)).toBe('hazardous');
  });

  it('rejects negative and non-finite AQI', () => {
    expect(() => classifyAqi(-1)).toThrow(RangeError);
    expect(() => classifyAqi(Number.NaN)).toThrow(TypeError);
  });
});

describe('computeAqi', () => {
  it('reports the highest sub-index as the overall AQI', () => {
    const result = computeAqi({ pm25: 120, pm10: 60 });
    // PM2.5 120 µg/m³ → 184; PM10 60 → 53. Dominant must be PM2.5.
    expect(result.aqi).toBe(184);
    expect(result.dominant).toBe('pm25');
    expect(result.subIndices.pm25).toBe(184);
    expect(result.subIndices.pm10).toBe(53);
  });

  it('lets a gas dominate when it is worse', () => {
    const result = computeAqi({ pm25: 5, no2: 400 });
    expect(result.dominant).toBe('no2');
    expect(result.aqi).toBe(result.subIndices.no2);
  });

  it('works with a single pollutant', () => {
    const result = computeAqi({ pm25: 12 });
    expect(result.aqi).toBe(50);
    expect(result.dominant).toBe('pm25');
  });

  it('skips missing and null entries', () => {
    const result = computeAqi({ pm25: 10, o3: undefined, so2: null as unknown as number });
    expect(result.dominant).toBe('pm25');
    expect(result.subIndices.o3).toBeUndefined();
    expect(result.subIndices.so2).toBeUndefined();
  });

  it('throws when no pollutant is supplied', () => {
    expect(() => computeAqi({})).toThrow(RangeError);
    expect(() => computeAqi({ pm25: undefined })).toThrow(RangeError);
  });

  it('rounds sub-indices to whole AQI points', () => {
    const result = computeAqi({ pm25: 20.55 });
    expect(Number.isInteger(result.aqi)).toBe(true);
  });
});

describe('concentrationForSubIndex', () => {
  it('inverts PM2.5 breakpoints', () => {
    expect(concentrationForSubIndex('pm25', 50)).toBe(12);
    expect(concentrationForSubIndex('pm25', 0)).toBe(0);
    expect(concentrationForSubIndex('pm25', 500)).toBeCloseTo(500.4, 1);
  });

  it('round-trips with subIndex at band edges', () => {
    const original = 35.4;
    const aqi = subIndex('pm25', original);
    const back = concentrationForSubIndex('pm25', aqi);
    expect(back).toBeCloseTo(original, 1);
  });

  it('caps targets above 500', () => {
    expect(concentrationForSubIndex('pm25', 999)).toBeCloseTo(500.4, 1);
  });

  it('rejects negative targets', () => {
    expect(() => concentrationForSubIndex('pm25', -5)).toThrow(RangeError);
  });
});
