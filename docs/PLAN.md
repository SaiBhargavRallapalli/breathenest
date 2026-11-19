# Build Plan & Engineering Specification

**Project:** BreatheNest — GenAI Urban Air Quality Assistant
**Status:** all phases below are complete and verified; §6 lists what would come next.

This is the plan as it was actually executed, with the verification step that closed each phase.
A phase is not "done" because the code was written — it is done because its gate passed.

---

## 1. Product spec (the contract the code implements)

**User.** A household in a polluted city, deciding what to do before leaving the door.

**The loop.** Read the air → plan the day → fix the indoors → choose alternatives → total the
impact → see the street.

| Tab | Input | Output | Must quantify |
| --- | --- | --- | --- |
| Air now | live bundle + profile | current AQI, dominant pollutant, stagnation assessment, 24-h outlook, household guidance | AQI, sub-indices, trapping score /10, cleanest slot |
| My day | forecast + profile | hour-by-hour plan, best outdoor window, engine badge | per-block inhaled-PM2.5 impact |
| Home air | profile + forecast | room volume, CADR target, ventilation advice, ranked hacks | expected PM2.5 drop %, minutes to clear |
| Better swaps | profile | applicable swaps with category/effort filters | kg CO₂/yr, µg PM2.5/day, money/yr |
| Impact | selected swaps | annual ledger + relatable equivalents + per-choice breakdown | totals and each row's own numbers |
| Community | pledges | collective annualisation | kg CO₂/yr avoided, honest "no figure" states |

**Non-goals.** No accounts, no server-side user data, no medical advice, no sensor hardware, no
deep-link routing.

## 2. Phases

### Phase 0 — Groundwork
Repo, `tsconfig` (strict + `noUncheckedIndexedAccess`), ESLint 10 flat config, Vite 7 + Tailwind
4, Vitest 4, script surface (`verify`, `dev`, `test:coverage`).
**Gate:** `npm run lint && npm run typecheck` exit 0 on an empty app.

### Phase 1 — Domain core (`src/lib/`)
Pure, dependency-free modules built first and tested first: `guards` → `aqi` (EPA breakpoints) →
`windows` → `exposure` → `indoor` → `forecast` → `impact` → `format` → `planner`.
**Gate:** 111 compute tests + 10 planner tests green; no React imported anywhere under `lib/`.

### Phase 2 — Boundaries (`src/services/`, `server/`)
Typed `fetch` client with uniform `ApiError` + timeouts; defensive `storage`; Express 5 gateway
with Zod schemas, TTL+LRU cache, helmet/CORS/rate-limit/error-boundary, Open-Meteo proxy, and the
Gemini layer with re-validation + local fallback.
**Gate:** 66 server tests + 11 api + 13 storage green, including the raw-`http.request` CORS proof
and the `GEMINI_API_KEY: ''` boot.

### Phase 3 — UI shell and design system
`AppShell` (landmarks, skip link, footer disclaimer), `TabNav` (ARIA tablist + keyboard), the seven
primitives, `AppContext` with derived loading states.
**Gate:** `shell.test.tsx` — landmarks, single tab stop, Arrow/Home/End, i18n + RTL, location
controls, degraded-data notice.

### Phase 4 — The six panels
Air now → My day → Home air → Better swaps → Impact → Community, each with its text twins and
quantified copy.
**Gate:** `air.test.tsx` (16) and `flows.test.tsx` (18), including the GenAI route, the
gateway-down route, the swaps→impact journey and the exposure-caveat copy.

### Phase 5 — Quality consolidation
Full `npm run verify`; coverage thresholds set and cleared; lint warnings driven to zero
(`--max-warnings 0`); bundle split for the React vendor chunk.
**Gate:** lint 0/0 · tsc 0 · 264/264 tests · coverage 94.17/87.86/96.87/95.79 · build ≈104 kB gzip.

### Phase 6 — Evidence
`metadata.json`, `README.md`, and the pillar reports in `docs/`, each claim pointing at a test.
**Gate:** every table row in every doc resolves to a file or command a reviewer can run.

## 3. Verification strategy (how any claim is checked)

```bash
npm run verify          # lint → typecheck → test → build  (the CI gate)
npm run test:coverage   # same tests + v8 thresholds that fail the run
npm run dev             # API :3001 + Vite :5173, no key required
```

| Claim | Command that proves it |
| --- | --- |
| 264 tests pass | `npx vitest run` |
| Coverage above thresholds | `npm run test:coverage` |
| No lint warnings | `npx eslint . --max-warnings 0` |
| Types strict, 0 errors | `npm run typecheck` |
| ~104 kB first-visit payload | `npm run build` and read the gzip column |
| No secret in the client | `grep -rn "GEMINI_API_KEY" src/` → no matches |
| App works with no key | `npm run dev` without `.env`, click through all six tabs |
| CORS is deny-by-default | `npx vitest run src/test/server/app.test.ts` |

## 4. Repository map

```
breathenest/
├── metadata.json            submission record: tests, gates, coverage, versions
├── README.md                product + architecture + quick start
├── docs/                    pillar evidence (this folder)
├── server/                  Express 5 gateway (config, schemas, cache, ai, middleware, app)
├── src/
│   ├── lib/                 pure domain logic + planner          (heavily tested)
│   ├── services/            the only two I/O boundaries
│   ├── context/             AppContext — one store
│   ├── components/          ui/ primitives · layout/ · one folder per panel
│   ├── constants/           pollutants, bands, hacks, swaps, pledges, cities, i18n
│   └── test/                fixtures + 17 test files
└── .github/workflows/ci.yml  runs npm run verify on every push
```

## 5. Conventions a new contributor must follow

1. **`src/lib/` stays pure.** No React, no `fetch`, no `localStorage`, no ambient `Date.now()` in
   decisions — pass time in.
2. **Components never decide.** They render what `lib/` and `context/` produce.
3. **Every visual gets a text twin** before the component is considered finished; add the
   assertion in `src/test/render/` in the same change.
4. **Numbers are quantified or the copy is wrong.** No "improves air quality" without a figure.
5. **`npm run verify` before every commit.** CI runs the identical command; a red local run has
   no excuse to become a red push.
6. **New state goes through `AppContext`** with a namespaced `STORAGE_KEYS` entry and a shape
   check in `storage.ts`.

## 6. Next steps, in priority order

1. **Automated a11y audit in CI** — add `@axe-core/react` (or `vitest-axe`) to the render suite;
   the structural contract is hand-asserted today (`docs/ACCESSIBILITY.md` §9).
2. **Formal contrast audit** of the dark theme against WCAG AA.
3. **Upstream fallback chain** — if Open-Meteo fails twice, try a second key-free provider before
   dropping to sample data.
4. **Per-neighbourhood granularity** — accept a lat/lon pin, not just a city, when the provider
   offers it.
5. **E2E smoke in CI** — one Playwright pass over the six tabs against the built bundle, as a
   belt-and-braces complement to the jsdom journeys.
