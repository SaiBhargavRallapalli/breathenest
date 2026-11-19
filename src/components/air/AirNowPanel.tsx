// ============================================================
// src/components/air/AirNowPanel.tsx
// The landing panel: current reading, what it means for the
// household, whether the air will stagnate, the 24-hour outlook and
// the underlying pollutant breakdown.
// ============================================================

import { useApp } from '@/context/AppContext';
import { AQI_BANDS } from '@/constants/aqiBands';
import { translate } from '@/constants/translations';
import { formatTimestamp } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Gauge } from '@/components/ui/Gauge';
import { Stat } from '@/components/ui/Stat';
import { PollutantGrid } from './PollutantGrid';
import { ForecastStrip } from './ForecastStrip';

const STAGNATION_TONE = {
  none: 'text-mint',
  moderate: 'text-warn',
  severe: 'text-alert',
} as const;

const STAGNATION_LABEL = {
  none: 'Dispersing normally',
  moderate: 'Some trapping likely',
  severe: 'Strong trapping likely',
} as const;

export function AirNowPanel() {
  const { air, profile, language } = useApp();

  if (air.status === 'loading' && !air.bundle) {
    return (
      <Card title="Loading air quality…" level={2} eyebrow={translate(language, 'common.loading')}>
        <div className="h-40 animate-pulse rounded-xl bg-raised" aria-hidden="true" />
      </Card>
    );
  }

  if (!air.bundle) {
    return (
      <Card title={translate(language, 'common.error')} level={2}>
        <p className="text-sm text-fog">No readings have loaded yet. Use Refresh to try again.</p>
      </Card>
    );
  }

  const { reading, forecast, stagnation } = air.bundle;
  const band = AQI_BANDS.find((entry) => entry.category === reading.category);
  const hasSensitive = profile.members.some((member) =>
    member.vulnerabilities.some((tag) => tag !== 'none'),
  );

  return (
    <div className="grid gap-5">
      <Card
        level={2}
        eyebrow="Current conditions"
        title={`${reading.locationName}${reading.region ? `, ${reading.region}` : ''}`}
        description={`Observed ${formatTimestamp(reading.observedAt)} · source: ${
          reading.source === 'live' ? 'live' : reading.source === 'cache' ? 'cached' : 'sample'
        }`}
      >
        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <div className="flex flex-col items-center justify-center">
            <Gauge aqi={reading.aqi} label={band?.label ?? ''} />
            <div className="mt-2 flex justify-center">
              <Badge category={reading.category} />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: `${band?.color ?? '#334155'}66`, backgroundColor: band?.tint }}
            >
              <h3 className="text-base font-semibold" style={{ color: band?.color }}>
                {band?.label}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-chalk">{band?.guidance}</p>
              {hasSensitive && (
                <p className="mt-2 text-sm leading-relaxed text-chalk/90">
                  <strong>For your household:</strong> {band?.sensitiveGuidance}
                </p>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="Main pollutant" value={reading.dominant.toUpperCase()} tone="default" />
              <Stat
                label="PM2.5"
                value={`${Math.round(reading.pm25)}`}
                hint="µg/m³"
                tone={reading.pm25 > 55 ? 'bad' : 'good'}
              />
              <Stat
                label="Today’s range"
                value={`${Math.min(...forecast.hours.map((h) => h.aqi))}–${Math.max(
                  ...forecast.hours.map((h) => h.aqi),
                )}`}
                hint="hourly AQI"
              />
            </dl>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title={translate(language, 'air.stagnation')}
          description="Calm wind, high humidity and a sharply swinging daily curve all point to air that is not moving."
        >
          <p className={`text-lg font-semibold ${STAGNATION_TONE[stagnation.level]}`}>
            {STAGNATION_LABEL[stagnation.level]}
          </p>
          <p className="mt-1 text-sm text-fog">Trapping score {stagnation.score} / 10</p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-chalk">
            {stagnation.reasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />
                {reason}
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title={translate(language, 'air.forecast')}
          description="Hourly AQI for the rest of today. The outlined columns mark the cleanest slot."
        >
          <ForecastStrip hours={forecast.hours} />
        </Card>
      </div>

      <Card
        title="Pollutant breakdown"
        description="Every pollutant converted to its own AQI sub-index. The highest one sets the overall reading."
      >
        <PollutantGrid readings={reading.readings} />
      </Card>
    </div>
  );
}
