// ============================================================
// src/components/ui/Sparkline.tsx
// Lightweight inline SVG trend line with a mandatory screen-reader
// text twin (WCAG SC 1.1.1). The graphic itself is aria-hidden so
// assistive tech reads the structured list instead of a blank svg.
// ============================================================

import { useMemo } from 'react';
import { formatHour } from '@/lib/format';

interface SparklineProps {
  readonly values: readonly number[];
  /** Hour numbers aligned 1:1 with `values`, used for the text twin. */
  readonly hours: readonly number[];
  readonly title: string;
  readonly unit?: string;
  readonly width?: number;
  readonly height?: number;
}

export function Sparkline({
  values,
  hours,
  title,
  unit = 'AQI',
  width = 320,
  height = 64,
}: SparklineProps) {
  const geometry = useMemo(() => {
    if (values.length === 0) return { path: '', points: [] as { x: number; y: number }[] };
    const peak = Math.max(...values, 1);
    const span = Math.max(peak, 1);
    const step = values.length > 1 ? width / (values.length - 1) : 0;

    const points = values.map((value, index) => ({
      x: index * step,
      y: height - (value / span) * (height - 6) - 3,
    }));

    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
    return { path, points };
  }, [values, width, height]);

  if (values.length === 0) {
    return <p className="text-sm text-fog">No trend data available.</p>;
  }

  const peak = Math.max(...values);
  const trough = Math.min(...values);
  const peakIndex = values.indexOf(peak);
  const troughIndex = values.indexOf(trough);
  const latest = values[values.length - 1] ?? 0;

  return (
    <div>
      {/* Screen-reader text twin: identical information, readable form. */}
      <ul className="sr-only" aria-label={`${title} trend summary`}>
        <li>{title}, measured in {unit}.</li>
        <li>
          Lowest reading {trough} at {formatHour(hours[troughIndex] ?? 0)}.
        </li>
        <li>
          Highest reading {peak} at {formatHour(hours[peakIndex] ?? 0)}.
        </li>
        <li>Most recent reading {latest}.</li>
        <li>
          Range {trough} to {peak} across {values.length} hourly readings.
        </li>
      </ul>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-16 w-full"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d={`${geometry.path} L${width},${height} L0,${height} Z`}
          fill="rgba(52, 211, 153, 0.14)"
          stroke="none"
        />
        <path
          d={geometry.path}
          fill="none"
          stroke="var(--color-mint)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
