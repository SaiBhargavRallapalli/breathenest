// ============================================================
// server/schemas.ts
// Zod contracts for every inbound request. Validation happens before
// any business logic or upstream call, so malformed input can never
// reach the air-quality client or the model prompt.
// ============================================================

import { z } from 'zod';

const LAT = z.number().min(-90).max(90);
const LON = z.number().min(-180).max(180);
const AQI = z.number().min(0).max(500);

const COMMUTE_MODES = [
  'metro',
  'electric_bus',
  'diesel_bus',
  'car',
  'ev',
  'cycling',
  'walking',
  'work_from_home',
] as const;

const HOME_TYPES = ['apartment', 'independent_house', 'shared_house', 'dormitory'] as const;
const BUDGETS = ['zero', 'low', 'medium', 'high'] as const;
const COOKING_FUELS = ['gas', 'labeled_cylinder', 'induction', 'wood_coal'] as const;
const LANGUAGES = ['en', 'hi', 'ar', 'es'] as const;

const VULNERABILITIES = [
  'infant',
  'toddler',
  'asthma',
  'elderly',
  'heart_condition',
  'pregnant',
  'outdoor_worker',
  'none',
] as const;

const memberSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(64),
  age: z.number().int().min(0).max(120),
  vulnerabilities: z.array(z.enum(VULNERABILITIES)).min(1).max(8),
});

export const profileSchema = z.object({
  locationId: z.string().min(1).max(64),
  locationName: z.string().min(1).max(80),
  country: z.string().min(1).max(64),
  latitude: LAT,
  longitude: LON,
  members: z.array(memberSchema).min(1).max(12),
  commute: z.enum(COMMUTE_MODES),
  workStartHour: z.number().int().min(0).max(23),
  workEndHour: z.number().int().min(1).max(24),
  homeType: z.enum(HOME_TYPES),
  budget: z.enum(BUDGETS),
  cookingFuel: z.enum(COOKING_FUELS),
  language: z.enum(LANGUAGES),
});

export const hourSchema = z.object({
  hour: z.number().int().min(0).max(23),
  aqi: AQI,
});

export const planRequestSchema = z.object({
  profile: profileSchema,
  currentAqi: AQI,
  hours: z.array(hourSchema).min(1).max(24),
});

export const advisoryRequestSchema = z.object({
  locationName: z.string().min(1).max(80),
  aqi: AQI,
  language: z.enum(LANGUAGES),
  members: z.array(memberSchema).min(0).max(12).optional(),
});

export const locationQuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
});

export const airQualityQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  name: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  id: z.string().trim().max(64).optional(),
});

/** Convenience aliases so route files read naturally. */
export type PlanRequest = z.infer<typeof planRequestSchema>;
export type AdvisoryRequest = z.infer<typeof advisoryRequestSchema>;
export type AirQualityQuery = z.infer<typeof airQualityQuerySchema>;
