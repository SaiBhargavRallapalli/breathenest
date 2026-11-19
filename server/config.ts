// ============================================================
// server/config.ts
// Environment parsing with safe defaults. Every value is coerced and
// range-checked at load time so a typo in `.env` fails loudly instead
// of producing a broken request at runtime.
// ============================================================

import dotenv from 'dotenv';

dotenv.config();

/** Which generative backend the gateway is allowed to reach for. */
export type GenAiProvider = 'auto' | 'gemini' | 'grok' | 'local';

export interface ServerConfig {
  readonly port: number;
  readonly nodeEnv: string;
  readonly isTest: boolean;
  readonly genaiProvider: GenAiProvider;
  readonly geminiApiKey: string | null;
  readonly geminiModel: string;
  readonly grokApiKey: string | null;
  readonly grokModel: string;
  readonly grokBaseUrl: string;
  readonly airQualityBaseUrl: string;
  readonly geocodingBaseUrl: string;
  readonly forecastBaseUrl: string;
  readonly upstreamTtlMs: number;
  readonly corsOrigins: readonly string[];
}

const DEFAULT_AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1';
const DEFAULT_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1';
const DEFAULT_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_GROK_MODEL = 'grok-4.7';
const DEFAULT_GROK_BASE_URL = 'https://api.x.ai/v1';

const GENAI_PROVIDERS: readonly GenAiProvider[] = ['auto', 'gemini', 'grok', 'local'];

const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001'];

/** Reads and validates one integer environment field. */
function readInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new RangeError(`Expected an integer between ${min} and ${max}, received "${raw}".`);
  }
  return parsed;
}

/** Splits a comma-separated origin list, dropping blanks. */
function readOrigins(raw: string | undefined): readonly string[] {
  if (!raw) return DEV_ORIGINS;
  const list = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return list.length > 0 ? list : DEV_ORIGINS;
}

/** Reads the generative-provider selector, failing loudly on a typo. */
function readProvider(raw: string | undefined): GenAiProvider {
  const value = (raw ?? '').trim().toLowerCase() || 'auto';
  if (!GENAI_PROVIDERS.includes(value as GenAiProvider)) {
    throw new RangeError(
      `GENAI_PROVIDER must be one of ${GENAI_PROVIDERS.join(', ')}, received "${raw}".`,
    );
  }
  return value as GenAiProvider;
}

/** Builds the config object from an injectable environment bag. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const ttlSeconds = readInt(env.UPSTREAM_CACHE_TTL_SECONDS, 600, 10, 86_400);

  return {
    port: readInt(env.PORT, 3001, 1, 65_535),
    nodeEnv: env.NODE_ENV ?? 'development',
    isTest: env.NODE_ENV === 'test',
    genaiProvider: readProvider(env.GENAI_PROVIDER),
    geminiApiKey: env.GEMINI_API_KEY?.trim() ? env.GEMINI_API_KEY.trim() : null,
    geminiModel: env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
    grokApiKey: env.GROK_API_KEY?.trim() ? env.GROK_API_KEY.trim() : null,
    grokModel: env.GROK_MODEL?.trim() || DEFAULT_GROK_MODEL,
    grokBaseUrl: env.GROK_BASE_URL?.trim() || DEFAULT_GROK_BASE_URL,
    airQualityBaseUrl: env.AIR_QUALITY_BASE_URL?.trim() || DEFAULT_AIR_QUALITY_URL,
    geocodingBaseUrl: env.GEOCODING_BASE_URL?.trim() || DEFAULT_GEOCODING_URL,
    forecastBaseUrl: env.FORECAST_BASE_URL?.trim() || DEFAULT_FORECAST_URL,
    upstreamTtlMs: ttlSeconds * 1000,
    corsOrigins: readOrigins(env.CORS_ORIGINS),
  };
}
