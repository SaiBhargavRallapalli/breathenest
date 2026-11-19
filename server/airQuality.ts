// ============================================================
// server/airQuality.ts
// Server-side client for the free Open-Meteo air-quality, weather and
// geocoding APIs. Running upstream calls here keeps the browser from
// talking to third parties at all (CSP connect-src is 'self' only)
// and lets us cache responses once for every visitor.
// ============================================================

import { POLLUTANT_META, POLLUTANT_ORDER } from '../src/constants/pollutants';
import { classifyAqi, computeAqi } from '../src/lib/compute/index';
import type {
  AirReading,
  ForecastDay,
  HourlyForecast,
  PollutantKey,
  PollutantReading,
  ReadingSource,
  WeatherSnapshot,
} from '../src/types';
import type { ServerConfig } from './config';
import type { TtlCache } from './cache';

/** A normalised geocoding hit. */
export interface GeoResult {
  readonly id: string;
  readonly name: string;
  readonly region: string;
  readonly country: string;
  readonly countryCode: string;
  readonly latitude: number;
  readonly longitude: number;
}

/** Everything one air-quality lookup produces. */
export interface AirPayload {
  readonly reading: AirReading;
  readonly forecast: ForecastDay;
  readonly fetchedAt: string;
}

interface UpstreamCurrent {
  time?: string;
  pm2_5?: number | null;
  pm10?: number | null;
  ozone?: number | null;
  nitrogen_dioxide?: number | null;
  sulphur_dioxide?: number | null;
  carbon_monoxide?: number | null;
  us_aqi?: number | null;
}

interface UpstreamHourly {
  time?: string[];
  pm2_5?: (number | null)[];
  pm10?: (number | null)[];
  us_aqi?: (number | null)[];
  wind_speed_10m?: (number | null)[];
  temperature_2m?: (number | null)[];
  relative_humidity_2m?: (number | null)[];
}

interface UpstreamAirResponse {
  current?: UpstreamCurrent;
  hourly?: UpstreamHourly;
}

interface UpstreamWeatherResponse {
  current?: {
    wind_speed_10m?: number | null;
    temperature_2m?: number | null;
    relative_humidity_2m?: number | null;
  };
}

const REQUEST_TIMEOUT_MS = 8_000;

