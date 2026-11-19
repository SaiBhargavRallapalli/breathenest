# Decision Log

**Project:** BreatheNest — GenAI Urban Air Quality Assistant
**Format:** each entry records the situation, the options that were actually on the table, the
choice, and the consequence a future maintainer will live with. Decisions are numbered in the order
they were made; nothing here is retro-fitted to look inevitable.

---

## D-001 · Name and product frame: "BreatheNest", a household assistant

**Situation.** The vertical is urban air quality. The obvious frames are (a) a monitoring
dashboard, (b) a public-health alert system, (c) a household decision assistant.

**Options.** Dashboard → maximises data, minimises action. Alert system → implies an authority and
a duty of care the app cannot discharge. Household assistant → owns the moment *before the door
opens*.

**Decision.** Frame as a household decision assistant: "what do I do at 07:00?" The name
BreatheNest signals air + home, and the six tabs are ordered as a decision sequence (read the air →
plan the day → fix the indoors → pick alternatives → total the impact → see the street).

**Consequence.** Copy discipline: no panel may end in an unquantified recommendation. This is
enforced by tests (see `docs/PROBLEM_ALIGNMENT.md` §2).

## D-002 · Deterministic core, generative skin

**Situation.** The challenge rewards GenAI, but an LLM asked for "a plan with numbers" will
confidently invent numbers.

**Options.**
1. Let the model generate the whole plan (fast to build, untrustworthy output).
2. Compute everything locally, use the model only to *rephrase* (slower to build, correct).
3. Compute and let the model free-write alongside (two sources of truth, contradictory UI).

**Decision.** Option 2, structurally: `src/lib/planner.ts` is the source of truth; Gemini rewrites
the same plan's prose; its output is re-validated field by field and reconciled against the local
plan (`server/ai.ts`). The badge tells the user which engine answered.

**Consequence.** The app has no key-dependent failure mode, the test suite runs offline, and a
model regression can degrade *wording* but never *numbers*. Cost: some GenAI output is discarded
when malformed — an intentional waste.

## D-003 · Key-free upstream data (Open-Meteo) behind our own gateway

**Situation.** Live data is required for the advice to be worth anything; API keys in the browser
are not acceptable, and requiring every evaluator to provision keys would sink the demo.

**Options.** Keyed provider (better coverage, onboarding friction) · client-direct key-free calls
(no key, but no CSP, no cache, no rate limit) · **key-free provider, server-proxied** (no key,
full control).

**Decision.** Open-Meteo (air quality, geocoding, weather) called only from Express, with a
TTL + LRU cache and outbound timeouts. The browser talks to `/api/*` only — which is what makes
`connect-src 'self'` honest rather than aspirational.

**Consequence.** City-level granularity and provider dependence (mitigated by a labelled bundled
sample fallback). No billing, no quota dashboard, no secrets beyond one optional Gemini key.

## D-004 · One context store, six panels, no router

**Situation.** Six tabs that all read the same air bundle, profile and language.

**Options.** React Router + per-route data fetching · Redux · **single `AppContext` with an
exposed action surface**.

**Decision.** One provider (`AppContext`) exposing typed state and four actions
(`setTab`, `setLocation`, `setLanguage`, `toggleSwap`…), persisted to namespaced localStorage
keys. Tab state is application state, not a URL — there is nothing deep-linkable worth a router.

**Consequence.** Zero network calls on tab switch, one place to reason about persistence, and a
`useApp()` that throws loudly outside the provider. Trade-off: if panels ever need independently
fetched data, the store must be split (recorded as a future trigger, not a current problem).

## D-005 · Derived loading states instead of effect-set flags

**Situation.** ESLint's `react-hooks/set-state-in-effect` rule (v7) forbids setting state inside
`useEffect` in response to props/state. Every "fetch on mount, set `loading`" pattern violates it.

**Options.** Disable the rule · restructure.

**Decision.** Restructure: each async panel holds the data plus the `requestKey` it was built
from; a mismatch between the current key and the stored key *is* the loading state and renders
the skeleton directly. `RoutinePanel` documents this in its file header.

**Consequence.** The UI cannot get stuck in a loading state it forgot to clear, and there is no
render→effect→setState→render loop by construction. Cost: a slightly unfamiliar pattern for
reviewers, mitigated by the header comment and `docs/CODE_QUALITY.md` §4.

## D-006 · Zod at the edge, guards inside

**Situation.** Validation is needed twice: on HTTP input (untrusted) and on computed numbers
(internal).

**Decision.** Zod schemas in `server/schemas.ts` run *before* every handler — nothing downstream
sees an unvalidated object. Inside `src/lib/compute/`, hand-written `assertFinite` /
`assertPositive` / `assertInRange` guards throw `TypeError`/`RangeError` **with the field name**.

**Consequence.** Two different failure vocabularies for two different audiences (HTTP 400 with
field-level `details` vs a loud programmer error in tests). Deliberate: conflating them either
leaks internals or hides bugs.

## D-007 · Rate limit the model endpoints, not the data endpoints

**Situation.** `/api/plan` costs Gemini quota and CPU; `/api/air-quality` is a cached proxy.

**Decision.** 20 req/min/IP on `/api/plan` and `/api/advisory` only, JSON 429. The air-quality
route relies on the TTL cache instead — throttling it would punish a legitimate refresh.

**Consequence.** An abuser can spend *their own* refresh budget but cannot drain the Gemini key.
The limiter is disabled only under `NODE_ENV=test` (shared counters cause flaky suites) and its
real behaviour is unit-tested separately.

## D-008 · Dark, token-driven design system with no component library

**Situation.** Six panels, ~10 primitives needed (Card, Badge, Gauge, Meter, Stat, Sparkline,
Icon).

**Options.** MUI/Chakra (fast, heavy, hard to make accessible-by-default) · **hand-rolled
primitives on Tailwind 4 tokens**.

**Decision.** Hand-rolled. Every primitive takes its accessible role at the type level (`Gauge`
always renders `role="meter"`; `Card` requires a heading `level`).

**Consequence.** 23.7 kB of CSS, zero runtime styling cost, and accessibility features that cannot
be forgotten because they are the component's implementation, not an opt-in prop. Cost: we own the
focus styles and must test them (we do, in `shell.test.tsx`).

## D-009 · Coverage scoped to `lib/` + `services/`, thresholds that fail

**Situation.** 100% coverage across a React app rewards testing markup; low thresholds reward
ignoring coverage.

**Decision.** Scope coverage to where a wrong answer matters — `src/lib/**` and
`src/services/**` — with enforced thresholds of 85/80/85/85 (currently 94/88/97/96). UI is
covered by journey tests instead.

**Consequence.** Coverage number means something; component line-coverage is explicitly *not*
claimed anywhere in this documentation.

## D-010 · Honesty features that cost conversions

**Situation.** Three places where the less flattering answer is the correct one:

- a swap that cuts CO₂ but **raises** personal exposure on dirty days — shown with a caveat;
- the community care pledge — shown with **no** emission figure rather than a plausible fake;
- degraded sample data — shown with a live-region notice rather than silently.

**Decision.** Ship all three. They are asserted by tests (`flows.test.tsx`: "marks swaps that raise
personal exposure", "states the care pledge has no emission figure", "warns when live readings are
unavailable").

**Consequence.** The product occasionally tells the user "this one isn't a win for you". That is
the entire credibility argument for the impact ledger, and it is why the numbers elsewhere are
worth reading.
