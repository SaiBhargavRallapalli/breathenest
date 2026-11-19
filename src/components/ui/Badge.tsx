// ============================================================
// src/components/ui/Badge.tsx
// AQI category pill. The written label always travels with the
// colour so meaning never depends on hue alone (WCAG 1.4.1).
// ============================================================

import type { AqiCategory } from '@/types';
import { AQI_BANDS } from '@/constants/aqiBands';

interface BadgeProps {
  readonly category: AqiCategory;
  readonly aqi?: number;
  readonly size?: 'sm' | 'md';
}

export function Badge({ category, aqi, size = 'md' }: BadgeProps) {
  const band = AQI_BANDS.find((entry) => entry.category === category);
  if (!band) return null;

  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${padding}`}
      style={{
        backgroundColor: band.tint,
        color: band.color,
        border: `1px solid ${band.color}55`,
      }}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: band.color }} />
      {aqi !== undefined && <span className="tabular-nums">AQI {aqi}</span>}
      <span>{band.shortLabel}</span>
    </span>
  );
}
