// ============================================================
// src/types/index.ts
// Central domain model for BreatheNest.
// Strict unions + readonly contracts; zero `any`.
// ============================================================

/** Pollutants tracked by the assistant, keyed by their Open-Meteo field. */
export type PollutantKey = 'pm25' | 'pm10' | 'o3' | 'no2' | 'so2' | 'co';

/** The six EPA air-quality bands, ordered from cleanest to most polluted. */
export type AqiCategory =
  | 'good'
  | 'moderate'
  | 'unhealthy_sensitive'
  | 'unhealthy'
  | 'very_unhealthy'
  | 'hazardous';

/** Where a reading came from — surfaced in the UI so users can trust it. */
export type ReadingSource = 'live' | 'cache' | 'sample';

/** Everything one air-quality lookup produces. */
export interface AirBundle {
  readonly reading: AirReading;
  readonly forecast: ForecastDay;
  readonly stagnation: StagnationAssessment;
  readonly fetchedAt: string;
}

/** Lifecycle states shared by every async panel. */
export type LoadState = 'idle' | 'loading' | 'success' | 'error';

/** A single pollutant's resolved value, its AQI sub-index and units. */
export interface PollutantReading {
  readonly key: PollutantKey;
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly subIndex: number;
  readonly dominant: boolean;
}

/** A complete, unit-normalised air-quality observation for one place. */
export interface AirReading {
  readonly locationId: string;
  readonly locationName: string;
  readonly region: string;
  readonly country: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly observedAt: string;
  readonly source: ReadingSource;
  readonly aqi: number;
  readonly category: AqiCategory;
  readonly dominant: PollutantKey;
  readonly readings: readonly PollutantReading[];
  /** Convenience accessor for the raw PM2.5 concentration (µg/m³). */
  readonly pm25: number;
}

/** The minimum shape a temporal computation needs: an hour and its AQI. */
export interface HourPoint {
  readonly hour: number;
  readonly aqi: number;
}

/** One hour of a forward-looking forecast. */
export interface HourlyForecast extends HourPoint {
  readonly iso: string;
  readonly pm25: number;
  readonly category: AqiCategory;
}

/** Surface weather used to judge whether the air will stagnate. */
export interface WeatherSnapshot {
  readonly windSpeedKmh: number | null;
  readonly temperatureC: number | null;
  readonly humidityPct: number | null;
}

/** A 24-hour forecast bundle plus the weather that shaped it. */
export interface ForecastDay {
  readonly hours: readonly HourlyForecast[];
  readonly weather: WeatherSnapshot;
  readonly source: ReadingSource;
}

/** Result of the atmospheric stagnation / inversion heuristic. */
export interface StagnationAssessment {
  readonly level: 'none' | 'moderate' | 'severe';
  readonly score: number;
  readonly reasons: readonly string[];
}

/** Activity intensity classes used for breathing-rate lookups. */
export type ActivityLevel = 'rest' | 'light' | 'moderate' | 'vigorous';

/** How risky an AQI band is for a given activity. */
export type RiskLevel = 'ideal' | 'acceptable' | 'poor' | 'avoid';

/** A candidate low-exposure time slot produced by the window optimiser. */
export interface TimeWindow {
  readonly startHour: number;
  readonly endHour: number;
  readonly peakAqi: number;
  readonly averageAqi: number;
  readonly risk: RiskLevel;
}

/** Household vulnerability flags that change the advice we give. */
export type VulnerabilityTag =
  | 'infant'
  | 'toddler'
  | 'asthma'
  | 'elderly'
  | 'heart_condition'
  | 'pregnant'
  | 'outdoor_worker'
  | 'none';

/** How a household member gets around on an average day. */
export type CommuteMode =
  | 'metro'
  | 'electric_bus'
  | 'diesel_bus'
  | 'car'
  | 'ev'
  | 'cycling'
  | 'walking'
  | 'work_from_home';

