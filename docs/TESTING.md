# Testing

**Project:** BreatheNest — GenAI Urban Air Quality Assistant
**Gate:** `npx vitest run` → **18 files, 293 tests, 0 failures** · coverage **94.02% stmts / 86.92% branch / 96.93% funcs / 95.73% lines** (thresholds 85/80/85/85, enforced in `vite.config.ts`)

---

## 1. What the suite is for

A test suite earns its place when it catches the failures that actually happen to this app. Four
categories of real failure are covered here:

1. **A wrong number.** AQI interpolation, inhaled dose, clearance time, CO₂ totals — a silently
   wrong formula produces a confidently wrong health recommendation. These are the highest-value
   tests in the repo and they live in `src/test/compute/`.
2. **A hostile or malformed input.** Every request the gateway accepts is Zod-validated; 24 tests
   prove each rejection before any handler runs.
3. **A degraded world.** No network, no API key, corrupted `localStorage`, a slow upstream, a
   model reply (Gemini or Groq) with garbage in it. The app must still render something complete
   and labelled.
4. **A broken promise to the user.** Colour-only signals, missing text twins, an unlabelled
   loading state — the accessibility contract is tested, not just documented.

## 2. Layout

```
src/test/
├── fixtures.ts            makeBundle/makeAirResponse/makeProfile, stubFetch, seedProfile
├── setup.ts               jest-dom matchers, cleanup, unstubAllGlobals, scrollTo stub
├── compute/               7 files · 115 tests — pure domain logic
├── server/                5 files ·  91 tests — schemas, middleware, cache, providers, HTTP
├── render/                3 files ·  53 tests — jsdom component + journey tests
├── api.test.ts                   11 tests — typed fetch client
├── storage.test.ts               13 tests — defensive persistence
└── planner.test.ts               10 tests — deterministic fallback plan
```

### Per-suite inventory

| File | Tests | What it pins down |
| --- | --- | --- |
| `compute/guards.test.ts` | 15 | finiteness, ranges, rounding, aggregation invariants |
| `compute/aqi.test.ts` | 25 | EPA breakpoints at their published values (12→50, 12.1→51, 35.4→100), band edges, worst-pollutant rule, reverse lookup |
| `compute/windows.test.ts` | 15 | cleanest/dirtiest slot search, end-exclusive slots, peak-based risk, day statistics |
| `compute/exposure.test.ts` | 14 | inhaled-dose model, protection factors, indoor penetration ratios |
| `compute/indoor.test.ts` | 17 | room volume, CADR sizing, single-compartment clearance decay, vent scheduler |
| `compute/impact.test.ts` | 15 | CO₂ aggregation, relatable equivalents, community annualisation |
| `compute/forecast.test.ts` | 14 | stagnation/inversion heuristic, smoothing, diurnal amplitude |
| `planner.test.ts` | 10 | fallback plan always complete, chronological, quantified |
| `storage.test.ts` | 13 | corrupted JSON, missing keys, denied/quota'd `localStorage`, whitelisted enums |
| `api.test.ts` | 11 | uniform `ApiError`, timeouts, query construction |
| `server/cache.test.ts` | 12 | TTL expiry, LRU eviction, hash-key stability |
| `server/ai.test.ts` | 23 | provider selection (Gemini/Groq/local), Groq request shape, forecast grounding of every model number, all fallback routes, config parsing |
| `server/schemas.test.ts` | 24 | every malformed request rejected with a field-level `details` |
| `server/middleware.test.ts` | 13 | security headers, CORS allowlist, rate limiter, non-leaky 500s |
| `server/app.test.ts` | 19 | end-to-end HTTP against the real Express app, upstream stubbed |
| `render/shell.test.tsx` | 18 | landmarks, tablist keyboard support, i18n + RTL, location controls, degraded-data notice |
| `render/air.test.tsx` | 16 | gauge text twin, household guidance, stagnation reasoning, forecast SR list, pollutants |
| `render/flows.test.tsx` | 19 | routine generation (Gemini, Groq **and** fallback), swaps→impact journey, pledges, indoor calculator |

