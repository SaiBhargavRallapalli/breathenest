# BreatheNest

**A GenAI urban air-quality assistant that turns a number into a day you can actually live.**

BreatheNest reads your city's live air, works out when the air is safe to breathe, and hands you a
low-emission routine for *today* — what to do at 07:00, which window to open, what to cook with, and
what each choice costs or saves in CO₂, inhaled PM2.5 and money. It is built for households in
polluted cities who want advice they can act on before they leave the door, not a dashboard they
have to interpret.

> **BreatheNest is decision support, not medical advice.** Air-quality values come from the
> Open-Meteo public API and follow US EPA breakpoints.

---

## What it does

| Tab | Question it answers |
| --- | --- |
| **Air now** | What is the AQI where I am, what is driving it, will it stagnate today? |
| **My day** | *Given* that forecast, what is my hour-by-hour plan, and what does each block change? |
| **Home air** | How clean is my room, when should I ventilate, and what should I build or buy? |
| **Better swaps** | Which low-emission alternatives fit *my* household, and what is each one worth per year? |
| **Impact** | If I actually keep those swaps, what is my annual CO₂, exposure and money ledger? |
| **Community** | If my street took the same pledges, what would we avoid together? |

Every recommendation carries a **Direct impact** line that quantifies the change in
micrograms inhaled, percent reduction, kilograms of CO₂ or currency per year. A plan that says
"improve air quality" is not an answer.

### An example day (generated, then verified)

```
06:30  Wake indoors            Direct impact: avoids ~140 µg inhaled before breakfast
08:00  Leave by metro           Direct impact: cuts the trip dose by ~60% versus walking
13:00  Outdoor window (AQI 68)  Direct impact: cuts inhaled particles ~70% vs 07:00
19:00  Close up before peak     Direct impact: keeps ~55 µg of evening exposure outdoors
21:30  Filter the bedroom       Direct impact: clears ~80% of bedroom particles in 30 min
```

## Two engines, one shape of answer

BreatheNest has a **deterministic local planner** and a **GenAI generator** (Google Gemini or Groq — whichever key you supply), and it is designed so the app is complete with either:

1. **Local planner** (`src/lib/planner.ts`) — a pure function of the household profile and the
   24-hour forecast. It searches for the cleanest slot, prices every block in inhaled PM2.5, and
   always returns a complete, chronologically ordered plan. It needs no network, no key, no config.
2. **GenAI generator** (`server/ai.ts`) — chooses the timing and rewrites the plan with
   household-specific language through Gemini *or* Groq (`GENAI_PROVIDER=auto` tries Gemini, then
   Groq). The output is **re-validated field by field** before it is shown: every `windowAqi` is
   replaced by the forecast's value for that hour, `risk` is recomputed from it, the
   outdoor-window verdict stays the planner's, and any block that cannot be grounded in the
   forecast is discarded — malformed output falls back to the local planner's answer.

   The model therefore writes *when* and *how*, never *what the data says*.

The UI always states which engine produced the plan (`Local planner`, `GenAI plan (Gemini)` or
`GenAI plan (Groq)`) and whether a fallback was taken. There is no path in which the user sees an empty or broken plan.

## Live data with a labelled fallback

- Air quality, geocoding and weather come from **Open-Meteo** (key-free), proxied through the
  Express gateway so the browser never talks to third parties directly.
- The gateway caches upstream responses with a **TTL + LRU cache**, so a page refresh does not
  re-hammer the provider.
- If the network or the gateway is unavailable, a **bundled sample reading** is shown and the UI
  says `Sample readings shown` in a live region. Degraded data is never passed off as live data.

## Quick start

```bash
npm install --legacy-peer-deps
npm run dev          # API on :3001 + Vite on :5173
```

Open <http://localhost:5173>. **No API key is required** — everything works out of the box.

Optional GenAI:

```bash
cp .env.example .env        # then set GEMINI_API_KEY=... or GROQ_API_KEY=...
npm run dev
```

### Scripts

| Script | What it runs |
| --- | --- |
| `npm run dev` | Gateway + Vite dev server together |
| `npm run verify` | lint → typecheck → tests → build (the gate CI runs) |
| `npm run test:coverage` | Vitest with v8 coverage thresholds |
| `npm run server` | Gateway only (production-style) |
| `npm run build` | Type-check then bundle to `dist/` |

## Architecture

```
React 19 (TS strict)                 Express 5 gateway
┌──────────────────────┐             ┌──────────────────────────────┐
│ AppShell / tablist    │  fetch      │ Zod request validation        │
│  6 panels             │ ─────────► │  → TTL+LRU cache              │
│ AppContext (one store)│  /api/*     │  → Open-Meteo proxy           │
│ lib/compute (pure)    │             │  → Gemini/Groq (validated)    │
│ lib/planner (pure)    │             │  → helmet/CORS/rate-limit     │
└──────────────────────┘             └──────────────────────────────┘
```

- **`src/lib/` is pure and heavily tested** — AQI interpolation, exposure dose, indoor clearance
  decay, stagnation scoring, impact aggregation. No I/O, no React, no globals.
- **`src/services/`** is the only browser I/O boundary: a typed `fetch` client and defensive
  `localStorage` persistence.
- **`server/`** validates everything with Zod before any business logic runs, and its error
  handler never leaks internals to clients.

## Quality gates

```bash
npm run verify   # eslint --max-warnings 0 → tsc --noEmit → vitest run → vite build
```

| Gate | Result |
| --- | --- |
| ESLint 10 (flat, typescript-eslint) | 0 errors, 0 warnings |
| TypeScript 5.9 (`strict`, `noUncheckedIndexedAccess`) | 0 errors |
| Tests (Vitest 4, jsdom + real HTTP) | **293 / 293 passing** |
| Coverage (`src/lib/**`, `src/services/**`) | 94.0% stmts · 86.9% branch · 96.9% funcs · 95.7% lines |
| Build | 308 kB app (94 kB gzip) + 12 kB vendor (4 kB gzip) |

Pillar-by-pillar evidence lives in [`docs/`](docs/):

- [CODE_QUALITY.md](docs/CODE_QUALITY.md) · [SECURITY.md](docs/SECURITY.md) ·
  [EFFICIENCY.md](docs/EFFICIENCY.md) · [TESTING.md](docs/TESTING.md) ·
  [ACCESSIBILITY.md](docs/ACCESSIBILITY.md) · [PROBLEM_ALIGNMENT.md](docs/PROBLEM_ALIGNMENT.md)
- [DECISIONS.md](docs/DECISIONS.md) (ADRs) · [PLAN.md](docs/PLAN.md)

## Accessibility

Four-language UI (English, Hindi, Arabic, Spanish) with full RTL, a single-`<h1>` document outline, ARIA tablist with
arrow/Home/End keyboard support, skip link, and **a screen-reader twin for every visual**: the AQI
dial, the 24-hour column chart and the sparklines all have text equivalents. Colour is never the
only signal — every band, risk level and "main pollutant" flag is stated in words.

## License

[MIT](LICENSE)