/** Fetches JSON with a hard timeout; callers handle any rejection. */
async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Upstream responded ${response.status} for ${url}`);
  }
  return (await response.json()) as T;
}

/** Raw upstream field name for each of our pollutant keys. */
const UPSTREAM_FIELD: Readonly<Record<PollutantKey, keyof UpstreamCurrent>> = {
  pm25: 'pm2_5',
  pm10: 'pm10',
  o3: 'ozone',
  no2: 'nitrogen_dioxide',
  so2: 'sulphur_dioxide',
  co: 'carbon_monoxide',
};

/** Converts an upstream concentration into EPA units and a sub-index. */
function toPollutantReadings(current: UpstreamCurrent): {
  readings: PollutantReading[];
  concentrations: Partial<Record<PollutantKey, number>>;
} {
  const readings: PollutantReading[] = [];
  const concentrations: Partial<Record<PollutantKey, number>> = {};

  for (const key of POLLUTANT_ORDER) {
    const raw = current[UPSTREAM_FIELD[key]];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;

    const meta = POLLUTANT_META[key];
    const epaValue = raw * meta.toEpaScale;
    concentrations[key] = epaValue;
    readings.push({
      key,
      label: meta.label,
      value: Math.round(epaValue * 100) / 100,
      unit: meta.unit,
      subIndex: 0,
      dominant: false,
    });
  }

  return { readings, concentrations };
}

/** Builds the 24-hour forward forecast from the hourly arrays. */
function buildForecast(hourly: UpstreamHourly, weather: WeatherSnapshot, source: ReadingSource): ForecastDay {
  const times = hourly.time ?? [];
  const pm25Series = hourly.pm2_5 ?? [];
  const pm10Series = hourly.pm10 ?? [];

  const hours: HourlyForecast[] = [];
  for (let index = 0; index < times.length; index += 1) {
    const iso = times[index];
    const pm25 = pm25Series[index];
    if (iso === undefined || typeof pm25 !== 'number') continue;

    const pm10 = typeof pm10Series[index] === 'number' ? (pm10Series[index] as number) : undefined;
    const concentrations: Partial<Record<PollutantKey, number>> = { pm25 };
    if (pm10 !== undefined) concentrations.pm10 = pm10;

    let aqi: number;
    try {
      aqi = computeAqi(concentrations).aqi;
    } catch {
      continue;
    }

    const parsed = new Date(iso);
    hours.push({
      iso,
      hour: Number.isNaN(parsed.getTime()) ? hours.length : parsed.getHours(),
      aqi,
      pm25: Math.round(pm25 * 10) / 10,
      category: classifyAqi(aqi),
    });
  }

  return { hours, weather, source };
}

/** Reads the surface weather snapshot, tolerating missing fields. */
function readWeather(hourly: UpstreamHourly, current: UpstreamWeatherResponse['current']): WeatherSnapshot {
  const last = <T>(series: (T | null | undefined)[] | undefined): T | null => {
    if (!series || series.length === 0) return null;
    for (let i = series.length - 1; i >= 0; i -= 1) {
      const value = series[i];
      if (value !== null && value !== undefined) return value as T;
    }
    return null;
  };

  return {
    windSpeedKmh: current?.wind_speed_10m ?? last(hourly.wind_speed_10m),
    temperatureC: current?.temperature_2m ?? last(hourly.temperature_2m),
    humidityPct: current?.relative_humidity_2m ?? last(hourly.relative_humidity_2m),
  };
}

export interface LocationHint {
  readonly id?: string;
  readonly name: string;
  readonly region: string;
  readonly country: string;
  readonly latitude: number;
  readonly longitude: number;
}

/** Fetches, converts and assembles a full air-quality payload. */
export async function fetchAirPayload(
  hint: LocationHint,
  config: ServerConfig,
  cache: TtlCache<AirPayload>,
): Promise<{ payload: AirPayload; source: ReadingSource }> {
  const key = `air:${hint.latitude.toFixed(3)}:${hint.longitude.toFixed(3)}`;
  const cached = cache.get(key);
  if (cached) return { payload: cached, source: 'cache' };

  const base = new URL(config.airQualityBaseUrl);
  base.pathname = `${base.pathname.replace(/\/$/, '')}/air-quality`;
  base.search = new URLSearchParams({
    latitude: String(hint.latitude),
    longitude: String(hint.longitude),
    current: 'pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi',
    hourly: 'pm2_5,pm10,us_aqi',
    forecast_days: '1',
    timezone: 'auto',
  }).toString();

  const weatherUrl = (() => {
    const url = new URL(config.forecastBaseUrl);
    url.pathname = `${url.pathname.replace(/\/$/, '')}/forecast`;
    url.search = new URLSearchParams({
      latitude: String(hint.latitude),
      longitude: String(hint.longitude),
      current: 'wind_speed_10m,temperature_2m,relative_humidity_2m',
      hourly: 'wind_speed_10m,temperature_2m,relative_humidity_2m',
      forecast_days: '1',
      timezone: 'auto',
    }).toString();
    return url.toString();
  })();

  const [air, weather] = await Promise.all([
    getJson<UpstreamAirResponse>(base.toString()),
    getJson<UpstreamWeatherResponse>(weatherUrl).catch(() => null),
  ]);

  const current = air.current;
  if (!current) throw new Error('Upstream returned no current observation.');

  const { readings, concentrations } = toPollutantReadings(current);
  const { aqi, dominant, subIndices } = computeAqi(concentrations);
  if (dominant === null) throw new Error('Upstream returned no usable pollutant readings.');

  const withIndices = readings.map((reading) => ({
    ...reading,
    subIndex: subIndices[reading.key] ?? 0,
    dominant: reading.key === dominant,
  }));

  const reading: AirReading = {
    locationId: hint.id ?? `${hint.latitude},${hint.longitude}`,
    locationName: hint.name,
    region: hint.region,
    country: hint.country,
    latitude: hint.latitude,
    longitude: hint.longitude,
    observedAt: current.time ?? new Date().toISOString(),
    source: 'live',
    aqi,
    category: classifyAqi(aqi),
    dominant,
    readings: withIndices,
    pm25: concentrations.pm25 ?? 0,
  };

  const snapshot = readWeather(air.hourly ?? {}, weather?.current);
  const forecast = buildForecast(air.hourly ?? {}, snapshot, 'live');

  const payload: AirPayload = { reading, forecast, fetchedAt: new Date().toISOString() };
  cache.set(key, payload, config.upstreamTtlMs);
  return { payload, source: 'live' };
}

/** City search backed by the Open-Meteo geocoding endpoint. */
export async function searchLocations(
  query: string,
  config: ServerConfig,
  cache: TtlCache<GeoResult[]>,
): Promise<GeoResult[]> {
  const key = `geo:${query.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const url = new URL(config.geocodingBaseUrl);
  url.pathname = `${url.pathname.replace(/\/$/, '')}/search`;
  url.search = new URLSearchParams({
    name: query,
    count: '8',
    language: 'en',
    format: 'json',
  }).toString();

  const body = (await getJson<{ results?: Record<string, unknown>[] }>(url.toString())) ?? {};
  const results: GeoResult[] = (body.results ?? []).flatMap((entry) => {
    const latitude = entry.latitude;
    const longitude = entry.longitude;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return [];
    return [
      {
        id: String(entry.id ?? `${latitude},${longitude}`),
        name: String(entry.name ?? query),
        region: String(entry.admin1 ?? ''),
        country: String(entry.country ?? entry.country_code ?? ''),
        countryCode: String(entry.country_code ?? ''),
        latitude,
        longitude,
      },
    ];
  });

  cache.set(key, results, config.upstreamTtlMs);
  return results;
}