## 3. How the hard things are tested

**Real HTTP, stubbed upstream.** `server/app.test.ts` does not mock Express — it starts the
actual app on an ephemeral port and issues real requests (including one raw `http.request` to
observe the `Origin` header, because `fetch` normalises it). Only the *upstream provider* is
stubbed, so routing, validation, headers, caching and the error boundary are exercised together.

**The degraded paths are first-class tests.**

- `server/app.test.ts` boots with `GEMINI_API_KEY: ''` — proving the app is complete with no key —
  and `/api/health` names the engine that *would* answer (`groq:qwen/qwen3.8-27b` when keyed,
  `local-fallback` when not), so an operator can tell a live model from a silent fallback.
- `storage.test.ts` replaces `window.localStorage` with a throwing object — proving private mode
  cannot crash the UI.
- `stubFetch` lets a route handler *reject*, simulating an offline gateway; the assertion is that
  the labelled sample reading appears and the live-region notice fires.
- Model output tests feed deliberately malformed JSON (code fences, missing fields, `risk`
  lying about the AQI) and assert the deterministic plan is served instead — for the Groq route
  they also assert the outbound request itself: endpoint, bearer header, model id and temperature
  (`server/ai.test.ts`).

**Fixtures are hand-built, not recorded.** `makeBundle()` plants a deliberate clean midday and a
deliberate dirty dawn, so window-finding assertions are exact (`13:00–15:00`, average AQI 68)
instead of "whatever the data said that day". `seedProfile()` writes a profile into
`localStorage` before render so household-specific copy (a sensitive member, a driver-only swap)
is exercised exactly as a returning user would see it.

**Journeys, not just units.** `flows.test.tsx` clicks through the promises the UI makes: select a
swap → open Impact → see the ledger total; ask for a generated plan → see `GenAI plan (Gemini)`
or `GenAI plan (Groq)`;
kill the gateway → see the fallback plan with its badge. A unit test cannot catch a tab that
forwards the wrong prop; these do.

**Accessibility is asserted, not assumed.** `shell.test.tsx` drives the tablist with
`userEvent.keyboard('{ArrowRight}')` and asserts focus follows; it queries the AQI dial by its
accessible role and reads the number out of the text twin, not the SVG; it flips the language
picker and asserts `document.documentElement.lang` and `dir` changed.

## 4. Coverage policy

Coverage is scoped to the code where a wrong answer matters — `src/lib/**` and
`src/services/**` — with thresholds that fail the run:

```ts
thresholds: { statements: 85, branches: 80, functions: 85, lines: 85 }
```

Current: **94.02 / 86.92 / 96.93 / 95.73**. The gap is honest and mostly in `format.ts`
(currency/date formatting branches) and a handful of defensive `default` arms. UI components are
covered by journey tests but are outside the coverage scope — their value is in behaviour, not
line count.

## 5. The gate

```bash
npm run verify
# eslint . --max-warnings 0 → tsc --noEmit → vitest run → vite build
```

CI runs exactly this (`.github/workflows/ci.yml`) on every push. There is no "works on my
machine" branch: lint warnings, type errors, a single failing test, or a build break all fail the
pipeline identically.

## 6. Known limits, stated plainly

- **No visual-regression screenshots.** The design system is small and token-driven; a reviewer
  should eyeball `npm run dev` once. The accessibility contract *is* machine-checked; the
  aesthetics are not.
- **No load/soak test on the gateway.** The rate limiter and cache bounds are unit-tested, but
  sustained-traffic behaviour is reasoned about, not measured. Acceptable for a read-only public
  assistant with no database.
- **Neither Gemini nor Groq is asserted for prose quality.** We test that its output is *validated,
  bounded and reconciled* — that it cannot break the UI. Whether it writes better prose than the
  local planner is not a claim this suite makes.
