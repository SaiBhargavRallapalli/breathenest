# Code Quality

**Project:** BreatheNest — GenAI Urban Air Quality Assistant
**Gate:** `npm run verify` → ESLint (0/0) → `tsc --noEmit` (0 errors) → 264 tests → production build

---

## 1. The claim

BreatheNest's source is organised so that the interesting logic is boring to test: everything that
decides *what to tell the user* is a pure function, everything that *talks to the outside world* sits
behind two narrow boundaries, and the type system is configured to remove whole categories of
runtime surprise before the code ever runs.

## 2. Layering

```
src/
├── lib/          pure domain logic — no React, no I/O, no globals
│   ├── compute/  aqi · exposure · windows · indoor · forecast · impact · guards
│   └── planner.ts  the deterministic day-plan builder
├── services/     the only two I/O boundaries
│   ├── api.ts      typed fetch client (timeout + uniform error shape)
│   └── storage.ts  defensive localStorage (corruption, quota, denial)
├── context/      one store — AppContext
├── components/   UI only; reads the store, never computes domain answers
└── constants/    data tables (pollutants, hacks, swaps, pledges, i18n)

server/
├── schemas.ts    every request shape, Zod-validated
├── airQuality.ts upstream providers + normalisation
├── ai.ts         Gemini/Grok calls + output re-validation, with a local fallback
├── cache.ts      TTL + LRU
├── middleware.ts security headers, CORS, rate limit, error boundary
└── app.ts        route wiring only
```

Two rules hold across the whole codebase:

1. **`src/lib/**` is pure.** No file under `lib/` imports React, `fetch`, `localStorage` or
   `Date.now()` for decisions (timestamps are passed in). This is why 84% of statements in `lib/`
   are covered by tests that run in milliseconds with no DOM and no network.
2. **Components never decide.** A panel renders what `lib/` and `context/` tell it. When the air
   reading changes, the panels re-render; they do not re-derive AQI bands, doses or windows.

## 3. TypeScript as an enforcement mechanism

`tsconfig.json`:

| Option | Why it is on |
| --- | --- |
| `strict` | The obvious baseline. |
| `noUncheckedIndexedAccess` | `hours[13]` is `HourlyForecast \| undefined`, so index access must be narrowed. This single flag caught real off-by-one risks in the forecast/window code. |
| `noImplicitOverride` | Subclass members must be declared intentional. |
| `verbatimModuleSyntax` | Type-only imports stay type-only; no accidental runtime imports of interfaces. |
| `noUnusedLocals` / `noUnusedParameters` | Dead code fails the build, not the reviewer. |

There is **no `any` escape hatch in production code** and ESLint forbids `@typescript-eslint/no-explicit-any`
and `no-non-null-assertion` outright. Where an assertion is genuinely impossible to avoid (test
mock call tuples), the cast goes through `unknown` first so it reads as the deliberate exception it is.

**Result:** `tsc --noEmit` exits 0 over 100% of the source, including tests.

## 4. ESLint flat config

`eslint.config.js` (ESLint 10) lints the *whole* repository with `--max-warnings 0`, so a warning is
as fatal as an error in CI. Beyond the type-aware rules it pins two rules that materially change how
this app is written:

- **`react-hooks/exhaustive-deps`** — effects that fetch depend on stable identities, not inline
  objects. Every effect in `AppContext` and `RoutinePanel` declares its real dependencies.
- **`react-hooks/set-state-in-effect`** (v7) — *forbids* setting state inside `useEffect` in
  response to props/state. This pushed the design toward **derived loading states**: panels compare
  a `requestKey`/`advisoryKey` against the data they hold, and a mismatch *renders* the skeleton
  instead of an effect *setting* a `loading` flag. The visible benefit is that the UI cannot get
  stuck in a loading state it forgot to clear, and there is no render→effect→setState→render loop.

## 5. Naming and shape conventions

- **One store, explicit surface.** `AppContextValue` is a readonly interface; consumers destructure
  what they need. There is exactly one `useApp()` accessor and it throws outside the provider with a
  message that says so.
- **Discriminated unions over flags.** `LoadState` is `'loading' | 'success' | 'error'`; `AirState`
  pairs it with `degraded: boolean` rather than a second parallel enum. `switch` over a union is
  exhaustive-checked by the compiler (the `Panels` switch in `App.tsx` has a `default` that is
  unreachable but keeps the return type total).
- **Domain vocabulary in code.** `classifyRisk`, `assessStagnation`, `requiredCadr`,
  `clearanceTimeMinutes`, `aggregateImpact` — the function names are the domain language used in
  the UI, so a reviewer can map a line of copy back to a line of logic.
- **Constants are data, not logic.** Pollutant breakpoints, hacks, swaps and pledges are typed
  tables. `SWAPS` entries carry an `applicable(profile)` predicate so applicability stays next to
  the data it describes.

## 6. Error handling philosophy

| Layer | Strategy |
| --- | --- |
| `lib/compute/guards.ts` | `assertFinite` / `assertPositive` / `assertInRange` throw typed `TypeError`/`RangeError` **with the field name**. Bad numbers fail loudly at the boundary instead of silently producing a wrong AQI. |
| `services/api.ts` | Every failure — HTTP, transport, empty body — collapses to one `ApiError` with a `status` (0 for transport) and a human message. UI code has exactly one error path. |
| `services/storage.ts` | `loadJson` never throws: malformed JSON, a missing key, a denied `localStorage` (private mode) or a quota error all return the caller's fallback. |
| `server/middleware.ts` `safeErrorHandler` | 4xx messages are echoed (the client can correct input); 5xx messages are replaced with `Internal Server Error` and the real error is logged server-side only. |
| `server/ai.ts` | Model output (Gemini or Grok) is re-validated; on any failure the deterministic local plan is returned. There is no user-visible failure mode. |

## 7. Honesty in the numbers

Because `lib/compute` is pure, its outputs are checkable against published sources, and the tests
do exactly that: PM2.5 breakpoints are asserted at their EPA values (12 → 50, 12.1 → 51, 35.4 → 100),
the WHO 24-hour guideline drives the reference inhaled dose, and the clearance-time test evaluates
the single-compartment decay formula by hand (≈8.5 min for 30 m³ at 400 m³/h and 85% media
efficiency). Fixtures are hand-built (`src/test/fixtures.ts`) with a deliberate clean midday and a
deliberate dirty dawn so window-finding tests are deterministic rather than "whatever the API said".

## 8. What a reviewer should check first

1. `tsconfig.json` — confirm the strictness flags are real.
2. `npx eslint . --max-warnings 0` — should exit 0 with no output.
3. `src/lib/compute/` — read one file end-to-end; it should be readable without any React context.
4. `src/components/routine/RoutinePanel.tsx` — the derived-loading pattern that the v7 hooks rules
   forced; the `requestKey` mismatch *is* the loading state.

## 9. Known trade-offs

- **`AppContext` is a single provider.** With six panels and one shared bundle this is simpler than
  several contexts. If panels start needing independently-fetched data, split it then.
- **`parallel` array lookups** (e.g. `AQI_BANDS.find(...)`) are linear scans over ~6 entries —
  chosen over a `Map` for readability; measured cost is sub-microsecond.
- **A `default:` branch exists in an exhaustive switch** so a future union member fails the build
  with a fallback rather than rendering `undefined`.
