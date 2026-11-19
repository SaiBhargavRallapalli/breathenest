# Accessibility

**Project:** BreatheNest — GenAI Urban Air Quality Assistant
**Contract:** every visual has a text twin, every state is announced, colour is never the only
signal, and the promise is enforced by 52 rendering tests, not by intention.

Air-quality advice is exactly the kind of content that gets made *less* accessible by its own
visualisation: a coloured dial, a chart, a badge. If the colour is the message, a colour-blind user
or a screen-reader user gets nothing — and "nothing" here means they do not know whether it is
safe to send their asthmatic child outside. So the rule in this codebase is simple:

> **No fact exists only in pixels.**

---

## 1. Structure and navigation

| Feature | Implementation | Test |
| --- | --- | --- |
| Skip link | First focusable element, `href="#main-content"`, visible on focus (`.skip-link`) | `shell.test.tsx` — "exposes a skip link that targets the main region" |
| Single `<h1>` | The brand renders as `<h1>`; panels use `Card` with an explicit `level` prop so the outline never skips a level | "renders the brand as the page heading" |
| Landmarks | `<header>`, `<nav aria-label>`, `<main id="main-content">`, `<footer aria-label>` | landmark queries in `shell.test.tsx` |
| Document title/description | `index.html` carries `<title>`, `<meta name="description">`, `lang="en"` | — |

`Card`'s `level` prop (`2 | 3 | 4`) exists specifically so a panel heading can sit correctly under
the panel's `<h2>` instead of defaulting to a level that breaks the outline.

## 2. The tablist

Six panels, one ARIA tablist (`TabNav.tsx`):

