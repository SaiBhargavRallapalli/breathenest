// ============================================================
// src/constants/aqiBands.ts
// Category thresholds, colours and plain-language health guidance.
// Colours are decorative only — every value is also stated in text
// so colour is never the sole carrier of meaning (WCAG 1.4.1).
// ============================================================

import type { AqiCategory } from '@/types';

export interface AqiBand {
  readonly category: AqiCategory;
  readonly label: string;
  readonly shortLabel: string;
  readonly max: number;
  readonly color: string;
  readonly tint: string;
  /** General guidance that applies to everyone. */
  readonly guidance: string;
  /** Extra guidance when a household has vulnerable members. */
  readonly sensitiveGuidance: string;
}

/**
 * Upper bound of each EPA band, ascending. **The one place these numbers
 * are written** — `AQI_BANDS` reads them for its `max`, the category and
 * risk classifiers resolve against them, window acceptance thresholds and
 * pollutant colours follow them, so a breakpoint can never be changed in
 * one screen and forgotten in another. Declared as a tuple so
 * `noUncheckedIndexedAccess` still allows a literal index.
 */
export const AQI_UPPER_BOUNDS = [50, 100, 150, 200, 300, Number.POSITIVE_INFINITY] as const;

export const AQI_BANDS: readonly AqiBand[] = [
  {
    category: 'good',
    label: 'Good',
    shortLabel: 'Good',
    max: AQI_UPPER_BOUNDS[0],
    color: '#22c55e', // AA on its own tint (was #16a34a: 4.2:1)
    tint: 'rgba(22, 163, 74, 0.16)',
    guidance: 'Air is clean. A good day for outdoor activity and for opening the windows.',
    sensitiveGuidance: 'No restrictions — enjoy normal outdoor plans.',
  },
  {
    category: 'moderate',
    label: 'Moderate',
    shortLabel: 'Moderate',
    max: AQI_UPPER_BOUNDS[1],
    color: '#eab308',
    tint: 'rgba(234, 179, 8, 0.16)',
    guidance: 'Acceptable air. Unusually sensitive people may feel mild throat irritation.',
    sensitiveGuidance: 'Sensitive members should ease up on long, hard outdoor effort.',
  },
  {
    category: 'unhealthy_sensitive',
    label: 'Unhealthy for sensitive groups',
    shortLabel: 'Sensitive',
    max: AQI_UPPER_BOUNDS[2],
    color: '#f97316',
    tint: 'rgba(249, 115, 22, 0.16)',
    guidance: 'Sensitive groups should cut back on long outdoor exertion; others are fine.',
    sensitiveGuidance:
      'Children with asthma, older adults and people with heart or lung disease should move activity indoors or to a shorter, gentler slot.',
  },
  {
    category: 'unhealthy',
    label: 'Unhealthy',
    shortLabel: 'Unhealthy',
    max: AQI_UPPER_BOUNDS[3],
    color: '#f87171', // AA on its own tint (was #ef4444: 4.0:1)
    tint: 'rgba(239, 68, 68, 0.16)',
    guidance: 'Everyone should limit prolonged outdoor exertion and keep windows shut.',
    sensitiveGuidance: 'Sensitive members should stay indoors with filtered air where possible.',
  },
  {
    category: 'very_unhealthy',
    label: 'Very unhealthy',
    shortLabel: 'Very unhealthy',
    max: AQI_UPPER_BOUNDS[4],
    color: '#c084fc', // AA on its own tint (was #a855f7: 3.6:1)
    tint: 'rgba(168, 85, 247, 0.18)',
    guidance: 'Avoid outdoor exercise. Keep outdoor time to essentials only.',
    sensitiveGuidance: 'Sensitive members should remain indoors; consider moving school or care plans inside.',
  },
  {
    category: 'hazardous',
    label: 'Hazardous',
    shortLabel: 'Hazardous',
    max: AQI_UPPER_BOUNDS[5],
    color: '#ff5f7e', // AA on its own tint (was #be123c: 2.5:1)
    tint: 'rgba(190, 18, 60, 0.22)',
    guidance: 'Health emergency: stay indoors, seal gaps and run filtration continuously.',
    sensitiveGuidance:
      'Sensitive members should avoid going out entirely and seek medical advice if symptoms appear.',
  },
];

/** Human-readable label for an AQI value. */
export function categoryLabel(category: AqiCategory): string {
  return AQI_BANDS.find((band) => band.category === category)?.label ?? 'Unknown';
}

/** Design token for an AQI value (text/graphic use only, never sole meaning). */
export function categoryColor(category: AqiCategory): string {
  return AQI_BANDS.find((band) => band.category === category)?.color ?? '#94a3b8';
}
