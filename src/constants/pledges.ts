// ============================================================
// src/constants/pledges.ts
// Neighbourhood commitments. Emission figures are weekly per
// participant so the community total can be annualised honestly.
// ============================================================

import type { Pledge } from '@/types';

export const PLEDGES: readonly Pledge[] = [
  {
    id: 'carpool-week',
    title: 'Carpool twice a week',
    detail: 'Share two return trips each week with a neighbour on the same route.',
    co2KgPerWeek: 12,
    pm25GramsPerWeek: 0.5,
  },
  {
    id: 'no-open-burning',
    title: 'Never burn household waste',
    detail: 'Use the municipal collection instead of a garden or roadside fire.',
    co2KgPerWeek: 4,
    pm25GramsPerWeek: 3,
  },
  {
    id: 'car-free-day',
    title: 'One car-free day a week',
    detail: 'Leave the car home on one weekday and walk, cycle or take the bus.',
    co2KgPerWeek: 8,
    pm25GramsPerWeek: 0.8,
  },
  {
    id: 'clean-cooking',
    title: 'Cook with clean fuel only',
    detail: 'Move the household off wood and coal onto LPG, induction or electric.',
    co2KgPerWeek: 10,
    pm25GramsPerWeek: 4,
  },
  {
    id: 'wet-sweeping',
    title: 'Wet-sweep the street outside',
    detail: 'Dust down the pavement in front of your home instead of dry sweeping it.',
    co2KgPerWeek: 0.5,
    pm25GramsPerWeek: 6,
  },
  {
    id: 'idle-off',
    title: 'Switch off at the kerb',
    detail: 'Turn the engine off whenever you are parked and waiting.',
    co2KgPerWeek: 3,
    pm25GramsPerWeek: 0.6,
  },
  {
    id: 'plant-a-tree',
    title: 'Plant and keep one tree alive',
    detail: 'A single healthy tree offsets around 21 kg of CO2 over a year.',
    co2KgPerWeek: 0.4,
    pm25GramsPerWeek: 0.3,
  },
  {
    id: 'wellbeing-check',
    title: 'Check on a vulnerable neighbour',
    detail: 'Knock on an elderly or asthmatic neighbour’s door on every red-alert day.',
    co2KgPerWeek: 0,
    pm25GramsPerWeek: 0,
  },
];