- `role="tablist"` → `role="tab"` buttons with `aria-selected`, `aria-controls` →
  `role="tabpanel"` with `aria-labelledby`, wired both directions (tested: "links each tab to its
  panel and back").
- **Roving tabindex** — exactly one tab is in the tab order, so a keyboard user hears one stop
  instead of six ("marks only the active tab as selected with a single tab stop").
- **Full keyboard model**: `ArrowRight/ArrowLeft/ArrowUp/ArrowDown` move selection *and* focus,
  `Home` jumps to the first tab, `End` to the last, with wrap-around. Tested with real key events
  ("moves selection with the arrow keys", "jumps to the ends with Home and End").
- Selection changes render the new panel immediately — no focus is lost to the document body.

## 3. Text twins for every visual

This is the core of the accessibility story, because almost everything on screen here is a
data visualisation.

| Visual | What a sighted user sees | What everyone else gets |
| --- | --- | --- |
| AQI gauge (`Gauge.tsx`) | an SVG arc coloured by band | `role="meter"` with `aria-valuenow/min/max` **and** a visible sentence — "AQI 152 · Unhealthy for sensitive groups" — so the number and the band are in the accessibility tree *and* on screen |
| 24-hour column chart (`ForecastStrip.tsx`) | 24 coloured columns | the `<svg>` is `aria-hidden="true"` + `role="presentation"`, and a real `<ul>` screen-reader twin lists the day: cleanest slot, dirtiest slot, peak, range — in words |
| Sparklines / meters (`Meter.tsx`) | a coloured bar | `role="meter"` + `valueText` carrying the real unit ("14.2 µg/m³"), plus the numeric label always rendered as text |
| Pollutant sub-indices | coloured tiles | every tile states its name and value; the **dominant pollutant is flagged in words** ("Main pollutant"), not by hue alone |
| Stagnation badge | a coloured badge | the level label ("Strong trapping likely") **plus** the numeric score and the reason list ("Trapping score 8 / 10", "Wind is nearly calm at 3.2 km/h…") |
| Swap deltas | a green/red figure | the number, its unit, and — where personal exposure moves the *wrong* way — an explicit sentence: "raises your own exposure on dirty days" |

A test asserts the chart's `aria-hidden` attribute directly; another reads the AQI out of the
text twin rather than the SVG. If someone deletes a twin, the suite fails.

## 4. Colour and contrast

- **Colour is always paired with text or shape.** AQI bands, risk levels, `Selected ✓` vs `Select`,
  the dominant-pollutant flag, the degraded-data warning — each states itself in words. The
  swaps toggle uses `aria-pressed` so the selected state is not conveyed by background colour.
- The palette is a dark theme with `chalk`-on-`ink` body text and `fog` reserved for secondary
  text at small sizes; accent colours (`mint`, `warn`, `alert`) are used for *meaning* alongside
  labels, never as the sole carrier.
- `line-through` + opacity marks the "from" side of a swap, but the arrow and the words
  "Short driving trips under 5 km → Cycling when AQI is below 50" carry the same information.

## 5. Announcements (live regions)

| Moment | Region |
| --- | --- |
| Location changed | `aria-live="polite"` in `LocationPicker` — "Showing Delhi, National Capital Territory" |
| Live data unavailable | the degraded notice appears in a polite live region — "Sample readings shown" — so a user who cannot see the banner still learns the data is not live |
| Refresh pressed | the same region re-announces the new reading |
| Plan engine switch | the badge text (`Local planner` / `GenAI plan (Gemini or Grok)` / gateway-offline note) is plain text in the flow, read in document order |

Nothing uses `aria-live="assertive"` — the app never interrupts, because a screen-reader user
mid-sentence in the current AQI is exactly who should not be cut off.

## 6. Internationalisation and direction

Four-language UI (English, हिन्दी, العربية, Español — `src/constants/translations.ts`):

- The language `<select>` has a real `<label for>`; changing it updates
  `document.documentElement.lang` **and** `dir` (Arabic → `rtl`), which flips the whole layout via
  Tailwind's logical properties (`ps-`/`pe-`, `ms-`/`me-`, `text-start`).
- Tests cover the round trip: switch to Arabic → `dir="rtl"`, `lang="ar"`; switch back → `ltr`.
- Direction is never encoded manually in strings; logical CSS properties do the work, so mirroring
  is automatic.

## 7. Input and interaction

- **Targets and focus.** Buttons are real `<button>` elements with visible focus styles; the tab
  strip scrolls horizontally (`overflow-x-auto`) rather than shrinking targets below tappable size.
- **Forms.** The city search is `<input type="search">` with `autocomplete="address-level2"` and a
  visible label; results are buttons with accessible names containing the city and region
  ("Mumbai, Maharashtra"), so the choice is unambiguous when read out of a list.
- **Timeouts and motion.** No auto-advancing content, no carousels, no `prefers-reduced-motion`
  violations (there is no non-essential motion).
- **Errors.** Load failures render as visible text with the reason, not a colour change alone.

## 8. How it is verified

```bash
npx vitest run src/test/render      # 52 tests: structure, keyboard, twins, i18n, announcements
```

Representative assertions:

```
skip link is the first focusable element and targets #main-content
exactly one tab has tabindex="0" / aria-selected="true"
ArrowRight moves selection AND focus; Home/End jump to the ends
the AQI dial exposes role="meter" with the numeric value
the 24-hour svg is aria-hidden and a <ul> twin lists cleanest/dirtiest slots
"Main pollutant" appears in text, not only as a colour
flipping to Arabic sets dir="rtl" and lang="ar"
the sample-data notice lives in a polite live region
```

## 9. Known limits

- **No automated axe/Lighthouse run in CI.** The structural contract is hand-asserted; adding
  `@axe-core/react` to the gate is a one-line follow-up and would be the first thing to do next.
- **Colour-contrast ratios are not machine-checked here.** The palette was chosen above WCAG AA
  for body text, but a formal contrast audit of the dark theme has not been run.
- **Translations are human-quality but not professionally localised.** The Hindi/Arabic/Spanish
  strings are serviceable; a native review would improve wording, not structure.
- **Four languages, not forty.** Coverage of locales is a breadth problem, not a structural one —
  adding a language is one entry in `LANGUAGES` plus one key block per language.