/** Physical characteristics of the home the advice is tailored to. */
export type HomeType = 'apartment' | 'independent_house' | 'shared_house' | 'dormitory';

/** Budget band used to rank indoor-air hacks and swaps. */
export type BudgetBand = 'zero' | 'low' | 'medium' | 'high';

/** The household profile every recommendation is derived from. */
export interface HouseholdProfile {
  readonly locationId: string;
  readonly locationName: string;
  readonly country: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly members: readonly HouseholdMember[];
  readonly commute: CommuteMode;
  readonly workStartHour: number;
  readonly workEndHour: number;
  readonly homeType: HomeType;
  readonly budget: BudgetBand;
  readonly cookingFuel: 'gas' | 'labeled_cylinder' | 'induction' | 'wood_coal';
  readonly language: SupportedLanguage;
}

/** One person in the household, with the risks that matter for smog. */
export interface HouseholdMember {
  readonly id: string;
  readonly label: string;
  readonly age: number;
  readonly vulnerabilities: readonly VulnerabilityTag[];
}

/** Languages the assistant can speak, including one RTL script. */
export type SupportedLanguage = 'en' | 'hi' | 'ar' | 'es';

/** One block of a generated daily routine. */
export interface RoutineBlock {
  readonly time: string;
  readonly title: string;
  readonly detail: string;
  readonly windowAqi: number;
  readonly risk: RiskLevel;
  /** Quantified effect of doing (or skipping) this block. */
  readonly impact: string;
}

/** A full day plan returned by the planner. */
export interface DailyPlan {
  readonly blocks: readonly RoutineBlock[];
  readonly bestOutdoorWindow: TimeWindow | null;
  readonly summary: string;
  readonly generator: 'gemini' | 'groq' | 'local';
  readonly generatedAt: string;
}

/** A quantified comparison between two ways of doing something. */
export interface ImpactDelta {
  /** Annual CO2 avoided by making the change. */
  readonly co2KgPerYear: number;
  /** Fine particulate matter no longer inhaled, averaged per day (µg). */
  readonly inhaledPm25UgPerDay: number;
  /** Annual money kept by making the change. */
  readonly moneySavedPerYear: number;
  readonly currency: string;
}

/** Aggregated effect of the choices made so far. */
export interface ImpactLedger {
  readonly co2KgPerYear: number;
  readonly inhaledPm25UgPerDay: number;
  readonly moneyPerYear: number;
  readonly currency: string;
  readonly equivalents: readonly Equivalent[];
}

/** Rolling totals contributed by a neighbourhood's pledges. */
export interface CommunityTotals {
  readonly co2KgPerYear: number;
  readonly pm25GramsPerYear: number;
  readonly members: number;
}

/** A sustainable alternative the household could switch to. */
export interface Swap {
  readonly id: string;
  readonly category: 'commute' | 'home_energy' | 'food' | 'waste' | 'water';
  readonly title: string;
  readonly from: string;
  readonly to: string;
  readonly effort: BudgetBand;
  readonly annualBaseline: ImpactDelta;
  readonly why: string;
  readonly applicable: (profile: HouseholdProfile) => boolean;
}

/** An indoor-air intervention with cost and effectiveness metadata. */
export interface AirHack {
  readonly id: string;
  readonly zone: 'bedroom' | 'kitchen' | 'living_room' | 'whole_home';
  readonly title: string;
  readonly steps: readonly string[];
  readonly costBand: BudgetBand;
  readonly effort: 'trivial' | 'easy' | 'weekend';
  /** Expected fractional reduction of indoor PM2.5, 0–1 (design estimate). */
  readonly reduction: number;
  readonly acrPerHour: number;
  readonly explanation: string;
}

/** A collective action a resident can commit to. */
export interface Pledge {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly co2KgPerWeek: number;
  readonly pm25GramsPerWeek: number;
}

/** A relatable way to express a CO2 saving. */
export interface Equivalent {
  readonly label: string;
  readonly value: number;
  readonly unit: string;
}
