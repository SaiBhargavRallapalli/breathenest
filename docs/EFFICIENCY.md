# Efficiency

**Project:** BreatheNest — GenAI Urban Air Quality Assistant
**Measured on:** Node 22.16.0, macOS 16 GB, `npm run build` + `npm run test:coverage`

Efficiency here has three meanings, and all three are measured rather than asserted: the
browser ships little and does little work, the gateway talks upstream rarely and briefly, and the
test suite finishes fast enough that nobody is tempted to skip it.

---

## 1. What the user downloads

`npm run build` output (Vite 7.3, `tsc --noEmit && vite build`):

| Asset | Raw | Gzip | Notes |
| --- | --- | --- | --- |
| `assets/index-*.js` | 296.5 kB | **93.8 kB** | app code, tree-shaken |
| `assets/react-*.js` | 11.9 kB | **4.2 kB** | separate vendor chunk (cached independently) |
| `assets/index-*.css` | 23.7 kB | **5.5 kB** | Tailwind 4, only used utilities |
| `index.html` | 1.35 kB | 0.71 kB | |
| **First visit total** | **333 kB** | **≈104 kB** | |

Things that are *not* in the bundle: no charting library (the 24-hour strip is 40 lines of divs),
no date library (hours are integers 0–23), no i18n framework (a flat `Record` per language), no
CSS-in-Runtime (Tailwind compiles away). The one runtime dependency beyond React is the Gemini SDK,
and it is **server-only** — `server/ai.ts` is never reachable from `src/`. The Grok path adds no
dependency at all: it is one `fetch` to the OpenAI-compatible endpoint.

The vendor split exists so a React patch release does not invalidate the app chunk in a return
visitor's cache (`manualChunks: { react: ['react', 'react-dom'] }` in `vite.config.ts`).

## 2. What the browser computes

- **One fetch per data need.** `AppContext` owns the single air-quality bundle; panels read it from
  the store instead of each issuing their own request. Switching between the six tabs performs
  **zero** network calls — the tab switch is a state change over data already in memory.
- **Pure, memoised derivation.** Everything expensive is `useMemo` over the bundle: stagnation
  scoring, window search, impact aggregation. Recomputing on a language switch or a swap toggle is
  a scan over ≤24 hourly entries or ≤12 swap rows — microseconds.
- **No layout thrash.** Gauge arcs and meter widths are the only inline styles; they are
  render-computed, not measured in an effect (which is also why `set-state-in-effect` is lint-forbidden
  in this repo — see `docs/CODE_QUALITY.md` §4).
- **Loading states are derived, not stored.** Panels compare a `requestKey` against the data they
  hold; a mismatch renders the skeleton. No render→effect→setState→render loop exists by
  construction.

## 3. What the gateway does

The gateway exists so the browser makes **one** upstream call instead of three, and so upstream
responses are shared across users.

| Mechanism | Setting | Effect |
| --- | --- | --- |
| TTL + LRU cache (`server/cache.ts`) | `upstreamTtlMs` from config, capacity-bounded | A page refresh, a second tab, or another user in the same city reuses the response. `server/cache.test.ts` (12 tests) pins hit/eviction/expiry semantics. |
| Request coalescing key (`hashPayload`) | canonical query hash | Identical upstream queries map to one cache entry regardless of parameter order. |
| Upstream timeouts | `AbortSignal.timeout(REQUEST_TIMEOUT_MS)` on every Open-Meteo call | A hung provider cannot hold sockets or event-loop promises open. |
| Browser timeouts | `AbortSignal.timeout(TIMEOUT_MS)` in `services/api.ts` | The UI fails to its labelled sample data instead of spinning forever. |
| Rate limiting | 20 req/min/IP on `/api/plan` and `/api/advisory` | Caps model spend and prevents compute exhaustion (see `docs/SECURITY.md` §4). |
| Body cap | `express.json({ limit: '16kb' })` | Memory bounded per request. |
| Key-free upstreams | Open-Meteo (air quality, geocoding, weather) | No key provisioning, no quota dashboard, no billing path — the whole app runs on public infrastructure. |

**The cheapest request is the one not made.** With no `GEMINI_API_KEY`, `/api/plan` never leaves
the process: `localPlan()` is a pure function of the validated payload. The GenAI route is an
*enhancement*, not a dependency — this is also why the entire test suite passes with
`GEMINI_API_KEY: ''`.

## 4. What the tests cost

```
npx vitest run        → 17 files, 264 tests, ~2.8 s wall clock
npm run test:coverage → same + v8 instrumentation
```

| Suite | Tests | Runtime character |
| --- | --- | --- |
| `compute/*` (7 files) | 111 | pure functions, no DOM, no I/O |
| `server/*` (4 files) | 66 | real HTTP loopback against a stubbed upstream |
| `render/*` (3 files) | 52 | jsdom + Testing Library |
| root (api/storage/planner) | 35 | typed fetch client, defensive storage, planner |

Sub-3-second feedback is a feature: it is what makes `npm run verify` something a developer runs
before every commit rather than "at the end". Nothing in the suite sleeps; every async test awaits
an assertion instead of a timer.

## 5. Build and tooling

- **Vite dev** starts in ~300 ms; HMR is module-granular.
- **`npm run build`** transforms 68 modules in ~400 ms — no bundler plugins beyond React and
  Tailwind.
- **Coverage** uses v8's native counters (no babel instrumentation overhead).
- **No sourcemaps in production** (`sourcemap: false`) — halves output size and stops shipping
  source structure to every client. Debug builds can flip it on.

## 6. Numbers worth quoting

| Metric | Value |
| --- | --- |
| First-visit payload (gzip) | ≈104 kB |
| App JS (gzip) | 93.8 kB |
| Test suite wall clock | ~2.8 s / 264 tests |
| Build wall clock | ~0.4 s |
| Upstream calls per tab switch | 0 |
| Upstream calls per app load | 1 (air bundle) + 1 (geocode, if the user searches) |
| Cache | TTL + LRU, config-driven, unit-tested |

## 7. Deliberate trade-offs

- **Linear scans over maps** (`AQI_BANDS.find`, `SWAPS.filter`) — datasets are 6–12 entries; the
  readability win outweighs a constant-factor loss nobody can measure.
- **Sample fallback bundled into the app** (a few kB) rather than fetched — it is what makes the
  app honest and useful offline, and it is labelled `source: sample` in a live region.
- **`gemini-2.5-flash` / `grok-4.7` by default, `reasoning_effort: low` on Grok** — chosen for
  latency on a per-request interactive path; a slower model would be justified only if quality
  demanded it, and the local planner already guarantees a good baseline answer.
