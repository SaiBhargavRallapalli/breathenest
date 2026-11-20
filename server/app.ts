// ============================================================
// server/app.ts
// Express 5 application factory. Exporting a factory (rather than a
// singleton) lets the test suite spin up an isolated instance on an
// ephemeral port with its own caches and rate-limit counters.
// ============================================================

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DailyPlan } from '../src/types';
import { loadConfig, type ServerConfig } from './config';
import { TtlCache, hashPayload } from './cache';
import {
  apiNotFound,
  corsPolicy,
  createModelRateLimiter,
  safeErrorHandler,
  securityHeaders,
} from './middleware';
import { fetchAirPayload, searchLocations, type AirPayload, type GeoResult } from './airQuality';
import { generateAdvisory, generatePlan, resolveEngine } from './ai';
import {
  advisoryRequestSchema,
  airQualityQuerySchema,
  locationQuerySchema,
  planRequestSchema,
} from './schemas';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');

/** Everything the app needs, so tests can inject their own config. */
export interface AppHandles {
  readonly airCache: TtlCache<AirPayload>;
  readonly geoCache: TtlCache<GeoResult[]>;
  readonly planCache: TtlCache<DailyPlan>;
  readonly advisoryCache: TtlCache<string>;
  readonly hashPayload: typeof hashPayload;
}

export function createApp(config: ServerConfig = loadConfig()): express.Express & AppHandles {
  const app = express();
  const airCache = new TtlCache<AirPayload>(120, config.upstreamTtlMs);
  const geoCache = new TtlCache<GeoResult[]>(80, config.upstreamTtlMs);
  const planCache = new TtlCache<DailyPlan>(150, config.upstreamTtlMs);
  const advisoryCache = new TtlCache<string>(150, config.upstreamTtlMs);
  const modelLimiter = createModelRateLimiter(config);

  app.disable('x-powered-by');
  app.use(securityHeaders());
  app.use(corsPolicy(config));
  app.use(express.json({ limit: '16kb' }));

  // --- Health ---------------------------------------------------
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: Date.now(),
      caches: {
        air: airCache.size,
        geo: geoCache.size,
        plan: planCache.size,
        advisory: advisoryCache.size,
      },
      // Names the engine that would actually answer this request, so a
      // keyed Groq (or Gemini) is not mistaken for a dead local fallback.
      model: (() => {
        const engine = resolveEngine(config);
        if (engine === 'gemini') return `gemini:${config.geminiModel}`;
        if (engine === 'groq') return `groq:${config.groqModel}`;
        return 'local-fallback';
      })(),
    });
  });

  // --- Location search ------------------------------------------
  app.get('/api/locations', async (req, res) => {
    const parsed = locationQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Query must be a city name of 2 to 80 characters.' });
      return;
    }
    const results = await searchLocations(parsed.data.q, config, geoCache);
    res.status(200).json({ results });
  });

  // --- Live air quality -----------------------------------------
  app.get('/api/air-quality', async (req, res) => {
    const parsed = airQualityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Latitude and longitude are required and must be in range.' });
      return;
    }
    const { lat, lon, name, region, country, id } = parsed.data;
    const { payload, source } = await fetchAirPayload(
      {
        id,
        name: name || 'Selected location',
        region: region || '',
        country: country || '',
        latitude: lat,
        longitude: lon,
      },
      config,
      airCache,
    );
    res.status(200).json({ ...payload, source });
  });

  // --- GenAI daily plan -----------------------------------------
  app.post('/api/plan', modelLimiter, async (req, res) => {
    const parsed = planRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid plan request.',
        details: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      });
      return;
    }
    const { plan, source } = await generatePlan(parsed.data, config, planCache);
    res.status(200).json({ plan, source });
  });

  // --- GenAI community advisory ---------------------------------
  app.post('/api/advisory', modelLimiter, async (req, res) => {
    const parsed = advisoryRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid advisory request.' });
      return;
    }
    const { advisory, source } = await generateAdvisory(parsed.data, config, advisoryCache);
    res.status(200).json({ advisory, source });
  });

  // Unmatched API routes get JSON, not an HTML error page.
  app.use('/api', apiNotFound());

  // --- Static SPA -----------------------------------------------
  app.use(express.static(DIST_DIR));
  app.get('*splat', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }
    res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
      if (err) {
        res
          .status(200)
          .send('BreatheNest API is running. Build the frontend with `npm run build`.');
      }
    });
  });

  app.use(safeErrorHandler);

  return Object.assign(app, { airCache, geoCache, planCache, advisoryCache, hashPayload });
}
