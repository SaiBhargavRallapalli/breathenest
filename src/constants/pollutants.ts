// ============================================================
// src/constants/pollutants.ts
// Pollutant metadata plus the US EPA AQI breakpoint tables.
// Concentrations follow EPA units: PM in µg/m³, gases in ppb/ppm.
// ============================================================

import type { PollutantKey } from '@/types';

/** A closed [low, high] concentration band mapped to [aqiLow, aqiHigh]. */
export interface Breakpoint {
  readonly low: number;
  readonly high: number;
  readonly aqiLow: number;
  readonly aqiHigh: number;
}

export interface PollutantMeta {
  readonly key: PollutantKey;
  readonly label: string;
  readonly short: string;
  readonly unit: string;
  readonly sourceUnit: string;
  /** Multiplier that converts the upstream unit into the EPA unit above. */
  readonly toEpaScale: number;
  readonly healthNote: string;
}

/** Unit-normalising constants (25 °C, 1 atm). */
export const GAS_CONVERSIONS = {
  /** 1 ppb NO2 = 1.88 µg/m³ (MW 46.01). */
  no2: 1 / 1.88,
  /** 1 ppb O3 = 1.96 µg/m³ (MW 48.00). */
  o3: 1 / 1.96,
  /** 1 ppb SO2 = 2.62 µg/m³ (MW 64.07). */
  so2: 1 / 2.62,
  /** 1 ppm CO = 1145 µg/m³ (MW 28.01). */
  co: 1 / 1145,
} as const;

export const POLLUTANT_META: Readonly<Record<PollutantKey, PollutantMeta>> = {
  pm25: {
    key: 'pm25',
    label: 'Fine particulates',
    short: 'PM2.5',
    unit: 'µg/m³',
    sourceUnit: 'µg/m³',
    toEpaScale: 1,
    healthNote: 'Small enough to cross into the bloodstream; the main winter-smog risk.',
  },
  pm10: {
    key: 'pm10',
    label: 'Coarse particulates',
    short: 'PM10',
    unit: 'µg/m³',
    sourceUnit: 'µg/m³',
    toEpaScale: 1,
    healthNote: 'Dust and road wear that irritates the airways and eyes.',
  },
  o3: {
    key: 'o3',
    label: 'Ground-level ozone',
    short: 'O₃',
    unit: 'ppb',
    sourceUnit: 'µg/m³',
    toEpaScale: GAS_CONVERSIONS.o3,
    healthNote: 'A sun-driven irritant that worsens asthma on bright afternoons.',
  },
  no2: {
    key: 'no2',
    label: 'Nitrogen dioxide',
    short: 'NO₂',
    unit: 'ppb',
    sourceUnit: 'µg/m³',
    toEpaScale: GAS_CONVERSIONS.no2,
    healthNote: 'Traffic exhaust marker; inflames the lining of the lungs.',
  },
  so2: {
    key: 'so2',
    label: 'Sulphur dioxide',
    short: 'SO₂',
    unit: 'ppb',
    sourceUnit: 'µg/m³',
    toEpaScale: GAS_CONVERSIONS.so2,
    healthNote: 'Coal and industry plume; triggers bronchospasm in sensitive people.',
  },
  co: {
    key: 'co',
    label: 'Carbon monoxide',
    short: 'CO',
    unit: 'ppm',
    sourceUnit: 'µg/m³',
    toEpaScale: GAS_CONVERSIONS.co,
    healthNote: 'Reduces the blood’s oxygen carrying capacity at high levels.',
  },
};

/** Ordered pollutant keys used for stable rendering and dominant lookup. */
export const POLLUTANT_ORDER: readonly PollutantKey[] = ['pm25', 'pm10', 'o3', 'no2', 'so2', 'co'];

// ------------------------------------------------------------
// US EPA AQI breakpoints (40 CFR Part 58, Appendix G)
// ------------------------------------------------------------

