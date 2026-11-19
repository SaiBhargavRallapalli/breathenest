// ============================================================
// src/test/fixtures.ts
// Deterministic fixtures for the compute, server and render
// suites. Everything here is hand-built so tests never depend on
// live network data.
// ============================================================

import type {
  AirBundle,
  AirReading,
  ForecastDay,
  HouseholdMember,
  HouseholdProfile,
  HourlyForecast,
  PollutantReading,
} from '@/types';
import { classifyAqi } from '@/lib/compute';
import { STORAGE_KEYS } from '@/services/storage';

/** A gentle 24-hour curve with a dirty dawn and a clean midday. */
export const CURVE: readonly number[] = [
  170, 178, 185, 192, 200, 214, 226, 210, 180, 140, 110, 92, 78, 70, 66, 74, 96, 132, 168, 196,
  214, 208, 194, 178,
];

/** An all-dirty day used to prove the "no safe window" paths. */
export const DIRTY_CURVE: readonly number[] = Array.from({ length: 24 }, (_, hour) => 155 + (hour % 7));

export function makeHours(curve: readonly number[] = CURVE): HourlyForecast[] {
  return curve.map((aqi, hour) => ({
    iso: `2026-11-19T${String(hour).padStart(2, '0')}:00`,
    hour,
    aqi,
    pm25: Math.round(aqi * 0.6 * 10) / 10,
    category: classifyAqi(aqi),
  }));
}

export function makeReadings(): PollutantReading[] {
  return [
    { key: 'pm25', label: 'Fine particulates', value: 120.4, unit: 'µg/m³', subIndex: 185, dominant: true },
    { key: 'pm10', label: 'Coarse particulates', value: 220, unit: 'µg/m³', subIndex: 133, dominant: false },
    { key: 'no2', label: 'Nitrogen dioxide', value: 40, unit: 'ppb', subIndex: 38, dominant: false },
  ];
}

export function makeReading(overrides: Partial<AirReading> = {}): AirReading {
  return {
    locationId: 'test-city',
    locationName: 'Test City',
    region: 'Test Region',
    country: 'Testland',
    latitude: 28.61,
    longitude: 77.21,
    observedAt: '2026-11-19T09:00:00.000Z',
    source: 'live',
    aqi: 185,
    category: 'unhealthy',
    dominant: 'pm25',
    readings: makeReadings(),
    pm25: 120.4,
    ...overrides,
  };
}

export function makeForecast(curve: readonly number[] = CURVE): ForecastDay {
  return {
    hours: makeHours(curve),
    weather: { windSpeedKmh: 4, temperatureC: 12, humidityPct: 82 },
    source: 'live',
  };
}

export function makeBundle(overrides: Partial<AirBundle> = {}): AirBundle {
  const forecast = makeForecast();
  return {
    reading: makeReading(),
    forecast,
    stagnation: {
      level: 'severe',
      score: 6,
      reasons: ['Wind is nearly calm at 4 km/h, so exhaust has nowhere to disperse.'],
    },
    fetchedAt: '2026-11-19T09:00:00.000Z',
    ...overrides,
  };
}

export function makeMember(overrides: Partial<HouseholdMember> = {}): HouseholdMember {
  return {
    id: 'member-1',
    label: 'Asha',
    age: 8,
    vulnerabilities: ['asthma'],
    ...overrides,
  };
}

export function makeProfile(overrides: Partial<HouseholdProfile> = {}): HouseholdProfile {
  return {
    locationId: 'test-city',
    locationName: 'Test City',
    country: 'Testland',
    latitude: 28.61,
    longitude: 77.21,
    members: [makeMember()],
    commute: 'metro',
    workStartHour: 9,
    workEndHour: 18,
    homeType: 'apartment',
    budget: 'low',
    cookingFuel: 'gas',
    language: 'en',
    ...overrides,
  };
}

/** Body the gateway returns from GET /api/air-quality. */
export function makeAirResponse(): {
  reading: AirReading;
  forecast: ForecastDay;
  fetchedAt: string;
} {
  return {
    reading: makeReading(),
    forecast: makeForecast(),
    fetchedAt: '2026-11-19T09:00:00.000Z',
  };
}

/**
 * Seeds a household profile into localStorage before render, so tests
 * exercise the app exactly as a returning user would see it.
 */
export function seedProfile(profile: HouseholdProfile): void {
  window.localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
}

export type RouteHandler = (url: URL) => unknown | Promise<unknown>;
/**
 * Installs a fetch stub that dispatches on the request path.
 * Unmatched paths resolve to a 404 JSON body. A handler may return
 * a promise; never resolving one simulates a request in flight.
 */
export function stubFetch(routes: Record<string, RouteHandler>): ReturnType<typeof vi.fn> {
  const impl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : String(input);
    const url = new URL(raw, 'http://localhost:5173');
    const handler = routes[url.pathname];

    if (!handler) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await handler(url);
      return new Response(JSON.stringify(body ?? null), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  });

  vi.stubGlobal('fetch', impl);
  return impl;
}
