// ============================================================
// src/test/server/ai.test.ts
// Generative provider selection and the Grok completion path:
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
  summary: 'Grok wrote this household-specific summary.',
  blocks: [
    { time: '06:30', title: 'Wake indoors', detail: 'Windows shut through dawn.', windowAqi: 176, risk: 'avoid', impact: 'Keeps ~140 µg out of the morning dose.' },
    { time: '08:00', title: 'Leave by metro', detail: 'Sealed carriage beats the kerb.', windowAqi: 176, risk: 'avoid', impact: 'Cuts the trip dose by about 60%.' },
    { time: '13:00', title: 'Outdoor window', detail: 'Best slot of the day.', windowAqi: 68, risk: 'acceptable', impact: 'Cuts inhaled particles by ~70%.' },
    { time: '19:00', title: 'Close up', detail: 'Evening peak builds.', windowAqi: 198, risk: 'avoid', impact: 'Keeps ~55 µg outdoors.' },
    { time: '21:30', title: 'Filter the bedroom', detail: 'Run the purifier first.', windowAqi: 194, risk: 'avoid', impact: 'Clears ~80% in 30 minutes.' },
  ],
});

/** A successful xAI-shaped chat-completion body. */
function grokOk(content: string) {
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
    const config = configWith({ GEMINI_API_KEY: 'g-key', GROK_API_KEY: 'x-key' });
    expect(resolveEngine(config)).toBe('gemini');
  });

  it('falls back to Grok when only Grok is keyed (auto)', () => {
    const config = configWith({ GROK_API_KEY: 'x-key' });
    expect(resolveEngine(config)).toBe('grok');
  });

  it('honours an explicit Grok selection', () => {
    const config = configWith({ GENAI_PROVIDER: 'grok', GROK_API_KEY: 'x-key' });
    expect(resolveEngine(config)).toBe('grok');
  });

  it('resolves an explicit selection with no key to null, not an error', () => {
    expect(resolveEngine(configWith({ GENAI_PROVIDER: 'grok' }))).toBeNull();
    expect(resolveEngine(configWith({ GENAI_PROVIDER: 'gemini' }))).toBeNull();
  });

  it('never calls out when local is forced, even with keys present', () => {
    const config = configWith({ GENAI_PROVIDER: 'local', GROK_API_KEY: 'x-key', GEMINI_API_KEY: 'g-key' });
    expect(resolveEngine(config)).toBeNull();
  });
});

describe('generatePlan — Grok path', () => {
  it('calls the chat-completions endpoint and returns a Grok-attributed plan', async () => {
    const fetchMock = vi.fn(async (_input: unknown, _init?: unknown) => grokOk(PLAN_CONTENT));
    vi.stubGlobal('fetch', fetchMock);

    const { plan, source } = await generatePlan(
      planRequest(),
      configWith({ GROK_API_KEY: 'xai-test-key' }),
      newPlanCache(),
    );

    expect(source).toBe('grok');
    expect(plan.generator).toBe('grok');
    expect(plan.summary).toBe('Grok wrote this household-specific summary.');
    expect(plan.blocks).toHaveLength(5);
    expect(plan.blocks.every((block) => block.impact.length > 0)).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; body: string; signal: AbortSignal },
    ];
    expect(url).toBe('https://api.x.ai/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer xai-test-key');
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body.model).toBe('grok-4.7');
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
      configWith({ GROK_API_KEY: 'xai-test-key' }),
      newPlanCache(),
    );

    expect(source).toBe('local');
    expect(plan.generator).toBe('local');
    expect(plan.blocks.length).toBeGreaterThanOrEqual(4);
  });

  it('discards a reply that is not valid JSON', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => grokOk('Sorry, here are some thoughts instead.')));

    const { plan, source } = await generatePlan(
      planRequest(),
      configWith({ GROK_API_KEY: 'xai-test-key' }),
      newPlanCache(),
    );

    expect(source).toBe('local');
    expect(plan.generator).toBe('local');
  });

  it('reuses the cached plan instead of calling the model twice', async () => {
    const fetchMock = vi.fn(async () => grokOk(PLAN_CONTENT));
    vi.stubGlobal('fetch', fetchMock);
    const config = configWith({ GROK_API_KEY: 'xai-test-key' });
    const cache = newPlanCache();

    await generatePlan(planRequest(), config, cache);
    const second = await generatePlan(planRequest(), config, cache);

    expect(second.source).toBe('grok');
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

describe('generateAdvisory — Grok path', () => {
  const request: AdvisoryRequest = {
    locationName: 'Delhi',
    aqi: 185,
    language: 'en',
    members: [],
  };

  it('returns the model text and attributes it to Grok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => grokOk('Air quality is unhealthy. Keep windows shut and run filtration.')),
    );

    const { advisory, source } = await generateAdvisory(
      request,
      configWith({ GROK_API_KEY: 'xai-test-key' }),
      new TtlCache<string>(20, 60_000),
    );

    expect(source).toBe('grok');
    expect(advisory).toContain('Keep windows shut');
  });

  it('falls back when the reply is implausibly long', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => grokOk('word '.repeat(500))));

    const { advisory, source } = await generateAdvisory(
      request,
      configWith({ GROK_API_KEY: 'xai-test-key' }),
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
      configWith({ GROK_API_KEY: 'xai-test-key' }),
      new TtlCache<string>(20, 60_000),
    );

    expect(source).toBe('local');
  });
});

describe('loadConfig — Grok settings', () => {
  it('reads the key, model and base URL from the environment', () => {
    const config = configWith({
      GROK_API_KEY: '  xai-secret  ',
      GROK_MODEL: 'grok-4.6',
      GROK_BASE_URL: 'https://proxy.example/xai/v1',
    });

    expect(config.grokApiKey).toBe('xai-secret');
    expect(config.grokModel).toBe('grok-4.6');
    expect(config.grokBaseUrl).toBe('https://proxy.example/xai/v1');
  });

  it('defaults to grok-4.7 on the public endpoint with no key', () => {
    const config = configWith({});

    expect(config.grokApiKey).toBeNull();
    expect(config.grokModel).toBe('grok-4.7');
    expect(config.grokBaseUrl).toBe('https://api.x.ai/v1');
    expect(config.genaiProvider).toBe('auto');
  });

  it('rejects an unknown GENAI_PROVIDER instead of guessing', () => {
    expect(() => configWith({ GENAI_PROVIDER: 'openai' })).toThrow(RangeError);
  });

  it('accepts each documented provider value', () => {
    for (const provider of ['auto', 'gemini', 'grok', 'local']) {
      expect(configWith({ GENAI_PROVIDER: provider }).genaiProvider).toBe(provider);
    }
  });
});
