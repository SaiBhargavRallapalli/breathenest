// ============================================================
// src/constants/swaps.ts
// Sustainable alternatives. Each swap states the annual CO2 it
// avoids, the daily inhaled PM2.5 it removes, and the money kept,
// so a family can see the direct effect of switching.
// ============================================================

import type { HouseholdProfile, ImpactDelta, Swap } from '@/types';

const USD: ImpactDelta['currency'] = 'USD';

/** Short-circuit helpers used by the `applicable` predicates. */
const drives = (profile: HouseholdProfile): boolean =>
  profile.commute === 'car' || profile.commute === 'ev';

const burnsSolidFuel = (profile: HouseholdProfile): boolean =>
  profile.cookingFuel === 'wood_coal' || profile.cookingFuel === 'labeled_cylinder';

export const SWAPS: readonly Swap[] = [
  {
    id: 'metro-on-bad-days',
    category: 'commute',
    title: 'Take the metro on the worst-air days',
    from: 'Driving alone, every day',
    to: 'Rail or metro when AQI passes 100',
    effort: 'low',
    annualBaseline: {
      co2KgPerYear: 690,
      inhaledPm25UgPerDay: 12,
      moneySavedPerYear: 410,
      currency: USD,
    },
    why: 'A sealed cabin still lets some outdoor air in, and you are stationary in the traffic you would otherwise be part of. Rail moves you below the inversion layer where concentrations are lower.',
    applicable: drives,
  },
  {
    id: 'carpool-two',
    category: 'commute',
    title: 'Share the trip with one other person',
    from: 'Two cars, two commutes',
    to: 'One car, two passengers',
    effort: 'low',
    annualBaseline: {
      co2KgPerYear: 345,
      inhaledPm25UgPerDay: 0,
      moneySavedPerYear: 205,
      currency: USD,
    },
    why: 'Halving the vehicle-kilometres halves the tailpipe CO2 with no change to your schedule. The inhaled dose is unchanged because both people still sit in the same cabin.',
    applicable: drives,
  },
  {
    id: 'cycle-clean-days',
    category: 'commute',
    title: 'Cycle short trips — only on clean days',
    from: 'Short driving trips under 5 km',
    to: 'Cycling when AQI is below 50',
    effort: 'medium',
    annualBaseline: {
      co2KgPerYear: 180,
      inhaledPm25UgPerDay: -8,
      moneySavedPerYear: 95,
      currency: USD,
    },
    why: 'Cycling is the cleanest way to move, but hard breathing multiplies your intake. On a dirty day a cyclist can inhale several times what a driver does, so the win only holds when the air is good.',
    applicable: drives,
  },
  {
    id: 'induction-cooking',
    category: 'home_energy',
    title: 'Replace the indoor flame with induction',
    from: 'Wood, coal, cylinder or gas burned indoors',
    to: 'Induction with the extractor running',
    effort: 'medium',
    annualBaseline: {
      co2KgPerYear: 480,
      inhaledPm25UgPerDay: 45,
      moneySavedPerYear: 120,
      currency: USD,
    },
    why: 'Cooking on an open flame is the single biggest indoor particle source in many homes. Removing combustion from the kitchen cuts both what you breathe and what the grid has to supply.',
    applicable: burnsSolidFuel,
  },
  {
    id: 'led-everywhere',
    category: 'home_energy',
    title: 'Swap every remaining bulb for LED',
    from: 'Incandescent and halogen lamps',
    to: 'LED in every fitting',
    effort: 'low',
    annualBaseline: {
      co2KgPerYear: 265,
      inhaledPm25UgPerDay: 0,
      moneySavedPerYear: 88,
      currency: USD,
    },
    why: 'LEDs draw about a quarter of the power for the same light, so the saving appears on every bill for the next decade with a one-hour swap.',
    applicable: () => true,
  },
  {
    id: 'air-sealing',
    category: 'home_energy',
    title: 'Seal and insulate before you heat',
    from: 'Heat leaking through gaps and thin walls',
    to: 'A sealed envelope and topped-up insulation',
    effort: 'high',
    annualBaseline: {
      co2KgPerYear: 310,
      inhaledPm25UgPerDay: 6,
      moneySavedPerYear: 150,
      currency: USD,
    },
    why: 'Every gap that leaks warm air out also pulls smog in. Sealing the envelope cuts the heating bill and the infiltration at the same time.',
    applicable: (profile) => profile.homeType !== 'dormitory',
  },
  {
    id: 'solar-water-heating',
    category: 'home_energy',
    title: 'Let the sun heat your water',
    from: 'Electric or gas water heating',
    to: 'A rooftop solar water heater',
    effort: 'high',
    annualBaseline: {
      co2KgPerYear: 220,
      inhaledPm25UgPerDay: 0,
      moneySavedPerYear: 95,
      currency: USD,
    },
    why: 'Water heating is one of the largest household loads. A solar thermal panel removes most of it for the next 15 years.',
    applicable: (profile) => profile.homeType === 'independent_house',
  },
  {
    id: 'meat-free-days',
    category: 'food',
    title: 'Keep two red-meat days a week',
    from: 'Red meat at most meals',
    to: 'Two plant-based days each week',
    effort: 'low',
    annualBaseline: {
      co2KgPerYear: 300,
      inhaledPm25UgPerDay: 0,
      moneySavedPerYear: 180,
      currency: USD,
    },
    why: 'Beef and lamb carry by far the highest emissions per kilo of any common food. Two swapped days a week adds up faster than most people expect.',
    applicable: () => true,
  },
  {
    id: 'compost-and-sort',
    category: 'waste',
    title: 'Compost food scraps, recycle the rest',
    from: 'Everything into one bin',
    to: 'Compost caddy plus separated recycling',
    effort: 'low',
    annualBaseline: {
      co2KgPerYear: 95,
      inhaledPm25UgPerDay: 0,
      moneySavedPerYear: 30,
      currency: USD,
    },
    why: 'Food waste in landfill breaks down without oxygen and releases methane, which warms the planet far faster than the CO2 from burning it.',
    applicable: () => true,
  },
  {
    id: 'cold-water-wash',
    category: 'water',
    title: 'Wash clothes cold and full',
    from: 'Half loads at 60 °C',
    to: 'Full loads at 30 °C or cold',
    effort: 'zero',
    annualBaseline: {
      co2KgPerYear: 70,
      inhaledPm25UgPerDay: 0,
      moneySavedPerYear: 45,
      currency: USD,
    },
    why: 'Around 90% of a washing machine’s energy goes into heating the water. Cold water cuts that to nearly nothing and keeps clothes usable longer.',
    applicable: () => true,
  },
];

/** Swaps that actually make sense for this household. */
export function swapsFor(profile: HouseholdProfile): readonly Swap[] {
  return SWAPS.filter((swap) => swap.applicable(profile));
}
