// ============================================================
// src/test/api.test.ts
// The typed browser client: uniform errors, timeouts and correct
// query construction. All network access is stubbed.
// ============================================================

import { describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  fetchAirQuality,
  requestAdvisory,
  requestPlan,
  searchLocations,
} from '@/services/api';
import { makeAirResponse } from './fixtures';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ApiError', () => {
  it('carries the status and keeps the Error contract', () => {
    const error = new ApiError('nope', 429);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
    expect(error.status).toBe(429);
    expect(error.message).toBe('nope');
  });
});

describe('fetchAirQuality', () => {
  it('requests the gateway with the location query', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(makeAirResponse()));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchAirQuality({
      latitude: 28.61,
      longitude: 77.21,
      name: 'Delhi',
      region: 'NCT',
      country: 'India',
      id: 'delhi-in',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain('/api/air-quality?');
    expect(url).toContain('lat=28.61');
    expect(url).toContain('lon=77.21');
    expect(url).toContain('name=Delhi');
    // The gateway echoes its own resolved label; the client shows it as-is.
    expect(result.reading.locationName).toBe('Test City');
    expect(result.forecast.hours).toHaveLength(24);
  });

  it('surfaces the server error message on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'Bad coordinates' }, 400)));

    await expect(
      fetchAirQuality({
        latitude: 0,
        longitude: 0,
        name: 'X',
        region: '',
        country: '',
        id: 'x',
      }),
    ).rejects.toThrow('Bad coordinates');
  });

  it('falls back to a generic message when the body has no error field', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 503)));

    const failure = await fetchAirQuality({
      latitude: 0,
      longitude: 0,
      name: 'X',
      region: '',
      country: '',
      id: 'x',
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(503);
    expect((failure as ApiError).message).toContain('503');
  });

  it('maps transport failures to status 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const failure = await fetchAirQuality({
      latitude: 0,
      longitude: 0,
      name: 'X',
      region: '',
      country: '',
      id: 'x',
    }).catch((error: unknown) => error);

    expect((failure as ApiError).status).toBe(0);
    expect((failure as ApiError).message).toContain('Could not reach');
  });

  it('rejects an empty 200 body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 200 })),
    );

    await expect(
      fetchAirQuality({ latitude: 0, longitude: 0, name: 'X', region: '', country: '', id: 'x' }),
    ).rejects.toThrow('Empty response');
  });
});

describe('searchLocations', () => {
  it('encodes the query and unwraps results', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        results: [
          {
            id: 'delhi-in',
            name: 'Delhi',
            region: 'NCT',
            country: 'India',
            countryCode: 'IN',
            latitude: 28.6,
            longitude: 77.2,
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const results = await searchLocations('New Delhi');
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain('/api/locations?q=New%20Delhi');
    expect(results).toHaveLength(1);
    expect(results[0]?.country).toBe('India');
  });

  it('returns an empty list when the gateway finds nothing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ results: [] })));
    expect(await searchLocations('Nowhereville')).toEqual([]);
  });
});

describe('requestPlan / requestAdvisory', () => {
  it('posts JSON and reads the plan back', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        plan: {
          blocks: [],
          bestOutdoorWindow: null,
          summary: 'ok',
          generator: 'local',
          generatedAt: '2026-11-19T09:00:00.000Z',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestPlan({
      profile: {},
      currentAqi: 120,
      hours: [{ hour: 9, aqi: 120 }],
    });

    expect(result.plan.generator).toBe('local');
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain('currentAqi');
  });

  it('posts the advisory body and returns the text', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ advisory: 'Keep windows shut.' })));

    const result = await requestAdvisory({ locationName: 'Delhi', aqi: 200, language: 'en' });
    expect(result.advisory).toBe('Keep windows shut.');
  });

  it('propagates advisory validation errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'Invalid advisory request.' }, 400)),
    );

    await expect(requestAdvisory({ locationName: '', aqi: 1, language: 'xx' })).rejects.toThrow(
      'Invalid advisory request.',
    );
  });
});
