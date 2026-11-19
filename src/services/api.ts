// ============================================================
// src/services/api.ts
// Thin typed client for the BreatheNest gateway. All traffic stays
// same-origin — the browser never talks to a third-party API.
// ============================================================

import type { AirReading, DailyPlan, ForecastDay } from '@/types';

/** Raised for any non-2xx response or a transport failure. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const TIMEOUT_MS = 15_000;

/** Fetches JSON with a timeout and a uniform error shape. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError('Could not reach the BreatheNest server.', 0);
  }

  const body = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    const message =
      body !== null && typeof (body as { error?: unknown }).error === 'string'
        ? ((body as { error: string }).error)
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }
  if (body === null) throw new ApiError('Empty response from the server.', response.status);
  return body;
}

export interface AirQualityParams {
  readonly latitude: number;
  readonly longitude: number;
  readonly name: string;
  readonly region: string;
  readonly country: string;
  readonly id: string;
}

export interface AirResponse {
  readonly reading: AirReading;
  readonly forecast: ForecastDay;
  readonly fetchedAt: string;
}

/** Live readings for one coordinate pair. */
export async function fetchAirQuality(params: AirQualityParams): Promise<AirResponse> {
  const query = new URLSearchParams({
    lat: String(params.latitude),
    lon: String(params.longitude),
    name: params.name,
    region: params.region,
    country: params.country,
    id: params.id,
  });
  return request<AirResponse>(`/api/air-quality?${query.toString()}`);
}

export interface GeoResult {
  readonly id: string;
  readonly name: string;
  readonly region: string;
  readonly country: string;
  readonly countryCode: string;
  readonly latitude: number;
  readonly longitude: number;
}

/** City search backed by the gateway. */
export async function searchLocations(query: string): Promise<GeoResult[]> {
  const body = await request<{ results: GeoResult[] }>(
    `/api/locations?q=${encodeURIComponent(query)}`,
  );
  return body.results;
}

export interface PlanRequestBody {
  readonly profile: unknown;
  readonly currentAqi: number;
  readonly hours: readonly { readonly hour: number; readonly aqi: number }[];
}

/** Requests a generated day plan. */
export async function requestPlan(body: PlanRequestBody): Promise<{ plan: DailyPlan }> {
  return request<{ plan: DailyPlan }>('/api/plan', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Requests a short multilingual advisory. */
export async function requestAdvisory(body: unknown): Promise<{ advisory: string }> {
  return request<{ advisory: string }>('/api/advisory', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
