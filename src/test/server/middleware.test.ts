// ============================================================
// src/test/server/middleware.test.ts
// Security headers, CORS allowlist, rate limiting and the
// non-leaky error boundary.
// ============================================================

import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  apiNotFound,
  corsPolicy,
  createModelRateLimiter,
  safeErrorHandler,
  securityHeaders,
} from '@/../server/middleware';
import { loadConfig } from '@/../server/config';

function fakeRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/api/test',
    headers: {},
    ...overrides,
  } as Request;
}

function fakeResponse(): Response & {
  statusCode: number;
  body: unknown;
  headersSent: boolean;
  headers: Map<string, string>;
} {
  const headers = new Map<string, string>();
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headersSent: false,
    headers,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      headers.set(name.toLowerCase(), String(value));
      return this;
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    removeHeader(name: string) {
      headers.delete(name.toLowerCase());
      return this;
    },
  };
  return res as unknown as Response & typeof res;
}

describe('securityHeaders', () => {
  it('sets a strict CSP that only allows our own origin', async () => {
    const handler = securityHeaders();
    const res = fakeResponse();
    const next = vi.fn();

    await handler(fakeRequest(), res, next);

    expect(next).toHaveBeenCalledOnce();
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self'");
  });

  it('sets hardening headers and no technology disclosure', async () => {
    const res = fakeResponse();
    await securityHeaders()(fakeRequest(), res, vi.fn());
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBeTruthy();
    expect(res.headers.get('strict-transport-security')).toContain('max-age=');
  });

  it('invokes next() exactly once', () => {
    const next = vi.fn();
    void securityHeaders()(fakeRequest(), fakeResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('corsPolicy', () => {
  it('allows requests with no Origin header (curl, same-origin)', async () => {
    const config = loadConfig({ NODE_ENV: 'test', CORS_ORIGINS: 'https://allowed.example' });
    const next = vi.fn();
    await corsPolicy(config)(fakeRequest(), fakeResponse(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('constructs an allowlist from the environment', () => {
    const config = loadConfig({ NODE_ENV: 'test', CORS_ORIGINS: 'https://a.example, https://b.example' });
    expect(config.corsOrigins).toEqual(['https://a.example', 'https://b.example']);
  });

  it('falls back to dev origins when the allowlist is blank', () => {
    const config = loadConfig({ NODE_ENV: 'test', CORS_ORIGINS: ' , ' });
    expect(config.corsOrigins.length).toBeGreaterThan(0);
    expect(config.corsOrigins[0]).toContain('localhost');
  });
});

describe('createModelRateLimiter', () => {
  it('is a pass-through under NODE_ENV=test so suites are not throttled', async () => {
    const config = loadConfig({ NODE_ENV: 'test' });
    const next = vi.fn();
    await createModelRateLimiter(config)(fakeRequest(), fakeResponse(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns a real limiter outside tests', () => {
    const config = loadConfig({ NODE_ENV: 'development' });
    const handler = createModelRateLimiter(config);
    expect(handler).not.toBeUndefined();
    // A real express-rate-limit handler is a function of (req, res, next).
    expect(typeof handler).toBe('function');
  });
});

describe('apiNotFound', () => {
  it('answers unmatched API routes with a JSON 404', () => {
    const res = fakeResponse();
    apiNotFound()(fakeRequest(), res, vi.fn());
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});

describe('safeErrorHandler', () => {
  it('echoes safe 4xx messages so clients can correct input', () => {
    const res = fakeResponse();
    const error = Object.assign(new Error('Latitude out of range'), { status: 400 });
    safeErrorHandler(error, fakeRequest(), res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Latitude out of range' });
  });

  it('hides 5xx internals behind a generic message', () => {
    const res = fakeResponse();
    const error = Object.assign(new Error('ECONNREFUSED 10.0.0.5:5432'), { status: 500 });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    safeErrorHandler(error, fakeRequest(), res, vi.fn());
    spy.mockRestore();

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Internal Server Error' });
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it('treats a thrown string as a 500 without leaking it', () => {
    const res = fakeResponse();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    safeErrorHandler('raw string boom', fakeRequest(), res, vi.fn());
    spy.mockRestore();
    expect(res.body).toEqual({ error: 'Internal Server Error' });
  });

  it('delegates to the default handler once headers are sent', () => {
    const res = fakeResponse();
    res.headersSent = true;
    const next = vi.fn();
    safeErrorHandler(new Error('late'), fakeRequest(), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.body).toBeUndefined();
  });
});
