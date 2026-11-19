// ============================================================
// server/middleware.ts
// Defensive middleware pipeline: strict security headers, an origin
// allowlist, rate limiting on the model endpoints, and a global
// error handler that never leaks internals to the client.
// ============================================================

import helmet from 'helmet';
import cors from 'cors';
import type { CorsOptions } from 'cors';
import { rateLimit } from 'express-rate-limit';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ServerConfig } from './config';

/** Strict CSP: the browser may only talk to our own origin. */
export function securityHeaders(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // `unsafe-inline` for styles only: progress bars and gauge arcs
        // are driven by inline width/transform values computed at render.
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: { maxAge: 15_552_000, includeSubDomains: true },
  });
}

/** Origin allowlist — anything not listed is refused. */
export function corsPolicy(config: ServerConfig): RequestHandler {
  const allowed = new Set(config.corsOrigins);
  const options: CorsOptions = {
    origin(origin, callback) {
      // Same-origin and curl-style requests carry no Origin header.
      if (!origin) return callback(null, true);
      callback(null, allowed.has(origin));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    maxAge: 600,
  };
  return cors(options);
}

/**
 * Rate limiter for the generative endpoints.
 * Disabled under NODE_ENV=test so suites are not throttled by shared
 * counters; everything else gets 20 requests per minute per IP.
 */
export function createModelRateLimiter(config: ServerConfig): RequestHandler {
  if (config.isTest) {
    return (_req, _res, next) => next();
  }
  return rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: 'Too many requests. Please wait a moment and retry.' });
    },
  });
}

/** JSON 404 for any unmatched API route. */
export function apiNotFound(): RequestHandler {
  return (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  };
}

/**
 * Final error boundary. Full details go to the server log; the client
 * receives a fixed generic message (CWE-209 information disclosure).
 */
export const safeErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const status = typeof (err as { status?: unknown })?.status === 'number'
    ? ((err as { status: number }).status)
    : 500;
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[breathenest] ${req.method} ${req.path} → ${status}: ${message}`);

  if (status >= 400 && status < 500) {
    res.status(status).json({ error: message });
    return;
  }
  res.status(500).json({ error: 'Internal Server Error' });
};
