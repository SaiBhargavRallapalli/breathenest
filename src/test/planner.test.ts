// ============================================================
// src/test/planner.test.ts
// The deterministic planner: guaranteed output, chronological
// ordering and quantified impact on every block.
// ============================================================

import { describe, expect, it } from 'vitest';
import { buildLocalPlan } from '@/lib/planner';
import { CURVE, DIRTY_CURVE, makeHours, makeProfile } from './fixtures';

const cleanHours = makeHours(CURVE);
const dirtyHours = makeHours(DIRTY_CURVE);

function hourOf(time: string): number {
  return Number.parseInt(time.slice(0, 2), 10);
}

describe('buildLocalPlan', () => {
  it('always returns a complete plan', () => {
    const plan = buildLocalPlan({
      profile: makeProfile(),
      currentAqi: 185,
      hours: cleanHours,
    });
    expect(plan.blocks.length).toBeGreaterThanOrEqual(4);
    expect(plan.summary.length).toBeGreaterThan(20);
    expect(plan.generator).toBe('local');
    expect(() => new Date(plan.generatedAt).getTime()).not.toThrow();
  });

  it('orders blocks chronologically', () => {
    const plan = buildLocalPlan({
      profile: makeProfile(),
      currentAqi: 185,
      hours: cleanHours,
    });
    const hours = plan.blocks.map((block) => hourOf(block.time));
    const sorted = [...hours].sort((a, b) => a - b);
    expect(hours).toEqual(sorted);
  });

  it('quantifies the direct impact of every block', () => {
    const plan = buildLocalPlan({
      profile: makeProfile(),
      currentAqi: 185,
      hours: cleanHours,
    });
    for (const block of plan.blocks) {
      expect(block.impact.length).toBeGreaterThan(20);
      expect(block.impact).toMatch(/µg|%/);
      expect(block.detail.length).toBeGreaterThan(20);
      expect(block.windowAqi).toBeGreaterThanOrEqual(0);
    }
  });

  it('finds an outdoor window on a mixed day', () => {
    const plan = buildLocalPlan({
      profile: makeProfile(),
      currentAqi: 185,
      hours: cleanHours,
    });
    expect(plan.bestOutdoorWindow).not.toBeNull();
    expect(plan.bestOutdoorWindow?.averageAqi).toBeLessThan(150);
  });

  it('reports no safe window on an all-dirty day', () => {
    const plan = buildLocalPlan({
      profile: makeProfile(),
      currentAqi: 158,
      hours: dirtyHours,
    });
    expect(plan.bestOutdoorWindow).toBeNull();
    expect(plan.blocks.some((block) => block.title.includes('No safe outdoor window'))).toBe(true);
  });

  it('names the sensitive members in the summary', () => {
    const plan = buildLocalPlan({
      profile: makeProfile(),
      currentAqi: 185,
      hours: cleanHours,
    });
    expect(plan.summary).toContain('Asha');
    expect(plan.summary).toContain('AQI 185');
  });

  it('adapts the commute block to the chosen mode', () => {
    const plan = buildLocalPlan({
      profile: makeProfile({ commute: 'work_from_home' }),
      currentAqi: 120,
      hours: cleanHours,
    });
    const commute = plan.blocks.find((block) => block.title.includes('Leave for work'));
    expect(commute?.detail).toContain('does not happen');
  });

  it('warns a cyclist off riding on a dirty day', () => {
    const plan = buildLocalPlan({
      profile: makeProfile({ commute: 'cycling' }),
      currentAqi: 170,
      hours: dirtyHours,
    });
    const commute = plan.blocks.find((block) => block.title.includes('Cycling'));
    expect(commute?.detail).toContain('afternoon window');
  });

  it('works with an empty forecast by falling back to the current AQI', () => {
    const plan = buildLocalPlan({
      profile: makeProfile(),
      currentAqi: 90,
      hours: [],
    });
    expect(plan.blocks.length).toBeGreaterThanOrEqual(4);
    expect(plan.bestOutdoorWindow).toBeNull();
    expect(plan.blocks.every((block) => Number.isFinite(block.windowAqi))).toBe(true);
  });

  it('keeps every risk label inside the allowed set', () => {
    const plan = buildLocalPlan({
      profile: makeProfile(),
      currentAqi: 60,
      hours: cleanHours,
    });
    const allowed = new Set(['ideal', 'acceptable', 'poor', 'avoid']);
    for (const block of plan.blocks) {
      expect(allowed.has(block.risk)).toBe(true);
    }
  });
});
