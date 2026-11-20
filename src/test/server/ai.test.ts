// ============================================================
// src/test/server/ai.test.ts
// Generative provider selection and the Groq completion path:
// which backend gets called, what the outbound request looks
// like, and every route back to the deterministic planner.
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateAdvisory, generatePlan, resolveEngine } from '@/../server/ai';
import { loadConfig, type ServerConfig } from '@/../server/config';
import { TtlCache } from '@/../server/cache';
import type { DailyPlan } from '@/types';
import type { AdvisoryRequest, PlanRequest } from '@/../server/schemas';
import { makeProfile } from '../fixtures';

/** Builds a config from an injectable environment bag (no real .env). */
function configWith(env: Record<string, string>): ServerConfig {
  return loadConfig({ NODE_ENV: 'test', ...env });
}

function planRequest(): PlanRequest {
  return {
    // `makeProfile()` builds the readonly app-side shape; Zod's parsed
    // output is mutable, so the two only meet through a cast.
    profile: makeProfile() as unknown as PlanRequest['profile'],
    currentAqi: 185,
    hours: Array.from({ length: 24 }, (_, hour) => ({ hour, aqi: 60 + (hour % 60) })),
  };
}

function newPlanCache(): TtlCache<DailyPlan> {
  return new TtlCache<DailyPlan>(50, 60_000);
}

const PLAN_CONTENT = JSON.stringify({
  summary: 'Groq wrote this household-specific summary.',
  blocks: [
    { time: '06:30', title: 'Wake indoors', detail: 'Windows shut through dawn.', windowAqi: 176, risk: 'avoid', impact: 'Keeps ~140 µg out of the morning dose.' },
    { time: '08:00', title: 'Leave by metro', detail: 'Sealed carriage beats the kerb.', windowAqi: 176, risk: 'avoid', impact: 'Cuts the trip dose by about 60%.' },
    { time: '13:00', title: 'Outdoor window', detail: 'Best slot of the day.', windowAqi: 68, risk: 'acceptable', impact: 'Cuts inhaled particles by ~70%.' },
    { time: '19:00', title: 'Close up', detail: 'Evening peak builds.', windowAqi: 198, risk: 'avoid', impact: 'Keeps ~55 µg outdoors.' },
    { time: '21:30', title: 'Filter the bedroom', detail: 'Run the purifier first.', windowAqi: 194, risk: 'avoid', impact: 'Clears ~80% in 30 minutes.' },
  ],
});

/** A successful Groq-shaped chat-completion body. */
function groqOk(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ index: 0, message: { role: 'assistant', content } }] }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveEngine', () => {
  it('resolves to null with no keys configured', () => {
    expect(resolveEngine(configWith({}))).toBeNull();
  });

  it('prefers Gemini when both backends are keyed (auto)', () => {
    const config = configWith({ GEMINI_API_KEY: 'g-key', GROQ_API_KEY: 'x-key' });
    expect(resolveEngine(config)).toBe('gemini');
  });

  it('falls back to Groq when only Groq is keyed (auto)', () => {
    const config = configWith({ GROQ_API_KEY: 'x-key' });
    expect(resolveEngine(config)).toBe('groq');
  });

  it('honours an explicit Groq selection', () => {
    const config = configWith({ GENAI_PROVIDER: 'groq', GROQ_API_KEY: 'x-key' });
    expect(resolveEngine(config)).toBe('groq');
  });

  it('resolves an explicit selection with no key to null, not an error', () => {
    expect(resolveEngine(configWith({ GENAI_PROVIDER: 'groq' }))).toBeNull();
    expect(resolveEngine(configWith({ GENAI_PROVIDER: 'gemini' }))).toBeNull();
  });

  it('never calls out when local is forced, even with keys present', () => {
    const config = configWith({ GENAI_PROVIDER: 'local', GROQ_API_KEY: 'x-key', GEMINI_API_KEY: 'g-key' });
    expect(resolveEngine(config)).toBeNull();
  });
});

