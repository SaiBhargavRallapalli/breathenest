// ============================================================
// src/components/air/PollutantGrid.tsx
// The six criteria pollutants with their EPA sub-index. The dominant
// pollutant is flagged in text, not just with colour.
// ============================================================

import type { PollutantReading } from '@/types';
import { POLLUTANT_META } from '@/constants/pollutants';
import { AQI_UPPER_BOUNDS } from '@/constants/aqiBands';
import { Meter } from '@/components/ui/Meter';

interface PollutantGridProps {
  readonly readings: readonly PollutantReading[];
}

function toneFor(subIndex: number): 'mint' | 'warn' | 'alert' {
  // Reads the shared EPA ladder instead of re-typing 50/150 here.
  if (subIndex <= AQI_UPPER_BOUNDS[0]) return 'mint';
  if (subIndex <= AQI_UPPER_BOUNDS[2]) return 'warn';
  return 'alert';
}

export function PollutantGrid({ readings }: PollutantGridProps) {
  if (readings.length === 0) {
    return <p className="text-sm text-fog">No pollutant readings available for this location.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {readings.map((reading) => {
        const meta = POLLUTANT_META[reading.key];
        return (
          <div key={reading.key} className="rounded-xl border border-edge bg-raised p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-chalk">
                {meta.short}
                {reading.dominant && (
                  <span className="ms-2 rounded-full bg-mint/15 px-2 py-0.5 text-[11px] font-semibold text-mint">
                    Main pollutant
                  </span>
                )}
              </p>
              <p className="text-sm tabular-nums text-fog">
                <span className="font-semibold text-chalk">
                  {reading.value >= 100 ? Math.round(reading.value) : reading.value}
                </span>{' '}
                {reading.unit}
              </p>
            </div>

            <Meter
              label={`Sub-index ${reading.subIndex}`}
              value={reading.subIndex / 500}
              valueText={`${reading.subIndex} / 500`}
              tone={toneFor(reading.subIndex)}
            />

            <p className="mt-2 text-xs leading-relaxed text-fog">{meta.healthNote}</p>
          </div>
        );
      })}
    </div>
  );
}