export const PM25_BREAKPOINTS: readonly Breakpoint[] = [
  { low: 0.0, high: 12.0, aqiLow: 0, aqiHigh: 50 },
  { low: 12.1, high: 35.4, aqiLow: 51, aqiHigh: 100 },
  { low: 35.5, high: 55.4, aqiLow: 101, aqiHigh: 150 },
  { low: 55.5, high: 150.4, aqiLow: 151, aqiHigh: 200 },
  { low: 150.5, high: 250.4, aqiLow: 201, aqiHigh: 300 },
  { low: 250.5, high: 350.4, aqiLow: 301, aqiHigh: 400 },
  { low: 350.5, high: 500.4, aqiLow: 401, aqiHigh: 500 },
];

export const PM10_BREAKPOINTS: readonly Breakpoint[] = [
  { low: 0, high: 54, aqiLow: 0, aqiHigh: 50 },
  { low: 55, high: 154, aqiLow: 51, aqiHigh: 100 },
  { low: 155, high: 254, aqiLow: 101, aqiHigh: 150 },
  { low: 255, high: 354, aqiLow: 151, aqiHigh: 200 },
  { low: 355, high: 424, aqiLow: 201, aqiHigh: 300 },
  { low: 425, high: 504, aqiLow: 301, aqiHigh: 400 },
  { low: 505, high: 604, aqiLow: 401, aqiHigh: 500 },
];

export const O3_BREAKPOINTS: readonly Breakpoint[] = [
  { low: 0, high: 54, aqiLow: 0, aqiHigh: 50 },
  { low: 55, high: 70, aqiLow: 51, aqiHigh: 100 },
  { low: 71, high: 85, aqiLow: 101, aqiHigh: 150 },
  { low: 86, high: 105, aqiLow: 151, aqiHigh: 200 },
  { low: 106, high: 200, aqiLow: 201, aqiHigh: 300 },
  { low: 201, high: 504, aqiLow: 301, aqiHigh: 500 },
];

export const NO2_BREAKPOINTS: readonly Breakpoint[] = [
  { low: 0, high: 53, aqiLow: 0, aqiHigh: 50 },
  { low: 54, high: 100, aqiLow: 51, aqiHigh: 100 },
  { low: 101, high: 360, aqiLow: 101, aqiHigh: 150 },
  { low: 361, high: 649, aqiLow: 151, aqiHigh: 200 },
  { low: 650, high: 1249, aqiLow: 201, aqiHigh: 300 },
  { low: 1250, high: 1649, aqiLow: 301, aqiHigh: 400 },
  { low: 1650, high: 2049, aqiLow: 401, aqiHigh: 500 },
];

export const CO_BREAKPOINTS: readonly Breakpoint[] = [
  { low: 0.0, high: 4.4, aqiLow: 0, aqiHigh: 50 },
  { low: 4.5, high: 9.4, aqiLow: 51, aqiHigh: 100 },
  { low: 9.5, high: 12.4, aqiLow: 101, aqiHigh: 150 },
  { low: 12.5, high: 15.4, aqiLow: 151, aqiHigh: 200 },
  { low: 15.5, high: 30.4, aqiLow: 201, aqiHigh: 300 },
  { low: 30.5, high: 40.4, aqiLow: 301, aqiHigh: 400 },
  { low: 40.5, high: 50.4, aqiLow: 401, aqiHigh: 500 },
];

export const SO2_BREAKPOINTS: readonly Breakpoint[] = [
  { low: 0, high: 35, aqiLow: 0, aqiHigh: 50 },
  { low: 36, high: 75, aqiLow: 51, aqiHigh: 100 },
  { low: 76, high: 185, aqiLow: 101, aqiHigh: 150 },
  { low: 186, high: 304, aqiLow: 151, aqiHigh: 200 },
  { low: 305, high: 604, aqiLow: 201, aqiHigh: 300 },
  { low: 605, high: 804, aqiLow: 301, aqiHigh: 400 },
  { low: 805, high: 1004, aqiLow: 401, aqiHigh: 500 },
];

/** Concentration → AQI table lookup for every pollutant. */
export const BREAKPOINTS: Readonly<Record<PollutantKey, readonly Breakpoint[]>> = {
  pm25: PM25_BREAKPOINTS,
  pm10: PM10_BREAKPOINTS,
  o3: O3_BREAKPOINTS,
  no2: NO2_BREAKPOINTS,
  so2: SO2_BREAKPOINTS,
  co: CO_BREAKPOINTS,
};
