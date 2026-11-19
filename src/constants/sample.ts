// ============================================================
// src/constants/sample.ts
// Bundled fallback readings. Used when the gateway is unreachable or
// the upstream provider is down, so the app still demonstrates real
// behaviour offline. Always labelled `source: 'sample'` in the UI.
// ============================================================

import type {
  AirBundle,
  AirReading,
  ForecastDay,
  HourlyForecast,
  PollutantReading,
} from '@/types';
import { POLLUTANT_META, POLLUTANT_ORDER } from '@/constants/pollutants';
import { classifyAqi, computeAqi, concentrationForSubIndex } from '@/lib/compute';
import { assessStagnation } from '@/lib/compute/forecast';

/** A realistic winter-smog day: trapped dawn peak, clean midday, worse evening. */
const SAMPLE_CURVE: readonly number[] = [
  168, 172, 178, 183, 190, 205, 224, 231, 218, 196, 172, 152, 138, 128, 124, 131, 148, 176, 214,
  246, 258, 249, 226, 196,
];

/** Ambient concentrations (EPA units) that make up the sample observation. */
const SAMPLE_CONCENTRATIONS = {
  pm25: 150,
  pm10: 245,
  o3: 45,
  no2: 62,
  so2: 28,
  co: 1.2,
} as const;

function buildReadings(): {
  readings: PollutantReading[];
  aqi: number;
  dominant: AirReading['dominant'];
} {
  const { aqi, dominant, subIndices } = computeAqi(SAMPLE_CONCENTRATIONS);
  const readings = POLLUTANT_ORDER.map((key) => {
    const meta = POLLUTANT_META[key];
    return {
      key,
      label: meta.label,
      value: SAMPLE_CONCENTRATIONS[key],
      unit: meta.unit,
      subIndex: subIndices[key] ?? 0,
      dominant: key === dominant,
    };
  });
  return { readings, aqi, dominant: dominant ?? 'pm25' };
}

function buildForecast(): ForecastDay {
  const now = new Date();
  const hours: HourlyForecast[] = SAMPLE_CURVE.map((aqi, hour) => {
    const stamp = new Date(now);
    stamp.setHours(hour, 0, 0, 0);
    return {
      iso: stamp.toISOString(),
      hour,
      aqi,
      pm25: concentrationForSubIndex('pm25', aqi),
      category: classifyAqi(aqi),
    };
  });

  return {
    hours,
    weather: { windSpeedKmh: 4, temperatureC: 11, humidityPct: 84 },
    source: 'sample',
  };
}

/** Full offline bundle for the default location. */
export function sampleBundle(locationName: string, country: string): AirBundle {
  const { readings, aqi, dominant } = buildReadings();
  const forecast = buildForecast();

  const reading: AirReading = {
    locationId: 'sample',
    locationName,
    region: '',
    country,
    latitude: 0,
    longitude: 0,
    observedAt: new Date().toISOString(),
    source: 'sample',
    aqi,
    category: classifyAqi(aqi),
    dominant,
    readings,
    pm25: SAMPLE_CONCENTRATIONS.pm25,
  };

  return {
    reading,
    forecast,
    stagnation: assessStagnation(forecast),
    fetchedAt: new Date().toISOString(),
  };
}
