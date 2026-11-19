// ============================================================
// src/constants/cities.ts
// Seed locations for the offline fallback. Coordinates are used to
// fetch live readings; names are what the user sees and searches for.
// ============================================================

import type { HomeType } from '@/types';

export interface CitySeed {
  readonly id: string;
  readonly name: string;
  readonly region: string;
  readonly country: string;
  readonly countryCode: string;
  readonly latitude: number;
  readonly longitude: number;
}

/** Cities that repeatedly top winter smog rankings, plus cleaner controls. */
export const SEED_CITIES: readonly CitySeed[] = [
  {
    id: 'delhi-in',
    name: 'Delhi',
    region: 'National Capital Territory',
    country: 'India',
    countryCode: 'IN',
    latitude: 28.6139,
    longitude: 77.209,
  },
  {
    id: 'lahore-pk',
    name: 'Lahore',
    region: 'Punjab',
    country: 'Pakistan',
    countryCode: 'PK',
    latitude: 31.5204,
    longitude: 74.3587,
  },
  {
    id: 'dhaka-bd',
    name: 'Dhaka',
    region: 'Dhaka Division',
    country: 'Bangladesh',
    countryCode: 'BD',
    latitude: 23.8103,
    longitude: 90.4125,
  },
  {
    id: 'beijing-cn',
    name: 'Beijing',
    region: 'Hebei',
    country: 'China',
    countryCode: 'CN',
    latitude: 39.9042,
    longitude: 116.4074,
  },
  {
    id: 'jakarta-id',
    name: 'Jakarta',
    region: 'Java',
    country: 'Indonesia',
    countryCode: 'ID',
    latitude: -6.2088,
    longitude: 106.8456,
  },
  {
    id: 'cairo-eg',
    name: 'Cairo',
    region: 'Cairo Governorate',
    country: 'Egypt',
    countryCode: 'EG',
    latitude: 30.0444,
    longitude: 31.2357,
  },
  {
    id: 'mexico-city-mx',
    name: 'Mexico City',
    region: 'CDMX',
    country: 'Mexico',
    countryCode: 'MX',
    latitude: 19.4326,
    longitude: -99.1332,
  },
  {
    id: 'los-angeles-us',
    name: 'Los Angeles',
    region: 'California',
    country: 'United States',
    countryCode: 'US',
    latitude: 34.0522,
    longitude: -118.2437,
  },
  {
    id: 'london-gb',
    name: 'London',
    region: 'England',
    country: 'United Kingdom',
    countryCode: 'GB',
    latitude: 51.5074,
    longitude: -0.1278,
  },
  {
    id: 'nairobi-ke',
    name: 'Nairobi',
    region: 'Nairobi County',
    country: 'Kenya',
    countryCode: 'KE',
    latitude: -1.2921,
    longitude: 36.8219,
  },
];

/** The location the app boots with before the user chooses one. */
export const DEFAULT_CITY: CitySeed = SEED_CITIES[0] as CitySeed;

/** Ceiling heights assumed when a user has not told us their home type. */
export const TYPICAL_CEILING_M: Readonly<Record<HomeType, number>> = {
  apartment: 2.8,
  independent_house: 3.2,
  shared_house: 2.7,
  dormitory: 3.0,
};

/** Labels for every home type, used in the profile form. */
export const HOME_TYPE_LABELS: Readonly<Record<HomeType, string>> = {
  apartment: 'Apartment',
  independent_house: 'Independent house',
  shared_house: 'Shared house',
  dormitory: 'Hostel / dormitory',
};
