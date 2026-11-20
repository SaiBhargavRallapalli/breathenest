// ============================================================
// src/test/server/app.test.ts
// End-to-end gateway tests: real HTTP against the Express app
// with a stubbed upstream provider, covering validation,
// caching, security headers, CORS and the AI fallbacks.
// ============================================================

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { createApp } from '@/../server/app';
import { loadConfig, type ServerConfig } from '@/../server/config';
import { makeProfile } from '../fixtures';

// --- Stub upstream provider -----------------------------------

const UPSTREAM_HOURS = Array.from({ length: 24 }, (_, hour) => `2026-11-19T${String(hour).padStart(2, '0')}:00`);
const UPSTREAM_PM25 = UPSTREAM_HOURS.map((_, hour) => 60 + (hour % 50));
const UPSTREAM_PM10 = UPSTREAM_HOURS.map((_, hour) => 90 + (hour % 60));

function startStubUpstream(): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    res.setHeader('Content-Type', 'application/json');

    if (url.pathname.endsWith('/air-quality')) {
      res.end(
        JSON.stringify({
          current: {
            time: '2026-11-19T09:00',
            pm2_5: 120.4,
            pm10: 220,
            ozone: 88,
            nitrogen_dioxide: 75,
            sulphur_dioxide: 40,
            carbon_monoxide: 1400,
            us_aqi: 156,
          },
          hourly: {
            time: UPSTREAM_HOURS,
            pm2_5: UPSTREAM_PM25,
            pm10: UPSTREAM_PM10,
          },
        }),
      );
      return;
    }

    if (url.pathname.endsWith('/forecast')) {
      res.end(
        JSON.stringify({
          current: { wind_speed_10m: 4, temperature_2m: 12, relative_humidity_2m: 82 },
          hourly: {
            time: UPSTREAM_HOURS,
            wind_speed_10m: UPSTREAM_HOURS.map(() => 5),
            temperature_2m: UPSTREAM_HOURS.map(() => 12),
            relative_humidity_2m: UPSTREAM_HOURS.map(() => 80),
          },
        }),
      );
      return;
    }

    if (url.pathname.endsWith('/search')) {
      res.end(
        JSON.stringify({
          results: [
            {
              id: 12345,
              name: 'Delhi',
              admin1: 'National Capital Territory',
              country: 'India',
              country_code: 'IN',
              latitude: 28.6139,
              longitude: 77.209,
            },
          ],
        }),
      );
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'stub: unknown path' }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

// --- Suite -----------------------------------------------------

let upstream: Server;
let upstreamUrl: string;
let app: Express;
let baseUrl: string;
let appPort = 0;

/** Raw HTTP request used where fetch would normalise the Origin header. */
function rawRequest(
  path: string,
  origin?: string,
): Promise<{ status: number; headers: NodeJS.Dict<string | string[]> }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: '127.0.0.1', port: appPort, path, headers: origin ? { Origin: origin } : {} },
      (res) => {
        res.resume();
        resolve({ status: res.statusCode ?? 0, headers: res.headers });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

const VALID_AIR_QUERY = 'lat=28.61&lon=77.21&name=Delhi&region=NCT&country=India&id=delhi-in';

beforeAll(async () => {
  const stub = await startStubUpstream();
  upstream = stub.server;
  upstreamUrl = stub.baseUrl;

  const config: ServerConfig = loadConfig({
    NODE_ENV: 'test',
    AIR_QUALITY_BASE_URL: `${upstreamUrl}/v1`,
    GEOCODING_BASE_URL: `${upstreamUrl}/v1`,
    FORECAST_BASE_URL: `${upstreamUrl}/v1`,
    CORS_ORIGINS: 'https://allowed.example',
    GEMINI_API_KEY: '',
  });

  app = createApp(config);
  const listener = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => listener.once('listening', () => resolve()));
  const { port } = listener.address() as AddressInfo;
  appPort = port;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
});

describe('GET /api/health', () => {
  it('reports healthy and the active model mode', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = (await response.json()) as { status: string; model: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.model).toBe('local-fallback');
  });

  it('names the engine that would actually answer when a key is present', async () => {
    const keyed = createApp(
      loadConfig({
        NODE_ENV: 'test',
        GROQ_API_KEY: 'test-key',
        AIR_QUALITY_BASE_URL: `${upstreamUrl}/v1`,
        GEOCODING_BASE_URL: `${upstreamUrl}/v1`,
        FORECAST_BASE_URL: `${upstreamUrl}/v1`,
      }),
    );
    const listener = keyed.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => listener.once('listening', () => resolve()));
    const { port } = listener.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    const body = (await response.json()) as { model: string };
    await new Promise<void>((resolve) => listener.close(() => resolve()));

    expect(body.model).toBe('groq:qwen/qwen3.8-27b');
  });

  it('sends security headers and hides the framework', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-powered-by')).toBeNull();
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });

  it('answers unknown API routes with JSON 404', async () => {
    const response = await fetch(`${baseUrl}/api/does-not-exist`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });
});

