// ============================================================
// src/components/air/ForecastStrip.tsx
// 24-hour column chart. The cleanest slot is called out in words
// and the whole series has a screen-reader text twin.
// ============================================================

import type { HourlyForecast } from '@/types';
import { AQI_BANDS, categoryLabel } from '@/constants/aqiBands';
import { findBestWindows, worstWindow } from '@/lib/compute';
import { formatHour } from '@/lib/format';

interface ForecastStripProps {
  readonly hours: readonly HourlyForecast[];
}

function colorFor(aqi: number): string {
  return AQI_BANDS.find((band) => aqi <= band.max)?.color ?? '#94a3b8';
}

export function ForecastStrip({ hours }: ForecastStripProps) {
  if (hours.length === 0) {
    return <p className="text-sm text-fog">No forecast available.</p>;
  }

  const best = findBestWindows(hours, { durationHours: 2, limit: 1, maxPeakAqi: 150 })[0] ?? null;
  const worst = worstWindow(hours, 2);
  const peak = Math.max(...hours.map((entry) => entry.aqi), 1);

  const inBestWindow = (hour: number): boolean =>
    best !== null && hour >= best.startHour && hour < best.endHour;

  return (
    <div>
      {/* Screen-reader twin of the column chart. */}
      <ul className="sr-only" aria-label="Hourly forecast for the next 24 hours">
        <li>Peak AQI {Math.round(peak)}, lowest {Math.min(...hours.map((entry) => entry.aqi))}.</li>
        {best && (
          <li>
            Cleanest window: {formatHour(best.startHour)} to {formatHour(best.endHour)}, average AQI {best.averageAqi}.
          </li>
        )}
        {worst && (
          <li>
            Dirtiest window: {formatHour(worst.startHour)} to {formatHour(worst.endHour)}, average AQI {worst.averageAqi}.
          </li>
        )}
        {hours.map((entry) => (
          <li key={entry.iso}>
            {formatHour(entry.hour)}: AQI {entry.aqi}, {categoryLabel(entry.category)}.
          </li>
        ))}
      </ul>

      <div
        aria-hidden="true"
        className="flex h-40 items-end gap-[3px] overflow-x-auto pb-1"
        role="presentation"
      >
        {hours.map((entry) => (
          <div key={entry.iso} className="flex min-w-[14px] flex-1 flex-col items-center gap-1">
            <span className="text-[9px] tabular-nums text-fog">{entry.aqi}</span>
            <div
              className="w-full rounded-t transition-all"
              style={{
                height: `${Math.max(6, (entry.aqi / peak) * 100)}%`,
                backgroundColor: colorFor(entry.aqi),
                opacity: inBestWindow(entry.hour) ? 1 : 0.55,
                outline: inBestWindow(entry.hour) ? '2px solid var(--color-mint)' : 'none',
                outlineOffset: 1,
              }}
            />
            <span className="text-[9px] tabular-nums text-fog">
              {entry.hour % 3 === 0 ? String(entry.hour).padStart(2, '0') : ''}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {best && (
          <p className="text-mint">
            <strong>Best window:</strong> {formatHour(best.startHour)}–{formatHour(best.endHour)} (avg AQI{' '}
            {best.averageAqi})
          </p>
        )}
        {worst && (
          <p className="text-alert">
            <strong>Worst window:</strong> {formatHour(worst.startHour)}–{formatHour(worst.endHour)} (avg AQI{' '}
            {worst.averageAqi})
          </p>
        )}
      </div>
    </div>
  );
}
