# Problem Alignment

**Project:** BreatheNest — GenAI Urban Air Quality Assistant · Challenge 6
**Question this doc answers:** does the software actually do what the challenge asked, and can a
reviewer verify each claim in under a minute?

---

## 1. The requirement, restated

The challenge asks for an assistant that:

1. suggests **low-emission daily routines**,
2. suggests **indoor air quality hacks**,
3. suggests **sustainable alternatives**,
4. **tailored to location and lifestyle**, and
5. **clearly explains the direct impact of choices**.

Read closely, items 1–3 are a feature list and items 4–5 are the differentiators. Most submissions
will satisfy 1–3 with a static list. The scoring separation is in *tailoring* and *impact*, which
is where BreatheNest concentrates its engineering.

## 2. Requirement → implementation → proof

| # | Requirement | Where it lives | How a reviewer verifies it |
| --- | --- | --- | --- |
| 1 | Low-emission **daily routines** | `My day` tab: hour-by-hour plan (`RoutinePanel`), built by `src/lib/planner.ts` and/or `server/ai.ts` | Ask for a plan with no API key → a complete, chronological day still renders (`flows.test.tsx` "builds a complete local plan when the gateway is unavailable") |
| 2 | **Indoor air quality hacks** | `Home air` tab: 11 quantified hacks (`src/constants/hacks.ts`), room-volume/CADR calculator, ventilation advice driven by the live forecast | Open the tab → hacks carry an "Expected indoor PM2.5 drop" figure; filter by zone (kitchen/bedroom/living room/whole home) |
| 3 | **Sustainable alternatives** | `Better swaps` tab: 12 swaps (`src/constants/swaps.ts`) across commute, home energy, food, waste, water — each with what it replaces, effort budget, and annual CO₂ / inhaled-PM2.5 / money deltas | Pick a swap → it appears on the `Impact` tab with its own row in the ledger |
| 4a | Tailored to **location** | Location picker (seed cities + live geocoding proxy) drives the Open-Meteo bundle; the AQI, pollutants, forecast and stagnation are all *that city's* data | Search "Mumbai" → every downstream number re-fetches for Mumbai's coordinates (`shell.test.tsx` asserts the request carries `name=Mumbai`) |
| 4b | Tailored to **lifestyle** | `HouseholdProfile` — members with ages/vulnerabilities, commute mode, home type, work hours — filters and prices everything: `swapsFor(profile)`, household guidance, commute pricing, bedroom CADR | Seed a driver profile → only driver-applicable swaps appear; seed a sensitive member → the AQI band's `sensitiveGuidance` appears under "For your household" |
| 5 | **Direct impact of choices** | Every block, hack, swap and pledge carries an explicit impact line; `Impact` aggregates the selected swaps into one annual ledger with relatable equivalents | `flows.test.tsx` "quantifies the impact of every block" and "selects a swap and totals it on the impact tab" |

Nothing on screen says "improve your air quality". The copy discipline is enforced by tests that
assert the *number* ("cuts inhaled particles ~70% vs 07:00", "CO₂ avoided per year", "Money kept
per year"), because an unquantified claim is not an explanation.

## 3. The differentiator: impact is bidirectional

The honest edge — and the thing that separates this from a green-washing list — is that BreatheNest
reports when a "good" choice **raises personal exposure**:

```
Cycle short trips — only on clean days
  CO₂: −180 kg/yr   Money: +$95/yr
  ⚠ raises your own exposure on dirty days — only do this when AQI is low
```

A cyclist on an AQI-200 morning inhales several times what a driver in a sealed cabin does. The
swap still ships (it is a genuine emissions win), the caveat ships with it, and a test pins the
caveat's presence. Similarly, the care pledge on the Community tab states plainly that it has **no
emission figure** rather than inventing one.

This is the "clearly explaining the direct impact" requirement taken seriously: impact includes the
axis where the user loses.

## 4. GenAI, and why it is not a gimmick

The challenge is a GenAI challenge, so the model has a real job: **rewrite the deterministic plan in
household-specific language**, grounded in the actual forecast and profile. It is not asked to
invent numbers (it cannot — the numbers are computed and re-validated), and the feature is not
load-bearing: without a key the local planner produces the same structure of answer.

What the model genuinely adds:

- prose that names *your* household ("Asha and you: AQI 185…"), not generic advice;
- a multilingual advisory (`/api/advisory`) phrased for the selected language;
- a choice of backend: the same contract is served by Google Gemini **or** Groq, selected by
  `GENAI_PROVIDER`, with neither required for the app to work;
- plan summaries that read like a person wrote them.

What it is deliberately prevented from doing: producing unvalidated fields, unbounded text, wrong
`risk` labels, or more than `MAX_BLOCKS` items (see `docs/SECURITY.md` §4). The UI states which
engine answered (`Local planner` vs `GenAI plan (Gemini)` vs `GenAI plan (Groq)`), so the user is
never misled about provenance.

## 5. What a skeptical reviewer should do

```bash
npm install --legacy-peer-deps
npm run dev                 # no key needed
```

1. **Kill the network** (or don't start the API) → the app still renders, labelled `sample`.
2. **Remove `GEMINI_API_KEY`** → the routine tab still returns a full plan, badged `Local planner`.
3. **Switch location to a dirty city** → watch the guidance, windows and stagnation change.
4. **Add a sensitive member to the household** → the AQI tab grows a household-specific warning.
5. **Select three swaps** → the Impact ledger totals them and shows equivalents.
6. **Read `docs/TESTING.md`** → run `npx vitest run` and see 284 green in under three seconds.

Each step verifies a different requirement line from §2 without reading any code.

## 6. Honest scope boundaries

- **Not a medical device.** The footer says so on every screen; the app advises on exposure, not
  diagnosis or treatment.
- **Not a sensor network.** Data is city-level Open-Meteo, not a monitor in your bedroom — the
  indoor calculator is a *model* (room volume, ACH, filtration efficiency) and is labelled as an
  estimate ("Expected" indoor PM2.5 drop, not "Measured").
- **Not a social platform.** Community pledges are aggregated locally; there are no accounts and
  no server-side user data (which is also the security posture — see `docs/SECURITY.md`).
- **City-level granularity.** Within-city variation (a road-side flat vs a park-side flat) is out
  of scope for the data source, not for the product — the indoor hacks are exactly the response to
  that gap.

## 7. Distinctness

BreatheNest is an original implementation: its own name, architecture (single context store +
pure `lib/compute` + Express 5 gateway), test organisation (18 files / 284 tests), documentation
structure (`docs/` pillar reports with evidence tables), and copy. Inspiration was taken from the
problem domain — air-quality assistants are a well-known space — not from any existing repository's
code or prose.