describe('GET /api/locations', () => {
  it('proxies the geocoder and normalises the results', async () => {
    const response = await fetch(`${baseUrl}/api/locations?q=Delhi`);
    const body = (await response.json()) as {
      results: { name: string; country: string; latitude: number }[];
    };

    expect(response.status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.results[0]?.name).toBe('Delhi');
    expect(body.results[0]?.country).toBe('India');
    expect(body.results[0]?.latitude).toBeCloseTo(28.6139, 3);
  });

  it('rejects a query that is too short without calling upstream', async () => {
    const response = await fetch(`${baseUrl}/api/locations?q=D`);
    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty('error');
  });
});

describe('GET /api/air-quality', () => {
  it('converts an upstream observation into an EPA reading', async () => {
    const response = await fetch(`${baseUrl}/api/air-quality?${VALID_AIR_QUERY}`);
    const body = (await response.json()) as {
      reading: { aqi: number; dominant: string; pm25: number; readings: unknown[]; source: string };
      forecast: { hours: unknown[]; weather: { windSpeedKmh: number } };
      source: string;
    };

    expect(response.status).toBe(200);
    expect(body.reading.aqi).toBeGreaterThan(50);
    expect(body.reading.dominant).toBe('pm25');
    expect(body.reading.pm25).toBeCloseTo(120.4, 2);
    expect(body.reading.readings.length).toBeGreaterThanOrEqual(4);
    expect(body.forecast.hours).toHaveLength(24);
    expect(body.forecast.weather.windSpeedKmh).toBe(4);
    expect(body.source).toBe('live');
  });

  it('serves the second request from cache', async () => {
    const response = await fetch(`${baseUrl}/api/air-quality?${VALID_AIR_QUERY}`);
    const body = (await response.json()) as { source: string };
    expect(response.status).toBe(200);
    expect(body.source).toBe('cache');
  });

  it('rejects missing coordinates', async () => {
    const response = await fetch(`${baseUrl}/api/air-quality?name=Delhi`);
    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty('error');
  });

  it('rejects out-of-range coordinates', async () => {
    const response = await fetch(`${baseUrl}/api/air-quality?lat=999&lon=0`);
    expect(response.status).toBe(400);
  });
});

describe('POST /api/plan', () => {
  const validBody = {
    profile: makeProfile(),
    currentAqi: 185,
    hours: Array.from({ length: 24 }, (_, hour) => ({ hour, aqi: 60 + (hour % 60) })),
  };

  it('returns a complete plan even with no Gemini key', async () => {
    const response = await fetch(`${baseUrl}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    const body = (await response.json()) as {
      plan: { blocks: { time: string; impact: string }[]; generator: string };
      source: string;
    };

    expect(response.status).toBe(200);
    expect(body.plan.blocks.length).toBeGreaterThanOrEqual(4);
    expect(body.plan.blocks.every((block) => block.impact.length > 0)).toBe(true);
    expect(body.source).toBe('local');
    expect(body.plan.generator).toBe('local');
  });

  it('rejects a malformed body with field-level details', async () => {
    const response = await fetch(`${baseUrl}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: {}, currentAqi: 9999, hours: [] }),
    });
    const body = (await response.json()) as { error: string; details: string[] };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid plan request.');
    expect(body.details.length).toBeGreaterThan(0);
    expect(body.details.join(' ')).toContain('currentAqi');
  });

  it('rejects a non-JSON body', async () => {
    const response = await fetch(`${baseUrl}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  });
});

describe('POST /api/advisory', () => {
  it('returns an advisory with the local fallback active', async () => {
    const response = await fetch(`${baseUrl}/api/advisory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationName: 'Delhi', aqi: 210, language: 'en' }),
    });
    const body = (await response.json()) as { advisory: string; source: string };

    expect(response.status).toBe(200);
    expect(body.advisory.length).toBeGreaterThan(30);
    expect(body.source).toBe('local');
    expect(body.advisory).not.toContain('```');
  });

  it('rejects an unsupported language', async () => {
    const response = await fetch(`${baseUrl}/api/advisory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationName: 'Delhi', aqi: 210, language: 'klingon' }),
    });
    expect(response.status).toBe(400);
  });
});

describe('CORS allowlist', () => {
  it('permits an allowlisted origin', async () => {
    const { status, headers } = await rawRequest('/api/health', 'https://allowed.example');
    expect(status).toBe(200);
    expect(headers['access-control-allow-origin']).toBe('https://allowed.example');
  });

  it('omits CORS headers for every other origin', async () => {
    const { status, headers } = await rawRequest('/api/health', 'https://evil.example');
    expect(headers['access-control-allow-origin']).toBeUndefined();
    // The request itself still succeeds; only the CORS grant is withheld.
    expect(status).toBe(200);
  });

  it('leaves same-origin requests untouched', async () => {
    const { status, headers } = await rawRequest('/api/health');
    expect(status).toBe(200);
    expect(headers['access-control-allow-origin']).toBeUndefined();
  });
});
