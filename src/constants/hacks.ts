// ============================================================
// src/constants/hacks.ts
// Indoor air-quality interventions with cost, effort and a design
// estimate of what each one actually buys you.
// `reduction` is the expected fractional drop in indoor PM2.5 for a
// typical sealed room; `acrPerHour` is the equivalent clean-air
// change rate it contributes (0 when the hack is not a ventilation
// measure). Both are engineering estimates, not measurements.
// ============================================================

import type { AirHack } from '@/types';

export const AIR_HACKS: readonly AirHack[] = [
  {
    id: 'seal-gaps',
    zone: 'whole_home',
    title: 'Seal the gaps you did not know you had',
    steps: [
      'Roll a towel or use a draft excluder under the front door.',
      'Tape the edges of any window that rattles or whistles.',
      'Close the chimney flue when the fire is not in use.',
      'Seal the gap around extractor fans and range hoods.',
    ],
    costBand: 'zero',
    effort: 'weekend',
    reduction: 0.15,
    acrPerHour: 0,
    explanation:
      'A pressure difference pushes outdoor smog in through every unsealed crack. Closing them removes a path you never see but breathe constantly.',
  },
  {
    id: 'box-fan-filter',
    zone: 'living_room',
    title: 'Build a box-fan filter for under $40',
    steps: [
      'Get a 20-inch box fan and two MERV-13 or HEPA-grade furnace filters.',
      'Tape one filter across the intake side of the fan.',
      'Tape the second filter across the exhaust side for double capture.',
      'Run it on medium, pointing into the room, for 30 minutes before bed.',
    ],
    costBand: 'low',
    effort: 'weekend',
    reduction: 0.45,
    acrPerHour: 2.5,
    explanation:
      'A fan plus two filters moves roughly 400 m³/h of cleaned air. In a 30 m³ bedroom that is over 2 equivalent air changes every hour — close to what a commercial purifier delivers.',
  },
  {
    id: 'ventilate-smart',
    zone: 'whole_home',
    title: 'Open windows on a schedule, not on habit',
    steps: [
      'Keep windows shut from 06:00 to 10:00, when the night inversion is still trapped.',
      'Ventilate in the early afternoon, when sunlight breaks the inversion cap.',
      'Close up again before the evening traffic peak builds.',
      'Check the live forecast tab before you open anything.',
    ],
    costBand: 'zero',
    effort: 'trivial',
    reduction: 0.25,
    acrPerHour: 0,
    explanation:
      'Opening a window at the wrong hour imports the smog you were trying to escape. Timing alone can halve what your home takes in.',
  },
  {
    id: 'kitchen-exhaust',
    zone: 'kitchen',
    title: 'Run the kitchen exhaust 10 minutes early',
    steps: [
      'Switch the chimney or hood on before the pan starts to smoke.',
      'Keep it running for 10 minutes after cooking finishes.',
      'Cook with the lid on and the flame low.',
      'If there is no hood, open one window on the downwind side instead.',
    ],
    costBand: 'zero',
    effort: 'trivial',
    reduction: 0.3,
    acrPerHour: 3,
    explanation:
      'Cooking is often the largest indoor particle source of the day. Capturing it at the source beats filtering the whole house afterwards.',
  },
  {
    id: 'wet-mopping',
    zone: 'living_room',
    title: 'Wet-mop instead of dry sweeping',
    steps: [
      'Use a damp mop or a microfibre cloth on hard floors.',
      'Dust with a damp cloth rather than a dry duster.',
      'Empty the vacuum bag outdoors and away from living spaces.',
    ],
    costBand: 'zero',
    effort: 'trivial',
    reduction: 0.12,
    acrPerHour: 0,
    explanation:
      'Dry sweeping lifts settled dust straight back into the breathing zone, where children spend most of their time.',
  },
  {
    id: 'humidity-control',
    zone: 'whole_home',
    title: 'Hold humidity between 30% and 50%',
    steps: [
      'Use an exhaust fan or a dehumidifier in damp rooms.',
      'Fix slow leaks under sinks and around window frames.',
      'Avoid drying laundry indoors during a smog episode.',
    ],
    costBand: 'low',
    effort: 'easy',
    reduction: 0.1,
    acrPerHour: 0,
    explanation:
      'Above 50% humidity particles grow and stay airborne longer, and mould spores join in. Below 30% your airways dry out and get more sensitive.',
  },
  {
    id: 'bedroom-timer',
    zone: 'bedroom',
    title: 'Run the purifier 30 minutes before you sleep',
    steps: [
      'Place the purifier 30–50 cm from the wall, away from curtains.',
      'Start it 30 minutes before bedtime and leave it on low overnight.',
      'Keep the bedroom door closed while it runs.',
      'Replace the filter when the manufacturer’s indicator says so.',
    ],
    costBand: 'medium',
    effort: 'trivial',
    reduction: 0.5,
    acrPerHour: 3.5,
    explanation:
      'You spend about a third of your life in the bedroom. Cleaning it before you lie down matters more than cleaning a room you walk through.',
  },
  {
    id: 'shoe-off',
    zone: 'whole_home',
    title: 'Shoes off, mat at the door',
    steps: [
      'Keep a washable mat just inside the entrance.',
      'Ask everyone to switch to indoor shoes or socks.',
      'Shake mats out outdoors, never indoors.',
    ],
    costBand: 'zero',
    effort: 'trivial',
    reduction: 0.08,
    acrPerHour: 0,
    explanation:
      'Shoes carry road dust, tyre wear and settled soot straight onto the floor where toddlers crawl and play.',
  },
  {
    id: 'stop-burning',
    zone: 'living_room',
    title: 'Put out the incense, candles and mosquito coils',
    steps: [
      'Swap incense sticks for an essential-oil diffuser on cold water.',
      'Use LED candles for atmosphere.',
      'Switch to electric mosquito mats instead of coils.',
    ],
    costBand: 'zero',
    effort: 'trivial',
    reduction: 0.2,
    acrPerHour: 0,
    explanation:
      'A single burning incense stick can push indoor PM2.5 above 200 µg/m³ — worse than standing in heavy street traffic.',
  },
  {
    id: 'indoor-plants',
    zone: 'living_room',
    title: 'Add plants — but do not count on them',
    steps: [
      'Choose pothos, spider plant or peace lily if you want greenery.',
      'Keep them healthy; stressed plants do nothing useful.',
      'Treat them as decoration, never as your filtration plan.',
    ],
    costBand: 'low',
    effort: 'weekend',
    reduction: 0.03,
    acrPerHour: 0,
    explanation:
      'Plant-based filtration is real but tiny: you would need dozens of mature plants per room to match one purifier. Enjoy them, rely on filters.',
  },
  {
    id: 'hepa-vacuum',
    zone: 'living_room',
    title: 'Vacuum with a HEPA-sealed machine',
    steps: [
      'Choose a vacuum with a sealed HEPA path, not just a HEPA label.',
      'Vacuum textiles twice a week during smog season.',
      'Empty the bin outdoors or into a sealed bag.',
    ],
    costBand: 'medium',
    effort: 'easy',
    reduction: 0.14,
    acrPerHour: 0,
    explanation:
      'An unsealed vacuum blows the fine fraction it just collected back out through its exhaust, undoing the clean-up.',
  },
  {
    id: 'induction-cook',
    zone: 'kitchen',
    title: 'Switch the flame for an induction plate',
    steps: [
      'Use a portable induction hob for daily cooking.',
      'Keep the extractor running for the whole cooking session.',
      'If a switch is not affordable, cook on the lowest effective flame with the lid on.',
    ],
    costBand: 'medium',
    effort: 'weekend',
    reduction: 0.35,
    acrPerHour: 0,
    explanation:
      'Combustion cooking releases NO2, carbon monoxide and ultrafine particles into the room you eat in. Induction produces none of them.',
  },
];
