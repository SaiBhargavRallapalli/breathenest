// ============================================================
// src/components/ui/Gauge.tsx
// Semi-circular AQI dial drawn as a single SVG arc, paired with a
// screen-reader text twin so the reading is never visual-only.
// ============================================================

import { AQI_BANDS } from '@/constants/aqiBands';
import { classifyAqi } from '@/lib/compute';

const RADIUS = 80;
const ARC_LENGTH = Math.PI * RADIUS;

interface GaugeProps {
  readonly aqi: number;
  readonly label: string;
}

export function Gauge({ aqi, label }: GaugeProps) {
  const category = classifyAqi(aqi);
  const band = AQI_BANDS.find((entry) => entry.category === category);
  const fraction = Math.min(1, Math.max(0, aqi / 500));

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 126" className="w-full max-w-[260px]" aria-hidden="true" focusable="false">
        <path
          d="M20 110 A80 80 0 0 0 180 110"
          fill="none"
          stroke="var(--color-edge)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M20 110 A80 80 0 0 0 180 110"
          fill="none"
          stroke={band?.color ?? 'var(--color-mint)'}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={ARC_LENGTH}
          strokeDashoffset={ARC_LENGTH * (1 - fraction)}
          className="transition-[stroke-dashoffset] duration-700"
        />
        <text
          x="100"
          y="88"
          textAnchor="middle"
          className="fill-chalk"
          style={{ fontSize: 44, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
        >
          {Math.round(aqi)}
        </text>
        <text
          x="100"
          y="112"
          textAnchor="middle"
          className="fill-fog"
          style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1.5 }}
        >
          US AQI
        </text>
      </svg>

      <ul className="sr-only" aria-label="Air quality index reading">
        <li>Current air quality index: {Math.round(aqi)} out of 500.</li>
        <li>Category: {band?.label ?? 'Unknown'}.</li>
        <li>Context: {label}.</li>
      </ul>
    </div>
  );
}
