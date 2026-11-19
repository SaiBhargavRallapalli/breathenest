// ============================================================
// src/test/compute/windows.test.ts
// Temporal exposure optimiser: risk bands, cleanest / dirtiest
// slot search and day statistics.
// ============================================================

import { describe, expect, it } from 'vitest';
import {
  bestWindow,
  classifyRisk,
  dayStats,
  findBestWindows,
  worstWindow,
} from '@/lib/compute/windows';
import { CURVE, DIRTY_CURVE, makeHours } from '../fixtures';

describe('classifyRisk', () => {
  it('maps AQI onto the four activity risk bands', () => {
    expect(classifyRisk(0)).toBe('ideal');
    expect(classifyRisk(50)).toBe('ideal');
    expect(classifyRisk(51)).toBe('acceptable');
    expect(classifyRisk(100)).toBe('acceptable');
    expect(classifyRisk(101)).toBe('poor');
    expect(classifyRisk(150)).toBe('poor');
    expect(classifyRisk(151)).toBe('avoid');
    expect(classifyRisk(500)).toBe('avoid');
  });
});

describe('findBestWindows', () => {
  const hours = makeHours(CURVE);

  it('returns the cleanest two-hour slot first', () => {
    const [first] = findBestWindows(hours, { durationHours: 2, limit: 3 });
    expect(first?.startHour).toBe(13);
    expect(first?.endHour).toBe(15);
    expect(first?.averageAqi).toBe(68);
    expect(first?.peakAqi).toBe(70); // hours 13 and 14 — the slot is end-exclusive
    expect(first?.risk).toBe('acceptable'); // risk is judged by the slot's peak
  });

  it('returns slots ordered by average AQI', () => {
    const windows = findBestWindows(hours, { durationHours: 2, limit: 4 });
    const averages = windows.map((window) => window.averageAqi);
    expect(averages).toEqual([...averages].sort((a, b) => a - b));
    expect(windows).toHaveLength(4);
  });

  it('never lets a single dirty hour hide in a clean average', () => {
    // Every candidate is judged by its peak, not only its mean.
    const windows = findBestWindows(hours, { durationHours: 2, limit: 10, maxPeakAqi: 100 });
    for (const window of windows) {
      expect(window.peakAqi).toBeLessThanOrEqual(100);
      expect(window.risk).not.toBe('avoid');
    }
  });

  it('respects maxPeakAqi and returns nothing on an all-dirty day', () => {
    const dirty = makeHours(DIRTY_CURVE);
    expect(findBestWindows(dirty, { maxPeakAqi: 150 })).toEqual([]);
    expect(bestWindow(dirty)).toBeNull();
  });

  it('honours fromHour so past hours are skipped', () => {
    const windows = findBestWindows(hours, { durationHours: 2, limit: 1, fromHour: 16 });
    expect(windows[0]?.startHour).toBeGreaterThanOrEqual(16);
  });

  it('returns an empty list when the series is shorter than the slot', () => {
    expect(findBestWindows(makeHours([10, 20]), { durationHours: 3 })).toEqual([]);
  });

  it('rejects a fractional duration', () => {
    expect(() => findBestWindows(hours, { durationHours: 1.5 })).toThrow(RangeError);
  });

  it('rejects a limit below one', () => {
    expect(() => findBestWindows(hours, { limit: 0 })).toThrow(RangeError);
  });
});

describe('bestWindow / worstWindow', () => {
  const hours = makeHours(CURVE);

  it('bestWindow returns the single cleanest slot', () => {
    const window = bestWindow(hours);
    expect(window?.startHour).toBe(13);
    expect(window?.averageAqi).toBe(68);
  });

  it('worstWindow returns the dirtiest slot', () => {
    const window = worstWindow(hours, 2);
    expect(window?.startHour).toBe(5);
    expect(window?.endHour).toBe(7);
    expect(window?.averageAqi).toBe(220);
    expect(window?.risk).toBe('avoid');
  });

  it('worstWindow returns null when the duration exceeds the series', () => {
    expect(worstWindow(makeHours([100]), 3)).toBeNull();
  });

  it('rejects a non-positive duration', () => {
    expect(() => worstWindow(hours, 0)).toThrow(RangeError);
  });
});

describe('dayStats', () => {
  const hours = makeHours(CURVE);

  it('summarises min, max, average and the extreme hours', () => {
    const stats = dayStats(hours);
    expect(stats.minAqi).toBe(66);
    expect(stats.maxAqi).toBe(226);
    expect(stats.averageAqi).toBeCloseTo(157.1, 1);
    expect(stats.cleanestHour).toBe(14);
    expect(stats.dirtiestHour).toBe(6);
  });

  it('throws on an empty series', () => {
    expect(() => dayStats([])).toThrow(RangeError);
  });
});