describe('generatePlan — Groq path', () => {
  it('calls the chat-completions endpoint and returns a Groq-attributed plan', async () => {
    const fetchMock = vi.fn(async (_input: unknown, _init?: unknown) => groqOk(PLAN_CONTENT));
    vi.stubGlobal('fetch', fetchMock);

    const { plan, source } = await generatePlan(
      planRequest(),
      configWith({ GROQ_API_KEY: 'groq-test-key' }),
      newPlanCache(),
    );

    expect(source).toBe('groq');
    expect(plan.generator).toBe('groq');
    expect(plan.summary).toBe('Groq wrote this household-specific summary.');
    expect(plan.blocks).toHaveLength(5);
    expect(plan.blocks.every((block) => block.impact.length > 0)).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; body: string; signal: AbortSignal },
    ];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer groq-test-key');
    expect(init.headers['content-type']).toBe('application/json');
    // Cloudflare in front of Groq answers 1010 to a blank/blacklisted UA.
    expect(init.headers['user-agent']).toBe('BreatheNest/1.0');
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body.model).toBe('qwen/qwen3.8-27b');
    expect(body.temperature).toBe(0.4);
    expect(Array.isArray(body.messages)).toBe(true);
  });

  it('serves the local plan when the upstream answers with an error status', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 429, json: async () => ({ error: 'quota' }) })),
    );

    const { plan, source } = await generatePlan(
      planRequest(),
      configWith({ GROQ_API_KEY: 'groq-test-key' }),
      newPlanCache(),
    );

    expect(source).toBe('local');
    expect(plan.generator).toBe('local');
    expect(plan.blocks.length).toBeGreaterThanOrEqual(4);
  });

  it('discards a reply that is not valid JSON', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => groqOk('Sorry, here are some thoughts instead.')));

    const { plan, source } = await generatePlan(
      planRequest(),
      configWith({ GROQ_API_KEY: 'groq-test-key' }),
      newPlanCache(),
    );

    expect(source).toBe('local');
    expect(plan.generator).toBe('local');
  });

  it('reuses the cached plan instead of calling the model twice', async () => {
    const fetchMock = vi.fn(async () => groqOk(PLAN_CONTENT));
    vi.stubGlobal('fetch', fetchMock);
    const config = configWith({ GROQ_API_KEY: 'groq-test-key' });
    const cache = newPlanCache();

    await generatePlan(planRequest(), config, cache);
    const second = await generatePlan(planRequest(), config, cache);

    expect(second.source).toBe('groq');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never touches the network when no key is configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { source } = await generatePlan(planRequest(), configWith({}), newPlanCache());

    expect(source).toBe('local');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('generateAdvisory — Groq path', () => {
  const request: AdvisoryRequest = {
    locationName: 'Delhi',
    aqi: 185,
    language: 'en',
    members: [],
  };

  it('returns the model text and attributes it to Groq', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => groqOk('Air quality is unhealthy. Keep windows shut and run filtration.')),
    );

    const { advisory, source } = await generateAdvisory(
      request,
      configWith({ GROQ_API_KEY: 'groq-test-key' }),
      new TtlCache<string>(20, 60_000),
    );

    expect(source).toBe('groq');
    expect(advisory).toContain('Keep windows shut');
  });

  it('falls back when the reply is implausibly long', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => groqOk('word '.repeat(500))));

    const { advisory, source } = await generateAdvisory(
      request,
      configWith({ GROQ_API_KEY: 'groq-test-key' }),
      new TtlCache<string>(20, 60_000),
    );

    expect(source).toBe('local');
    expect(advisory).toContain('Delhi');
  });

  it('falls back when the model call rejects', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));

    const { source } = await generateAdvisory(
      request,
      configWith({ GROQ_API_KEY: 'groq-test-key' }),
      new TtlCache<string>(20, 60_000),
    );

    expect(source).toBe('local');
  });
});

describe('loadConfig — Groq settings', () => {
  it('reads the key, model and base URL from the environment', () => {
    const config = configWith({
      GROQ_API_KEY: '  groq-secret  ',
      GROQ_MODEL: 'llama-3.3-70b-versatile',
      GROQ_BASE_URL: 'https://proxy.example/groq/v1',
    });

    expect(config.groqApiKey).toBe('groq-secret');
    expect(config.groqModel).toBe('llama-3.3-70b-versatile');
    expect(config.groqBaseUrl).toBe('https://proxy.example/groq/v1');
  });

  it('defaults to qwen/qwen3.8-27b on the public endpoint with no key', () => {
    const config = configWith({});

    expect(config.groqApiKey).toBeNull();
    expect(config.groqModel).toBe('qwen/qwen3.8-27b');
    expect(config.groqBaseUrl).toBe('https://api.groq.com/openai/v1');
    expect(config.genaiProvider).toBe('auto');
  });

  it('rejects an unknown GENAI_PROVIDER instead of guessing', () => {
    expect(() => configWith({ GENAI_PROVIDER: 'openai' })).toThrow(RangeError);
  });

  it('accepts each documented provider value', () => {
    for (const provider of ['auto', 'gemini', 'groq', 'local']) {
      expect(configWith({ GENAI_PROVIDER: provider }).genaiProvider).toBe(provider);
    }
  });
});
